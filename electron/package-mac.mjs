import fs from "node:fs/promises";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const hash = (bytes, algorithm = "sha256", encoding = "hex") =>
  createHash(algorithm).update(bytes).digest(encoding);
const run = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} exited with ${signal || code}`)),
    );
  });
async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
async function fingerprint(directory, relative = "", result = {}) {
  for (const entry of (
    await fs.readdir(directory, { withFileTypes: true })
  ).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = path.posix.join(relative, entry.name);
    if (entry.isDirectory())
      await fingerprint(path.join(directory, entry.name), name, result);
    else
      result[name] = hash(await fs.readFile(path.join(directory, entry.name)));
  }
  return result;
}
/** Stage a thin main-process manifest; builder traverses the linked installed production graph. */
export async function stageRuntime(staging, pkg) {
  const lockBytes = await fs.readFile(path.join(root, "package-lock.json"));
  const lock = JSON.parse(lockBytes);
  const updaterVersion = pkg.dependencies?.["electron-updater"];
  if (!/^\d+\.\d+\.\d+$/.test(updaterVersion || ""))
    throw Error(
      "electron-updater must be an exactly pinned runtime dependency.",
    );
  if (
    lock.packages?.[""]?.dependencies?.["electron-updater"] !== updaterVersion
  )
    throw Error(
      "Pinned updater dependency differs from root package-lock.json.",
    );
  const dependencies = { "electron-updater": updaterVersion },
    inventory = new Map();
  const modules = path.join(root, "node_modules");
  async function dependency(name, from, optional = false) {
    // Resolve package directories like Node without executing package entry points.
    const directories =
      createRequire(path.join(from, "package.json")).resolve.paths(name) || [];
    let directory;
    for (const search of directories)
      if (await exists(path.join(search, name, "package.json"))) {
        directory = await fs.realpath(path.join(search, name));
        break;
      }
    if (!directory) {
      if (optional) return;
      throw Error(`Installed runtime dependency is missing: ${name}`);
    }
    if (!directory.startsWith(modules + path.sep))
      throw Error(
        `Runtime dependency is outside installed node_modules: ${name}`,
      );
    const key = path.relative(root, directory).split(path.sep).join("/");
    if (inventory.has(key)) return;
    const bytes = await fs.readFile(path.join(directory, "package.json")),
      metadata = JSON.parse(bytes),
      locked = lock.packages[key];
    if (!locked || locked.version !== metadata.version)
      throw Error(
        `Installed runtime dependency differs from package-lock.json: ${name}`,
      );
    if (name === "electron-updater" && metadata.version !== updaterVersion)
      throw Error(
        "Installed electron-updater differs from the pinned runtime version.",
      );
    inventory.set(key, {
      name: metadata.name,
      version: metadata.version,
      installedPath: key,
      integrity: locked.integrity,
      packageJsonSha256: hash(bytes),
    });
    for (const child of Object.keys(metadata.dependencies || {}).sort())
      await dependency(child, directory);
    for (const child of Object.keys(metadata.optionalDependencies || {}).sort())
      await dependency(child, directory, true);
  }
  await dependency("electron-updater", root);
  await fs.mkdir(staging, { recursive: true });
  const production = {};
  async function copy(directory, relative = "") {
    for (const entry of (
      await fs.readdir(directory, { withFileTypes: true })
    ).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) {
        if (!["test", "tests", "__tests__"].includes(entry.name))
          await copy(path.join(directory, entry.name), name);
      } else if (
        entry.name.endsWith(".cjs") &&
        !/\.(?:test|spec)\.cjs$/.test(entry.name)
      ) {
        const source = path.join(directory, entry.name),
          target = path.join(staging, "electron", name);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.copyFile(source, target);
        production[path.posix.join("electron", name)] = hash(
          await fs.readFile(target),
        );
      }
    }
  }
  await copy(path.join(root, "electron"));
  const manifest = {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    author: "INTUITION Robotique & Technologies",
    private: true,
    main: "electron/main.cjs",
    dependencies,
  };
  await fs.writeFile(
    path.join(staging, "package.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  // A matching thin lock prevents ancestor lock/workspace detection from selecting the full frontend graph.
  const packages = {
    "": { name: pkg.name, version: pkg.version, dependencies },
  };
  for (const key of [...inventory.keys()].sort())
    packages[key] = lock.packages[key];
  await fs.writeFile(
    path.join(staging, "package-lock.json"),
    JSON.stringify(
      {
        name: pkg.name,
        version: pkg.version,
        lockfileVersion: lock.lockfileVersion,
        requires: true,
        packages,
      },
      null,
      2,
    ) + "\n",
  );
  await fs.symlink(modules, path.join(staging, "node_modules"), "dir");
  return {
    packageLockSha256: hash(lockBytes),
    runtimeFiles: production,
    runtimeDependencies: [...inventory.values()].sort((a, b) =>
      a.installedPath.localeCompare(b.installedPath),
    ),
  };
}
async function verifyPackage(output, pkg, provenance) {
  const config = require("../electron-builder.cjs"),
    yaml = require("js-yaml"),
    asar = require("@electron/asar");
  const resources = path.join(
    output,
    "mac-arm64",
    `${config.productName}.app`,
    "Contents",
    "Resources",
  );
  const archive = path.join(resources, "app.asar"),
    archiveFiles = asar.listPackage(archive);
  for (const file of Object.keys(provenance.runtimeFiles))
    if (!archiveFiles.includes("/" + file))
      throw Error(`Packaged runtime helper is missing: ${file}`);
  if (archiveFiles.some((file) => /\.(?:test|spec)\.cjs$/.test(file)))
    throw Error("Test helpers must not be packaged.");
  const packaged = new Set();
  for (const file of archiveFiles.filter((file) =>
    /^\/node_modules\/.*\/package\.json$/.test(file),
  )) {
    const metadata = JSON.parse(asar.extractFile(archive, file.slice(1)));
    packaged.add(`${metadata.name}@${metadata.version}`);
  }
  for (const dep of provenance.runtimeDependencies)
    if (!packaged.has(`${dep.name}@${dep.version}`))
      throw Error(
        `Packaged updater dependency is missing: ${dep.name}@${dep.version}`,
      );
  const feed = yaml.load(
    await fs.readFile(path.join(resources, "app-update.yml"), "utf8"),
  );
  if (
    feed.provider !== "github" ||
    feed.owner !== "casimir-engineering" ||
    feed.repo !== "shenzhen-3D" ||
    feed.private !== true ||
    "token" in feed
  )
    throw Error("Unexpected or credential-bearing packaged updater feed.");
  const update = yaml.load(
    await fs.readFile(path.join(output, "latest-mac.yml"), "utf8"),
  );
  if (update.version !== pkg.version || !update.path?.endsWith(".zip"))
    throw Error("Mac updater metadata must reference the current ZIP version.");
  const expected = ["zip", "dmg"].map(
    (ext) => `Shenzhen-3D-${pkg.version}-Apple-Silicon.${ext}`,
  );
  const artifacts = [];
  for (const name of expected) {
    const data = await fs.readFile(path.join(output, name)),
      entry = update.files?.find((file) => file.url === name);
    if (
      !entry ||
      entry.sha512 !== hash(data, "sha512", "base64") ||
      (entry.size !== undefined && entry.size !== data.length)
    )
      throw Error(
        `Mac updater metadata does not match artifact bytes: ${name}`,
      );
    artifacts.push({
      file: name,
      size: data.length,
      sha256: hash(data),
      sha512: hash(data, "sha512", "base64"),
    });
  }
  const zip = artifacts.find((file) => file.file.endsWith(".zip"));
  if (update.path !== zip.file || update.sha512 !== zip.sha512)
    throw Error("Mac updater legacy ZIP fingerprint is inconsistent.");
  return {
    artifacts,
    packagedDependencyCount: packaged.size,
    updateMetadata: {
      file: "latest-mac.yml",
      sha256: hash(await fs.readFile(path.join(output, "latest-mac.yml"))),
    },
  };
}
async function main() {
  // Packaging always consumes a fresh production build, including stage-only verification.
  await run("npm", ["run", "build"]);
  const pkg = JSON.parse(
    await fs.readFile(path.join(root, "package.json"), "utf8"),
  );
  const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const output = path.join(
      root,
      "artifacts/electron",
      `${pkg.version}-${stamp}`,
    ),
    staging = path.join(output, "staging");
  await fs.mkdir(staging, { recursive: true });
  await fs.cp(path.join(root, "dist"), path.join(staging, "dist"), {
    recursive: true,
  });
  const runtime = await stageRuntime(staging, pkg);
  const provenance = {
    version: pkg.version,
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
    sourceDirty: Boolean(
      execFileSync("git", ["status", "--porcelain"], {
        cwd: root,
        encoding: "utf8",
      }).trim(),
    ),
    builtAt: new Date().toISOString(),
    frontendFiles: await fingerprint(path.join(staging, "dist")),
    ...runtime,
  };
  const buildInfo = JSON.stringify(provenance, null, 2) + "\n";
  await fs.writeFile(path.join(output, "build-info.json"), buildInfo);
  await fs.writeFile(path.join(staging, "build-info.json"), buildInfo);
  if (process.argv.includes("--stage-only")) {
    console.log(`Electron staging verified: ${staging}`);
    return;
  }
  const builder = path.join(
    root,
    "node_modules/electron-builder/out/cli/cli.js",
  );
  await run(process.execPath, [
    builder,
    "--projectDir",
    staging,
    "--config",
    path.join(root, "electron-builder.cjs"),
    "--config.directories.output",
    output,
    "--config.electronVersion",
    pkg.devDependencies.electron,
    "--mac",
    "--arm64",
    "--publish",
    "never",
  ]);
  const verification = await verifyPackage(output, pkg, provenance);
  await fs.writeFile(
    path.join(output, "build-info.json"),
    JSON.stringify({ ...provenance, ...verification }, null, 2) + "\n",
  );
  console.log(`Electron artifacts: ${output}`);
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  await main();

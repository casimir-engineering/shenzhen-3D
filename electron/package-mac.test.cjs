const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const asar = require("@electron/asar");
const { RELEASE_OWNERS } = require("./release-channel.cjs");

for (const releaseOwner of RELEASE_OWNERS) {
  test(`runtime staging and actual ASAR retain ${releaseOwner} with all production dependencies`, async (t) => {
    const temp = await fs.mkdtemp(
      path.join(os.tmpdir(), "shenzhen-package-channel-"),
    );
    t.after(() => fs.rm(temp, { recursive: true, force: true }));
    const staging = path.join(temp, "staging");
    const pkg = require("../package.json");
    const { stageRuntime, verifyRuntimeArchive } =
      await import("./package-mac.mjs");
    const metadata = await stageRuntime(staging, pkg, { releaseOwner });
    assert.equal(metadata.releaseOwner, releaseOwner);
    assert.equal(
      JSON.parse(await fs.readFile(path.join(staging, "package.json")))
        .releaseOwner,
      releaseOwner,
    );
    assert.equal(metadata.runtimeDependencies.length, 16);
    assert.ok(
      Object.hasOwn(metadata.runtimeFiles, "electron/release-channel.cjs"),
    );
    assert.ok(
      Object.keys(metadata.runtimeFiles).every(
        (file) => !file.endsWith(".test.cjs"),
      ),
    );
    const archive = path.join(temp, "app.asar");
    await asar.createPackage(staging, archive);
    assert.equal(
      verifyRuntimeArchive(archive, metadata).packagedDependencyCount,
      16,
    );
    assert.throws(
      () =>
        verifyRuntimeArchive(archive, {
          ...metadata,
          releaseOwner: RELEASE_OWNERS.find((x) => x !== releaseOwner),
        }),
      /does not match provenance/,
    );
    const config = require("../electron-builder.cjs");
    await fs.writeFile(
      path.join(staging, "build-info.json"),
      JSON.stringify(metadata),
    );
    const appOutDir = path.join(temp, "out");
    const resources = path.join(
      appOutDir,
      "Shenzhen 3D.app/Contents/Resources",
    );
    await fs.mkdir(resources, { recursive: true });
    await fs.copyFile(archive, path.join(resources, "app.asar"));
    const context = {
      appOutDir,
      packager: {
        projectDir: staging,
        config: { publish: { ...config.publish, owner: releaseOwner } },
      },
    };
    await config.afterPack(context);
    context.packager.config.publish.owner = RELEASE_OWNERS.find(
      (x) => x !== releaseOwner,
    );
    await assert.rejects(
      config.afterPack(context),
      /does not match release owner/,
    );
  });
}

const path = require("node:path");
module.exports = {
  appId: "com.shenzhen3d.performance",
  productName: "Shenzhen 3D",
  asar: true,
  npmRebuild: false,
  // Fail on missing runtime dependencies before an expensive signing pass.
  async afterPack(context) {
    const fs = require("node:fs/promises");
    const { verifyRuntimeArchive } = await import("./electron/package-mac.mjs");
    const provenance = JSON.parse(
      await fs.readFile(
        path.join(context.packager.projectDir, "build-info.json"),
        "utf8",
      ),
    );
    const { validatePackagedFeed } = require("./electron/release-channel.cjs");
    validatePackagedFeed(
      context.packager.config.publish,
      provenance.releaseOwner,
    );
    verifyRuntimeArchive(
      path.join(
        context.appOutDir,
        `${module.exports.productName}.app`,
        "Contents",
        "Resources",
        "app.asar",
      ),
      provenance,
      JSON.parse(
        await fs.readFile(
          path.join(context.packager.projectDir, ".release-verification.json"),
          "utf8",
        ),
      ),
    );
  },
  files: [
    "dist/**/*",
    "electron/**/*.cjs",
    "build-info.json",
    "package.json",
    "!.release-verification.json",
    "!**/*.test.cjs",
    "!**/*.spec.cjs",
  ],
  extraResources: [
    {
      from: path.join(__dirname, "node_modules/electron/dist/LICENSE"),
      to: "Electron-LICENSE.txt",
    },
    {
      from: path.join(
        __dirname,
        "node_modules/electron/dist/LICENSES.chromium.html",
      ),
      to: "Chromium-LICENSES.html",
    },
  ],
  mac: {
    target: [
      { target: "dmg", arch: ["arm64"] },
      { target: "zip", arch: ["arm64"] },
    ],
    category: "public.app-category.graphics-design",
    icon: path.join(__dirname, "src-tauri/icons/icon.icns"),
    minimumSystemVersion: "13.0",
    identity: "INTUITION Robotique & Technologies (66LJ4BV7Q3)",
    hardenedRuntime: true,
    notarize: false,
  },
  dmg: {
    sign: true,
    title: "Shenzhen 3D ${version}",
    background: path.join(__dirname, "electron/installer/background.png"),
    window: { width: 760, height: 500 },
    iconSize: 112,
    iconTextSize: 13,
    contents: [
      { x: 210, y: 280, type: "file" },
      { x: 550, y: 280, type: "link", path: "/Applications" },
    ],
  },
  // Feed metadata is generated locally; the packaging command always uses --publish never.
  publish: {
    provider: "github",
    repo: "shenzhen-3D",
    private: true,
    channel: "latest",
  },
  artifactName: "Shenzhen-3D-${version}-Apple-Silicon.${ext}",
};

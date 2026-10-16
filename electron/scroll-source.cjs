const path = require("node:path");
function createScrollSource({ app, windows }) {
  let native;
  if (process.platform === "darwin") {
    try {
      const binary = app.isPackaged
        ? path.join(__dirname, "native/scroll-source.node")
        : path.join(
            __dirname,
            "../artifacts/native-scroll",
            process.arch,
            "scroll-source.node",
          );
      native = require(binary);
      if (!native.start()) native = undefined;
    } catch {
      /* Browser/device heuristic remains available if native input is unavailable. */
    }
  }
  return (sender, epochMs) => {
    if (
      !native ||
      typeof epochMs !== "number" ||
      !Number.isFinite(epochMs) ||
      Math.abs(Date.now() - epochMs) > 2000
    )
      return null;
    const window = windows.fromWebContents(sender);
    if (!window || window.isDestroyed()) return null;
    return native.source(epochMs, window.getNativeWindowHandle());
  };
}
module.exports = { createScrollSource };

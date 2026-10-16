const {
  app,
  BrowserWindow,
  Menu,
  protocol,
  session,
  screen,
  ipcMain,
  safeStorage,
  dialog,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { createAssetHandler, devURL } = require("./assets.cjs");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);
app.setName("Shenzhen 3D");
// Retain existing local preferences and recent-file names after the display-name change.
// Explicit test/profile overrides are always respected.
if (!process.argv.some((argument) => argument.startsWith("--user-data-dir"))) {
  const previousProfile = path.join(
    app.getPath("appData"),
    "Shenzhen 3D Performance",
  );
  if (!fs.existsSync(app.getPath("userData")) && fs.existsSync(previousProfile))
    app.setPath("userData", previousProfile);
}
const development = devURL(process.env.SHENZHEN_3D_DEV_URL, app.isPackaged);
const entry = development ?? "app://local/";
const allowedOrigin = development ? new URL(development).origin : "app://local";
function trusted(url) {
  try {
    const parsed = new URL(url);
    return development
      ? parsed.origin === allowedOrigin
      : parsed.protocol === "app:" &&
          parsed.hostname === "local" &&
          !parsed.port &&
          !parsed.username &&
          !parsed.password;
  } catch {
    return false;
  }
}
function command(selector) {
  const window =
    BrowserWindow.getFocusedWindow() ??
    BrowserWindow.getAllWindows().find((candidate) => candidate.isVisible());
  if (window && trusted(window.webContents.getURL()))
    void window.webContents.executeJavaScript(
      `document.querySelector(${JSON.stringify(selector)})?.click()`,
      true,
    );
}
let updateManager;
let updateTimer;
function updates() {
  if (!updateManager) {
    const { createUpdateManager } = require("./update-manager.cjs");
    const { resolveReleaseOwner } = require("./release-channel.cjs");
    let releaseOwner;
    try {
      releaseOwner = resolveReleaseOwner(
        app.isPackaged
          ? require(path.join(app.getAppPath(), "package.json"))
          : {},
        app.isPackaged,
      );
    } catch {
      releaseOwner = null;
    }
    updateManager = createUpdateManager({
      app,
      safeStorage,
      dialog,
      releaseOwner,
      onState: (state) => {
        for (const window of BrowserWindow.getAllWindows()) {
          if (!window.isDestroyed() && trusted(window.webContents.getURL()))
            window.webContents.send("shenzhen-update-state", state);
        }
      },
    });
  }
  return updateManager;
}
const updateMethods = new Set([
  "getState",
  "check",
  "download",
  "install",
  "configure",
  "connect",
  "disconnect",
  "useGitHubCLI",
]);
ipcMain.handle("shenzhen-updates", (event, method, value) => {
  if (
    event.senderFrame !== event.sender.mainFrame ||
    !trusted(event.senderFrame?.url) ||
    !updateMethods.has(method)
  )
    throw new Error("Update request is not allowed");
  if (
    method === "connect" &&
    (typeof value !== "string" || value.length > 4096)
  )
    throw new Error("Invalid access token");
  if (
    method === "configure" &&
    (!value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).some(
        (key) => !["automatic", "repository", "prereleases"].includes(key),
      ))
  )
    throw new Error("Invalid update preferences");
  return updates()[method](value);
});
function createWindow(url = entry) {
  let bounds = { width: 1440, height: 960 };
  const stateFile = path.join(app.getPath("userData"), "window-state.json");
  try {
    const stored = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    if (
      ["x", "y", "width", "height"].every((key) =>
        Number.isFinite(stored[key]),
      ) &&
      stored.width >= 600 &&
      stored.height >= 560 &&
      stored.width <= 10000 &&
      stored.height <= 10000 &&
      screen
        .getAllDisplays()
        .some(
          ({ bounds: display }) =>
            stored.x < display.x + display.width &&
            stored.x + stored.width > display.x &&
            stored.y < display.y + display.height &&
            stored.y + stored.height > display.y,
        )
    )
      bounds = stored;
  } catch {
    /* First launch uses the default centered window. */
  }
  const window = new BrowserWindow({
    ...bounds,
    minWidth: 600,
    minHeight: 560,
    backgroundColor: "#182126",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!trusted(url)) event.preventDefault();
  });
  window.webContents.on("will-redirect", (event, url) => {
    if (!trusted(url)) event.preventDefault();
  });
  window.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  window.once("ready-to-show", () => {
    window.show();
    if (!updateTimer && app.isPackaged && process.platform === "darwin") {
      // No updater code, credentials or network on the first-paint path.
      updateTimer = setTimeout(() => updates().schedule(), 20_000);
      updateTimer.unref();
    }
  });
  window.on("close", () => {
    try {
      fs.writeFileSync(stateFile, JSON.stringify(window.getNormalBounds()));
    } catch {
      /* Window persistence is optional. */
    }
  });
  void window.loadURL(url);
  return window;
}

app.whenReady().then(() => {
  app.setAboutPanelOptions({
    applicationName: app.name,
    copyright: "© 2026 INTUITION Robotique & Technologies",
  });
  protocol.handle(
    "app",
    createAssetHandler(
      app.isPackaged
        ? path.join(app.getAppPath(), "dist")
        : path.resolve(__dirname, "../dist"),
    ),
  );
  const mayWriteClipboard = (contents, permission) =>
    permission === "clipboard-sanitized-write" &&
    contents &&
    trusted(contents.getURL());
  session.defaultSession.setPermissionRequestHandler(
    (contents, permission, callback) =>
      callback(Boolean(mayWriteClipboard(contents, permission))),
  );
  session.defaultSession.setPermissionCheckHandler((contents, permission) =>
    Boolean(mayWriteClipboard(contents, permission)),
  );
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const hotReload =
      development &&
      details.url.startsWith(`ws://${new URL(development).host}/`);
    const allowed =
      trusted(details.url) ||
      hotReload ||
      details.url.startsWith(`blob:${allowedOrigin}/`) ||
      details.url.startsWith("data:");
    callback({ cancel: !allowed });
  });
  session.defaultSession.on("will-download", (_event, item, contents) => {
    // Chromium owns the download request while its native Save dialog is open,
    // including after the frontend revokes its short-lived object URL.
    if (
      !trusted(contents.getURL()) ||
      !item.getURL().startsWith(`blob:${allowedOrigin}/`)
    ) {
      item.cancel();
      return;
    }
    const filename = path.basename(item.getFilename());
    item.setSaveDialogOptions({
      title: "Save exported file",
      defaultPath: path.join(app.getPath("downloads"), filename),
      showsTagField: true,
    });
  });
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [
          { role: "about" },
          {
            label: "Check for Updates…",
            click: () => command("[data-open-updates]"),
          },
          {
            label: "Settings…",
            accelerator: "CmdOrCtrl+,",
            click: () => command('[aria-label="Settings"]'),
          },
          { type: "separator" },
          { role: "services" },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      {
        label: "File",
        submenu: [
          {
            label: "New Window",
            accelerator: "CmdOrCtrl+N",
            click: () => createWindow(),
          },
          {
            label: "Open…",
            accelerator: "CmdOrCtrl+O",
            click: () => command('input[type="file"]'),
          },
          { type: "separator" },
          { role: "close" },
        ],
      },
      { role: "editMenu" },
      {
        label: "View",
        submenu: [
          { role: "reload" },
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { type: "separator" },
          { role: "togglefullscreen" },
          ...(!app.isPackaged ? [{ role: "toggleDevTools" }] : []),
        ],
      },
      { role: "windowMenu" },
      {
        role: "help",
        submenu: [
          {
            label: "Third-Party Notices",
            accelerator: "CmdOrCtrl+Shift+L",
            click: () => createWindow("app://local/THIRD_PARTY.txt"),
          },
        ],
      },
    ]),
  );
  createWindow();
  app.on("activate", () => {
    if (!BrowserWindow.getAllWindows().length) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("will-quit", () => {
  clearTimeout(updateTimer);
  updateManager?.dispose();
});

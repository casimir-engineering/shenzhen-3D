const { app, BrowserWindow, Menu, protocol, session, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { createAssetHandler, devURL } = require('./assets.cjs');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
app.setName('Shenzhen 3D Performance');
const development = devURL(process.env.SHENZHEN_3D_DEV_URL, app.isPackaged);
const entry = development ?? 'app://local/';
const allowedOrigin = development ? new URL(development).origin : 'app://local';
function trusted(url) {
  try {
    const parsed = new URL(url);
    return development ? parsed.origin === allowedOrigin : parsed.protocol === 'app:' && parsed.hostname === 'local' && !parsed.port && !parsed.username && !parsed.password;
  } catch { return false; }
}
function command(selector) {
  const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows().find(candidate => candidate.isVisible());
  if (window && trusted(window.webContents.getURL())) void window.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(selector)})?.click()`, true);
}
function createWindow(url = entry) {
  let bounds = { width: 1440, height: 960 };
  const stateFile = path.join(app.getPath('userData'), 'window-state.json');
  try {
    const stored = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (['x', 'y', 'width', 'height'].every(key => Number.isFinite(stored[key])) && stored.width >= 600 && stored.height >= 560 && stored.width <= 10000 && stored.height <= 10000 && screen.getAllDisplays().some(({ bounds: display }) => stored.x < display.x + display.width && stored.x + stored.width > display.x && stored.y < display.y + display.height && stored.y + stored.height > display.y)) bounds = stored;
  } catch { /* First launch uses the default centered window. */ }
  const window = new BrowserWindow({ ...bounds, minWidth: 600, minHeight: 560, backgroundColor: '#182126', show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, allowRunningInsecureContent: false, backgroundThrottling: false, spellcheck: false } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (!trusted(url)) event.preventDefault(); });
  window.webContents.on('will-redirect', (event, url) => { if (!trusted(url)) event.preventDefault(); });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.once('ready-to-show', () => window.show());
  window.on('close', () => { try { fs.writeFileSync(stateFile, JSON.stringify(window.getNormalBounds())); } catch { /* Window persistence is optional. */ } });
  void window.loadURL(url);
  return window;
}

app.whenReady().then(() => {
  app.setAboutPanelOptions({ applicationName: app.name, copyright: '© 2026 INTUITION Robotique & Technologies' });
  protocol.handle('app', createAssetHandler(app.isPackaged ? path.join(app.getAppPath(), 'dist') : path.resolve(__dirname, '../dist')));
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const hotReload = development && details.url.startsWith(`ws://${new URL(development).host}/`);
    const allowed = trusted(details.url) || hotReload || details.url.startsWith(`blob:${allowedOrigin}/`) || details.url.startsWith('data:');
    callback({ cancel: !allowed });
  });
  session.defaultSession.on('will-download', (_event, item, contents) => {
    // Chromium owns the download request while its native Save dialog is open,
    // including after the frontend revokes its short-lived object URL.
    if (!trusted(contents.getURL()) || !item.getURL().startsWith(`blob:${allowedOrigin}/`)) { item.cancel(); return; }
    const filename = path.basename(item.getFilename());
    item.setSaveDialogOptions({ title: 'Save exported file', defaultPath: path.join(app.getPath('downloads'), filename), showsTagField: true });
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: app.name, submenu: [{ role: 'about' }, { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => command('[aria-label="Settings"]') }, { type: 'separator' }, { role: 'services' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] },
    { label: 'File', submenu: [{ label: 'New Window', accelerator: 'CmdOrCtrl+N', click: () => createWindow() }, { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => command('input[type="file"]') }, { type: 'separator' }, { role: 'close' }] },
    { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }, ...(!app.isPackaged ? [{ role: 'toggleDevTools' }] : [])] },
    { role: 'windowMenu' },
    { role: 'help', submenu: [{ label: 'Third-Party Notices', accelerator: 'CmdOrCtrl+Shift+L', click: () => createWindow('app://local/THIRD_PARTY.txt') }] },
  ]));
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

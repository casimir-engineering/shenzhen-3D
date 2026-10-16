const { contextBridge, ipcRenderer, webUtils } = require("electron");
contextBridge.exposeInMainWorld("shenzhenFiles", {
  takeOpen: () => ipcRenderer.invoke("shenzhen-open-files"),
  subscribeOpen: (listener) => {
    const handler = () => listener();
    ipcRenderer.on("shenzhen-open-files-available", handler);
    return () =>
      ipcRenderer.removeListener("shenzhen-open-files-available", handler);
  },
});
contextBridge.exposeInMainWorld("shenzhenRecentFiles", {
  list: () => ipcRenderer.invoke("shenzhen-recent-files", "list"),
  remember: (files, name, format) => {
    // Paths come exclusively from native File objects selected/dropped by the user.
    const paths = files.map((file) => webUtils.getPathForFile(file));
    if (paths.some((file) => !file)) return Promise.resolve(null);
    return ipcRenderer.invoke("shenzhen-recent-files", "remember", {
      paths,
      name,
      format,
    });
  },
  open: (id) => ipcRenderer.invoke("shenzhen-recent-files", "open", id),
  touch: (id) => ipcRenderer.invoke("shenzhen-recent-files", "touch", id),
  remove: (id) => ipcRenderer.invoke("shenzhen-recent-files", "remove", id),
});
const invoke = (method, value) =>
  ipcRenderer.invoke("shenzhen-updates", method, value);
contextBridge.exposeInMainWorld("shenzhenUpdates", {
  getState: () => invoke("getState"),
  check: () => invoke("check"),
  download: () => invoke("download"),
  install: () => invoke("install"),
  configure: (value) => invoke("configure", value),
  connect: (token) => invoke("connect", token),
  disconnect: () => invoke("disconnect"),
  useGitHubCLI: () => invoke("useGitHubCLI"),
  subscribe: (listener) => {
    const handler = (_event, state) => listener(state);
    ipcRenderer.on("shenzhen-update-state", handler);
    return () => ipcRenderer.removeListener("shenzhen-update-state", handler);
  },
});

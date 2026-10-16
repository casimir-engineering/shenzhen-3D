const { contextBridge, ipcRenderer } = require("electron");
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

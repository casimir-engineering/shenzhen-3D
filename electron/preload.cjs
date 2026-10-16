const { contextBridge, ipcRenderer, webUtils } = require("electron");
const rotationListeners = new Set();
ipcRenderer.on("shenzhen-rotate", (_event, value) => {
  if (
    !value ||
    ![value.degrees, value.clientX, value.clientY, value.epochMs].every(
      Number.isFinite,
    ) ||
    value.degrees === 0 ||
    Math.abs(value.degrees) > 180 ||
    value.clientX < 0 ||
    value.clientY < 0 ||
    value.clientX > 1000000 ||
    value.clientY > 1000000
  )
    return;
  for (const listener of rotationListeners) {
    try {
      listener({
        degrees: value.degrees,
        clientX: value.clientX,
        clientY: value.clientY,
        epochMs: value.epochMs,
      });
    } catch {
      /* Isolate consumer errors from the native input subscription. */
    }
  }
});
contextBridge.exposeInMainWorld("shenzhenScroll", {
  source: (epochMs) =>
    typeof epochMs === "number" && Number.isFinite(epochMs)
      ? ipcRenderer.sendSync("shenzhen-scroll-source", epochMs)
      : null,
  subscribeRotate: (listener) => {
    if (typeof listener !== "function") return () => {};
    const callback = (value) => listener(value);
    rotationListeners.add(callback);
    if (rotationListeners.size === 1)
      ipcRenderer.send("shenzhen-rotate-subscribe", true);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      rotationListeners.delete(callback);
      if (!rotationListeners.size)
        ipcRenderer.send("shenzhen-rotate-subscribe", false);
    };
  },
});
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

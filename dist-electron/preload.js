import { contextBridge as r, ipcRenderer as n } from "electron";
r.exposeInMainWorld("electronAPI", {
  readFile: () => n.invoke("read-file"),
  readFileContent: (e) => n.invoke("read-file-content", e),
  saveFile: (e) => n.invoke("save-file", e),
  safeStorage: {
    isAvailable: () => n.invoke("safe-storage-available"),
    encrypt: (e) => n.invoke("safe-storage-encrypt", e),
    decrypt: (e) => n.invoke("safe-storage-decrypt", e)
  },
  onMainMessage: (e) => {
    const i = (a, ...o) => e(...o);
    return n.on("main-process-message", i), () => n.removeListener("main-process-message", i);
  },
  getAppVersion: () => n.invoke("get-app-version")
});

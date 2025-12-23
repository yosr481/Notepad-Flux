import { contextBridge as i, ipcRenderer as n } from "electron";
i.exposeInMainWorld("electronAPI", {
  readFile: () => n.invoke("read-file"),
  readFileContent: (e) => n.invoke("read-file-content", e),
  saveFile: (e) => n.invoke("save-file", e),
  safeStorage: {
    isAvailable: () => n.invoke("safe-storage-available"),
    encrypt: (e) => n.invoke("safe-storage-encrypt", e),
    decrypt: (e) => n.invoke("safe-storage-decrypt", e)
  },
  onMainMessage: (e) => {
    const a = (o, ...r) => e(...r);
    return n.on("main-process-message", a), () => n.removeListener("main-process-message", a);
  }
});

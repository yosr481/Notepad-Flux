import { contextBridge as i, ipcRenderer as r } from "electron";
i.exposeInMainWorld("ipcRenderer", {
  on(...n) {
    const [e, o] = n;
    return r.on(e, (t, ...c) => o(t, ...c));
  },
  off(...n) {
    const [e, ...o] = n;
    return r.off(e, ...o);
  },
  send(...n) {
    const [e, ...o] = n;
    return r.send(e, ...o);
  },
  invoke(...n) {
    const [e, ...o] = n;
    return r.invoke(e, ...o);
  }
  // You can expose other weird stuff too
});

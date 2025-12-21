import { app as i, BrowserWindow as w, ipcMain as y, Menu as b, safeStorage as l, dialog as h } from "electron";
import { dirname as I, resolve as d, join as t, isAbsolute as S, sep as _ } from "node:path";
import { fileURLToPath as T } from "node:url";
import { readFile as m, writeFile as D } from "node:fs/promises";
import { homedir as L } from "node:os";
import { platform as R } from "node:process";
const C = T(import.meta.url), u = I(C), p = /* @__PURE__ */ new Set(), V = () => {
  const r = L();
  return R === "win32" ? t(r, "AppData", "LocalLow", "Notepad Flux") : t(r, ".config", "notepad-flux");
}, v = V();
i.setPath("userData", v);
p.add(d(v));
const g = (r) => {
  if (!r || typeof r != "string") return !1;
  const e = d(r);
  if (!S(e) || r.includes("..")) return !1;
  for (const n of p)
    if (e === n || e.startsWith(n + _))
      return !0;
  return !1;
}, a = (r, e) => {
  y.handle(r, async (n, ...s) => {
    try {
      return await e(n, ...s);
    } catch (f) {
      throw console.error(`Error in IPC handler for ${r}:`, f), new Error("An internal system error occurred. Please try again.");
    }
  });
};
a("safe-storage-encrypt", async (r, e) => {
  if (!l.isEncryptionAvailable())
    throw new Error("Safe storage is not available.");
  return l.encryptString(e).toString("base64");
});
a("safe-storage-decrypt", async (r, e) => {
  if (!l.isEncryptionAvailable())
    throw new Error("Safe storage is not available.");
  const n = Buffer.from(e, "base64");
  return l.decryptString(n);
});
a("safe-storage-available", async () => l.isEncryptionAvailable());
a("read-file", async () => {
  const { canceled: r, filePaths: e } = await h.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Markdown", extensions: ["md", "markdown"] }]
  });
  if (r) return { canceled: r };
  const n = e[0];
  p.add(d(n));
  const s = await m(n, "utf-8");
  return { canceled: r, filePath: n, content: s };
});
a("read-file-content", async (r, e) => {
  if (!g(e))
    throw new Error("Access denied: Unauthorized file path.");
  return await m(e, "utf-8");
});
a("save-file", async (r, { filePath: e, content: n }) => {
  if (e) {
    if (!g(e))
      throw new Error("Access denied: Unauthorized file path.");
  } else {
    const { canceled: s, filePath: f } = await h.showSaveDialog({
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }]
    });
    if (s) return { canceled: !0 };
    e = f, p.add(d(e));
  }
  return await D(e, n, "utf-8"), { filePath: e };
});
process.env.DIST_ELECTRON = t(u, "../dist-electron");
process.env.DIST = t(u, "../dist");
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL ? t(u, "../public") : process.env.DIST;
let o = null, c = null;
function E() {
  o = new w({
    width: 1200,
    height: 800,
    minWidth: 400,
    minHeight: 300,
    show: !1,
    // Wait until ready-to-show
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#00000000",
      // Transparent background
      symbolColor: "#64748b",
      // Slate-500 matches UI usually, or use theme color
      height: 40
      // Match tab height
    },
    backgroundMaterial: "mica",
    icon: t(process.env.VITE_PUBLIC, "icons/desktop/icon.png"),
    webPreferences: {
      preload: t(process.env.DIST_ELECTRON, "preload.js"),
      nodeIntegration: !1,
      contextIsolation: !0,
      sandbox: !0
    }
  }), o.webContents.setWindowOpenHandler(({ url: r }) => ({
    action: "allow",
    overrideBrowserWindowOptions: {
      titleBarStyle: "hidden",
      titleBarOverlay: {
        color: "#00000000",
        symbolColor: "#64748b",
        height: 40
      },
      backgroundMaterial: "mica",
      icon: t(process.env.VITE_PUBLIC, "icons/desktop/icon.png"),
      webPreferences: {
        preload: t(process.env.DIST_ELECTRON, "preload.js"),
        sandbox: !0
      }
    }
  })), o.once("ready-to-show", () => {
    o.show(), c && c.close();
  }), b.setApplicationMenu(null), o.webContents.on("did-finish-load", () => {
    o?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), process.env.VITE_DEV_SERVER_URL ? o.loadURL(process.env.VITE_DEV_SERVER_URL) : o.loadFile(t(process.env.DIST, "index.html"));
}
i.on("window-all-closed", () => {
  o = null, process.platform !== "darwin" && i.quit();
});
i.on("activate", () => {
  w.getAllWindows().length === 0 && E();
});
i.whenReady().then(() => {
  c = new w({
    width: 300,
    height: 300,
    transparent: !0,
    frame: !1,
    alwaysOnTop: !0,
    icon: t(process.env.VITE_PUBLIC, "icons/desktop/icon.png")
  }), c.loadFile(t(process.env.VITE_PUBLIC, "loading.html")), E();
});

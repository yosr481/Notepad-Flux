import { app as a, ipcMain as s, dialog as d, BrowserWindow as l, Menu as f } from "electron";
import { dirname as u, join as e } from "node:path";
import { fileURLToPath as v } from "node:url";
import { readFile as p, writeFile as E } from "node:fs/promises";
import { homedir as g } from "node:os";
import { platform as I } from "node:process";
const _ = v(import.meta.url), c = u(_), T = () => {
  const n = g();
  return I === "win32" ? e(n, "AppData", "LocalLow", "Notepad Flux") : e(n, ".config", "notepad-flux");
};
a.setPath("userData", T());
s.handle("read-file", async () => {
  const { canceled: n, filePaths: o } = await d.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Markdown", extensions: ["md", "markdown"] }]
  });
  if (n) return { canceled: n };
  const r = await p(o[0], "utf-8");
  return { canceled: n, filePath: o[0], content: r };
});
s.handle("read-file-content", async (n, o) => {
  try {
    return await p(o, "utf-8");
  } catch (r) {
    throw r;
  }
});
s.handle("save-file", async (n, { filePath: o, content: r }) => {
  if (!o) {
    const { canceled: m, filePath: h } = await d.showSaveDialog({
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }]
    });
    if (m) return { canceled: !0 };
    o = h;
  }
  return await E(o, r, "utf-8"), { filePath: o };
});
process.env.DIST_ELECTRON = e(c, "../dist-electron");
process.env.DIST = e(c, "../dist");
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL ? e(c, "../public") : process.env.DIST;
let t = null, i = null;
function w() {
  t = new l({
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
    icon: e(process.env.VITE_PUBLIC, "icons/desktop/icon.png"),
    webPreferences: {
      preload: e(process.env.DIST_ELECTRON, "preload.js"),
      nodeIntegration: !1,
      contextIsolation: !0,
      sandbox: !0
    }
  }), t.webContents.setWindowOpenHandler(({ url: n }) => ({
    action: "allow",
    overrideBrowserWindowOptions: {
      titleBarStyle: "hidden",
      titleBarOverlay: {
        color: "#00000000",
        symbolColor: "#64748b",
        height: 40
      },
      backgroundMaterial: "mica",
      icon: e(process.env.VITE_PUBLIC, "icons/desktop/icon.png"),
      webPreferences: {
        preload: e(process.env.DIST_ELECTRON, "preload.js"),
        sandbox: !0
      }
    }
  })), t.once("ready-to-show", () => {
    t.show(), i && i.close();
  }), f.setApplicationMenu(null), t.webContents.on("did-finish-load", () => {
    t?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), process.env.VITE_DEV_SERVER_URL ? t.loadURL(process.env.VITE_DEV_SERVER_URL) : t.loadFile(e(process.env.DIST, "index.html"));
}
a.on("window-all-closed", () => {
  t = null, process.platform !== "darwin" && a.quit();
});
a.on("activate", () => {
  l.getAllWindows().length === 0 && w();
});
a.whenReady().then(() => {
  i = new l({
    width: 300,
    height: 300,
    transparent: !0,
    frame: !1,
    alwaysOnTop: !0,
    icon: e(process.env.VITE_PUBLIC, "icons/desktop/icon.png")
  }), i.loadFile(e(process.env.VITE_PUBLIC, "loading.html")), w();
});

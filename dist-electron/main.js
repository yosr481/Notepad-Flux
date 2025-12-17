import { ipcMain as r, dialog as d, app as s, BrowserWindow as l, Menu as f } from "electron";
import { dirname as u, join as o } from "node:path";
import { fileURLToPath as E } from "node:url";
import { readFile as p, writeFile as v } from "node:fs/promises";
r.handle("read-file", async () => {
  const { canceled: i, filePaths: e } = await d.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Markdown", extensions: ["md", "markdown"] }]
  });
  if (i) return { canceled: i };
  const t = await p(e[0], "utf-8");
  return { canceled: i, filePath: e[0], content: t };
});
r.handle("read-file-content", async (i, e) => {
  try {
    return await p(e, "utf-8");
  } catch (t) {
    throw t;
  }
});
r.handle("save-file", async (i, { filePath: e, content: t }) => {
  if (!e) {
    const { canceled: h, filePath: m } = await d.showSaveDialog({
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }]
    });
    if (h) return { canceled: !0 };
    e = m;
  }
  return await v(e, t, "utf-8"), { filePath: e };
});
const _ = E(import.meta.url), c = u(_);
process.env.DIST_ELECTRON = o(c, "../dist-electron");
process.env.DIST = o(c, "../dist");
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL ? o(c, "../public") : process.env.DIST;
let n = null, a = null;
function w() {
  n = new l({
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
    icon: o(process.env.VITE_PUBLIC, "icons/desktop/icon.png"),
    webPreferences: {
      preload: o(process.env.DIST_ELECTRON, "preload.js")
    }
  }), n.once("ready-to-show", () => {
    n.show(), a && a.close();
  }), f.setApplicationMenu(null), n.webContents.on("did-finish-load", () => {
    n?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), process.env.VITE_DEV_SERVER_URL ? n.loadURL(process.env.VITE_DEV_SERVER_URL) : n.loadFile(o(process.env.DIST, "index.html"));
}
s.on("window-all-closed", () => {
  n = null, process.platform !== "darwin" && s.quit();
});
s.on("activate", () => {
  l.getAllWindows().length === 0 && w();
});
s.whenReady().then(() => {
  a = new l({
    width: 300,
    height: 300,
    transparent: !0,
    frame: !1,
    alwaysOnTop: !0,
    icon: o(process.env.VITE_PUBLIC, "icons/desktop/icon.png")
  }), a.loadFile(o(process.env.VITE_PUBLIC, "loading.html")), w();
});

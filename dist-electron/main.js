import { ipcMain, dialog, app, BrowserWindow, Menu } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile } from "node:fs/promises";
ipcMain.handle("read-file", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Markdown", extensions: ["md", "markdown"] }]
  });
  if (canceled) return { canceled };
  const content = await readFile(filePaths[0], "utf-8");
  return { canceled, filePath: filePaths[0], content };
});
ipcMain.handle("read-file-content", async (event, filePath) => {
  try {
    const content = await readFile(filePath, "utf-8");
    return content;
  } catch (e) {
    throw e;
  }
});
ipcMain.handle("save-file", async (event, { filePath, content }) => {
  if (!filePath) {
    const { canceled, filePath: savePath } = await dialog.showSaveDialog({
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }]
    });
    if (canceled) return { canceled: true };
    filePath = savePath;
  }
  await writeFile(filePath, content, "utf-8");
  return { filePath };
});
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = dirname(__filename$1);
process.env.DIST_ELECTRON = join(__dirname$1, "../dist-electron");
process.env.DIST = join(__dirname$1, "../dist");
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL ? join(__dirname$1, "../public") : process.env.DIST;
let win = null;
function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: join(process.env.DIST_ELECTRON, "preload.js")
    }
  });
  Menu.setApplicationMenu(null);
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(join(process.env.DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  win = null;
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.whenReady().then(createWindow);

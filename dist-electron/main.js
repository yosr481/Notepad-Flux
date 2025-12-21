import { app, BrowserWindow, ipcMain, Menu, safeStorage, dialog } from "electron";
import { dirname, resolve, join, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { platform } from "node:process";
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = dirname(__filename$1);
const allowedPaths = /* @__PURE__ */ new Set();
const getPersistentDataPath = () => {
  const home = homedir();
  if (platform === "win32") {
    return join(home, "AppData", "LocalLow", "Notepad Flux");
  } else {
    return join(home, ".config", "notepad-flux");
  }
};
const userDataPath = getPersistentDataPath();
app.setPath("userData", userDataPath);
allowedPaths.add(resolve(userDataPath));
const isPathSafe = (filePath) => {
  if (!filePath || typeof filePath !== "string") return false;
  const resolvedPath = resolve(filePath);
  if (!isAbsolute(resolvedPath) || filePath.includes("..")) return false;
  for (const allowed of allowedPaths) {
    if (resolvedPath === allowed || resolvedPath.startsWith(allowed + sep)) {
      return true;
    }
  }
  return false;
};
const safeHandle = (channel, handler) => {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...args);
    } catch (error) {
      console.error(`Error in IPC handler for ${channel}:`, error);
      throw new Error("An internal system error occurred. Please try again.");
    }
  });
};
safeHandle("safe-storage-encrypt", async (event, plainText) => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Safe storage is not available.");
  }
  const buffer = safeStorage.encryptString(plainText);
  return buffer.toString("base64");
});
safeHandle("safe-storage-decrypt", async (event, encryptedBase64) => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Safe storage is not available.");
  }
  const buffer = Buffer.from(encryptedBase64, "base64");
  return safeStorage.decryptString(buffer);
});
safeHandle("safe-storage-available", async () => {
  return safeStorage.isEncryptionAvailable();
});
safeHandle("read-file", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Markdown", extensions: ["md", "markdown"] }]
  });
  if (canceled) return { canceled };
  const filePath = filePaths[0];
  allowedPaths.add(resolve(filePath));
  const content = await readFile(filePath, "utf-8");
  return { canceled, filePath, content };
});
safeHandle("read-file-content", async (event, filePath) => {
  if (!isPathSafe(filePath)) {
    throw new Error("Access denied: Unauthorized file path.");
  }
  return await readFile(filePath, "utf-8");
});
safeHandle("save-file", async (event, { filePath, content }) => {
  if (!filePath) {
    const { canceled, filePath: savePath } = await dialog.showSaveDialog({
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }]
    });
    if (canceled) return { canceled: true };
    filePath = savePath;
    allowedPaths.add(resolve(filePath));
  } else if (!isPathSafe(filePath)) {
    throw new Error("Access denied: Unauthorized file path.");
  }
  await writeFile(filePath, content, "utf-8");
  return { filePath };
});
process.env.DIST_ELECTRON = join(__dirname$1, "../dist-electron");
process.env.DIST = join(__dirname$1, "../dist");
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL ? join(__dirname$1, "../public") : process.env.DIST;
let win = null;
let splash = null;
function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 400,
    minHeight: 300,
    show: false,
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
    icon: join(process.env.VITE_PUBLIC, "icons/desktop/icon.png"),
    webPreferences: {
      preload: join(process.env.DIST_ELECTRON, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    return {
      action: "allow",
      overrideBrowserWindowOptions: {
        titleBarStyle: "hidden",
        titleBarOverlay: {
          color: "#00000000",
          symbolColor: "#64748b",
          height: 40
        },
        backgroundMaterial: "mica",
        icon: join(process.env.VITE_PUBLIC, "icons/desktop/icon.png"),
        webPreferences: {
          preload: join(process.env.DIST_ELECTRON, "preload.js"),
          sandbox: true
        }
      }
    };
  });
  win.once("ready-to-show", () => {
    win.show();
    if (splash) {
      splash.close();
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
app.whenReady().then(() => {
  splash = new BrowserWindow({
    width: 300,
    height: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    icon: join(process.env.VITE_PUBLIC, "icons/desktop/icon.png")
  });
  splash.loadFile(join(process.env.VITE_PUBLIC, "loading.html"));
  createWindow();
});

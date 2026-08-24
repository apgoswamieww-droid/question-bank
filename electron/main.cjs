const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

const isDev = !app.isPackaged;
let mainWindow = null;
let isQuitting = false;

function getRecentFilesPath() {
  return path.join(app.getPath("userData"), "recent-files.json");
}

function loadRecentFiles() {
  try {
    const filePath = getRecentFilesPath();
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Failed to load recent files:", err);
  }
  return [];
}

function saveRecentFilesList(files) {
  try {
    const filePath = getRecentFilesPath();
    fs.writeFileSync(filePath, JSON.stringify(files.slice(0, 10), null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save recent files:", err);
  }
}

function addRecentFileToStore(filePath) {
  if (!filePath || typeof filePath !== "string") return [];
  let files = loadRecentFiles();
  files = files.filter((item) => item.path !== filePath && item !== filePath);
  const name = path.basename(filePath);
  files.unshift({ path: filePath, name, updatedAt: new Date().toISOString() });
  saveRecentFilesList(files);
  return files;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: "Question Bank — Desktop Editor",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.webContents.send("app:closeRequested");
    }
  });
}

// IPC Handlers
ipcMain.handle("dialog:openFile", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Open Question Bank Document",
    filters: [{ name: "Question Bank Document", extensions: ["qbank"] }],
    properties: ["openFile"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const selectedPath = result.filePaths[0];
  try {
    const content = await fs.promises.readFile(selectedPath, "utf-8");
    addRecentFileToStore(selectedPath);
    return { filePath: selectedPath, content };
  } catch (error) {
    console.error("Error reading file:", error);
    throw new Error(`Failed to read file: ${error.message}`);
  }
});

ipcMain.handle("dialog:saveFile", async (_event, defaultTitle) => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Save Question Bank Document",
    defaultPath: defaultTitle ? `${defaultTitle}.qbank` : "Untitled Question Paper.qbank",
    filters: [{ name: "Question Bank Document", extensions: ["qbank"] }],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  let savePath = result.filePath;
  if (!savePath.endsWith(".qbank")) {
    savePath += ".qbank";
  }

  return savePath;
});

ipcMain.handle("file:read", async (_event, filePath) => {
  if (!filePath) throw new Error("File path is required.");
  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    addRecentFileToStore(filePath);
    return { filePath, content };
  } catch (error) {
    console.error("Error reading file:", error);
    throw new Error(`Failed to read file: ${error.message}`);
  }
});

ipcMain.handle("file:write", async (_event, { filePath, content }) => {
  if (!filePath || !content) throw new Error("File path and content are required.");

  let targetPath = filePath;
  if (!targetPath.endsWith(".qbank")) {
    targetPath += ".qbank";
  }

  const tempPath = `${targetPath}.tmp`;
  try {
    await fs.promises.writeFile(tempPath, content, "utf-8");
    await fs.promises.rename(tempPath, targetPath);
    addRecentFileToStore(targetPath);
    return { success: true, filePath: targetPath };
  } catch (error) {
    console.error("Error saving file atomically:", error);
    try {
      await fs.promises.writeFile(targetPath, content, "utf-8");
      addRecentFileToStore(targetPath);
      return { success: true, filePath: targetPath };
    } catch (fallbackError) {
      console.error("Error saving file directly:", fallbackError);
      throw new Error(`Failed to save file: ${fallbackError.message}`);
    }
  }
});

ipcMain.handle("recent:get", async () => {
  return loadRecentFiles();
});

ipcMain.handle("recent:add", async (_event, filePath) => {
  return addRecentFileToStore(filePath);
});

ipcMain.handle("dialog:confirmClose", async (_event, isDirty) => {
  if (!mainWindow) return "dontsave";

  if (!isDirty) {
    isQuitting = true;
    mainWindow.close();
    return "dontsave";
  }

  const result = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    buttons: ["Save", "Don't Save", "Cancel"],
    defaultId: 0,
    cancelId: 2,
    title: "Unsaved Changes",
    message: "Do you want to save the changes you made to this document?",
    detail: "Your changes will be lost if you don't save them.",
  });

  if (result.response === 0) {
    return "save";
  } else if (result.response === 1) {
    isQuitting = true;
    mainWindow.close();
    return "dontsave";
  } else {
    return "cancel";
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
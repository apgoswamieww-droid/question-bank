const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openFileDialog: () => ipcRenderer.invoke("dialog:openFile"),
  saveFileDialog: (defaultTitle) => ipcRenderer.invoke("dialog:saveFile", defaultTitle),
  readFile: (filePath) => ipcRenderer.invoke("file:read", filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke("file:write", { filePath, content }),
  getRecentFiles: () => ipcRenderer.invoke("recent:get"),
  addRecentFile: (filePath) => ipcRenderer.invoke("recent:add", filePath),
  confirmClose: (isDirty) => ipcRenderer.invoke("dialog:confirmClose", isDirty),
  exportPdf: (htmlContent, defaultTitle) => ipcRenderer.invoke("pdf:export", { htmlContent, defaultTitle }),
  printDocument: (htmlContent) => ipcRenderer.invoke("document:print", htmlContent),
  onCloseRequested: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("app:closeRequested", handler);
    return () => ipcRenderer.removeListener("app:closeRequested", handler);
  },
  onMenuAction: (callback) => {
    const handler = (_event, action) => callback(action);
    ipcRenderer.on("app:menuAction", handler);
    return () => ipcRenderer.removeListener("app:menuAction", handler);
  },

  // KAP AI Analyzer API - API key NEVER exposed to renderer
  analyzer: {
    getStatus: () => ipcRenderer.invoke("analyzer:getStatus"),
    testConnection: () => ipcRenderer.invoke("analyzer:testConnection"),
    analyzeGlyph: (params) => ipcRenderer.invoke("analyzer:analyzeGlyph", params),
    analyzeSequence: (params) => ipcRenderer.invoke("analyzer:analyzeSequence", params),
    getGlyphDataset: (params) => ipcRenderer.invoke("analyzer:getGlyphDataset", params),
    exportVerified: (params) => ipcRenderer.invoke("analyzer:exportVerified", params),
    saveState: (params) => ipcRenderer.invoke("analyzer:saveState", params),
    loadState: (params) => ipcRenderer.invoke("analyzer:loadState", params),
  },
});

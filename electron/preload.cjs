const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openFileDialog: () => ipcRenderer.invoke("dialog:openFile"),
  saveFileDialog: (defaultTitle) => ipcRenderer.invoke("dialog:saveFile", defaultTitle),
  readFile: (filePath) => ipcRenderer.invoke("file:read", filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke("file:write", { filePath, content }),
  getRecentFiles: () => ipcRenderer.invoke("recent:get"),
  addRecentFile: (filePath) => ipcRenderer.invoke("recent:add", filePath),
  confirmClose: (isDirty) => ipcRenderer.invoke("dialog:confirmClose", isDirty),
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
});

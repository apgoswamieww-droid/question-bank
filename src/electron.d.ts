export interface RecentFileItem {
  path: string;
  name: string;
  updatedAt?: string;
}

export interface ElectronAPI {
  openFileDialog: () => Promise<{ filePath: string; content: string } | null>;
  saveFileDialog: (defaultTitle?: string) => Promise<string | null>;
  readFile: (filePath: string) => Promise<{ filePath: string; content: string }>;
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; filePath: string }>;
  getRecentFiles: () => Promise<RecentFileItem[]>;
  addRecentFile: (filePath: string) => Promise<RecentFileItem[]>;
  confirmClose: (isDirty: boolean) => Promise<"save" | "dontsave" | "cancel">;
  onCloseRequested: (callback: () => void) => () => void;
  onMenuAction: (callback: (action: "new" | "open" | "save" | "saveAs") => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

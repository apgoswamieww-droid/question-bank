import { useState, useEffect, useCallback } from "react";
import type { RecentFileItem } from "../electron.d";

export function useRecentFiles() {
  const [recentFiles, setRecentFiles] = useState<RecentFileItem[]>([]);
  const [isRecentOpen, setIsRecentOpen] = useState<boolean>(false);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI
        .getRecentFiles()
        .then((list) => {
          if (Array.isArray(list)) setRecentFiles(list);
        })
        .catch((err) => console.error("Error fetching recent files:", err));
    }
  }, []);

  const refreshRecentFiles = useCallback(async () => {
    if (!window.electronAPI) return;
    try {
      const updatedRecents = await window.electronAPI.getRecentFiles();
      setRecentFiles(updatedRecents);
    } catch (err) {
      console.error("Error refreshing recent files:", err);
    }
  }, []);

  return {
    recentFiles,
    isRecentOpen,
    setIsRecentOpen,
    refreshRecentFiles,
  };
}

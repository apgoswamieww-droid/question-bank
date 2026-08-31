import { useState, useCallback } from "react";
import type { RecentFileItem } from "../types/files";
import { getRecentFiles } from "../web/recentFiles";

export function useRecentFiles() {
  const [recentFiles, setRecentFiles] = useState<RecentFileItem[]>(() =>
    typeof window === "undefined" ? [] : getRecentFiles()
  );
  const [isRecentOpen, setIsRecentOpen] = useState<boolean>(false);

  const refreshRecentFiles = useCallback(() => {
    setRecentFiles(getRecentFiles());
  }, []);

  return {
    recentFiles,
    isRecentOpen,
    setIsRecentOpen,
    refreshRecentFiles,
  };
}
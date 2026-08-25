import { useEffect } from "react";

interface UseAutoSaveOptions {
  filePath: string | null;
  isDirty: boolean;
  onSave: (filePath: string) => void;
  onStatusChange: (status: "idle" | "saving" | "saved" | "error") => void;
  intervalMs?: number;
}

export function useAutoSave({
  filePath,
  isDirty,
  onSave,
  onStatusChange,
  intervalMs = 30000,
}: UseAutoSaveOptions) {
  useEffect(() => {
    if (!filePath || !isDirty) return;

    const timer = setInterval(() => {
      onStatusChange("saving");
      onSave(filePath);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [filePath, isDirty, onSave, onStatusChange, intervalMs]);
}

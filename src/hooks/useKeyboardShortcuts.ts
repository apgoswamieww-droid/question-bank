import { useEffect } from "react";

interface UseKeyboardShortcutsOptions {
  onSave: () => void;
  onSaveAs: () => void;
  onNew: () => void;
  onOpen: () => void;
}

export function useKeyboardShortcuts({
  onSave,
  onSaveAs,
  onNew,
  onOpen,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === "s") {
          e.preventDefault();
          if (e.shiftKey) {
            onSaveAs();
          } else {
            onSave();
          }
        } else if (e.key.toLowerCase() === "n" && !e.shiftKey) {
          e.preventDefault();
          onNew();
        } else if (e.key.toLowerCase() === "o" && !e.shiftKey) {
          e.preventDefault();
          onOpen();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSave, onSaveAs, onNew, onOpen]);
}

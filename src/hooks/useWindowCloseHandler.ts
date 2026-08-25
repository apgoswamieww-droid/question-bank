import { useEffect } from "react";

interface UseWindowCloseHandlerOptions {
  isDirty: boolean;
  onSave: () => Promise<boolean>;
}

export function useWindowCloseHandler({
  isDirty,
  onSave,
}: UseWindowCloseHandlerOptions) {
  useEffect(() => {
    if (!window.electronAPI) return;

    const unbindClose = window.electronAPI.onCloseRequested(async () => {
      if (!isDirty) {
        window.electronAPI?.confirmClose(false);
      } else {
        const choice = await window.electronAPI?.confirmClose(true);
        if (choice === "save") {
          const saved = await onSave();
          if (saved) {
            window.electronAPI?.confirmClose(false);
          }
        }
      }
    });

    return () => {
      unbindClose();
    };
  }, [isDirty, onSave]);
}

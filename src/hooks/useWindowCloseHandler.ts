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
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, onSave]);
}

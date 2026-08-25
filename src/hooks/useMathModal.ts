import { useState, useCallback } from "react";

export function useMathModal() {
  const [isMathModalOpen, setIsMathModalOpen] = useState(false);
  const [mathInitialLatex, setMathInitialLatex] = useState("");
  const [mathInitialDisplayMode, setMathInitialDisplayMode] = useState(false);
  const [mathUpdateCallback, setMathUpdateCallback] = useState<
    ((latex: string, displayMode: boolean) => void) | null
  >(null);

  const handleOpenMathEditor = useCallback(
    (
      latex: string,
      displayMode: boolean,
      updateFn?: (latex: string, displayMode: boolean) => void
    ) => {
      setMathInitialLatex(latex);
      setMathInitialDisplayMode(displayMode);
      setMathUpdateCallback(() => updateFn || null);
      setIsMathModalOpen(true);
    },
    []
  );

  const openNewMathModal = useCallback(() => {
    setMathInitialLatex("");
    setMathInitialDisplayMode(false);
    setMathUpdateCallback(null);
    setIsMathModalOpen(true);
  }, []);

  const closeMathModal = useCallback(() => {
    setIsMathModalOpen(false);
  }, []);

  return {
    isMathModalOpen,
    mathInitialLatex,
    mathInitialDisplayMode,
    mathUpdateCallback,
    handleOpenMathEditor,
    openNewMathModal,
    closeMathModal,
  };
}

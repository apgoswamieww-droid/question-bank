import { useState, useRef, useEffect, useCallback } from "react";
import type { Editor } from "@tiptap/react";

export function useFontMarks(editor: Editor | null) {
  const [selectedFont, setSelectedFont] = useState("Normal");
  const [selectedFontSize, setSelectedFontSize] = useState("14");
  const savedSelection = useRef<{ from: number; to: number } | null>(null);

  useEffect(() => {
    if (!editor) return;

    const updateFromEditor = () => {
      const attrs = editor.getAttributes("fontFamily");
      const fontFamily = attrs?.fontFamily || null;
      const fontSize = attrs?.fontSize || null;

      setSelectedFont(fontFamily ? fontFamily : "Normal");
      setSelectedFontSize(fontSize ? fontSize.replace("px", "") : "14");
    };

    updateFromEditor();

    editor.on("selectionUpdate", updateFromEditor);

    return () => {
      editor.off("selectionUpdate", updateFromEditor);
    };
  }, [editor]);

  const saveSelection = useCallback(() => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    savedSelection.current = { from, to };
  }, [editor]);

  const applyFont = useCallback(
    (font: string) => {
      if (!editor) return;
      setSelectedFont(font);
      const selection = savedSelection.current;
      const targetFont = font === "Normal" ? null : font;

      if (selection) {
        if (font === "Normal") {
          const currentAttrs = editor.getAttributes("fontFamily");
          if (currentAttrs.fontSize) {
            editor
              .chain()
              .focus()
              .setTextSelection(selection)
              .setMark("fontFamily", { fontFamily: null })
              .run();
          } else {
            editor
              .chain()
              .focus()
              .setTextSelection(selection)
              .unsetMark("fontFamily")
              .run();
          }
        } else {
          editor
            .chain()
            .focus()
            .setTextSelection(selection)
            .setMark("fontFamily", { fontFamily: targetFont })
            .run();
        }
        savedSelection.current = null;
      } else {
        if (font === "Normal") {
          const currentAttrs = editor.getAttributes("fontFamily");
          if (currentAttrs.fontSize) {
            editor
              .chain()
              .focus()
              .setMark("fontFamily", { fontFamily: null })
              .run();
          } else {
            editor.chain().focus().unsetMark("fontFamily").run();
          }
        } else {
          editor
            .chain()
            .focus()
            .setMark("fontFamily", { fontFamily: targetFont })
            .run();
        }
      }
    },
    [editor]
  );

  const applyFontSize = useCallback(
    (size: string) => {
      if (!editor) return;
      setSelectedFontSize(size);
      const selection = savedSelection.current;

      if (selection) {
        editor
          .chain()
          .focus()
          .setTextSelection(selection)
          .setMark("fontFamily", { fontSize: `${size}px` })
          .run();
        savedSelection.current = null;
      } else {
        editor
          .chain()
          .focus()
          .setMark("fontFamily", { fontSize: `${size}px` })
          .run();
      }
    },
    [editor]
  );

  return {
    selectedFont,
    selectedFontSize,
    saveSelection,
    applyFont,
    applyFontSize,
  };
}

import React, { useRef, useEffect } from "react";
import katex from "katex";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";

export const MathNodeComponent: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  selected,
  extension,
}) => {
  const { latex, displayMode } = node.attrs as { latex: string; displayMode: boolean };
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        katex.render(latex || "\\text{Math}", containerRef.current, {
          displayMode,
          throwOnError: false,
        });
      } catch {
        containerRef.current.innerText = latex;
      }
    }
  }, [latex, displayMode]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const onOpenEditor = (extension.options as { onOpenEditor?: (latex: string, displayMode: boolean, updateFn: (latex: string, displayMode: boolean) => void) => void })?.onOpenEditor;
    if (onOpenEditor) {
      onOpenEditor(latex, displayMode, (newLatex: string, newDisplayMode: boolean) => {
        updateAttributes({ latex: newLatex, displayMode: newDisplayMode });
      });
    }
  };

  return (
    <NodeViewWrapper
      as={displayMode ? "div" : "span"}
      className={`math-node-wrapper ${displayMode ? "is-display" : "is-inline"} ${selected ? "is-selected" : ""
        }`}
      onDoubleClick={handleDoubleClick}
      title="Double-click to edit equation"
    >
      <span ref={containerRef} className="katex-rendered-content" />
    </NodeViewWrapper>
  );
};


import React, { useRef, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import { AlignLeft, AlignCenter, AlignRight, Trash2 } from "lucide-react";

interface ImageNodeViewProps {
  node: {
    attrs: {
      src: string;
      alt?: string;
      width?: string;
      height?: string;
      alignment?: "left" | "center" | "right";
    };
  };
  updateAttributes: (attrs: Record<string, unknown>) => void;
  deleteNode: () => void;
  selected: boolean;
}

export const ResizableImageComponent: React.FC<ImageNodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  selected,
}) => {
  const { src, alt, width, alignment } = node.attrs;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = containerRef.current?.offsetWidth || 300;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const currentX = moveEvent.clientX;
      const diffX = currentX - startX;
      let newWidth = startWidth + diffX;

      if (newWidth < 100) newWidth = 100;

      const parentWidth = containerRef.current?.parentElement?.offsetWidth || 800;
      if (newWidth > parentWidth) newWidth = parentWidth;

      updateAttributes({ width: `${Math.round(newWidth)}px` });
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const justifyStyle =
    alignment === "left" ? "flex-start" : alignment === "right" ? "flex-end" : "center";

  return (
    <NodeViewWrapper
      className={`resizable-image-node-wrapper ${selected ? "is-selected" : ""}`}
      style={{ display: "flex", justifyContent: justifyStyle, width: "100%", margin: "12px 0" }}
    >
      <div
        ref={containerRef}
        className={`resizable-image-container ${isResizing ? "is-resizing" : ""}`}
        style={{ width: width || "300px", position: "relative", display: "inline-block" }}
      >
        <img
          src={src}
          alt={alt || ""}
          style={{ width: "100%", height: "auto", display: "block", borderRadius: "4px" }}
        />

        {selected && (
          <>
            <div
              className="resize-handle bottom-right"
              onMouseDown={handleMouseDown}
              title="Drag to resize image"
            />

            <div className="image-toolbar-overlay" onMouseDown={(e) => e.preventDefault()}>
              <button
                type="button"
                className={alignment === "left" ? "active" : ""}
                title="Align Left"
                onClick={() => updateAttributes({ alignment: "left" })}
              >
                <AlignLeft size={14} />
              </button>
              <button
                type="button"
                className={alignment === "center" || !alignment ? "active" : ""}
                title="Align Center"
                onClick={() => updateAttributes({ alignment: "center" })}
              >
                <AlignCenter size={14} />
              </button>
              <button
                type="button"
                className={alignment === "right" ? "active" : ""}
                title="Align Right"
                onClick={() => updateAttributes({ alignment: "right" })}
              >
                <AlignRight size={14} />
              </button>
              <div className="toolbar-overlay-divider" />
              <button
                type="button"
                className="delete-btn"
                title="Delete Image"
                onClick={deleteNode}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
};

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ResizableImageComponent } from "./ResizableImageComponent";

export const ResizableImage = Node.create({
  name: "resizableImage",
  group: "block",
  inline: false,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: "",
      },
      width: {
        default: "300px",
      },
      height: {
        default: "auto",
      },
      alignment: {
        default: "center",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="resizable-image"]',
        getAttrs: (element) => {
          const el = element as HTMLElement;
          const img = el.querySelector("img");
          return {
            src: img?.getAttribute("src") || el.getAttribute("data-src"),
            alt: img?.getAttribute("alt") || "",
            width: el.style.width || "300px",
            height: "auto",
            alignment: el.getAttribute("data-alignment") || "center",
          };
        },
      },
      {
        tag: "img[src]",
        getAttrs: (element) => {
          const el = element as HTMLImageElement;
          return {
            src: el.getAttribute("src"),
            alt: el.getAttribute("alt") || "",
            width: el.style.width || el.getAttribute("width") || "300px",
            height: "auto",
            alignment: el.getAttribute("data-alignment") || "center",
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const alignment = HTMLAttributes.alignment || "center";
    const justify =
      alignment === "left" ? "flex-start" : alignment === "right" ? "flex-end" : "center";
    const width = HTMLAttributes.width || "300px";

    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "resizable-image",
        "data-alignment": alignment,
        class: `image-block-wrapper align-${alignment}`,
        style: `display: flex; justify-content: ${justify}; margin: 12px 0;`,
      }),
      [
        "img",
        {
          src: HTMLAttributes.src,
          alt: HTMLAttributes.alt || "",
          style: `width: ${width}; max-width: 100%; height: auto; border-radius: 4px;`,
        },
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent);
  },
});

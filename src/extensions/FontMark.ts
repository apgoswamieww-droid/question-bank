import { Mark, mergeAttributes } from "@tiptap/core";

export const FontMark = Mark.create({
  name: "fontFamily",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      fontFamily: {
        default: null,

        parseHTML: (element: HTMLElement) =>
          element.style.fontFamily
            ? element.style.fontFamily.replace(/["']/g, "")
            : null,

        renderHTML: (attributes: Record<string, string>) => {
          if (!attributes.fontFamily) {
            return {};
          }

          return {
            style: `font-family: "${attributes.fontFamily}"`,
          };
        },
      },
      fontSize: {
        default: null,

        parseHTML: (element: HTMLElement) => element.style.fontSize || null,

        renderHTML: (attributes: Record<string, string>) => {
          if (!attributes.fontSize) {
            return {};
          }

          return {
            style: `font-size: ${attributes.fontSize}`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        style: "font-family",
      },
      {
        style: "font-size",
      },
      {
        tag: "span[style]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },
});

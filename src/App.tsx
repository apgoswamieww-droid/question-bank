import { useRef, useState, useEffect, useCallback } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Mark, mergeAttributes } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  RemoveFormatting,
  HelpCircle,
  Image as ImageIcon,
  Sigma,
} from "lucide-react";

import {
  QuestionBlock,
  QuestionText,
  QuestionOption,
  QuestionFooter,
  QuestionAnswer,
  QuestionMarks,
} from "./QuestionBlock";
import { ResizableImage } from "./ResizableImage";
import { MathNode } from "./MathNode";
import { MathEditorModal } from "./MathEditorModal";

import "./index.css";

const fonts = ["Normal", "KAP110", "KAP111", "KAP112", "KAP122"];
const fontSizes = [12, 14, 16, 18, 20, 24, 28, 32, 36];

const FontMark = Mark.create({
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

        parseHTML: (element) =>
          element.style.fontFamily
            ? element.style.fontFamily.replace(/["']/g, "")
            : null,

        renderHTML: (attributes) => {
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

        parseHTML: (element) => element.style.fontSize || null,

        renderHTML: (attributes) => {
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

function App() {
  const [selectedFont, setSelectedFont] = useState("Normal");
  const [selectedFontSize, setSelectedFontSize] = useState("18");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Math Modal States
  const [isMathModalOpen, setIsMathModalOpen] = useState(false);
  const [mathInitialLatex, setMathInitialLatex] = useState("");
  const [mathInitialDisplayMode, setMathInitialDisplayMode] = useState(false);
  const [mathUpdateCallback, setMathUpdateCallback] = useState<
    ((latex: string, displayMode: boolean) => void) | null
  >(null);

  const savedSelection = useRef<{
    from: number;
    to: number;
  } | null>(null);

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

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({
        types: ["heading", "paragraph"],
        defaultAlignment: "left",
      }),
      FontMark,
      QuestionBlock,
      QuestionText,
      QuestionOption,
      QuestionFooter,
      QuestionAnswer,
      QuestionMarks,
      ResizableImage,
      MathNode.configure({
        onOpenEditor: handleOpenMathEditor,
      }),
    ],

    editorProps: {
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) {
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = reader.result as string;
                editor
                  ?.chain()
                  .focus()
                  .insertContent({
                    type: "resizableImage",
                    attrs: {
                      src: dataUrl,
                      alt: file.name || "Pasted image",
                      width: "300px",
                      alignment: "center",
                    },
                  })
                  .run();
              };
              reader.readAsDataURL(file);
              return true;
            }
          }
        }
        return false;
      },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;

        const file = files[0];
        if (file.type.startsWith("image/")) {
          event.preventDefault();
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            editor
              ?.chain()
              .focus()
              .insertContent({
                type: "resizableImage",
                attrs: {
                  src: dataUrl,
                  alt: file.name || "Dropped image",
                  width: "300px",
                  alignment: "center",
                },
              })
              .run();
          };
          reader.readAsDataURL(file);
          return true;
        }
        return false;
      },
    },

    content: `
      <p><span style="font-family: KAP112; font-size: 24px;">VF5[,F VF5[,F</span></p>
      <p>English text: Calculate the value of X when x² + 2x + 1 = 0.</p>
    `,
  });

  // Update dropdown values to reflect the current cursor/selection state
  useEffect(() => {
    if (!editor) return;

    const updateFromEditor = () => {
      const attrs = editor.getAttributes("fontFamily");
      const fontFamily = attrs?.fontFamily || null;
      const fontSize = attrs?.fontSize || null;

      setSelectedFont(fontFamily ? fontFamily : "Normal");
      setSelectedFontSize(fontSize ? fontSize.replace("px", "") : "18");
    };

    updateFromEditor();

    editor.on("selectionUpdate", updateFromEditor);
    editor.on("transaction", updateFromEditor);

    return () => {
      editor.off("selectionUpdate", updateFromEditor);
      editor.off("transaction", updateFromEditor);
    };
  }, [editor]);

  if (!editor) {
    return null;
  }

  const handleMathSubmit = (latex: string, displayMode: boolean) => {
    if (mathUpdateCallback) {
      mathUpdateCallback(latex, displayMode);
    } else {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "mathNode",
          attrs: {
            latex,
            displayMode,
          },
        })
        .run();
    }
  };

  const openNewMathModal = () => {
    setMathInitialLatex("");
    setMathInitialDisplayMode(false);
    setMathUpdateCallback(null);
    setIsMathModalOpen(true);
  };

  const saveSelection = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    savedSelection.current = { from, to };
  };

  const applyFont = (font: string) => {
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
          editor.chain().focus().setMark("fontFamily", { fontFamily: null }).run();
        } else {
          editor.chain().focus().unsetMark("fontFamily").run();
        }
      } else {
        editor.chain().focus().setMark("fontFamily", { fontFamily: targetFont }).run();
      }
    }
  };

  const applyFontSize = (size: string) => {
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
  };


  const handleAlignment = (alignment: "left" | "center" | "right" | "justify") => {
    if (!editor) return;

    if (editor.isActive("resizableImage")) {
      const targetAlign = alignment === "justify" ? "center" : alignment;
      editor
        .chain()
        .focus()
        .updateAttributes("resizableImage", { alignment: targetAlign })
        .run();
    } else {
      editor.chain().focus().setTextAlign(alignment).run();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file (.png, .jpg, .jpeg, .webp, .gif)");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (editor) {
        editor
          .chain()
          .focus()
          .insertContent({
            type: "resizableImage",
            attrs: {
              src: dataUrl,
              alt: file.name,
              width: "300px",
              alignment: "center",
            },
          })
          .run();
      }
    };
    reader.readAsDataURL(file);

    e.target.value = "";
  };

  const insertQuestionBlock = () => {
    if (!editor) return;

    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: "questionBlock",
          content: [
            {
              type: "questionText",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Question text here" }],
                },
              ],
            },
            {
              type: "questionOption",
              attrs: { label: "A" },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Option A" }],
                },
              ],
            },
            {
              type: "questionOption",
              attrs: { label: "B" },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Option B" }],
                },
              ],
            },
            {
              type: "questionOption",
              attrs: { label: "C" },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Option C" }],
                },
              ],
            },
            {
              type: "questionOption",
              attrs: { label: "D" },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Option D" }],
                },
              ],
            },
            {
              type: "questionFooter",
              content: [
                {
                  type: "questionAnswer",
                  content: [{ type: "paragraph" }],
                },
                {
                  type: "questionMarks",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "1" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "paragraph",
        },
      ])
      .run();

    // Move cursor to select the question text "Question text here"
    setTimeout(() => {
      const { state, dispatch } = editor.view;
      const { $from } = state.selection;

      let qPos = -1;
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === "questionBlock") {
          qPos = $from.before(d);
          break;
        }
      }

      if (qPos !== -1) {
        const textPos = qPos + 3; // position inside questionText paragraph
        const tr = state.tr.setSelection(
          TextSelection.create(state.doc, textPos, textPos + "Question text here".length)
        );
        dispatch(tr);
      }
    }, 10);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Question Bank</h1>
        <span>Mixed Content Editor — POC</span>
      </header>

      <main className="editor-wrapper">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png, image/jpeg, image/webp, image/gif"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        <div className="toolbar">
          <div className="toolbar-group">
            <button
              type="button"
              title="Undo"
              aria-label="Undo"
              disabled={!editor.can().undo()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().undo().run()}
            >
              <Undo2 size={18} strokeWidth={2} />
            </button>

            <button
              type="button"
              title="Redo"
              aria-label="Redo"
              disabled={!editor.can().redo()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().redo().run()}
            >
              <Redo2 size={18} strokeWidth={2} />
            </button>
          </div>

          <div className="toolbar-separator" />

          <div className="toolbar-group">
            <button
              type="button"
              title="Bold"
              aria-label="Bold"
              className={editor.isActive("bold") ? "active" : ""}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Bold size={18} strokeWidth={2} />
            </button>

            <button
              type="button"
              title="Italic"
              aria-label="Italic"
              className={editor.isActive("italic") ? "active" : ""}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Italic size={18} strokeWidth={2} />
            </button>

            <button
              type="button"
              title="Underline"
              aria-label="Underline"
              className={editor.isActive("underline") ? "active" : ""}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              <Underline size={18} strokeWidth={2} />
            </button>
          </div>

          <div className="toolbar-separator" />

          <div className="toolbar-group">
            <select
              value={selectedFont}
              onMouseDown={saveSelection}
              onChange={(e) => {
                applyFont(e.target.value);
              }}
            >
              {fonts.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>

            <select
              value={selectedFontSize}
              onMouseDown={saveSelection}
              onChange={(e) => {
                applyFontSize(e.target.value);
              }}
            >
              {fontSizes.map((size) => (
                <option key={size} value={String(size)}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          <div className="toolbar-separator" />

          <div className="toolbar-group">
            <button
              type="button"
              title="Align Left"
              aria-label="Align Left"
              className={
                editor.isActive("resizableImage", { alignment: "left" }) ||
                editor.isActive({ textAlign: "left" })
                  ? "active"
                  : ""
              }
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleAlignment("left")}
            >
              <AlignLeft size={18} strokeWidth={2} />
            </button>

            <button
              type="button"
              title="Align Center"
              aria-label="Align Center"
              className={
                editor.isActive("resizableImage", { alignment: "center" }) ||
                editor.isActive({ textAlign: "center" })
                  ? "active"
                  : ""
              }
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleAlignment("center")}
            >
              <AlignCenter size={18} strokeWidth={2} />
            </button>

            <button
              type="button"
              title="Align Right"
              aria-label="Align Right"
              className={
                editor.isActive("resizableImage", { alignment: "right" }) ||
                editor.isActive({ textAlign: "right" })
                  ? "active"
                  : ""
              }
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleAlignment("right")}
            >
              <AlignRight size={18} strokeWidth={2} />
            </button>

            <button
              type="button"
              title="Justify"
              aria-label="Justify"
              className={editor.isActive({ textAlign: "justify" }) ? "active" : ""}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleAlignment("justify")}
            >
              <AlignJustify size={18} strokeWidth={2} />
            </button>
          </div>

          <div className="toolbar-separator" />

          <div className="toolbar-group">
            <button
              type="button"
              title="Bullet List"
              aria-label="Bullet List"
              className={editor.isActive("bulletList") ? "active" : ""}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <List size={18} strokeWidth={2} />
            </button>

            <button
              type="button"
              title="Numbered List"
              aria-label="Numbered List"
              className={editor.isActive("orderedList") ? "active" : ""}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered size={18} strokeWidth={2} />
            </button>
          </div>

          <div className="toolbar-separator" />

          <div className="toolbar-group">
            <button
              type="button"
              title="Insert Question"
              aria-label="Insert Question"
              onMouseDown={(e) => e.preventDefault()}
              onClick={insertQuestionBlock}
            >
              <HelpCircle size={18} strokeWidth={2} />
            </button>

            <button
              type="button"
              title="Insert Image"
              aria-label="Insert Image"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon size={18} strokeWidth={2} />
            </button>

            <button
              type="button"
              title="Insert Equation"
              aria-label="Insert Equation"
              onMouseDown={(e) => e.preventDefault()}
              onClick={openNewMathModal}
            >
              <Sigma size={18} strokeWidth={2} />
            </button>
          </div>

          <div className="toolbar-separator" />

          <div className="toolbar-group">
            <button
              type="button"
              title="Clear Formatting"
              aria-label="Clear Formatting"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().unsetAllMarks().run()}
            >
              <RemoveFormatting size={18} strokeWidth={2} />
            </button>
          </div>
        </div>

        <EditorContent editor={editor} />
      </main>

      <MathEditorModal
        isOpen={isMathModalOpen}
        initialLatex={mathInitialLatex}
        initialDisplayMode={mathInitialDisplayMode}
        onClose={() => setIsMathModalOpen(false)}
        onSubmit={handleMathSubmit}
      />
    </div>
  );
}

export default App;





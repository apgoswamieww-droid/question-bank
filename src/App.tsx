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
  FilePlus,
  FolderOpen,
  Save,
  FileDown,
  Clock,
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
import type { RecentFileItem } from "./electron.d";

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

  // Document Management State
  const [filePath, setFilePath] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState<string>("Untitled Question Paper");
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [recentFiles, setRecentFiles] = useState<RecentFileItem[]>([]);
  const [isRecentOpen, setIsRecentOpen] = useState<boolean>(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  }, []);

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

    onUpdate: () => {
      setIsDirty(true);
    },
  });

  // Load recent files on start
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getRecentFiles().then((list) => {
        if (Array.isArray(list)) setRecentFiles(list);
      }).catch(err => console.error("Error fetching recent files:", err));
    }
  }, []);

  // Update dropdown values to reflect current cursor/selection state
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

    return () => {
      editor.off("selectionUpdate", updateFromEditor);
    };
  }, [editor]);

  // Save Document Core Logic
  const saveDocumentContent = useCallback(
    async (targetPath: string): Promise<boolean> => {
      if (!editor || !window.electronAPI) return false;

      const title = targetPath.split(/[/\\]/).pop()?.replace(/\.qbank$/i, "") || docTitle;
      const docPayload = {
        format: "question-bank",
        version: 1,
        title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        content: editor.getJSON(),
      };

      try {
        const result = await window.electronAPI.writeFile(
          targetPath,
          JSON.stringify(docPayload, null, 2)
        );
        if (result && result.filePath) {
          setFilePath(result.filePath);
          setDocTitle(title);
          setIsDirty(false);
          setAutoSaveStatus("saved");
          const updatedRecents = await window.electronAPI.getRecentFiles();
          setRecentFiles(updatedRecents);
          return true;
        }
      } catch (err: any) {
        console.error("Save error:", err);
        setAutoSaveStatus("error");
        showToast(`Save failed: ${err.message || "Unknown error"}`);
      }
      return false;
    },
    [editor, docTitle, showToast]
  );

  const handleSaveAs = useCallback(async (): Promise<boolean> => {
    if (!window.electronAPI) return false;
    try {
      const selectedPath = await window.electronAPI.saveFileDialog(docTitle);
      if (selectedPath) {
        return await saveDocumentContent(selectedPath);
      }
    } catch (err: any) {
      console.error("Save As error:", err);
      showToast(`Save As failed: ${err.message || "Unknown error"}`);
    }
    return false;
  }, [docTitle, saveDocumentContent, showToast]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (filePath) {
      return await saveDocumentContent(filePath);
    } else {
      return await handleSaveAs();
    }
  }, [filePath, saveDocumentContent, handleSaveAs]);

  const handleOpenContent = useCallback(
    (targetPath: string, jsonString: string) => {
      if (!editor) return;
      try {
        const parsed = JSON.parse(jsonString);
        if (parsed.format !== "question-bank" || !parsed.content) {
          alert("Unable to open this file.\n\nThe selected file is not a valid Question Bank document.");
          return;
        }
        editor.commands.setContent(parsed.content);
        setFilePath(targetPath);
        const name = targetPath.split(/[/\\]/).pop()?.replace(/\.qbank$/i, "") || parsed.title || "Untitled Document";
        setDocTitle(name);
        setIsDirty(false);
        setAutoSaveStatus("idle");
      } catch (err: any) {
        console.error("Parse document error:", err);
        alert("Unable to open this file.\n\nFailed to parse Question Bank document JSON structure.");
      }
    },
    [editor]
  );

  const handleOpenPath = useCallback(
    async (targetPath: string) => {
      if (!window.electronAPI) return;
      if (isDirty) {
        const choice = await window.electronAPI.confirmClose(true);
        if (choice === "cancel") return;
        if (choice === "save") {
          const saved = await handleSave();
          if (!saved) return;
        }
      }

      try {
        const result = await window.electronAPI.readFile(targetPath);
        if (result && result.content) {
          handleOpenContent(result.filePath, result.content);
          const updatedRecents = await window.electronAPI.getRecentFiles();
          setRecentFiles(updatedRecents);
        }
      } catch (err: any) {
        console.error("Open file path error:", err);
        showToast(`Failed to open file: ${err.message || "File not found"}`);
      }
    },
    [isDirty, handleSave, handleOpenContent, showToast]
  );

  const handleOpen = useCallback(async () => {
    if (!window.electronAPI) return;
    if (isDirty) {
      const choice = await window.electronAPI.confirmClose(true);
      if (choice === "cancel") return;
      if (choice === "save") {
        const saved = await handleSave();
        if (!saved) return;
      }
    }

    try {
      const result = await window.electronAPI.openFileDialog();
      if (result && result.filePath && result.content) {
        handleOpenContent(result.filePath, result.content);
        const updatedRecents = await window.electronAPI.getRecentFiles();
        setRecentFiles(updatedRecents);
      }
    } catch (err: any) {
      console.error("Open dialog error:", err);
      showToast(`Open failed: ${err.message || "Unknown error"}`);
    }
  }, [isDirty, handleSave, handleOpenContent, showToast]);

  const handleNew = useCallback(async () => {
    if (!editor) return;
    if (isDirty && window.electronAPI) {
      const choice = await window.electronAPI.confirmClose(true);
      if (choice === "cancel") return;
      if (choice === "save") {
        const saved = await handleSave();
        if (!saved) return;
      }
    }

    editor.commands.setContent("<p></p>");
    setFilePath(null);
    setDocTitle("Untitled Question Paper");
    setIsDirty(false);
    setAutoSaveStatus("idle");
  }, [editor, isDirty, handleSave]);

  // Auto-Save Timer (Every 30 Seconds)
  useEffect(() => {
    if (!filePath || !isDirty) return;

    const timer = setInterval(() => {
      setAutoSaveStatus("saving");
      saveDocumentContent(filePath);
    }, 30000);

    return () => clearInterval(timer);
  }, [filePath, isDirty, saveDocumentContent]);

  // Window Close & Desktop Menu Actions
  useEffect(() => {
    if (!window.electronAPI) return;

    const unbindClose = window.electronAPI.onCloseRequested(async () => {
      if (!isDirty) {
        window.electronAPI?.confirmClose(false);
      } else {
        const choice = await window.electronAPI?.confirmClose(true);
        if (choice === "save") {
          const saved = await handleSave();
          if (saved) {
            window.electronAPI?.confirmClose(false);
          }
        }
      }
    });

    return () => {
      unbindClose();
    };
  }, [isDirty, handleSave]);

  // Global Keyboard Shortcuts (Ctrl+N, Ctrl+O, Ctrl+S, Ctrl+Shift+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === "s") {
          e.preventDefault();
          if (e.shiftKey) {
            handleSaveAs();
          } else {
            handleSave();
          }
        } else if (e.key.toLowerCase() === "n" && !e.shiftKey) {
          e.preventDefault();
          handleNew();
        } else if (e.key.toLowerCase() === "o" && !e.shiftKey) {
          e.preventDefault();
          handleOpen();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, handleSaveAs, handleNew, handleOpen]);

  const handleMathSubmit = (latex: string, displayMode: boolean) => {
    if (!editor) return;

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
      editor
        ?.chain()
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
        const textPos = qPos + 3;
        const tr = state.tr.setSelection(
          TextSelection.create(state.doc, textPos, textPos + "Question text here".length)
        );
        dispatch(tr);
      }
    }, 10);
  };

  if (!editor) {
    return null;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>Question Bank</h1>
          <div className="doc-title-badge">
            <span className="doc-title">{docTitle}</span>
            {isDirty && <span className="dirty-badge" title="Unsaved changes">*</span>}
          </div>
        </div>
        <div className="header-right">
          {autoSaveStatus === "saving" && <span className="autosave-tag saving">Auto-saving...</span>}
          {autoSaveStatus === "saved" && <span className="autosave-tag saved">Auto-saved</span>}
          {autoSaveStatus === "error" && <span className="autosave-tag error">Auto-save failed</span>}
        </div>
      </header>

      {toastMessage && (
        <div className="toast-notification">
          {toastMessage}
        </div>
      )}

      <main className="editor-wrapper">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png, image/jpeg, image/webp, image/gif"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        <div className="toolbar doc-toolbar">
          <div className="toolbar-group">
            <button type="button" className="btn-with-label" title="New Document (Ctrl+N)" onClick={handleNew}>
              <FilePlus size={15} strokeWidth={2} /> <span>New</span>
            </button>
            <button type="button" className="btn-with-label" title="Open Document (Ctrl+O)" onClick={handleOpen}>
              <FolderOpen size={15} strokeWidth={2} /> <span>Open</span>
            </button>
            <button type="button" className="btn-with-label" title="Save Document (Ctrl+S)" onClick={handleSave}>
              <Save size={15} strokeWidth={2} /> <span>Save</span>
            </button>
            <button type="button" className="btn-with-label" title="Save As... (Ctrl+Shift+S)" onClick={handleSaveAs}>
              <FileDown size={15} strokeWidth={2} /> <span>Save As</span>
            </button>
          </div>

          <div className="toolbar-separator" />

          <div className="toolbar-group recent-files-container">
            <button
              type="button"
              className="btn-with-label"
              title="Recent Documents"
              onClick={() => setIsRecentOpen((prev) => !prev)}
            >
              <Clock size={15} strokeWidth={2} /> <span>Recent Files</span>
            </button>
            {isRecentOpen && (
              <div className="recent-dropdown">
                {recentFiles.length === 0 ? (
                  <div className="recent-item empty">No recent files</div>
                ) : (
                  recentFiles.map((file) => (
                    <button
                      key={file.path}
                      className="recent-item"
                      type="button"
                      onClick={() => {
                        setIsRecentOpen(false);
                        handleOpenPath(file.path);
                      }}
                    >
                      <span className="recent-name">{file.name}</span>
                      <span className="recent-path">{file.path}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="toolbar editor-toolbar">
          <div className="toolbar-group">
            <button
              type="button"
              className="btn-icon-only"
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
              disabled={!editor.can().undo()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().undo().run()}
            >
              <Undo2 size={16} strokeWidth={2} />
            </button>

            <button
              type="button"
              className="btn-icon-only"
              title="Redo (Ctrl+Y)"
              aria-label="Redo"
              disabled={!editor.can().redo()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().redo().run()}
            >
              <Redo2 size={16} strokeWidth={2} />
            </button>
          </div>

          <div className="toolbar-separator" />

          <div className="toolbar-group">
            <button
              type="button"
              className={`btn-icon-only ${editor.isActive("bold") ? "active" : ""}`}
              title="Bold (Ctrl+B)"
              aria-label="Bold"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Bold size={16} strokeWidth={2} />
            </button>

            <button
              type="button"
              className={`btn-icon-only ${editor.isActive("italic") ? "active" : ""}`}
              title="Italic (Ctrl+I)"
              aria-label="Italic"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Italic size={16} strokeWidth={2} />
            </button>

            <button
              type="button"
              className={`btn-icon-only ${editor.isActive("underline") ? "active" : ""}`}
              title="Underline (Ctrl+U)"
              aria-label="Underline"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              <Underline size={16} strokeWidth={2} />
            </button>
          </div>

          <div className="toolbar-separator" />

          <div className="toolbar-group">
            <select
              className="toolbar-select font-select"
              value={selectedFont}
              onMouseDown={saveSelection}
              onChange={(e) => applyFont(e.target.value)}
              title="Font Family"
            >
              {fonts.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>

            <select
              className="toolbar-select size-select"
              value={selectedFontSize}
              onMouseDown={saveSelection}
              onChange={(e) => applyFontSize(e.target.value)}
              title="Font Size"
            >
              {fontSizes.map((size) => (
                <option key={size} value={size}>
                  {size}px
                </option>
              ))}
            </select>
          </div>

          <div className="toolbar-separator" />

          <div className="toolbar-group">
            <button
              type="button"
              className={`btn-icon-only ${
                editor.isActive("resizableImage", { alignment: "left" }) ||
                editor.isActive({ textAlign: "left" })
                  ? "active"
                  : ""
              }`}
              title="Align Left"
              aria-label="Align Left"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleAlignment("left")}
            >
              <AlignLeft size={16} strokeWidth={2} />
            </button>

            <button
              type="button"
              className={`btn-icon-only ${
                editor.isActive("resizableImage", { alignment: "center" }) ||
                editor.isActive({ textAlign: "center" })
                  ? "active"
                  : ""
              }`}
              title="Align Center"
              aria-label="Align Center"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleAlignment("center")}
            >
              <AlignCenter size={16} strokeWidth={2} />
            </button>

            <button
              type="button"
              className={`btn-icon-only ${
                editor.isActive("resizableImage", { alignment: "right" }) ||
                editor.isActive({ textAlign: "right" })
                  ? "active"
                  : ""
              }`}
              title="Align Right"
              aria-label="Align Right"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleAlignment("right")}
            >
              <AlignRight size={16} strokeWidth={2} />
            </button>

            <button
              type="button"
              className={`btn-icon-only ${editor.isActive({ textAlign: "justify" }) ? "active" : ""}`}
              title="Justify"
              aria-label="Justify"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleAlignment("justify")}
            >
              <AlignJustify size={16} strokeWidth={2} />
            </button>
          </div>

          <div className="toolbar-separator" />

          <div className="toolbar-group">
            <button
              type="button"
              className={`btn-icon-only ${editor.isActive("bulletList") ? "active" : ""}`}
              title="Bullet List"
              aria-label="Bullet List"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <List size={16} strokeWidth={2} />
            </button>

            <button
              type="button"
              className={`btn-icon-only ${editor.isActive("orderedList") ? "active" : ""}`}
              title="Numbered List"
              aria-label="Numbered List"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered size={16} strokeWidth={2} />
            </button>
          </div>

          <div className="toolbar-separator" />

          <div className="toolbar-group">
            <button
              type="button"
              className="btn-with-label btn-action-accent"
              title="Insert Question Block"
              aria-label="Insert Question"
              onMouseDown={(e) => e.preventDefault()}
              onClick={insertQuestionBlock}
            >
              <HelpCircle size={16} strokeWidth={2} /> <span>MCQ Block</span>
            </button>

            <button
              type="button"
              className="btn-with-label btn-action-accent"
              title="Insert Image"
              aria-label="Insert Image"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon size={16} strokeWidth={2} /> <span>Image</span>
            </button>

            <button
              type="button"
              className="btn-with-label btn-action-accent"
              title="Insert Equation"
              aria-label="Insert Equation"
              onMouseDown={(e) => e.preventDefault()}
              onClick={openNewMathModal}
            >
              <Sigma size={16} strokeWidth={2} /> <span>Equation</span>
            </button>
          </div>

          <div className="toolbar-separator" />

          <div className="toolbar-group">
            <button
              type="button"
              className="btn-icon-only"
              title="Clear Formatting"
              aria-label="Clear Formatting"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().unsetAllMarks().run()}
            >
              <RemoveFormatting size={16} strokeWidth={2} />
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

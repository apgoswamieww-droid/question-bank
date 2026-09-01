import { useEffect, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import {
  Bold,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Italic,
  Languages,
  List,
  ListOrdered,
  Redo2,
  RemoveFormatting,
  Sigma,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
  AlignCenter,
  AlignLeft,
  AlignRight,
} from "lucide-react";

import { MathNode } from "../../MathNode";
import { ResizableImage } from "../../ResizableImage";
import { FontMark } from "../../extensions/FontMark";
import { useMathModal } from "../../hooks/useMathModal";
import { useFontMarks } from "../../hooks/useFontMarks";
import { MathEditorModal } from "../../MathEditorModal";
import { GujaratiConverterModal } from "../../components/GujaratiConverterModal";
import type { KapFont } from "../../converter/types";

const fonts = ["Normal", "KAP110", "KAP111", "KAP112", "KAP122", "KAP140"];
const fontSizes = [12, 14, 16, 18, 20, 24, 28, 32, 36];

interface RichEditorProps {
  value: unknown;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  disabled?: boolean;
  compact?: boolean;
}

function toolbarBtn(active: boolean, title: string, onClick: () => void, children: ReactNode, compact = false) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`flex items-center justify-center rounded-lg transition ${
        compact ? "h-6 w-6" : "h-8 w-8"
      } ${
        active ? "bg-primary text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />;
}

function valueToHtml(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  const maybe = value as { html?: string };
  return typeof maybe?.html === "string" ? maybe.html : "";
}

export function RichEditor({ value, onChange, placeholder, minHeight = "9rem", disabled, compact }: RichEditorProps) {
  const [isConverterOpen, setIsConverterOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    isMathModalOpen,
    mathInitialLatex,
    mathInitialDisplayMode,
    mathUpdateCallback,
    handleOpenMathEditor,
    openNewMathModal,
    closeMathModal,
  } = useMathModal();

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      FontMark,
      ResizableImage,
      MathNode.configure({ onOpenEditor: handleOpenMathEditor }),
    ],
    content: "",
    editorProps: { attributes: { class: "prose max-w-none focus:outline-none" } },
    editable: !disabled,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML() || "");
    },
  });

  const { selectedFont, selectedFontSize, saveSelection, applyFont, applyFontSize } = useFontMarks(editor);

  // Sync from external value (initial load / switching questions).
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const html = valueToHtml(value);
    if (html === editor.getHTML()) return;
    editor.commands.setContent(html, { emitUpdate: false });
  }, [editor, value]);

  const handleMathSubmit = (latex: string, displayMode: boolean) => {
    if (!editor) return;
    if (mathUpdateCallback) {
      mathUpdateCallback(latex, displayMode);
    } else {
      editor.chain().focus().insertContent({
        type: "mathNode",
        attrs: { latex, displayMode },
      }).run();
    }
  };

  const handleImage = (file: File) => {
    if (!editor) return;
    const reader = new FileReader();
    reader.onload = () => {
      editor.chain().focus().insertContent({
        type: "resizableImage",
        attrs: {
          src: String(reader.result),
          alt: file.name || "Image",
          width: "300px",
          alignment: "center",
        },
      }).run();
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImage(file);
    e.target.value = "";
  };

  const KAP_SIZE = "14px";

  const handleConverterInsert = (kapText: string, font: KapFont) => {
    editor?.chain().focus().insertContent({
      type: "text",
      text: kapText,
      marks: [{ type: "fontFamily", attrs: { fontFamily: font, fontSize: KAP_SIZE } }],
    }).run();
  };

  const handleConverterReplaceSelection = (kapText: string, font: KapFont) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const startMarks = editor.state.doc.resolve(from).marks() ?? editor.state.storedMarks ?? [];
    const preservedMarks = startMarks
      .filter((m) => m.type.name !== "fontFamily")
      .map((m) => ({ type: m.type.name, attrs: m.attrs }));
    editor.chain().focus().insertContentAt(
      { from, to },
      {
        type: "text",
        text: kapText,
        marks: [...preservedMarks, { type: "fontFamily", attrs: { fontFamily: font, fontSize: KAP_SIZE } }],
      }
    ).run();
  };

  if (!editor) {
    return <div className="h-36 animate-pulse rounded-xl bg-slate-100" />;
  }

  const active = {
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    underline: editor.isActive("underline"),
    strike: editor.isActive("strike"),
    h1: editor.isActive("heading", { level: 1 }),
    h2: editor.isActive("heading", { level: 2 }),
    ul: editor.isActive("bulletList"),
    ol: editor.isActive("orderedList"),
  };

  return (
    <div className={disabled ? "pointer-events-none opacity-60" : undefined}>
      <div className={`flex flex-wrap items-center gap-0.5 rounded-t-xl border border-b-0 border-slate-300 bg-slate-50 ${
        compact ? "px-1 py-0.5" : "px-1.5 py-1.5"
      }`}>
        <select
          value={selectedFont}
          onChange={(e) => { saveSelection(); applyFont(e.target.value); }}
          className={`rounded-lg border border-slate-300 bg-white px-1 text-xs font-medium text-slate-700 focus:border-primary focus:outline-none ${
            compact ? "h-6" : "h-8"
          }`}
          title="Font"
        >
          {fonts.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select
          value={selectedFontSize}
          onChange={(e) => { saveSelection(); applyFontSize(e.target.value); }}
          className={`rounded-lg border border-slate-300 bg-white px-1 text-xs font-medium text-slate-700 focus:border-primary focus:outline-none ${
            compact ? "h-6" : "h-8"
          }`}
          title="Font size"
        >
          {fontSizes.map((s) => <option key={s} value={String(s)}>{s}</option>)}
        </select>

        <Divider />

        {!compact && (
          <>
            {toolbarBtn(active.bold, "Bold", () => editor.chain().focus().toggleBold().run(), <Bold className="h-4 w-4" />)}
            {toolbarBtn(active.italic, "Italic", () => editor.chain().focus().toggleItalic().run(), <Italic className="h-4 w-4" />)}
            {toolbarBtn(active.underline, "Underline", () => editor.chain().focus().toggleUnderline().run(), <UnderlineIcon className="h-4 w-4" />)}
            {toolbarBtn(active.strike, "Strikethrough", () => editor.chain().focus().toggleStrike().run(), <Strikethrough className="h-4 w-4" />)}
            <Divider />
            {toolbarBtn(active.h1, "Heading 1", () => editor.chain().focus().toggleHeading({ level: 1 }).run(), <Heading1 className="h-4 w-4" />)}
            {toolbarBtn(active.h2, "Heading 2", () => editor.chain().focus().toggleHeading({ level: 2 }).run(), <Heading2 className="h-4 w-4" />)}
            <Divider />
            {toolbarBtn(editor.isActive({ textAlign: "left" }), "Align left", () => editor.chain().focus().setTextAlign("left").run(), <AlignLeft className="h-4 w-4" />)}
            {toolbarBtn(editor.isActive({ textAlign: "center" }), "Align center", () => editor.chain().focus().setTextAlign("center").run(), <AlignCenter className="h-4 w-4" />)}
            {toolbarBtn(editor.isActive({ textAlign: "right" }), "Align right", () => editor.chain().focus().setTextAlign("right").run(), <AlignRight className="h-4 w-4" />)}
            <Divider />
            {toolbarBtn(active.ul, "Bullet list", () => editor.chain().focus().toggleBulletList().run(), <List className="h-4 w-4" />)}
            {toolbarBtn(active.ol, "Numbered list", () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered className="h-4 w-4" />)}
            <Divider />
            <button
              type="button"
              title="Insert image"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <ImageIcon className="h-4 w-4" />
            </button>
          </>
        )}
        {toolbarBtn(false, "Insert equation", () => openNewMathModal(), <Sigma className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />, compact)}
        {toolbarBtn(false, "Gujarati converter", () => setIsConverterOpen(true), <Languages className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />, compact)}

        {!compact && (
          <span className="ml-auto flex gap-0.5">
            {toolbarBtn(false, "Clear formatting", () => editor.chain().focus().clearNodes().unsetAllMarks().run(), <RemoveFormatting className="h-4 w-4" />)}
            {toolbarBtn(false, "Undo", () => editor.chain().focus().undo().run(), <Undo2 className="h-4 w-4" />)}
            {toolbarBtn(false, "Redo", () => editor.chain().focus().redo().run(), <Redo2 className="h-4 w-4" />)}
          </span>
        )}
      </div>

      <EditorContent
        editor={editor}
        className={`rounded-b-xl border border-slate-300 bg-white focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 ${
          compact ? "px-2 py-1" : "p-3"
        }`}
        style={{ minHeight }}
      />
      {placeholder && !editor.state.doc.textContent && (
        <div className="pointer-events-none -mt-11 ml-4 select-none text-sm text-slate-400">{placeholder}</div>
      )}

      <input ref={fileInputRef} type="file" accept="image/png, image/jpeg, image/webp, image/gif" style={{ display: "none" }} onChange={handleFileChange} />

      {isMathModalOpen && (
        <MathEditorModal
          isOpen={isMathModalOpen}
          initialLatex={mathInitialLatex}
          initialDisplayMode={mathInitialDisplayMode}
          onClose={closeMathModal}
          onSubmit={handleMathSubmit}
        />
      )}

      <GujaratiConverterModal
        isOpen={isConverterOpen}
        onClose={() => setIsConverterOpen(false)}
        onInsert={handleConverterInsert}
        onReplaceSelection={handleConverterReplaceSelection}
      />
    </div>
  );
}

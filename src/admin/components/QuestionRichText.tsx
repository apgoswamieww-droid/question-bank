import { useEffect, type ReactNode } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";

interface QuestionRichTextProps {
  value: unknown;
  onChange: (value: { html: string }) => void;
  placeholder?: string;
  minHeight?: string;
  disabled?: boolean;
}

function toolbarBtn(active: boolean, title: string, onClick: () => void, children: ReactNode) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
        active ? "bg-primary text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

export function QuestionRichText({ value, onChange, placeholder, minHeight = "9rem", disabled }: QuestionRichTextProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: "",
    editorProps: { attributes: { class: "prose max-w-none focus:outline-none" } },
    editable: !disabled,
    onUpdate: ({ editor: ed }) => {
      onChange({ html: ed.getHTML() || "" });
    },
  });

  // Populate the editor when `value` changes (initial load / switching questions).
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const html = typeof value === "string" ? value : (value as { html?: string } | null)?.html ?? "";
    if (html === editor.getHTML() && editor.getHTML() !== "") return;
    editor.commands.setContent(html || "", { emitUpdate: false });
  }, [editor, value]);

  if (!editor) {
    return <div className="h-36 animate-pulse rounded-xl bg-slate-100" />;
  }

  return (
    <div className={disabled ? "pointer-events-none opacity-60" : undefined}>
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-xl border border-b-0 border-slate-300 bg-slate-50 px-1.5 py-1.5">
        {toolbarBtn(editor.isActive("bold"), "Bold", () => editor.chain().focus().toggleBold().run(), <Bold className="h-4 w-4" />)}
        {toolbarBtn(editor.isActive("italic"), "Italic", () => editor.chain().focus().toggleItalic().run(), <Italic className="h-4 w-4" />)}
        {toolbarBtn(editor.isActive("underline"), "Underline", () => editor.chain().focus().toggleUnderline().run(), <UnderlineIcon className="h-4 w-4" />)}
        {toolbarBtn(editor.isActive("heading", { level: 1 }), "Heading 1", () => editor.chain().focus().toggleHeading({ level: 1 }).run(), <Heading1 className="h-4 w-4" />)}
        {toolbarBtn(editor.isActive("heading", { level: 2 }), "Heading 2", () => editor.chain().focus().toggleHeading({ level: 2 }).run(), <Heading2 className="h-4 w-4" />)}
        <span className="mx-1 h-5 w-px bg-slate-200" />
        {toolbarBtn(editor.isActive({ textAlign: "left" }), "Align left", () => editor.chain().focus().setTextAlign("left").run(), <AlignLeft className="h-4 w-4" />)}
        {toolbarBtn(editor.isActive({ textAlign: "center" }), "Align center", () => editor.chain().focus().setTextAlign("center").run(), <AlignCenter className="h-4 w-4" />)}
        {toolbarBtn(editor.isActive({ textAlign: "right" }), "Align right", () => editor.chain().focus().setTextAlign("right").run(), <AlignRight className="h-4 w-4" />)}
        <span className="mx-1 h-5 w-px bg-slate-200" />
        {toolbarBtn(editor.isActive("bulletList"), "Bullet list", () => editor.chain().focus().toggleBulletList().run(), <List className="h-4 w-4" />)}
        {toolbarBtn(editor.isActive("orderedList"), "Ordered list", () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered className="h-4 w-4" />)}
        <span className="ml-auto flex gap-0.5">
          {toolbarBtn(false, "Undo", () => editor.chain().focus().undo().run(), <Undo2 className="h-4 w-4" />)}
          {toolbarBtn(false, "Redo", () => editor.chain().focus().redo().run(), <Redo2 className="h-4 w-4" />)}
        </span>
      </div>
      <EditorContent
        editor={editor}
        className="rounded-b-xl border border-slate-300 bg-white p-3 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10"
        style={{ minHeight }}
      />
      {placeholder && !editor.state.doc.textContent && (
        <div className="pointer-events-none -mt-11 ml-4 select-none text-sm text-slate-400">{placeholder}</div>
      )}
    </div>
  );
}

import { useRef, useState, useCallback } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";

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
import { FontMark } from "./extensions/FontMark";
import { MathEditorModal } from "./MathEditorModal";
import { PrintPreviewModal } from "./print/PrintPreviewModal";
import { ExamSettingsModal } from "./components/ExamSettingsModal";
import { GujaratiConverterModal } from "./components/GujaratiConverterModal";
import { KapAnalyzerReview } from "./components/KapAnalyzerReview";
import { AppHeader } from "./components/AppHeader";
import { DocumentToolbar } from "./components/DocumentToolbar";
import { EditorToolbar } from "./components/EditorToolbar";
import type { KapFont } from "./converter/types";

import { useToast } from "./hooks/useToast";
import { useAutoSave } from "./hooks/useAutoSave";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useWindowCloseHandler } from "./hooks/useWindowCloseHandler";
import { useRecentFiles } from "./hooks/useRecentFiles";
import { useMathModal } from "./hooks/useMathModal";
import { useFontMarks } from "./hooks/useFontMarks";
import { useDocumentManagement } from "./hooks/useDocumentManagement";
import { useKapAnalyzer } from "./hooks/useKapAnalyzer";

import "./index.css";

function App() {
  const { toastMessage, showToast } = useToast();
  const {
    recentFiles,
    isRecentOpen,
    setIsRecentOpen,
  } = useRecentFiles();

  const {
    isMathModalOpen,
    mathInitialLatex,
    mathInitialDisplayMode,
    mathUpdateCallback,
    handleOpenMathEditor,
    openNewMathModal,
    closeMathModal,
  } = useMathModal();

  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [isExamSettingsOpen, setIsExamSettingsOpen] = useState(false);
  const [isConverterOpen, setIsConverterOpen] = useState(false);
  const [isAnalyzerOpen, setIsAnalyzerOpen] = useState(false);

  const kapAnalyzer = useKapAnalyzer();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    filePath,
    docTitle,
    isDirty,
    autoSaveStatus,
    examMetadata,
    saveDocumentContent,
    handleSave,
    handleSaveAs,
    handleOpen,
    handleNew,
    handleSaveExamMetadata,
    markDirty,
  } = useDocumentManagement({ editor: null, showToast });

  useAutoSave({
    filePath,
    isDirty,
    onSave: saveDocumentContent,
    onStatusChange: () => {},
  });

  useWindowCloseHandler({ isDirty, onSave: handleSave });

  useKeyboardShortcuts({
    onSave: handleSave,
    onSaveAs: handleSaveAs,
    onNew: handleNew,
    onOpen: handleOpen,
  });

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
      markDirty();
    },
  });

  const { selectedFont, selectedFontSize, saveSelection, applyFont, applyFontSize } =
    useFontMarks(editor);

  const handleAlignment = useCallback(
    (alignment: "left" | "center" | "right" | "justify") => {
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
    },
    [editor]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
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
    },
    [editor]
  );

  const handleMathSubmit = useCallback(
    (latex: string, displayMode: boolean) => {
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
    },
    [editor, mathUpdateCallback]
  );

  const handleConverterInsert = useCallback(
    (kapText: string, font: KapFont) => {
      editor
        ?.chain()
        .focus()
        .insertContent({
          type: "text",
          text: kapText,
          marks: [{ type: "fontFamily", attrs: { fontFamily: font } }],
        })
        .run();
    },
    [editor]
  );

  const handleConverterReplaceSelection = useCallback(
    (kapText: string, font: KapFont) => {
      if (!editor) return;
      const { from, to } = editor.state.selection;
      const startMarks =
        editor.state.doc.resolve(from).marks() ??
        editor.state.storedMarks ??
        [];
      const preservedMarks = startMarks
        .filter((m) => m.type.name !== "fontFamily")
        .map((m) => ({ type: m.type.name, attrs: m.attrs }));

      editor
        .chain()
        .focus()
        .insertContentAt(
          { from, to },
          {
            type: "text",
            text: kapText,
            marks: [
              ...preservedMarks,
              { type: "fontFamily", attrs: { fontFamily: font } },
            ],
          }
        )
        .run();
    },
    [editor]
  );

  const handleOpenKapImporter = useCallback(() => {
    showToast(
      "KAP → Unicode Importer is not available in web mode. Run the desktop version for this tool."
    );
  }, [showToast]);

  if (!editor) {
    return null;
  }

  return (
    <div className="app">
      <AppHeader
        docTitle={docTitle}
        isDirty={isDirty}
        autoSaveStatus={autoSaveStatus}
      />

      {toastMessage && (
        <div className="toast-notification">{toastMessage}</div>
      )}

      <main className="editor-wrapper">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png, image/jpeg, image/webp, image/gif"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        <DocumentToolbar
          onNew={handleNew}
          onOpen={handleOpen}
          onSave={handleSave}
          onSaveAs={handleSaveAs}
          onExamSettings={() => setIsExamSettingsOpen(true)}
          onPrintPreview={() => setIsPrintPreviewOpen(true)}
          onOpenAnalyzer={() => setIsAnalyzerOpen(true)}
          onOpenKapImporter={handleOpenKapImporter}
          recentFiles={recentFiles}
          isRecentOpen={isRecentOpen}
          setIsRecentOpen={setIsRecentOpen}
        />

        <EditorToolbar
          editor={editor}
          selectedFont={selectedFont}
          selectedFontSize={selectedFontSize}
          saveSelection={saveSelection}
          applyFont={applyFont}
          applyFontSize={applyFontSize}
          onAlignment={handleAlignment}
          onInsertImage={() => fileInputRef.current?.click()}
          onInsertEquation={openNewMathModal}
          onOpenConverter={() => setIsConverterOpen(true)}
        />

        <EditorContent editor={editor} />
      </main>

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

      {isExamSettingsOpen && (
        <ExamSettingsModal
          isOpen
          onClose={() => setIsExamSettingsOpen(false)}
          metadata={examMetadata}
          onSave={handleSaveExamMetadata}
        />
      )}

      <PrintPreviewModal
        isOpen={isPrintPreviewOpen}
        onClose={() => setIsPrintPreviewOpen(false)}
        documentJSON={editor?.getJSON() || {}}
        documentTitle={docTitle}
        metadata={examMetadata}
      />

      <KapAnalyzerReview
        isOpen={isAnalyzerOpen}
        onClose={() => setIsAnalyzerOpen(false)}
        providerStatus={kapAnalyzer.status}
        selectedFont={kapAnalyzer.selectedFont}
        onFontChange={kapAnalyzer.setSelectedFont}
        onTestConnection={kapAnalyzer.testConnection}
        onAnalyzeFont={kapAnalyzer.analyzeFont}
        onCancelAnalysis={kapAnalyzer.cancelAnalysis}
        candidates={kapAnalyzer.candidates}
        sequenceCandidates={kapAnalyzer.sequenceCandidates}
        progress={kapAnalyzer.progress}
        isAnalyzing={kapAnalyzer.isAnalyzing}
        error={kapAnalyzer.error}
        onVerifyCandidate={kapAnalyzer.verifyCandidate}
        onRejectCandidate={kapAnalyzer.rejectCandidate}
        onEditCandidate={kapAnalyzer.editCandidate}
        onVerifySequence={kapAnalyzer.verifySequence}
        onExportVerified={kapAnalyzer.exportVerified}
      />
    </div>
  );
}

export default App;

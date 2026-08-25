import { useState, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import type { ExamMetadata } from "../types/examMetadata";
import { DEFAULT_EXAM_METADATA } from "../types/examMetadata";
import { migrateDocument } from "../utils/documentMigration";

const getErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : "Unknown error";

interface UseDocumentManagementOptions {
  editor: Editor | null;
  showToast: (msg: string) => void;
}

export function useDocumentManagement({
  editor,
  showToast,
}: UseDocumentManagementOptions) {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState<string>("Untitled Question Paper");
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [examMetadata, setExamMetadata] =
    useState<ExamMetadata>(DEFAULT_EXAM_METADATA);

  const saveDocumentContent = useCallback(
    async (targetPath: string): Promise<boolean> => {
      if (!editor || !window.electronAPI) return false;

      const title =
        targetPath
          .split(/[/\\]/)
          .pop()
          ?.replace(/\.qbank$/i, "") || docTitle;
      const docPayload = {
        format: "question-bank",
        version: 2,
        title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: examMetadata,
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
          return true;
        }
      } catch (err) {
        console.error("Save error:", err);
        setAutoSaveStatus("error");
        showToast(`Save failed: ${getErrorMessage(err)}`);
      }
      return false;
    },
    [editor, docTitle, examMetadata, showToast]
  );

  const handleSaveAs = useCallback(async (): Promise<boolean> => {
    if (!window.electronAPI) return false;
    try {
      const selectedPath = await window.electronAPI.saveFileDialog(docTitle);
      if (selectedPath) {
        return await saveDocumentContent(selectedPath);
      }
    } catch (err) {
      console.error("Save As error:", err);
      showToast(`Save As failed: ${getErrorMessage(err)}`);
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
          alert(
            "Unable to open this file.\n\nThe selected file is not a valid Question Bank document."
          );
          return;
        }

        const migrated = migrateDocument(parsed);

        editor.commands.setContent(migrated.content);
        setExamMetadata(migrated.metadata);
        setFilePath(targetPath);
        const name =
          targetPath
            .split(/[/\\]/)
            .pop()
            ?.replace(/\.qbank$/i, "") ||
          migrated.title ||
          "Untitled Document";
        setDocTitle(name);
        setIsDirty(false);
        setAutoSaveStatus("idle");
      } catch (err) {
        console.error("Parse document error:", err);
        alert(
          "Unable to open this file.\n\nFailed to parse Question Bank document JSON structure."
        );
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
        }
      } catch (err) {
        console.error("Open file path error:", err);
        showToast(`Failed to open file: ${getErrorMessage(err)}`);
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
      }
    } catch (err) {
      console.error("Open dialog error:", err);
      showToast(`Open failed: ${getErrorMessage(err)}`);
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

  const handleSaveExamMetadata = useCallback((updatedMetadata: ExamMetadata) => {
    setExamMetadata(updatedMetadata);
    setIsDirty(true);
  }, []);

  const markDirty = useCallback(() => {
    setIsDirty(true);
  }, []);

  return {
    filePath,
    docTitle,
    isDirty,
    autoSaveStatus,
    examMetadata,
    saveDocumentContent,
    handleSave,
    handleSaveAs,
    handleOpen,
    handleOpenPath,
    handleOpenContent,
    handleNew,
    handleSaveExamMetadata,
    markDirty,
  };
}

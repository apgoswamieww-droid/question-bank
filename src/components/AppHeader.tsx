interface AppHeaderProps {
  docTitle: string;
  isDirty: boolean;
  autoSaveStatus: "idle" | "saving" | "saved" | "error";
}

export function AppHeader({
  docTitle,
  isDirty,
  autoSaveStatus,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="header-left">
        <h1>Question Bank</h1>
        <div className="doc-title-badge">
          <span className="doc-title">{docTitle}</span>
          {isDirty && (
            <span className="dirty-badge" title="Unsaved changes">
              *
            </span>
          )}
        </div>
      </div>
      <div className="header-right">
        {autoSaveStatus === "saving" && (
          <span className="autosave-tag saving">Auto-saving...</span>
        )}
        {autoSaveStatus === "saved" && (
          <span className="autosave-tag saved">Auto-saved</span>
        )}
        {autoSaveStatus === "error" && (
          <span className="autosave-tag error">Auto-save failed</span>
        )}
      </div>
    </header>
  );
}

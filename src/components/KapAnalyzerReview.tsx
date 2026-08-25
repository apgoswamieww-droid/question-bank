import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  X,
  Search,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Info,
  Eye,
  Lock,
  Shield,
  Database,
  Play,
  Square,
  Download,
  Wifi,
  WifiOff,
  Settings,
} from "lucide-react";
import type { KapFont } from "../converter/types";
import { KAP_FONTS } from "../converter/types";
import type { AnalyzerCandidate, SequenceCandidate, AnalyzerProgress } from "../hooks/useKapAnalyzer";
import "./KapAnalyzerReview.css";

export interface KapAnalyzerReviewProps {
  isOpen: boolean;
  onClose: () => void;
  // Provider status
  providerStatus: {
    provider: string;
    model: string;
    apiKeyConfigured: boolean;
  } | null;
  // Font selection
  selectedFont: KapFont;
  onFontChange: (font: KapFont) => void;
  // Analysis actions
  onTestConnection: () => Promise<{ success: boolean; error?: string }>;
  onAnalyzeFont: (font: KapFont) => void;
  onCancelAnalysis: () => void;
  // Candidates
  candidates: AnalyzerCandidate[];
  sequenceCandidates: SequenceCandidate[];
  // Progress
  progress: AnalyzerProgress | null;
  isAnalyzing: boolean;
  error: string | null;
  // Candidate actions
  onVerifyCandidate: (candidate: AnalyzerCandidate) => void;
  onRejectCandidate: (candidate: AnalyzerCandidate) => void;
  onEditCandidate: (oldCandidate: AnalyzerCandidate, newUnicode: string) => void;
  onVerifySequence: (candidate: SequenceCandidate) => void;
  // Export
  onExportVerified: () => Promise<{ success: boolean; count?: number; error?: string }>;
}

type FilterStatus = "all" | "candidate" | "verified" | "rejected" | "unsure";
type FilterConfidence = "all" | "very_high" | "high" | "medium" | "low" | "very_low";

export const KapAnalyzerReview: React.FC<KapAnalyzerReviewProps> = ({
  isOpen,
  onClose,
  providerStatus,
  selectedFont,
  onFontChange,
  onTestConnection,
  onAnalyzeFont,
  onCancelAnalysis,
  candidates,
  sequenceCandidates,
  progress,
  isAnalyzing,
  error,
  onVerifyCandidate,
  onRejectCandidate,
  onEditCandidate,
  onVerifySequence,
  onExportVerified,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterConfidence, setFilterConfidence] = useState<FilterConfidence>("all");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [editUnicode, setEditUnicode] = useState("");
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; error?: string } | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Filter candidates
  const filteredCandidates = useMemo(() => {
    let filtered = candidates.filter(c => c.font === selectedFont);

    if (filterStatus !== "all") {
      filtered = filtered.filter(c => c.status === filterStatus);
    }

    if (filterConfidence !== "all") {
      filtered = filtered.filter(c => c.confidenceCategory === filterConfidence);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.unicode.toLowerCase().includes(query) ||
        c.hex.toLowerCase().includes(query) ||
        c.byte.toString().includes(query)
      );
    }

    return filtered;
  }, [candidates, selectedFont, filterStatus, filterConfidence, searchQuery]);

  // Current candidate
  const currentCandidate = filteredCandidates[currentIndex] ?? null;

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (editMode) return;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          setCurrentIndex(i => Math.max(0, i - 1));
          break;
        case "ArrowRight":
          e.preventDefault();
          setCurrentIndex(i => Math.min(filteredCandidates.length - 1, i + 1));
          break;
        case "Enter":
          e.preventDefault();
          if (currentCandidate) onVerifyCandidate(currentCandidate);
          break;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          if (currentCandidate) onRejectCandidate(currentCandidate);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, editMode, filteredCandidates.length, currentCandidate, onVerifyCandidate, onRejectCandidate]);

  // Note: Index reset is handled by the filter changes in the parent component

  const handleTestConnection = useCallback(async () => {
    setIsTestingConnection(true);
    setConnectionStatus(null);
    try {
      const result = await onTestConnection();
      setConnectionStatus(result);
    } catch (err) {
      setConnectionStatus({ success: false, error: err instanceof Error ? err.message : "Test failed" });
    } finally {
      setIsTestingConnection(false);
    }
  }, [onTestConnection]);

  const handleVerify = useCallback(() => {
    if (currentCandidate) {
      onVerifyCandidate(currentCandidate);
      setCurrentIndex(i => Math.min(filteredCandidates.length - 1, i + 1));
    }
  }, [currentCandidate, onVerifyCandidate, filteredCandidates.length]);

  const handleReject = useCallback(() => {
    if (currentCandidate) {
      onRejectCandidate(currentCandidate);
      setCurrentIndex(i => Math.min(filteredCandidates.length - 1, i + 1));
    }
  }, [currentCandidate, onRejectCandidate, filteredCandidates.length]);

  const handleEdit = useCallback(() => {
    if (currentCandidate) {
      setEditMode(true);
      setEditUnicode(currentCandidate.unicode);
    }
  }, [currentCandidate]);

  const handleSaveEdit = useCallback(() => {
    if (currentCandidate && editUnicode) {
      onEditCandidate(currentCandidate, editUnicode);
      setEditMode(false);
      setCurrentIndex(i => Math.min(filteredCandidates.length - 1, i + 1));
    }
  }, [currentCandidate, editUnicode, onEditCandidate, filteredCandidates.length]);

  const handleCancelEdit = useCallback(() => {
    setEditMode(false);
    setEditUnicode("");
  }, []);

  const handleExport = useCallback(async () => {
    const result = await onExportVerified();
    if (result.success) {
      alert(`Exported ${result.count} verified mappings`);
    } else {
      alert(`Export failed: ${result.error}`);
    }
  }, [onExportVerified]);

  if (!isOpen) return null;

  const stats = {
    total: filteredCandidates.length,
    verified: filteredCandidates.filter(c => c.status === "verified").length,
    rejected: filteredCandidates.filter(c => c.status === "rejected").length,
    candidate: filteredCandidates.filter(c => c.status === "candidate").length,
  };

  const verifiedCount = candidates.filter(c => c.status === "verified" && c.humanVerified).length;
  const rejectedCount = candidates.filter(c => c.status === "rejected").length;

  return (
    <div className="review-overlay" role="dialog" aria-modal="true" aria-label="KAP AI Analyzer">
      <div className="review-container review-container-wide">
        <div className="review-header">
          <div className="review-title">
            <Eye size={20} className="header-icon" />
            <h2>KAP AI Analyzer</h2>
          </div>
          <button type="button" className="btn-close-modal" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        <div className="review-body">
          {/* Privacy Notice */}
          {showPrivacyNotice && providerStatus?.provider === "openai" && (
            <div className="privacy-notice">
              <div className="privacy-notice-content">
                <Shield size={16} />
                <span>
                  <strong>Privacy Notice:</strong> Glyph images will be sent to {providerStatus.provider} ({providerStatus.model}) for analysis.
                  API keys are never exposed to the renderer process.
                </span>
              </div>
              <button
                type="button"
                className="btn-dismiss-notice"
                onClick={() => setShowPrivacyNotice(false)}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Provider Configuration */}
          <div className="provider-section">
            <div className="section-header">
              <Settings size={14} />
              <span>Provider Configuration</span>
            </div>
            <div className="provider-config">
              <div className="config-row">
                <span className="config-label">Provider:</span>
                <span className="config-value">{providerStatus?.provider || "Not configured"}</span>
              </div>
              <div className="config-row">
                <span className="config-label">Base URL:</span>
                <span className="config-value">{providerStatus?.baseUrl || "N/A"}</span>
              </div>
              <div className="config-row">
                <span className="config-label">Model:</span>
                <span className="config-value">{providerStatus?.model || "N/A"}</span>
              </div>
              <div className="config-row">
                <span className="config-label">API Key:</span>
                <span className={`config-value ${providerStatus?.apiKeyConfigured ? "configured" : "not-configured"}`}>
                  {providerStatus?.apiKeyConfigured ? `Configured (****${providerStatus.apiKeyLast4})` : "Not Configured"}
                </span>
              </div>
              <div className="config-actions">
                <button
                  type="button"
                  className="btn-action btn-test"
                  onClick={handleTestConnection}
                  disabled={isTestingConnection || !providerStatus?.apiKeyConfigured}
                >
                  {isTestingConnection ? (
                    <>Testing...</>
                  ) : connectionStatus?.success ? (
                    <><Wifi size={14} /> Connected</>
                  ) : (
                    <><WifiOff size={14} /> Test Connection</>
                  )}
                </button>
                {connectionStatus && (
                  <span className={`connection-status ${connectionStatus.success ? "success" : "error"}`}>
                    {connectionStatus.success ? "✓ Connected successfully" : connectionStatus.error}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Font Selection & Analysis Controls */}
          <div className="analysis-controls">
            <div className="control-row">
              <label htmlFor="font-select">Font:</label>
              <select
                id="font-select"
                className="review-select"
                value={selectedFont}
                onChange={e => onFontChange(e.target.value as KapFont)}
                disabled={isAnalyzing}
              >
                {KAP_FONTS.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>

              {!isAnalyzing ? (
                <button
                  type="button"
                  className="btn-action btn-analyze"
                  onClick={() => onAnalyzeFont(selectedFont)}
                  disabled={!providerStatus?.apiKeyConfigured}
                >
                  <Play size={14} /> Analyze Font
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-action btn-cancel"
                  onClick={onCancelAnalysis}
                >
                  <Square size={14} /> Cancel Analysis
                </button>
              )}

              <button
                type="button"
                className="btn-action btn-export"
                onClick={handleExport}
                disabled={verifiedCount === 0}
              >
                <Download size={14} /> Export Verified ({verifiedCount})
              </button>
            </div>

            {/* Progress */}
            {progress && isAnalyzing && (
              <div className="progress-section">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                  />
                </div>
                <div className="progress-stats">
                  <span>{progress.completed} / {progress.total}</span>
                  <span>Candidates: {progress.candidatesFound}</span>
                  <span>Verified: {verifiedCount}</span>
                  <span>Rejected: {rejectedCount}</span>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="error-message">
                <AlertTriangle size={14} />
                {error}
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="review-filters">
            <div className="filter-row">
              <label htmlFor="status-filter">Status:</label>
              <select
                id="status-filter"
                className="review-select"
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as FilterStatus)}
              >
                <option value="all">All</option>
                <option value="candidate">Candidate</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>

              <label htmlFor="confidence-filter">Confidence:</label>
              <select
                id="confidence-filter"
                className="review-select"
                value={filterConfidence}
                onChange={e => setFilterConfidence(e.target.value as FilterConfidence)}
              >
                <option value="all">All</option>
                <option value="very_high">Very High (90-100%)</option>
                <option value="high">High (75-89%)</option>
                <option value="medium">Medium (50-74%)</option>
                <option value="low">Low (25-49%)</option>
                <option value="very_low">Very Low (0-24%)</option>
              </select>

              <div className="search-box">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search byte/hex/Unicode..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="review-stats">
            <span>Total: {stats.total}</span>
            <span className="stat-verified">Verified: {stats.verified}</span>
            <span className="stat-rejected">Rejected: {stats.rejected}</span>
            <span className="stat-candidate">Candidate: {stats.candidate}</span>
          </div>

          {/* Main content */}
          <div className="review-content">
            {/* Left panel - Candidate details */}
            <div className="candidate-panel">
              {currentCandidate ? (
                <>
                  {/* Navigation */}
                  <div className="review-nav">
                    <button
                      type="button"
                      className="btn-nav"
                      onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                      disabled={currentIndex === 0}
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span className="nav-position">
                      {currentIndex + 1} of {filteredCandidates.length}
                    </span>
                    <button
                      type="button"
                      className="btn-nav"
                      onClick={() => setCurrentIndex(i => Math.min(filteredCandidates.length - 1, i + 1))}
                      disabled={currentIndex === filteredCandidates.length - 1}
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>

                  {/* Candidate details */}
                  <div className="candidate-details">
                    <div className="candidate-header">
                      <div className="byte-info">
                        <span className="hex">{currentCandidate.hex}</span>
                        <span className="decimal">Dec {currentCandidate.byte}</span>
                        <span className="glyph-name">{currentCandidate.glyphName || "unknown"}</span>
                      </div>
                      <div className={`confidence-badge ${currentCandidate.confidenceCategory}`}>
                        {Math.round(currentCandidate.confidence * 100)}%
                      </div>
                    </div>

                    {/* Glyph display */}
                    <div className="glyph-display">
                      <div className="glyph-image">
                        <img
                          src={`/mapping-data/glyph-dataset/${selectedFont}/${currentCandidate.hex}.png`}
                          alt={`Glyph for ${currentCandidate.hex}`}
                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      </div>
                      <div className="glyph-preview">
                        <span className="preview-label">Preview with {selectedFont}:</span>
                        <span
                          className="preview-char"
                          style={{ fontFamily: `"${selectedFont}", serif` }}
                        >
                          {String.fromCharCode(currentCandidate.byte)}
                        </span>
                      </div>
                    </div>

                    {/* AI Candidate Section */}
                    <div className="candidates-section">
                      <div className="section-label ai-label">
                        <Database size={14} />
                        <span>AI Candidate</span>
                      </div>
                      {editMode ? (
                        <div className="edit-form">
                          <input
                            type="text"
                            value={editUnicode}
                            onChange={e => setEditUnicode(e.target.value)}
                            placeholder="Enter Unicode character(s)"
                          />
                          <button type="button" className="btn-save" onClick={handleSaveEdit}>
                            Save
                          </button>
                          <button type="button" className="btn-cancel" onClick={handleCancelEdit}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="candidate-item">
                          <span className="candidate-unicode">{currentCandidate.unicode}</span>
                          <div className="candidate-details-inline">
                            <div className="detail-row">
                              <span className="detail-label">AI Confidence:</span>
                              <span className="detail-value">{Math.round(currentCandidate.confidence * 100)}%</span>
                            </div>
                            <div className="detail-row">
                              <span className="detail-label">Reasoning:</span>
                              <span className="detail-value reasoning">{currentCandidate.reasoning}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Human Verification Status */}
                    <div className="human-verification-section">
                      <div className="section-label human-label">
                        <Shield size={14} />
                        <span>Human Verified</span>
                      </div>
                      <div className="verification-status">
                        <span className={currentCandidate.humanVerified ? "verified" : "not-verified"}>
                          {currentCandidate.humanVerified ? "Yes" : "No"}
                        </span>
                        {!currentCandidate.humanVerified && (
                          <span className="verification-note">
                            Only human review can set this to "Yes"
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="candidate-metadata">
                      <div className="metadata-item">
                        <span className="metadata-label">Status:</span>
                        <span className={`status-badge status-${currentCandidate.status}`}>
                          {currentCandidate.status}
                        </span>
                      </div>
                      <div className="metadata-item">
                        <span className="metadata-label">Generated:</span>
                        <span>{new Date(currentCandidate.generatedAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="review-actions">
                    <button
                      type="button"
                      className="btn-action btn-verify"
                      onClick={handleVerify}
                      disabled={editMode || currentCandidate.status === "verified"}
                    >
                      <CheckCircle2 size={16} /> Verify
                    </button>
                    <button
                      type="button"
                      className="btn-action btn-reject"
                      onClick={handleReject}
                      disabled={editMode || currentCandidate.status === "rejected"}
                    >
                      <XCircle size={16} /> Reject
                    </button>
                    <button
                      type="button"
                      className="btn-action btn-edit"
                      onClick={handleEdit}
                      disabled={editMode}
                    >
                      Edit
                    </button>
                  </div>

                  {/* Keyboard shortcuts */}
                  <div className="keyboard-shortcuts">
                    <Info size={14} />
                    <span>Keyboard: ← → navigate | Enter verify | Del reject</span>
                  </div>
                </>
              ) : (
                <div className="no-candidates">
                  <AlertTriangle size={48} />
                  <h3>No candidates to review</h3>
                  <p>
                    {filteredCandidates.length === 0
                      ? "No candidates match the current filters."
                      : "All candidates have been reviewed."}
                  </p>
                </div>
              )}
            </div>

            {/* Right panel - Sequence Analysis */}
            <div className="sequence-panel">
              <div className="sequence-anchors-section">
                <div className="section-header">
                  <Lock size={14} />
                  <span>Sequence Analysis</span>
                </div>
                <div className="anchors-list">
                  {sequenceCandidates.map((candidate, idx) => (
                    <div key={idx} className={`anchor-item ${candidate.humanVerified ? "verified" : ""}`}>
                      <div className="anchor-kap">
                        <span className="anchor-label">KAP:</span>
                        <span className="anchor-value">{candidate.kap}</span>
                      </div>
                      <div className="anchor-arrow">↓</div>
                      <div className="anchor-unicode">
                        <span className="anchor-label">Unicode:</span>
                        <span className="anchor-value">{candidate.unicode}</span>
                      </div>
                      <div className="anchor-source">
                        <span className="anchor-label">Source:</span>
                        <span className="anchor-value">{candidate.source}</span>
                      </div>
                      <div className="anchor-verified">
                        <span className="anchor-label">Human Verified:</span>
                        <span className={candidate.humanVerified ? "verified" : "not-verified"}>
                          {candidate.humanVerified ? "Yes" : "No"}
                        </span>
                      </div>
                      {!candidate.humanVerified && (
                        <button
                          type="button"
                          className="btn-action btn-verify-small"
                          onClick={() => onVerifySequence(candidate)}
                        >
                          Verify
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

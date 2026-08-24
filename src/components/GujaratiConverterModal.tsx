import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  X,
  Languages,
  Copy,
  CornerDownLeft,
  Replace,
  ClipboardPaste,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { convertGujaratiUnicodeToKap } from "../converter/GujaratiUnicodeToKap";
import { getAllMappingStatuses, getMappingStatus } from "../converter/mappings";
import { containsGujarati, looksLikeLegacyKap } from "../converter/conversionUtils";
import type { ConversionResult, KapFont } from "../converter/types";
import { KAP_FONTS } from "../converter/types";
import "./GujaratiConverterModal.css";

export interface GujaratiConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Insert converted text at the cursor with the selected KAP FontMark. */
  onInsert: (kapText: string, font: KapFont) => void;
  /** Replace the current selection with converted text + KAP FontMark. */
  onReplaceSelection: (kapText: string, font: KapFont) => void;
}

function toCodePoints(text: string, limit = 120): string {
  return Array.from(text)
    .slice(0, limit)
    .map((ch) => `U+${ch.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0") ?? "??"}`)
    .join(" ");
}

export const GujaratiConverterModal: React.FC<GujaratiConverterModalProps> = ({
  isOpen,
  onClose,
  onInsert,
  onReplaceSelection,
}) => {
  const [font, setFont] = useState<KapFont>("KAP112");
  const [inputText, setInputText] = useState("");
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [fontAvailability, setFontAvailability] = useState<Record<string, boolean>>({});

  const mappingStatuses = useMemo(() => getAllMappingStatuses(), []);
  const status = isOpen ? getMappingStatus(font) : null;

  // §23 — distinguish "font failed to render" from "conversion failed".
  // Checked after document.fonts.ready so results reflect actual loading.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    document.fonts.ready
      .then(() => {
        if (cancelled) return;
        const availability: Record<string, boolean> = {};
        for (const f of KAP_FONTS) {
          try {
            availability[f] = document.fonts.check(`18px "${f}"`);
          } catch {
            availability[f] = false;
          }
        }
        setFontAvailability(availability);
      })
      .catch(() => {
        /* font API unavailable */
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const handleConvert = useCallback(() => {
    setPasteError(null);
    setResult(convertGujaratiUnicodeToKap(inputText, font));
  }, [inputText, font]);

  const handleCopy = useCallback(async () => {
    if (!result?.output) return;
    try {
      await navigator.clipboard.writeText(result.output);
      setCopied(true);
    } catch (err) {
      console.error("Clipboard write failed:", err);
      setPasteError("Clipboard access was blocked by the system.");
    }
  }, [result]);

  const handlePasteAndConvert = useCallback(async () => {
    setPasteError(null);
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) {
        setInputText(clip);
        setResult(convertGujaratiUnicodeToKap(clip, font));
      }
    } catch {
      setPasteError(
        "Could not read the clipboard. Paste into the input box manually (Ctrl+V)."
      );
    }
  }, [font]);

  if (!isOpen) return null;

  const hasOutput = !!result && result.output.length > 0;
  const canAct = hasOutput && result.mappingAvailable;
  const percent =
    result && result.totalGujaratiChars > 0
      ? Math.round((result.convertedChars / result.totalGujaratiChars) * 100)
      : result
        ? 100
        : null;

  let statusNode: React.ReactNode;
  if (!result) {
    statusNode = (
      <span className="status-line status-idle">Enter Unicode Gujarati and press Convert.</span>
    );
  } else if (!result.mappingAvailable) {
    statusNode = (
      <span className="status-line status-error">
        <AlertTriangle size={15} /> Unable to convert this text because the selected KAP mapping is
        not available.
      </span>
    );
  } else if (result.warnings.length > 0) {
    statusNode = (
      <span className="status-line status-warn">
        <AlertTriangle size={15} /> Converted {percent}% —{" "}
        {result.warnings.length} character
        {result.warnings.length === 1 ? "" : "s"} could not be converted.
      </span>
    );
  } else {
    statusNode = (
      <span className="status-line status-ok">
        <CheckCircle2 size={15} /> Conversion successful{percent !== null ? ` (${percent}%)` : ""}
      </span>
    );
  }

  const legacyHint =
    inputText.length > 3 && looksLikeLegacyKap(inputText)
      ? "This text may already be in legacy/KAP encoding."
      : null;
  const noGujaratiHint =
    inputText.length > 0 && !containsGujarati(inputText)
      ? "No Gujarati Unicode characters detected in the input."
      : null;

  return (
    <div className="converter-overlay" role="dialog" aria-modal="true" aria-label="Gujarati Converter">
      <div className="converter-container">
        <div className="converter-header">
          <div className="converter-title">
            <Languages size={20} className="header-icon" />
            <h2>Gujarati Converter</h2>
          </div>
          <button type="button" className="btn-close-modal" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        <div className="converter-body">
          <div className="form-row">
            <label htmlFor="kap-font-select">Target Font</label>
            <select
              id="kap-font-select"
              className="converter-select"
              value={font}
              onChange={(e) => setFont(e.target.value as KapFont)}
            >
              {KAP_FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                  {!getMappingStatus(f).loaded ? " (mapping pending)" : ""}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="btn-secondary"
              onClick={handlePasteAndConvert}
              title="Read clipboard, fill the input and convert"
            >
              <ClipboardPaste size={15} /> <span>Paste &amp; Convert</span>
            </button>
          </div>

          {status && !status.loaded && (
            <div className="hint-banner warn" role="status">
              <Info size={16} />
              <span>
                No verified {font} mapping table is loaded yet ({status.source}). The engine will
                not invent one — supply the table in src/converter/mappings/{font.toLowerCase()}
                .ts to enable conversion.
              </span>
            </div>
          )}

          {legacyHint && (
            <div className="hint-banner info" role="status">
              <Info size={16} /> <span>{legacyHint}</span>
            </div>
          )}
          {!legacyHint && noGujaratiHint && (
            <div className="hint-banner info" role="status">
              <Info size={16} /> <span>{noGujaratiHint}</span>
            </div>
          )}
          {pasteError && (
            <div className="hint-banner warn" role="alert">
              <AlertTriangle size={16} /> <span>{pasteError}</span>
            </div>
          )}

          <label className="field-label" htmlFor="kap-input">
            Unicode Gujarati Input
          </label>
          <textarea
            id="kap-input"
            className="converter-textarea"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="ગુજરાતી ભાષા..."
            spellCheck={false}
          />

          <div className="converter-actions">
            <button
              type="button"
              className="btn-convert"
              onClick={handleConvert}
              disabled={!inputText}
            >
              Convert
            </button>
          </div>

          <label className="field-label" htmlFor="kap-output">
            Converted KAP ASCII
          </label>
          <textarea
            id="kap-output"
            className="converter-textarea kap-output"
            readOnly
            value={result?.output ?? ""}
            placeholder=""
            spellCheck={false}
          />

          <div className="field-label">Rendered Preview ({font})</div>
          <div
            className="kap-preview-box"
            style={{ fontFamily: `"${font}", serif`, fontSize: 22 }}
            aria-label={`Preview rendered with ${font}`}
          >
            {result?.output || "\u00a0"}
          </div>

          {hasOutput && !fontAvailability[font] && (
            <div className="hint-banner warn" role="status">
              <AlertTriangle size={16} />
              <span>
                The {font} font file could not be loaded for preview rendering. The conversion data
                itself is unaffected.
              </span>
            </div>
          )}

          {statusNode}

          {result && result.warnings.length > 0 && (
            <details>
              <summary className="status-line status-warn" style={{ cursor: "pointer" }}>
                Show problematic characters ({result.warnings.length})
              </summary>
              <ul className="warning-list">
                {result.warnings.slice(0, 50).map((w, i) => (
                  <li key={i}>
                    Position {w.index}: “{w.input}” — {w.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <details className="dev-diagnostics">
            <summary>Developer diagnostics (code points)</summary>
            {result ? (
              <>
                {"Input:  "}
                {toCodePoints(result.input) || "(empty)"}
                {"\nOutput: "}
                {toCodePoints(result.output) || "(empty)"}
              </>
            ) : (
              "Run a conversion to inspect code points."
            )}
          </details>

          {mappingStatuses.every((m) => !m.loaded) && (
            <details className="dev-diagnostics">
              <summary>Mapping registry state</summary>
              {mappingStatuses.map((m) => `${m.font}: loaded=${m.loaded} rules=${m.ruleCount} (${m.source})`).join("\n")}
            </details>
          )}
        </div>

        <div className="converter-footer">
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn-secondary" onClick={handleCopy} disabled={!canAct}>
              <Copy size={15} /> <span>{copied ? "Copied!" : "Copy"}</span>
            </button>
            <button
              type="button"
              className="btn-secondary btn-insert"
              onClick={() => result && onInsert(result.output, font)}
              disabled={!canAct}
              title="Insert at cursor with the selected KAP font"
            >
              <CornerDownLeft size={15} /> <span>Insert</span>
            </button>
            <button
              type="button"
              className="btn-secondary btn-insert"
              onClick={() => result && onReplaceSelection(result.output, font)}
              disabled={!canAct}
              title="Replace the selected editor text with the converted output"
            >
              <Replace size={15} /> <span>Replace Selection</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

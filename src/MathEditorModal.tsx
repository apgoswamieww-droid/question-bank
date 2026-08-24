import React, { useState, useEffect, useRef } from "react";
import katex from "katex";
import { X, Check } from "lucide-react";

interface MathEditorModalProps {
  isOpen: boolean;
  initialLatex?: string;
  initialDisplayMode?: boolean;
  onClose: () => void;
  onSubmit: (latex: string, displayMode: boolean) => void;
}

const templates = [
  { label: "Fraction", latex: "\\frac{a}{b}", display: "a/b" },
  { label: "Power", latex: "x^{2}", display: "x²" },
  { label: "Subscript", latex: "x_{1}", display: "x₁" },
  { label: "Square Root", latex: "\\sqrt{x}", display: "√x" },
  { label: "Root N", latex: "\\sqrt[n]{x}", display: "ⁿ√x" },
  { label: "Parentheses", latex: "(a + b)", display: "(a+b)" },
  { label: "Brackets", latex: "[a + b]", display: "[a+b]" },
  { label: "Fraction Power", latex: "\\frac{x^{2} + 1}{x + 1}", display: "(x²+1)/(x+1)" },
  { label: "2x2 Matrix", latex: "\\begin{matrix} a & b \\\\ c & d \\end{matrix}", display: "Matrix" },
];

const greekSymbols = [
  { symbol: "α", latex: "\\alpha" },
  { symbol: "β", latex: "\\beta" },
  { symbol: "γ", latex: "\\gamma" },
  { symbol: "δ", latex: "\\delta" },
  { symbol: "θ", latex: "\\theta" },
  { symbol: "λ", latex: "\\lambda" },
  { symbol: "μ", latex: "\\mu" },
  { symbol: "π", latex: "\\pi" },
  { symbol: "σ", latex: "\\sigma" },
  { symbol: "φ", latex: "\\phi" },
  { symbol: "ω", latex: "\\omega" },
  { symbol: "Δ", latex: "\\Delta" },
  { symbol: "Θ", latex: "\\Theta" },
  { symbol: "Λ", latex: "\\Lambda" },
  { symbol: "Π", latex: "\\Pi" },
  { symbol: "Σ", latex: "\\Sigma" },
  { symbol: "Φ", latex: "\\Phi" },
  { symbol: "Ω", latex: "\\Omega" },
];

const mathOperators = [
  { symbol: "+", latex: "+" },
  { symbol: "-", latex: "-" },
  { symbol: "±", latex: "\\pm" },
  { symbol: "×", latex: "\\times" },
  { symbol: "÷", latex: "\\div" },
  { symbol: "=", latex: "=" },
  { symbol: "≠", latex: "\\neq" },
  { symbol: "<", latex: "<" },
  { symbol: ">", latex: ">" },
  { symbol: "≤", latex: "\\le" },
  { symbol: "≥", latex: "\\ge" },
  { symbol: "≈", latex: "\\approx" },
  { symbol: "∞", latex: "\\infty" },
  { symbol: "∑", latex: "\\sum_{i=1}^{n}" },
  { symbol: "∏", latex: "\\prod" },
  { symbol: "∫", latex: "\\int" },
  { symbol: "∂", latex: "\\partial" },
  { symbol: "°", latex: "^\\circ" },
  { symbol: "%", latex: "\\%" },
];

export const MathEditorModal: React.FC<MathEditorModalProps> = ({
  isOpen,
  initialLatex = "",
  initialDisplayMode = false,
  onClose,
  onSubmit,
}) => {
  const [latex, setLatex] = useState(initialLatex);
  const [displayMode, setDisplayMode] = useState(initialDisplayMode);
  const [activeTab, setActiveTab] = useState<"templates" | "greek" | "operators">("templates");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (previewRef.current && isOpen) {
      try {
        katex.render(latex || "\\text{Preview}", previewRef.current, {
          displayMode,
          throwOnError: false,
        });
      } catch {
        previewRef.current.innerText = latex;
      }
    }
  }, [latex, displayMode, isOpen]);

  if (!isOpen) return null;

  const insertSnippet = (snippet: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setLatex((prev) => prev + snippet);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const textBefore = latex.substring(0, start);
    const textAfter = latex.substring(end);

    const newText = textBefore + snippet + textAfter;
    setLatex(newText);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + snippet.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!latex.trim()) return;
    onSubmit(latex, displayMode);
    onClose();
  };

  return (
    <div className="math-modal-overlay" onClick={onClose}>
      <div className="math-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="math-modal-header">
          <h3>Mathematical Equation Editor</h3>
          <button type="button" className="close-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="math-modal-body">
          {/* Live Render Preview */}
          <div className="math-preview-box">
            <span className="math-preview-label">Live Preview:</span>
            <div
              ref={previewRef}
              className={`math-preview-content ${displayMode ? "is-display" : "is-inline"}`}
            />
          </div>

          {/* Mode Selection */}
          <div className="math-mode-selector">
            <label className="math-radio-label">
              <input
                type="radio"
                name="displayMode"
                checked={!displayMode}
                onChange={() => setDisplayMode(false)}
              />
              Inline Equation (Inside Text)
            </label>
            <label className="math-radio-label">
              <input
                type="radio"
                name="displayMode"
                checked={displayMode}
                onChange={() => setDisplayMode(true)}
              />
              Display Equation (Centered Block)
            </label>
          </div>

          {/* Symbol & Template Tabs */}
          <div className="math-tabs">
            <button
              type="button"
              className={activeTab === "templates" ? "active" : ""}
              onClick={() => setActiveTab("templates")}
            >
              Templates
            </button>
            <button
              type="button"
              className={activeTab === "greek" ? "active" : ""}
              onClick={() => setActiveTab("greek")}
            >
              Greek Symbols
            </button>
            <button
              type="button"
              className={activeTab === "operators" ? "active" : ""}
              onClick={() => setActiveTab("operators")}
            >
              Operators & Symbols
            </button>
          </div>

          {/* Palette Grid */}
          <div className="math-palette-grid">
            {activeTab === "templates" &&
              templates.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  className="palette-btn template-btn"
                  onClick={() => insertSnippet(tpl.latex)}
                  title={tpl.label}
                >
                  <span className="tpl-display">{tpl.display}</span>
                  <span className="tpl-label">{tpl.label}</span>
                </button>
              ))}

            {activeTab === "greek" &&
              greekSymbols.map((item) => (
                <button
                  key={item.latex}
                  type="button"
                  className="palette-btn symbol-btn"
                  onClick={() => insertSnippet(` ${item.latex} `)}
                  title={item.latex}
                >
                  {item.symbol}
                </button>
              ))}

            {activeTab === "operators" &&
              mathOperators.map((item) => (
                <button
                  key={item.latex}
                  type="button"
                  className="palette-btn symbol-btn"
                  onClick={() => insertSnippet(` ${item.latex} `)}
                  title={item.latex}
                >
                  {item.symbol}
                </button>
              ))}
          </div>

          {/* LaTeX Input */}
          <div className="math-input-group">
            <label htmlFor="latex-input">LaTeX Expression:</label>
            <textarea
              id="latex-input"
              ref={textareaRef}
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              placeholder="e.g. x^2 + 2x + 1 = 0"
              rows={3}
            />
          </div>

          {/* Modal Footer Actions */}
          <div className="math-modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!latex.trim()}>
              <Check size={16} />
              {initialLatex ? "Update Equation" : "Insert Equation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from "react";
import katex from "katex";
import { X, Check, AlertTriangle } from "lucide-react";

interface MathEditorModalProps {
  isOpen: boolean;
  initialLatex?: string;
  initialDisplayMode?: boolean;
  onClose: () => void;
  onSubmit: (latex: string, displayMode: boolean) => void;
}

type TabId = "templates" | "greek" | "operators" | "calculus" | "setsarrows";

interface Snippet {
  label: string;
  latex: string; // may contain a single "|" marking cursor position after insert
  display?: string; // rendered text shown on the button
}

const templates: Snippet[] = [
  { label: "Fraction", latex: "\\frac{|}{}", display: "a/b" },
  { label: "Big Fraction", latex: "\\dfrac{|}{}", display: "a/b" },
  { label: "Power", latex: "x^{|}", display: "x²" },
  { label: "Subscript", latex: "x_{|}", display: "x₁" },
  { label: "Square Root", latex: "\\sqrt{|}", display: "√x" },
  { label: "Root N", latex: "\\sqrt[|]{}", display: "ⁿ√x" },
  { label: "Binomial", latex: "\\binom{n}{|}", display: "(n k)" },
  { label: "Overline", latex: "\\overline{|}", display: "x̄" },
  { label: "Hat", latex: "\\hat{|}", display: "x̂" },
  { label: "Vector", latex: "\\vec{|}", display: "x⃗" },
  { label: "Limit", latex: "\\lim_{x \\to |}", display: "lim x→" },
  { label: "Parentheses", latex: "(a + b)", display: "(a+b)" },
  { label: "Brackets", latex: "[a + b]", display: "[a+b]" },
  {
    label: "2x2 Matrix",
    latex: "\\begin{matrix} | & b \\\\ c & d \\end{matrix}",
    display: "Matrix",
  },
  {
    label: "Paren Matrix",
    latex: "\\begin{pmatrix} | & b \\\\ c & d \\end{pmatrix}",
    display: "(Matrix)",
  },
  {
    label: "Piecewise",
    latex: "\\begin{cases} |, & x \\ge 0 \\\\ -x, & x < 0 \\end{cases}",
    display: "{cases}",
  },
  {
    label: "Aligned",
    latex: "\\begin{aligned} a &= | \\\\ b &= c \\end{aligned}",
    display: "aligned",
  },
];

const greekSymbols: Snippet[] = [
  { label: "\\alpha", latex: "\\alpha" },
  { label: "\\beta", latex: "\\beta" },
  { label: "\\gamma", latex: "\\gamma" },
  { label: "\\delta", latex: "\\delta" },
  { label: "\\epsilon", latex: "\\epsilon" },
  { label: "\\varepsilon", latex: "\\varepsilon" },
  { label: "\\zeta", latex: "\\zeta" },
  { label: "\\eta", latex: "\\eta" },
  { label: "\\theta", latex: "\\theta" },
  { label: "\\vartheta", latex: "\\vartheta" },
  { label: "\\iota", latex: "\\iota" },
  { label: "\\kappa", latex: "\\kappa" },
  { label: "\\lambda", latex: "\\lambda" },
  { label: "\\mu", latex: "\\mu" },
  { label: "\\nu", latex: "\\nu" },
  { label: "\\xi", latex: "\\xi" },
  { label: "\\pi", latex: "\\pi" },
  { label: "\\rho", latex: "\\rho" },
  { label: "\\sigma", latex: "\\sigma" },
  { label: "\\varsigma", latex: "\\varsigma" },
  { label: "\\tau", latex: "\\tau" },
  { label: "\\upsilon", latex: "\\upsilon" },
  { label: "\\phi", latex: "\\phi" },
  { label: "\\varphi", latex: "\\varphi" },
  { label: "\\chi", latex: "\\chi" },
  { label: "\\psi", latex: "\\psi" },
  { label: "\\omega", latex: "\\omega" },
  { label: "\\Gamma", latex: "\\Gamma" },
  { label: "\\Delta", latex: "\\Delta" },
  { label: "\\Theta", latex: "\\Theta" },
  { label: "\\Lambda", latex: "\\Lambda" },
  { label: "\\Xi", latex: "\\Xi" },
  { label: "\\Pi", latex: "\\Pi" },
  { label: "\\Sigma", latex: "\\Sigma" },
  { label: "\\Upsilon", latex: "\\Upsilon" },
  { label: "\\Phi", latex: "\\Phi" },
  { label: "\\Psi", latex: "\\Psi" },
  { label: "\\Omega", latex: "\\Omega" },
];

const mathOperators: Snippet[] = [
  { label: "+", latex: "+" },
  { label: "-", latex: "-" },
  { label: "\\pm", latex: "\\pm" },
  { label: "\\mp", latex: "\\mp" },
  { label: "\\times", latex: "\\times" },
  { label: "\\div", latex: "\\div" },
  { label: "\\cdot", latex: "\\cdot" },
  { label: "=", latex: "=" },
  { label: "\\neq", latex: "\\neq" },
  { label: "<", latex: "<" },
  { label: ">", latex: ">" },
  { label: "\\le", latex: "\\le" },
  { label: "\\ge", latex: "\\ge" },
  { label: "\\ll", latex: "\\ll" },
  { label: "\\gg", latex: "\\gg" },
  { label: "\\approx", latex: "\\approx" },
  { label: "\\equiv", latex: "\\equiv" },
  { label: "\\propto", latex: "\\propto" },
  { label: "\\sim", latex: "\\sim" },
  { label: "\\neg", latex: "\\neg" },
  { label: "\\land", latex: "\\land" },
  { label: "\\lor", latex: "\\lor" },
  { label: "\\oplus", latex: "\\oplus" },
  { label: "\\infty", latex: "\\infty" },
  { label: "\\partial", latex: "\\partial" },
  { label: "\\nabla", latex: "\\nabla" },
  { label: "^\\circ (degree)", latex: "^{\\circ}" },
  { label: "%", latex: "\\%" },
  { label: "\\sin", latex: "\\sin" },
  { label: "\\cos", latex: "\\cos" },
  { label: "\\tan", latex: "\\tan" },
  { label: "\\cot", latex: "\\cot" },
  { label: "\\sec", latex: "\\sec" },
  { label: "\\cosec", latex: "\\cosec" },
  { label: "\\log", latex: "\\log" },
  { label: "\\ln", latex: "\\ln" },
  { label: "\\exp", latex: "\\exp" },
];

const calculusSnippets: Snippet[] = [
  { label: "\\sum_{i=1}^{n}", latex: "\\sum_{i=1}^{n}|", display: "∑ⁿᵢ₌₁" },
  { label: "\\prod_{i=1}^{n}", latex: "\\prod_{i=1}^{n}|", display: "∏ⁿᵢ₌₁" },
  { label: "\\int_a^b", latex: "\\int_{a}^{b}|", display: "∫ₐᵇ" },
  { label: "\\int f(x)dx", latex: "\\int f(x)\\,dx|", display: "∫f dx" },
  { label: "\\iint", latex: "\\iint|", display: "∬" },
  { label: "\\iiint", latex: "\\iiint|", display: "∭" },
  { label: "\\oint", latex: "\\oint|", display: "∮" },
  { label: "\\lim_{h \\to 0}", latex: "\\lim_{h \\to 0}|", display: "lim h→0" },
  { label: "dy/dx", latex: "\\frac{dy}{dx}|", display: "dy/dx" },
  { label: "second deriv", latex: "\\frac{d^{2}y}{dx^{2}}|", display: "d²y/dx²" },
  { label: "\\partial f/\\partial x", latex: "\\frac{\\partial f}{\\partial x}|", display: "∂f/∂x" },
];

const setsArrowsSnippets: Snippet[] = [
  { label: "\\to", latex: "\\to" },
  { label: "\\Rightarrow", latex: "\\Rightarrow" },
  { label: "\\Leftrightarrow", latex: "\\Leftrightarrow" },
  { label: "\\leftrightarrow", latex: "\\leftrightarrow" },
  { label: "\\mapsto", latex: "\\mapsto" },
  { label: "\\in", latex: "\\in" },
  { label: "\\notin", latex: "\\notin" },
  { label: "\\ni", latex: "\\ni" },
  { label: "\\subset", latex: "\\subset" },
  { label: "\\subseteq", latex: "\\subseteq" },
  { label: "\\supset", latex: "\\supset" },
  { label: "\\supseteq", latex: "\\supseteq" },
  { label: "\\cup", latex: "\\cup" },
  { label: "\\cap", latex: "\\cap" },
  { label: "\\emptyset", latex: "\\emptyset" },
  { label: "\\forall", latex: "\\forall" },
  { label: "\\exists", latex: "\\exists" },
  { label: "\\therefore", latex: "\\therefore" },
  { label: "\\perp", latex: "\\perp" },
  { label: "\\parallel", latex: "\\parallel" },
  { label: "ℝ", latex: "\\mathbb{R}" },
  { label: "ℕ", latex: "\\mathbb{N}" },
  { label: "ℤ", latex: "\\mathbb{Z}" },
  { label: "ℚ", latex: "\\mathbb{Q}" },
  { label: "ℂ", latex: "\\mathbb{C}" },
];

const tabs: { id: TabId; label: string }[] = [
  { id: "templates", label: "Templates" },
  { id: "greek", label: "Greek" },
  { id: "operators", label: "Operators" },
  { id: "calculus", label: "Calculus" },
  { id: "setsarrows", label: "Sets & Arrows" },
];

const glyphCache = new Map<string, string>();
const getGlyphHtml = (latexCmd: string): string => {
  const key = latexCmd.replace("|", "").trim();
  let html = glyphCache.get(key);
  if (html === undefined) {
    try {
      html = katex.renderToString(key, { throwOnError: false });
    } catch {
      html = key;
    }
    glyphCache.set(key, html);
  }
  return html;
};

export const MathEditorModal: React.FC<MathEditorModalProps> = ({
  isOpen,
  initialLatex = "",
  initialDisplayMode = false,
  onClose,
  onSubmit,
}) => {
  const [latex, setLatex] = useState(initialLatex);
  const [displayMode, setDisplayMode] = useState(initialDisplayMode);
  const [activeTab, setActiveTab] = useState<TabId>("templates");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // The modal is mounted fresh for each open (conditional mount in App.tsx),
  // so state initializers above are the reset logic.

  // Focus the LaTeX input once on mount.
  useEffect(() => {
    const id = window.setTimeout(() => textareaRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, []);

  // Pure derivation: preview HTML + parse error are computed per render.
  let previewHtml: string;
  let parseError: string | null = null;
  try {
    previewHtml = katex.renderToString(latex.trim() || "\\text{Preview}", {
      displayMode,
      throwOnError: true,
    });
  } catch (err) {
    previewHtml = katex.renderToString(latex.trim() || "\\text{Preview}", {
      displayMode,
      throwOnError: false,
    });
    parseError = err instanceof Error ? err.message : "Invalid LaTeX expression";
  }

  const doSubmit = () => {
    if (!latex.trim()) return;
    onSubmit(latex.trim(), displayMode);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        doSubmit();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (!isOpen) return null;

  const insertSnippet = (snippet: string) => {
    const textarea = textareaRef.current;
    const cursorMark = snippet.indexOf("|");
    const cleanSnippet = snippet.replace("|", "");
    const start = textarea?.selectionStart ?? latex.length;
    const end = textarea?.selectionEnd ?? latex.length;

    const newText =
      latex.substring(0, start) + cleanSnippet + latex.substring(end);
    setLatex(newText);

    window.setTimeout(() => {
      textarea?.focus();
      if (textarea) {
        const caret = start + (cursorMark === -1 ? cleanSnippet.length : cursorMark);
        textarea.setSelectionRange(caret, caret);
      }
    }, 10);
  };

  const renderPaletteButton = (item: Snippet, isTemplate: boolean) => (
    <button
      key={item.label}
      type="button"
      className={`palette-btn ${isTemplate ? "template-btn" : "symbol-btn"}`}
      onClick={() =>
        isTemplate ? insertSnippet(item.latex) : insertSnippet(` ${item.latex} `)
      }
      title={item.label}
    >
      {isTemplate ? (
        <span className="tpl-display">{item.display ?? item.label}</span>
      ) : (
        <span
          className="symbol-glyph"
          dangerouslySetInnerHTML={{ __html: getGlyphHtml(item.latex) }}
        />
      )}
      {isTemplate && <span className="tpl-label">{item.label}</span>}
    </button>
  );

  return (
    <div className="math-modal-overlay" onClick={onClose}>
      <div className="math-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="math-modal-header">
          <h3>Mathematical Equation Editor</h3>
          <button type="button" className="close-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            doSubmit();
          }}
          className="math-modal-body"
        >
          {/* Live Render Preview */}
          <div className="math-preview-box">
            <span className="math-preview-label">Live Preview:</span>
            <div
              className={`math-preview-content ${displayMode ? "is-display" : "is-inline"}`}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>

          {parseError && latex.trim() !== "" && (
            <div className="math-error-strip" role="alert">
              <AlertTriangle size={14} />
              <span>{parseError}</span>
            </div>
          )}

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
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id ? "active" : ""}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Palette Grid */}
          <div className="math-palette-grid">
            {activeTab === "templates" &&
              templates.map((tpl) => renderPaletteButton(tpl, true))}
            {activeTab === "greek" &&
              greekSymbols.map((item) => renderPaletteButton(item, false))}
            {activeTab === "operators" &&
              mathOperators.map((item) => renderPaletteButton(item, false))}
            {activeTab === "calculus" &&
              calculusSnippets.map((item) => renderPaletteButton(item, false))}
            {activeTab === "setsarrows" &&
              setsArrowsSnippets.map((item) => renderPaletteButton(item, false))}
          </div>

          {/* LaTeX Input */}
          <div className="math-input-group">
            <label htmlFor="latex-input">LaTeX Expression:</label>
            <textarea
              id="latex-input"
              ref={textareaRef}
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              placeholder="e.g. x^2 + 2x + 1 = 0   —  press Ctrl+Enter to insert"
              rows={3}
            />
          </div>

          {/* Modal Footer Actions */}
          <div className="math-modal-footer">
            <span className="math-kbd-hint">
              <kbd>Esc</kbd> close &nbsp;·&nbsp; <kbd>Ctrl</kbd>+<kbd>↵</kbd> insert
            </span>
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

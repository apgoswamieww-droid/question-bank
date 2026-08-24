import React from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import "./print.css";
import type { PrintDocumentProps, PrintNode } from "./types";

export const PrintDocument: React.FC<PrintDocumentProps> = ({
  content,
  title = "Question Bank Document",
  settings = {
    paperSize: "A4",
    orientation: "portrait",
    marginTop: 15,
    marginRight: 15,
    marginBottom: 15,
    marginLeft: 15,
    showPageNumbers: true,
  },
  metadata,
}) => {
  if (!content || !content.content) {
    return (
      <div className="print-paper-page">
        <p>No document content available to print.</p>
      </div>
    );
  }

  const renderMarks = (text: string, marks?: PrintNode["marks"]) => {
    if (!marks || marks.length === 0) return text;

    const style: React.CSSProperties = {};
    let isBold = false;
    let isItalic = false;
    let isUnderline = false;

    marks.forEach((m) => {
      if (m.type === "fontFamily" && m.attrs) {
        if (m.attrs.fontFamily) {
          style.fontFamily = `"${String(m.attrs.fontFamily)}", system-ui, sans-serif`;
        }
        if (m.attrs.fontSize) {
          style.fontSize = String(m.attrs.fontSize);
        }
      }
      if (m.type === "bold") isBold = true;
      if (m.type === "italic") isItalic = true;
      if (m.type === "underline") isUnderline = true;
    });

    let element: React.ReactNode = text;
    if (isBold) element = <strong>{element}</strong>;
    if (isItalic) element = <em>{element}</em>;
    if (isUnderline) element = <u>{element}</u>;

    if (Object.keys(style).length > 0) {
      element = <span style={style}>{element}</span>;
    }

    return element;
  };

  const renderNodeChildren = (children?: PrintNode[]): React.ReactNode[] => {
    if (!children) return [];
    return children.map((child, index) => renderNode(child, index));
  };

  const renderNode = (node: PrintNode, key: number | string): React.ReactNode => {
    if (!node) return null;

    switch (node.type) {
      case "text":
        return (
          <React.Fragment key={key}>
            {renderMarks(node.text ?? "", node.marks)}
          </React.Fragment>
        );

      case "paragraph": {
        const textAlign = (node.attrs?.textAlign as React.CSSProperties["textAlign"] | undefined) || "left";
        return (
          <p key={key} style={{ textAlign }}>
            {renderNodeChildren(node.content)}
          </p>
        );
      }

      case "heading": {
        const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 6);
        const textAlign = (node.attrs?.textAlign as React.CSSProperties["textAlign"] | undefined) || "left";
        const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
        return (
          <Tag key={key} style={{ textAlign }}>
            {renderNodeChildren(node.content)}
          </Tag>
        );
      }

      case "bulletList":
        return <ul key={key}>{renderNodeChildren(node.content)}</ul>;

      case "orderedList":
        return <ol key={key}>{renderNodeChildren(node.content)}</ol>;

      case "listItem":
        return <li key={key}>{renderNodeChildren(node.content)}</li>;

      case "hardBreak":
        return <br key={key} />;

      case "horizontalRule":
        return <hr key={key} style={{ margin: "16px 0", border: "0.5px solid #cbd5e1" }} />;

      case "mathNode": {
        const latex = typeof node.attrs?.latex === "string" ? node.attrs.latex : "";
        const displayMode = !!node.attrs?.displayMode;

        try {
          const html = katex.renderToString(latex, {
            displayMode,
            throwOnError: false,
          });

          return (
            <span
              key={key}
              className={displayMode ? "print-math-block" : "print-math-inline"}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return (
            <span key={key} className="print-math-inline" style={{ color: "red" }}>
              [{latex}]
            </span>
          );
        }
      }

      case "resizableImage": {
        const src = typeof node.attrs?.src === "string" ? node.attrs.src : undefined;
        const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
        const width =
          typeof node.attrs?.width === "string" ? node.attrs.width : "300px";
        const alignment =
          typeof node.attrs?.alignment === "string" ? node.attrs.alignment : "center";

        if (!src) return null;

        return (
          <div key={key} className={`print-image-wrapper align-${alignment}`}>
            <img src={src} alt={alt} style={{ width, maxWidth: "100%", height: "auto" }} />
          </div>
        );
      }

      case "questionBlock": {
        const children = node.content || [];
        const questionTextNode = children.find((c) => c.type === "questionText");
        const optionsNodes = children.filter((c) => c.type === "questionOption");
        const footerNode = children.find((c) => c.type === "questionFooter");

        return (
          <div key={key} className="print-question-block">
            <div className="print-question-header" />
            <div className="print-question-text">
              {renderNodeChildren(questionTextNode?.content)}
            </div>

            {optionsNodes.length > 0 && (
              <div className="print-question-options">
                {optionsNodes.map((optNode, optIdx) => {
                  const label =
                    (optNode.attrs?.label as string | undefined) ||
                    String.fromCharCode(65 + optIdx);
                  return (
                    <div key={optIdx} className="print-question-option">
                      <span className="print-option-label">({label})</span>
                      <div className="print-option-content">
                        {renderNodeChildren(optNode.content)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {footerNode && (
              <div className="print-question-footer">
                {footerNode.content?.map((fChild, fIdx) => {
                  if (fChild.type === "questionAnswer") {
                    return (
                      <div key={fIdx} className="print-footer-item">
                        <strong>Answer: </strong>
                        {renderNodeChildren(fChild.content)}
                      </div>
                    );
                  }
                  if (fChild.type === "questionMarks") {
                    return (
                      <div key={fIdx} className="print-footer-item">
                        <strong>Marks: </strong>
                        {renderNodeChildren(fChild.content)}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            )}
          </div>
        );
      }

      default:
        if (node.content) {
          return <React.Fragment key={key}>{renderNodeChildren(node.content)}</React.Fragment>;
        }
        return null;
    }
  };

  const pageStyle: React.CSSProperties = {
    paddingTop: `${settings.marginTop}mm`,
    paddingRight: `${settings.marginRight}mm`,
    paddingBottom: `${settings.marginBottom}mm`,
    paddingLeft: `${settings.marginLeft}mm`,
  };

  return (
    <div className="print-paper-container">
      <div className="print-paper-page" style={pageStyle}>
        {/* Exam Header Block */}
        <div className="print-exam-header">
          {metadata?.logo?.src && (
            <div
              className="print-logo-wrapper"
              style={{ textAlign: metadata.logo.alignment }}
            >
              <img
                src={metadata.logo.src}
                alt="Institute Logo"
                style={{ width: `${metadata.logo.width}px`, maxHeight: "120px" }}
              />
            </div>
          )}

          <h1>{metadata?.instituteName || "Question Bank Paper"}</h1>
          {metadata?.examTitle && (
            <h2 className="print-exam-subtitle">{metadata.examTitle}</h2>
          )}

          <div className="exam-sub-info">
            <span>Subject: {metadata?.subject || "General"}</span>
            <span>Class: {metadata?.standard || "N/A"}</span>
            {metadata?.academicYear && <span>Year: {metadata.academicYear}</span>}
            <span>Date: {metadata?.date || "N/A"}</span>
            <span>Time: {metadata?.timeAllowed || "2 Hours"}</span>
            <span>Total Marks: {metadata?.totalMarks ?? "N/A"}</span>
          </div>
        </div>

        {/* General Instructions Section */}
        {metadata?.instructions && metadata.instructions.length > 0 && (
          <div className="print-instructions-box">
            <h3 className="instructions-heading">General Instructions:</h3>
            <ul>
              {metadata.instructions.map((inst, idx) => (
                <li key={idx}>{inst}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Sections Overview (If Configured) */}
        {metadata?.sections && metadata.sections.length > 0 && (
          <div className="print-sections-container">
            {metadata.sections.map((sec) => (
              <div key={sec.id} className="print-section-divider">
                <div className="print-section-header-bar">
                  <span className="print-section-title">{sec.title}</span>
                  {sec.marks !== null && sec.marks !== undefined && (
                    <span className="print-section-marks">[{sec.marks} Marks]</span>
                  )}
                </div>
                {sec.description && (
                  <p className="print-section-desc">{sec.description}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Document Questions Body */}
        <div className="print-document-body">
          {renderNodeChildren(content.content)}
        </div>

        {settings.showPageNumbers && (
          <div className="print-page-footer">
            <span>{title}</span>
            <span>Page 1</span>
          </div>
        )}
      </div>
    </div>
  );
};

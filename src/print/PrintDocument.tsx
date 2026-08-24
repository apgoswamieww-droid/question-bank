import React from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import "./print.css";
import type { PrintDocumentProps } from "./types";

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
  headerData,
}) => {
  if (!content || !content.content) {
    return (
      <div className="print-paper-page">
        <p>No document content available to print.</p>
      </div>
    );
  }

  const renderMarks = (text: string, marks?: any[]) => {
    if (!marks || marks.length === 0) return text;

    let style: React.CSSProperties = {};
    let isBold = false;
    let isItalic = false;
    let isUnderline = false;

    marks.forEach((m) => {
      if (m.type === "fontFamily" && m.attrs) {
        if (m.attrs.fontFamily) {
          style.fontFamily = `"${m.attrs.fontFamily}", system-ui, sans-serif`;
        }
        if (m.attrs.fontSize) {
          style.fontSize = m.attrs.fontSize;
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

  const renderNodeChildren = (children?: any[]): React.ReactNode[] => {
    if (!children) return [];
    return children.map((child, index) => renderNode(child, index));
  };

  const renderNode = (node: any, key: number | string): React.ReactNode => {
    if (!node) return null;

    switch (node.type) {
      case "text":
        return <React.Fragment key={key}>{renderMarks(node.text, node.marks)}</React.Fragment>;

      case "paragraph": {
        const textAlign = node.attrs?.textAlign || "left";
        return (
          <p key={key} style={{ textAlign }}>
            {renderNodeChildren(node.content)}
          </p>
        );
      }

      case "heading": {
        const level = node.attrs?.level || 1;
        const textAlign = node.attrs?.textAlign || "left";
        const Tag = `h${level}` as keyof JSX.IntrinsicElements;
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
        const latex = node.attrs?.latex || "";
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
        } catch (err) {
          return (
            <span key={key} className="print-math-inline" style={{ color: "red" }}>
              [{latex}]
            </span>
          );
        }
      }

      case "resizableImage": {
        const src = node.attrs?.src;
        const alt = node.attrs?.alt || "";
        const width = node.attrs?.width || "300px";
        const alignment = node.attrs?.alignment || "center";

        if (!src) return null;

        return (
          <div key={key} className={`print-image-wrapper align-${alignment}`}>
            <img src={src} alt={alt} style={{ width, maxWidth: "100%", height: "auto" }} />
          </div>
        );
      }

      case "questionBlock": {
        const children = node.content || [];
        const questionTextNode = children.find((c: any) => c.type === "questionText");
        const optionsNodes = children.filter((c: any) => c.type === "questionOption");
        const footerNode = children.find((c: any) => c.type === "questionFooter");

        return (
          <div key={key} className="print-question-block">
            <div className="print-question-header" />
            <div className="print-question-text">
              {renderNodeChildren(questionTextNode?.content)}
            </div>

            {optionsNodes.length > 0 && (
              <div className="print-question-options">
                {optionsNodes.map((optNode: any, optIdx: number) => {
                  const label = optNode.attrs?.label || String.fromCharCode(65 + optIdx);
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
                {footerNode.content?.map((fChild: any, fIdx: number) => {
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
        <div className="print-exam-header">
          <h1>{headerData?.instituteName || "Question Paper"}</h1>
          {headerData?.examTitle && (
            <h2 style={{ fontSize: "14pt", margin: "4px 0", color: "#334155" }}>
              {headerData.examTitle}
            </h2>
          )}
          <div className="exam-sub-info">
            <span>Subject: {headerData?.subject || "General"}</span>
            <span>Standard/Class: {headerData?.standardClass || "N/A"}</span>
            <span>Time: {headerData?.timeAllowed || "2 Hours"}</span>
            <span>Total Marks: {headerData?.totalMarks || "100"}</span>
          </div>
        </div>

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

import React, { useState, useRef } from "react";
import { PrintDocument } from "./PrintDocument";
import type { PrintSettings, ExamHeaderData } from "./types";
import {
  Printer,
  FileDown,
  X,
  ZoomIn,
  ZoomOut,
  Sliders,
} from "lucide-react";

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentJSON: any;
  documentTitle: string;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  documentJSON,
  documentTitle,
}) => {
  const [zoom, setZoom] = useState<number>(100);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [settings, setSettings] = useState<PrintSettings>({
    paperSize: "A4",
    orientation: "portrait",
    marginTop: 15,
    marginRight: 15,
    marginBottom: 15,
    marginLeft: 15,
    showPageNumbers: true,
  });

  const [headerData, setHeaderData] = useState<ExamHeaderData>({
    instituteName: "Question Bank Exam Paper",
    examTitle: "Unit Test / Final Assessment",
    subject: "General",
    standardClass: "Std 10",
    timeAllowed: "2 Hours",
    totalMarks: "50",
  });

  const printContainerRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 25, 150));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 25, 50));
  };

  const getFullHtmlForPrint = (): string => {
    if (!printContainerRef.current) return "";
    const contentHtml = printContainerRef.current.innerHTML;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${documentTitle}</title>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.18.4/dist/katex.min.css" />
          <style>
            @page {
              size: A4 portrait;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
            }
            /* Embedded KAP Fonts for PDF window */
            @font-face { font-family: "KAP110"; src: url("fonts/KAP110.ttf") format("truetype"); }
            @font-face { font-family: "KAP111"; src: url("fonts/KAP111.ttf") format("truetype"); }
            @font-face { font-family: "KAP112"; src: url("fonts/KAP112.ttf") format("truetype"); }
            @font-face { font-family: "KAP122"; src: url("fonts/KAP122.ttf") format("truetype"); }

            .print-paper-container { background: #fff; font-family: "Times New Roman", Times, serif; font-size: 14pt; }
            .print-paper-page { width: 210mm; min-height: 297mm; padding: ${settings.marginTop}mm ${settings.marginRight}mm ${settings.marginBottom}mm ${settings.marginLeft}mm; box-sizing: border-box; margin: 0 auto; page-break-after: always; position: relative; }
            .print-exam-header { border-bottom: 2px solid #1e293b; padding-bottom: 12px; margin-bottom: 20px; text-align: center; }
            .print-exam-header h1 { font-size: 20pt; font-weight: 700; margin: 0 0 6px 0; text-transform: uppercase; }
            .print-exam-header .exam-sub-info { display: flex; justify-content: space-between; font-size: 11pt; font-weight: 600; color: #334155; margin-top: 8px; }
            .print-document-body { counter-reset: printQuestionCounter; }
            .print-question-block { counter-increment: printQuestionCounter; margin-bottom: 18px; page-break-inside: avoid; break-inside: avoid; }
            .print-question-header { font-weight: 700; font-size: 14pt; margin-bottom: 6px; }
            .print-question-header::before { content: "Q." counter(printQuestionCounter) " "; font-weight: 700; }
            .print-question-options { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin-left: 20px; margin-bottom: 10px; }
            .print-question-option { display: flex; align-items: baseline; gap: 6px; }
            .print-option-label { font-weight: 700; color: #334155; min-width: 24px; }
            .print-question-footer { display: flex; justify-content: space-between; font-size: 11pt; font-weight: 600; color: #475569; border-top: 1px dashed #cbd5e1; padding-top: 6px; margin-top: 8px; }
            .print-math-inline { display: inline-block; vertical-align: middle; padding: 0 2px; }
            .print-math-block { display: block; text-align: center; margin: 12px 0; }
            .print-image-wrapper { margin: 12px 0; display: flex; }
            .print-image-wrapper.align-left { justify-content: flex-start; }
            .print-image-wrapper.align-center { justify-content: center; }
            .print-image-wrapper.align-right { justify-content: flex-end; }
            .print-image-wrapper img { max-width: 100%; height: auto; }
            .print-document-body p { margin: 0 0 10px 0; }
            .print-document-body ul, .print-document-body ol { margin: 0 0 10px 0; padding-left: 24px; }
            .print-document-body li { margin-bottom: 4px; }
            .print-page-footer { position: absolute; bottom: 10mm; left: ${settings.marginLeft}mm; right: ${settings.marginRight}mm; display: flex; justify-content: space-between; font-size: 10pt; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 6px; }
          </style>
        </head>
        <body>
          ${contentHtml}
        </body>
      </html>
    `;
  };

  const handleExportPDF = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const htmlContent = getFullHtmlForPrint();
      if (window.electronAPI?.exportPdf) {
        const result = await window.electronAPI.exportPdf(htmlContent, documentTitle);
        if (result?.success) {
          alert(`PDF exported successfully to:\n${result.filePath}`);
        }
      } else {
        alert("PDF export is supported in the desktop Electron version.");
      }
    } catch (err: any) {
      console.error("PDF Export error:", err);
      alert(`Unable to export PDF: ${err.message || "Unknown error"}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleNativePrint = async () => {
    try {
      const htmlContent = getFullHtmlForPrint();
      if (window.electronAPI?.printDocument) {
        await window.electronAPI.printDocument(htmlContent);
      } else {
        window.print();
      }
    } catch (err: any) {
      console.error("Native Print error:", err);
      alert(`Unable to print document: ${err.message || "Unknown error"}`);
    }
  };

  return (
    <div className="print-modal-overlay">
      <div className="print-modal-container">
        {/* Modal Toolbar Header */}
        <div className="print-modal-header">
          <div className="modal-header-left">
            <h2>A4 Exam Paper Print Preview</h2>
            <span className="doc-title-tag">{documentTitle}</span>
          </div>

          <div className="modal-header-center">
            <div className="zoom-controls">
              <button
                type="button"
                className="btn-zoom"
                onClick={handleZoomOut}
                disabled={zoom <= 50}
                title="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>
              <span className="zoom-label">{zoom}%</span>
              <button
                type="button"
                className="btn-zoom"
                onClick={handleZoomIn}
                disabled={zoom >= 150}
                title="Zoom In"
              >
                <ZoomIn size={16} />
              </button>
            </div>
          </div>

          <div className="modal-header-right">
            <button
              type="button"
              className="btn-print-action btn-print-primary"
              onClick={handleNativePrint}
            >
              <Printer size={16} /> <span>Print</span>
            </button>
            <button
              type="button"
              className="btn-print-action btn-pdf-export"
              onClick={handleExportPDF}
              disabled={isExporting}
            >
              <FileDown size={16} /> <span>{isExporting ? "Exporting PDF..." : "Export PDF"}</span>
            </button>
            <button type="button" className="btn-close-modal" onClick={onClose} title="Close Preview">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Main Workspace */}
        <div className="print-modal-workspace">
          {/* Scrollable Preview Canvas */}
          <div className="print-canvas-scroll">
            <div
              ref={printContainerRef}
              className="print-canvas-scaled"
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: "top center",
              }}
            >
              <PrintDocument
                content={documentJSON}
                title={documentTitle}
                settings={settings}
                headerData={headerData}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

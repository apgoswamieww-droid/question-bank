import React, { useState } from "react";
import type { ExamMetadata, ExamSection, LogoSettings } from "../types/examMetadata";
import {
  X,
  Plus,
  Trash2,
  Upload,
  Image as ImageIcon,
  Building2,
  ListOrdered,
  Layers,
  AlertTriangle,
  Save,
} from "lucide-react";
import "./ExamSettingsModal.css";

interface ExamSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: ExamMetadata;
  onSave: (updatedMetadata: ExamMetadata) => void;
}

export const ExamSettingsModal: React.FC<ExamSettingsModalProps> = ({
  isOpen,
  onClose,
  metadata,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<"general" | "logo" | "instructions" | "sections">("general");

  const [formData, setFormData] = useState<ExamMetadata>({ ...metadata });
  const [editingSectionIndex, setEditingSectionIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  // Calculate sum of section marks
  const sectionTotalMarks = formData.sections.reduce(
    (acc, sec) => acc + (sec.marks || 0),
    0
  );

  const handleInputChange = (
    field: keyof ExamMetadata,
    value: string | number | null
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Logo handlers
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file (.png, .jpg, .jpeg, .svg, .webp)");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setFormData((prev) => ({
        ...prev,
        logo: {
          src: dataUrl,
          width: prev.logo?.width || 120,
          alignment: prev.logo?.alignment || "center",
        },
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setFormData((prev) => ({ ...prev, logo: undefined }));
  };

  const handleLogoAttributeChange = (field: keyof LogoSettings, value: string | number) => {
    if (!formData.logo) return;
    setFormData((prev) => ({
      ...prev,
      logo: {
        ...prev.logo!,
        [field]: value,
      },
    }));
  };

  // Instruction handlers
  const handleAddInstruction = () => {
    const newNum = formData.instructions.length + 1;
    setFormData((prev) => ({
      ...prev,
      instructions: [...prev.instructions, `${newNum}. New instruction text`],
    }));
  };

  const handleInstructionChange = (index: number, val: string) => {
    const updated = [...formData.instructions];
    updated[index] = val;
    setFormData((prev) => ({ ...prev, instructions: updated }));
  };

  const handleRemoveInstruction = (index: number) => {
    const updated = formData.instructions.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, instructions: updated }));
  };

  // Section handlers
  const handleAddSection = () => {
    const nextChar = String.fromCharCode(65 + formData.sections.length);
    const newSection: ExamSection = {
      id: `sec-${Date.now()}`,
      title: `SECTION ${nextChar} — NEW SECTION`,
      description: "Section instructions or description",
      marks: 10,
      numberingMode: "continue",
      questionType: "mixed",
    };
    setFormData((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }));
    setEditingSectionIndex(formData.sections.length);
  };

  const handleSectionChange = (
    index: number,
    field: keyof ExamSection,
    val: string | number | null
  ) => {
    const updated = [...formData.sections];
    updated[index] = { ...updated[index], [field]: val };
    setFormData((prev) => ({ ...prev, sections: updated }));
  };

  const handleRemoveSection = (index: number) => {
    const updated = formData.sections.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, sections: updated }));
    if (editingSectionIndex === index) setEditingSectionIndex(null);
  };

  const handleSaveSettings = () => {
    onSave(formData);
    onClose();
  };

  return (
    <div className="exam-modal-overlay">
      <div className="exam-modal-container">
        {/* Modal Header */}
        <div className="exam-modal-header">
          <div className="exam-modal-title">
            <Building2 size={20} className="header-icon" />
            <h2>Exam Paper Settings & Header Configurator</h2>
          </div>
          <button type="button" className="btn-close-modal" onClick={onClose} title="Cancel">
            <X size={20} />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="exam-modal-tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === "general" ? "active" : ""}`}
            onClick={() => setActiveTab("general")}
          >
            <Building2 size={16} /> <span>General Info</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "logo" ? "active" : ""}`}
            onClick={() => setActiveTab("logo")}
          >
            <ImageIcon size={16} /> <span>Header & Logo</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "instructions" ? "active" : ""}`}
            onClick={() => setActiveTab("instructions")}
          >
            <ListOrdered size={16} /> <span>Instructions</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "sections" ? "active" : ""}`}
            onClick={() => setActiveTab("sections")}
          >
            <Layers size={16} /> <span>Exam Sections</span>
          </button>
        </div>

        {/* Modal Tab Contents */}
        <div className="exam-modal-body">
          {/* 1. GENERAL INFO TAB */}
          {activeTab === "general" && (
            <div className="tab-pane">
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Institute / School Name</label>
                  <input
                    type="text"
                    value={formData.instituteName}
                    onChange={(e) => handleInputChange("instituteName", e.target.value)}
                    placeholder="e.g. ABC International School"
                  />
                </div>

                <div className="form-group">
                  <label>Exam Title</label>
                  <input
                    type="text"
                    value={formData.examTitle}
                    onChange={(e) => handleInputChange("examTitle", e.target.value)}
                    placeholder="e.g. First Term Assessment 2026"
                  />
                </div>

                <div className="form-group">
                  <label>Subject</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => handleInputChange("subject", e.target.value)}
                    placeholder="e.g. Mathematics"
                  />
                </div>

                <div className="form-group">
                  <label>Standard / Class</label>
                  <input
                    type="text"
                    value={formData.standard}
                    onChange={(e) => handleInputChange("standard", e.target.value)}
                    placeholder="e.g. Std 10"
                  />
                </div>

                <div className="form-group">
                  <label>Academic Year</label>
                  <input
                    type="text"
                    value={formData.academicYear}
                    onChange={(e) => handleInputChange("academicYear", e.target.value)}
                    placeholder="e.g. 2026-27"
                  />
                </div>

                <div className="form-group">
                  <label>Date</label>
                  <input
                    type="text"
                    value={formData.date}
                    onChange={(e) => handleInputChange("date", e.target.value)}
                    placeholder="e.g. 24/08/2026"
                  />
                </div>

                <div className="form-group">
                  <label>Time Allowed</label>
                  <input
                    type="text"
                    value={formData.timeAllowed}
                    onChange={(e) => handleInputChange("timeAllowed", e.target.value)}
                    placeholder="e.g. 2 Hours"
                  />
                </div>

                <div className="form-group">
                  <label>Configured Total Marks</label>
                  <input
                    type="number"
                    value={formData.totalMarks !== null ? formData.totalMarks : ""}
                    onChange={(e) =>
                      handleInputChange(
                        "totalMarks",
                        e.target.value === "" ? null : Number(e.target.value)
                      )
                    }
                    placeholder="50"
                  />
                </div>
              </div>

              {/* Total Marks Mismatch Warning */}
              {formData.totalMarks !== null &&
                sectionTotalMarks > 0 &&
                formData.totalMarks !== sectionTotalMarks && (
                  <div className="warning-banner">
                    <AlertTriangle size={18} />
                    <span>
                      Warning: Configured Total Marks ({formData.totalMarks}) does not match the sum of section marks ({sectionTotalMarks}).
                    </span>
                  </div>
                )}
            </div>
          )}

          {/* 2. HEADER & LOGO TAB */}
          {activeTab === "logo" && (
            <div className="tab-pane">
              <div className="logo-section-box">
                <div className="logo-preview-area">
                  {formData.logo?.src ? (
                    <div
                      className="logo-display-wrapper"
                      style={{ textAlign: formData.logo.alignment }}
                    >
                      <img
                        src={formData.logo.src}
                        alt="Institute Logo"
                        style={{ width: `${formData.logo.width}px`, maxHeight: "150px" }}
                      />
                    </div>
                  ) : (
                    <div className="logo-empty-placeholder">
                      <ImageIcon size={40} />
                      <p>No logo uploaded yet</p>
                    </div>
                  )}
                </div>

                <div className="logo-controls">
                  <label className="btn-upload-logo">
                    <Upload size={16} /> <span>Upload Logo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      style={{ display: "none" }}
                    />
                  </label>

                  {formData.logo?.src && (
                    <button
                      type="button"
                      className="btn-remove-logo"
                      onClick={handleRemoveLogo}
                    >
                      <Trash2 size={16} /> <span>Remove Logo</span>
                    </button>
                  )}
                </div>

                {formData.logo?.src && (
                  <div className="logo-settings-grid">
                    <div className="form-group">
                      <label>Logo Alignment</label>
                      <select
                        value={formData.logo.alignment}
                        onChange={(e) =>
                          handleLogoAttributeChange(
                            "alignment",
                            e.target.value as "left" | "center" | "right"
                          )
                        }
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Logo Width ({formData.logo.width}px)</label>
                      <input
                        type="range"
                        min="50"
                        max="300"
                        value={formData.logo.width}
                        onChange={(e) =>
                          handleLogoAttributeChange("width", Number(e.target.value))
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. INSTRUCTIONS TAB */}
          {activeTab === "instructions" && (
            <div className="tab-pane">
              <div className="pane-header">
                <h3>General Examination Instructions</h3>
                <button
                  type="button"
                  className="btn-add-item"
                  onClick={handleAddInstruction}
                >
                  <Plus size={16} /> <span>Add Instruction</span>
                </button>
              </div>

              <div className="instructions-list">
                {formData.instructions.length === 0 ? (
                  <p className="empty-text">No general instructions added.</p>
                ) : (
                  formData.instructions.map((inst, idx) => (
                    <div key={idx} className="instruction-item-row">
                      <span className="inst-num">{idx + 1}.</span>
                      <input
                        type="text"
                        value={inst}
                        onChange={(e) => handleInstructionChange(idx, e.target.value)}
                        placeholder="Enter instruction text..."
                      />
                      <button
                        type="button"
                        className="btn-delete-row"
                        onClick={() => handleRemoveInstruction(idx)}
                        title="Delete Instruction"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 4. EXAM SECTIONS TAB */}
          {activeTab === "sections" && (
            <div className="tab-pane">
              <div className="pane-header">
                <h3>Question Paper Sections</h3>
                <button type="button" className="btn-add-item" onClick={handleAddSection}>
                  <Plus size={16} /> <span>Add Section</span>
                </button>
              </div>

              <div className="sections-list">
                {formData.sections.length === 0 ? (
                  <p className="empty-text">No sections added.</p>
                ) : (
                  formData.sections.map((sec, idx) => (
                    <div key={sec.id} className="section-card">
                      <div className="section-card-header">
                        <h4>{sec.title || `Section ${idx + 1}`}</h4>
                        <div className="section-card-actions">
                          <span className="section-marks-badge">
                            {sec.marks || 0} Marks
                          </span>
                          <button
                            type="button"
                            className="btn-delete-row"
                            onClick={() => handleRemoveSection(idx)}
                            title="Delete Section"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="form-grid-2">
                        <div className="form-group">
                          <label>Section Title</label>
                          <input
                            type="text"
                            value={sec.title}
                            onChange={(e) => handleSectionChange(idx, "title", e.target.value)}
                            placeholder="e.g. SECTION A — MCQ"
                          />
                        </div>

                        <div className="form-group">
                          <label>Section Marks</label>
                          <input
                            type="number"
                            value={sec.marks !== null && sec.marks !== undefined ? sec.marks : ""}
                            onChange={(e) =>
                              handleSectionChange(
                                idx,
                                "marks",
                                e.target.value === "" ? null : Number(e.target.value)
                              )
                            }
                            placeholder="20"
                          />
                        </div>

                        <div className="form-group full-width">
                          <label>Instructions / Description</label>
                          <input
                            type="text"
                            value={sec.description || ""}
                            onChange={(e) => handleSectionChange(idx, "description", e.target.value)}
                            placeholder="e.g. Choose the correct option for each question."
                          />
                        </div>

                        <div className="form-group">
                          <label>Question Type Preset</label>
                          <select
                            value={sec.questionType || "mixed"}
                            onChange={(e) => handleSectionChange(idx, "questionType", e.target.value)}
                          >
                            <option value="mcq">Multiple Choice Questions (MCQ)</option>
                            <option value="short">Short Answer Questions</option>
                            <option value="long">Long Answer Questions</option>
                            <option value="mixed">Mixed Types</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label>Numbering Mode</label>
                          <select
                            value={sec.numberingMode || "continue"}
                            onChange={(e) => handleSectionChange(idx, "numberingMode", e.target.value)}
                          >
                            <option value="continue">Continue Numbering</option>
                            <option value="restart">Restart Numbering (Q1)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="exam-modal-footer">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-save-settings" onClick={handleSaveSettings}>
            <Save size={16} /> <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};

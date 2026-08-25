export interface RecentFileItem {
  path: string;
  name: string;
  updatedAt?: string;
}

export interface AnalyzerStatus {
  provider: string;
  model: string;
  baseUrl: string;
  apiKeyConfigured: boolean;
  apiKeyLast4: string | null;
}

export interface AnalyzerGlyphParams {
  font: string;
  byte: number;
  hex: string;
  glyphImagePath: string;
  glyphName: string | null;
  hasGlyph: boolean;
}

export interface AnalyzerCandidate {
  unicode: string;
  unicodeName?: string;
  confidence: number;
  reason: string;
  isSequence: boolean;
}

export interface AnalyzerGlyphResponse {
  candidates: AnalyzerCandidate[];
  uncertain: boolean;
  notes: string;
  model: string;
}

export interface AnalyzerSequenceParams {
  font: string;
  kapSequence: string;
  byteValues: number[];
}

export interface AnalyzerSequenceResponse {
  candidates: AnalyzerCandidate[];
  uncertain: boolean;
  model: string;
}

export interface AnalyzerExportResult {
  success: boolean;
  filePath: string;
  count: number;
}

export interface AnalyzerState {
  font: string;
  candidates: unknown[];
  verifiedCount: number;
  rejectedCount: number;
  lastAnalyzed?: string;
}

export interface ElectronAPI {
  openFileDialog: () => Promise<{ filePath: string; content: string } | null>;
  saveFileDialog: (defaultTitle?: string) => Promise<string | null>;
  readFile: (filePath: string) => Promise<{ filePath: string; content: string }>;
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; filePath: string }>;
  getRecentFiles: () => Promise<RecentFileItem[]>;
  addRecentFile: (filePath: string) => Promise<RecentFileItem[]>;
  confirmClose: (isDirty: boolean) => Promise<"save" | "dontsave" | "cancel">;
  exportPdf: (htmlContent: string, defaultTitle?: string) => Promise<{ success: boolean; filePath: string } | null>;
  printDocument: (htmlContent: string) => Promise<boolean>;
  onCloseRequested: (callback: () => void) => () => void;
  onMenuAction: (callback: (action: "new" | "open" | "save" | "saveAs") => void) => () => void;

  // KAP AI Analyzer API
  analyzer: {
    getStatus: () => Promise<AnalyzerStatus>;
    testConnection: () => Promise<{ success: boolean; model?: string; baseUrl?: string; provider?: string; error?: string }>;
    analyzeGlyph: (params: AnalyzerGlyphParams) => Promise<AnalyzerGlyphResponse>;
    analyzeSequence: (params: AnalyzerSequenceParams) => Promise<AnalyzerSequenceResponse>;
    getGlyphDataset: (params: { font: string }) => Promise<unknown>;
    exportVerified: (params: { font: string; mappings: unknown[] }) => Promise<AnalyzerExportResult | null>;
    saveState: (params: { font: string; state: AnalyzerState }) => Promise<{ success: boolean; error?: string }>;
    loadState: (params: { font: string }) => Promise<AnalyzerState | null>;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

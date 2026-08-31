/**
 * useKapAnalyzer Hook (Web)
 * ========================
 * Web-only version. The KAP AI Analyzer requires a vision-capable LLM
 * endpoint which is not available without a server backend.
 * All analysis functions return "not supported" in web mode.
 */

import { useState, useCallback, useRef } from "react";
import type { KapFont } from "../converter/types";

export interface AnalyzerStatus {
  provider: string;
  model: string;
  baseUrl: string;
  apiKeyConfigured: boolean;
  apiKeyLast4: string | null;
}

export interface AnalyzerCandidate {
  font: KapFont;
  byte: number;
  hex: string;
  unicode: string;
  confidence: number;
  confidenceCategory: "very_high" | "high" | "medium" | "low" | "very_low";
  status: "candidate" | "verified" | "rejected" | "unsure";
  humanVerified: boolean;
  reasoning: string;
  generatedAt: string;
  updatedAt: string;
  glyphName?: string;
}

export interface SequenceCandidate {
  font: KapFont;
  bytes: string[];
  byteValues: number[];
  kap: string;
  unicode: string;
  modelConfidence: number;
  isSequence: true;
  humanVerified: false;
  status: "candidate";
  source: string;
  generatedAt: string;
  reasoning: string;
}

export interface AnalyzerProgress {
  total: number;
  completed: number;
  font: KapFont;
  provider: string;
  model: string;
  candidatesFound: number;
  verifiedCount: number;
  rejectedCount: number;
}

const NOT_AVAILABLE: AnalyzerStatus = {
  provider: "web",
  model: "N/A",
  baseUrl: "",
  apiKeyConfigured: false,
  apiKeyLast4: null,
};

export function useKapAnalyzer() {
  const [status] = useState<AnalyzerStatus>(NOT_AVAILABLE);
  const [selectedFont, setSelectedFont] = useState<KapFont>("KAP112");
  const [candidates, setCandidates] = useState<AnalyzerCandidate[]>([]);
  const [sequenceCandidates, setSequenceCandidates] = useState<SequenceCandidate[]>([]);
  const [progress] = useState<AnalyzerProgress | null>(null);
  const [isAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const testConnection = useCallback(
    async (): Promise<{ success: boolean; error?: string }> => ({
      success: false,
      error: "KAP AI Analyzer is not available in web mode. Run the Electron desktop app for full analyzer support.",
    }),
    []
  );

  const analyzeFont = useCallback(
    async () => {
      setError(
        "KAP AI Analyzer is not available in web mode."
      );
    },
    []
  );

  const cancelAnalysis = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const verifyCandidate = useCallback((candidate: AnalyzerCandidate) => {
    setCandidates((prev) =>
      prev.map((c) =>
        c.byte === candidate.byte && c.unicode === candidate.unicode
          ? { ...c, status: "verified" as const, humanVerified: true, updatedAt: new Date().toISOString() }
          : c
      )
    );
  }, []);

  const rejectCandidate = useCallback((candidate: AnalyzerCandidate) => {
    setCandidates((prev) =>
      prev.map((c) =>
        c.byte === candidate.byte && c.unicode === candidate.unicode
          ? { ...c, status: "rejected" as const, updatedAt: new Date().toISOString() }
          : c
      )
    );
  }, []);

  const editCandidate = useCallback(
    (oldCandidate: AnalyzerCandidate, newUnicode: string) => {
      setCandidates((prev) =>
        prev.map((c) =>
          c.byte === oldCandidate.byte && c.unicode === oldCandidate.unicode
            ? { ...c, unicode: newUnicode, updatedAt: new Date().toISOString() }
            : c
        )
      );
    },
    []
  );

  const verifySequence = useCallback((candidate: SequenceCandidate) => {
    setSequenceCandidates((prev) =>
      prev.map((c) =>
        c.kap === candidate.kap && c.unicode === candidate.unicode
          ? { ...c, humanVerified: true, status: "candidate" as const }
          : c
      )
    );
  }, []);

  const exportVerified = useCallback(
    async (): Promise<{ success: boolean; count?: number; error?: string }> => ({
      success: false,
      error: "Export is not available in web mode.",
    }),
    []
  );

  return {
    status,
    selectedFont,
    setSelectedFont,
    candidates,
    sequenceCandidates,
    progress,
    isAnalyzing,
    error,
    testConnection,
    analyzeFont,
    cancelAnalysis,
    verifyCandidate,
    rejectCandidate,
    editCandidate,
    verifySequence,
    exportVerified,
  };
}

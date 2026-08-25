/**
 * useKapAnalyzer Hook
 * ==================
 * React hook for the KAP AI Analyzer.
 *
 * SAFETY: This hook does NOT store API keys in renderer.
 * All API communication goes through Electron IPC.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { KapFont } from "../converter/types";
import type {
  AnalyzerStatus,
  AnalyzerGlyphResponse,
  AnalyzerSequenceResponse,
} from "../electron.d";

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

function getConfidenceCategory(score: number): "very_high" | "high" | "medium" | "low" | "very_low" {
  if (score >= 0.90) return "very_high";
  if (score >= 0.75) return "high";
  if (score >= 0.50) return "medium";
  if (score >= 0.25) return "low";
  return "very_low";
}

export function useKapAnalyzer() {
  const [status, setStatus] = useState<AnalyzerStatus | null>(null);
  const [selectedFont, setSelectedFont] = useState<KapFont>("KAP112");
  const [candidates, setCandidates] = useState<AnalyzerCandidate[]>([]);
  const [sequenceCandidates, setSequenceCandidates] = useState<SequenceCandidate[]>([]);
  const [progress, setProgress] = useState<AnalyzerProgress | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load analyzer status on mount
  useEffect(() => {
    window.electronAPI?.analyzer.getStatus().then(setStatus);
  }, []);

  // Load saved state when font changes
  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.analyzer.loadState({ font: selectedFont }).then((state) => {
      if (state) {
        setCandidates(state.candidates as AnalyzerCandidate[]);
        // Restore other state if needed
      }
    });
  }, [selectedFont]);

  // Test connection
  const testConnection = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!window.electronAPI) {
      return { success: false, error: "Electron API not available" };
    }

    try {
      const result = await window.electronAPI.analyzer.testConnection();
      return result;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }, []);

  // Analyze font
  const analyzeFont = useCallback(async (font: KapFont) => {
    if (!window.electronAPI) {
      setError("Electron API not available");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setCandidates([]);
    setSequenceCandidates([]);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Get glyph dataset
      const dataset = await window.electronAPI.analyzer.getGlyphDataset({ font });
      if (!dataset) {
        throw new Error(`Glyph dataset not found for ${font}`);
      }

      const glyphs = (dataset as { glyphs: Record<string, { byte: number; hex: string; glyphName: string | null; hasGlyph: boolean; imagePath: string }> }).glyphs;
      const glyphEntries = Object.entries(glyphs).filter(([, g]) => g.hasGlyph);
      const total = glyphEntries.length;

      setProgress({
        total,
        completed: 0,
        font,
        provider: status?.provider || "unknown",
        model: status?.model || "unknown",
        candidatesFound: 0,
        verifiedCount: 0,
        rejectedCount: 0,
      });

      const allCandidates: AnalyzerCandidate[] = [];

      // Analyze each glyph
      for (let i = 0; i < glyphEntries.length; i++) {
        if (abortController.signal.aborted) {
          break;
        }

        const [hexKey, glyphEntry] = glyphEntries[i];

        try {
          const response: AnalyzerGlyphResponse = await window.electronAPI.analyzer.analyzeGlyph({
            font,
            byte: glyphEntry.byte,
            hex: hexKey,
            glyphImagePath: `mapping-data/glyph-dataset/${font}/${glyphEntry.imagePath}`,
            glyphName: glyphEntry.glyphName,
            hasGlyph: glyphEntry.hasGlyph,
          });

          // Convert response to our candidate format
          for (const c of response.candidates) {
            if (c.unicode && c.confidence > 0.1) {
              allCandidates.push({
                font,
                byte: glyphEntry.byte,
                hex: hexKey,
                unicode: c.unicode,
                confidence: c.confidence,
                confidenceCategory: getConfidenceCategory(c.confidence),
                status: "candidate",
                humanVerified: false,
                reasoning: c.reason || "AI analysis",
                generatedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                glyphName: glyphEntry.glyphName || undefined,
              });
            }
          }
        } catch (err) {
          console.error(`Error analyzing ${font} ${hexKey}:`, err);
        }

        // Update progress
        setProgress(prev => prev ? {
          ...prev,
          completed: i + 1,
          candidatesFound: allCandidates.length,
        } : null);
      }

      setCandidates(allCandidates);

      // Analyze golden sample sequence
      try {
        const sequenceResponse: AnalyzerSequenceResponse = await window.electronAPI.analyzer.analyzeSequence({
          font,
          kapSequence: "VF5[,F",
          byteValues: [86, 70, 53, 91, 44, 70],
        });

        const sequenceCandidates: SequenceCandidate[] = [];
        for (const c of sequenceResponse.candidates) {
          sequenceCandidates.push({
            font,
            bytes: ["V", "F", "5", "[", ",", "F"],
            byteValues: [86, 70, 53, 91, 44, 70],
            kap: "VF5[,F",
            unicode: c.unicode,
            modelConfidence: c.confidence,
            isSequence: true,
            humanVerified: false,
            status: "candidate",
            source: "openai-vision-sequence",
            generatedAt: new Date().toISOString(),
            reasoning: c.reason || "Sequence analysis",
          });
        }

        // Always add the known anchor
        sequenceCandidates.unshift({
          font,
          bytes: ["V", "F", "5", "[", ",", "F"],
          byteValues: [86, 70, 53, 91, 44, 70],
          kap: "VF5[,F",
          unicode: "ગુજરાતી",
          modelConfidence: 1.0,
          isSequence: true,
          humanVerified: false,
          status: "candidate",
          source: "known-anchor",
          generatedAt: new Date().toISOString(),
          reasoning: "Known project anchor: VF5[,F → ગુજરાતી",
        });

        setSequenceCandidates(sequenceCandidates);
      } catch (err) {
        console.error("Sequence analysis failed:", err);
      }

      // Save state
      await window.electronAPI.analyzer.saveState({
        font,
        state: {
          font,
          candidates: allCandidates,
          verifiedCount: 0,
          rejectedCount: 0,
          lastAnalyzed: new Date().toISOString(),
        },
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
      abortControllerRef.current = null;
    }
  }, [status]);

  // Cancel analysis
  const cancelAnalysis = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsAnalyzing(false);
  }, []);

  // Verify candidate
  const verifyCandidate = useCallback((candidate: AnalyzerCandidate) => {
    setCandidates(prev => prev.map(c =>
      c.byte === candidate.byte && c.unicode === candidate.unicode
        ? { ...c, status: "verified" as const, humanVerified: true, updatedAt: new Date().toISOString() }
        : c
    ));
  }, []);

  // Reject candidate
  const rejectCandidate = useCallback((candidate: AnalyzerCandidate) => {
    setCandidates(prev => prev.map(c =>
      c.byte === candidate.byte && c.unicode === candidate.unicode
        ? { ...c, status: "rejected" as const, updatedAt: new Date().toISOString() }
        : c
    ));
  }, []);

  // Edit candidate
  const editCandidate = useCallback((oldCandidate: AnalyzerCandidate, newUnicode: string) => {
    setCandidates(prev => prev.map(c =>
      c.byte === oldCandidate.byte && c.unicode === oldCandidate.unicode
        ? { ...c, unicode: newUnicode, updatedAt: new Date().toISOString() }
        : c
    ));
  }, []);

  // Verify sequence
  const verifySequence = useCallback((candidate: SequenceCandidate) => {
    setSequenceCandidates(prev => prev.map(c =>
      c.kap === candidate.kap && c.unicode === candidate.unicode
        ? { ...c, humanVerified: true, status: "candidate" as const }
        : c
    ));
  }, []);

  // Export verified mappings
  const exportVerified = useCallback(async (): Promise<{ success: boolean; count?: number; error?: string }> => {
    if (!window.electronAPI) {
      return { success: false, error: "Electron API not available" };
    }

    const verifiedMappings = candidates
      .filter(c => c.status === "verified" && c.humanVerified)
      .map(c => ({
        byte: c.byte,
        hex: c.hex,
        unicode: c.unicode,
        verifiedAt: c.updatedAt,
        verifiedBy: "human",
        source: "ai_confirmed",
        confidence: c.confidence,
      }));

    const verifiedSequences = sequenceCandidates
      .filter(c => c.humanVerified)
      .map(c => ({
        kap: c.kap,
        unicode: c.unicode,
        verifiedAt: c.generatedAt,
        verifiedBy: "human",
        source: "ai_confirmed",
        confidence: c.modelConfidence,
        isSequence: true,
      }));

    if (verifiedMappings.length === 0 && verifiedSequences.length === 0) {
      return { success: false, error: "No verified mappings to export" };
    }

    try {
      const result = await window.electronAPI.analyzer.exportVerified({
        font: selectedFont,
        mappings: [...verifiedMappings, ...verifiedSequences],
      });

      return result
        ? { success: true, count: result.count }
        : { success: false, error: "Export cancelled" };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Export failed" };
    }
  }, [candidates, sequenceCandidates, selectedFont]);

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

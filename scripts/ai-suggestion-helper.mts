/**
 * AI Suggestion Helper
 * ====================
 * Provides AI suggestions to the manual mapping entry tool.
 *
 * SAFETY RULES:
 * - Suggestions are DISPLAY ONLY
 * - Human must still explicitly confirm each mapping
 * - Never auto-fill or auto-confirm suggestions
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CANDIDATES_DIR = path.join(ROOT, "mapping-data", "candidates");

interface MappingCandidate {
  font: string;
  byte: number;
  hex: string;
  unicode: string;
  kap?: string;
  confidence: number;
  confidenceCategory: string;
  status: string;
  humanVerified: boolean;
  reasoning: string;
}

interface CandidateFile {
  font: string;
  generatedAt: string;
  provider: string;
  candidates: MappingCandidate[];
}

const candidateCache = new Map<string, CandidateFile>();

function loadCandidateFile(font: string): CandidateFile | null {
  const cacheKey = font.toLowerCase();
  if (candidateCache.has(cacheKey)) {
    return candidateCache.get(cacheKey)!;
  }

  const filePath = path.join(CANDIDATES_DIR, `${cacheKey}-candidates.json`);
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const data = JSON.parse(readFileSync(filePath, "utf8")) as CandidateFile;
    candidateCache.set(cacheKey, data);
    return data;
  } catch {
    return null;
  }
}

/**
 * Get AI suggestion for a specific byte.
 *
 * @param font - KAP font name (e.g., "KAP112")
 * @param byte - Byte value to get suggestion for
 * @returns Suggestion string or null if no suggestion
 */
export function getAISuggestion(font: string, byte: number): string | null {
  const candidateFile = loadCandidateFile(font);
  if (!candidateFile) {
    return null;
  }

  // Find the highest confidence candidate for this byte
  const candidates = candidateFile.candidates
    .filter((c) => c.byte === byte && c.status === "candidate")
    .sort((a, b) => b.confidence - a.confidence);

  if (candidates.length === 0) {
    return null;
  }

  const best = candidates[0];
  const confidencePercent = Math.round(best.confidence * 100);

  return `AI suggestion: ${best.unicode} — ${confidencePercent}% confidence`;
}

/**
 * Get all AI suggestions for a specific byte.
 *
 * @param font - KAP font name
 * @param byte - Byte value
 * @returns Array of suggestions with confidence
 */
export function getAllAISuggestions(
  font: string,
  byte: number
): Array<{ unicode: string; confidence: number; reasoning: string }> {
  const candidateFile = loadCandidateFile(font);
  if (!candidateFile) {
    return [];
  }

  return candidateFile.candidates
    .filter((c) => c.byte === byte && c.status === "candidate")
    .sort((a, b) => b.confidence - a.confidence)
    .map((c) => ({
      unicode: c.unicode,
      confidence: c.confidence,
      reasoning: c.reasoning,
    }));
}

/**
 * Check if AI has suggestions for a font.
 *
 * @param font - KAP font name
 * @returns True if suggestions exist
 */
export function hasAISuggestions(font: string): boolean {
  const candidateFile = loadCandidateFile(font);
  return candidateFile !== null && candidateFile.candidates.length > 0;
}

/**
 * Get AI suggestion statistics for a font.
 *
 * @param font - KAP font name
 * @returns Statistics object
 */
export function getAISuggestionStats(font: string): {
  total: number;
  byConfidence: Record<string, number>;
} {
  const candidateFile = loadCandidateFile(font);
  if (!candidateFile) {
    return { total: 0, byConfidence: {} };
  }

  const byConfidence: Record<string, number> = {};
  for (const c of candidateFile.candidates) {
    byConfidence[c.confidenceCategory] =
      (byConfidence[c.confidenceCategory] ?? 0) + 1;
  }

  return {
    total: candidateFile.candidates.length,
    byConfidence,
  };
}

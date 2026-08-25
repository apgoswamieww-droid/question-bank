/**
 * Confidence Scoring
 * ==================
 * Calculates and manages confidence scores for mapping candidates.
 *
 * SAFETY RULES:
 * - Confidence is a RECOMMENDATION only
 * - High confidence NEVER means human verification
 * - A candidate with 0.99 confidence is still humanVerified: false
 */

import type { MappingCandidate } from "./types";

/**
 * Confidence level definitions.
 */
export const CONFIDENCE_LEVELS = {
  VERY_HIGH: { min: 0.90, max: 1.00, label: "Very High", color: "#047857" },
  HIGH: { min: 0.75, max: 0.89, label: "High", color: "#059669" },
  MEDIUM: { min: 0.50, max: 0.74, label: "Medium", color: "#b45309" },
  LOW: { min: 0.25, max: 0.49, label: "Low", color: "#dc2626" },
  VERY_LOW: { min: 0.00, max: 0.24, label: "Very Low", color: "#6b7280" },
} as const;

export type ConfidenceLevel = keyof typeof CONFIDENCE_LEVELS;

/**
 * Get the confidence level for a score.
 */
export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.90) return "VERY_HIGH";
  if (score >= 0.75) return "HIGH";
  if (score >= 0.50) return "MEDIUM";
  if (score >= 0.25) return "LOW";
  return "VERY_LOW";
}

/**
 * Get human-readable label for a confidence level.
 */
export function getConfidenceLabel(score: number): string {
  const level = getConfidenceLevel(score);
  return CONFIDENCE_LEVELS[level].label;
}

/**
 * Get color for a confidence level.
 */
export function getConfidenceColor(score: number): string {
  const level = getConfidenceLevel(score);
  return CONFIDENCE_LEVELS[level].color;
}

/**
 * Calculate composite confidence score from multiple factors.
 *
 * @param factors - Array of { score, weight } pairs
 * @returns Weighted average score (0-1)
 */
export function calculateCompositeConfidence(
  factors: Array<{ score: number; weight: number }>
): number {
  if (factors.length === 0) return 0;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const factor of factors) {
    totalWeight += factor.weight;
    weightedSum += factor.score * factor.weight;
  }

  if (totalWeight === 0) return 0;

  return Math.round((weightedSum / totalWeight) * 100) / 100;
}

/**
 * Score a candidate based on multiple factors.
 */
export function scoreCandidate(candidate: MappingCandidate): number {
  const factors: Array<{ score: number; weight: number }> = [];

  // Factor 1: Base confidence from AI (weight: 0.6)
  factors.push({ score: candidate.confidence, weight: 0.6 });

  // Factor 2: Glyph name match (weight: 0.2)
  // Higher score if glyph name suggests the character
  const glyphNameScore = candidate.metadata?.glyphName ? 0.5 : 0.3;
  factors.push({ score: glyphNameScore, weight: 0.2 });

  // Factor 3: Reasoning quality (weight: 0.2)
  // Higher score if reasoning is detailed
  const reasoningScore =
    candidate.reasoning.length > 50
      ? 0.8
      : candidate.reasoning.length > 20
        ? 0.6
        : 0.4;
  factors.push({ score: reasoningScore, weight: 0.2 });

  return calculateCompositeConfidence(factors);
}

/**
 * Get confidence summary for a list of candidates.
 */
export function getConfidenceSummary(candidates: MappingCandidate[]): {
  total: number;
  byLevel: Record<ConfidenceLevel, number>;
  average: number;
  highest: number;
  lowest: number;
} {
  const byLevel: Record<ConfidenceLevel, number> = {
    VERY_HIGH: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    VERY_LOW: 0,
  };

  let total = 0;
  let sum = 0;
  let highest = 0;
  let lowest = 1;

  for (const c of candidates) {
    const level = getConfidenceLevel(c.confidence);
    byLevel[level]++;
    total++;
    sum += c.confidence;
    highest = Math.max(highest, c.confidence);
    lowest = Math.min(lowest, c.confidence);
  }

  return {
    total,
    byLevel,
    average: total > 0 ? Math.round((sum / total) * 100) / 100 : 0,
    highest,
    lowest,
  };
}

/**
 * Filter candidates by confidence threshold.
 */
export function filterByConfidenceThreshold(
  candidates: MappingCandidate[],
  minConfidence: number
): MappingCandidate[] {
  return candidates.filter((c) => c.confidence >= minConfidence);
}

/**
 * Sort candidates by confidence (highest first).
 */
export function sortByConfidence(
  candidates: MappingCandidate[]
): MappingCandidate[] {
  return [...candidates].sort((a, b) => b.confidence - a.confidence);
}

/**
 * Get the top N candidates by confidence.
 */
export function getTopCandidates(
  candidates: MappingCandidate[],
  n: number
): MappingCandidate[] {
  return sortByConfidence(candidates).slice(0, n);
}

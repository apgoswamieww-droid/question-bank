/**
 * Candidate Generation Engine
 * ===========================
 * Generates AI-assisted mapping candidates for KAP fonts.
 *
 * SAFETY RULES:
 * - All output has status: "candidate" and humanVerified: false
 * - Never set humanVerified=true programmatically
 * - Never copy mappings between fonts
 * - Never infer mappings from glyph names alone
 * - Never infer mappings from byte order alone
 */

import type { KapFont } from "../types";
import type {
  CandidateFile,
  FontAnalysis,
  GlyphAnalysisRequest,
  GlyphDataset,
  MappingCandidate,
  SequenceAnchor,
  VisionProvider,
} from "./types";
import { getConfidenceCategory, isGujaratiBlock } from "./types";

/**
 * Known sequence anchors for the project.
 * These MUST be preserved as sequence-level anchors.
 */
const KNOWN_ANCHORS: SequenceAnchor[] = [
  {
    unicode: "ગુજરાતી",
    kap: "VF5[,F",
    source: "Project-origin golden sample from src/App.tsx",
    confidence: 1.0,
  },
];

/**
 * Minimum confidence threshold for including candidates.
 */
const MIN_CONFIDENCE_THRESHOLD = 0.1;

/**
 * Generate candidates for a single font.
 *
 * @param font - Font to analyze
 * @param fontAnalysis - Pre-extracted font metadata
 * @param glyphDataset - Pre-generated glyph dataset
 * @param provider - Vision AI provider
 * @returns Candidate file with all generated candidates
 */
export async function generateCandidates(
  font: KapFont,
  fontAnalysis: FontAnalysis,
  glyphDataset: GlyphDataset,
  provider: VisionProvider
): Promise<CandidateFile> {
  const candidates: MappingCandidate[] = [];

  // Process each byte position
  for (const [hexKey, glyphEntry] of Object.entries(glyphDataset.glyphs)) {
    const byteVal = glyphEntry.byte;

    // Build analysis request
    const request: GlyphAnalysisRequest = {
      font,
      byte: byteVal,
      hex: hexKey,
      glyphImagePath: `mapping-data/glyph-dataset/${font}/${glyphEntry.imagePath}`,
      glyphName: glyphEntry.glyphName,
      hasGlyph: glyphEntry.hasGlyph,
      knownAnchors: KNOWN_ANCHORS,
      context: `Byte range: ${glyphEntry.section}`,
    };

    // Skip bytes without glyphs (no candidates possible)
    if (!glyphEntry.hasGlyph) {
      continue;
    }

    // Analyze with provider
    try {
      const response = await provider.analyze(request);

      // Process candidates
      for (const candidate of response.candidates) {
        // Safety filter: must be Gujarati block or empty
        if (candidate.unicode && !isGujaratiBlock(candidate.unicode)) {
          continue;
        }

        // Safety filter: confidence threshold
        if (candidate.confidence < MIN_CONFIDENCE_THRESHOLD) {
          continue;
        }

        // Ensure safety properties are set correctly
        const safeCandidate: MappingCandidate = {
          ...candidate,
          font, // Ensure font matches
          byte: byteVal,
          hex: hexKey,
          status: "candidate", // ALWAYS candidate
          humanVerified: false, // NEVER verified by AI
          confidenceCategory: getConfidenceCategory(candidate.confidence),
          metadata: {
            ...candidate.metadata,
            glyphName: glyphEntry.glyphName ?? undefined,
            hasGlyph: glyphEntry.hasGlyph,
          },
        };

        candidates.push(safeCandidate);
      }
    } catch (error) {
      // Log error but continue processing
      console.error(`Error analyzing ${font} byte ${hexKey}:`, error);
    }
  }

  // Sort candidates by byte value, then by confidence
  candidates.sort((a, b) => {
    if (a.byte !== b.byte) return a.byte - b.byte;
    return b.confidence - a.confidence;
  });

  return {
    font,
    generatedAt: new Date().toISOString(),
    provider: provider.name,
    candidates,
  };
}

/**
 * Add known anchor candidates to the candidate file.
 * These are sequence-level anchors that MUST be preserved.
 */
export function addKnownAnchors(
  candidateFile: CandidateFile
): CandidateFile {
  // Known anchors will be handled during validation
  return candidateFile;
}

/**
 * Filter candidates by minimum confidence.
 */
export function filterByConfidence(
  candidates: MappingCandidate[],
  minConfidence: number
): MappingCandidate[] {
  return candidates.filter((c) => c.confidence >= minConfidence);
}

/**
 * Get unique bytes with candidates.
 */
export function getBytesWithCandidates(
  candidates: MappingCandidate[]
): number[] {
  const bytes = new Set(candidates.map((c) => c.byte));
  return Array.from(bytes).sort((a, b) => a - b);
}

/**
 * Get candidates for a specific byte.
 */
export function getCandidatesForByte(
  candidates: MappingCandidate[],
  byte: number
): MappingCandidate[] {
  return candidates
    .filter((c) => c.byte === byte)
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * Get summary statistics for candidates.
 */
export function getCandidateSummary(candidates: MappingCandidate[]) {
  const byFont = new Map<KapFont, number>();
  const byConfidence = new Map<string, number>();
  const byStatus = new Map<string, number>();

  for (const c of candidates) {
    byFont.set(c.font, (byFont.get(c.font) ?? 0) + 1);
    byConfidence.set(
      c.confidenceCategory,
      (byConfidence.get(c.confidenceCategory) ?? 0) + 1
    );
    byStatus.set(c.status, (byStatus.get(c.status) ?? 0) + 1);
  }

  return {
    total: candidates.length,
    byFont: Object.fromEntries(byFont),
    byConfidence: Object.fromEntries(byConfidence),
    byStatus: Object.fromEntries(byStatus),
    uniqueBytes: getBytesWithCandidates(candidates).length,
  };
}

/**
 * AI-Analyzer Types
 * =================
 * Core types for the AI-assisted KAP Mapping Analyzer pipeline.
 *
 * SAFETY RULES:
 * - All AI output has status: "candidate" and humanVerified: false
 * - Only explicit human confirmation can promote a candidate
 * - Never set humanVerified=true programmatically
 * - Never set verified=true in mapping files
 * - Never copy mappings between fonts
 */

import type { KapFont } from "../types";

/**
 * Status of a mapping candidate through the verification pipeline.
 */
export type CandidateStatus =
  | "candidate"    // AI-generated, awaiting human review
  | "confirmed"    // Human confirmed, ready for export
  | "rejected"     // Human rejected
  | "unsure"       // Human marked as unsure, needs more evidence
  | "skipped";     // Skipped during review

/**
 * A single AI-generated mapping candidate.
 *
 * CRITICAL: humanVerified MUST remain false until a human explicitly confirms.
 */
export interface MappingCandidate {
  /** Font this candidate applies to */
  font: KapFont;
  /** Byte value (decimal) */
  byte: number;
  /** Byte value (hex string, e.g., "0x56") */
  hex: string;
  /** Candidate Unicode character(s) */
  unicode: string;
  /** Multi-byte KAP output sequence (for sequence candidates) */
  kap?: string;
  /** AI confidence score (0-1) */
  confidence: number;
  /** Human-readable confidence category */
  confidenceCategory: "very_high" | "high" | "medium" | "low" | "very_low";
  /** Current status in the pipeline */
  status: CandidateStatus;
  /** Whether a human has verified this mapping */
  humanVerified: boolean;
  /** AI reasoning for this candidate */
  reasoning: string;
  /** When this candidate was generated */
  generatedAt: string;
  /** When this candidate was last updated */
  updatedAt: string;
  /** Additional metadata */
  metadata?: CandidateMetadata;
}

/**
 * Metadata for a mapping candidate.
 */
export interface CandidateMetadata {
  /** Glyph name from the font */
  glyphName?: string;
  /** Whether the glyph has a visual representation */
  hasGlyph?: boolean;
  /** Bounding box of the glyph [xMin, yMin, xMax, yMax] */
  bbox?: [number, number, number, number];
  /** Advance width of the glyph */
  advanceWidth?: number;
  /** Unicode codepoints mapped to this glyph in the font */
  unicodeCodepoints?: number[];
  /** Cross-font comparison results */
  crossFontComparison?: CrossFontComparison[];
  /** Sequence analysis results */
  sequenceAnalysis?: SequenceAnalysis;
}

/**
 * Cross-font comparison for a byte position.
 */
export interface CrossFontComparison {
  font: KapFont;
  glyphName: string | null;
  hasGlyph: boolean;
  /** Whether other fonts agree on the same Unicode mapping */
  agreesWithCandidate: boolean;
}

/**
 * Analysis of multi-byte sequences.
 */
export interface SequenceAnalysis {
  /** Whether this byte is part of a known sequence */
  isPartOfSequence: boolean;
  /** Known sequences this byte appears in */
  knownSequences?: SequenceAnchor[];
  /** Potential sequences identified by AI */
  potentialSequences?: PotentialSequence[];
}

/**
 * A known sequence anchor (e.g., the golden sample).
 */
export interface SequenceAnchor {
  unicode: string;
  kap: string;
  source: string;
  confidence: 1.0;
  /** Font this anchor applies to (optional, for font-specific anchors) */
  font?: string;
}

/**
 * A potential sequence identified by AI analysis.
 */
export interface PotentialSequence {
  unicode: string;
  kap: string;
  confidence: number;
  reasoning: string;
}

/**
 * Request to analyze a single glyph.
 */
export interface GlyphAnalysisRequest {
  font: KapFont;
  byte: number;
  hex: string;
  glyphImagePath: string;
  glyphName: string | null;
  hasGlyph: boolean;
  /** Reference Gujarati glyphs for comparison */
  referenceGlyphs?: ReferenceGlyph[];
  /** Known sequence anchors */
  knownAnchors?: SequenceAnchor[];
  /** Context about the byte range */
  context?: string;
}

/**
 * A reference Gujarati glyph for comparison.
 */
export interface ReferenceGlyph {
  unicode: string;
  name: string;
  imagePath: string;
}

/**
 * Response from glyph analysis.
 */
export interface GlyphAnalysisResponse {
  /** Generated candidates (may be empty) */
  candidates: MappingCandidate[];
  /** Overall confidence in the analysis */
  analysisConfidence: number;
  /** AI reasoning for the analysis */
  reasoning: string;
  /** Any warnings or issues detected */
  warnings: string[];
}

/**
 * Provider-independent interface for vision AI analysis.
 *
 * Implementations:
 * - LocalVisionProvider: For future local model integration
 * - CloudVisionProvider: For future API integration (OpenAI, etc.)
 * - MockProvider: For testing and development
 */
export interface VisionProvider {
  /** Provider name */
  readonly name: string;

  /**
   * Analyze a glyph image and return candidate mappings.
   *
   * @param request - Analysis request with glyph image and context
   * @returns Analysis response with candidates
   */
  analyze(request: GlyphAnalysisRequest): Promise<GlyphAnalysisResponse>;

  /**
   * Check if the provider is available and configured.
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Configuration for a vision provider.
 */
export interface ProviderConfig {
  /** Provider type */
  type: "local" | "cloud" | "mock";
  /** API endpoint (for cloud providers) */
  endpoint?: string;
  /** API key (for cloud providers) - NEVER committed to source */
  apiKey?: string;
  /** Model name */
  model?: string;
  /** Additional provider-specific config */
  options?: Record<string, unknown>;
}

/**
 * Font analysis metadata (generated by Python scripts).
 */
export interface FontAnalysis {
  font: KapFont;
  file: string;
  md5: string;
  metadata: {
    familyName: string | null;
    version: string | null;
    numGlyphs: number;
  };
  cmaps: {
    unicode: Record<string, string>;
    macRoman: Record<string, string>;
  };
  byteMapping: Record<string, ByteMappingEntry>;
  glyphs: Record<string, GlyphInfo>;
  byteRanges: {
    printableAscii: ByteRange;
    extendedRange: ByteRange;
    cp1252: ByteRange;
  };
  coverage: {
    printableAscii: CoverageInfo;
    extendedRange: CoverageInfo;
    cp1252: CoverageInfo;
  };
}

/**
 * Byte mapping entry from font analysis.
 */
export interface ByteMappingEntry {
  byte: number;
  hex: string;
  glyphName: string | null;
  hasGlyph: boolean;
  bbox: [number, number, number, number] | null;
  advanceWidth: number | null;
  unicodeCodepoints: number[];
}

/**
 * Glyph information from font analysis.
 */
export interface GlyphInfo {
  name: string;
  bbox: [number, number, number, number] | null;
  advanceWidth: number | null;
  unicodeCodepoints: number[];
}

/**
 * Byte range definition.
 */
export interface ByteRange {
  range: string;
  count: number;
  bytes: number[];
}

/**
 * Coverage information.
 */
export interface CoverageInfo {
  total: number;
  withGlyph: number;
}

/**
 * Glyph dataset metadata (generated by Python scripts).
 */
export interface GlyphDataset {
  font: KapFont;
  file: string;
  md5: string;
  generatedAt: string;
  glyphSize: number;
  padding: number;
  glyphs: Record<string, GlyphDatasetEntry>;
}

/**
 * Single entry in the glyph dataset.
 */
export interface GlyphDatasetEntry {
  byte: number;
  hex: string;
  charRepr: string;
  glyphName: string | null;
  hasGlyph: boolean;
  section: "ascii" | "extended" | "cp1252" | "other";
  imagePath: string;
}

/**
 * Candidate file structure.
 */
export interface CandidateFile {
  font: KapFont;
  generatedAt: string;
  provider: string;
  candidates: MappingCandidate[];
}

/**
 * Verified mapping file structure.
 */
export interface VerifiedFile {
  font: KapFont;
  verifiedAt: string;
  verifiedBy: string;
  mappings: VerifiedMapping[];
}

/**
 * A verified mapping ready for production use.
 */
export interface VerifiedMapping {
  font: KapFont;
  byte: number;
  hex: string;
  unicode: string;
  kap?: string;
  verifiedAt: string;
  verifiedBy: string;
  source: "human" | "ai_confirmed";
  confidence: number;
}

/**
 * Confidence level categories.
 */
export const CONFIDENCE_LEVELS = {
  VERY_HIGH: { min: 0.90, max: 1.00, label: "Very High" },
  HIGH: { min: 0.75, max: 0.89, label: "High" },
  MEDIUM: { min: 0.50, max: 0.74, label: "Medium" },
  LOW: { min: 0.25, max: 0.49, label: "Low" },
  VERY_LOW: { min: 0.00, max: 0.24, label: "Very Low" },
} as const;

/**
 * Get confidence category for a score.
 */
export function getConfidenceCategory(
  score: number
): "very_high" | "high" | "medium" | "low" | "very_low" {
  if (score >= 0.90) return "very_high";
  if (score >= 0.75) return "high";
  if (score >= 0.50) return "medium";
  if (score >= 0.25) return "low";
  return "very_low";
}

/**
 * Check if a Unicode string is in the Gujarati block.
 */
export function isGujaratiBlock(unicode: string): boolean {
  for (const char of unicode) {
    const cp = char.codePointAt(0)!;
    if (cp < 0x0a80 || cp > 0x0aff) {
      return false;
    }
  }
  return true;
}

/**
 * Check if a KAP output string is valid (printable ASCII).
 */
export function isValidKapOutput(kap: string): boolean {
  for (const char of kap) {
    const cp = char.codePointAt(0)!;
    if (cp < 0x20 || cp > 0x7e) {
      return false;
    }
  }
  return true;
}

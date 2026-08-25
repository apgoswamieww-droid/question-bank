/**
 * Sequence Analyzer
 * ================
 * Separate pipeline for analyzing multi-byte KAP sequences.
 *
 * Individual glyph classification is NOT sufficient for KAP fonts.
 * This module analyzes rendered sequences to identify multi-byte mappings.
 *
 * Known anchor:
 * Unicode: ગુજરાતી
 * KAP112: VF5[,F
 */

import type { SequenceAnchor } from "./types";

/**
 * Known sequence anchors for the project.
 * These MUST be preserved as sequence-level anchors.
 */
export const KNOWN_ANCHORS: SequenceAnchor[] = [
  {
    unicode: "ગુજરાતી",
    kap: "VF5[,F",
    source: "Project-origin golden sample from src/App.tsx",
    confidence: 1.0,
    font: "KAP112",
  },
];

/**
 * A sequence candidate identified by analysis.
 */
export interface SequenceCandidate {
  /** Font this sequence belongs to */
  font: string;
  /** Individual bytes in the sequence */
  bytes: string[];
  /** Decimal byte values */
  byteValues: number[];
  /** The full KAP sequence string */
  kap: string;
  /** The proposed Unicode mapping */
  unicode: string;
  /** Model confidence in this sequence */
  modelConfidence: number;
  /** Whether this is a multi-byte sequence */
  isSequence: true;
  /** Whether a human has verified this */
  humanVerified: false;
  /** Status in the pipeline */
  status: "candidate";
  /** Source of the analysis */
  source: string;
  /** Timestamp */
  generatedAt: string;
  /** AI reasoning */
  reasoning: string;
}

/**
 * Request for sequence analysis.
 */
export interface SequenceAnalysisRequest {
  /** Font name */
  font: string;
  /** KAP byte sequence */
  kapSequence: string;
  /** Individual byte values */
  byteValues: number[];
  /** Path to the rendered sequence image */
  sequenceImagePath?: string;
  /** Paths to individual glyph images */
  glyphImagePaths: string[];
  /** Known anchors for reference */
  knownAnchors?: SequenceAnchor[];
}

/**
 * Response from sequence analysis.
 */
export interface SequenceAnalysisResponse {
  /** Candidates for this sequence */
  candidates: SequenceCandidate[];
  /** Overall analysis confidence */
  analysisConfidence: number;
  /** AI reasoning */
  reasoning: string;
  /** Warnings */
  warnings: string[];
}

/**
 * Build prompt for sequence analysis.
 */
function buildSequencePrompt(request: SequenceAnalysisRequest): string {
  const byteDescriptions = request.byteValues.map((val, i) => {
    const hex = `0x${val.toString(16).toUpperCase().padStart(2, "0")}`;
    const ascii = val >= 0x20 && val <= 0x7E ? String.fromCharCode(val) : "(non-printable)";
    return `  Byte ${i + 1}: ${val} (${hex}, ASCII: ${ascii})`;
  }).join("\n");

  return `You are analyzing a SEQUENCE of glyphs from a legacy Gujarati KAP font.

CRITICAL: This is a multi-byte sequence analysis. The entire sequence may map to a SINGLE Unicode string, not individual bytes to individual characters.

CONTEXT:
- Font: ${request.font}
- KAP Sequence: ${request.kapSequence}
- Byte count: ${request.byteValues.length}

Byte breakdown:
${byteDescriptions}

KNOWN SEQUENCE ANCHORS (for reference):
${KNOWN_ANCHORS.map(a => `- "${a.kap}" → "${a.unicode}" (${a.source})`).join("\n")}

The images show:
1. The complete sequence rendered as a single glyph strip
2. Individual glyphs for each byte in the sequence

Analyze the sequence and determine:
1. What Unicode string does this entire sequence represent?
2. Is this a known sequence (like the golden sample)?
3. What is your confidence?

Return JSON:
{
  "candidates": [
    {
      "unicode": "<full Unicode string for the sequence>",
      "unicodeName": "<description>",
      "confidence": <0.0 to 1.0>,
      "reason": "<visual analysis of the sequence>",
      "isSequence": true
    }
  ],
  "isKnownSequence": <true if matches a known anchor>,
  "uncertain": <true if not confident>,
  "notes": "<additional observations>"
}`;
}

/**
 * Analyze a multi-byte KAP sequence.
 *
 * This is a separate pipeline from individual glyph analysis.
 * It takes the entire rendered sequence and proposes a Unicode mapping.
 *
 * @param request - Sequence analysis request with images and context
 * @param analyzeFn - The vision analysis function to use
 * @returns Sequence analysis response with candidates
 */
export async function analyzeSequence(
  request: SequenceAnalysisRequest,
  analyzeFn?: (imagePath: string, prompt: string) => Promise<string>
): Promise<SequenceAnalysisResponse> {
  const warnings: string[] = [];
  const candidates: SequenceCandidate[] = [];

  // Check if this matches a known anchor
  const knownMatch = KNOWN_ANCHORS.find(
    a => a.kap === request.kapSequence && a.font === request.font
  );

  if (knownMatch) {
    // Known anchor - add as a candidate with maximum confidence
    candidates.push({
      font: request.font,
      bytes: request.kapSequence.split(""),
      byteValues: request.byteValues,
      kap: request.kapSequence,
      unicode: knownMatch.unicode,
      modelConfidence: 1.0,
      isSequence: true,
      humanVerified: false,
      status: "candidate",
      source: `known-anchor: ${knownMatch.source}`,
      generatedAt: new Date().toISOString(),
      reasoning: `Known sequence anchor: "${knownMatch.kap}" → "${knownMatch.unicode}" (${knownMatch.source})`,
    });
  }

  // If we have a sequence image and analysis function, call the vision API
  if (request.sequenceImagePath && analyzeFn) {
    try {
      const prompt = buildSequencePrompt(request);
      const rawResponse = await analyzeFn(request.sequenceImagePath, prompt);

      // Parse the response (similar to individual glyph analysis)
      let parsed: unknown;
      try {
        const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, rawResponse];
        const jsonStr = jsonMatch[1] ?? rawResponse;
        parsed = JSON.parse(jsonStr);
      } catch {
        warnings.push("Failed to parse sequence analysis response");
      }

      if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;

        if (Array.isArray(obj.candidates)) {
          for (const c of obj.candidates.slice(0, 3)) {
            if (!c || typeof c !== "object") continue;
            const candidate = c as Record<string, unknown>;

            const unicode = typeof candidate.unicode === "string" ? candidate.unicode : "";
            const confidence = typeof candidate.confidence === "number" ? candidate.confidence : 0;

            if (!unicode || confidence < 0.1) continue;

            candidates.push({
              font: request.font,
              bytes: request.kapSequence.split(""),
              byteValues: request.byteValues,
              kap: request.kapSequence,
              unicode,
              modelConfidence: Math.round(confidence * 100) / 100,
              isSequence: true,
              humanVerified: false,
              status: "candidate",
              source: "openai-vision-sequence",
              generatedAt: new Date().toISOString(),
              reasoning: typeof candidate.reason === "string"
                ? candidate.reason
                : "Sequence analysis",
            });
          }
        }

        if (obj.uncertain === true) {
          warnings.push("Model reported uncertainty in sequence analysis");
        }
      }
    } catch (err) {
      warnings.push(`Sequence vision analysis failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Sort by confidence
  candidates.sort((a, b) => b.modelConfidence - a.modelConfidence);

  const analysisConfidence = candidates.length > 0
    ? Math.max(...candidates.map(c => c.modelConfidence))
    : 0;

  return {
    candidates,
    analysisConfidence,
    reasoning: candidates.length > 0
      ? `Found ${candidates.length} candidate(s) for sequence "${request.kapSequence}"`
      : `No candidates found for sequence "${request.kapSequence}"`,
    warnings,
  };
}

/**
 * Validate a sequence candidate against known anchors.
 */
export function validateSequenceCandidate(candidate: SequenceCandidate): string[] {
  const warnings: string[] = [];

  // Check against known anchors
  for (const anchor of KNOWN_ANCHORS) {
    if (candidate.kap === anchor.kap && candidate.unicode !== anchor.unicode) {
      warnings.push(
        `Candidate "${candidate.unicode}" contradicts known anchor "${anchor.unicode}" for sequence "${anchor.kap}"`
      );
    }
  }

  return warnings;
}

/**
 * Get all known sequences for a font.
 */
export function getKnownSequences(font: string): SequenceAnchor[] {
  return KNOWN_ANCHORS.filter(a => a.font === font || !a.font);
}

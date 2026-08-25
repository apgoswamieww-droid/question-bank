/**
 * Output Validation
 * ================
 * Validates AI model responses against safety rules and schemas.
 *
 * SAFETY RULES:
 * - Validation NEVER promotes a candidate automatically
 * - Only explicit human confirmation can promote
 * - Never set humanVerified=true programmatically
 */

import type { MappingCandidate, GlyphAnalysisRequest, GlyphAnalysisResponse } from "./types";
import { getConfidenceCategory, isGujaratiBlock } from "./types";

/**
 * Validation error types.
 */
export type OutputValidationErrorType =
  | "invalid_json"
  | "invalid_unicode"
  | "invalid_confidence"
  | "empty_candidates"
  | "candidate_limit_exceeded"
  | "missing_required_field"
  | "invalid_boolean"
  | "model_uncertain";

/**
 * A validation error.
 */
export interface OutputValidationError {
  type: OutputValidationErrorType;
  message: string;
  severity: "error" | "warning";
}

/**
 * Validation result for model output.
 */
export interface OutputValidationResult {
  valid: boolean;
  errors: OutputValidationError[];
  warnings: OutputValidationError[];
  parsedCandidates: Partial<MappingCandidate>[];
}

/**
 * Maximum number of candidates allowed per glyph.
 */
const MAX_CANDIDATES = 5;

/**
 * Raw model response structure.
 */
interface RawModelResponse {
  candidates?: Array<{
    unicode?: string;
    unicodeName?: string;
    confidence?: number;
    reason?: string;
    isSequence?: boolean;
  }>;
  uncertain?: boolean;
  notes?: string;
}

/**
 * Parse and validate raw model output.
 *
 * @param raw - Raw model output string
 * @param request - Original analysis request for context
 * @returns Validated and parsed response
 */
export function validateModelOutput(
  raw: string,
  request: GlyphAnalysisRequest
): OutputValidationResult {
  const errors: OutputValidationError[] = [];
  const warnings: OutputValidationError[] = [];
  const parsedCandidates: Partial<MappingCandidate>[] = [];

  // Step 1: Parse JSON
  let parsed: unknown;
  try {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : raw;
    parsed = JSON.parse(jsonStr);
  } catch {
    errors.push({
      type: "invalid_json",
      message: "Failed to parse model response as JSON",
      severity: "error",
    });
    return { valid: false, errors, warnings, parsedCandidates };
  }

  // Step 2: Validate structure
  if (!parsed || typeof parsed !== "object") {
    errors.push({
      type: "invalid_json",
      message: "Model response is not an object",
      severity: "error",
    });
    return { valid: false, errors, warnings, parsedCandidates };
  }

  const response = parsed as RawModelResponse;

  // Step 3: Check for uncertainty
  if (response.uncertain === true) {
    warnings.push({
      type: "model_uncertain",
      message: "Model reported uncertainty in analysis",
      severity: "warning",
    });
  }

  // Step 4: Validate candidates array
  if (!Array.isArray(response.candidates)) {
    errors.push({
      type: "missing_required_field",
      message: "Response missing 'candidates' array",
      severity: "error",
    });
    return { valid: false, errors, warnings, parsedCandidates };
  }

  if (response.candidates.length === 0) {
    warnings.push({
      type: "empty_candidates",
      message: "Model returned no candidates",
      severity: "warning",
    });
    return { valid: true, errors, warnings, parsedCandidates };
  }

  if (response.candidates.length > MAX_CANDIDATES) {
    warnings.push({
      type: "candidate_limit_exceeded",
      message: `Model returned ${response.candidates.length} candidates, limiting to ${MAX_CANDIDATES}`,
      severity: "warning",
    });
  }

  // Step 5: Validate each candidate
  const candidatesToProcess = response.candidates.slice(0, MAX_CANDIDATES);

  for (let i = 0; i < candidatesToProcess.length; i++) {
    const rawCandidate = candidatesToProcess[i];

    if (!rawCandidate || typeof rawCandidate !== "object") {
      errors.push({
        type: "missing_required_field",
        message: `Candidate ${i} is not an object`,
        severity: "error",
      });
      continue;
    }

    // Validate unicode
    const unicode = typeof rawCandidate.unicode === "string" ? rawCandidate.unicode : "";
    if (!unicode) {
      errors.push({
        type: "missing_required_field",
        message: `Candidate ${i} missing 'unicode' field`,
        severity: "error",
      });
      continue;
    }

    if (!isGujaratiBlock(unicode)) {
      warnings.push({
        type: "invalid_unicode",
        message: `Candidate ${i}: Unicode "${unicode}" is not in Gujarati block`,
        severity: "warning",
      });
    }

    // Validate confidence
    const confidence = typeof rawCandidate.confidence === "number"
      ? rawCandidate.confidence
      : 0;

    if (confidence < 0 || confidence > 1) {
      errors.push({
        type: "invalid_confidence",
        message: `Candidate ${i}: Confidence ${confidence} outside [0,1] range`,
        severity: "error",
      });
      continue;
    }

    // Validate boolean fields
    const isSequence = typeof rawCandidate.isSequence === "boolean"
      ? rawCandidate.isSequence
      : false;

    // Build validated candidate
    parsedCandidates.push({
      font: request.font,
      byte: request.byte,
      hex: request.hex,
      unicode,
      confidence: Math.round(confidence * 100) / 100,
      confidenceCategory: getConfidenceCategory(confidence),
      status: "candidate",
      humanVerified: false,
      reasoning: typeof rawCandidate.reason === "string"
        ? rawCandidate.reason
        : "No reasoning provided",
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        glyphName: request.glyphName ?? undefined,
        hasGlyph: request.hasGlyph,
        sequenceAnalysis: isSequence ? {
          isPartOfSequence: true,
          potentialSequences: [{
            unicode,
            kap: request.hex,
            confidence,
            reasoning: typeof rawCandidate.reason === "string" ? rawCandidate.reason : "",
          }],
        } : undefined,
      },
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    parsedCandidates,
  };
}

/**
 * Validate that a candidate is safe to add to the pipeline.
 * Ensures safety rules are maintained.
 */
export function validateCandidateSafety(candidate: MappingCandidate): OutputValidationError[] {
  const errors: OutputValidationError[] = [];

  // CRITICAL: Must never have humanVerified=true
  if (candidate.humanVerified !== false) {
    errors.push({
      type: "invalid_boolean",
      message: "humanVerified MUST be false for AI-generated candidates",
      severity: "error",
    });
  }

  // CRITICAL: Must have status="candidate"
  if (candidate.status !== "candidate") {
    errors.push({
      type: "missing_required_field",
      message: `Status must be "candidate", got "${candidate.status}"`,
      severity: "error",
    });
  }

  return errors;
}

/**
 * Validate a complete analysis response.
 */
export function validateAnalysisResponse(
  response: GlyphAnalysisResponse,
  request: GlyphAnalysisRequest
): OutputValidationResult {
  const errors: OutputValidationError[] = [];
  const warnings: OutputValidationError[] = [];
  const parsedCandidates: Partial<MappingCandidate>[] = [];

  // Validate each candidate in the response
  for (const candidate of response.candidates) {
    const safetyErrors = validateCandidateSafety(candidate);
    for (const err of safetyErrors) {
      if (err.severity === "error") {
        errors.push(err);
      } else {
        warnings.push(err);
      }
    }

    // Check font isolation
    if (candidate.font !== request.font) {
      errors.push({
        type: "invalid_unicode",
        message: `Candidate font "${candidate.font}" does not match request font "${request.font}"`,
        severity: "error",
      });
    }

    parsedCandidates.push(candidate);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    parsedCandidates,
  };
}

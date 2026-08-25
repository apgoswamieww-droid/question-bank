/**
 * Candidate Validation
 * ====================
 * Validates AI-generated mapping candidates against safety rules.
 *
 * SAFETY RULES:
 * - Validation NEVER promotes a candidate automatically
 * - Only explicit human confirmation can promote
 * - Never set humanVerified=true programmatically
 * - Never set verified=true in mapping files
 */

import type {
  CandidateFile,
  MappingCandidate,
  SequenceAnchor,
} from "./types";
import { isGujaratiBlock, isValidKapOutput } from "./types";

/**
 * Known sequence anchors for validation.
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
 * Validation error types.
 */
export type ValidationErrorType =
  | "invalid_unicode"
  | "invalid_kap_output"
  | "duplicate_mapping"
  | "conflicting_mapping"
  | "empty_mapping"
  | "invalid_confidence"
  | "human_verified_set"
  | "status_not_candidate"
  | "font_mismatch"
  | "contradicts_known_anchor";

/**
 * A validation error for a candidate.
 */
export interface ValidationError {
  type: ValidationErrorType;
  message: string;
  candidate: MappingCandidate;
  severity: "error" | "warning";
}

/**
 * Validation result for a candidate file.
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    warnings: number;
  };
}

/**
 * Validate a single candidate against safety rules.
 */
export function validateCandidate(
  candidate: MappingCandidate
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check 1: Status must be "candidate"
  if (candidate.status !== "candidate") {
    errors.push({
      type: "status_not_candidate",
      message: `Status must be "candidate", got "${candidate.status}"`,
      candidate,
      severity: "error",
    });
  }

  // Check 2: humanVerified must be false
  if (candidate.humanVerified !== false) {
    errors.push({
      type: "human_verified_set",
      message: "humanVerified must be false for AI-generated candidates",
      candidate,
      severity: "error",
    });
  }

  // Check 3: Unicode must be in Gujarati block (if provided)
  if (candidate.unicode && !isGujaratiBlock(candidate.unicode)) {
    errors.push({
      type: "invalid_unicode",
      message: `Unicode "${candidate.unicode}" is not in Gujarati block (U+0A80-U+0AFF)`,
      candidate,
      severity: "error",
    });
  }

  // Check 4: KAP output must be valid (if provided)
  if (candidate.kap && !isValidKapOutput(candidate.kap)) {
    errors.push({
      type: "invalid_kap_output",
      message: `KAP output "${candidate.kap}" contains invalid characters`,
      candidate,
      severity: "error",
    });
  }

  // Check 5: Confidence must be in valid range
  if (candidate.confidence < 0 || candidate.confidence > 1) {
    errors.push({
      type: "invalid_confidence",
      message: `Confidence ${candidate.confidence} is outside valid range [0, 1]`,
      candidate,
      severity: "error",
    });
  }

  // Check 6: Must have either unicode or kap
  if (!candidate.unicode && !candidate.kap) {
    errors.push({
      type: "empty_mapping",
      message: "Candidate must have either unicode or kap value",
      candidate,
      severity: "warning",
    });
  }

  return errors;
}

/**
 * Check for duplicate candidates (same byte, same unicode).
 */
export function findDuplicates(
  candidates: MappingCandidate[]
): MappingCandidate[][] {
  const byByteUnicode = new Map<string, MappingCandidate[]>();

  for (const c of candidates) {
    const key = `${c.byte}:${c.unicode}`;
    const group = byByteUnicode.get(key) ?? [];
    group.push(c);
    byByteUnicode.set(key, group);
  }

  return Array.from(byByteUnicode.values()).filter((group) => group.length > 1);
}

/**
 * Check for conflicting candidates (same byte, different unicode).
 */
export function findConflicts(
  candidates: MappingCandidate[]
): MappingCandidate[][] {
  const byByte = new Map<number, MappingCandidate[]>();

  for (const c of candidates) {
    const group = byByte.get(c.byte) ?? [];
    group.push(c);
    byByte.set(c.byte, group);
  }

  return Array.from(byByte.values())
    .filter((group) => {
      const unicodes = new Set(group.map((c) => c.unicode));
      return unicodes.size > 1;
    });
}

/**
 * Check if any candidates contradict known anchors.
 */
export function findAnchorContradictions(
  candidates: MappingCandidate[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  // For each known anchor, check if any candidate contradicts it
  for (const anchor of KNOWN_ANCHORS) {
    // Find candidates for bytes in the anchor's KAP sequence
    const anchorBytes = Array.from(anchor.kap).map((ch) => ch.charCodeAt(0));

    for (let i = 0; i < anchorBytes.length; i++) {
      const byte = anchorBytes[i];
      const unicodeChar = anchor.unicode[i];

      // Find candidates for this byte
      const byteCandidates = candidates.filter((c) => c.byte === byte);

      for (const c of byteCandidates) {
        // If candidate maps to different unicode, it contradicts the anchor
        if (c.unicode && c.unicode !== unicodeChar) {
          errors.push({
            type: "contradicts_known_anchor",
            message: `Candidate "${c.unicode}" for byte ${c.hex} contradicts known anchor "${anchor.unicode}" → "${anchor.kap}"`,
            candidate: c,
            severity: "warning",
          });
        }
      }
    }
  }

  return errors;
}

/**
 * Validate an entire candidate file.
 */
export function validateCandidateFile(
  candidateFile: CandidateFile
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Validate each candidate
  for (const candidate of candidateFile.candidates) {
    const candidateErrors = validateCandidate(candidate);
    for (const error of candidateErrors) {
      if (error.severity === "error") {
        errors.push(error);
      } else {
        warnings.push(error);
      }
    }
  }

  // Check for duplicates
  const duplicates = findDuplicates(candidateFile.candidates);
  for (const group of duplicates) {
    for (const c of group) {
      errors.push({
        type: "duplicate_mapping",
        message: `Duplicate mapping: byte ${c.hex} → "${c.unicode}" appears ${group.length} times`,
        candidate: c,
        severity: "error",
      });
    }
  }

  // Check for conflicts
  const conflicts = findConflicts(candidateFile.candidates);
  for (const group of conflicts) {
    for (const c of group) {
      warnings.push({
        type: "conflicting_mapping",
        message: `Conflicting mapping: byte ${c.hex} has multiple unicode candidates`,
        candidate: c,
        severity: "warning",
      });
    }
  }

  // Check for anchor contradictions
  const anchorErrors = findAnchorContradictions(candidateFile.candidates);
  warnings.push(...anchorErrors);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      total: candidateFile.candidates.length,
      valid: candidateFile.candidates.length - errors.length,
      invalid: errors.length,
      warnings: warnings.length,
    },
  };
}

/**
 * Filter out invalid candidates, keeping only valid ones.
 */
export function filterValidCandidates(
  candidates: MappingCandidate[]
): MappingCandidate[] {
  return candidates.filter((c) => {
    const errors = validateCandidate(c);
    return errors.filter((e) => e.severity === "error").length === 0;
  });
}

/**
 * Get validation summary for a candidate file.
 */
export function getValidationSummary(result: ValidationResult): string {
  const lines = [
    `Validation ${result.valid ? "PASSED" : "FAILED"}`,
    `Total candidates: ${result.summary.total}`,
    `Valid: ${result.summary.valid}`,
    `Invalid: ${result.summary.invalid}`,
    `Warnings: ${result.summary.warnings}`,
  ];

  if (result.errors.length > 0) {
    lines.push("", "Errors:");
    for (const error of result.errors.slice(0, 10)) {
      lines.push(`  - [${error.type}] ${error.message}`);
    }
    if (result.errors.length > 10) {
      lines.push(`  ... and ${result.errors.length - 10} more errors`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push("", "Warnings:");
    for (const warning of result.warnings.slice(0, 10)) {
      lines.push(`  - [${warning.type}] ${warning.message}`);
    }
    if (result.warnings.length > 10) {
      lines.push(`  ... and ${result.warnings.length - 10} more warnings`);
    }
  }

  return lines.join("\n");
}

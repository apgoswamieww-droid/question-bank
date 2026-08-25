/**
 * Core types for the Gujarati Unicode <-> legacy KAP ASCII conversion engine.
 *
 * IMPORTANT: This module must stay free of DOM/React imports so the engine
 * can run in Node (tests) as well as the Electron renderer.
 */

/**
 * Single source of truth for supported KAP fonts.
 * To add a new font: add it here, then run `node scripts/add-font.mjs <FONT>`.
 */
export const KAP_FONTS = ["KAP110", "KAP111", "KAP112", "KAP122"] as const;

export type KapFont = (typeof KAP_FONTS)[number];

/**
 * A single verified mapping rule.
 * `unicode` may be a multi-character sequence (conjuncts, matra clusters).
 */
export interface ConversionRule {
  unicode: string;
  kap: string;
}

/**
 * The complete rule set for one KAP font.
 * `verified` MUST remain false until a human has checked the table
 * against real KAP reference material. The engine refuses to convert
 * with unverified mappings so that we never fabricate output silently.
 */
export interface FontMapping {
  font: KapFont;
  rules: ConversionRule[];
  verified: boolean;
  /** Where the rules came from (e.g. "vendor table", "not yet provided"). */
  source: string;
}

/** Registry entry used by the UI to report mapping readiness. */
export interface MappingStatus {
  font: KapFont;
  loaded: boolean;
  verified: boolean;
  ruleCount: number;
  source: string;
  /** Validation problems detected in the table (duplicates, conflicts...). */
  validationErrors: string[];
}

/**
 * A golden pair taken from trusted project/reference data.
 * Used by tests; never invented to make tests pass.
 */
export interface VerifiedSample {
  unicode: string;
  expected: string;
  source: string;
}

export interface ConversionWarning {
  /** Character index of the problem inside the ORIGINAL input string. */
  index: number;
  /** The offending input substring. */
  input: string;
  reason: string;
}

export interface ConversionResult {
  input: string;
  output: string;
  font: KapFont;
  warnings: ConversionWarning[];
  /**
   * False when the selected font has no loaded+verified mapping yet.
   * In that case `output === input` and the UI must tell the user why.
   */
  mappingAvailable: boolean;
  /** Count of Gujarati characters successfully mapped. */
  convertedChars: number;
  /** Total count of Gujarati characters encountered in the input. */
  totalGujaratiChars: number;
}

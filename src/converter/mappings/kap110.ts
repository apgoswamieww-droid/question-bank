import type { ConversionRule, VerifiedSample } from "../types";

/**
 * KAP110 — Unicode -> legacy mapping table.
 *
 * STATUS: NOT PROVIDED YET.
 *
 * HOW TO FILL THIS IN (when a verified table is available):
 *   1. Append rules as { unicode: "ક્ષ", kap: "<legacy>" } entries below.
 *      - Multi-character sequences are REQUIRED for conjuncts and
 *        pre-base matras (e.g. map "કિ" as a whole if the legacy font
 *        needs its matra glyph before the consonant).
 *   2. The engine sorts longest-sequence-first automatically and
 *      validates duplicates/conflicts at load time.
 *   3. Add trusted input/output pairs to KAP110_SAMPLES so the test
 *      harness can prove correctness.
 *   4. Flip `verified` to true in mappings/index.ts ONLY after a human
 *      has checked rendered output against real KAP reference material.
 */

export const KAP110_RULES: ConversionRule[] = [];

export const KAP110_SAMPLES: VerifiedSample[] = [];

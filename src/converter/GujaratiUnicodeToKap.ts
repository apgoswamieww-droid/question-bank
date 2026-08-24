/**
 * Gujarati Unicode -> legacy KAP ASCII conversion engine.
 *
 * Pipeline:
 *   normalize (NFC) -> segment runs -> longest-match rule application
 *   -> cluster-level warnings for unsupported input -> result
 *
 * Non-Gujarati text (English, numbers, punctuation, whitespace,
 * newlines) is always preserved verbatim. Unsupported Gujarati
 * clusters are preserved AND reported — never silently destroyed.
 *
 * Pure string processing: no DOM/React/Node APIs.
 */

import type { ConversionResult, ConversionWarning, KapFont } from "./types";
import {
  isCombiningOrJoiner,
  normalizeInput,
  segmentRuns,
  takeCluster,
} from "./conversionUtils";
import { getMappingStatus } from "./mappings";
import { validateAndSortRules } from "./validation";
import { getRegistryEntry } from "./mappings";

/** Characters of Gujarati text covered by successful conversions. */
function countBaseChars(text: string): number {
  let count = 0;
  for (const ch of text) {
    if (!isCombiningOrJoiner(ch.codePointAt(0) ?? 0)) count++;
  }
  return count;
}

export function convertGujaratiUnicodeToKap(
  rawText: string,
  font: KapFont
): ConversionResult {
  const status = getMappingStatus(font);

  if (!status.loaded) {
    // Honest failure mode: never fabricate output without verified data.
    const reason = status.validationErrors.length
      ? `Mapping table for ${font} failed validation`
      : `Verified mapping table for ${font} has not been provided yet`;
    return {
      input: rawText,
      output: rawText,
      font,
      mappingAvailable: false,
      convertedChars: 0,
      totalGujaratiChars: rawText ? countBaseChars(normalizeInput(rawText)) : 0,
      warnings: rawText ? [{ index: 0, input: rawText, reason }] : [],
    };
  }

  const entry = getRegistryEntry(font);
  const { sortedRules } = validateAndSortRules(entry.rules);
  const normalized = normalizeInput(rawText);
  const warnings: ConversionWarning[] = [];

  const runs = segmentRuns(normalized);
  let output = "";
  let convertedChars = 0;
  let totalGujaratiChars = 0;

  for (const run of runs) {
    if (!run.gujarati) {
      output += run.text;
      continue;
    }

    let i = 0;
    while (i < run.text.length) {
      let matched = false;

      // Longest sequences first — guaranteed by validation sort.
      for (const rule of sortedRules) {
        if (run.text.startsWith(rule.unicode, i)) {
          output += rule.kap;
          i += rule.unicode.length;
          convertedChars += rule.unicode.length;
          matched = true;
          break;
        }
      }

      if (!matched) {
        // Preserve the whole cluster and warn instead of destroying it.
        const cluster = takeCluster(run.text, i);
        warnings.push({
          index: run.start + i,
          input: cluster,
          reason: "unsupported_sequence",
        });
        output += cluster;
        i += cluster.length;
      }
    }
    totalGujaratiChars += run.text.length;
  }

  return {
    input: rawText,
    output,
    font,
    mappingAvailable: true,
    convertedChars,
    totalGujaratiChars,
    warnings,
  };
}

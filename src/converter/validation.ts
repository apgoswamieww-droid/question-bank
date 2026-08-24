/**
 * Mapping table validation.
 * Guards against duplicate keys, conflicting outputs, malformed entries
 * and produces the longest-sequence-first ordering the engine requires.
 */

import type { ConversionRule, FontMapping, VerifiedSample } from "./types";
import { containsGujarati } from "./conversionUtils";

export interface MappingValidation {
  ok: boolean;
  errors: string[];
  /** Rules sorted so longer (more specific) sequences match first. */
  sortedRules: ConversionRule[];
}

export function validateAndSortRules(rules: ConversionRule[]): MappingValidation {
  const errors: string[] = [];
  const seen = new Map<string, string>();

  rules.forEach((rule, i) => {
    const label = `rule #${i} ("${rule.unicode}")`;

    if (!rule.unicode || !rule.kap) {
      errors.push(`${label}: empty unicode or kap side`);
      return;
    }
    if (!containsGujarati(rule.unicode)) {
      errors.push(`${label}: unicode side has no Gujarati characters`);
    }
    if (!/^[\x20-\x7e]+$/.test(rule.kap)) {
      errors.push(`${label}: kap side must be printable ASCII/legacy data`);
      return;
    }

    const existing = seen.get(rule.unicode);
    if (existing === undefined) {
      seen.set(rule.unicode, rule.kap);
    } else if (existing !== rule.kap) {
      errors.push(
        `${label}: conflicts with earlier rule mapping "${rule.unicode}" -> "${existing}"`
      );
    }
    // Identical duplicates are tolerated silently (deduped by map ordering).
  });

  const sortedRules = [...rules].sort(
    (a, b) => b.unicode.length - a.unicode.length || a.unicode.localeCompare(b.unicode)
  );

  return { ok: errors.length === 0, errors, sortedRules };
}

/**
 * Report which single Gujarati consonants/vowels lack any rule.
 * Useful as a checklist when filling in a mapping table.
 */
export function missingCoreCoverage(rules: ConversionRule[]): string[] {
  const core = "કખગઘઙચછજઝઞટઠડઢણતથદધનપફબભમયરલવશષસહળક્ષજ્ઞઅઆઇઈઉઊઋએઐઓઔઅંઅઃ".split("");
  const covered = new Set(rules.flatMap((r) => Array.from(r.unicode)));
  return core.filter((ch) => !covered.has(ch));
}

export interface SampleCheck {
  sample: VerifiedSample;
  pass: boolean | null; // null = cannot check (mapping not loaded)
  actual: string | null;
}

/** Validate golden samples against the sorted rule set (used by tests). */
export function checkSamples(
  samples: VerifiedSample[],
  convertFn: (text: string) => string,
  mappingLoaded: boolean
): SampleCheck[] {
  if (!mappingLoaded) {
    return samples.map((sample) => ({ sample, pass: null, actual: null }));
  }
  return samples.map((sample) => ({
    sample,
    pass: convertFn(sample.unicode) === sample.expected,
    actual: convertFn(sample.unicode),
  }));
}

/** Convenience wrapper for the registry. */
export function validateMapping(mapping: FontMapping): MappingValidation & {
  loaded: boolean;
} {
  const result = validateAndSortRules(mapping.rules);
  return { ...result, loaded: mapping.verified && result.ok };
}

import { KAP_FONTS, type KapFont, type ConversionRule, type FontMapping, type MappingStatus, type VerifiedSample } from "../types";
import { validateAndSortRules } from "../validation";
import { KAP110_RULES, KAP110_SAMPLES } from "./kap110";
import { KAP111_RULES, KAP111_SAMPLES } from "./kap111";
import { KAP112_RULES, KAP112_SAMPLES } from "./kap112";
import { KAP122_RULES, KAP122_SAMPLES } from "./kap122";

/**
 * Central mapping registry.
 *
 * A font becomes convertible ONLY when `verified` is true AND its rules
 * pass validation. Until real tables are supplied, every font reports
 * `loaded: false` and the engine refuses to fabricate output.
 */

interface RegistryEntry extends FontMapping {
  samples: VerifiedSample[];
}

/** Per-font mapping data — add new font imports above and entry here. */
const FONT_DATA: Record<KapFont, { rules: ConversionRule[]; samples: VerifiedSample[]; source: string }> = {
  KAP110: { rules: KAP110_RULES, samples: KAP110_SAMPLES, source: "not provided yet" },
  KAP111: { rules: KAP111_RULES, samples: KAP111_SAMPLES, source: "not provided yet" },
  KAP112: { rules: KAP112_RULES, samples: KAP112_SAMPLES, source: "partial - 1 golden sample only (see kap112.ts)" },
  KAP122: { rules: KAP122_RULES, samples: KAP122_SAMPLES, source: "not provided yet" },
};

const REGISTRY: Record<KapFont, RegistryEntry> = Object.fromEntries(
  KAP_FONTS.map((font) => [
    font,
    { font, ...FONT_DATA[font], verified: false },
  ]),
) as Record<KapFont, RegistryEntry>;

/** Cached sorted/validated view per font. */
const cache = new Map<KapFont, MappingStatus>();

export function getMappingStatus(font: KapFont): MappingStatus {
  const cached = cache.get(font);
  if (cached) return cached;

  const entry = REGISTRY[font];
  const validation = validateAndSortRules(entry.rules);
  const status: MappingStatus = {
    font,
    loaded: entry.verified && validation.ok && entry.rules.length > 0,
    verified: entry.verified,
    ruleCount: entry.rules.length,
    source: entry.source,
    validationErrors: validation.errors,
  };
  cache.set(font, status);
  return status;
}

export function getAllMappingStatuses(): MappingStatus[] {
  return (Object.keys(REGISTRY) as KapFont[]).map(getMappingStatus);
}

/** Internal access for the engine/tests. */
export function getRegistryEntry(font: KapFont): RegistryEntry {
  return REGISTRY[font];
}

/**
 * Test-only injection point so the pipeline can be exercised without
 * real vendor data. Never call from production UI code.
 */
export function __setMappingForTests(entry: FontMapping & { samples?: VerifiedSample[] }): void {
  REGISTRY[entry.font] = {
    font: entry.font,
    rules: entry.rules,
    verified: entry.verified,
    source: entry.source,
    samples: entry.samples ?? [],
  };
  cache.delete(entry.font);
}

/** Restore the shipped (unverified) registry state after tests mutated it. */
export function __resetMappingsForTests(): void {
  for (const font of KAP_FONTS) {
    const d = FONT_DATA[font];
    REGISTRY[font] = {
      font,
      rules: [...d.rules],
      verified: false,
      source: d.source,
      samples: [...d.samples],
    };
    cache.delete(font);
  }
}

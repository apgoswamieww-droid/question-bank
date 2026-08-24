import type { ConversionRule, VerifiedSample } from "../types";

/**
 * KAP112 — Unicode -> legacy mapping table.
 *
 * STATUS: PARTIALLY VERIFIED (1 golden sample).
 *
 * The project's own default editor content (src/App.tsx) renders the
 * legacy string below with font-family KAP112, giving us one trusted
 * pair. The full table must still be supplied before conversion is
 * enabled — see kap110.ts for fill-in instructions.
 */

export const KAP112_RULES: ConversionRule[] = [];

export const KAP112_SAMPLES: VerifiedSample[] = [
  {
    unicode: "ગુજરાતી",
    expected: "VF5[,F",
    source: "Default editor content in src/App.tsx (KAP112 span)",
  },
];

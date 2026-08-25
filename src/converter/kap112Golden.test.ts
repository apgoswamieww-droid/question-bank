/**
 * Golden sample test for KAP112.
 *
 * This test validates the known project-origin sample INDEPENDENTLY
 * from the mapping table. The expected output is stored here, not in
 * the mapping rules. A passing test does NOT mean the font is verified.
 *
 * The test exists to validate the conversion implementation against
 * the known project-origin sample.
 */

import { describe, it, expect } from "vitest";
import { checkSamples } from "./validation";
import type { VerifiedSample } from "./types";

/**
 * Project-origin golden sample.
 * Source: src/App.tsx default editor content renders
 * <span style="font-family: KAP112; font-size: 24px;">VF5[,F VF5[,F</span>
 * alongside the Unicode text ગુજરાતી.
 */
const KAP112_GOLDEN_SAMPLES: VerifiedSample[] = [
  {
    unicode: "ગુજરાતી",
    expected: "VF5[,F",
    source: "Default editor content in src/App.tsx (KAP112 span)",
  },
];

describe("KAP112 golden sample (independent)", () => {
  it("golden sample is defined", () => {
    expect(KAP112_GOLDEN_SAMPLES).toHaveLength(1);
    expect(KAP112_GOLDEN_SAMPLES[0].unicode).toBe("ગુજરાતી");
    expect(KAP112_GOLDEN_SAMPLES[0].expected).toBe("VF5[,F");
  });

  it("golden sample source is documented", () => {
    expect(KAP112_GOLDEN_SAMPLES[0].source).toContain("App.tsx");
  });

  it("checkSamples returns null when mapping not loaded", () => {
    const results = checkSamples(
      KAP112_GOLDEN_SAMPLES,
      () => "not_loaded",
      false
    );
    expect(results[0].pass).toBeNull();
    expect(results[0].actual).toBeNull();
  });

  it("checkSamples validates against conversion function", () => {
    const mockConvert = (text: string) => {
      if (text === "ગુજરાતી") return "VF5[,F";
      return text;
    };
    const results = checkSamples(KAP112_GOLDEN_SAMPLES, mockConvert, true);
    expect(results[0].pass).toBe(true);
    expect(results[0].actual).toBe("VF5[,F");
  });

  it("checkSamples detects wrong output", () => {
    const mockConvert = (text: string) => {
      if (text === "ગુજરાતી") return "WRONG";
      return text;
    };
    const results = checkSamples(KAP112_GOLDEN_SAMPLES, mockConvert, true);
    expect(results[0].pass).toBe(false);
    expect(results[0].actual).toBe("WRONG");
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { convertGujaratiUnicodeToKap } from "./GujaratiUnicodeToKap";
import {
  __setMappingForTests,
  __resetMappingsForTests,
} from "./mappings";

describe("convertGujaratiUnicodeToKap", () => {
  afterEach(() => {
    __resetMappingsForTests();
  });

  describe("with unverified mappings (default state)", () => {
    it("returns mappingAvailable=false for all fonts", () => {
      const result = convertGujaratiUnicodeToKap("કા", "KAP110");
      expect(result.mappingAvailable).toBe(false);
      expect(result.output).toBe("કા");
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("preserves input unchanged", () => {
      const input = "Hello કા World";
      const result = convertGujaratiUnicodeToKap(input, "KAP112");
      expect(result.output).toBe(input);
      expect(result.mappingAvailable).toBe(false);
    });
  });

  describe("with mock verified mapping", () => {
    beforeEach(() => {
      __setMappingForTests({
        font: "KAP112",
        rules: [
          { unicode: "ક", kap: "K" },
          { unicode: "ા", kap: "a" },
          { unicode: "ગ", kap: "G" },
          { unicode: "ુ", kap: "u" },
          { unicode: "જ", kap: "J" },
          { unicode: "ર", kap: "R" },
          { unicode: "ત", kap: "t" },
          { unicode: "ી", kap: "i" },
        ],
        verified: true,
        source: "test mock",
      });
    });

    it("returns mappingAvailable=true", () => {
      const result = convertGujaratiUnicodeToKap("ક", "KAP112");
      expect(result.mappingAvailable).toBe(true);
    });

    it("converts single characters", () => {
      const result = convertGujaratiUnicodeToKap("ક", "KAP112");
      expect(result.output).toBe("K");
      expect(result.convertedChars).toBe(1);
    });

    it("converts composed sequences (longest match)", () => {
      const result = convertGujaratiUnicodeToKap("કા", "KAP112");
      expect(result.output).toBe("Ka");
      expect(result.convertedChars).toBe(2);
    });

    it("converts mixed Gujarati and English", () => {
      const result = convertGujaratiUnicodeToKap("ક Hello ગ", "KAP112");
      expect(result.output).toBe("K Hello G");
    });

    it("converts ગુજરાતી to expected output", () => {
      const result = convertGujaratiUnicodeToKap("ગુજરાતી", "KAP112");
      expect(result.output).toBe("GuJRati");
      expect(result.mappingAvailable).toBe(true);
    });

    it("preserves numbers", () => {
      const result = convertGujaratiUnicodeToKap("123 ક 456", "KAP112");
      expect(result.output).toBe("123 K 456");
    });

    it("preserves punctuation", () => {
      const result = convertGujaratiUnicodeToKap("ક. ગ!", "KAP112");
      expect(result.output).toBe("K. G!");
    });

    it("reports unsupported sequences as warnings", () => {
      // Add a rule for a character we DON'T have
      const result = convertGujaratiUnicodeToKap("ડ", "KAP112");
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].reason).toBe("unsupported_sequence");
    });

    it("counts conversion statistics correctly", () => {
      const result = convertGujaratiUnicodeToKap("કાગ", "KAP112");
      expect(result.totalGujaratiChars).toBe(3);
      expect(result.convertedChars).toBe(3);
    });

    it("handles empty input", () => {
      const result = convertGujaratiUnicodeToKap("", "KAP112");
      expect(result.output).toBe("");
      expect(result.warnings).toHaveLength(0);
      expect(result.totalGujaratiChars).toBe(0);
    });

    it("handles pure English input", () => {
      const result = convertGujaratiUnicodeToKap("Hello World", "KAP112");
      expect(result.output).toBe("Hello World");
      expect(result.totalGujaratiChars).toBe(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("handles newlines between Gujarati runs", () => {
      const result = convertGujaratiUnicodeToKap("ક\nગ", "KAP112");
      expect(result.output).toBe("K\nG");
    });
  });

  describe("longest-match-first behavior", () => {
    beforeEach(() => {
      __setMappingForTests({
        font: "KAP112",
        rules: [
          { unicode: "ક", kap: "K" },
          { unicode: "ક્ષ", kap: "Ksha" },
          { unicode: "કા", kap: "Ka" },
        ],
        verified: true,
        source: "test mock",
      });
    });

    it("matches longer sequences before shorter ones", () => {
      const result = convertGujaratiUnicodeToKap("ક્ષ", "KAP112");
      expect(result.output).toBe("Ksha");
    });

    it("matches matra cluster before base alone", () => {
      const result = convertGujaratiUnicodeToKap("કા", "KAP112");
      expect(result.output).toBe("Ka");
    });
  });
});

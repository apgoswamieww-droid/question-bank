import { describe, it, expect } from "vitest";
import {
  isGujaratiCodePoint,
  isGujaratiChar,
  isCombiningOrJoiner,
  segmentRuns,
  takeCluster,
  normalizeInput,
  containsGujarati,
  looksLikeLegacyKap,
} from "./conversionUtils";

describe("isGujaratiCodePoint", () => {
  it("returns true for Gujarati characters", () => {
    expect(isGujaratiCodePoint(0x0a80)).toBe(true);
    expect(isGujaratiCodePoint(0x0a85)).toBe(true);
    expect(isGujaratiCodePoint(0x0ac7)).toBe(true);
    expect(isGujaratiCodePoint(0x0aff)).toBe(true);
  });

  it("returns false for non-Gujarati characters", () => {
    expect(isGujaratiCodePoint(0x0900)).toBe(false); // Devanagari
    expect(isGujaratiCodePoint(0x0041)).toBe(false); // Latin A
    expect(isGujaratiCodePoint(0x0030)).toBe(false); // Digit 0
    expect(isGujaratiCodePoint(0x0a7f)).toBe(false); // Just below Gujarati block
    expect(isGujaratiCodePoint(0x0b00)).toBe(false); // Just above Gujarati block
  });
});

describe("isGujaratiChar", () => {
  it("returns true for single Gujarati characters", () => {
    expect(isGujaratiChar("ક")).toBe(true);
    expect(isGujaratiChar("ખ")).toBe(true);
    expect(isGujaratiChar("ગ")).toBe(true);
  });

  it("returns false for multi-character strings", () => {
    expect(isGujaratiChar("કા")).toBe(false);
    expect(isGujaratiChar("ab")).toBe(false);
  });

  it("returns false for non-Gujarati characters", () => {
    expect(isGujaratiChar("A")).toBe(false);
    expect(isGujaratiChar("1")).toBe(false);
  });
});

describe("isCombiningOrJoiner", () => {
  it("returns true for ZWJ and ZWNJ", () => {
    expect(isCombiningOrJoiner(0x200c)).toBe(true);
    expect(isCombiningOrJoiner(0x200d)).toBe(true);
  });

  it("returns true for Gujarati combining marks", () => {
    expect(isCombiningOrJoiner(0x0a81)).toBe(true); // Chandrabindu
    expect(isCombiningOrJoiner(0x0a82)).toBe(true); // Anusvara
    expect(isCombiningOrJoiner(0x0a83)).toBe(true); // Visarga
    expect(isCombiningOrJoiner(0x0abc)).toBe(true); // Nukta
    expect(isCombiningOrJoiner(0x0abe)).toBe(true); // Vowel sign aa
    expect(isCombiningOrJoiner(0x0acd)).toBe(true); // Halant
  });

  it("returns false for Gujarati base characters", () => {
    expect(isCombiningOrJoiner(0x0a85)).toBe(false); // A
    expect(isCombiningOrJoiner(0x0a95)).toBe(false); // Ka
  });

  it("returns false for non-Gujarati code points", () => {
    expect(isCombiningOrJoiner(0x0041)).toBe(false);
  });
});

describe("segmentRuns", () => {
  it("returns empty array for empty input", () => {
    expect(segmentRuns("")).toEqual([]);
  });

  it("segments pure Gujarati text", () => {
    const runs = segmentRuns("કા");
    expect(runs).toHaveLength(1);
    expect(runs[0].gujarati).toBe(true);
    expect(runs[0].text).toBe("કા");
    expect(runs[0].start).toBe(0);
  });

  it("segments pure English text", () => {
    const runs = segmentRuns("Hello");
    expect(runs).toHaveLength(1);
    expect(runs[0].gujarati).toBe(false);
    expect(runs[0].text).toBe("Hello");
  });

  it("segments mixed Gujarati and English", () => {
    const runs = segmentRuns("Hello કા World");
    expect(runs).toHaveLength(3);
    expect(runs[0]).toEqual({ gujarati: false, text: "Hello ", start: 0 });
    expect(runs[1]).toEqual({ gujarati: true, text: "કા", start: 6 });
    expect(runs[2]).toEqual({ gujarati: false, text: " World", start: 8 });
  });

  it("handles Gujarati at start and end", () => {
    const runs = segmentRuns("કાHelloકા");
    expect(runs).toHaveLength(3);
    expect(runs[0].gujarati).toBe(true);
    expect(runs[1].gujarati).toBe(false);
    expect(runs[2].gujarati).toBe(true);
  });

  it("preserves whitespace in non-Gujarati runs", () => {
    const runs = segmentRuns("  ");
    expect(runs).toHaveLength(1);
    expect(runs[0].text).toBe("  ");
  });
});

describe("takeCluster", () => {
  it("takes a single base character", () => {
    expect(takeCluster("ક", 0)).toBe("ક");
  });

  it("takes a base character with combining marks", () => {
    expect(takeCluster("કા", 0)).toBe("કા");
  });

  it("takes a cluster from the middle of text", () => {
    expect(takeCluster("abcકાdef", 3)).toBe("કા");
  });

  it("stops at a non-combining character", () => {
    expect(takeCluster("કાabc", 0)).toBe("કા");
  });
});

describe("normalizeInput", () => {
  it("normalizes composed to NFC", () => {
    // Two-character decomposed form vs single composed form
    const decomposed = "ક\u0ACD"; // ka + halant (decomposed)
    const normalized = normalizeInput(decomposed);
    expect(normalized).toBe("ક\u0ACD");
  });

  it("returns ASCII unchanged", () => {
    expect(normalizeInput("Hello 123")).toBe("Hello 123");
  });

  it("returns empty string unchanged", () => {
    expect(normalizeInput("")).toBe("");
  });
});

describe("containsGujarati", () => {
  it("returns true for text with Gujarati characters", () => {
    expect(containsGujarati("Hello ક World")).toBe(true);
    expect(containsGujarati("ક")).toBe(true);
  });

  it("returns false for text without Gujarati characters", () => {
    expect(containsGujarati("Hello World")).toBe(false);
    expect(containsGujarati("123")).toBe(false);
    expect(containsGujarati("")).toBe(false);
  });
});

describe("looksLikeLegacyKap", () => {
  it("detects legacy KAP-like text", () => {
    expect(looksLikeLegacyKap("VF5[,F")).toBe(true);
    expect(looksLikeLegacyKap("abc;def[")).toBe(true);
  });

  it("returns false for plain English", () => {
    expect(looksLikeLegacyKap("Hello World")).toBe(false);
  });

  it("returns false for Gujarati text", () => {
    expect(looksLikeLegacyKap("કા")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(looksLikeLegacyKap("")).toBe(false);
  });

  it("returns false for numbers only", () => {
    expect(looksLikeLegacyKap("12345")).toBe(false);
  });
});

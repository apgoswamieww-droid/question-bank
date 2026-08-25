import { describe, it, expect } from "vitest";
import {
  validateAndSortRules,
  missingCoreCoverage,
  validateMapping,
} from "./validation";
import type { ConversionRule, FontMapping } from "./types";

describe("validateAndSortRules", () => {
  it("returns ok for valid rules", () => {
    const rules: ConversionRule[] = [
      { unicode: "ક", kap: "K" },
      { unicode: "કા", kap: "Ka" },
    ];
    const result = validateAndSortRules(rules);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("sorts longer sequences first", () => {
    const rules: ConversionRule[] = [
      { unicode: "ક", kap: "K" },
      { unicode: "કા", kap: "Ka" },
      { unicode: "ક્ષ", kap: "Ksha" },
    ];
    const result = validateAndSortRules(rules);
    expect(result.sortedRules[0].unicode).toBe("ક્ષ");
    expect(result.sortedRules[1].unicode).toBe("કા");
    expect(result.sortedRules[2].unicode).toBe("ક");
  });

  it("detects empty unicode side", () => {
    const rules: ConversionRule[] = [{ unicode: "", kap: "K" }];
    const result = validateAndSortRules(rules);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("detects empty kap side", () => {
    const rules: ConversionRule[] = [{ unicode: "ક", kap: "" }];
    const result = validateAndSortRules(rules);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("detects non-Gujarati unicode side", () => {
    const rules: ConversionRule[] = [{ unicode: "ABC", kap: "K" }];
    const result = validateAndSortRules(rules);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("no Gujarati"))).toBe(true);
  });

  it("detects non-ASCII kap side", () => {
    const rules: ConversionRule[] = [{ unicode: "ક", kap: "ક" }];
    const result = validateAndSortRules(rules);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("printable ASCII"))).toBe(true);
  });

  it("detects conflicting mappings", () => {
    const rules: ConversionRule[] = [
      { unicode: "ક", kap: "K" },
      { unicode: "ક", kap: "X" },
    ];
    const result = validateAndSortRules(rules);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("conflicts"))).toBe(true);
  });

  it("tolerates identical duplicates", () => {
    const rules: ConversionRule[] = [
      { unicode: "ક", kap: "K" },
      { unicode: "ક", kap: "K" },
    ];
    const result = validateAndSortRules(rules);
    expect(result.ok).toBe(true);
  });

  it("accepts multi-byte KAP outputs", () => {
    const rules: ConversionRule[] = [
      { unicode: "ગ", kap: "VF" },
      { unicode: "ગુજરાતી", kap: "VF5[,F" },
    ];
    const result = validateAndSortRules(rules);
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBe(2);
    expect(result.warnings[0]).toContain("multi-byte");
  });

  it("rejects KAP output with non-ASCII characters", () => {
    const rules: ConversionRule[] = [{ unicode: "ક", kap: "ક" }];
    const result = validateAndSortRules(rules);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("printable ASCII"))).toBe(true);
  });

  it("detects conflicting multi-byte mappings", () => {
    const rules: ConversionRule[] = [
      { unicode: "ગ", kap: "VF" },
      { unicode: "ગ", kap: "VG" },
    ];
    const result = validateAndSortRules(rules);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("conflicts"))).toBe(true);
  });
});

describe("missingCoreCoverage", () => {
  it("returns empty when all core characters are covered", () => {
    const core = "કખગઘઙચછજઝઞટઠડઢણતથદધનપફબભમયરલવશષસહળક્ષજ્ઞઅઆઇઈઉઊઋએઐઓઔઅંઅઃ".split("");
    const rules: ConversionRule[] = core.map((ch) => ({
      unicode: ch,
      kap: "X",
    }));
    const missing = missingCoreCoverage(rules);
    expect(missing).toHaveLength(0);
  });

  it("returns missing characters when rules are incomplete", () => {
    const rules: ConversionRule[] = [{ unicode: "ક", kap: "K" }];
    const missing = missingCoreCoverage(rules);
    expect(missing.length).toBeGreaterThan(0);
    expect(missing).not.toContain("ક");
  });
});

describe("validateMapping", () => {
  it("returns loaded=false for unverified mapping", () => {
    const mapping: FontMapping = {
      font: "KAP110",
      rules: [{ unicode: "ક", kap: "K" }],
      verified: false,
      source: "test",
    };
    const result = validateMapping(mapping);
    expect(result.loaded).toBe(false);
  });

  it("returns loaded=true for verified mapping with valid rules", () => {
    const mapping: FontMapping = {
      font: "KAP110",
      rules: [{ unicode: "ક", kap: "K" }],
      verified: true,
      source: "test",
    };
    const result = validateMapping(mapping);
    expect(result.loaded).toBe(true);
  });

  it("returns loaded=false for verified mapping with invalid rules", () => {
    const mapping: FontMapping = {
      font: "KAP110",
      rules: [{ unicode: "", kap: "" }],
      verified: true,
      source: "test",
    };
    const result = validateMapping(mapping);
    expect(result.loaded).toBe(false);
  });
});

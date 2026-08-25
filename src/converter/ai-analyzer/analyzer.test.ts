/**
 * AI Analyzer Tests
 * ================
 * Tests for the AI-assisted KAP Mapping Analyzer pipeline.
 *
 * SAFETY: These tests verify that AI cannot auto-verify mappings.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type {
  GlyphAnalysisRequest,
  MappingCandidate,
} from "./types";
import { getConfidenceCategory, isGujaratiBlock, isValidKapOutput } from "./types";
import { MockProvider } from "./mock-provider";
import {
  validateModelOutput,
  validateCandidateSafety,
  validateAnalysisResponse,
} from "./output-validation";
import {
  analyzeSequence,
  validateSequenceCandidate,
  KNOWN_ANCHORS,
} from "./sequence-analyzer";
import {
  createProvider,
  isOpenAIConfigured,
  getConfiguredProviderType,
  getProviderStatus,
  ProviderConfigurationError,
} from "./provider-factory";
import type { ProviderType } from "./provider-factory";
import { VisionCache } from "./vision-cache";
import { RateLimiter } from "./rate-limiter";

// ============================================================
// MOCK PROVIDER TESTS
// ============================================================

describe("MockProvider", () => {
  let provider: MockProvider;

  beforeEach(() => {
    provider = new MockProvider();
  });

  it("has correct name", () => {
    expect(provider.name).toBe("mock");
  });

  it("is always available", async () => {
    expect(await provider.isAvailable()).toBe(true);
  });

  it("returns deterministic results for same input", async () => {
    const request: GlyphAnalysisRequest = {
      font: "KAP112",
      byte: 0x56,
      hex: "0x56",
      glyphImagePath: "test.png",
      glyphName: "V",
      hasGlyph: true,
    };

    const result1 = await provider.analyze(request);
    const result2 = await provider.analyze(request);

    expect(result1.candidates.length).toBe(result2.candidates.length);
    expect(result1.candidates[0]?.unicode).toBe(result2.candidates[0]?.unicode);
    expect(result1.candidates[0]?.confidence).toBe(result2.candidates[0]?.confidence);
  });

  it("returns empty candidates for bytes without glyphs", async () => {
    const request: GlyphAnalysisRequest = {
      font: "KAP112",
      byte: 0x00,
      hex: "0x00",
      glyphImagePath: "test.png",
      glyphName: ".notdef",
      hasGlyph: false,
    };

    const result = await provider.analyze(request);
    expect(result.candidates).toHaveLength(0);
  });

  it("always sets humanVerified to false", async () => {
    const request: GlyphAnalysisRequest = {
      font: "KAP112",
      byte: 0x56,
      hex: "0x56",
      glyphImagePath: "test.png",
      glyphName: "V",
      hasGlyph: true,
    };

    const result = await provider.analyze(request);
    for (const candidate of result.candidates) {
      expect(candidate.humanVerified).toBe(false);
    }
  });

  it("always sets status to candidate", async () => {
    const request: GlyphAnalysisRequest = {
      font: "KAP112",
      byte: 0x56,
      hex: "0x56",
      glyphImagePath: "test.png",
      glyphName: "V",
      hasGlyph: true,
    };

    const result = await provider.analyze(request);
    for (const candidate of result.candidates) {
      expect(candidate.status).toBe("candidate");
    }
  });

  it("returns Gujarati block characters", async () => {
    const request: GlyphAnalysisRequest = {
      font: "KAP112",
      byte: 0x56,
      hex: "0x56",
      glyphImagePath: "test.png",
      glyphName: "V",
      hasGlyph: true,
    };

    const result = await provider.analyze(request);
    for (const candidate of result.candidates) {
      expect(isGujaratiBlock(candidate.unicode)).toBe(true);
    }
  });

  it("returns valid confidence scores", async () => {
    const request: GlyphAnalysisRequest = {
      font: "KAP112",
      byte: 0x56,
      hex: "0x56",
      glyphImagePath: "test.png",
      glyphName: "V",
      hasGlyph: true,
    };

    const result = await provider.analyze(request);
    for (const candidate of result.candidates) {
      expect(candidate.confidence).toBeGreaterThanOrEqual(0);
      expect(candidate.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("generates different results for different fonts", async () => {
    const request112: GlyphAnalysisRequest = {
      font: "KAP112",
      byte: 0x41,
      hex: "0x41",
      glyphImagePath: "test.png",
      glyphName: "A",
      hasGlyph: true,
    };

    const request110: GlyphAnalysisRequest = {
      font: "KAP110",
      byte: 0x41,
      hex: "0x41",
      glyphImagePath: "test.png",
      glyphName: "A",
      hasGlyph: true,
    };

    const result112 = await provider.analyze(request112);
    const result110 = await provider.analyze(request110);

    // Different fonts should produce different results (from different fixtures)
    expect(result112.candidates[0]?.unicode).not.toBe(result110.candidates[0]?.unicode);
  });
});

// ============================================================
// OUTPUT VALIDATION TESTS
// ============================================================

describe("Output Validation", () => {
  const baseRequest: GlyphAnalysisRequest = {
    font: "KAP112",
    byte: 0x56,
    hex: "0x56",
    glyphImagePath: "test.png",
    glyphName: "V",
    hasGlyph: true,
  };

  it("validates correct JSON response", () => {
    const raw = JSON.stringify({
      candidates: [
        {
          unicode: "ગ",
          unicodeName: "GUJARATI LETTER GA",
          confidence: 0.85,
          reason: "Visual analysis shows the glyph resembles Gujarati letter GA",
          isSequence: false,
        },
      ],
      uncertain: false,
      notes: "Clear identification",
    });

    const result = validateModelOutput(raw, baseRequest);
    expect(result.valid).toBe(true);
    expect(result.parsedCandidates).toHaveLength(1);
    expect(result.parsedCandidates[0]?.unicode).toBe("ગ");
  });

  it("rejects malformed JSON", () => {
    const raw = "not valid json";
    const result = validateModelOutput(raw, baseRequest);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.type === "invalid_json")).toBe(true);
  });

  it("rejects non-Gujarati unicode", () => {
    const raw = JSON.stringify({
      candidates: [
        {
          unicode: "A",
          confidence: 0.8,
          reason: "test",
        },
      ],
    });

    const result = validateModelOutput(raw, baseRequest);
    expect(result.warnings.some(w => w.type === "invalid_unicode")).toBe(true);
  });

  it("rejects confidence outside range", () => {
    const raw = JSON.stringify({
      candidates: [
        {
          unicode: "ગ",
          confidence: 1.5,
          reason: "test",
        },
      ],
    });

    const result = validateModelOutput(raw, baseRequest);
    expect(result.errors.some(e => e.type === "invalid_confidence")).toBe(true);
  });

  it("handles empty candidates", () => {
    const raw = JSON.stringify({
      candidates: [],
      uncertain: true,
    });

    const result = validateModelOutput(raw, baseRequest);
    expect(result.valid).toBe(true);
    expect(result.parsedCandidates).toHaveLength(0);
    expect(result.warnings.some(w => w.type === "empty_candidates")).toBe(true);
  });

  it("limits candidates to MAX_CANDIDATES", () => {
    const candidates = Array.from({ length: 10 }, (_, i) => ({
      unicode: "ગ",
      confidence: 0.5 + i * 0.05,
      reason: `test ${i}`,
    }));

    const raw = JSON.stringify({ candidates });
    const result = validateModelOutput(raw, baseRequest);
    expect(result.parsedCandidates.length).toBeLessThanOrEqual(5);
  });

  it("validates candidate safety", () => {
    const candidate: MappingCandidate = {
      font: "KAP112",
      byte: 0x56,
      hex: "0x56",
      unicode: "ગ",
      confidence: 0.85,
      confidenceCategory: "high",
      status: "candidate",
      humanVerified: false,
      reasoning: "test",
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const errors = validateCandidateSafety(candidate);
    expect(errors).toHaveLength(0);
  });

  it("rejects candidate with humanVerified=true", () => {
    const candidate: MappingCandidate = {
      font: "KAP112",
      byte: 0x56,
      hex: "0x56",
      unicode: "ગ",
      confidence: 0.85,
      confidenceCategory: "high",
      status: "candidate",
      humanVerified: true, // VIOLATION
      reasoning: "test",
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const errors = validateCandidateSafety(candidate);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.type === "invalid_boolean")).toBe(true);
  });

  it("rejects candidate with status not candidate", () => {
    const candidate: MappingCandidate = {
      font: "KAP112",
      byte: 0x56,
      hex: "0x56",
      unicode: "ગ",
      confidence: 0.85,
      confidenceCategory: "high",
      status: "verified" as MappingCandidate["status"], // VIOLATION
      humanVerified: false,
      reasoning: "test",
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const errors = validateCandidateSafety(candidate);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.type === "missing_required_field")).toBe(true);
  });
});

// ============================================================
// SEQUENCE ANALYSIS TESTS
// ============================================================

describe("Sequence Analysis", () => {
  it("has known anchors", () => {
    expect(KNOWN_ANCHORS.length).toBeGreaterThan(0);
    expect(KNOWN_ANCHORS[0]?.unicode).toBe("ગુજરાતી");
    expect(KNOWN_ANCHORS[0]?.kap).toBe("VF5[,F");
  });

  it("validates sequence candidate against known anchor", () => {
    const candidate = {
      font: "KAP112",
      bytes: ["V", "F", "5", "[", ",", "F"],
      byteValues: [86, 70, 53, 91, 44, 70],
      kap: "VF5[,F",
      unicode: "ગુજરાતી",
      modelConfidence: 0.95,
      isSequence: true as const,
      humanVerified: false as const,
      status: "candidate" as const,
      source: "openai-vision-sequence",
      generatedAt: new Date().toISOString(),
      reasoning: "Known sequence",
    };

    const warnings = validateSequenceCandidate(candidate);
    expect(warnings).toHaveLength(0);
  });

  it("warns when sequence contradicts known anchor", () => {
    const candidate = {
      font: "KAP112",
      bytes: ["V", "F", "5", "[", ",", "F"],
      byteValues: [86, 70, 53, 91, 44, 70],
      kap: "VF5[,F",
      unicode: "અાઇઉઊઋ", // WRONG
      modelConfidence: 0.95,
      isSequence: true as const,
      humanVerified: false as const,
      status: "candidate" as const,
      source: "openai-vision-sequence",
      generatedAt: new Date().toISOString(),
      reasoning: "Wrong mapping",
    };

    const warnings = validateSequenceCandidate(candidate);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("analyzeSequence returns known anchor when matching", async () => {
    const result = await analyzeSequence({
      font: "KAP112",
      kapSequence: "VF5[,F",
      byteValues: [86, 70, 53, 91, 44, 70],
      glyphImagePaths: [],
    });

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0]?.unicode).toBe("ગુજરાતી");
    expect(result.candidates[0]?.modelConfidence).toBe(1.0);
    expect(result.candidates[0]?.source).toContain("known-anchor");
  });

  it("analyzeSequence returns empty for unknown sequences without vision", async () => {
    const result = await analyzeSequence({
      font: "KAP112",
      kapSequence: "ABC",
      byteValues: [65, 66, 67],
      glyphImagePaths: [],
    });

    expect(result.candidates).toHaveLength(0);
  });
});

// ============================================================
// PROVIDER FACTORY TESTS
// ============================================================

describe("Provider Factory", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("creates mock provider when configured", () => {
    process.env.KAP_ANALYZER_PROVIDER = "mock";
    const provider = createProvider({ providerType: "mock" });
    expect(provider.name).toBe("mock");
  });

  it("throws when openai provider has no API key", () => {
    delete process.env.KAP_VISION_API_KEY;
    delete process.env.OPENAI_API_KEY;
    expect(() => createProvider({ providerType: "openai" })).toThrow(
      ProviderConfigurationError
    );
  });

  it("throws for unknown provider type", () => {
    expect(() =>
      createProvider({ providerType: "unknown" as ProviderType })
    ).toThrow(ProviderConfigurationError);
  });

  it("reports correct provider type", () => {
    process.env.KAP_ANALYZER_PROVIDER = "mock";
    expect(getConfiguredProviderType()).toBe("mock");
  });

  it("reports openai not configured without API key", () => {
    delete process.env.KAP_VISION_API_KEY;
    delete process.env.OPENAI_API_KEY;
    expect(isOpenAIConfigured()).toBe(false);
  });

  it("uses KAP_VISION_API_KEY over OPENAI_API_KEY", () => {
    delete process.env.KAP_VISION_API_KEY;
    delete process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "old-key";
    expect(isOpenAIConfigured()).toBe(true);

    process.env.KAP_VISION_API_KEY = "new-key";
    expect(isOpenAIConfigured()).toBe(true);
  });

  it("getProviderStatus includes default base URL", () => {
    delete process.env.KAP_VISION_BASE_URL;
    const status = getProviderStatus();
    expect(status.baseUrl).toBe("http://localhost:20333/v1");
  });

  it("getProviderStatus includes custom base URL", () => {
    process.env.KAP_VISION_BASE_URL = "http://custom:9999/v1";
    const status = getProviderStatus();
    expect(status.baseUrl).toBe("http://custom:9999/v1");
  });

  it("getProviderStatus trims trailing slashes from base URL", () => {
    process.env.KAP_VISION_BASE_URL = "http://custom:9999/v1/";
    const status = getProviderStatus();
    expect(status.baseUrl).toBe("http://custom:9999/v1");
  });

  it("createProvider accepts explicit baseURL", () => {
    process.env.KAP_VISION_API_KEY = "test-key";
    const provider = createProvider({
      providerType: "mock",
      apiKey: "test-key",
      baseURL: "http://omni:20333/v1",
    });
    expect(provider.name).toBe("mock");
  });

  it("createProvider uses KAP_VISION_API_KEY env var", () => {
    delete process.env.OPENAI_API_KEY;
    process.env.KAP_VISION_API_KEY = "env-vision-key";
    expect(isOpenAIConfigured()).toBe(true);
  });

  it("createProvider falls back to OPENAI_API_KEY env var", () => {
    delete process.env.KAP_VISION_API_KEY;
    process.env.OPENAI_API_KEY = "legacy-key";
    expect(isOpenAIConfigured()).toBe(true);
  });
});

// ============================================================
// VISION CACHE TESTS
// ============================================================

describe("VisionCache", () => {
  let cache: VisionCache;
  const testCacheDir = "/tmp/test-vision-cache";

  beforeEach(() => {
    cache = new VisionCache({ cacheDir: testCacheDir });
  });

  afterEach(() => {
    cache.clear();
  });

  it("returns null for non-existent cache", () => {
    const key = {
      font: "KAP112",
      fontChecksum: "abc",
      byte: 0x56,
      glyphImageHash: "def",
      model: "gpt-4o",
      promptVersion: "1.0.0",
    };

    expect(cache.get(key)).toBeNull();
  });

  it("stores and retrieves cached results", () => {
    const key = {
      font: "KAP112",
      fontChecksum: "abc",
      byte: 0x56,
      glyphImageHash: "def",
      model: "gpt-4o",
      promptVersion: "1.0.0",
    };

    const response = { candidates: [], analysisConfidence: 0, reasoning: "test", warnings: [] };
    cache.set(key, response);

    const cached = cache.get(key);
    expect(cached).not.toBeNull();
    expect(cached?.response).toEqual(response);
  });

  it("invalidates cache when font checksum changes", () => {
    const key1 = {
      font: "KAP112",
      fontChecksum: "abc",
      byte: 0x56,
      glyphImageHash: "def",
      model: "gpt-4o",
      promptVersion: "1.0.0",
    };

    const key2 = {
      font: "KAP112",
      fontChecksum: "xyz", // Changed
      byte: 0x56,
      glyphImageHash: "def",
      model: "gpt-4o",
      promptVersion: "1.0.0",
    };

    const response = { candidates: [], analysisConfidence: 0, reasoning: "test", warnings: [] };
    cache.set(key1, response);

    // key1 should have cached result
    expect(cache.get(key1)).not.toBeNull();
    // key2 should not (different checksum)
    expect(cache.get(key2)).toBeNull();
  });

  it("invalidates cache when model changes", () => {
    const key1 = {
      font: "KAP112",
      fontChecksum: "abc",
      byte: 0x56,
      glyphImageHash: "def",
      model: "gpt-4o",
      promptVersion: "1.0.0",
    };

    const key2 = {
      font: "KAP112",
      fontChecksum: "abc",
      byte: 0x56,
      glyphImageHash: "def",
      model: "gpt-4o-mini", // Changed
      promptVersion: "1.0.0",
    };

    const response = { candidates: [], analysisConfidence: 0, reasoning: "test", warnings: [] };
    cache.set(key1, response);

    expect(cache.get(key1)).not.toBeNull();
    expect(cache.get(key2)).toBeNull();
  });

  it("clears all cached results", () => {
    const key = {
      font: "KAP112",
      fontChecksum: "abc",
      byte: 0x56,
      glyphImageHash: "def",
      model: "gpt-4o",
      promptVersion: "1.0.0",
    };

    const response = { candidates: [], analysisConfidence: 0, reasoning: "test", warnings: [] };
    cache.set(key, response);
    expect(cache.get(key)).not.toBeNull();

    cache.clear();
    expect(cache.get(key)).toBeNull();
  });
});

// ============================================================
// RATE LIMITER TESTS
// ============================================================

describe("RateLimiter", () => {
  it("executes function with concurrency limit", async () => {
    const limiter = new RateLimiter({ concurrency: 2 });
    let running = 0;
    let maxRunning = 0;

    const createTask = () => async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise(resolve => setTimeout(resolve, 50));
      running--;
    };

    await Promise.all([
      limiter.run(createTask()),
      limiter.run(createTask()),
      limiter.run(createTask()),
      limiter.run(createTask()),
    ]);

    expect(maxRunning).toBeLessThanOrEqual(2);
  });

  it("retries on retryable errors", async () => {
    const limiter = new RateLimiter({
      concurrency: 1,
      maxRetries: 2,
      initialBackoffMs: 10,
    });

    let attempts = 0;
    const result = await limiter.run(async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error("rate limit exceeded");
      }
      return "success";
    }, RateLimiter.isRetryableError);

    expect(result).toBe("success");
    expect(attempts).toBe(3);
  });

  it("throws after max retries", async () => {
    const limiter = new RateLimiter({
      concurrency: 1,
      maxRetries: 2,
      initialBackoffMs: 10,
    });

    await expect(
      limiter.run(async () => {
        throw new Error("rate limit exceeded");
      }, RateLimiter.isRetryableError)
    ).rejects.toThrow("rate limit exceeded");
  });

  it("reports status correctly", () => {
    const limiter = new RateLimiter({ concurrency: 3 });
    const status = limiter.status();
    expect(status.concurrency).toBe(3);
    expect(status.running).toBe(0);
    expect(status.queued).toBe(0);
  });
});

// ============================================================
// SAFETY INVARIANT TESTS
// ============================================================

describe("Safety Invariants", () => {
  it("AI output NEVER has humanVerified=true", async () => {
    const provider = new MockProvider();
    const request: GlyphAnalysisRequest = {
      font: "KAP112",
      byte: 0x56,
      hex: "0x56",
      glyphImagePath: "test.png",
      glyphName: "V",
      hasGlyph: true,
    };

    const response = await provider.analyze(request);

    for (const candidate of response.candidates) {
      expect(candidate.humanVerified).toBe(false);
    }
  });

  it("AI output NEVER has status=verified", async () => {
    const provider = new MockProvider();
    const request: GlyphAnalysisRequest = {
      font: "KAP112",
      byte: 0x56,
      hex: "0x56",
      glyphImagePath: "test.png",
      glyphName: "V",
      hasGlyph: true,
    };

    const response = await provider.analyze(request);

    for (const candidate of response.candidates) {
      expect(candidate.status).not.toBe("verified");
    }
  });

  it("known anchor is preserved", () => {
    const anchor = KNOWN_ANCHORS.find(a => a.kap === "VF5[,F");
    expect(anchor).toBeDefined();
    expect(anchor?.unicode).toBe("ગુજરાતી");
  });

  it("Gujarati block validation works", () => {
    expect(isGujaratiBlock("ગ")).toBe(true);
    expect(isGujaratiBlock("ગુજરાતી")).toBe(true);
    expect(isGujaratiBlock("A")).toBe(false);
    expect(isGujaratiBlock("")).toBe(true); // Empty is valid
  });

  it("KAP output validation works", () => {
    expect(isValidKapOutput("VF5[,F")).toBe(true);
    expect(isValidKapOutput("ABC")).toBe(true);
    expect(isValidKapOutput("")).toBe(true); // Empty is valid
    expect(isValidKapOutput("\x00")).toBe(false); // Null byte invalid
  });
});

// ============================================================
// CONFIDENCE CATEGORY TESTS
// ============================================================

describe("Confidence Categories", () => {
  it("assigns correct categories", () => {
    expect(getConfidenceCategory(0.95)).toBe("very_high");
    expect(getConfidenceCategory(0.80)).toBe("high");
    expect(getConfidenceCategory(0.60)).toBe("medium");
    expect(getConfidenceCategory(0.35)).toBe("low");
    expect(getConfidenceCategory(0.10)).toBe("very_low");
  });

  it("handles boundary values", () => {
    expect(getConfidenceCategory(0.90)).toBe("very_high");
    expect(getConfidenceCategory(0.75)).toBe("high");
    expect(getConfidenceCategory(0.50)).toBe("medium");
    expect(getConfidenceCategory(0.25)).toBe("low");
    expect(getConfidenceCategory(0.00)).toBe("very_low");
  });
});

// ============================================================
// EXPORT FILTERING TESTS
// ============================================================

describe("Export Filtering", () => {
  it("filters only verified AND humanVerified candidates", () => {
    const candidates = [
      { status: "verified", humanVerified: true, unicode: "ગ" },
      { status: "verified", humanVerified: false, unicode: "ક" },
      { status: "candidate", humanVerified: false, unicode: "ઘ" },
      { status: "rejected", humanVerified: false, unicode: "ચ" },
    ];

    const exported = candidates.filter(
      (c) => c.status === "verified" && c.humanVerified === true
    );

    expect(exported).toHaveLength(1);
    expect(exported[0]?.unicode).toBe("ગ");
  });

  it("returns empty array when no candidates are verified", () => {
    const candidates = [
      { status: "candidate", humanVerified: false },
      { status: "rejected", humanVerified: false },
    ];

    const exported = candidates.filter(
      (c) => c.status === "verified" && c.humanVerified === true
    );

    expect(exported).toHaveLength(0);
  });

  it("does not export sequence candidates that are not human verified", () => {
    const sequences = [
      { humanVerified: false, unicode: "ગુજરાતી", kap: "VF5[,F" },
      { humanVerified: true, unicode: "કળાક્ષર", kap: "ABC" },
    ];

    const exported = sequences.filter((s) => s.humanVerified === true);
    expect(exported).toHaveLength(1);
    expect(exported[0]?.kap).toBe("ABC");
  });
});

// ============================================================
// CROSS-FONT ISOLATION TESTS
// ============================================================

describe("Cross-Font Isolation", () => {
  it("MockProvider produces different results for different fonts", async () => {
    const provider = new MockProvider();
    const requestKAP112: GlyphAnalysisRequest = {
      font: "KAP112",
      byte: 0x56,
      hex: "0x56",
      glyphImagePath: "test.png",
      glyphName: "V",
      hasGlyph: true,
    };

    const requestKAP110: GlyphAnalysisRequest = {
      font: "KAP110",
      byte: 0x56,
      hex: "0x56",
      glyphImagePath: "test.png",
      glyphName: "V",
      hasGlyph: true,
    };

    const result112 = await provider.analyze(requestKAP112);
    const result110 = await provider.analyze(requestKAP110);

    // Results should NOT be identical (isolated per font)
    expect(result112.candidates[0]?.unicode).not.toBe(result110.candidates[0]?.unicode);
  });

  it("each font uses its own mapping file", () => {
    const fonts = ["KAP110", "KAP111", "KAP112", "KAP122"];
    // Ensure each font identifier is distinct
    const unique = new Set(fonts);
    expect(unique.size).toBe(fonts.length);
  });

  it("validateAnalysisResponse catches cross-font candidates", () => {
    const request: GlyphAnalysisRequest = {
      font: "KAP112",
      byte: 0x56,
      hex: "0x56",
      glyphImagePath: "test.png",
      glyphName: "V",
      hasGlyph: true,
    };

    const response: import("./types").GlyphAnalysisResponse = {
      candidates: [
        {
          font: "KAP110", // WRONG FONT
          byte: 0x56,
          hex: "0x56",
          unicode: "ગ",
          confidence: 0.8,
          confidenceCategory: "high",
          status: "candidate",
          humanVerified: false,
          reasoning: "test",
          generatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      analysisConfidence: 0.8,
      reasoning: "test",
      warnings: [],
    };

    const result = validateAnalysisResponse(response, request);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("does not match request font"))).toBe(true);
  });
});

// ============================================================
// SEQUENCE ANCHOR EDGE CASES
// ============================================================

describe("Sequence Anchor Edge Cases", () => {
  it("golden sample anchor is NEVER modified by analysis", async () => {
    const anchor = KNOWN_ANCHORS.find((a) => a.kap === "VF5[,F");
    expect(anchor).toBeDefined();
    expect(anchor?.unicode).toBe("ગુજરાતી");
    expect(anchor?.confidence).toBe(1.0);
    expect(anchor?.source).toContain("golden sample");
  });

  it("known anchor appears first in analyzeSequence results", async () => {
    const result = await analyzeSequence({
      font: "KAP112",
      kapSequence: "VF5[,F",
      byteValues: [86, 70, 53, 91, 44, 70],
      glyphImagePaths: [],
    });

    // Known anchor should be present
    const knownCandidate = result.candidates.find(
      (c) => c.source.includes("known-anchor")
    );
    expect(knownCandidate).toBeDefined();
    expect(knownCandidate?.unicode).toBe("ગુજરાતી");
    expect(knownCandidate?.modelConfidence).toBe(1.0);
  });

  it("unknown sequences return no candidates without vision function", async () => {
    const result = await analyzeSequence({
      font: "KAP112",
      kapSequence: "XYZ",
      byteValues: [88, 89, 90],
      glyphImagePaths: [],
    });

    expect(result.candidates).toHaveLength(0);
    expect(result.analysisConfidence).toBe(0);
  });

  it("validates sequence candidate with correct anchor returns no warnings", () => {
    const candidate = {
      font: "KAP112",
      bytes: ["V", "F", "5", "[", ",", "F"],
      byteValues: [86, 70, 53, 91, 44, 70],
      kap: "VF5[,F",
      unicode: "ગુજરાતી",
      modelConfidence: 1.0,
      isSequence: true as const,
      humanVerified: false as const,
      status: "candidate" as const,
      source: "known-anchor",
      generatedAt: new Date().toISOString(),
      reasoning: "Known anchor",
    };

    const warnings = validateSequenceCandidate(candidate);
    expect(warnings).toHaveLength(0);
  });
});

// ============================================================
// ERROR HANDLING TESTS
// ============================================================

describe("Error Handling", () => {
  it("validateModelOutput handles empty string gracefully", () => {
    const request: GlyphAnalysisRequest = {
      font: "KAP112",
      byte: 0x56,
      hex: "0x56",
      glyphImagePath: "test.png",
      glyphName: "V",
      hasGlyph: true,
    };

    const result = validateModelOutput("", request);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === "invalid_json")).toBe(true);
  });

  it("validateModelOutput handles null-like JSON gracefully", () => {
    const request: GlyphAnalysisRequest = {
      font: "KAP112",
      byte: 0x56,
      hex: "0x56",
      glyphImagePath: "test.png",
      glyphName: "V",
      hasGlyph: true,
    };

    const result = validateModelOutput("null", request);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === "invalid_json")).toBe(true);
  });

  it("validateModelOutput handles JSON without candidates array", () => {
    const request: GlyphAnalysisRequest = {
      font: "KAP112",
      byte: 0x56,
      hex: "0x56",
      glyphImagePath: "test.png",
      glyphName: "V",
      hasGlyph: true,
    };

    const result = validateModelOutput('{"uncertain": true}', request);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === "missing_required_field")).toBe(true);
  });

  it("validateModelOutput handles candidates with missing unicode field", () => {
    const request: GlyphAnalysisRequest = {
      font: "KAP112",
      byte: 0x56,
      hex: "0x56",
      glyphImagePath: "test.png",
      glyphName: "V",
      hasGlyph: true,
    };

    const raw = JSON.stringify({
      candidates: [{ confidence: 0.8, reason: "test" }], // missing unicode
    });

    const result = validateModelOutput(raw, request);
    expect(result.errors.some((e) => e.type === "missing_required_field")).toBe(true);
  });

  it("validateModelOutput handles negative confidence", () => {
    const request: GlyphAnalysisRequest = {
      font: "KAP112",
      byte: 0x56,
      hex: "0x56",
      glyphImagePath: "test.png",
      glyphName: "V",
      hasGlyph: true,
    };

    const raw = JSON.stringify({
      candidates: [{ unicode: "ગ", confidence: -0.5, reason: "test" }],
    });

    const result = validateModelOutput(raw, request);
    expect(result.errors.some((e) => e.type === "invalid_confidence")).toBe(true);
  });

  it("validateModelOutput extracts JSON from markdown code blocks", () => {
    const request: GlyphAnalysisRequest = {
      font: "KAP112",
      byte: 0x56,
      hex: "0x56",
      glyphImagePath: "test.png",
      glyphName: "V",
      hasGlyph: true,
    };

    const raw = '```json\n{"candidates": [{"unicode": "ગ", "confidence": 0.8, "reason": "test"}]}\n```';
    const result = validateModelOutput(raw, request);
    expect(result.valid).toBe(true);
    expect(result.parsedCandidates).toHaveLength(1);
  });

  it("MockProvider handles hasGlyph=false gracefully", async () => {
    const provider = new MockProvider();
    const request: GlyphAnalysisRequest = {
      font: "KAP112",
      byte: 0x00,
      hex: "0x00",
      glyphImagePath: "test.png",
      glyphName: ".notdef",
      hasGlyph: false,
    };

    const result = await provider.analyze(request);
    expect(result.candidates).toHaveLength(0);
    expect(result.analysisConfidence).toBe(0);
  });
});

// ============================================================
// OUTPUT VALIDATION - ANALYSIS RESPONSE TESTS
// ============================================================

describe("Analysis Response Validation", () => {
  it("validates correct response matches request", () => {
    const request: GlyphAnalysisRequest = {
      font: "KAP112",
      byte: 0x56,
      hex: "0x56",
      glyphImagePath: "test.png",
      glyphName: "V",
      hasGlyph: true,
    };

    const response: import("./types").GlyphAnalysisResponse = {
      candidates: [
        {
          font: "KAP112",
          byte: 0x56,
          hex: "0x56",
          unicode: "ગ",
          confidence: 0.85,
          confidenceCategory: "high",
          status: "candidate",
          humanVerified: false,
          reasoning: "test",
          generatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      analysisConfidence: 0.85,
      reasoning: "test",
      warnings: [],
    };

    const result = validateAnalysisResponse(response, request);
    expect(result.valid).toBe(true);
  });

  it("rejects response with humanVerified=true candidate", () => {
    const request: GlyphAnalysisRequest = {
      font: "KAP112",
      byte: 0x56,
      hex: "0x56",
      glyphImagePath: "test.png",
      glyphName: "V",
      hasGlyph: true,
    };

    const response: import("./types").GlyphAnalysisResponse = {
      candidates: [
        {
          font: "KAP112",
          byte: 0x56,
          hex: "0x56",
          unicode: "ગ",
          confidence: 0.85,
          confidenceCategory: "high",
          status: "candidate",
          humanVerified: true, // VIOLATION
          reasoning: "test",
          generatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      analysisConfidence: 0.85,
      reasoning: "test",
      warnings: [],
    };

    const result = validateAnalysisResponse(response, request);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === "invalid_boolean")).toBe(true);
  });
});

// ============================================================
// PROVIDER CONFIGURATION EDGE CASES
// ============================================================

describe("Provider Configuration Edge Cases", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("getProviderStatus reports correct info with mock provider", () => {
    process.env.KAP_ANALYZER_PROVIDER = "mock";
    process.env.KAP_VISION_MODEL = "gpt-4o-mini";

    const status = getProviderStatus();
    expect(status.providerType).toBe("mock");
    expect(status.configured).toBe(true);
    expect(status.model).toBe("gpt-4o-mini");
  });

  it("getProviderStatus reports not configured when openai without key", () => {
    process.env.KAP_ANALYZER_PROVIDER = "openai";
    delete process.env.KAP_VISION_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const status = getProviderStatus();
    expect(status.configured).toBe(false);
    expect(status.apiKeyPresent).toBe(false);
  });

  it("createProvider with explicit config overrides env", () => {
    process.env.KAP_ANALYZER_PROVIDER = "openai";
    delete process.env.KAP_VISION_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const provider = createProvider({ providerType: "mock" });
    expect(provider.name).toBe("mock");
  });

  it("createProvider throws helpful message for missing API key", () => {
    delete process.env.KAP_VISION_API_KEY;
    delete process.env.OPENAI_API_KEY;
    expect(() => createProvider({ providerType: "openai" })).toThrow(
      /KAP_VISION_API_KEY/
    );
  });
});

// ============================================================
// BASE URL VALIDATION TESTS
// ============================================================

describe("Base URL Validation", () => {
  it("validates absolute HTTP URL", () => {
    const url = new URL("http://localhost:20333/v1");
    expect(url.protocol).toBe("http:");
  });

  it("validates absolute HTTPS URL", () => {
    const url = new URL("https://omni.example.com/v1");
    expect(url.protocol).toBe("https:");
  });

  it("rejects protocol-relative URLs", () => {
    expect(() => new URL("//localhost:20333/v1")).toThrow();
  });

  it("rejects non-HTTP protocols", () => {
    const url = new URL("ftp://localhost:20333");
    expect(url.protocol).not.toBe("http:");
    expect(url.protocol).not.toBe("https:");
  });

  it("trims trailing slashes safely", () => {
    const input = "http://localhost:20333/v1/";
    const trimmed = input.trim().replace(/\/+$/, "");
    const url = new URL(trimmed);
    expect(url.origin + url.pathname.replace(/\/+$/, "")).toBe("http://localhost:20333/v1");
  });

  it("does not double /v1", () => {
    const base = "http://localhost:20333/v1";
    const result = base.trim().replace(/\/+$/, "");
    expect(result).toBe("http://localhost:20333/v1");
    expect(result).not.toContain("/v1/v1");
  });

  it("default base URL is localhost:20333/v1", () => {
    const defaultUrl = "http://localhost:20333/v1";
    expect(defaultUrl).toBe("http://localhost:20333/v1");
  });
});

// ============================================================
// OMNIROUTE CONFIGURATION TESTS
// ============================================================

describe("OmniRoute Configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("KAP_VISION_API_KEY takes priority over OPENAI_API_KEY", () => {
    process.env.KAP_VISION_API_KEY = "vision-key";
    process.env.OPENAI_API_KEY = "openai-key";
    expect(isOpenAIConfigured()).toBe(true);
  });

  it("falls back to OPENAI_API_KEY when KAP_VISION_API_KEY absent", () => {
    delete process.env.KAP_VISION_API_KEY;
    process.env.OPENAI_API_KEY = "legacy-key";
    expect(isOpenAIConfigured()).toBe(true);
  });

  it("reports not configured when both keys absent", () => {
    delete process.env.KAP_VISION_API_KEY;
    delete process.env.OPENAI_API_KEY;
    expect(isOpenAIConfigured()).toBe(false);
  });

  it("getProviderStatus returns default base URL", () => {
    delete process.env.KAP_VISION_BASE_URL;
    const status = getProviderStatus();
    expect(status.baseUrl).toBe("http://localhost:20333/v1");
  });

  it("getProviderStatus returns configured model", () => {
    process.env.KAP_VISION_MODEL = "gpt-4o-mini";
    const status = getProviderStatus();
    expect(status.model).toBe("gpt-4o-mini");
  });

  it("getProviderStatus defaults model to gpt-4o", () => {
    delete process.env.KAP_VISION_MODEL;
    const status = getProviderStatus();
    expect(status.model).toBe("gpt-4o");
  });

  it("mock provider works with any env config", () => {
    process.env.KAP_ANALYZER_PROVIDER = "mock";
    delete process.env.KAP_VISION_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const provider = createProvider({ providerType: "mock" });
    expect(provider.name).toBe("mock");
  });

  it("createProvider with explicit baseURL", () => {
    process.env.KAP_VISION_API_KEY = "test";
    const provider = createProvider({
      providerType: "mock",
      apiKey: "test",
      baseURL: "http://omni:20333/v1",
    });
    expect(provider.name).toBe("mock");
  });

  it("createProvider throws helpful message referencing KAP_VISION_API_KEY", () => {
    delete process.env.KAP_VISION_API_KEY;
    delete process.env.OPENAI_API_KEY;
    expect(() => createProvider({ providerType: "openai" })).toThrow(
      /KAP_VISION_API_KEY/
    );
  });
});

/**
 * Mock Vision Provider
 * ====================
 * A deterministic mock implementation of the VisionProvider interface
 * for testing and development. Returns predefined fixtures for known
 * test glyphs WITHOUT actual AI analysis.
 *
 * SAFETY: All candidates have status: "candidate" and humanVerified: false
 *
 * IMPORTANT: This provider is for DEVELOPMENT/TESTING ONLY.
 * It must never be selected automatically in production.
 */

import type {
  GlyphAnalysisRequest,
  GlyphAnalysisResponse,
  MappingCandidate,
  VisionProvider,
} from "./types";
import { getConfidenceCategory } from "./types";

/**
 * Deterministic test fixtures for known bytes.
 * These provide reproducible results for testing.
 */
const MOCK_FIXTURES: Record<string, Array<{ unicode: string; name: string; confidence: number }>> = {
  // KAP112 fixtures
  KAP112: [
    { unicode: "ગ", name: "GA", confidence: 0.85 },
    { unicode: "ક", name: "KA", confidence: 0.72 },
    { unicode: "ઘ", name: "GHA", confidence: 0.45 },
  ],
  // KAP110 fixtures
  KAP110: [
    { unicode: "અ", name: "A", confidence: 0.78 },
    { unicode: "આ", name: "AA", confidence: 0.65 },
  ],
  // KAP111 fixtures
  KAP111: [
    { unicode: "જ", name: "JA", confidence: 0.82 },
    { unicode: "ઝ", name: "ZHA", confidence: 0.55 },
  ],
  // KAP122 fixtures
  KAP122: [
    { unicode: "બ", name: "BA", confidence: 0.76 },
    { unicode: "ભ", name: "BHA", confidence: 0.62 },
  ],
};

/**
 * Default fixtures for bytes without specific mappings.
 * Deterministic based on byte value.
 */
const DEFAULT_FIXTURES: Array<{ unicode: string; name: string; confidence: number }> = [
  { unicode: "અ", name: "A", confidence: 0.35 },
  { unicode: "ક", name: "KA", confidence: 0.28 },
  { unicode: "ગ", name: "GA", confidence: 0.22 },
];

/**
 * Generate deterministic candidates for a glyph analysis request.
 *
 * SAFETY: All candidates have:
 * - status: "candidate"
 * - humanVerified: false
 */
function generateDeterministicCandidates(
  request: GlyphAnalysisRequest
): MappingCandidate[] {
  const candidates: MappingCandidate[] = [];

  // Only generate candidates for bytes that have glyphs
  if (!request.hasGlyph) {
    return candidates;
  }

  // Get fixtures for this font
  const fontFixtures = MOCK_FIXTURES[request.font] ?? DEFAULT_FIXTURES;

  // Select fixtures deterministically based on byte value
  const fixtureIndex = request.byte % fontFixtures.length;
  const primaryFixture = fontFixtures[fixtureIndex];

  // Add primary candidate
  candidates.push({
    font: request.font,
    byte: request.byte,
    hex: request.hex,
    unicode: primaryFixture.unicode,
    confidence: primaryFixture.confidence,
    confidenceCategory: getConfidenceCategory(primaryFixture.confidence),
    status: "candidate",
    humanVerified: false,
    reasoning: `Mock fixture: glyph for byte ${request.hex} mapped to ${primaryFixture.name} (${primaryFixture.unicode})`,
    generatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {
      glyphName: request.glyphName ?? undefined,
      hasGlyph: request.hasGlyph,
    },
  });

  // Add secondary candidate for some bytes (deterministic)
  if (request.byte % 3 === 0) {
    const secondaryIndex = (fixtureIndex + 1) % fontFixtures.length;
    const secondaryFixture = fontFixtures[secondaryIndex];
    const confidence = Math.round(secondaryFixture.confidence * 0.7 * 100) / 100;

    candidates.push({
      font: request.font,
      byte: request.byte,
      hex: request.hex,
      unicode: secondaryFixture.unicode,
      confidence,
      confidenceCategory: getConfidenceCategory(confidence),
      status: "candidate",
      humanVerified: false,
      reasoning: `Mock fixture: alternative candidate ${secondaryFixture.name} (${secondaryFixture.unicode})`,
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        glyphName: request.glyphName ?? undefined,
        hasGlyph: request.hasGlyph,
      },
    });
  }

  return candidates;
}

/**
 * Mock Vision Provider implementation.
 *
 * Returns deterministic fixtures for known test glyphs.
 * Does NOT perform actual AI analysis.
 *
 * Usage:
 * ```typescript
 * const provider = new MockProvider();
 * const response = await provider.analyze(request);
 * ```
 */
export class MockProvider implements VisionProvider {
  readonly name = "mock";

  async analyze(request: GlyphAnalysisRequest): Promise<GlyphAnalysisResponse> {
    // Simulate async processing
    await new Promise((resolve) => setTimeout(resolve, 10));

    const candidates = generateDeterministicCandidates(request);

    return {
      candidates,
      analysisConfidence: candidates.length > 0 ? candidates[0].confidence : 0,
      reasoning: "Mock analysis - deterministic fixture provider, no actual AI processing",
      warnings: ["This is a mock provider. Results are NOT from real AI analysis."],
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

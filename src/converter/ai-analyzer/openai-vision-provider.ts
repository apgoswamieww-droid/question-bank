/**
 * OpenAI Vision Provider
 * =====================
 * Real implementation of the VisionProvider interface using OpenAI's
 * vision-capable models for KAP glyph analysis.
 *
 * SAFETY RULES:
 * - All output has status: "candidate" and humanVerified: false
 * - Never set humanVerified=true programmatically
 * - Never set verified=true in mapping files
 * - Never copy mappings between fonts
 *
 * SECURITY:
 * - API key MUST be provided via environment/configuration
 * - API key is NEVER committed to source, stored in logs, or exposed to renderer
 * - All API communication happens in the trusted main process boundary
 */

import OpenAI from "openai";
import type { VisionProvider, GlyphAnalysisRequest, GlyphAnalysisResponse, MappingCandidate } from "./types";
import { getConfidenceCategory } from "./types";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

/**
 * Configuration for the OpenAI Vision Provider.
 */
export interface OpenAIVisionConfig {
  /** API key - MUST be provided via environment */
  apiKey: string;
  /** Base URL for OpenAI-compatible API - defaults to KAP_VISION_BASE_URL env or http://localhost:20333/v1 */
  baseURL?: string;
  /** Model to use - defaults to KAP_VISION_MODEL env or gpt-4o */
  model?: string;
  /** Maximum concurrent requests - defaults to KAP_VISION_CONCURRENCY env or 3 */
  concurrency?: number;
  /** Request timeout in milliseconds - defaults to 60000 */
  timeout?: number;
  /** Maximum retries for transient failures - defaults to 3 */
  maxRetries?: number;
  /** Cache directory - defaults to mapping-data/vision-cache */
  cacheDir?: string;
}

/**
 * Cached analysis result.
 */
interface CachedResult {
  response: GlyphAnalysisResponse;
  timestamp: string;
  model: string;
  promptVersion: string;
  glyphImageHash: string;
}

/**
 * Cache key components.
 */
interface CacheKey {
  font: string;
  fontChecksum: string;
  byte: number;
  glyphImageHash: string;
  model: string;
  promptVersion: string;
}

/**
 * The prompt version for cache invalidation when prompt changes.
 */
const PROMPT_VERSION = "1.0.0";

/**
 * Analysis prompt for KAP glyph identification.
 */
function buildAnalysisPrompt(request: GlyphAnalysisRequest): string {
  const asciiChar = request.byte >= 0x20 && request.byte <= 0x7E
    ? String.fromCharCode(request.byte)
    : "(non-printable)";

  return `You are analyzing a glyph from a legacy Gujarati KAP font. This is NOT standard Unicode — it is a legacy encoding where each byte maps to a glyph.

CRITICAL INSTRUCTIONS:
1. The image is the PRIMARY evidence. Look at the rendered glyph carefully.
2. The byte/code is METADATA only — do NOT assume the byte value indicates the character.
3. This is a legacy Gujarati font. The glyph may represent a Gujarati character, part of a character, or a multi-byte sequence component.
4. Do NOT guess confidently when uncertain. Return "uncertain": true if unsure.
5. You may return MULTIPLE candidates if uncertain — this is encouraged.
6. NEVER force exactly one answer.
7. Do NOT use the byte value to infer the character — only use visual analysis.

CONTEXT:
- Font: ${request.font}
- Byte: ${request.byte} (decimal)
- Hex: ${request.hex}
- ASCII: ${asciiChar}
- Section: ${request.context ?? "unknown"}
- Glyph name: ${request.glyphName ?? "unknown"}

KNOWN SEQUENCE ANCHORS (for reference, do not modify):
${(request.knownAnchors ?? []).map(a => `- Unicode "${a.unicode}" maps to KAP "${a.kap}" (${a.source})`).join("\n")}

Analyze the rendered glyph image and determine which Gujarati Unicode character(s), if any, the glyph most closely represents.

Return a JSON response with this exact structure:
{
  "candidates": [
    {
      "unicode": "<unicode character(s)>",
      "unicodeName": "<Unicode name of the character>",
      "confidence": <0.0 to 1.0>,
      "reason": "<brief explanation of visual analysis>",
      "isSequence": <true if multi-byte sequence component>
    }
  ],
  "uncertain": <true if not confident>,
  "notes": "<any additional observations>"
}

You may return 0-5 candidates. Sort by confidence (highest first).`;
}

/**
 * Parse and validate the model's JSON response.
 */
function parseModelResponse(raw: string, request: GlyphAnalysisRequest): GlyphAnalysisResponse {
  let parsed: unknown;
  try {
    // Try to extract JSON from the response (model may wrap in markdown code blocks)
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, raw];
    const jsonStr = jsonMatch[1] ?? raw;
    parsed = JSON.parse(jsonStr);
  } catch {
    return {
      candidates: [],
      analysisConfidence: 0,
      reasoning: `Failed to parse model response: ${raw.substring(0, 200)}`,
      warnings: ["Malformed model response — could not parse JSON"],
    };
  }

  if (!parsed || typeof parsed !== "object") {
    return {
      candidates: [],
      analysisConfidence: 0,
      reasoning: "Model response is not an object",
      warnings: ["Malformed model response — not an object"],
    };
  }

  const obj = parsed as Record<string, unknown>;
  const candidates: MappingCandidate[] = [];
  const warnings: string[] = [];

  // Validate and extract candidates
  if (Array.isArray(obj.candidates)) {
    for (let i = 0; i < Math.min(obj.candidates.length, 5); i++) {
      const c = obj.candidates[i] as Record<string, unknown>;
      if (!c || typeof c !== "object") continue;

      const unicode = typeof c.unicode === "string" ? c.unicode : "";
      const confidence = typeof c.confidence === "number" ? c.confidence : 0;
      const reason = typeof c.reason === "string" ? c.reason : "No reasoning provided";
      const isSequence = typeof c.isSequence === "boolean" ? c.isSequence : false;

      // Validate confidence range
      if (confidence < 0 || confidence > 1) {
        warnings.push(`Candidate ${i}: confidence ${confidence} outside [0,1] range`);
        continue;
      }

      // Validate unicode is non-empty
      if (!unicode) {
        warnings.push(`Candidate ${i}: empty unicode`);
        continue;
      }

      candidates.push({
        font: request.font,
        byte: request.byte,
        hex: request.hex,
        unicode,
        confidence: Math.round(confidence * 100) / 100,
        confidenceCategory: getConfidenceCategory(confidence),
        status: "candidate",
        humanVerified: false,
        reasoning: reason,
        generatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          glyphName: request.glyphName ?? undefined,
          hasGlyph: request.hasGlyph,
          sequenceAnalysis: isSequence ? {
            isPartOfSequence: true,
            potentialSequences: [{
              unicode,
              kap: request.hex,
              confidence,
              reasoning: reason,
            }],
          } : undefined,
        },
      });
    }
  }

  if (obj.uncertain === true) {
    warnings.push("Model reported uncertainty");
  }

  const analysisConfidence = candidates.length > 0
    ? Math.max(...candidates.map(c => c.confidence))
    : 0;

  return {
    candidates,
    analysisConfidence,
    reasoning: typeof obj.notes === "string" ? obj.notes : "Analysis completed",
    warnings,
  };
}

/**
 * Calculate hash of a glyph image file for caching.
 */
function calculateImageHash(imagePath: string): string {
  try {
    const content = fs.readFileSync(imagePath);
    return crypto.createHash("sha256").update(content).digest("hex").substring(0, 16);
  } catch {
    return "missing";
  }
}

/**
 * Calculate font file checksum for cache invalidation.
 */
function calculateFontChecksum(fontPath: string): string {
  try {
    const content = fs.readFileSync(fontPath);
    return crypto.createHash("md5").update(content).digest("hex");
  } catch {
    return "missing";
  }
}

/**
 * OpenAI Vision Provider implementation.
 *
 * Uses OpenAI's vision-capable models to analyze KAP glyph images
 * and generate mapping candidates.
 *
 * SAFETY: All candidates have status: "candidate" and humanVerified: false
 *
 * Usage:
 * ```typescript
 * const provider = new OpenAIVisionProvider({ apiKey: process.env.OPENAI_API_KEY });
 * const response = await provider.analyze(request);
 * ```
 */
export class OpenAIVisionProvider implements VisionProvider {
  readonly name = "openai-vision";

  private client: OpenAI;
  private model: string;
  private concurrency: number;
  private timeout: number;
  private maxRetries: number;
  private cacheDir: string;
  private semaphore: { count: number; queue: Array<() => void> } = { count: 0, queue: [] };

  constructor(config: OpenAIVisionConfig) {
    if (!config.apiKey) {
      throw new Error(
        "OpenAI API key is required. Set KAP_VISION_API_KEY environment variable."
      );
    }

    const baseURL = config.baseURL
      ?? process.env.KAP_VISION_BASE_URL
      ?? "http://localhost:20333/v1";

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL,
      timeout: config.timeout ?? 60_000,
    });

    this.model = config.model
      ?? process.env.KAP_VISION_MODEL
      ?? "gpt-4o";

    this.concurrency = config.concurrency
      ?? parseInt(process.env.KAP_VISION_CONCURRENCY ?? "3", 10)
      ?? 3;

    this.timeout = config.timeout ?? 60_000;
    this.maxRetries = config.maxRetries ?? 3;
    this.cacheDir = config.cacheDir
      ?? path.join(process.cwd(), "mapping-data", "vision-cache");
  }

  /**
   * Acquire a concurrency slot.
   */
  private async acquire(): Promise<void> {
    if (this.semaphore.count < this.concurrency) {
      this.semaphore.count++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.semaphore.queue.push(() => {
        this.semaphore.count++;
        resolve();
      });
    });
  }

  /**
   * Release a concurrency slot.
   */
  private release(): void {
    this.semaphore.count--;
    if (this.semaphore.queue.length > 0) {
      const next = this.semaphore.queue.shift();
      next?.();
    }
  }

  /**
   * Get cache key for a request.
   */
  private getCacheKey(request: GlyphAnalysisRequest): CacheKey {
    const fontPath = path.join(process.cwd(), "public", "fonts", `${request.font.toLowerCase()}.ttf`);
    return {
      font: request.font,
      fontChecksum: calculateFontChecksum(fontPath),
      byte: request.byte,
      glyphImageHash: calculateImageHash(request.glyphImagePath),
      model: this.model,
      promptVersion: PROMPT_VERSION,
    };
  }

  /**
   * Get cache file path for a cache key.
   */
  private getCachePath(key: CacheKey): string {
    const hash = crypto.createHash("sha256")
      .update(JSON.stringify(key))
      .digest("hex")
      .substring(0, 24);
    return path.join(this.cacheDir, `${key.font}-${key.byte}-${hash}.json`);
  }

  /**
   * Read cached result if available.
   */
  private readCache(key: CacheKey): CachedResult | null {
    try {
      const cachePath = this.getCachePath(key);
      if (!fs.existsSync(cachePath)) return null;
      const data = fs.readFileSync(cachePath, "utf-8");
      return JSON.parse(data) as CachedResult;
    } catch {
      return null;
    }
  }

  /**
   * Write result to cache.
   */
  private writeCache(key: CacheKey, response: GlyphAnalysisResponse, imageHash: string): void {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
      const cachePath = this.getCachePath(key);
      const cached: CachedResult = {
        response,
        timestamp: new Date().toISOString(),
        model: this.model,
        promptVersion: PROMPT_VERSION,
        glyphImageHash: imageHash,
      };
      fs.writeFileSync(cachePath, JSON.stringify(cached, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to write vision cache:", err);
    }
  }

  /**
   * Analyze a glyph image with exponential backoff retry.
   */
  private async callVisionAPI(
    request: GlyphAnalysisRequest,
    imageBase64: string
  ): Promise<GlyphAnalysisResponse> {
    const prompt = buildAnalysisPrompt(request);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: prompt,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/png;base64,${imageBase64}`,
                    detail: "high",
                  },
                },
              ],
            },
          ],
          max_tokens: 1024,
          temperature: 0.1,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("Empty response from OpenAI API");
        }

        return parseModelResponse(content, request);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Don't retry on permanent errors
        if (err instanceof OpenAI.APIError) {
          const status = err.status;
          if (status === 401 || status === 403 || status === 422) {
            throw new Error(`OpenAI API error (${status}): ${err.message}`, { cause: err });
          }
        }

        // Exponential backoff for transient errors
        if (attempt < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError ?? new Error("Unknown error in vision API call");
  }

  /**
   * Analyze a glyph image and return candidate mappings.
   *
   * SAFETY: All candidates have status: "candidate" and humanVerified: false
   */
  async analyze(request: GlyphAnalysisRequest): Promise<GlyphAnalysisResponse> {
    // Check cache first
    const cacheKey = this.getCacheKey(request);
    const cached = this.readCache(cacheKey);
    if (cached) {
      return cached.response;
    }

    // Read image file
    let imageBase64: string;
    try {
      const imageBuffer = fs.readFileSync(request.glyphImagePath);
      imageBase64 = imageBuffer.toString("base64");
    } catch {
      return {
        candidates: [],
        analysisConfidence: 0,
        reasoning: `Failed to read glyph image: ${request.glyphImagePath}`,
        warnings: ["Glyph image file not found or unreadable"],
      };
    }

    // Acquire concurrency slot
    await this.acquire();

    try {
      const response = await this.callVisionAPI(request, imageBase64);

      // Cache the result
      const imageHash = calculateImageHash(request.glyphImagePath);
      this.writeCache(cacheKey, response, imageHash);

      return response;
    } finally {
      this.release();
    }
  }

  /**
   * Check if the provider is available and configured.
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Verify client can be created with valid API key
      return !!this.client && !!this.model;
    } catch {
      return false;
    }
  }

  /**
   * Get provider diagnostics.
   */
  getDiagnostics(): {
    provider: string;
    model: string;
    configured: boolean;
    cacheDir: string;
    concurrency: number;
  } {
    return {
      provider: this.name,
      model: this.model,
      configured: true,
      cacheDir: this.cacheDir,
      concurrency: this.concurrency,
    };
  }
}

/**
 * Create an OpenAI Vision Provider from environment variables.
 *
 * Checks KAP_VISION_API_KEY first, then falls back to OPENAI_API_KEY.
 * Returns null if neither is set.
 */
export function createOpenAIVisionProvider(): OpenAIVisionProvider | null {
  const apiKey = process.env.KAP_VISION_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new OpenAIVisionProvider({ apiKey });
}

/**
 * Vision Cache
 * ============
 * Deterministic caching for AI vision analysis results.
 *
 * Cache key includes:
 * - font name
 * - font checksum/version
 * - byte value
 * - glyph image hash
 * - model
 * - analyzer prompt/version
 *
 * If any of these change, the cached result is invalidated.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

/**
 * Cached analysis result with metadata.
 */
export interface CachedVisionResult {
  /** The analysis response */
  response: unknown;
  /** When this result was cached */
  timestamp: string;
  /** Model used for analysis */
  model: string;
  /** Prompt version for cache invalidation */
  promptVersion: string;
  /** Hash of the glyph image */
  glyphImageHash: string;
  /** Font checksum at time of analysis */
  fontChecksum: string;
}

/**
 * Cache key components.
 */
export interface VisionCacheKey {
  font: string;
  fontChecksum: string;
  byte: number;
  glyphImageHash: string;
  model: string;
  promptVersion: string;
}

/**
 * Vision cache configuration.
 */
export interface VisionCacheConfig {
  /** Cache directory - defaults to mapping-data/vision-cache */
  cacheDir?: string;
  /** Maximum cache age in days - defaults to 30 */
  maxAgeDays?: number;
}

/**
 * Calculate hash of a file for cache key generation.
 */
export function calculateFileHash(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(content).digest("hex").substring(0, 16);
  } catch {
    return "missing";
  }
}

/**
 * Calculate MD5 checksum of a file.
 */
export function calculateFileChecksum(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash("md5").update(content).digest("hex");
  } catch {
    return "missing";
  }
}

/**
 * Deterministic cache for vision analysis results.
 *
 * Usage:
 * ```typescript
 * const cache = new VisionCache({ cacheDir: "mapping-data/vision-cache" });
 * const cached = await cache.get(cacheKey);
 * if (cached) return cached;
 * // ... call API ...
 * await cache.set(cacheKey, response);
 * ```
 */
export class VisionCache {
  private cacheDir: string;
  private maxAgeMs: number;

  constructor(config: VisionCacheConfig = {}) {
    this.cacheDir = config.cacheDir
      ?? path.join(process.cwd(), "mapping-data", "vision-cache");
    this.maxAgeMs = (config.maxAgeDays ?? 30) * 24 * 60 * 60 * 1000;
  }

  /**
   * Get the cache file path for a given key.
   */
  private getCachePath(key: VisionCacheKey): string {
    const hash = crypto.createHash("sha256")
      .update(JSON.stringify(key))
      .digest("hex")
      .substring(0, 24);
    return path.join(this.cacheDir, `${key.font}-${key.byte}-${hash}.json`);
  }

  /**
   * Read a cached result.
   * Returns null if not found or expired.
   */
  get(key: VisionCacheKey): CachedVisionResult | null {
    try {
      const cachePath = this.getCachePath(key);
      if (!fs.existsSync(cachePath)) return null;

      const data = fs.readFileSync(cachePath, "utf-8");
      const cached = JSON.parse(data) as CachedVisionResult;

      // Check expiration
      const age = Date.now() - new Date(cached.timestamp).getTime();
      if (age > this.maxAgeMs) {
        fs.unlinkSync(cachePath);
        return null;
      }

      return cached;
    } catch {
      return null;
    }
  }

  /**
   * Write a result to cache.
   */
  set(key: VisionCacheKey, response: unknown): void {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }

      const cached: CachedVisionResult = {
        response,
        timestamp: new Date().toISOString(),
        model: key.model,
        promptVersion: key.promptVersion,
        glyphImageHash: key.glyphImageHash,
        fontChecksum: key.fontChecksum,
      };

      const cachePath = this.getCachePath(key);
      fs.writeFileSync(cachePath, JSON.stringify(cached, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to write vision cache:", err);
    }
  }

  /**
   * Check if a cached result exists and is valid.
   */
  has(key: VisionCacheKey): boolean {
    return this.get(key) !== null;
  }

  /**
   * Clear all cached results.
   */
  clear(): void {
    try {
      if (fs.existsSync(this.cacheDir)) {
        const files = fs.readdirSync(this.cacheDir);
        for (const file of files) {
          if (file.endsWith(".json")) {
            fs.unlinkSync(path.join(this.cacheDir, file));
          }
        }
      }
    } catch (err) {
      console.error("Failed to clear vision cache:", err);
    }
  }

  /**
   * Get cache statistics.
   */
  stats(): { totalFiles: number; totalSizeBytes: number; oldestEntry: string | null; newestEntry: string | null } {
    let totalFiles = 0;
    let totalSizeBytes = 0;
    let oldestEntry: string | null = null;
    let newestEntry: string | null = null;

    try {
      if (fs.existsSync(this.cacheDir)) {
        const files = fs.readdirSync(this.cacheDir).filter(f => f.endsWith(".json"));
        totalFiles = files.length;

        for (const file of files) {
          const filePath = path.join(this.cacheDir, file);
          const stat = fs.statSync(filePath);
          totalSizeBytes += stat.size;

          try {
            const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as CachedVisionResult;
            if (!oldestEntry || data.timestamp < oldestEntry) oldestEntry = data.timestamp;
            if (!newestEntry || data.timestamp > newestEntry) newestEntry = data.timestamp;
          } catch {
            // Skip invalid cache files
          }
        }
      }
    } catch {
      // Ignore errors
    }

    return { totalFiles, totalSizeBytes, oldestEntry, newestEntry };
  }
}

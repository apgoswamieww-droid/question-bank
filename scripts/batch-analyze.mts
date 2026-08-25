#!/usr/bin/env node
/**
 * batch-analyze.mts
 * =================
 * Batch processes all KAP fonts through the AI analysis pipeline.
 *
 * SAFETY RULES:
 * - Each font is processed independently
 * - No cross-font mapping copying
 * - All output has status: "candidate" and humanVerified: false
 *
 * Usage:
 *   npx tsx scripts/batch-analyze.mts
 *   npx tsx scripts/batch-analyze.mts --font KAP112
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const FONT_ANALYSIS_DIR = path.join(ROOT, "mapping-data", "font-analysis");
const GLYPH_DATASET_DIR = path.join(ROOT, "mapping-data", "glyph-dataset");
const CANDIDATES_DIR = path.join(ROOT, "mapping-data", "candidates");
const REPORT_DIR = path.join(ROOT, "mapping-data");

/** Auto-detect fonts from glyph-dataset directories (single source of truth). */
function detectFonts(): string[] {
  if (!existsSync(GLYPH_DATASET_DIR)) return [];
  return readdirSync(GLYPH_DATASET_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^KAP\d+$/.test(d.name))
    .map((d) => d.name)
    .sort();
}

const KAP_FONTS = detectFonts() as readonly string[];
type KapFont = (typeof KAP_FONTS)[number];

interface FontAnalysis {
  font: KapFont;
  file: string;
  md5: string;
  metadata: {
    familyName: string | null;
    version: string | null;
    numGlyphs: number;
  };
  byteMapping: Record<string, { byte: number; hasGlyph: boolean }>;
  coverage: {
    printableAscii: { total: number; withGlyph: number };
    extendedRange: { total: number; withGlyph: number };
    cp1252: { total: number; withGlyph: number };
  };
}

interface GlyphDatasetEntry {
  byte: number;
  hex: string;
  hasGlyph: boolean;
}

interface MappingCandidate {
  font: KapFont;
  byte: number;
  hex: string;
  unicode: string;
  confidence: number;
  confidenceCategory: string;
  status: "candidate";
  humanVerified: false;
  reasoning: string;
  generatedAt: string;
  updatedAt: string;
  metadata: {
    glyphName: string | null;
    hasGlyph: boolean;
  };
}

interface CandidateFile {
  font: KapFont;
  generatedAt: string;
  provider: string;
  candidates: MappingCandidate[];
}

function loadFontAnalysis(font: KapFont): FontAnalysis | null {
  const filePath = path.join(FONT_ANALYSIS_DIR, `${font.toLowerCase()}.json`);
  if (!existsSync(filePath)) {
    return null;
  }
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function loadGlyphDataset(font: KapFont): GlyphDatasetEntry[] | null {
  const filePath = path.join(GLYPH_DATASET_DIR, font, "meta.json");
  if (!existsSync(filePath)) {
    return null;
  }
  const data = JSON.parse(readFileSync(filePath, "utf8"));
  return Object.values(data.glyphs) as GlyphDatasetEntry[];
}

function getConfidenceCategory(score: number): string {
  if (score >= 0.90) return "very_high";
  if (score >= 0.75) return "high";
  if (score >= 0.50) return "medium";
  if (score >= 0.25) return "low";
  return "very_low";
}

function generateMockCandidates(
  font: KapFont,
  dataset: GlyphDatasetEntry[]
): MappingCandidate[] {
  const candidates: MappingCandidate[] = [];
  const now = new Date().toISOString();

  // Sample Gujarati characters for mock analysis
  const sampleChars = ["અ", "આ", "ઇ", "ઈ", "ઉ", "ઊ", "ઋ", "એ", "ઐ", "ઓ", "ઔ"];

  for (const entry of dataset) {
    if (!entry.hasGlyph) {
      continue;
    }

    // Generate 1-2 mock candidates with varying confidence
    const numCandidates = Math.floor(Math.random() * 2) + 1;

    for (let i = 0; i < numCandidates; i++) {
      const charIdx = Math.floor(Math.random() * sampleChars.length);
      const confidence = Math.round((0.3 + Math.random() * 0.6) * 100) / 100;

      candidates.push({
        font,
        byte: entry.byte,
        hex: entry.hex,
        unicode: sampleChars[charIdx],
        confidence,
        confidenceCategory: getConfidenceCategory(confidence),
        status: "candidate",
        humanVerified: false,
        reasoning: `Mock analysis: glyph resembles ${sampleChars[charIdx]}`,
        generatedAt: now,
        updatedAt: now,
        metadata: {
          glyphName: null,
          hasGlyph: entry.hasGlyph,
        },
      });
    }
  }

  return candidates.sort((a, b) => a.byte - b.byte);
}

function analyzeFont(font: KapFont): CandidateFile | null {
  console.log(`\nAnalyzing ${font}...`);

  const analysis = loadFontAnalysis(font);
  if (!analysis) {
    console.log(`  No font analysis found for ${font}`);
    return null;
  }

  const dataset = loadGlyphDataset(font);
  if (!dataset) {
    console.log(`  No glyph dataset found for ${font}`);
    return null;
  }

  console.log(
    `  Font: ${analysis.metadata.familyName} (${analysis.metadata.numGlyphs} glyphs)`
  );
  console.log(
    `  Coverage: ASCII=${analysis.coverage.printableAscii.withGlyph}/${analysis.coverage.printableAscii.total}, ` +
      `Extended=${analysis.coverage.extendedRange.withGlyph}/${analysis.coverage.extendedRange.total}, ` +
      `CP1252=${analysis.coverage.cp1252.withGlyph}/${analysis.coverage.cp1252.total}`
  );

  // Generate candidates (mock for now)
  const candidates = generateMockCandidates(font, dataset);

  console.log(`  Generated ${candidates.length} candidates`);

  const candidateFile: CandidateFile = {
    font,
    generatedAt: new Date().toISOString(),
    provider: "mock",
    candidates,
  };

  // Save candidate file
  mkdirSync(CANDIDATES_DIR, { recursive: true });
  const outPath = path.join(CANDIDATES_DIR, `${font.toLowerCase()}-candidates.json`);
  writeFileSync(outPath, JSON.stringify(candidateFile, null, 2));

  console.log(`  Saved to ${path.relative(ROOT, outPath)}`);

  return candidateFile;
}

function generateBatchReport(results: Map<KapFont, CandidateFile | null>): string {
  const lines: string[] = [
    "# Batch Analysis Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
  ];

  let totalCandidates = 0;
  const byConfidence: Record<string, number> = {};

  for (const [font, result] of results) {
    if (result) {
      totalCandidates += result.candidates.length;
      for (const c of result.candidates) {
        byConfidence[c.confidenceCategory] =
          (byConfidence[c.confidenceCategory] ?? 0) + 1;
      }
    }
  }

  lines.push(`Total candidates: ${totalCandidates}`);
  lines.push("");

  lines.push("## By Confidence Level");
  lines.push("");
  for (const [level, count] of Object.entries(byConfidence)) {
    lines.push(`- ${level}: ${count}`);
  }
  lines.push("");

  lines.push("## Per Font");
  lines.push("");

  for (const [font, result] of results) {
    if (result) {
      lines.push(`### ${font}`);
      lines.push(`- Candidates: ${result.candidates.length}`);
      lines.push(`- Provider: ${result.provider}`);
      lines.push("");
    } else {
      lines.push(`### ${font}`);
      lines.push("- No data available");
      lines.push("");
    }
  }

  return lines.join("\n");
}

function main(): number {
  const args = process.argv.slice(2);
  const fontArg = args.find((a) => a.startsWith("--font="))?.split("=")[1];

  const fontsToAnalyze: KapFont[] = fontArg
    ? [(fontArg.toUpperCase() as KapFont)]
    : [...KAP_FONTS];

  console.log("Batch KAP Font Analysis");
  console.log("=======================");

  const results = new Map<KapFont, CandidateFile | null>();

  for (const font of fontsToAnalyze) {
    if (!KAP_FONTS.includes(font)) {
      console.error(`Invalid font: ${font}`);
      continue;
    }
    const result = analyzeFont(font);
    results.set(font, result);
  }

  // Generate report
  const report = generateBatchReport(results);
  const reportPath = path.join(REPORT_DIR, "batch-report.md");
  writeFileSync(reportPath, report);
  console.log(`\nReport saved to ${path.relative(ROOT, reportPath)}`);

  console.log("\nBatch analysis complete.");
  return 0;
}

process.exit(main());

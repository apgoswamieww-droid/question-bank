#!/usr/bin/env node
/**
 * generate-analysis-report.mts
 * ============================
 * Generates human-readable analysis reports for KAP font candidates.
 *
 * Usage:
 *   npx tsx scripts/generate-analysis-report.mts
 *   npx tsx scripts/generate-analysis-report.mts --font KAP112
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CANDIDATES_DIR = path.join(ROOT, "mapping-data", "candidates");
const FONT_ANALYSIS_DIR = path.join(ROOT, "mapping-data", "font-analysis");
const REPORT_DIR = path.join(ROOT, "mapping-data");
const GLYPH_DATASET_DIR = path.join(ROOT, "mapping-data", "glyph-dataset");

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

interface MappingCandidate {
  font: KapFont;
  byte: number;
  hex: string;
  unicode: string;
  confidence: number;
  confidenceCategory: string;
  status: string;
  humanVerified: boolean;
  reasoning: string;
  generatedAt: string;
}

interface CandidateFile {
  font: KapFont;
  generatedAt: string;
  provider: string;
  candidates: MappingCandidate[];
}

interface FontAnalysis {
  font: KapFont;
  metadata: {
    familyName: string | null;
    numGlyphs: number;
  };
  coverage: {
    printableAscii: { total: number; withGlyph: number };
    extendedRange: { total: number; withGlyph: number };
    cp1252: { total: number; withGlyph: number };
  };
}

function loadCandidateFile(font: KapFont): CandidateFile | null {
  const filePath = path.join(CANDIDATES_DIR, `${font.toLowerCase()}-candidates.json`);
  if (!existsSync(filePath)) {
    return null;
  }
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function loadFontAnalysis(font: KapFont): FontAnalysis | null {
  const filePath = path.join(FONT_ANALYSIS_DIR, `${font.toLowerCase()}.json`);
  if (!existsSync(filePath)) {
    return null;
  }
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function generateFontReport(font: KapFont): string {
  const lines: string[] = [`# ${font} Analysis Report`, ""];

  const analysis = loadFontAnalysis(font);
  const candidates = loadCandidateFile(font);

  if (analysis) {
    lines.push("## Font Information", "");
    lines.push(`- **Family Name**: ${analysis.metadata.familyName}`);
    lines.push(`- **Glyph Count**: ${analysis.metadata.numGlyphs}`);
    lines.push(
      `- **ASCII Coverage**: ${analysis.coverage.printableAscii.withGlyph}/${analysis.coverage.printableAscii.total}`
    );
    lines.push(
      `- **Extended Coverage**: ${analysis.coverage.extendedRange.withGlyph}/${analysis.coverage.extendedRange.total}`
    );
    lines.push(
      `- **CP1252 Coverage**: ${analysis.coverage.cp1252.withGlyph}/${analysis.coverage.cp1252.total}`
    );
    lines.push("");
  }

  if (candidates) {
    const total = candidates.candidates.length;
    const verified = candidates.candidates.filter((c) => c.humanVerified).length;
    const rejected = candidates.candidates.filter((c) => c.status === "rejected").length;
    const unsure = candidates.candidates.filter((c) => c.status === "unsure").length;
    const pending = candidates.candidates.filter((c) => c.status === "candidate").length;

    const byConfidence: Record<string, number> = {};
    for (const c of candidates.candidates) {
      byConfidence[c.confidenceCategory] =
        (byConfidence[c.confidenceCategory] ?? 0) + 1;
    }

    lines.push("## Candidate Summary", "");
    lines.push(`- **Total Candidates**: ${total}`);
    lines.push(`- **Verified**: ${verified}`);
    lines.push(`- **Rejected**: ${rejected}`);
    lines.push(`- **Unsure**: ${unsure}`);
    lines.push(`- **Pending Review**: ${pending}`);
    lines.push("");

    lines.push("## By Confidence Level", "");
    for (const [level, count] of Object.entries(byConfidence)) {
      lines.push(`- **${level}**: ${count}`);
    }
    lines.push("");

    lines.push("## Top 10 Candidates", "");
    const topCandidates = [...candidates.candidates]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);

    for (const c of topCandidates) {
      lines.push(
        `- **${c.hex}** (${c.byte}): ${c.unicode} — ${Math.round(c.confidence * 100)}% — ${c.status}`
      );
    }
    lines.push("");
  } else {
    lines.push("## No Candidates", "");
    lines.push("No candidate file found for this font.");
    lines.push("");
  }

  lines.push("---");
  lines.push(`*Generated: ${new Date().toISOString()}*`);

  return lines.join("\n");
}

function generateOverallReport(fonts: KapFont[]): string {
  const lines: string[] = ["# KAP Font Analysis Report", "", "## Overall Summary", ""];

  let totalCandidates = 0;
  let totalVerified = 0;
  let totalRejected = 0;
  let totalPending = 0;

  const byFont: Record<string, { total: number; verified: number; pending: number }> = {};

  for (const font of fonts) {
    const candidates = loadCandidateFile(font);
    if (candidates) {
      const total = candidates.candidates.length;
      const verified = candidates.candidates.filter((c) => c.humanVerified).length;
      const rejected = candidates.candidates.filter((c) => c.status === "rejected").length;
      const pending = candidates.candidates.filter((c) => c.status === "candidate").length;

      totalCandidates += total;
      totalVerified += verified;
      totalRejected += rejected;
      totalPending += pending;

      byFont[font] = { total, verified, pending };
    }
  }

  lines.push(`- **Total Candidates**: ${totalCandidates}`);
  lines.push(`- **Verified**: ${totalVerified}`);
  lines.push(`- **Rejected**: ${totalRejected}`);
  lines.push(`- **Pending Review**: ${totalPending}`);
  lines.push("");

  lines.push("## Per Font", "");
  for (const [font, stats] of Object.entries(byFont)) {
    lines.push(`### ${font}`);
    lines.push(`- Total: ${stats.total}`);
    lines.push(`- Verified: ${stats.verified}`);
    lines.push(`- Pending: ${stats.pending}`);
    lines.push("");
  }

  lines.push("---");
  lines.push(`*Generated: ${new Date().toISOString()}*`);

  return lines.join("\n");
}

function main(): number {
  const args = process.argv.slice(2);
  const fontArg = args.find((a) => a.startsWith("--font="))?.split("=")[1];

  const fontsToReport: KapFont[] = fontArg
    ? [(fontArg.toUpperCase() as KapFont)]
    : [...KAP_FONTS];

  console.log("Generating analysis reports...");
  mkdirSync(REPORT_DIR, { recursive: true });

  // Generate per-font reports
  for (const font of fontsToReport) {
    if (!KAP_FONTS.includes(font)) {
      console.error(`Invalid font: ${font}`);
      continue;
    }

    const report = generateFontReport(font);
    const reportPath = path.join(REPORT_DIR, `${font.toLowerCase()}-report.md`);
    writeFileSync(reportPath, report);
    console.log(`  ${font}: ${path.relative(ROOT, reportPath)}`);
  }

  // Generate overall report
  const overallReport = generateOverallReport(fontsToReport);
  const overallPath = path.join(REPORT_DIR, "analysis-report.md");
  writeFileSync(overallPath, overallReport);
  console.log(`  Overall: ${path.relative(ROOT, overallPath)}`);

  console.log("Done.");
  return 0;
}

process.exit(main());

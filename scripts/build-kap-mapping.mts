/**
 * build-kap-mapping.mts — compile a human-entered session into the
 * font's mapping module + machine-checkable test cases.
 *
 * SAFETY MODEL
 * ------------
 * - Only writes rules for entries present in mapping-data/<font>-session.json
 *   (i.e. typed in by a human while looking at proof sheets).
 * - The generated mapping module ALWAYS ships `verified: false`.
 *   Verification is a separate, explicit human decision backed by real
 *   bilingual documents — never a side effect of running this tool.
 * - Test cases are emitted to mapping-data/<font>-cases.json; the harness
 *   runs them against an INJECTED copy so the shipped registry stays
 *   unverified and the production UI keeps refusing conversion.
 *
 * Usage:
 *   npx -y tsx scripts/build-kap-mapping.mts [KAP112] [--dry]
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const DATA_DIR = path.join(ROOT, "mapping-data");

interface SessionEntry {
  code: number; char: string; unicode: string;
  confidence: "sure" | "unsure"; enteredAt: string;
}
interface Session { font: string; updatedAt: string; entries: Record<string, SessionEntry>; }

const font = (process.argv[2] ?? "KAP112").toUpperCase();
const dry = process.argv.includes("--dry");
if (!/^KAP\d{3}$/.test(font)) {
  console.error(`Bad font label '${font}'`);
  process.exit(2);
}
const stem = font.toLowerCase();
const sessionPath = path.join(DATA_DIR, `${stem}-session.json`);
if (!existsSync(sessionPath)) {
  console.error(`No session file at ${path.relative(ROOT, sessionPath)} — nothing to build.`);
  process.exit(2);
}
const session: Session = JSON.parse(readFileSync(sessionPath, "utf8"));
const entries = Object.values(session.entries).sort((a, b) => a.code - b.code);
if (entries.length === 0) {
  console.error("Session has no entries.");
  process.exit(2);
}

// ---- conflict pre-check (same unicode from two codes) ----------------------
const byUnicode = new Map<string, number[]>();
for (const e of entries) {
  if (!e.unicode) continue;
  const list = byUnicode.get(e.unicode) ?? [];
  list.push(e.code);
  byUnicode.set(e.unicode, list);
}
const conflicts = [...byUnicode.entries()].filter(([, codes]) => codes.length > 1);
if (conflicts.length > 0) {
  console.warn("WARNING: same Unicode assigned to multiple codes:");
  for (const [u, codes] of conflicts) {
    console.warn(`  '${u}' <- ${codes.map((c) => `${c}/0x${c.toString(16).toUpperCase()}`).join(", ")}`);
  }
}

const sureCount = entries.filter((e) => e.confidence === "sure" && e.unicode).length;
const unsureCount = entries.filter((e) => e.confidence === "unsure").length;
const noMeaningCount = entries.filter((e) => !e.unicode).length;

// ---- generate mapping module ------------------------------------------------
const cap = font[0] + font.slice(1).toLowerCase(); // Kap112
const rulesTs = entries
  .filter((e) => e.unicode)
  .map((e) => {
    const uni = JSON.stringify(e.unicode);
    const kapLit = JSON.stringify(String.fromCharCode(e.code));
    const note = e.confidence === "unsure" ? " // unsure" : "";
    return `  { unicode: ${uni}, kap: ${kapLit} },${note}`;
  })
  .join("\n");

const passthroughs = entries
  .filter((e) => !e.unicode)
  .map((e) => `'${JSON.stringify(e.char).slice(1, -1)}'`)
  .join(" ");

const moduleSrc = `import type { ConversionRule, VerifiedSample } from "../types";

/**
 * ${font} — Unicode -> legacy mapping table.
 *
 * STATUS: DRAFT — HUMAN-ENTERED, NOT VERIFIED.
 *
 * Rules below were transcribed by a human from the proof sheets in
 * proof-sheets/${font}/ (see scripts/enter-kap-mapping.mts). They encode
 * what a person SAW; they have NOT yet been validated against real
 * bilingual documents. verified therefore stays false: production
 * conversion stays disabled until that review happens.
 *
 * Entered: ${entries.length} codes (${sureCount} sure, ${unsureCount} unsure,
 * ${noMeaningCount} marked as having no Gujarati meaning).
 * Session source: mapping-data/${stem}-session.json (${session.updatedAt})
 *
 * The engine consumes rules as longest-sequence-first on the unicode side;
 * single-code entries here are safe by construction.
 */

export const ${font}_RULES: ConversionRule[] = [
${rulesTs}
];

export const ${font}_SAMPLES: VerifiedSample[] = ${font === "KAP112" ? `[
  {
    unicode: "\u0A97\u0AC1\u0A9C\u0AB0\u0ABE\u0AA4\u0AC0",
    expected: "VF5[,F",
    source: "Default editor content in src/App.tsx (KAP112 span)",
  },
];` : "[];"}
`;

// ---- test cases -------------------------------------------------------------
mkdirSync(DATA_DIR, { recursive: true });
const casesPath = path.join(DATA_DIR, `${stem}-cases.json`);
const cases = entries
  .filter((e) => e.unicode)
  .map((e) => ({ unicode: e.unicode, expected: e.char }));

function writeAtomic(p: string, data: string): void {
  const tmp = p + ".tmp";
  writeFileSync(tmp, data);
  renameSync(tmp, p);
}

console.log(`Entries: ${entries.length} (${sureCount} sure / ${unsureCount} unsure / ${noMeaningCount} no-meaning)`);
console.log(`Rules generated: ${entries.length - noMeaningCount}`);
if (conflicts.length > 0) console.warn(`Conflicts: ${conflicts.length} (see above — fix session before trusting output)`);

if (dry) {
  console.log("--dry: wrote nothing");
  process.exit(conflicts.length > 0 ? 1 : 0);
}

writeAtomic(casesPath, JSON.stringify({ font, generatedAt: new Date().toISOString(), cases }, null, 1));

const mapPath = path.join(ROOT, "src", "converter", "mappings", `${stem}.ts`);
writeAtomic(mapPath, moduleSrc);

console.log(`Wrote ${path.relative(ROOT, mapPath)} (verified: false preserved)`);
console.log(`Wrote ${path.relative(ROOT, casesPath)} (${cases.length} cases)`);
console.log("Run: npx -y tsx scripts/test-converter.mts");

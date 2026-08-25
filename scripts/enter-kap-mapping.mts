/**
 * enter-kap-mapping.mts — human-in-the-loop KAP mapping entry.
 *
 * Walks a human through every content byte of one KAP font, pointing at
 * the exact proof-sheet cell (page/row/col from proof-sheets/manifest.json)
 * and recording the Gujarati character the HUMAN identifies there.
 *
 * This tool NEVER suggests, guesses or infers values. Blank stays blank.
 *
 * Usage:
 *   npx -y tsx scripts/enter-kap-mapping.mts [KAP112] [--codes 56,46] [--redo]
 *
 * Input grammar at each prompt:
 *   <unicode text>              record single-char mapping, confidence "sure"
 *   s <unicode> <kap-bytes>     sequence mapping (e.g. s ગ VF)
 *   u <text>                    record mapping, confidence "unsure"
 *   -                           byte has no Gujarati meaning (e.g. punctuation)
 *   <Enter>                     skip for now
 *   b                           go back one step
 *   q                           save and quit
 *
 * Progress is stored in mapping-data/<font>-session.json after every
 * accepted entry (atomic write). Re-running resumes where you left off.
 */

import * as readline from "node:readline";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const MANIFEST = path.join(ROOT, "proof-sheets", "manifest.json");
const DATA_DIR = path.join(ROOT, "mapping-data");

interface ManifestCell {
  byte: number; dec: number; hex: string; char_repr: string;
  glyph_name: string | null; has_glyph: boolean; section: string;
  page: string; row: number; col: number;
}
interface SessionEntry {
  code: number; char: string; unicode: string;
  /** KAP byte sequence. Single char for simple mappings, multi-char for sequences. */
  kapSequence: string;
  confidence: "sure" | "unsure"; enteredAt: string;
}
interface Session {
  font: string; updatedAt: string; entries: Record<number, SessionEntry>;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const font = (process.argv[2] ?? "KAP112").toUpperCase();
if (!/^KAP\d{3}$/.test(font)) {
  console.error(`Bad font label '${font}' — expected e.g. KAP112`);
  process.exit(2);
}
const codesArg = arg("--codes");
const redo = process.argv.includes("--redo");

if (!existsSync(MANIFEST)) {
  console.error("proof-sheets/manifest.json missing — run scripts/generate-kap-proof-sheets.py first");
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const cells: ManifestCell[] = manifest.fonts[font]?.cells;
if (!cells) {
  console.error(`No manifest cells for ${font}`);
  process.exit(2);
}
const byCode = new Map<number, ManifestCell>(cells.map((c) => [c.dec, c]));

const CONTENT_CODES = cells
  .filter((c) => c.section === "ascii" || c.section === "extended")
  .map((c) => c.dec)
  .sort((a, b) => a - b);

const targets = codesArg
  ? codesArg.split(",").map((s) => parseInt(s.trim(), 10))
  : CONTENT_CODES;

mkdirSync(DATA_DIR, { recursive: true });
const sessionPath = path.join(DATA_DIR, `${font.toLowerCase()}-session.json`);
const session: Session = existsSync(sessionPath)
  ? JSON.parse(readFileSync(sessionPath, "utf8"))
  : { font, updatedAt: new Date().toISOString(), entries: {} };

function save(): void {
  session.updatedAt = new Date().toISOString();
  const tmp = sessionPath + ".tmp";
  writeFileSync(tmp, JSON.stringify(session, null, 1));
  renameSync(tmp, sessionPath);
}

/** Gujarati block + common ASCII passthroughs. */
function validateUnicode(v: string): string | null {
  if (!v) return null;
  const normalized = v.normalize("NFC");
  for (const ch of normalized) {
    const cp = ch.codePointAt(0)!;
    const gujarati = cp >= 0x0a80 && cp <= 0x0aff;
    if (!gujarati) {
      return `character '${ch}' (U+${cp.toString(16)}) is not in Gujarati block`;
    }
  }
  return null;
}

/** KAP output must be printable ASCII (0x20-0x7E). */
function validateKapSequence(v: string): string | null {
  if (!v) return null;
  for (const ch of v) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x20 || cp > 0x7e) {
      return `character '${ch}' (U+${cp.toString(16)}) is outside printable ASCII range for KAP output`;
    }
  }
  return null;
}

console.log(`
KAP mapping entry — ${font}
Answer with the Gujarati character(s) you SEE in the proof-sheet cell.

Input grammar:
  <unicode>              single-char mapping (sure)
  s <unicode> <kap>      sequence mapping, e.g. s ગ VF (sure)
  u <unicode>            unsure mapping
  -                      no Gujarati meaning
  <Enter>                skip
  b                      back one step
  q                      save and quit
`);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

/**
 * Line queue around the event-based readline API.
 * (readline/promises `question()` silently hangs on the 2nd call when
 * input is a pipe — buffered lines get missed. This queue never loses one,
 * and behaves identically for interactive typing.)
 */
const pending: string[] = [];
let stdinClosed = false;
let waiter: (() => void) | null = null;
rl.on("line", (line) => {
  pending.push(line);
  waiter?.();
  waiter = null;
});
rl.on("close", () => {
  stdinClosed = true;
  waiter?.();
  waiter = null;
});

async function ask(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  for (;;) {
    const line = pending.shift();
    if (line !== undefined) return line;
    if (stdinClosed) return "q";
    await new Promise<void>((resolve) => { waiter = resolve; });
  }
}

let idx = 0;

async function main(): Promise<void> {
  while (idx < targets.length) {
    const code = targets[idx];
    const cell = byCode.get(code)!;
    if (
      !redo &&
      !codesArg &&
      session.entries[code] !== undefined
    ) {
      idx++;
      continue;
    }
    const answered = Object.keys(session.entries).length;
    process.stdout.write("\x1b[2J\x1b[H");
    console.log(
      `${font}  progress ${answered}/${CONTENT_CODES.length}` +
        (codesArg ? `  (targeted run: ${targets.join(",")})` : "")
    );
    console.log("─".repeat(62));
    const prompt =
      `Dec ${String(code).padStart(3)}  Hex ${cell.hex}  ${cell.char_repr}  ` +
      `sheet: ${cell.page.replace(/\.png$/, "")}  row ${cell.row}, col ${cell.col}   > `;
    const raw = (await ask(prompt)).trim();

    if (raw === "q") break;
    if (raw === "") { idx++; continue; }
    if (raw === "b") { idx = Math.max(0, idx - 1); continue; }

    let unicode = "";
    let kapSequence = String.fromCharCode(code);
    let confidence: "sure" | "unsure" = "sure";

    if (raw === "-") {
      unicode = "";
      kapSequence = String.fromCharCode(code);
    } else if (raw.startsWith("s ")) {
      // Sequence mode: "s <unicode> <kap-bytes>"
      const parts = raw.slice(2).trim().split(/\s+/);
      if (parts.length < 2) {
        console.log("  rejected: sequence mode requires 's <unicode> <kap-bytes>'");
        continue;
      }
      unicode = parts[0];
      kapSequence = parts.slice(1).join(" ");
      const errU = validateUnicode(unicode);
      if (errU) { console.log(`  rejected: ${errU}`); continue; }
      const errK = validateKapSequence(kapSequence);
      if (errK) { console.log(`  rejected: ${errK}`); continue; }
    } else if (raw.startsWith("u ")) {
      confidence = "unsure";
      unicode = raw.slice(2).trim();
      const errU = validateUnicode(unicode);
      if (errU) { console.log(`  rejected: ${errU}`); continue; }
    } else {
      // Simple single-char mapping
      unicode = raw;
      const errU = validateUnicode(unicode);
      if (errU) { console.log(`  rejected: ${errU}`); continue; }
    }

    session.entries[code] = {
      code,
      char: String.fromCharCode(code),
      unicode: unicode.normalize("NFC"),
      kapSequence,
      confidence,
      enteredAt: new Date().toISOString(),
    };
    save();
    idx++;
  }
  save();
  rl.close();
  const answered = Object.keys(session.entries).length;
  console.log(`\nSaved ${answered}/${CONTENT_CODES.length} entries -> ${path.relative(ROOT, sessionPath)}`);
  if (answered > 0) {
    console.log(`Next: npx -y tsx scripts/build-kap-mapping.mts ${font}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Pure text helpers for the conversion pipeline.
 * No DOM/React imports — usable from Node test runs.
 */

/** Gujarati block: U+0A80–U+0AFF. */
const GUJARATI_BLOCK_START = 0x0a80;
const GUJARATI_BLOCK_END = 0x0aff;

export function isGujaratiCodePoint(code: number): boolean {
  return code >= GUJARATI_BLOCK_START && code <= GUJARATI_BLOCK_END;
}

export function isGujaratiChar(ch: string): boolean {
  if (ch.length !== 1) return false;
  return isGujaratiCodePoint(ch.codePointAt(0) ?? 0);
}

/** Combining marks (matras, anusvara, halant...) plus invisible joiners. */
export function isCombiningOrJoiner(code: number): boolean {
  // ZWJ / ZWNJ
  if (code === 0x200c || code === 0x200d) return true;
  if (isGujaratiCodePoint(code)) {
    // Mn/Mc ranges inside the Gujarati block:
    // U+0A81–U+0A83 signs, U+0ABC anusvara, U+0ABD–U+0AD0 misc,
    // vowel signs U+0ABE–U+0ACD (incl. halant U+0ACD).
    if (
      (code >= 0x0a81 && code <= 0x0a83) ||
      code === 0x0abc ||
      (code >= 0x0abe && code <= 0x0acd)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Split text into contiguous runs of Gujarati vs non-Gujarati.
 * Non-Gujarati runs (English, numbers, punctuation, whitespace, newlines)
 * are preserved verbatim downstream.
 */
export interface TextRun {
  gujarati: boolean;
  text: string;
  /** Index of this run's first character within the full input. */
  start: number;
}

export function segmentRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let current: TextRun | null = null;

  for (let i = 0; i < text.length; i++) {
    const isGu = isGujaratiCodePoint(text.codePointAt(i) ?? 0);
    if (current && current.gujarati === isGu) {
      current.text += text[i];
    } else {
      current = { gujarati: isGu, text: text[i], start: i };
      runs.push(current);
    }
  }
  return runs;
}

/**
 * Consume one user-perceived "cluster" starting at `start`:
 * a base character followed by any combining marks / joiners.
 * Used to report warnings over meaningful units instead of lone marks.
 */
export function takeCluster(text: string, start: number): string {
  let end = start + 1;
  while (end < text.length && isCombiningOrJoiner(text.codePointAt(end) ?? 0)) {
    end++;
  }
  return text.slice(start, end);
}

/**
 * Normalize input with Unicode NFC before matching.
 *
 * WHY NFC: users paste from WhatsApp/browsers where the same visual
 * cluster may arrive in composed or decomposed form. NFC gives the
 * mapping tables ONE canonical form to target. It never changes
 * ASCII/Latin characters, so English and numbers are untouched.
 */
export function normalizeInput(text: string): string {
  try {
    return text.normalize("NFC");
  } catch {
    // Very old engines without normalize support: proceed with raw text.
    return text;
  }
}

/** True when the string contains at least one Gujarati character. */
export function containsGujarati(text: string): boolean {
  for (const ch of text) {
    if (isGujaratiChar(ch)) return true;
  }
  return false;
}

/**
 * Conservative heuristic: does this look like it is ALREADY legacy/KAP
 * ASCII? Legacy KAP output is pure ASCII but noticeably punctuation-heavy
 * because matras/conjuncts map onto [,;5F[]-style glyphs.
 */
export function looksLikeLegacyKap(text: string): boolean {
  if (containsGujarati(text)) return false;
  const asciiOnly = /^[\x20-\x7e\r\n\t]*$/.test(text);
  if (!asciiOnly || !/[a-z0-9]/i.test(text)) return false;
  const legacyPunctuation = (text.match(/[,;\][5F]/g) ?? []).length;
  return legacyPunctuation >= Math.max(2, text.length * 0.15);
}

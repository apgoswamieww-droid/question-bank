# AI-Assisted KAP Font Mapping Analyzer — Implementation Plan

## Overview

Build an offline-capable pipeline that uses font analysis and vision AI to generate **candidate** mappings for KAP fonts. Every AI suggestion has `status: "candidate"` and `humanVerified: false` until explicitly confirmed by a human.

**Safety Rules:**
- Never set `verified: true` automatically
- Never copy mappings between fonts
- Never infer from glyph names/code-point order/visual similarity alone
- Never fabricate mappings
- AI = candidates only

---

## Phase 1: Font Metadata Extraction

**Script:** `scripts/analyze-kap-font.mts`

**Purpose:** Extract comprehensive metadata from each KAP font file using Python's fontTools.

**Implementation:**
- Create Python helper: `scripts/font-analyzer.py`
- Extract for each font:
  - Basic metadata (family name, version, numGlyphs)
  - Full cmap tables (Unicode, Mac Roman)
  - Glyph names and outlines (as SVG paths)
  - Character coverage analysis
  - Byte-to-glyph mapping resolution (same logic as proof sheet generator)

**Output:** `mapping-data/font-analysis/<font>.json`

```json
{
  "font": "KAP112",
  "file": "public/fonts/kap112.ttf",
  "metadata": { "family": "...", "version": "...", "numGlyphs": 218 },
  "cmaps": {
    "unicode": { "32": "space", "33": "exclam", ... },
    "macRoman": { "128": "...", ... }
  },
  "byteMapping": {
    "32": { "glyphName": "space", "hasGlyph": false },
    "33": { "glyphName": "exclam", "hasGlyph": true },
    ...
  },
  "glyphCount": 218,
  "coverage": {
    "printableAscii": 94,
    "extendedRange": 96,
    "cp1252": 32
  }
}
```

---

## Phase 2: Glyph Dataset Generation

**Script:** `scripts/generate-kap-glyph-dataset.mts`

**Purpose:** Render each byte's glyph as an individual PNG image for AI analysis.

**Implementation:**
- Reuse proven rendering logic from `generate-kap-proof-sheets.py`
- For each font, render 223 individual glyph images (95 ASCII + 96 extended + 32 cp1252)
- Use consistent sizing (e.g., 200x200 px) with white background
- Store metadata alongside each image

**Output Structure:**
```
mapping-data/glyph-dataset/
  KAP110/
    meta.json          # byte -> glyph info mapping
    0x20.png           # space (blank)
    0x21.png           # !
    ...
    0xA0.png           # first extended byte
    ...
  KAP111/
    ...
  KAP112/
    ...
  KAP122/
    ...
```

**meta.json format:**
```json
{
  "font": "KAP112",
  "generatedAt": "2026-08-25T...",
  "glyphs": {
    "0x20": { "byte": 32, "glyphName": "space", "hasGlyph": false, "image": "0x20.png" },
    "0x21": { "byte": 33, "glyphName": "exclam", "hasGlyph": true, "image": "0x21.png" },
    ...
  }
}
```

---

## Phase 3: Vision AI Provider Interface

**File:** `src/converter/ai-analyzer/types.ts`

**Purpose:** Define abstract interface for vision AI providers. No actual API implementation.

**Design:**
```typescript
interface GlyphAnalysisRequest {
  font: KapFont;
  byte: number;
  glyphImagePath: string;
  glyphName: string | null;
  context?: string; // e.g., "Gujarati vowel range"
}

interface GlyphAnalysisResponse {
  candidates: GlyphCandidate[];
  confidence: number; // 0-1
  reasoning?: string;
}

interface GlyphCandidate {
  unicode: string;       // Gujarati character(s)
  confidence: number;    // 0-1
  reasoning: string;     // Why this mapping
}

type VisionProvider = {
  name: string;
  analyze(request: GlyphAnalysisRequest): Promise<GlyphAnalysisResponse>;
};
```

**Providers (stubs):**
- `LocalVisionProvider` — for future local model integration
- `CloudVisionProvider` — for future API integration (OpenAI, etc.)
- `MockProvider` — for testing

---

## Phase 4: Candidate Generation Engine

**Script:** `scripts/generate-candidates.mts`

**Purpose:** Use vision AI to analyze glyphs and generate candidate mappings.

**Implementation:**
- Load font analysis (Phase 1) and glyph dataset (Phase 2)
- For each glyph, request AI analysis
- Apply safety filters:
  - Reject candidates outside Gujarati Unicode block (U+0A80-U+0AFF)
  - Reject candidates with confidence < threshold (e.g., 0.3)
  - Flag multi-byte sequence candidates specially
- Output candidates with `status: "candidate"` and `humanVerified: false`

**Output:** `mapping-data/candidates/<font>-candidates.json`

```json
{
  "font": "KAP112",
  "generatedAt": "2026-08-25T...",
  "provider": "mock",
  "candidates": [
    {
      "byte": 161,
      "unicode": "અ",
      "confidence": 0.85,
      "reasoning": "Glyph resembles Gujarati vowel A",
      "status": "candidate",
      "humanVerified": false
    },
    ...
  ]
}
```

---

## Phase 5: Candidate Validation

**File:** `src/converter/ai-analyzer/validation.ts`

**Purpose:** Validate AI candidates against known constraints.

**Checks:**
1. **Unicode range**: Must be Gujarati block (U+0A80-U+0AFF) or empty
2. **Duplicate detection**: Same byte mapped to multiple Unicode chars
3. **Conflict detection**: Same Unicode char mapped from multiple bytes (allowed for sequences)
4. **Golden sample check**: If candidate contradicts `ગુજરાતી → VF5[,F`, flag it
5. **Sequence validation**: Multi-byte KAP output must be printable ASCII (0x20-0x7E)

**Output:** `mapping-data/candidates/<font>-validated.json`

---

## Phase 6: Review UI Component

**File:** `src/components/KapAnalyzerReview.tsx`

**Purpose:** React component for human review of AI candidates.

**Features:**
- Display glyph image alongside candidate Unicode character
- Show confidence score and AI reasoning
- Allow human to:
  - Confirm candidate (sets `humanVerified: true`)
  - Reject candidate
  - Edit candidate (correct Unicode character)
  - Mark as "unsure" for later review
- Batch operations (confirm all high-confidence, reject all low-confidence)
- Progress tracking per font

**Integration:**
- Add to Electron app as a new tab/modal
- Or create standalone web UI for review workflow

---

## Phase 7: Mapping Export

**Script:** `scripts/export-verified-mappings.mts`

**Purpose:** Export human-verified candidates to TypeScript mapping files.

**Implementation:**
- Load validated candidates (Phase 5)
- Filter to only `humanVerified: true` entries
- Generate TypeScript rules matching existing format:
  ```typescript
  { unicode: "અ", kap: "A" }
  ```
- Output to `src/converter/mappings/kap<font>.ts`
- **Never** set `verified: true` in the mapping file — that requires separate human sign-off

---

## Phase 8: Integration with Manual Entry

**File:** `scripts/merge-candidates-with-session.mts`

**Purpose:** Merge AI candidates with manual verification sessions.

**Implementation:**
- Load existing session from `mapping-data/<font>-session.json`
- Load AI candidates
- For each candidate:
  - If byte not in session: offer to add as "unsure" entry
  - If byte in session with same Unicode: mark as "confirmed by AI"
  - If byte in session with different Unicode: flag conflict for human review
- Output merged session for review

---

## Phase 9: Batch Processing

**Script:** `scripts/batch-analyze.mts`

**Purpose:** Analyze all 4 KAP fonts in sequence.

**Implementation:**
- Run Phase 1-5 for each font (KAP110, KAP111, KAP112, KAP122)
- Generate summary report:
  - Total candidates per font
  - Average confidence per font
  - High-confidence candidates (>= 0.8)
  - Low-confidence candidates (< 0.5)
  - Conflicts between fonts (same byte, different Unicode)

**Output:** `mapping-data/batch-report.json`

---

## Phase 10: Confidence Scoring

**File:** `src/converter/ai-analyzer/confidence.ts`

**Purpose:** Calculate composite confidence scores for candidates.

**Factors:**
1. **AI confidence** (0-1): Raw vision model confidence
2. **Glyph name match** (0-1): Does glyph name suggest the character?
3. **Position heuristic** (0-1): Is byte in expected range for character type?
4. **Cross-font consistency** (0-1): Do other fonts agree?

**Composite:** Weighted average with configurable weights.

---

## Phase 11: Reporting

**Script:** `scripts/generate-analysis-report.mts`

**Purpose:** Generate human-readable analysis report.

**Output:** `mapping-data/analysis-report.md`

**Contents:**
- Executive summary per font
- Coverage statistics
- Top candidates with images
- Conflicts requiring resolution
- Recommendations for human verification priority

---

## Phase 12: Documentation & Training

**Files:**
- `doc/AI-ANALYZER-GUIDE.md` — User guide for the analyzer
- `doc/AI-ANALYZER-API.md` — API documentation for extending providers

**Purpose:** Document the pipeline for future maintainers.

---

## Implementation Order

1. Phase 1: Font analysis (Python script)
2. Phase 2: Glyph dataset (Python script)
3. Phase 3: Provider interface (TypeScript types)
4. Phase 5: Validation (TypeScript)
5. Phase 10: Confidence scoring (TypeScript)
6. Phase 4: Candidate generation (depends on 1-3, 5, 10)
7. Phase 6: Review UI (React component)
8. Phase 8: Session integration
9. Phase 7: Export (depends on 6)
10. Phase 9: Batch processing
11. Phase 11: Reporting
12. Phase 12: Documentation

---

## Dependencies

### Already Available (Python)
- `fontTools` 4.63.0 — Font parsing
- `Pillow` 12.1.1 — Image rendering
- `pycairo` 1.27.0 — Cairo rendering (optional)

### No New Dependencies Required
- All font analysis uses existing Python tools
- TypeScript/React code uses existing project stack

---

## Safety Checklist

- [ ] All candidates have `status: "candidate"` initially
- [ ] All candidates have `humanVerified: false` initially
- [ ] No automatic `verified: true` in any script
- [ ] No cross-font mapping copying
- [ ] Golden sample `ગુજરાતી → VF5[,F` preserved independently
- [ ] Manual entry workflow (`enter-kap-mapping.mts`) untouched
- [ ] Build workflow (`build-kap-mapping.mts`) untouched
- [ ] Existing tests continue to pass
- [ ] No API keys or credentials hardcoded

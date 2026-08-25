# AI-Assisted KAP Font Mapping Analyzer

## Overview

The AI-assisted KAP Mapping Analyzer is a pipeline that uses font analysis and vision AI to generate **candidate** mappings for KAP fonts. Every AI suggestion has `status: "candidate"` and `humanVerified: false` until explicitly confirmed by a human.

**Safety Rules:**
- Never set `verified: true` automatically
- Never copy mappings between fonts
- Never infer from glyph names/code-point order/visual similarity alone
- Never fabricate mappings
- AI = candidates only

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AI-Analyzer Pipeline                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Python     │    │   Python     │    │   Vision AI  │  │
│  │   Font       │    │   Glyph      │    │   Provider   │  │
│  │   Analysis   │    │   Dataset    │    │   (Stub)     │  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
│         │                   │                   │           │
│         ▼                   ▼                   ▼           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Candidate Generation Engine              │   │
│  └──────────────────────────┬───────────────────────────┘   │
│                             │                               │
│                             ▼                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Candidate Validation                     │   │
│  └──────────────────────────┬───────────────────────────┘   │
│                             │                               │
│                             ▼                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Review UI (Electron)                     │   │
│  │              - Accept / Reject / Unsure / Skip        │   │
│  └──────────────────────────┬───────────────────────────┘   │
│                             │                               │
│                             ▼                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Verified Export                          │   │
│  │              mapping-data/verified/                   │   │
│  └──────────────────────────┬───────────────────────────┘   │
│                             │                               │
│                             ▼                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Production Mapping                       │   │
│  │              src/converter/mappings/                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
mapping-data/
├── font-analysis/          # Phase 1: Font metadata
│   ├── kap110.json
│   ├── kap111.json
│   ├── kap112.json
│   └── kap122.json
├── glyph-dataset/          # Phase 2: Individual glyph PNGs
│   ├── KAP110/
│   │   ├── meta.json
│   │   └── 0x00.png ... 0xFF.png
│   ├── KAP111/
│   ├── KAP112/
│   └── KAP122/
├── candidates/             # Phase 4: AI-generated candidates
│   ├── kap110-candidates.json
│   ├── kap111-candidates.json
│   ├── kap112-candidates.json
│   └── kap122-candidates.json
├── verified/               # Phase 7: Human-verified mappings
│   ├── kap110-verified.json
│   ├── kap111-verified.json
│   ├── kap112-verified.json
│   └── kap122-verified.json
├── batch-report.md         # Phase 9: Batch analysis report
├── analysis-report.md      # Phase 11: Overall analysis report
├── kap110-report.md        # Phase 11: Per-font reports
├── kap111-report.md
├── kap112-report.md
└── kap122-report.md
```

---

## Scripts

### Phase 1: Font Metadata Extraction

```bash
python3 scripts/analyze-kap-fonts.py
```

Extracts comprehensive metadata from each KAP font file:
- Font family, version, glyph count
- Full cmap tables
- Byte-to-glyph mapping resolution
- Glyph bounding boxes and advance widths

**Output:** `mapping-data/font-analysis/<font>.json`

### Phase 2: Glyph Dataset Generation

```bash
python3 scripts/generate-glyph-dataset.py
```

Renders individual glyph PNG images for all 223 byte positions per font.

**Output:** `mapping-data/glyph-dataset/<font>/`

### Phase 9: Batch Processing

```bash
npx tsx scripts/batch-analyze.mts
npx tsx scripts/batch-analyze.mts --font=KAP112
```

Batch processes all KAP fonts through the AI analysis pipeline.

### Phase 11: Analysis Report Generation

```bash
npx tsx scripts/generate-analysis-report.mts
npx tsx scripts/generate-analysis-report.mts --font=KAP112
```

Generates human-readable analysis reports for KAP font candidates.

### Phase 7: Verified Mapping Export

```bash
npx tsx scripts/export-verified-mappings.mts KAP112
npx tsx scripts/export-verified-mappings.mts --all
```

Exports human-verified candidates to TypeScript mapping files.

---

## TypeScript Modules

### `src/converter/ai-analyzer/`

#### Types (`types.ts`)
Core types for the pipeline:
- `MappingCandidate` - AI-generated mapping candidate
- `CandidateStatus` - Status in the pipeline
- `GlyphAnalysisRequest/Response` - Provider interface
- `VisionProvider` - Provider interface
- `FontAnalysis`, `GlyphDataset` - Analysis metadata

#### Mock Provider (`mock-provider.ts`)
Mock implementation for testing and development.

#### Candidate Generator (`candidate-generator.ts`)
Generates candidates using vision AI providers.

#### Candidate Validation (`candidate-validation.ts`)
Validates candidates against safety rules.

#### Confidence Scoring (`confidence.ts`)
Calculates and manages confidence scores.

---

## Candidate Format

```json
{
  "font": "KAP112",
  "byte": 86,
  "hex": "0x56",
  "unicode": "ગ",
  "confidence": 0.94,
  "confidenceCategory": "very_high",
  "status": "candidate",
  "humanVerified": false,
  "reasoning": "Glyph resembles Gujarati consonant GA",
  "generatedAt": "2026-08-25T...",
  "updatedAt": "2026-08-25T...",
  "metadata": {
    "glyphName": "V",
    "hasGlyph": true
  }
}
```

**CRITICAL:** `humanVerified` MUST remain `false` until a human explicitly confirms.

---

## Confidence Levels

| Level | Range | Description |
|-------|-------|-------------|
| Very High | 90-100% | Strong visual match |
| High | 75-89% | Good match with some uncertainty |
| Medium | 50-74% | Moderate match, needs review |
| Low | 25-49% | Weak match, likely incorrect |
| Very Low | 0-24% | Very weak match, probably noise |

**IMPORTANT:** High confidence NEVER means human verification. A candidate with 0.99 confidence is still `humanVerified: false` until a human confirms.

---

## Review Workflow

1. **Generate Candidates**
   ```bash
   python3 scripts/generate-glyph-dataset.py
   npx tsx scripts/batch-analyze.mts
   ```

2. **Review in Electron App**
   - Open the KAP Mapping Review modal
   - Select font to review
   - Use filters to narrow down candidates
   - Accept, Reject, Unsure, or Skip each candidate

3. **Export Verified Mappings**
   ```bash
   npx tsx scripts/export-verified-mappings.mts --all
   ```

4. **Test Conversion**
   ```bash
   npx tsx scripts/test-converter.mts
   npm test
   ```

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

---

## Known Sample

```
Unicode:  ગુજરાતી
KAP112:   VF5[,F
Source:   src/App.tsx default editor content
```

This is a **sequence-level** golden sample. Do NOT decompose it into
individual character mappings without independent proof.

---

## Configuring an AI Provider

To add a real AI provider:

1. Create a new file in `src/converter/ai-analyzer/`
2. Implement the `VisionProvider` interface
3. Register it in the pipeline
4. Set environment variables for API credentials

Example:
```typescript
import type { VisionProvider } from "./types";

export class OpenAIVisionProvider implements VisionProvider {
  readonly name = "openai";
  
  constructor(private apiKey: string) {}
  
  async analyze(request: GlyphAnalysisRequest): Promise<GlyphAnalysisResponse> {
    // Call OpenAI Vision API
    // Return candidates with status: "candidate"
  }
  
  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
}
```

---

## Offline Behavior

Without a configured AI provider:
- Font analysis and glyph dataset generation work normally
- Batch analysis uses mock providers
- Mock candidates are generated for testing
- Review UI displays mock candidates
- Export works for manually verified mappings

---

## Security Considerations

- API keys are NEVER committed to source control
- All candidates have `status: "candidate"` until human confirmation
- No automatic promotion from candidate to verified
- Cross-font copying is prevented by design
- Golden sample is preserved independently

---

## Implementation Status

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ Complete | Font metadata extraction |
| 2 | ✅ Complete | Glyph dataset generation |
| 3 | ✅ Complete | Vision AI provider interface/stubs |
| 4 | ✅ Complete | Candidate generation engine |
| 5 | ✅ Complete | Candidate validation |
| 6 | ✅ Complete | Electron Review UI |
| 7 | ✅ Complete | Verified mapping export |
| 8 | ✅ Complete | Integration with manual entry tool |
| 9 | ✅ Complete | Batch processing |
| 10 | ✅ Complete | Confidence scoring |
| 11 | ✅ Complete | Analysis report generation |
| 12 | ✅ Complete | Documentation |

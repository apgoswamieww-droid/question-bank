# KAP112 Verification Workflow

## Current Status

| Font | Rules | Verified | Status |
|------|-------|----------|--------|
| KAP110 | 0 | false | NOT STARTED |
| KAP111 | 0 | false | NOT STARTED |
| KAP112 | 0 | false | PARTIALLY VERIFIED (1 golden sample) |
| KAP122 | 0 | false | NOT STARTED |

## Golden Sample (Project-Origin)

```
Unicode:  ગુજરાતી
KAP112:   VF5[,F
Source:   src/App.tsx default editor content
```

This is a **sequence-level** golden sample. Do NOT decompose it into
individual character mappings (V=ગ, F=ુ, etc.) unless you have
independent proof for each character.

## How to Use the Entry Tool

### Start KAP112 Verification

```bash
npx -y tsx scripts/enter-kap-mapping.mts KAP112
```

### Input Grammar

| Input | Meaning | Example |
|-------|---------|---------|
| `ક` | Single-char mapping (sure) | Type the Gujarati char you see |
| `s ગ VF` | Sequence mapping (sure) | `s` prefix + unicode + KAP bytes |
| `u ક` | Unsure mapping | Mark as uncertain |
| `-` | No Gujarati meaning | Punctuation, symbols |
| *(Enter)* | Skip | Move to next byte |
| `b` | Go back | Revisit previous byte |
| `q` | Save and quit | Progress is saved |

### Priority Order for Verification

**DO NOT** start with random punctuation. Follow this order:

1. **Gujarati vowels** (અ, આ, ઇ, ઈ, ઉ, ઊ, ઋ, એ, ઐ, ઓ, ઔ)
2. **Gujarati consonants** (ક, ખ, ગ, ઘ, ઙ, ચ, છ, જ, ઝ, ઞ, ટ, ઠ, ડ, ઢ, ણ, ત, થ, દ, ધ, ન, પ, ફ, બ, ભ, મ, ય, ર, લ, વ, શ, ષ, સ, હ, ળ)
3. **Independent matras** (ા, િ, ી, ુ, ૂ, ે, ૈ, ો, ૌ)
4. **Common consonant + matra combinations** (કા, કિ, કી, કુ, કૂ, etc.)
5. **Halant/virama** (્) — critical for conjuncts
6. **Common conjuncts** (ક્ષ, જ્ઞ, ત્ર, શ્ર, etc.)
7. **Complex conjuncts** (multi-consonant clusters)
8. **Digits** (૦, ૧, ૨, ૩, ૪, ૫, ૬, ૭, ૮, ૯)
9. **Gujarati punctuation** (।, ॥)
10. **Real document anchors** — use known bilingual KAP documents
11. **Remaining glyphs** — ASCII punctuation, symbols

### Targeted Runs

To verify only specific bytes:

```bash
# Verify just the Gujarati vowels (codes 161-170 in extended range)
npx -y tsx scripts/enter-kap-mapping.mts KAP112 --codes 161,162,163,164,165,166,167,168,169,170

# Re-do specific entries
npx -y tsx scripts/enter-kap-mapping.mts KAP112 --codes 86,70 --redo
```

### After Completing Entries

```bash
# Build the mapping module from your session
npx -y tsx scripts/build-kap-mapping.mts KAP112

# Review the generated file
cat src/converter/mappings/kap112.ts

# Run the converter test harness
npx -y tsx scripts/test-converter.mts

# Run the Vitest suite
npm test
```

## Sequence Mapping Guide

Many KAP characters require **multi-byte sequences**. Examples:

| Unicode | KAP Sequence | Notes |
|---------|-------------|-------|
| ગુજરાતી | VF5[,F | Project-origin golden sample |
| *(human entry)* | *(multi-byte)* | Enter with `s` prefix |

When you see a glyph that represents multiple bytes:
1. Identify the Unicode character it represents
2. Note all bytes in the sequence from the proof sheet
3. Enter: `s <unicode> <bytes>`

## Safety Rules

- **NEVER** guess or infer mappings
- **NEVER** copy mappings between fonts
- **NEVER** mark guessed mappings as verified
- **ALWAYS** use `u` prefix for unsure entries
- **ALWAYS** save with `q` (auto-save happens on each entry)
- Session data is in `mapping-data/kap112-session.json`
- Progress resumes automatically on re-run

## Verification Checklist

Before marking KAP112 as `verified: true`:

- [ ] All Gujarati vowels mapped
- [ ] All Gujarati consonants mapped
- [ ] All independent matras mapped
- [ ] Halant behavior verified
- [ ] Common conjuncts tested
- [ ] Golden sample passes: `ગુજરાતી → VF5[,F`
- [ ] Tested against real bilingual KAP documents
- [ ] `npm test` passes
- [ ] `npx -y tsx scripts/test-converter.mts` passes
- [ ] Human review of rendered output complete

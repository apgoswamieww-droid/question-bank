# Plan — Legacy Gujarati (KAP) → Unicode Import Tool

**Status:** proposal / awaiting approval
**Date:** 2026-08-31
**Author:** Claude (with eww-amrutgiri-goswami)

## 1. Goal

Give you a fast way to turn Gujarati that was typed in a **legacy KAP font** (KAP110/111/112/122 — 8-bit "font hacks" where Latin bytes are drawn as Gujarati glyphs) into **real Unicode Gujarati**, so you can build questions from existing PDFs. You convert in the tool, then **copy the Unicode and paste it into the Question Bank editor**.

This is the *inverse* of the converter already in the app (which goes Unicode → KAP for printing). Both directions are powered by the **same verified byte↔glyph table**, so finishing one helps the other.

## 2. Decisions locked in (from your answers)

- **Source can be either** selectable KAP-font text *or* a scanned image — the tool handles both and auto-detects which applies.
- **It's a separate Python tool**, simple "paste in → convert → copy out" style, with **no AI / no cloud API**. It is *launched from* the Question Bank app but **opens in its own window**.
- **No font picker is added to the editor.** You copy plain Unicode out of the tool and paste it in. The tool itself can *preview* the result in a few Unicode Gujarati fonts so you can see how it looks; the clipboard copy is plain text that renders in whatever font the editor uses.

## 3. Key insight — you often don't need OCR at all

A KAP PDF usually still has a **text layer**. When you "select" the text it looks like Latin gibberish (e.g. `VF5[,F`) but those are the actual bytes — and `VF5[,F` renders as **આપેલા**. So the most accurate path is:

```
PDF text layer  ──►  raw KAP bytes  ──►  [deterministic map]  ──►  Unicode Gujarati
   (exact)              (exact)              (exact, no AI)           (exact)
```

No pixels, no guessing. We only fall back to OCR when the PDF is a **true scan** with no text layer:

```
scanned image  ──►  [offline OCR, best-effort]  ──►  Unicode Gujarati (proofread)
```

So the tool has **three input paths**, in order of reliability:

1. **Paste text** — you paste the KAP/gibberish text → deterministic map. Exact.
2. **Open PDF** — tool pulls the text layer itself → deterministic map. Exact. *(If the PDF has no text layer, it offers path 3.)*
3. **Open image / scan** — offline OCR → Unicode. Best-effort, needs a proofread.

## 4. Architecture

```
┌─────────────────────────────┐        spawns          ┌──────────────────────────────┐
│  Question Bank (Electron)   │  child_process.spawn   │  KAP Importer (Python)       │
│                             │ ─────────────────────► │                              │
│  • toolbar/menu button      │                        │  local server on 127.0.0.1   │
│    "Import from KAP"        │   opens separate       │  ├─ deterministic mapper     │
│  • IPC: tool:openKapImporter│ ◄───── window ──────   │  ├─ PDF text extractor       │
│                             │   (BrowserWindow →      │  └─ optional offline OCR     │
│  editor  ◄── you paste ──   │    http://127.0.0.1)    │  simple paste/convert/copy UI │
└─────────────────────────────┘                        └──────────────────────────────┘
        ▲                                                          │
        └──────────────  plain Unicode text on the clipboard  ─────┘
```

### 4.1 The Python tool (standalone)

Lives in a new top-level folder, e.g. `tools/kap-importer/`, independent of the React/Electron build.

- **UI:** a tiny local web page served by Python (Flask or the stdlib `http.server`), opened in its own window. A single screen: input area + "Open PDF…" / "Open image…" buttons on the left, converted Unicode on the right, a **font-preview dropdown**, and a big **Copy** button. This "chatbot-style" paste-in/out UI is trivial in HTML and renders Gujarati cleanly.
  - *Alternative considered:* a native Tkinter window (no browser). Lighter to package as one file, but the UI is dated and Gujarati shaping in Tk is finicky. I recommend the local-web-page approach; happy to switch if you prefer native.
- **Conversion (deterministic, no AI):** applies the **inverse of the verified KAP table**. Because KAP reorders vowel signs (notably the pre-base i-matra િ) and packs some consonant+matra combos into a single byte, the byte→Unicode direction uses **longest-match cluster rules + matra re-ordering**, not a naive 1-byte-per-char swap.
- **PDF text extraction (no AI):** PyMuPDF (`fitz`) or `pdfplumber` opens the PDF and returns the raw bytes of the text layer, which feed straight into the mapper. Auto-detects "has text layer?" to choose path 2 vs path 3.
- **Offline OCR (optional, best-effort):** Tesseract with the Gujarati model (`guj`). Since KAP glyphs are Gujarati *shapes*, Tesseract reads them as Unicode Gujarati directly. **Caveat / open question:** Tesseract is an offline, bundled model — it is *not* a cloud or LLM "AI integration," but it *is* machine learning. If "no AI" must be literal, we drop OCR and support only text + PDF-text-layer input (both fully deterministic). Please confirm (see §8).

### 4.2 Launch integration with the app

Mirrors patterns already in `electron/main.cjs` (which already spawns hidden windows for PDF export/print) and `electron/preload.cjs`:

1. Add a button/menu item in the editor: **"Import from legacy Gujarati (KAP → Unicode)."**
2. Renderer calls a new bridge method `window.electronAPI.openKapImporter()`.
3. `preload.cjs` exposes it → `ipcRenderer.invoke("tool:openKapImporter")`.
4. `main.cjs` handles it: pick a free port, `child_process.spawn("python3", ["tools/kap-importer/app.py", "--port", port])`, wait until it's serving, then open a **new `BrowserWindow`** pointed at `http://127.0.0.1:<port>` — a genuinely separate window.
5. On that window's `close`, kill the Python child so nothing lingers.

No API keys, no network — the server binds to localhost only.

### 4.3 One source of truth for the mapping

The verified table (produced by the review worksheet) is exported once to JSON. The **app** reads it for Unicode→KAP; the **Python tool** reads the *same* JSON for KAP→Unicode. No duplicated, drifting mapping data.

## 5. Fonts & copy-out

- Output is **plain Unicode Gujarati text**. On copy it goes to the clipboard as plain text, so it pastes cleanly into TipTap and takes on the editor's font — **no editor change needed**.
- The tool **bundles a few Unicode Gujarati fonts for preview only** (e.g. Noto Sans Gujarati / Noto Serif Gujarati — OFL-licensed, safe to ship) so you can eyeball the result. Preview font choice does **not** affect the copied text.

## 6. Dependency & honesty about coverage

The deterministic path is only as complete as the **verified byte→Unicode table**, and that table is **not finished yet**:

- **36 bytes are validated today** (base consonants like ક/ખ/ગ/ચ/છ/ત/થ/ન/પ/ફ/બ/ભ/મ/લ/શ, the vowel અ, the ા and ે matras, digits ૦–૯ partial, and symbols × ÷ = + / ★ ૐ …).
- **The matras, conjuncts, and precomposed consonant+matra ligatures (~150 bytes) still need your confirmation** via `kap-verification-worksheet.html`.

So at first the tool will convert the confirmed subset exactly and clearly mark any unconfirmed byte (rather than guess). **Completing the worksheet unlocks full-coverage conversion — and simultaneously unblocks the app's Unicode→KAP feature.** The OCR path does not depend on this table (it reads shapes), but needs proofreading.

## 7. Phased build

- **Phase 0 — this plan.** Agree on approach (esp. the OCR question in §8).
- **Phase 1 — standalone tool skeleton.** Python local-web UI: paste KAP text → Unicode out → Copy. Wired to the *current* 36-letter + digit/symbol subset. Prove end-to-end on the known sample (`VF5[,F` → આપેલા). Runs on its own, no Electron yet.
- **Phase 2 — PDF text-layer import.** Open a PDF → auto-extract bytes → convert. Auto-detect scanned vs text.
- **Phase 3 — app launch integration.** Button + IPC + spawn + separate window + clean process shutdown.
- **Phase 4 — offline OCR (if approved).** Tesseract `guj` for scans, labelled "best-effort, please proofread."
- **Phase 5 — finish the mapping.** Fold the completed worksheet into the shared table → full-coverage deterministic conversion; add golden tests (incl. `VF5[,F` → આપેલા) and matra-reordering tests.
- **Cross-cutting:** font-preview dropdown, packaging decision (§8).

## 8. Open questions / risks

1. **OCR vs "no AI" (needs your call).** Offline Tesseract is the only realistic way to read a *scanned* image, but it is ML. Options: (a) include it, clearly labelled best-effort; (b) drop it and support only text + PDF-text-layer (100% deterministic). My recommendation: (a), because it's offline and only used when there's no text layer.
2. **Packaging Python for distribution.** In development, the app can call the system `python3`. For a shipped Windows build (`electron-builder`), we'd bundle either a small Python venv or a PyInstaller `.exe`. Fine to defer until Phase 3; dev works immediately.
3. **Mapping completeness.** Deterministic coverage is limited until the worksheet is done (§6).
4. **Font licensing for preview.** Use OFL fonts (Noto) so redistribution is clean.
5. **Source-font selection.** The four KAP fonts share one layout, so a single table covers all; the tool can still expose a source-font selector as a safety valve.

## 9. Recommended first step

Build **Phase 1** as a standalone Python tool (no Electron wiring yet) so you can paste `VF5[,F`, get આપેલા, and feel the workflow. In parallel I can wire in the already-validated 36 letters so both this tool and the app share real data. Once you're happy with the feel, we add PDF import (Phase 2) and the launch button (Phase 3).

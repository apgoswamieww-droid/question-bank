"""
Optional PDF text-layer extraction for the KAP importer (Phase 2).

Most KAP PDFs are *not* scans — they carry a real text layer whose bytes are the
original KAP/ASCII code points (that is exactly why copy-pasting from them yields
Latin gibberish). Pulling that text layer out and running it through the
deterministic map is therefore an *exact*, AI-free conversion — no OCR needed.

This module is intentionally an OPTIONAL dependency: the paste-to-Unicode core
(kap_map.py / app.py) stays stdlib-only and always works. PDF support switches on
only when `pdfplumber` is installed (see requirements.txt). If it is missing we
say so clearly instead of crashing.

OCR of true scanned images is a separate, later concern (Phase 4).
"""
from __future__ import annotations

# A page whose stripped text layer is shorter than this is treated as "no real
# text" for the purpose of the scan heuristic.
_MIN_CHARS_PER_PAGE = 3


def available() -> bool:
    """True when the optional PDF backend (pdfplumber) can be imported."""
    try:
        import pdfplumber  # noqa: F401
    except Exception:
        return False
    return True


def backend_name() -> str:
    """Human-readable name of the active backend, or '' if unavailable."""
    try:
        import pdfplumber
    except Exception:
        return ""
    return "pdfplumber %s" % getattr(pdfplumber, "__version__", "?")


def extract(pdf_bytes: bytes) -> dict:
    """
    Extract the text layer from a PDF given as raw bytes.

    Returns a dict:
        {
          "pages":          [str, ...],   # per-page text, in order
          "text":           str,          # pages joined by "\n"
          "pageCount":      int,
          "extractedChars": int,          # len of stripped joined text
          "likelyScan":     bool,         # little/no text layer -> probably a scan
        }

    Raises RuntimeError if the backend is not installed, or ValueError if the
    bytes are not a readable PDF.
    """
    import io

    try:
        import pdfplumber
    except Exception as exc:  # pragma: no cover - exercised only without the dep
        raise RuntimeError(
            "PDF support needs the 'pdfplumber' package. "
            "Install it with: pip install -r requirements.txt"
        ) from exc

    if not pdf_bytes:
        raise ValueError("Empty file — no PDF data received.")

    pages: list[str] = []
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                pages.append(page.extract_text() or "")
    except Exception as exc:
        raise ValueError(
            "Could not read this file as a PDF (%s)." % type(exc).__name__
        ) from exc

    text = "\n".join(pages)
    extracted = len(text.strip())
    page_count = len(pages)
    # No text layer at all, or so little that it is almost certainly an
    # image-only (scanned) document -> flag it so the UI can point at OCR.
    likely_scan = page_count > 0 and extracted < _MIN_CHARS_PER_PAGE * page_count

    return {
        "pages": pages,
        "text": text,
        "pageCount": page_count,
        "extractedChars": extracted,
        "likelyScan": likely_scan,
    }

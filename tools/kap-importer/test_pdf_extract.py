"""
Tests for the PDF text-layer extraction path (Phase 2).

These build a small PDF in memory (reportlab), extract its text layer
(pdfplumber), and check that the extract -> convert pipeline yields the expected
Unicode. If either optional package is missing, the tests are skipped rather than
failed, so the suite still runs on a stdlib-only machine.

Run with either:
    python3 test_pdf_extract.py
    python3 -m pytest test_pdf_extract.py
"""
import io

import pdf_extract
from kap_map import convert


def _deps_ok():
    try:
        import pdfplumber  # noqa: F401
        import reportlab  # noqa: F401
    except Exception:
        return False
    return True


def _make_pdf(lines):
    """Return PDF bytes whose text layer contains the given lines (verbatim)."""
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    for line in lines:
        c.setFont("Helvetica", 20)
        c.drawString(72, 720, line)
        c.showPage()
    c.save()
    return buf.getvalue()


def test_availability_matches_import():
    """available() must agree with whether pdfplumber actually imports."""
    try:
        import pdfplumber  # noqa: F401
        importable = True
    except Exception:
        importable = False
    assert pdf_extract.available() is importable


def test_extract_then_convert_golden():
    """A PDF holding the KAP bytes 'VF5[,F' converts to 'આપેલા'."""
    if not _deps_ok():
        print("SKIP test_extract_then_convert_golden (optional deps missing)")
        return
    pdf = _make_pdf(["VF5[,F"])
    info = pdf_extract.extract(pdf)
    assert info["pageCount"] == 1, info
    assert info["text"].strip() == "VF5[,F", repr(info["text"])
    assert info["likelyScan"] is False, info
    out, unmapped = convert(info["text"])
    assert out == "આપેલા", repr(out)
    assert unmapped == []


def test_multipage_join():
    """Multiple pages are returned in order and joined by newlines."""
    if not _deps_ok():
        print("SKIP test_multipage_join (optional deps missing)")
        return
    info = pdf_extract.extract(_make_pdf(["VF5[,F", "5G,"]))
    assert info["pageCount"] == 2, info
    assert info["pages"][0].strip() == "VF5[,F"
    assert info["pages"][1].strip() == "5G,"
    out, _ = convert(info["text"])
    # આપેલા  +  newline  +  પનલ
    assert "આપેલા" in out and "પનલ" in out, repr(out)


def test_empty_pdf_flagged_as_scan():
    """A PDF with no text layer is flagged likelyScan (a scan would look like this)."""
    if not _deps_ok():
        print("SKIP test_empty_pdf_flagged_as_scan (optional deps missing)")
        return
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    c.showPage()  # a blank page, no text drawn
    c.save()
    info = pdf_extract.extract(buf.getvalue())
    assert info["extractedChars"] == 0, info
    assert info["likelyScan"] is True, info


def test_bad_bytes_raise_valueerror():
    """Non-PDF bytes raise ValueError (surfaced to the UI as a clean message)."""
    if not pdf_extract.available():
        print("SKIP test_bad_bytes_raise_valueerror (pdfplumber missing)")
        return
    raised = False
    try:
        pdf_extract.extract(b"this is definitely not a pdf")
    except ValueError:
        raised = True
    assert raised, "expected ValueError for non-PDF bytes"


def _run_all():
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    failures = 0
    for t in tests:
        try:
            t()
            print("PASS", t.__name__)
        except AssertionError as e:
            failures += 1
            print("FAIL", t.__name__, "->", e)
    print("\n%d passed, %d failed" % (len(tests) - failures, failures))
    return failures


if __name__ == "__main__":
    import sys

    sys.exit(1 if _run_all() else 0)

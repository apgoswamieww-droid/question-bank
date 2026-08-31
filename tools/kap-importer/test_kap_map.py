"""
Golden + smoke tests for the deterministic KAP -> Unicode converter.

Run with either:
    python3 test_kap_map.py
    python3 -m pytest test_kap_map.py    (if pytest is installed)
"""
from kap_map import convert


def test_golden_aapelaa():
    """The validated anchor: bytes 'VF5[,F' render as 'આપેલા'."""
    out, unmapped = convert("VF5[,F")
    assert out == "આપેલા", repr(out)
    assert unmapped == [], unmapped


def test_vowel_composition():
    """'અ' + aa-matra composes to the precomposed 'આ'."""
    out, _ = convert("VF")          # 0x56 0x46 -> અ + ા -> આ
    assert out == "આ", repr(out)


def test_consonants():
    # પ(0x35=5) ન(0x47=G) લ(0x2C=,)
    out, unmapped = convert("5G,")
    assert out == "પનલ", repr(out)
    assert unmapped == []


def test_digits():
    # ૧૨૩ = 0x21 0x25 0x23 = '!' '%' '#'
    out, _ = convert("!%#")
    assert out == "૧૨૩", repr(out)


def test_unmapped_passthrough():
    # 'q' (0x71) has no validated mapping yet: kept, and reported.
    out, unmapped = convert("5q")     # પ + q
    assert out == "પq", repr(out)
    assert len(unmapped) == 1
    assert unmapped[0]["hex"] == "0x71"


def test_whitespace_preserved():
    out, unmapped = convert("5 G")    # પ (space) ન
    assert out == "પ ન", repr(out)
    assert unmapped == []


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

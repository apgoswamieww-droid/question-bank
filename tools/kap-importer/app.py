#!/usr/bin/env python3
"""
KAP -> Unicode Gujarati importer — local web tool.

A tiny HTTP server that serves a single-page UI and conversion endpoints. No
network access, no AI: it binds to localhost only and uses the deterministic map
in kap_map.py.

The paste-to-Unicode core is stdlib-only and always works. PDF import is an
OPTIONAL capability that switches on when `pdfplumber` is installed
(see requirements.txt); without it, /capabilities reports pdf:false and
/convert-pdf returns a friendly "please install" message.

Endpoints:
    GET  /            -> the UI
    GET  /health      -> {"ok": true}
    GET  /capabilities-> {"pdf": bool, "ocr": bool, ...}
    POST /convert     -> {text}     -> converted Unicode + unmapped report
    POST /convert-pdf -> {pdfBase64}-> extract text layer, then convert

Usage:
    python3 app.py                # auto-pick a free port, print the URL
    python3 app.py --port 8765    # fixed port

The Electron app launches this with --port 0 and opens the printed URL in a
separate window.
"""
import argparse
import base64
import binascii
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pdf_extract
from kap_map import convert

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, "index.html")

# Guard against absurdly large uploads (base64-decoded). 40 MB covers any
# realistic question paper while keeping memory bounded.
MAX_PDF_BYTES = 40 * 1024 * 1024


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json"):
        data = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", "%s; charset=utf-8" % ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            try:
                with open(INDEX, "rb") as f:
                    self._send(200, f.read(), "text/html")
            except OSError:
                self._send(500, json.dumps({"error": "index.html missing"}))
        elif self.path == "/health":
            self._send(200, json.dumps({"ok": True}))
        elif self.path == "/capabilities":
            self._send(200, json.dumps({
                "pdf": pdf_extract.available(),
                "pdfBackend": pdf_extract.backend_name(),
                "ocr": False,  # Phase 4 — not built yet
            }))
        else:
            self._send(404, json.dumps({"error": "not found"}))

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8", "replace")
        try:
            return json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            return {}

    def do_POST(self):
        if self.path == "/convert":
            self._handle_convert()
        elif self.path == "/convert-pdf":
            self._handle_convert_pdf()
        else:
            self._send(404, json.dumps({"error": "not found"}))

    def _handle_convert(self):
        payload = self._read_json_body()
        text = payload.get("text", "")
        out, unmapped = convert(text)
        resp = {
            "unicode": out,
            "unmapped": unmapped,
            "unmappedCount": len(unmapped),
            "totalChars": len(text),
        }
        self._send(200, json.dumps(resp, ensure_ascii=False))

    def _handle_convert_pdf(self):
        if not pdf_extract.available():
            self._send(200, json.dumps({
                "error": "PDF support is not installed.",
                "needInstall": True,
                "install": "pip install -r requirements.txt",
            }))
            return
        payload = self._read_json_body()
        b64 = payload.get("pdfBase64", "")
        try:
            pdf_bytes = base64.b64decode(b64, validate=True) if b64 else b""
        except (binascii.Error, ValueError):
            self._send(200, json.dumps({"error": "Could not decode the uploaded file."}))
            return
        if len(pdf_bytes) > MAX_PDF_BYTES:
            self._send(200, json.dumps({
                "error": "File is too large (limit %d MB)." % (MAX_PDF_BYTES // (1024 * 1024)),
            }))
            return
        try:
            info = pdf_extract.extract(pdf_bytes)
        except (ValueError, RuntimeError) as exc:
            self._send(200, json.dumps({"error": str(exc)}))
            return
        out, unmapped = convert(info["text"])
        resp = {
            "raw": info["text"],
            "unicode": out,
            "unmapped": unmapped,
            "unmappedCount": len(unmapped),
            "totalChars": len(info["text"]),
            "pageCount": info["pageCount"],
            "extractedChars": info["extractedChars"],
            "likelyScan": info["likelyScan"],
        }
        self._send(200, json.dumps(resp, ensure_ascii=False))

    def log_message(self, *args):  # keep the console quiet
        pass


def main():
    ap = argparse.ArgumentParser(description="KAP -> Unicode Gujarati local tool")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=0, help="0 = auto-pick a free port")
    args = ap.parse_args()

    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    host, port = httpd.server_address
    print("KAP Importer running at http://%s:%d" % (host, port), flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()

import base64
import json
import mimetypes
import os
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
CACHE_ROOT = ROOT / ".notebook-cache" / "assets"
PORT = int(os.environ.get("PORT", "8000"))


def safe_asset_segment(value):
    text = str(value or "asset").replace("\\", "/").strip().strip("/")
    if not text or "/" in text or text in {".", ".."}:
        raise ValueError("Invalid asset path")
    cleaned = "".join(char if char.isalnum() or char in "-_." else "-" for char in text)
    return cleaned.strip(".-") or "asset"


def safe_cache_path(note_id, filename):
    path = (CACHE_ROOT / safe_asset_segment(note_id) / safe_asset_segment(filename)).resolve()
    if CACHE_ROOT.resolve() not in path.parents:
        raise ValueError("Invalid cache path")
    return path


class NotebookHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path.startswith("/api/local-assets/"):
            try:
                self.serve_local_asset()
            except Exception as error:
                self.send_json({"error": str(error)}, 404)
            return
        super().do_GET()

    def do_POST(self):
        if self.path != "/api/assets/upload":
            self.send_json({"error": "Not found"}, 404)
            return
        try:
            self.handle_asset_upload(self.read_json())
        except Exception as error:
            self.send_json({"error": str(error)}, 400)

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length > 120 * 1024 * 1024:
            raise ValueError("Request body is too large")
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        return json.loads(raw or "{}")

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_asset_upload(self, payload):
        note_id = safe_asset_segment(payload.get("noteId"))
        name = safe_asset_segment(payload.get("name"))
        content = str(payload.get("content", ""))
        if not content:
            raise ValueError("Missing asset content")
        data = base64.b64decode(content.encode("ascii"), validate=True)
        path = safe_cache_path(note_id, name)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        self.send_json({
            "ok": True,
            "localUrl": f"/api/local-assets/{urllib.parse.quote(note_id)}/{urllib.parse.quote(name)}",
            "size": len(data),
        })

    def serve_local_asset(self):
        parts = urllib.parse.urlparse(self.path).path.split("/")
        if len(parts) < 5:
            raise ValueError("Invalid local asset URL")
        path = safe_cache_path(urllib.parse.unquote(parts[3]), urllib.parse.unquote(parts[4]))
        if not path.is_file():
            raise FileNotFoundError("Local asset not found")
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(path.name)[0] or "application/octet-stream")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()


if __name__ == "__main__":
    mimetypes.add_type("text/javascript", ".js")
    server = ThreadingHTTPServer(("127.0.0.1", PORT), NotebookHandler)
    print(f"Notebook server running at http://127.0.0.1:{PORT}", flush=True)
    server.serve_forever()

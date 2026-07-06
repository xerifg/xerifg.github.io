import base64
import hashlib
import hmac
import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
CACHE_ROOT = ROOT / ".notebook-cache" / "assets"


def load_dotenv():
    dotenv = ROOT / ".env"
    if not dotenv.exists():
        return
    for line in dotenv.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if not text or text.startswith("#") or "=" not in text:
            continue
        key, value = text.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_dotenv()

PORT = int(os.environ.get("PORT", "8000"))
SESSION_TTL_SECONDS = int(os.environ.get("NOTEBOOK_SESSION_TTL", str(60 * 60 * 12)))


def env(name, default=""):
    return os.environ.get(name, default).strip()


def app_secret():
    return env("NOTEBOOK_SECRET") or hashlib.sha256(env("GITHUB_TOKEN").encode("utf-8")).hexdigest()


def github_config():
    return {
        "owner": env("GITHUB_OWNER"),
        "repo": env("GITHUB_REPO"),
        "branch": env("GITHUB_BRANCH", "main"),
        "token": env("GITHUB_TOKEN"),
    }


def json_bytes(data):
    return json.dumps(data, ensure_ascii=False).encode("utf-8")


def b64url(data):
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def sign(value):
    return hmac.new(app_secret().encode("utf-8"), value.encode("utf-8"), hashlib.sha256).hexdigest()


def create_session(account):
    expires = int(time.time()) + SESSION_TTL_SECONDS
    payload = b64url(json.dumps({"account": account, "exp": expires}, separators=(",", ":")).encode("utf-8"))
    return f"{payload}.{sign(payload)}"


def verify_session(token):
    if not token or "." not in token:
        return False
    payload, signature = token.rsplit(".", 1)
    if not hmac.compare_digest(sign(payload), signature):
        return False
    padded = payload + "=" * (-len(payload) % 4)
    try:
        data = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8"))
    except (ValueError, json.JSONDecodeError):
        return False
    return int(data.get("exp", 0)) >= int(time.time())


def safe_repo_path(path):
    normalized = str(path or "").replace("\\", "/").strip("/")
    if not normalized or normalized.startswith("../") or "/../" in normalized:
        raise ValueError("Invalid repository path")
    if not (normalized.startswith("notebooks/") or normalized == "notebooks"):
        raise ValueError("Only notebooks paths can be modified")
    return normalized


def safe_asset_segment(value):
    text = str(value or "asset").replace("\\", "/").strip().strip("/")
    if not text or "/" in text or text in {".", ".."}:
        raise ValueError("Invalid asset path")
    cleaned = "".join(char if char.isalnum() or char in "-_." else "-" for char in text)
    return cleaned.strip(".-") or "asset"


def safe_cache_path(note_id, filename):
    note_segment = safe_asset_segment(note_id)
    file_segment = safe_asset_segment(filename)
    path = (CACHE_ROOT / note_segment / file_segment).resolve()
    if CACHE_ROOT.resolve() not in path.parents:
        raise ValueError("Invalid cache path")
    return path


def github_headers(token):
    return {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "personal-notebook-proxy",
    }


def github_request(method, path, body=None):
    config = github_config()
    if not config["owner"] or not config["repo"] or not config["token"]:
        raise RuntimeError("Missing GITHUB_OWNER, GITHUB_REPO or GITHUB_TOKEN")
    encoded_path = "/".join(urllib.parse.quote(part) for part in safe_repo_path(path).split("/"))
    url = f"https://api.github.com/repos/{config['owner']}/{config['repo']}/contents/{encoded_path}"
    if method == "GET":
        url = f"{url}?ref={urllib.parse.quote(config['branch'])}"
    data = json_bytes(body) if body is not None else None
    request = urllib.request.Request(url, data=data, headers=github_headers(config["token"]), method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            content = response.read().decode("utf-8")
            return json.loads(content) if content else {}
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return None
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(detail or f"GitHub request failed: {error.code}") from error


def get_sha(path):
    data = github_request("GET", path)
    return data.get("sha") if data else None


def put_file(path, content, message):
    config = github_config()
    body = {
        "message": message,
        "content": content,
        "branch": config["branch"],
    }
    sha = get_sha(path)
    if sha:
        body["sha"] = sha
    github_request("PUT", path, body)


def delete_file(path, message):
    config = github_config()
    sha = get_sha(path)
    if not sha:
        return
    github_request("DELETE", path, {
        "message": message,
        "branch": config["branch"],
        "sha": sha,
    })


class NotebookHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path.startswith("/api/local-assets/"):
            try:
                self.handle_local_asset()
            except Exception as error:
                self.send_json({"error": str(error)}, 404)
            return
        super().do_GET()

    def do_POST(self):
        try:
            payload = self.read_json()
            if self.path == "/api/auth":
                self.handle_auth(payload)
            elif self.path == "/api/assets/upload":
                self.handle_asset_upload(payload)
            elif self.path == "/api/github/save":
                self.require_session(payload)
                self.handle_save(payload)
            elif self.path == "/api/github/delete":
                self.require_session(payload)
                self.handle_delete(payload)
            else:
                self.send_json({"error": "Not found"}, 404)
        except Exception as error:
            self.send_json({"error": str(error)}, 400)

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length > 120 * 1024 * 1024:
            raise ValueError("Request body is too large")
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        return json.loads(raw or "{}")

    def send_json(self, data, status=200):
        body = json_bytes(data)
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_auth(self, payload):
        expected_user = env("NOTEBOOK_USER", "admin")
        expected_password = env("NOTEBOOK_PASSWORD", "123456")
        account = str(payload.get("account", ""))
        password = str(payload.get("password", ""))
        if not hmac.compare_digest(account, expected_user) or not hmac.compare_digest(password, expected_password):
            self.send_json({"error": "Invalid account or password"}, 401)
            return
        self.send_json({"session": create_session(account)})

    def require_session(self, payload):
        if not verify_session(str(payload.get("session", ""))):
            raise PermissionError("Invalid or expired session")

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

    def handle_local_asset(self):
        route = urllib.parse.urlparse(self.path).path
        parts = route.split("/")
        if len(parts) < 5:
            raise ValueError("Invalid local asset URL")
        note_id = urllib.parse.unquote(parts[3])
        name = urllib.parse.unquote(parts[4])
        path = safe_cache_path(note_id, name)
        if not path.exists() or not path.is_file():
            raise FileNotFoundError("Local asset not found")
        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def handle_save(self, payload):
        title = str(payload.get("title", "untitled")).strip() or "untitled"
        document_path = safe_repo_path(payload.get("documentPath"))
        document_content = str(payload.get("documentContent", ""))
        for asset in payload.get("assets", []):
            asset_path = safe_repo_path(asset.get("path"))
            asset_content = str(asset.get("content", ""))
            put_file(asset_path, asset_content, f"Upload notebook asset: {Path(asset_path).name}")
        put_file(document_path, document_content, f"Auto save notebook: {title}")
        self.send_json({"ok": True})

    def handle_delete(self, payload):
        for path in payload.get("paths", []):
            safe_path = safe_repo_path(path)
            delete_file(safe_path, f"Delete notebook file: {Path(safe_path).name}")
        self.send_json({"ok": True})

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()


if __name__ == "__main__":
    try:
        mimetypes.add_type("text/javascript", ".js")
        server = ThreadingHTTPServer(("127.0.0.1", PORT), NotebookHandler)
        if sys.stdout:
            print(f"Notebook server running at http://127.0.0.1:{PORT}")
        server.serve_forever()
    except Exception as error:
        (ROOT / "server-error.log").write_text(str(error), encoding="utf-8")
        raise

"""Isolated local browser acceptance fixture. Never forwards API calls to production.

Run python tests/workspace-fixture-server.py and open http://127.0.0.1:8001.
The mock account and sample notes exist only on this test origin.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote
import base64
import json
import mimetypes

ROOT = Path(__file__).resolve().parents[1]
FOLDERS = [{"id": "f", "name": "自动驾驶", "parentId": None}, {"id": "llm", "name": "大模型", "parentId": None}, {"id": "tools", "name": "工具", "parentId": None}]
IMAGE = "data:image/svg+xml;base64," + base64.b64encode(b'<svg xmlns="http://www.w3.org/2000/svg" width="480" height="240"><rect width="480" height="240" rx="8" fill="#dbeafe"/><circle cx="120" cy="120" r="70" fill="#3370ff"/><text x="235" y="135" font-size="28" fill="#18345a">Image</text></svg>').decode()
NOTES = [
    {"id": "demo-image-resize", "title": "图片尺寸交互测试", "tags": [], "html": f'<h2>图片测试</h2><p>单击图片后拖动四角调整正文尺寸。</p><img src="{IMAGE}" alt="图片尺寸测试"><p>此段文字会随图片尺寸调整位置。</p>'},
    {"id": "demo-vjepa", "title": "V-JEPA 世界模型", "tags": ["世界模型", "自监督学习"], "html": '<h2>核心思路</h2><p>阅读时重点关注模型如何组织视频信息，以及预测目标、训练方式和评估设置。</p><h2>与其他方法的联系</h2><p>相关思路可参考 <a href="#note/demo-wa">WA-JEPA</a>，并对照 <a href="#note/demo-route">端到端模型技术路线</a> 继续整理。</p><h2>阅读笔记</h2><ol><li><p>预测目标与像素重建有什么不同？</p></li><li><p>实验设置如何衡量表征能力？</p></li><li><p>哪些结论需要回到论文原文核对？</p></li></ol><h2>我的思考</h2><blockquote><p>把共同点与差异记录下来，通过双向链接连接相关笔记。</p></blockquote>'},
    {"id": "demo-wa", "title": "WA-JEPA", "tags": ["世界模型"], "html": '<h2>阅读提纲</h2><p>这里记录了与 <a href="#note/demo-vjepa">V-JEPA 世界模型</a> 的比较思路。</p>'},
    {"id": "demo-route", "title": "端到端模型技术路线", "tags": [], "html": '<h2>学习记录</h2><p>相关学习记录见 <a href="#note/demo-vjepa">V-JEPA 世界模型</a>。</p>'}
]
for note in NOTES:
    note.update(folderId="f", updatedAt="2026-09-18T06:20:00Z", assets=[], properties={"type": "论文", "status": "在读"}, file=f'notebooks/docs/{note["id"]}.json')
FILES = {note["file"]: note for note in NOTES}
FILES["notebooks/index.json"] = {"version": 1, "folders": FOLDERS, "docs": NOTES}
FILES["notebooks/favorites.json"] = {"noteIds": [], "updatedAt": ""}

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def reply(self, data, status=200, content_type="application/json"):
        body = data if isinstance(data, bytes) else data.encode() if isinstance(data, str) else json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = unquote(urlparse(self.path).path).lstrip("/")
        if path == "static/cloud-client.mjs":
            return self.reply((ROOT / "tests/workspace-fixture-client.mjs").read_text(encoding="utf-8"), content_type="text/javascript")
        if path == "static/cloud-config.json":
            return self.reply({"backendUrl": "https://fixture.invalid"})
        if path in FILES:
            return self.reply(FILES[path], content_type=(mimetypes.guess_type(path)[0] or "application/octet-stream") if isinstance(FILES[path], bytes) else "application/json")
        if path == "fixture/repository":
            filename = parse_qs(urlparse(self.path).query)["path"][0]
            if filename not in FILES:
                return self.reply({"error": "Not found"}, 404)
            return self.reply({"sha": "fixture-sha", "content": base64.b64encode(json.dumps(FILES[filename], ensure_ascii=False).encode()).decode(), "encoding": "base64"})
        return super().do_GET()

    def do_PUT(self):
        if urlparse(self.path).path != "/fixture/repository":
            return self.reply({"error": "Fixture API only"}, 404)
        filename = parse_qs(urlparse(self.path).query)["path"][0]
        data = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        decoded = base64.b64decode(data["content"])
        FILES[filename] = json.loads(decoded) if filename.endswith(".json") else decoded
        return self.reply({"content": {"sha": "fixture-sha"}})

    def do_DELETE(self):
        return self.reply({"error": "Fixture deletion is disabled"}, 405)

if __name__ == "__main__":
    print("Acceptance fixture only: http://127.0.0.1:8001", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 8001), Handler).serve_forever()

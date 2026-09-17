"""Convert the notebook's saved HTML without executing it or fetching links."""
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path


def fingerprint(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def terms(text):
    result = []
    for word in re.findall(r"[a-z0-9_+#.-]+|[\u3400-\u9fff]+", text.lower()):
        if re.match(r"[\u3400-\u9fff]", word):
            result.extend(word[i:i + 2] for i in range(max(1, len(word) - 1)))
        else:
            result.append(word)
    return " ".join(result)


class NoteParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.sections = []
        self.heading = "正文"
        self.heading_index = -1
        self.output = []
        self.heading_parts = None
        self.skip = 0
        self.special = []
        self.pre = 0
        self.row = []
        self.cell = None

    def emit(self, text):
        if self.cell is not None:
            self.cell.append(text)
        elif self.heading_parts is not None:
            self.heading_parts.append(text)
        else:
            self.output.append(text)

    def flush(self):
        text = "".join(self.output).strip()
        if text:
            self.sections.append({"heading": self.heading, "heading_index": self.heading_index, "text": text})
        self.output = []

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if self.skip:
            if tag in {"script", "style"}:
                self.skip += 1
            return
        if tag in {"script", "style"}:
            self.skip = 1
            return
        if self.special:
            if tag not in {"br", "img", "hr", "input", "source"}:
                self.special.append(tag)
            return
        if "data-tex" in attrs:
            delimiter = "$$" if attrs.get("data-type") == "math-block" else "$"
            self.emit(f"{delimiter}{attrs['data-tex']}{delimiter}")
            self.special.append(tag)
        elif "data-mermaid-code" in attrs:
            self.emit(f"\n\n```mermaid\n{attrs['data-mermaid-code']}\n```\n\n")
            self.special.append(tag)
        elif re.fullmatch(r"h[1-6]", tag):
            self.flush()
            self.heading_parts = []
            if tag in {"h1", "h2", "h3"}:
                self.heading_index += 1
        elif tag == "pre":
            self.pre += 1
            self.emit("\n\n```\n")
        elif tag == "code" and not self.pre:
            self.emit("`")
        elif tag == "br":
            self.emit("\n")
        elif tag == "li":
            self.emit("\n- ")
        elif tag == "blockquote":
            self.emit("\n> ")
        elif tag == "tr":
            self.row = []
        elif tag in {"td", "th"}:
            self.cell = []
        elif tag == "img":
            self.emit(f"\n[图片说明：{attrs['alt']}]\n" if attrs.get("alt") else "\n[图片：未提取图像内容]\n")
        elif tag == "a":
            # Keep human-readable text; arbitrary remote URLs are never crawled.
            self.emit("")
        elif tag in {"p", "div", "section", "table", "ul", "ol"}:
            self.emit("\n\n")

    def handle_endtag(self, tag):
        if self.skip:
            if tag in {"script", "style"}:
                self.skip -= 1
            return
        if self.special:
            if tag == self.special[-1]:
                self.special.pop()
            return
        if re.fullmatch(r"h[1-6]", tag) and self.heading_parts is not None:
            self.heading = "".join(self.heading_parts).strip() or "正文"
            self.heading_parts = None
        elif tag == "pre":
            self.emit("\n```\n\n")
            self.pre = max(0, self.pre - 1)
        elif tag == "code" and not self.pre:
            self.emit("`")
        elif tag in {"td", "th"} and self.cell is not None:
            self.row.append(" ".join("".join(self.cell).split()).replace("|", "\\|"))
            self.cell = None
        elif tag == "tr":
            self.emit("\n| " + " | ".join(self.row) + " |\n")
        elif tag in {"p", "div", "section", "table", "ul", "ol", "li"}:
            self.emit("\n\n")

    def handle_data(self, data):
        if not self.skip and not self.special:
            self.emit(data)


def html_sections(source):
    parser = NoteParser()
    parser.feed(source)
    parser.close()
    parser.flush()
    return parser.sections


def split_section(text, maximum=1600, overlap=160):
    """Prefer paragraph/newline boundaries; retain every character of oversized blocks."""
    text = text.strip()
    result = []
    start = 0
    while start < len(text):
        end = min(start + maximum, len(text))
        if end < len(text):
            boundary = max(text.rfind("\n", start + maximum // 2, end), text.rfind("。", start + maximum // 2, end))
            if boundary > start:
                end = boundary + 1
        result.append(text[start:end])
        if end == len(text):
            break
        start = max(start + 1, end - overlap)
    return result


def load_documents(root):
    root = Path(root).resolve()
    index = json.loads((root / "notebooks/index.json").read_text(encoding="utf-8"))
    if not isinstance(index.get("docs"), list):
        raise ValueError("Published index has no docs array; refusing to replace the knowledge base")
    folders = {f["id"]: f for f in index.get("folders", [])}
    documents, chunks, seen = [], [], set()
    for entry in index["docs"]:
        path = (root / entry["file"]).resolve()
        if root / "notebooks" / "docs" not in path.parents:
            raise ValueError("Document path escapes notebooks/docs")
        note = json.loads(path.read_text(encoding="utf-8"))
        note_id = note["id"]
        if note_id != entry["id"] or note_id in seen:
            raise ValueError("Duplicate or inconsistent note ID")
        seen.add(note_id)
        if not isinstance(note.get("html"), str):
            raise ValueError(f"Missing HTML for {note_id}; refusing partial import")
        ancestors = []
        folder_id = entry.get("folderId") or note.get("folderId")
        while folder_id:
            if folder_id in ancestors:
                raise ValueError("Folder cycle")
            ancestors.append(folder_id)
            folder_id = folders.get(folder_id, {}).get("parentId")
        title = note.get("title") or entry.get("title") or "未命名笔记"
        tags = note.get("tags") or entry.get("tags") or []
        source_hash = fingerprint(json.dumps({"html": note["html"], "title": title, "folders": ancestors, "tags": tags}, ensure_ascii=False, sort_keys=True))
        document = {"id": note_id, "title": title, "file": entry["file"], "hash": source_hash, "folder_ids": ancestors, "tags": tags}
        documents.append(document)
        ordinal = 0
        for section in html_sections(note["html"]):
            for text in split_section(section["text"]):
                chunk_id = fingerprint(f"{note_id}\n{source_hash}\n{ordinal}\n{text}")[:32]
                chunks.append({"id": chunk_id, "note_id": note_id, "title": title, "heading": section["heading"], "heading_index": section["heading_index"], "ordinal": ordinal, "text": text, "source_hash": source_hash})
                ordinal += 1
    return documents, chunks


def canonical_slug(name):
    return re.sub(r"[^a-z0-9\u3400-\u9fff]+", "-", name.lower()).strip("-")[:80]

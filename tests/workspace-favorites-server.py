"""Six-note favorites fixture; only the isolated port 8004 receives mock writes."""
from pathlib import Path
from http.server import ThreadingHTTPServer
import runpy

fixture = runpy.run_path(str(Path(__file__).with_name("workspace-fixture-server.py")))
files = fixture["FILES"]
titles = ["V-JEPA 世界模型", "WA-JEPA 世界-动作模型", "BEVFusion 多模态融合", "端到端模型技术路线", "Transformer 模型", "LoRA 参数微调"]
descriptions = ["关于视频表征学习、掩码预测与世界模型的阅读笔记。", "阅读并整理 WA-JEPA 的设计思路、训练策略与实验结论。", "整理 BEVFusion 的整体框架、模态对齐方式与实验效果。", "梳理自动驾驶端到端模型的发展历程与主流技术路线。", "记录 Transformer 的核心结构、关键思想与在视觉领域的应用。", "总结 LoRA 的原理、实现方法与在大模型高效微调中的实践经验。"]
notes = []
for index, (title, description) in enumerate(zip(titles, descriptions)):
    note = {"id": f"favorite-{index}", "title": title, "html": f"<p>{description}</p>", "folderId": "f" if index < 4 else "llm", "tags": ["世界模型", "自监督学习"] if index < 2 else ["自动驾驶"] if index < 4 else ["大模型"], "date": f"2026-09-{19 if index % 2 == 0 else 18}T06:20:00Z", "assets": [], "properties": {}, "file": f"notebooks/docs/favorite-{index}.json"}
    note["updatedAt"] = note["date"]
    notes.append(note)
    files[note["file"]] = note
notes[0]["html"] += '<h2>核心思路</h2><p>从视频中学习可迁移的表征，用预测任务理解场景变化。</p><ul><li>编码上下文信息</li><li>预测被遮挡的区域</li></ul><blockquote><p>关注表征空间中的预测能力。</p></blockquote>'
notes[0]["html"] += f'<img src="{fixture["IMAGE"]}" alt="预览图片测试"><pre><code class="language-python">prediction = model(context)</code></pre><p>损失函数：<span data-type="math-inline" data-latex="x^2">x^2</span></p>'
notes[0]["html"] += '<table><tbody><tr><th>阶段</th><th>目标</th></tr><tr><td>预训练</td><td>学习视频表征</td></tr></tbody></table>'
notes[0]["html"] += '<p>后续阅读：<a href="#note/favorite-1">WA-JEPA 世界-动作模型</a></p>'
notes[0]["html"] += '<p>复习记录：结合上下文预测与实验结果，持续完善对世界模型的理解。</p>' * 12
files["notebooks/index.json"] = {"version": 1, "folders": fixture["FOLDERS"], "docs": notes}
files["notebooks/favorites.json"] = {"noteIds": [n["id"] for n in notes], "updatedAt": "2026-09-19T06:20:00Z"}
if __name__ == "__main__":
    print("Favorites acceptance fixture: http://localhost:8004", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 8004), fixture["Handler"]).serve_forever()

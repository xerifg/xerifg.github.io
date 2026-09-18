import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'build'))
import sync
from content import html_sections, split_section, load_documents


class MemoryCloud:
    def __init__(self):
        self.db = sqlite3.connect(':memory:')
        self.db.row_factory = sqlite3.Row
        self.db.executescript((Path(__file__).resolve().parents[1] / 'schema.sql').read_text())
        self.items = {}

    def sql(self, sql, params=None):
        return [dict(row) for row in self.db.execute(sql, params or [])]

    def upsert(self, values):
        self.items.update({v['id']: v for v in values})
        return {'mutationId': 'done'}

    def wait_vectors(self, ids, namespace, probe, mutation):
        assert all(i in self.items for i in ids)

    def wait_mutation(self, mutation):
        assert mutation == 'done'

    def vectors(self, operation, data):
        if operation == 'delete_by_ids':
            for key in data['ids']:
                self.items.pop(key, None)
            return {'mutationId': 'done'}
        return [self.items[key] for key in data['ids'] if key in self.items]


class Models:
    embedding_model = 'test-embedding'
    chat_model = 'test-chat'

    def __init__(self):
        self.calls = 0

    def call(self, kind, path, data):
        self.calls += 1
        return {'data': [{'index': i, 'embedding': [0.1] * 1024} for i, text in enumerate(data['input'])]}

    def chat(self, system, data):
        self.calls += 1
        if isinstance(data, list):
            return {'topics': [{'name': '特征融合', 'type': 'concept', 'aliases': [], 'refs': [d['id'] for d in data]}]}
        return {'content': '特征融合的机制见原文。[1]', 'links': []}


class BuildTests(unittest.TestCase):
    def library(self, root, html='<h1>特征融合</h1><p>保留原文证据。</p>'):
        (root / 'notebooks/docs').mkdir(parents=True, exist_ok=True)
        note = {'id': 'n1', 'title': '融合', 'html': html, 'folderId': 'child'}
        (root / 'notebooks/docs/n1.json').write_text(json.dumps(note), encoding='utf-8')
        (root / 'notebooks/index.json').write_text(json.dumps({'docs': [{'id': 'n1', 'file': 'notebooks/docs/n1.json'}], 'folders': [{'id':'child','parentId':'parent'}, {'id':'parent'}]}), encoding='utf-8')

    def test_math_code_tables_and_heading_positions(self):
        sections = html_sections('<h1>标题</h1><p>公式<span data-type="math-inline" data-tex="x^2"><span>重复渲染</span></span>后文</p><table><tr><td>A</td><td>B</td></tr></table><pre><code>x &lt; y</code></pre><script>attack</script><h2>第二节</h2><p>内容</p>')
        self.assertIn('$x^2$', sections[0]['text'])
        self.assertIn('| A | B |', sections[0]['text'])
        self.assertIn('x < y', sections[0]['text'])
        self.assertNotIn('重复渲染', sections[0]['text'])
        self.assertNotIn('attack', sections[0]['text'])
        self.assertEqual(sections[1]['heading_index'], 1)

    def test_chunking_retains_long_content_and_overlap(self):
        text = ''.join(chr(0x3400+i) for i in range(4000))
        chunks = split_section(text)
        self.assertTrue(all(len(c) <= 1600 for c in chunks))
        self.assertEqual(chunks[0] + ''.join(c[160:] for c in chunks[1:]), text)

    def test_manifest_failures_do_not_silently_drop_notes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); self.library(root)
            docs, chunks = load_documents(root)
            self.assertEqual(docs[0]['folder_ids'], ['child', 'parent'])
            (root / 'notebooks/docs/n1.json').unlink()
            with self.assertRaises(FileNotFoundError):
                load_documents(root)

    def test_sync_cache_generation_swap_failed_build_and_deletion(self):
        cloud = MemoryCloud(); models = Models()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); self.library(root)
            with patch.object(sync, 'Cloud', return_value=cloud), patch.object(sync, 'Models', return_value=models), patch.object(sync, 'backup_snapshot'):
                sync.sync(root)
                first = cloud.sql("SELECT value FROM settings WHERE key='active_generation'")[0]['value']
                calls = models.calls
                sync.sync(root)
                self.assertEqual(models.calls, calls, 'unchanged evidence must not call models again')
                second = cloud.sql("SELECT value FROM settings WHERE key='active_generation'")[0]['value']
                self.assertNotEqual(first, second)
                self.assertTrue(cloud.sql('SELECT * FROM chunks WHERE generation=?', [first]))
                self.library(root, '<p>改过的笔记</p>')
                with patch.object(models, 'chat', side_effect=RuntimeError('provider failed')):
                    with self.assertRaises(RuntimeError):
                        sync.sync(root)
                self.assertEqual(cloud.sql("SELECT value FROM settings WHERE key='active_generation'")[0]['value'], second)
                self.assertFalse(cloud.sql('SELECT * FROM chunks WHERE generation=?', [first]))
                (root / 'notebooks/index.json').write_text('{"docs":[]}')
                with self.assertRaises(ValueError):
                    sync.sync(root)
                sync.sync(root, allow_empty=True)
                current = cloud.sql("SELECT value FROM settings WHERE key='active_generation'")[0]['value']
                self.assertEqual(cloud.sql('SELECT * FROM wiki_pages WHERE generation=?', [current]), [])
                self.assertEqual(cloud.sql('SELECT * FROM chunks WHERE generation=?', [current]), [])

    def test_invalid_model_citations_never_publish(self):
        cloud = MemoryCloud(); models = Models()
        chunks = [{'id':'x','title':'原文','heading':'标题','text':'证据'}]
        topics = {'topic':{'slug':'topic','title':'Topic','type':'concept','refs':['x'],'aliases':[]}}
        with patch.object(models, 'chat', return_value={'content':'虚假引用[2]','links':[]}):
            with self.assertRaises(ValueError):
                sync.build_pages(cloud, models, topics, chunks)

    def test_unknown_wiki_links_keep_text_without_inventing_graph_edges(self):
        cloud = MemoryCloud(); models = Models()
        chunks = [{'id':'x','title':'原文','heading':'标题','text':'证据'}]
        topics = {slug:{'slug':slug,'title':slug,'type':'concept','refs':['x'],'aliases':[]} for slug in ['topic','related']}
        content = '事实[1]。[[related|关联]]、[[topic|自己]]、[[missing|未知]]、[[ghost]]。'
        with patch.object(models, 'chat', return_value={'content':content,'links':['missing']}) as chat:
            pages = sync.build_pages(cloud, models, topics, chunks)
            page = next(page for page in pages if page['slug'] == 'topic')
            self.assertEqual(page['links'], ['related'])
            self.assertEqual(page['content'], '事实[1]。[[related|关联]]、自己、未知、ghost。')
            sync.build_pages(cloud, models, topics, chunks)
            self.assertEqual(chat.call_count, 2, 'validated results must be reused from cache')

    def test_invalid_generated_json_retries_are_bounded_and_only_cache_valid_results(self):
        cloud = MemoryCloud()
        generate = Mock(side_effect=[json.JSONDecodeError('Extra data', '{}{}', 2), ValueError('Invalid citations'), {'content':'事实[1]'}])
        self.assertEqual(sync.cached_json(cloud, 'valid', generate), {'content':'事实[1]'})
        self.assertEqual(generate.call_count, 3)
        sync.cached_json(cloud, 'valid', generate)
        self.assertEqual(generate.call_count, 3)
        invalid = Mock(side_effect=ValueError('Invalid citations'))
        with self.assertRaises(ValueError):
            sync.cached_json(cloud, 'invalid', invalid)
        self.assertEqual(invalid.call_count, 3)
        self.assertEqual(cloud.sql('SELECT * FROM extraction_cache WHERE id=?', ['invalid']), [])


if __name__ == '__main__':
    unittest.main()

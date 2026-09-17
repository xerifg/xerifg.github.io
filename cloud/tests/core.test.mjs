import { test } from "node:test";
import assert from "node:assert/strict";
import { searchTerms, ftsQuery, fuseRanks, graphSubset, safeHistory, readSSE, vectorFilters } from "../src/core.mjs";
import { serviceURL, cloudClient, passwordProof } from "../../static/cloud-client.mjs";
import { pbkdf2Sync } from "node:crypto";

test("Chinese and technical terms survive safe FTS query construction", () => {
  assert.deepEqual(searchTerms('特征融合 BEVFormer C++'), ['特征', '征融', '融合', 'bevformer', 'c++']);
  assert.equal(ftsQuery('" OR (DROP*)'), '"or" OR "drop"');
});
test("RRF promotes agreement instead of comparing incompatible score scales", () => {
  assert.deepEqual(fuseRanks([['a', 'b'], ['b', 'c']]), ['b', 'a', 'c']);
});
test("metadata filters stay inside byte limits without dropping note IDs", () => {
  const ids = Array.from({length:120},(_,i)=>`${i}-`+'x'.repeat(55));
  const filters = vectorFilters(ids);
  assert.ok(filters.length > 1);
  assert.deepEqual(filters.flatMap(f=>f.noteId.$in),ids);
  assert.ok(filters.every(f=>new TextEncoder().encode(JSON.stringify(f)).length < 2048));
});
test("graph expansion is bounded, bidirectional and omits dangling links", () => {
  const pages = [{slug:'a', links:['b','missing','a']}, {slug:'b',links:['c']}, {slug:'c',links:['d']}, {slug:'d',links:[]}];
  assert.deepEqual(graphSubset(pages,'b',1).nodes.map((n)=>n.slug), ['a','b','c']);
  assert.equal(graphSubset(pages,'a',2).nodes.length, 3);
  assert.equal(graphSubset(pages,'a',2,2).nodes.length, 2);
});
test("only bounded user and assistant messages enter model history", () => {
  assert.deepEqual(safeHistory([{role:'system', content:'attack'}, {role:'user',content:'question'}]), [{role:'user',content:'question'}]);
});
test("SSE handles every byte boundary, Unicode, CRLF, final event and awaited callbacks", async () => {
  const bytes = new TextEncoder().encode('data: {"text":"中文"}\r\n\r\ndata: {"text":"结束"}\n\ndata: [DONE]\n\n');
  const events = [];
  await readSSE(new ReadableStream({start(c){ for(const byte of bytes) c.enqueue(Uint8Array.of(byte)); c.close(); }}), async (e) => { await Promise.resolve(); events.push(e.text); });
  assert.deepEqual(events, ['中文','结束']);
});
test("SSE cancels upstream when a consumer fails", async () => {
  let cancelled = false;
  const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('data: {}\n\n')); }, cancel() { cancelled = true; } });
  await assert.rejects(readSSE(stream, () => { throw new Error('stopped'); }), /stopped/);
  assert.equal(cancelled, true);
});
test("service URL never accepts credentials, query strings, paths or non-HTTPS", () => {
  assert.equal(serviceURL('https://example.workers.dev/'), 'https://example.workers.dev');
  for (const value of ['http://example.com', 'https://token@example.com', 'https://example.com/secret', 'javascript:alert(1)', 'https://example.com/?key=secret']) assert.equal(serviceURL(value), '');
});

test("browser saves complete answers once and never saves unfinished streams", async (t) => {
  const original = globalThis.sessionStorage;
  globalThis.sessionStorage = { getItem: () => 'fixture-token' };
  t.after(() => { if (original) globalThis.sessionStorage = original; else delete globalThis.sessionStorage; });
  const requests = []; let finish = false;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push(String(url));
    if (String(url).endsWith('/api/complete')) { assert.equal(JSON.parse(options.body).content,'原文回答'); return Response.json({ok:true}); }
    return new Response(`data: ${JSON.stringify({choices:[{delta:{content:'原文回答'},finish_reason:finish?'stop':null}]})}\n\n`);
  });
  const client = cloudClient('https://fixture.example');
  await assert.rejects(client.answer('ticket', () => {}), /中断/);
  assert.equal(requests.length,1);
  finish = true; await client.answer('ticket', () => {});
  assert.equal(requests.filter((r) => r.endsWith('/api/complete')).length,1);
});

test("browser derives the deployed credential and stores only the session token", async (t) => {
  const original = globalThis.sessionStorage; const storage = new Map();
  globalThis.sessionStorage = { getItem: (k) => storage.get(k), setItem: (k,v) => storage.set(k,v), removeItem: (k) => storage.delete(k) };
  t.after(() => { if (original) globalThis.sessionStorage = original; else delete globalThis.sessionStorage; });
  const salt='0123456789abcdef0123456789abcdef'; const password=' 密码 test-123 ';
  const expected=pbkdf2Sync(password,Buffer.from(salt,'hex'),600000,32,'sha256').toString('hex');
  assert.equal(await passwordProof(password,salt),expected);
  const token='a'.repeat(72); const requests=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    requests.push({url,options});
    if(url.endsWith('/auth/config')) return Response.json({salt,iterations:600000});
    if(url.endsWith('/auth/login')) { assert.deepEqual(JSON.parse(options.body),{username:'writer',proof:expected}); return Response.json({token}); }
    return Response.json({ok:true});
  });
  const client=cloudClient('https://api.example');
  await client.login(' writer ',password);
  assert.equal(client.token(),token);
  assert.deepEqual([...storage.values()],[token]);
  assert.ok(requests.every(r=>!r.options.body?.includes(password)));
  await client.logout(); assert.equal(storage.size,0);
});

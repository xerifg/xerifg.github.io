import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createHash, pbkdf2Sync } from "node:crypto";
import worker from "../src/worker.mjs";

const authSalt = "0123456789abcdef0123456789abcdef";
const authProof = pbkdf2Sync("test-password-123", Buffer.from(authSalt,"hex"),600000,32,"sha256").toString("hex");
const authVerifier = createHash("sha256").update(authProof).digest("hex");

function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  const DB = {
    prepare(sql) {
      let args = [];
      return { bind(...values) { args = values; return this; },
        async all() { return { results: sqlite.prepare(sql).all(...args) }; },
        async first() { return sqlite.prepare(sql).get(...args) || null; },
        async run() { return sqlite.prepare(sql).run(...args); } };
    },
    async batch(statements) { sqlite.exec('BEGIN'); try { const result = []; for(const s of statements) result.push(await s.run()); sqlite.exec('COMMIT'); return result; } catch(e) { sqlite.exec('ROLLBACK'); throw e; } }
  };
  const insert = (sql, ...params) => sqlite.prepare(sql).run(...params);
  insert('INSERT INTO auth_sessions VALUES (?,?)', createHash('sha256').update('writer:'+authVerifier+':test-session').digest('hex'), Math.floor(Date.now()/1000)+1000);
  insert("INSERT INTO settings VALUES ('active_generation','g1')");
  insert("INSERT INTO generations VALUES ('g1','commit','ready','2026-09-17','','embed:1024',2)");
  for(const [id,title,folder] of [['n1','特征融合','f1'],['n2','其他内容','f2']]) {
    insert('INSERT INTO documents VALUES (?,?,?,?,?,?,?)','g1',id,title,'notebooks/docs/'+id+'.json','hash',JSON.stringify([folder]),'[]');
    insert('INSERT INTO chunks VALUES (?,?,?,?,?,?,?,?,?)','g1','g1.'+id,id,title,'原理',0,0,'特征融合的原文证据。','hash');
    insert('INSERT INTO chunk_search VALUES (?,?,?)','g1','g1.'+id,'特征 征融 融合');
  }
  insert('INSERT INTO wiki_pages VALUES (?,?,?,?,?,?,?,?,?)','g1','fusion','特征融合','concept','定义见原文。[1]','["g1.n2","g1.n1"]','[]','[]','original-hash');
  const vectorCalls = [];
  const env = {DB, OWNER_AUTH:JSON.stringify({username:'writer',salt:authSalt,verifier:authVerifier}), GITHUB_PUBLISH_TOKEN:'server-only-token', NOTEBOOK_REPO:'notes', FRONTEND_ORIGIN:'https://notes.example', GITHUB_OWNER:'owner', EMBEDDING_MODEL:'embed', EMBEDDING_BASE_URL:'https://model.example', EMBEDDING_API_KEY:'secret', CHAT_MODEL:'chat', CHAT_BASE_URL:'https://model.example', CHAT_API_KEY:'secret',
    VECTORS: { async query(vector, options) { vectorCalls.push(options); return {matches: [{id:'g1.n1',score:.9},{id:'g1.n2',score:.8}]}; } } };
  const pending = [];
  const call = (path, data, method, authenticated = true, origin = 'https://notes.example') => worker.fetch(new Request('https://api.example'+path, {
    method: method || (data ? 'POST':'GET'), headers:{Origin:origin, ...(authenticated ? {Authorization:'Bearer test-session'} : {}), 'Content-Type':'application/json'}, ...(data ? {body: JSON.stringify(data)} : {})
  }), env, {waitUntil(p){pending.push(p);}});
  return {sqlite, env, insert, call, pending, vectorCalls};
}
function providerMock() {
  return async (url) => {
    if (String(url).endsWith('/embeddings')) return Response.json({data:[{embedding:Array(1024).fill(.1)}]});
    return new Response('data: {"choices":[{"delta":{"content":"根据原文回答。[1]"}}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n', {headers:{'Content-Type':'text/event-stream'}});
  };
}
test('custom login shares a session across APIs and revokes logout', async () => {
  const f=fixture();
  assert.deepEqual(await(await f.call('/auth/config',null,null,false)).json(),{salt:authSalt,iterations:600000});
  assert.equal((await f.call('/auth/login',{username:'writer',proof:'0'.repeat(64)},null,false)).status,401);
  assert.equal((await f.call('/auth/login',{username:'other',proof:authProof},null,false)).status,401);
  const result=await(await f.call('/auth/login',{username:'writer',proof:authProof},null,false)).json();
  assert.ok(result.token);
  const call=(path,method='GET')=>worker.fetch(new Request('https://api.example'+path,{method,headers:{Authorization:'Bearer '+result.token}}),f.env,{});
  assert.equal((await call('/api/account')).status,200);
  assert.equal((await call('/api/wiki')).status,200);
  assert.equal((await call('/api/logout','POST')).status,200);
  assert.equal((await call('/api/wiki')).status,401);
  assert.equal((await f.call('/auth/callback?code=old',null,null,false)).status,404);
  f.sqlite.close();
});

test('login rate limits reserve attempts and expire by time bucket',async()=>{
  const f=fixture(); const data={username:'writer',proof:'0'.repeat(64)};
  for(let i=0;i<5;i++) assert.equal((await f.call('/auth/login',data,null,false)).status,401);
  assert.equal((await f.call('/auth/login',{username:'writer',proof:authProof},null,false)).status,429);
  f.sqlite.exec('UPDATE login_attempts SET bucket=bucket-1');
  assert.equal((await f.call('/auth/login',{username:'writer',proof:authProof},null,false)).status,200);
  f.sqlite.exec("UPDATE login_attempts SET attempts=50 WHERE id='global'");
  assert.equal((await f.call('/auth/login',{username:'writer',proof:authProof},null,false)).status,429);
  f.sqlite.close();
});

test('credential changes and expired sessions invalidate authentication',async()=>{
  const f=fixture();
  f.sqlite.exec('UPDATE auth_sessions SET expires=1');
  assert.equal((await f.call('/api/account')).status,401);
  f.sqlite.exec('UPDATE auth_sessions SET expires=9999999999');
  f.env.OWNER_AUTH=JSON.stringify({username:'renamed',salt:authSalt,verifier:authVerifier});
  assert.equal((await f.call('/api/account')).status,401);
  f.env.OWNER_AUTH=JSON.stringify({username:'writer',salt:authSalt,verifier:'f'.repeat(64)});
  assert.equal((await f.call('/api/account')).status,401);
  f.sqlite.close();
});

test('publishing only accesses notebook paths in the configured repo and main branch',async(t)=>{
  const f=fixture(); const calls=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push({url,options});return Response.json({sha:'a'.repeat(40),content:'e30='});});
  const path='/api/repository?path='+encodeURIComponent('notebooks/docs/中文.json');
  assert.equal((await f.call(path,null,null,false)).status,401);
  for(const bad of ['.github/workflows/run.yml','static/app.js','notebooks/docs/../index.json','notebooks/assets/%2e%2e/app.js','notebooks/assets/../../app.js','notebooks/docs/x.json/evil','notebooks/docs/a\\b.json']) {
    assert.equal((await f.call('/api/repository?path='+encodeURIComponent(bad),{content:'e30='},'PUT')).status,403,bad);
  }
  assert.equal(calls.length,0);
  assert.equal((await f.call(path)).status,200);
  assert.equal((await f.call(path,{content:'e30=',sha:'a'.repeat(40),message:'Publish',branch:'evil',repo:'other'},'PUT')).status,200);
  assert.match(calls[1].url,/repos\/owner\/notes\/contents\/notebooks\/docs/);
  assert.equal(calls[1].options.headers.Authorization,'Bearer server-only-token');
  assert.deepEqual(JSON.parse(calls[1].options.body),{message:'Publish',branch:'main',sha:'a'.repeat(40),content:'e30='});
  assert.equal((await f.call(path,{sha:'a'.repeat(40),message:'Delete'},'DELETE')).status,200);
  assert.equal((await f.call(path,{content:'invalid"json'},'PUT')).status,400);
  assert.equal((await f.call(path,{},'DELETE')).status,400);
  f.sqlite.close();
});

test('publishing preserves missing files and conflicts, hides upstream credential errors',async(t)=>{
  const f=fixture(); let status=409;
  t.mock.method(globalThis,'fetch',async()=>new Response('secret-upstream-detail',{status}));
  const path='/api/repository?path=notebooks/index.json';
  assert.equal((await f.call(path,{content:'e30='},'PUT')).status,409);
  status=404; assert.equal((await f.call(path)).status,404);
  status=401; const response=await f.call(path); assert.equal(response.status,502);
  assert.doesNotMatch(await response.text(),/secret-upstream-detail|server-only-token/);
  f.sqlite.close();
});
test('private routes reject unauthorized sessions and foreign origins', async () => {
  const f=fixture();
  assert.equal((await f.call('/api/wiki',null,null,false)).status,401);
  assert.equal((await f.call('/api/wiki',null,null,true,'https://evil.example')).status,403);
  assert.equal((await f.call('/health',null,null,false)).status,200);
  f.sqlite.close();
});
test('hybrid retrieval scopes both query engines and never includes another folder', async (t) => {
  t.mock.method(globalThis,'fetch',providerMock()); const f=fixture();
  const response=await f.call('/api/prepare',{question:'特征融合',scope:{folderId:'f1'}});
  assert.equal(response.status,200); const result=await response.json();
  assert.equal(result.sources.length,1); assert.equal(result.sources[0].noteId,'n1');
  assert.deepEqual(f.vectorCalls[0].filter,{noteId:{$in:['n1']}});
  f.sqlite.close();
});
test('embedding outage degrades to FTS and discloses reduced retrieval', async (t) => {
  t.mock.method(globalThis,'fetch',async()=>new Response('',{status:503})); const f=fixture();
  const result=await (await f.call('/api/prepare',{question:'特征融合'})).json();
  assert.equal(result.sources.length,2); assert.match(result.warnings[0],/关键词/); f.sqlite.close();
});
test('answer tickets are one-use, conversations save only complete streams', async (t) => {
  t.mock.method(globalThis,'fetch',providerMock()); const f=fixture();
  const prep=await (await f.call('/api/prepare',{question:'特征融合'})).json();
  const answer=await f.call('/api/answer',{ticket:prep.ticket});
  assert.match(await answer.text(),/根据原文回答/); await Promise.all(f.pending);
  assert.equal((await f.call('/api/complete',{ticket:prep.ticket,content:'编造引用[99]'})).status,400);
  assert.equal((await f.call('/api/complete',{ticket:prep.ticket,content:'根据原文回答。[1]'})).status,200);
  assert.equal((await f.call('/api/complete',{ticket:prep.ticket,content:'根据原文回答。[1]'})).status,200);
  const conversation=await (await f.call('/api/conversations/'+prep.conversationId)).json();
  assert.equal(conversation.messages.length,2); assert.equal(conversation.messages[1].sources.length,2);
  assert.equal((await f.call('/api/answer',{ticket:prep.ticket})).status,409); f.sqlite.close();
});
test('unfinished model output aborts the stream and cannot pollute history', async (t) => {
  const fetch=providerMock(); t.mock.method(globalThis,'fetch',async(url)=>String(url).endsWith('/embeddings') ? fetch(url) : new Response('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'));
  const f=fixture(); const prep=await (await f.call('/api/prepare',{question:'特征融合'})).json();
  await (await f.call('/api/answer',{ticket:prep.ticket})).text(); await Promise.all(f.pending);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM conversations').get().n,0); f.sqlite.close();
});
test('daily budget is enforced before additional paid requests', async(t)=>{
  t.mock.method(globalThis,'fetch',providerMock()); const f=fixture(); f.env.DAILY_QUESTION_LIMIT='1';
  assert.equal((await f.call('/api/prepare',{question:'特征融合'})).status,200);
  assert.equal((await f.call('/api/prepare',{question:'再问'})).status,429); f.sqlite.close();
});
test('Wiki preserves reference order, stale evidence, optimistic edit versions and reverts',async()=>{
  const f=fixture(); const path='/api/wiki/page?slug=fusion';
  let page=await(await f.call(path)).json();
  assert.deepEqual(page.refs.map(s=>s.noteId),['n2','n1']);
  let response=await f.call(path,{content:'人工版本。[2]',version:0,generation:'g1'},'PUT'); assert.equal(response.status,200);
  assert.equal((await f.call(path,{content:'覆盖冲突',version:0,generation:'g1'},'PUT')).status,409);
  f.insert("UPDATE wiki_pages SET refs='[\"g1.n1\"]',evidence_hash='new-hash',content='新版[1]' WHERE slug='fusion'");
  page=await(await f.call(path)).json(); assert.equal(page.stale,true); assert.equal(page.refs[1].noteId,'n1'); assert.equal(page.generatedRefs.length,1);
  page=await(await f.call(path,{content:'采用新版[1]',version:1,generation:'g1',useGeneratedEvidence:true},'PUT')).json(); assert.equal(page.stale,false);
  page=await(await f.call(path,{version:2,generation:'g1',revertVersion:1},'PUT')).json(); assert.equal(page.stale,true); assert.equal(page.content,'人工版本。[2]'); assert.equal(page.refs.length,2);
  assert.equal((await f.call(path,{content:'错误[99]',version:3,generation:'g1'},'PUT')).status,400); f.sqlite.close();
});

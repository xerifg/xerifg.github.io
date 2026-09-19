import assert from 'node:assert/strict';
import { buildPublishChangeSet, buildPublishChangeDetails } from '../static/publish-model.mjs';
const note = { id:'n',title:'论文',html:'<p>正文</p>',folderId:null,tags:[],assets:[],file:'notebooks/docs/n.json' };
const remote = {notes:[note],folders:[]};
const local = {notes:[{...note, properties:{type:'论文',status:'已整理',aliases:['别名'],source:'https://example.org/paper'}, dailyDate:'2026-09-18'}],folders:[]};
const changes = buildPublishChangeSet(local,remote).changes;
assert.equal(changes.length,1,'Properties-only edits must be publishable');
const details = buildPublishChangeDetails(local,remote,changes[0]);
assert.ok(details.some(item=>item.label==='笔记属性'));
assert.ok(details.some(item=>item.label==='每日笔记日期'));
assert.equal(buildPublishChangeSet({notes:[{...note,properties:{}}],folders:[]},remote).changes.length,0,'Absent legacy properties are equivalent to empty values');
console.log('Workspace publish metadata tests passed');

const imageNote = {...note, html:'<p>正文</p><img src="notebooks/assets/example.png" width="480"><p>正文</p>'};
const resizedNote = {...imageNote, html:imageNote.html.replace('width="480"', 'width="340"')};
const imageChanges = buildPublishChangeSet({notes:[resizedNote],folders:[]},{notes:[imageNote],folders:[]});
assert.equal(imageChanges.changes.length,1,'An image-width-only edit must be publishable');
assert.equal(buildPublishChangeSet({notes:[resizedNote],folders:[]},{notes:[resizedNote],folders:[]}).changes.length,0,'Matching image sizes must not create a draft');

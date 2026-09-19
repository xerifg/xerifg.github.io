import assert from "node:assert/strict";
import { normalizeBoard, boardPreviewHTML, boardBounds, boardPort, boardConnectionTarget, boardNearbyConnectionNode, boardEdgePath, deleteBoardItems, duplicateBoardItems, moveBoardItems, safeBoardImage } from "../static/whiteboard-model.mjs";
import { noteLinks, validateBackup, mergeBackup } from "../static/knowledge-model.mjs";
import { buildPublishChangeSet } from "../static/publish-model.mjs";

const board = normalizeBoard({ id:"b", title:"研究思路", nodes:[
  { id:"group",type:"group",x:0,y:0,width:700,height:400 },
  { id:"a",type:"text",text:'<script>alert("x")</script>',x:40,y:60,width:260,height:180 },
  { id:"b",type:"note",noteId:"论文/一",title:"关联论文",x:380,y:60,width:260,height:180 }
], edges:[{id:"ab",from:"a",to:"b",label:"比较",arrow:true}] });
assert.equal(normalizeBoard(JSON.stringify(board)).nodes.length,3);
assert.deepEqual(normalizeBoard("broken").nodes,[]);
assert.equal(normalizeBoard({nodes:[...board.nodes,board.nodes[0]],edges:[{id:"bad",from:"a",to:"missing"}]}).edges.length,0);
assert.equal(normalizeBoard({nodes:[...board.nodes,board.nodes[0]]}).nodes.length,3);
assert.equal(safeBoardImage('javascript:alert(1)'),"");
assert.equal(safeBoardImage('data:text/html;base64,evil'),"");
assert.equal(safeBoardImage('blob:http://localhost/123'),'blob:http://localhost/123');
const preview = boardPreviewHTML(board);
assert.ok(!preview.includes('<script>'));
assert.ok(preview.includes('&lt;script&gt;'));
assert.deepEqual(noteLinks(preview),['论文/一']);
assert.ok(boardEdgePath(board.edges[0],board.nodes).path.startsWith('M 300 150 C'));
assert.equal(boardBounds(board.nodes).width,780);
for (const side of ['top','right','bottom','left']) {
  const target = boardConnectionTarget(board.nodes, 'a', boardPort(board.nodes[2],side), 1);
  assert.equal(target.nodeId,'b');
  assert.equal(target.side,side,`Exact ${side} anchor is selected`);
}
const ports = board.nodes.filter(n=>n.type!=='group');
for (const zoom of [.1,1,3]) {
  const p = boardPort(ports[1],'right');
  assert.equal(boardConnectionTarget(ports,'a',{x:p.x+20/zoom,y:p.y},zoom)?.side,'right','Snap radius uses screen pixels');
  assert.equal(boardConnectionTarget(ports,'a',{x:p.x+24/zoom,y:p.y},zoom),null,'Outside snap radius stays unconnected');
}
assert.equal(boardConnectionTarget(ports,'a',{x:500,y:70},1)?.side,'top','Dropping inside a card uses its nearest anchor');
assert.equal(boardConnectionTarget(ports,'a',boardPort(ports[0],'right'),1),null,'Cannot connect to self');
assert.equal(boardConnectionTarget([...ports,{...ports[1],id:'front'}],'a',boardPort(ports[1],'left'),1)?.nodeId,'front','Top card wins when cards overlap');
const nearbyNodes=[...ports,{...ports[1],id:'c',x:740}];
assert.equal(boardNearbyConnectionNode(nearbyNodes,'a',{x:680,y:100},1),'b','Only the nearest nearby card is shown');
assert.equal(boardNearbyConnectionNode(nearbyNodes,'a',{x:710,y:100},1),'c','Moving toward another card switches the candidate');
assert.equal(boardNearbyConnectionNode(nearbyNodes,'a',{x:1200,y:100},1),null,'Distant cards stay hidden');
assert.equal(boardNearbyConnectionNode([ports[0]],'a',{x:50,y:100},1),null,'Source is not a target candidate');
for(const zoom of [.1,1,3]) {
  assert.equal(boardNearbyConnectionNode([ports[1]],'a',{x:ports[1].x-50/zoom,y:100},zoom),'b','Nearby distance uses screen pixels');
  assert.equal(boardNearbyConnectionNode([ports[1]],'a',{x:ports[1].x-70/zoom,y:100},zoom),null);
}
const moved = moveBoardItems(board,['group'],100,80);
assert.deepEqual(moved.nodes.map(n=>[n.x,n.y]),[[100,80],[140,140],[480,140]]);
assert.notEqual(boardEdgePath(board.edges[0],board.nodes).path,boardEdgePath(board.edges[0],moved.nodes).path);
assert.equal(deleteBoardItems(board,['a']).edges.length,0);
let id = 0;
const copied = duplicateBoardItems(board,['a','b'],()=>`copy-${++id}`);
assert.equal(copied.ids.length,2);
assert.equal(copied.board.edges.length,2);
assert.equal(copied.board.edges[1].from,copied.ids[0]);
assert.equal(board.nodes.length,3,'Operations do not mutate undo snapshots');
const html = `<div data-type="whiteboard" data-whiteboard="${JSON.stringify(board).replaceAll('"','&quot;')}">${preview}</div>`;
const note = {id:'n',title:'白板',html,assets:[],tags:[],folderId:null};
const restored = validateBackup({version:1,notes:[note],folders:[]});
assert.equal(mergeBackup({notes:[],folders:[]},restored).notes[0].html,html);
assert.equal(buildPublishChangeSet({notes:[note],folders:[]},{notes:[{...note,html:'<p></p>'}],folders:[]}).changes.length,1);
console.log('Whiteboard model, references, backup and publish tests passed');

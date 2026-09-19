import { graphSubset } from '../cloud/src/core.mjs';

export const wikiPages = [
  {slug:'world-model',title:'世界模型',type:'concept',links:['jepa','representation','planning']},
  {slug:'jepa',title:'联合嵌入预测',type:'concept',links:['representation','video']},
  {slug:'representation',title:'自监督表征学习',type:'concept',links:['attention','video']},
  {slug:'planning',title:'机器人规划',type:'concept',links:['world-model']},
  {slug:'video',title:'视频理解',type:'concept',links:['attention']},
  {slug:'attention',title:'注意力机制',type:'concept',links:['transformer']},
  {slug:'transformer',title:'Transformer',type:'entity',links:['representation']},
  {slug:'isolated',title:'独立知识点',type:'concept',links:[]}
].map(p=>({...p,content:`# ${p.title}\n\n用于本地图谱交互测试。\n\n${p.links.map(slug=>`[[${slug}]]`).join(' · ')}`,refs:[],version:1,generation:'fixture'}));
export const fixtureGraph = (center='',depth=1) => graphSubset(wikiPages,center,depth);

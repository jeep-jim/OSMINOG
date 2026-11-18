'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Brand=require('./mouse/agent-brand.js'),root=path.join(__dirname,'mouse');
function pixels(d){return[...d.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map(m=>[Number(m[1]),Number(m[2])]);}
test('agent variants retain every owner face pixel and replace only the ears with symmetric antennas',()=>{
 const original=JSON.parse(fs.readFileSync(path.join(root,'mouse-head.json'),'utf8')).pixels,face=[];
 for(let y=7;y<17;y++)for(let x=0;x<19;x++)if(original[y][x]==='1')face.push([x,y]);
 let commonAntennas;
 for(const [variant,color]of Object.entries(Brand.palette)){
  const svg=fs.readFileSync(path.join(root,'agent-mouse-'+variant+'.svg'),'utf8'),actualFace=pixels(/id="mouse-agent-face" d="([^"]+)"/.exec(svg)[1]),antenna=pixels(/id="mouse-agent-antennas" d="([^"]+)"/.exec(svg)[1]);
  assert.deepEqual(actualFace,face);assert.ok(svg.includes('fill="'+color+'"'));assert.ok(antenna.every(([x,y])=>x>=0&&x<19&&y>=0&&y<7));
  const set=new Set(antenna.map(([x,y])=>x+','+y));for(const [x,y]of antenna)assert.ok(set.has((18-x)+','+y));assert.ok(!set.has('0,3')&&!set.has('18,3'),'Old full ears are absent');
  if(commonAntennas)assert.deepEqual(antenna,commonAntennas);else commonAntennas=antenna;
 }
});
test('five desk identities have stable distinct colours and cannot form external icon paths',()=>{
 assert.equal(Brand.service,'mouse://agent');assert.equal(Brand.icon('desk-3'),'agent-mouse-green.svg');assert.equal(Brand.icon('desk-1'),'agent-mouse-orange.svg');
 const colors=Array.from({length:5},(_,i)=>Brand.color('desk-'+(i+1)));assert.equal(new Set(colors).size,5);
 for(const id of ['','legacy-103','../../secret','https://example.test/']){const icon=Brand.icon(id);assert.match(icon,/^agent-mouse-(green|orange|cyan|violet|coral)\.svg$/);assert.equal(icon,Brand.icon(id));assert.ok(fs.existsSync(path.join(root,icon)));}
});
test('repeated state updates keep the same mascot source without restarting its image load',()=>{
 const attributes=new Map(),classes=new Set();let writes=0;const image={dataset:{},classList:{add:c=>classes.add(c)},getAttribute:key=>attributes.get(key),setAttribute(key,value){writes++;attributes.set(key,value);}};
 Brand.apply(image,'desk-3');for(let i=0;i<20;i++)Brand.apply(image,'desk-3');assert.equal(writes,1);assert.ok(classes.has('agent-mouse-icon'));assert.equal(image.dataset.agentColor,'green');Brand.apply(image,'desk-1');assert.equal(writes,2);assert.equal(image.dataset.agentColor,'orange');assert.equal(attributes.get('src'),'agent-mouse-orange.svg');
});

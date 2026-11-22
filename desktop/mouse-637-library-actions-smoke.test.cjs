'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
const load=(file,overrides={})=>{const filename=require.resolve(file),module={exports:{}},localRequire=createRequire(filename);vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,Buffer,require:id=>Object.hasOwn(overrides,id)?overrides[id]:localRequire(id)},{filename});return module.exports;};
const helpers=load('./mouse-631-smoke-helpers.cjs',{electron:{},'./mouse-628-ui-smoke.cjs':{},'./mouse-smoke-frames.cjs':{}});
const {assertRows,assertReceived,TEXT}=load('./mouse-637-library-actions-smoke.cjs',{electron:{},'./mouse-631-smoke-helpers.cjs':helpers});
function rows(){const files=[{id:'image',type:'image/png',title:'Owned image'},{id:'text',type:'text/plain',title:'Owned text'}],box={x:10,y:50,width:160,height:96},state={open:true,kind:'captures',view:'grid',theme:'dark',rows:files.map(file=>({id:file.id,content:file.type==='text/plain'?TEXT:'',tag:'BUTTON',aria:file.title,title:file.title,draggable:true,controls:0,open:box,checkbox:{bounds:{x:180,y:30,width:16,height:16},checked:file.id==='image'},image:{loaded:file.id==='image',width:160,height:96}}))};return{state,files};}
test('native file-content acceptance requires one accessible action, real thumbnail and persistent selection',()=>{
 const value=rows();assertRows(value.state,value.files,'grid','dark');for(const mutate of [s=>s.rows[0].controls=1,s=>s.rows[0].aria='',s=>s.rows[0].title='',s=>s.rows[0].content='Screenshot',s=>s.rows[0].draggable=false,s=>s.rows[0].checkbox.checked=false,s=>s.rows[0].image.width=32,s=>s.rows[1].content='Only a filename']){const {state,files}=rows();mutate(state);assert.throws(()=>assertRows(state,files,'grid','dark'));}
});
test('native drop acceptance rejects text substitutes, wrong files and untrusted synthetic drops',()=>{
 const bytes=Buffer.from('Real file\nМышь'),file={dragName:'Owned.txt',type:'text/plain'},base={trusted:true,types:['Files'],files:[{name:file.dragName,type:file.type,size:bytes.length,bytes:[...bytes]}]};assertReceived(base,file,bytes);
 for(const mutate of [v=>v.trusted=false,v=>v.types=['text/plain'],v=>v.files=[],v=>v.files[0].name='other.txt',v=>v.files[0].type='image/png',v=>v.files[0].bytes[0]=0,v=>v.files[0].size++]){const value=structuredClone(base);mutate(value);assert.throws(()=>assertReceived(value,file,bytes));}
});

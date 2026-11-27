'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function source(name){const module={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,name),'utf8'),{module,exports:module.exports,require:id=>id==='./mouse-smoke-seam-palette.cjs'?require(id):id.startsWith('./')||id==='electron'?{id}:require(id)},{filename:name});return module.exports;}
test('637 retains the live desktop proof and search absence acceptance used by636',()=>{
 const search=source('mouse-615-smoke.cjs'),desktop=source('mouse-621-smoke.cjs');
 for(const version of ['6.0.36','6.0.42']){
  assert.equal(search.searchRemovedForVersion(version),true);
  assert.equal(desktop.transitionProofForVersion(version).id,'./mouse-636-desktop-transition-smoke.cjs');
 }
 for(const version of ['6.0.35','6.0.29']){
  assert.equal(search.searchRemovedForVersion(version),false);
  assert.equal(desktop.transitionProofForVersion(version).id,'./mouse-627-desktop-transition-smoke.cjs');
 }
});
test('637 uses the requested dark seam while retained636 keeps its exact native pixels',()=>{
 const {paletteForVersion}=source('mouse-629-ui-smoke.cjs');
 assert.deepEqual(JSON.parse(JSON.stringify(paletteForVersion('6.0.36'))),{light:{hex:'#c7cfdf',rgb:[199,207,223]},dark:{hex:'#43536b',rgb:[67,83,107]}});
 assert.deepEqual(JSON.parse(JSON.stringify(paletteForVersion('6.0.42'))),{light:{hex:'#c7cfdf',rgb:[199,207,223]},dark:{hex:'#354357',rgb:[53,67,87]}});
});
test('workspace readback distinguishes requested seams from unchanged control borders',()=>{
 const {workspaceSeamToken}=require('./mouse-smoke-seam-palette.cjs');
 for(const [seam,line,expected]of [['','#c7cfdf','#c7cfdf'],['','#43536b','#43536b'],[' #354357 ','#43536b','#354357']]){
  const style={getPropertyValue:name=>({'--mouse-grid-seam':seam,'--line':line})[name]||''};
  const observed=workspaceSeamToken(style);assert.equal(observed,expected);
  const renderer=vm.runInNewContext('('+workspaceSeamToken.toString()+')(style)',{style});assert.equal(renderer,expected,'The same readback runs in the installed renderer');
 }
});

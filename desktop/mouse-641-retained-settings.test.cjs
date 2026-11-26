'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const removal=require('./mouse-637-agent-removal-contract.cjs');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8'),smoke=read('mouse-633-smoke.cjs');
const declaration=/^const SECTIONS=(\[[^\n]+\]);$/m.exec(smoke);
assert.ok(declaration,'The native retained scenario declares its complete section inventory');
const expected=Array.from(vm.runInNewContext(declaration[1]));
const fullAssertion=/assert\.deepEqual\(initial\.sections\.map\(row=>row\.name\),SECTIONS\);/.exec(smoke)?.[0];
assert.ok(fullAssertion,'Retained native acceptance compares every section in order');

function generatedPanel(){
 // Capture the actual composed markup, including the surface-settings module.
 // Stop exactly after assignment so this test needs no layout/native DOM shim.
 const captured=Symbol('markup captured');let html='';
 const body={set innerHTML(value){html=value;throw captured;}},header={},dialog={dataset:{},setAttribute(){},querySelector:selector=>selector==='.dialog-content'?body:selector==='header'?header:null};
 const context=vm.createContext({document:{querySelector:selector=>selector==='#settings-dialog'?dialog:null}});
 vm.runInContext(read('mouse/chrome-surface-settings.js'),context);vm.runInContext(read('mouse/settings-panel.js'),context);
 assert.throws(()=>context.createMouseSettings({N:{},model:{}}),error=>error===captured);
 const sections=[...html.matchAll(/<section\b[^>]*\bdata-settings-section="([^"]+)"[^>]*>/g)].map(match=>({name:match[1],hidden:/\bhidden(?:\s|>|=)/.test(match[0])}));
 const selected=/<button\b[^>]*data-settings-page="([^"]+)"[^>]*aria-current="page"/.exec(html)?.[1];
 return{sections,selectedPage:selected};
}
function verifySections(sections){vm.runInNewContext(fullAssertion,{assert,SECTIONS:expected,initial:{sections}});}

test('both retained installed settings inventories match all 19 sections rendered by the shipped panel',()=>{
 const initial=generatedPanel();assert.equal(initial.sections.length,19);assert.equal(new Set(initial.sections.map(row=>row.name)).size,19);
 verifySections(initial.sections);assert.deepEqual(removal.SETTINGS_SECTIONS,initial.sections.map(row=>row.name),'Agent removal retains the same actual browser settings sections');
});

test('retained section assertion still rejects missing, duplicate, reordered and unexpected groups',()=>{
 const original=generatedPanel().sections;
 assert.throws(()=>verifySections(original.filter(row=>row.name!=='privacy')));
 assert.throws(()=>verifySections(original.filter(row=>row.name!=='adblock-exclusions')));
 const reordered=original.slice();[reordered[3],reordered[4]]=[reordered[4],reordered[3]];assert.throws(()=>verifySections(reordered));
 assert.throws(()=>verifySections([...original,original[0]]));assert.throws(()=>verifySections([...original,{name:'unreviewed-section',hidden:true}]));
});

test('adding settings groups preserves the retained overview visibility assertions',()=>{
 const initial=generatedPanel(),assertions=/assert\.equal\(initial\.selectedPage,'overview'\);assert\.deepEqual\(initial\.sections\.filter\(row=>!row\.hidden\)\.map\(row=>row\.name\),\['privacy','overview-links'\]\);/.exec(smoke)?.[0];
 assert.ok(assertions,'The installed scenario still requires exactly the overview groups to be visible initially');new Function('assert','initial',assertions)(assert,initial);
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),vm=require('node:vm');
test('only complete glasses group moves exactly one source pixel left in both themes',()=>{
 for(const [name,hash] of [['mouse-private.svg','2af26d231b8de35d044045a220ddfb322d19f334db135169fcba17cac57cfad3'],['mouse-private-light.svg','bbf911643a151c18d8b89632fad33a56f1c10a46e0933cbd8bedab79b4706099']]){
  const s=fs.readFileSync('quadro/'+name,'utf8'),mark='<g id="owner-pixel-glasses" transform="translate(-1 0)">';
  assert.equal(s.split(mark).length,2);const old=s.replace(mark,'<g id="owner-pixel-glasses">');
  assert.equal(crypto.createHash('sha256').update(old).digest('hex'),hash,'body/paths/colors must remain identical to 6.0.11');
 }
});
test('AI controls dispatch only to the selected side tab and follow its history availability',async()=>{
 const source=fs.readFileSync('quadro/quadro.js','utf8');
 const methods=source.slice(source.indexOf(' function syncAINavigation(){'),source.indexOf(' const aiIcons=createMouseAIIcons'));
 const controls=Object.fromEntries(['back','forward','reload'].map(x=>['[data-action=ai-'+x+']',{}])),calls=[];
 let current={id:'side-a',lane:'side',back:false,forward:false};
 const context=vm.createContext({m:{aiId:'side-a'},tab:id=>current&&current.id===id?current:null,$:key=>controls[key],N:{browser:async(name,args)=>calls.push({name,id:args.id})}});
 vm.runInContext(methods,context);context.syncAINavigation();assert.equal(controls['[data-action=ai-back]'].disabled,true);assert.equal(controls['[data-action=ai-forward]'].disabled,true);
 await context.navigateAI('back');assert.equal(calls.length,0);
 current.back=true;context.syncAINavigation();assert.equal(controls['[data-action=ai-back]'].disabled,false);await context.navigateAI('back');assert.deepEqual(calls,[{name:'back',id:'side-a'}]);
 current.forward=true;await context.navigateAI('forward');assert.deepEqual(calls[1],{name:'forward',id:'side-a'});
 current={id:'side-a',lane:'main',back:true,forward:true};context.syncAINavigation();await context.navigateAI('back');await context.navigateAI('reload');assert.equal(calls.length,2);assert.equal(controls['[data-action=ai-reload]'].disabled,true);
 current=null;context.syncAINavigation();await context.navigateAI('forward');assert.equal(calls.length,2);
 assert.ok(source.includes("function applySide(){syncAINavigation();"));
 assert.ok(source.includes("if(['ai-back','ai-forward','ai-reload'].includes(name))return navigateAI(name.slice(3));"));
 const html=fs.readFileSync('quadro/index.html','utf8');assert.match(html,/data-action="ai-back"[^>]*disabled/);assert.match(html,/data-action="ai-forward"[^>]*disabled/);
});

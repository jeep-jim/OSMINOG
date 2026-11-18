'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function fixture(options={}){
 const images=[],calls=[],events=[],rect={x:12,y:70,width:320,height:240},slot={isConnected:true,getBoundingClientRect:()=>({...rect})};let restores=0;
 const document={querySelectorAll:()=>[{dataset:{pane:'p1'},querySelector:()=>slot}],querySelector:()=>null,
  createElement:()=>({style:{},dataset:{},setAttribute(){},removeAttribute(name){if(name==='src')delete this.src;},decode(){events.push('decode');return options.decode?options.decode():Promise.resolve();},remove(){events.push('remove');const i=images.indexOf(this);if(i>=0)images.splice(i,1);}}),body:{append(...nodes){events.push('append');images.push(...nodes);}}};
 const ctx={document,setTimeout,clearTimeout,requestAnimationFrame:fn=>setImmediate(fn)};vm.runInNewContext(fs.readFileSync('mouse/desktops.js','utf8'),ctx);
 const model={state:{tabs:[{id:'visible',internal:false}]},slots:{p1:'visible'},aiOpen:false};
 const normal=()=>({complete:true,token:'capture-token',surfaces:[{id:'visible',src:'data:image/png;base64,AAAA',width:320,height:240,pixelWidth:640,pixelHeight:480}]});
 const N={desktops:async(action,args)=>{calls.push({action,args});if(action==='surfaces'){events.push('capture');return options.capture?options.capture():normal();}assert.equal(action,'surface-hold');events.push(args.phase);if(args.phase==='begin'){assert.equal(args.purpose,'popover');return options.begin?options.begin():{held:true,token:args.token};}return options.end?options.end():{released:true};}};
 const restore=async()=>{events.push('restore');restores++;await options.restore?.(restores);};
 return{overlay:ctx.mouseFloatingBackdrop(N,model,restore),images,calls,events,model,rect,normal};
}
const flush=()=>new Promise(setImmediate);
test('popover decodes exact-size surfaces before holding native input and retains them until native restoration',async()=>{
 const decode=deferred(),end=deferred(),f=fixture({decode:()=>decode.promise,end:()=>end.promise});
 const showing=f.overlay.show('desktops');await flush();assert.ok(f.events.includes('decode'));assert.ok(!f.events.includes('begin'));assert.equal(f.images.length,0);
 decode.resolve();assert.equal(await showing,true);assert.equal(f.images.length,1);const image=f.images[0];
 assert.equal(image.style.pointerEvents,'none');assert.equal(image.style.width,'320px');assert.equal(image.style.height,'240px');assert.equal(image.draggable,false);
 assert.ok(f.events.indexOf('append')<f.events.indexOf('begin'));
 await f.overlay.hide('zoom');assert.equal(f.images.length,1,'another popup cannot discard the active background');
 const hiding=f.overlay.hide('desktops');await flush();assert.equal(f.images.length,1,'native restoration still pending');assert.ok(f.events.includes('end'));end.resolve();await hiding;assert.equal(f.images.length,0);assert.equal(image.src,undefined);
 assert.equal(f.calls.filter(c=>c.action==='surface-hold').length,2);
});
test('closing during capture rejects late pixels without hiding native pages afterwards',async()=>{
 const capture=deferred(),f=fixture({capture:()=>capture.promise}),pending=f.overlay.show('desktops');await flush();assert.ok(f.events.includes('capture'));
 const closing=f.overlay.hide('desktops');capture.resolve(f.normal());assert.equal(await pending,false);await closing;assert.equal(f.images.length,0);assert.ok(!f.events.includes('begin'));
});
test('closing while begin is in flight releases exactly the owned hold',async()=>{
 const begin=deferred(),f=fixture({begin:()=>begin.promise}),pending=f.overlay.show('desktops');while(!f.events.includes('begin'))await flush();
 const closing=f.overlay.hide('desktops');begin.resolve({held:true,token:'capture-token'});assert.equal(await pending,false);await closing;
 assert.equal(f.events.filter(e=>e==='end').length,1);assert.equal(f.images.length,0);
});
test('incomplete or untrusted image data never hides native pages or reaches the DOM',async()=>{
 for(const result of [{complete:false,token:'',surfaces:[]},{complete:true,token:'x',surfaces:[{id:'visible',src:'https://outside.invalid/track'}]},{complete:true,token:'x',surfaces:[{id:'visible',src:'data:text/html,script'}]}]){
  const f=fixture({capture:async()=>result});await assert.rejects(f.overlay.show('zoom'));await f.overlay.hide('zoom');assert.equal(f.images.length,0);assert.ok(!f.events.includes('begin'));
 }
});
test('a changed viewport rejects its old background before acquiring a hold',async()=>{
 const capture=deferred(),f=fixture({capture:()=>capture.promise}),pending=f.overlay.show('desktops');await flush();f.rect.width=360;capture.resolve(f.normal());await assert.rejects(pending);await f.overlay.hide('desktops');assert.ok(!f.events.includes('begin'));assert.equal(f.images.length,0);
});
test('failed native restoration still releases the owned hold and pixel references',async()=>{
 const f=fixture({restore:async count=>{if(count===2)throw Error('restore failure');}});assert.equal(await f.overlay.show('desktops'),true);await assert.rejects(f.overlay.hide('desktops'),/restore failure/);assert.ok(f.events.includes('end'));assert.equal(f.images.length,0);
});
test('a stale begin is rejected and its prepared surfaces are removed',async()=>{
 const f=fixture({begin:async()=>({held:false,token:''})});await assert.rejects(f.overlay.show('desktops'));await f.overlay.hide('desktops');assert.equal(f.images.length,0);assert.ok(!f.events.includes('end'));
});
test('a new popup waits for the previous native restore before capturing again',async()=>{
 const release=deferred();let ends=0;const f=fixture({end:()=>++ends===1?release.promise:Promise.resolve({released:true})});
 await f.overlay.show('desktops');const close=f.overlay.hide('desktops');await flush();const next=f.overlay.show('zoom');await flush();assert.equal(f.events.filter(x=>x==='capture').length,1);release.resolve({released:true});await close;assert.equal(await next,true);assert.equal(f.events.filter(x=>x==='capture').length,2);await f.overlay.hide('zoom');assert.equal(f.images.length,0);
});
test('desktop and zoom popovers participate in the existing modal native-view gate',()=>{
 const s=fs.readFileSync('mouse/desktops.js','utf8'),browser=fs.readFileSync('mouse/browser.js','utf8');
 assert.match(s,/const tray=document.createElement\('dialog'\)/);assert.match(s,/const box=document.createElement\('dialog'\)/);assert.match(s,/tray\.showModal\(\)/);assert.match(s,/box\.showModal\(\)/);
 assert.match(browser,/dialog\[open\]:not\(\[data-nonmodal\]\)/);assert.doesNotMatch(s,/writeFile|localStorage|sessionStorage|sendBeacon|clipboard/);
});
test('native layout has a bounded fallback and coalesces a burst while RAF is stalled',async()=>{
 const s=fs.readFileSync('mouse/browser.js','utf8'),start=s.indexOf('let frame=0,layoutTimeout=0;'),end=s.indexOf('\n async function layoutNow',start);assert.ok(start>=0&&end>start);
 let calls=0,frames=0;const ctx={m:{desktopSliding:false},requestAnimationFrame:()=>++frames,cancelAnimationFrame(){},setTimeout,clearTimeout,safe:fn=>fn(),layoutNow:()=>calls++};vm.runInNewContext(s.slice(start,end)+';globalThis.layoutProbe=requestLayout',ctx);
 for(let i=0;i<50;i++)ctx.layoutProbe();await new Promise(r=>setTimeout(r,35));assert.equal(calls,1);assert.equal(frames,1);ctx.layoutProbe();await new Promise(r=>setTimeout(r,35));assert.equal(calls,2);ctx.m.desktopSliding=true;ctx.layoutProbe();await new Promise(r=>setTimeout(r,20));assert.equal(calls,2,'compositor frames never enqueue native layout');ctx.m.desktopSliding=false;ctx.layoutProbe();ctx.m.desktopSliding=true;await new Promise(r=>setTimeout(r,25));assert.equal(calls,2,'a queued native layout is held during a transition');
});

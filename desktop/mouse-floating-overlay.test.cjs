'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function fixture(options={}){
 const images=[],created=[],calls=[],events=[],rect={x:12,y:70,width:320,height:240},slot={isConnected:true,getBoundingClientRect:()=>({...rect}),closest:()=>({style:{getPropertyValue:()=>String(options.roundBottom||0)},classList:{contains:name=>name==='has-pane-progress'&&options.hasProgress===true}})};let restores=0;
 const document={querySelectorAll:()=>[{dataset:{pane:'p1'},querySelector:()=>slot}],querySelector:()=>null,
  createElement:()=>{const image={style:{},dataset:{},setAttribute(){},removeAttribute(name){if(name==='src')delete this.src;},decode(){events.push('decode');return options.decode?options.decode():Promise.resolve();},remove(){events.push('remove');const i=images.indexOf(this);if(i>=0)images.splice(i,1);}};created.push(image);return image;},body:{append(...nodes){events.push('append');images.push(...nodes);}}};
 const ctx={document,setTimeout,clearTimeout,performance:options.performance||performance,requestAnimationFrame:fn=>setImmediate(fn)};vm.runInNewContext(fs.readFileSync('mouse/desktops.js','utf8'),ctx);
 const model={desktopId:'desk1',state:{tabs:[{id:'visible',internal:false}]},slots:{p1:'visible'},aiOpen:false};
 const normal=()=>({complete:true,desk:model.desktopId,token:'capture-token',surfaces:[{id:'visible',src:'data:image/png;base64,AAAA',width:320,height:240,pixelWidth:640,pixelHeight:480}]});
 const N={test:options.test===true,desktops:async(action,args)=>{calls.push({action,args});if(action==='surfaces'){events.push('capture');return options.capture?options.capture():normal();}if(action==='surface-present'){events.push('readback');return options.present?options.present(args):{ready:true,reason:'painted'};}assert.equal(action,'surface-hold');events.push(args.phase);if(args.phase==='begin'){assert.equal(args.purpose,'popover');return options.begin?options.begin():{held:true,token:args.token};}return options.end?options.end():{released:true};}};
 const restore=async()=>{events.push('restore');restores++;await options.restore?.(restores);};
 return{overlay:ctx.mouseFloatingBackdrop(N,model,restore),images,created,calls,events,model,rect,normal};
}
const flush=()=>new Promise(setImmediate);
test('popover decodes exact-size surfaces before holding native input and retains them until native restoration',async()=>{
 const decode=deferred(),end=deferred(),f=fixture({decode:()=>decode.promise,end:()=>end.promise});
 const showing=f.overlay.show('desktops');await flush();assert.ok(f.events.includes('decode'));assert.ok(!f.events.includes('begin'));assert.equal(f.images.length,0);
 decode.resolve();assert.equal(await showing,true);assert.equal(f.images.length,1);const image=f.images[0];
 assert.equal(image.style.pointerEvents,'none');assert.equal(image.style.width,'320px');assert.equal(image.style.height,'240px');assert.equal(image.draggable,false);
 assert.ok(f.events.indexOf('append')<f.events.indexOf('readback'));assert.ok(f.events.indexOf('readback')<f.events.indexOf('begin'));
 await f.overlay.hide('zoom');assert.equal(f.images.length,1,'another popup cannot discard the active background');
 const hiding=f.overlay.hide('desktops');await flush();assert.equal(f.images.length,1,'native restoration still pending');assert.ok(f.events.includes('end'));end.resolve();await hiding;assert.equal(f.images.length,0);assert.equal(image.src,undefined);
 assert.equal(f.calls.filter(c=>c.action==='surface-hold').length,2);
});
test('decoded snapshots leave native pages visible until actual readback acknowledges the same packet',async()=>{
 const readback=deferred(),f=fixture({present:()=>readback.promise}),showing=f.overlay.show('desktops');
 while(!f.events.includes('readback'))await flush();
 assert.equal(f.images.length,1);assert.equal(f.events.includes('begin'),false);assert.equal(f.overlay.held('desktops'),false);
 readback.resolve({ready:true});assert.equal(await showing,true);assert.equal(f.overlay.held('desktops'),true);
 assert.equal(await f.overlay.present('desktops'),true);
 const calls=f.calls.filter(call=>call.action==='surface-present');assert.deepEqual(JSON.parse(JSON.stringify(calls.map(call=>call.args))),[{token:'capture-token'},{token:'capture-token',holdToken:'capture-token'}]);
 await f.overlay.hide('desktops');
});
test('unpainted or cancelled readback cannot hide native pages or revive a released hold',async()=>{
 const f=fixture({present:async()=>({ready:false,reason:'mismatch'})});await assert.rejects(f.overlay.show('desktops'),/ещё не отрисовано/);await f.overlay.hide('desktops');assert.equal(f.events.includes('begin'),false);assert.equal(f.images.length,0);
 const pending=deferred();let calls=0;const held=fixture({present:()=>++calls===1?{ready:true}:pending.promise});await held.overlay.show('desktops');const painting=held.overlay.present('desktops');
 await held.overlay.hide('desktops');pending.resolve({ready:true});assert.equal(await painting,false);assert.equal(held.images.length,0);assert.equal(held.events.filter(event=>event==='begin').length,1);
});
test('closing during capture rejects late pixels without hiding native pages afterwards',async()=>{
 const capture=deferred(),f=fixture({capture:()=>capture.promise}),pending=f.overlay.show('desktops');await flush();assert.ok(f.events.includes('capture'));
 const closing=f.overlay.hide('desktops');capture.resolve(f.normal());assert.equal(await pending,false);await closing;assert.equal(f.images.length,0);assert.ok(!f.events.includes('begin'));
});
test('a Nora backdrop preserves rounded page corners and replaces the desk without releasing its native hold',async()=>{
 const f=fixture({roundBottom:12});await f.overlay.show('desktops');const original=f.images[0],lease=f.overlay.lease('desktops',()=>{});
 assert.equal(original.style.borderRadius,'0 0 12px 12px');assert.equal(original.style.clipPath,'inset(0 round 0 0 12px 12px)');assert.equal(lease.outgoing.desk,'desk1');assert.equal(f.overlay.lease('zoom'),null);
 f.model.desktopId='desk2';const incoming={...f.normal(),token:'incoming-capture',holdToken:lease.token};
 assert.notEqual(incoming.token,lease.token,'New capture identity is separate from the borrowed hold');
 assert.equal(await lease.replace(incoming),true);assert.equal(lease.valid(),true);assert.equal(f.images.length,1);assert.notEqual(f.images[0],original);assert.equal(original.src,undefined);assert.equal(f.overlay.lease('desktops').outgoing,incoming);
 assert.equal(f.events.filter(x=>x==='begin').length,1);assert.equal(f.events.filter(x=>x==='end').length,0);assert.equal(f.overlay.held('desktops'),true);
 await f.overlay.hide('desktops');assert.equal(lease.valid(),false);assert.equal(f.events.filter(x=>x==='end').length,1);assert.equal(f.images.length,0);
});
test('a borrowed backdrop refuses another hold, desk or stale page geometry',async()=>{
 const f=fixture();await f.overlay.show('desktops');const lease=f.overlay.lease('desktops'),original=f.images[0];f.model.desktopId='desk2';const incoming={...f.normal(),token:'incoming-capture',holdToken:lease.token};
 assert.equal(await lease.replace({...incoming,holdToken:'other-hold'}),false);assert.equal(await lease.replace({...incoming,desk:'desk3'}),false);
 await assert.rejects(lease.replace({...incoming,surfaces:incoming.surfaces.map(s=>({...s,bounds:{...f.rect,width:321}}))}),/Размер рабочего стола/);
 assert.equal(f.images[0],original);assert.equal(f.events.filter(x=>x==='end').length,0);await f.overlay.hide('desktops');assert.equal(await lease.replace(incoming),false);
});
test('a pane progress footer makes the page bottom an interior edge in the Nora snapshot too',async()=>{
 const f=fixture({roundBottom:12,hasProgress:true});await f.overlay.show('desktops');
 assert.equal(f.images[0].style.borderRadius,'0 0 0px 0px');assert.equal(f.images[0].style.clipPath,'inset(0 round 0 0 0px 0px)');assert.equal(f.images[0].style.height,'240px');
 await f.overlay.hide('desktops');assert.equal(f.images.length,0);
});
test('closing Nora during an incoming image decode cannot resurrect a stale backdrop',async()=>{
 const pending=deferred();let decoded=0;const f=fixture({decode:()=>++decoded===1?Promise.resolve():pending.promise});await f.overlay.show('desktops');const lease=f.overlay.lease('desktops');f.model.desktopId='desk2';
 const replacing=lease.replace({...f.normal(),token:'incoming-capture',holdToken:lease.token});await flush();await f.overlay.hide('desktops');pending.resolve();assert.equal(await replacing,false);assert.equal(f.images.length,0);assert.ok(f.created.every(image=>image.src===undefined));assert.equal(f.events.filter(x=>x==='end').length,1);
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
test('CI backdrop diagnostics distinguish bounded capture and hold phases without retaining pixels or mutable state',async()=>{
 let clock=0;const f=fixture({test:true,performance:{now:()=>++clock}});
 for(let i=0;i<3;i++){await f.overlay.show('desktops');await f.overlay.hide('desktops');}
 f.overlay.note('previews-cleared');const snapshot=f.overlay.diagnostics(),copy=structuredClone(snapshot);
 assert.equal(copy.events.length,32);assert.equal(copy.owner,'');assert.equal(copy.heldToken,false);assert.equal(copy.images,0);assert.equal(copy.events.at(-1).phase,'previews-cleared');
 assert.ok(copy.events.every(e=>Number.isFinite(e.at)&&typeof e.owner==='string'&&Number.isInteger(e.epoch)));
 const captured=copy.events.find(e=>e.phase==='capture'&&e.stage==='result');assert.deepEqual(captured.returnedIds,['visible']);assert.equal(captured.complete,true);assert.equal(captured.tokenPresent,true);assert.equal(captured.unchanged,true);
 assert.ok(copy.events.some(e=>e.phase==='hold'&&e.stage==='result'&&e.held));assert.ok(copy.events.some(e=>e.phase==='hide'&&e.stage==='cleared'));
 assert.doesNotMatch(JSON.stringify(copy),/data:image|capture-token/);snapshot.events.find(e=>e.returnedIds).returnedIds.push('mutated');snapshot.events.length=0;assert.equal(f.overlay.diagnostics().events.length,32);assert.ok(f.overlay.diagnostics().events.every(e=>!e.returnedIds?.includes('mutated')));
});
test('CI backdrop records the original bounded error while ordinary mode performs no diagnostic clock reads',async()=>{
 const error=Error('capture rejected '+'.'.repeat(700)),f=fixture({test:true,capture:()=>Promise.reject(error)});
 await assert.rejects(f.overlay.show('desktops'),actual=>actual===error);const entry=structuredClone(f.overlay.diagnostics()).events.at(-1);assert.equal(entry.phase,'error');assert.equal(entry.operation,'show');assert.equal(entry.message.length,512);await f.overlay.hide('desktops');
 const normal=fixture({performance:{now(){throw Error('ordinary mode must not read the diagnostic clock');}}});assert.equal(normal.overlay.diagnostics,undefined);assert.equal(normal.overlay.note,undefined);assert.equal(await normal.overlay.show('desktops'),true);await normal.overlay.hide('desktops');
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

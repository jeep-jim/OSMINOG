'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(resolveImage=async()=>({src:'data:image/png;base64,AAAA'})){
 const images=[],calls=[];
 const rect={x:12,y:70,width:320,height:240},slot={getBoundingClientRect:()=>rect};
 const document={querySelectorAll:()=>[{dataset:{pane:'p1'},querySelector:()=>slot}],querySelector:()=>null,
  createElement:()=>({style:{},setAttribute(){},remove(){const i=images.indexOf(this);if(i>=0)images.splice(i,1)}}),body:{append:image=>images.push(image)}};
 const ctx={document,setTimeout,clearTimeout};vm.runInNewContext(fs.readFileSync('mouse/desktops.js','utf8'),ctx);
 const model={state:{tabs:[{id:'visible',internal:false}]},slots:{p1:'visible'},aiOpen:false};
 const N={desktops:async(action,args)=>{assert.equal(action,'thumbnail');assert.equal(args.id,'visible');return resolveImage();},browser:async(action,args)=>{calls.push({action,args});}};
 return{overlay:ctx.mouseFloatingBackdrop(N,model),images,calls,model};
}
test('floating popover hides native inputs without resizing and removes RAM-only previews on close',async()=>{
 const f=fixture();assert.equal(await f.overlay.show('desktops'),true);assert.equal(f.images.length,1);
 assert.equal(f.images[0].style.pointerEvents,'none');assert.equal(f.images[0].style.width,'320px');assert.equal(f.images[0].style.height,'240px');assert.equal(f.images[0].draggable,false);
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].action,'layout');assert.equal(f.calls[0].args.panels.length,0);
 f.overlay.hide('zoom');assert.equal(f.images.length,1,'another popup cannot discard the active background');f.overlay.hide('desktops');assert.equal(f.images.length,0);
});
test('closing before capture finishes rejects stale snapshots and does not hide native pages later',async()=>{
 let resolve;const f=fixture(()=>new Promise(r=>{resolve=r})),pending=f.overlay.show('desktops');f.overlay.hide('desktops');resolve({src:'data:image/png;base64,AAAA'});
 assert.equal(await pending,false);assert.equal(f.images.length,0);assert.equal(f.calls.length,0);
});
test('snapshot errors and invalid image URLs cannot block popover input or execute markup',async()=>{
 for(const value of [null,{src:'https://outside.invalid/track'},{src:'data:text/html,script'}]){
  const f=fixture(async()=>value);assert.equal(await f.overlay.show('zoom'),true);assert.equal(f.images.length,0);assert.equal(f.calls.length,1);f.overlay.hide('zoom');
 }
});
test('desktop and zoom popovers participate in the existing modal native-view gate',()=>{
 const s=fs.readFileSync('mouse/desktops.js','utf8'),browser=fs.readFileSync('mouse/browser.js','utf8');
 assert.match(s,/const tray=document.createElement\('dialog'\)/);assert.match(s,/const box=document.createElement\('dialog'\)/);assert.match(s,/tray\.showModal\(\)/);assert.match(s,/box\.showModal\(\)/);
 assert.match(browser,/dialog\[open\]:not\(\[data-nonmodal\]\)/);assert.doesNotMatch(s,/writeFile|localStorage|sessionStorage|sendBeacon|clipboard/);
});
test('native layout has a bounded fallback and coalesces a burst while RAF is stalled',async()=>{
 const s=fs.readFileSync('mouse/browser.js','utf8'),start=s.indexOf('let frame=0,layoutTimeout=0;'),end=s.indexOf('\n async function layoutNow',start);assert.ok(start>=0&&end>start);
 let calls=0,frames=0;const ctx={requestAnimationFrame:()=>++frames,cancelAnimationFrame(){},setTimeout,clearTimeout,safe:fn=>fn(),layoutNow:()=>calls++};vm.runInNewContext(s.slice(start,end)+';globalThis.layoutProbe=requestLayout',ctx);
 for(let i=0;i<50;i++)ctx.layoutProbe();await new Promise(r=>setTimeout(r,35));assert.equal(calls,1);assert.equal(frames,1);ctx.layoutProbe();await new Promise(r=>setTimeout(r,35));assert.equal(calls,2);
});

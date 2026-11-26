'use strict';
const assert=require('node:assert/strict');
const METER_RGB=[235,40,155],METER_WIDTH=128,METER_HEIGHT=40;
function ownerPage(html,index){
 return html.replace('</body>',`<div id="zoom-meter" style="position:fixed;left:24px;top:180px;width:${METER_WIDTH}px;height:${METER_HEIGHT}px;background:rgb(${METER_RGB});z-index:2" aria-label="Zoom pixel fixture"></div><nav style="position:fixed;left:20px;top:248px;display:grid;gap:10px;z-index:3;background:#f3f0e8;padding:8px"><a id="download-known" href="/download/known" download>Download known file</a><a id="download-unknown" href="/download/unknown" download>Download unknown file</a><a id="download-cancel" href="/download/cancel" download>Download cancellation fixture</a></nav><script>globalThis.mouse633={index:${index},raf:0,clicks:[]};requestAnimationFrame(function tick(){mouse633.raf++;requestAnimationFrame(tick)});for(const link of document.querySelectorAll('a[id^="download-"]'))link.addEventListener('click',event=>mouse633.clicks.push({id:link.id,isTrusted:event.isTrusted,at:Date.now()}));</script></body>`);
}
function colorBounds(bitmap,width,height,color=METER_RGB,tolerance=2){
 assert.equal(bitmap.length,width*height*4);let left=width,top=height,right=-1,bottom=-1,count=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const at=(y*width+x)*4;if(bitmap[at+3]<250||Math.abs(bitmap[at+2]-color[0])>tolerance||Math.abs(bitmap[at+1]-color[1])>tolerance||Math.abs(bitmap[at]-color[2])>tolerance)continue;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;}
 return count?{x:left,y:top,width:right-left+1,height:bottom-top+1,count}:null;
}
function assertRetained(before,after,{scroll=true,advancing=false}={}){
 const keys=['id','index','desk','webContentsId','url','navigationEpoch','identity','timeOrigin','field','cookie'];if(scroll)keys.push('scrollX','scrollY');
 for(const key of keys)assert.deepEqual(after[key],before[key],'Mouse633 retains live page '+key);
 assert.ok(after.ticks>=before.ticks,'Page timer never restarts');assert.ok(after.raf>=before.raf,'Page animation frame counter never restarts');if(advancing)assert.ok(after.raf>before.raf,'The native page animation continues while controls are open');
}
// Serialized into the actual installed renderer. These are passive observers,
// not synthetic events or control handlers.
function installInputProbe(){
 globalThis.__mouse633Input?.dispose();const events=[];let expected=null,selector='';
 const listener=event=>{events.push({type:event.type,trusted:event.isTrusted,matches:!!expected&&(expected===event.target||expected.contains(event.target)),selector,target:event.target.id||event.target.tagName,key:event.key??null,at:Date.now(),x:event.clientX??null,y:event.clientY??null});if(events.length>300)events.shift();};
 for(const type of ['click','input','change','keydown'])document.addEventListener(type,listener,true);
 globalThis.__mouse633Input={begin(value){selector=value;expected=document.querySelector(value);events.length=0;},read(){return events.slice();},dispose(){for(const type of ['click','input','change','keydown'])document.removeEventListener(type,listener,true);delete globalThis.__mouse633Input;}};
}
function downloadReadback(){
 const button=document.querySelector('#downloads-button'),ring=button.querySelector('.mouse-download-ring'),arrow=button.querySelector('.mouse-download-arrow'),badge=button.querySelector('.mouse-download-badge'),style=getComputedStyle(ring),rect=button.getBoundingClientRect(),state=MouseTest.downloadUI.snapshot();
 return{at:Date.now(),state, tasks:MouseTest.downloadUI.tasks(),button:{state:button.dataset.downloadState,active:button.dataset.active==='true',count:Number(button.dataset.downloadCount),indeterminate:button.dataset.indeterminate==='true',percent:Number(button.style.getPropertyValue('--download-progress')),unread:Number(button.dataset.unreadCount),badgeHidden:badge.hidden||getComputedStyle(badge).display==='none',badgeText:badge.textContent,bounce:button.dataset.completionBounce==='true',arrowDisplay:getComputedStyle(arrow).display,animationName:getComputedStyle(arrow).animationName,ringDisplay:style.display,ringDashoffset:style.strokeDashoffset,ringAnimation:style.animationName,reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches,bounds:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}}};
}
function installDownloadProbe(){
 globalThis.__mouse633Downloads?.observer.disconnect();const button=document.querySelector('#downloads-button'),transitions=[];
 const record=()=>{const arrow=button.querySelector('.mouse-download-arrow');transitions.push({at:Date.now(),state:button.dataset.downloadState,bounce:button.dataset.completionBounce==='true',unread:Number(button.dataset.unreadCount),serial:MouseTest.downloadUI.snapshot().completedSerial,animationName:getComputedStyle(arrow).animationName,animations:arrow.getAnimations().map(animation=>({name:animation.animationName,time:animation.currentTime,playState:animation.playState,duration:animation.effect.getComputedTiming().duration}))});if(transitions.length>600)transitions.shift();};
 const observer=new MutationObserver(record);observer.observe(button,{attributes:true,attributeFilter:['data-completion-bounce','data-download-state','data-unread-count','data-download-count']});record();globalThis.__mouse633Downloads={observer,transitions};
}
function settingsReadback(){
 const panel=document.querySelector('#settings-dialog'),gear=document.querySelector('#settings-button'),workspace=document.querySelector('#workspace'),rect=element=>{const r=element.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 return{open:panel.open,nonmodal:panel.dataset.nonmodal==='true'&&!panel.matches(':modal'),inWorkspace:panel.parentElement===workspace,rightmostGear:document.querySelector('#footer-right').lastElementChild===gear,gearCount:document.querySelectorAll('#settings-button').length,gearExpanded:gear.getAttribute('aria-expanded'),panel:rect(panel),workspace:rect(workspace),sections:[...panel.querySelectorAll('[data-settings-section]')].map(element=>({name:element.dataset.settingsSection,hidden:element.hidden,title:element.querySelector('h3')?.textContent})),toggles:[...panel.querySelectorAll('[data-setting]')].map(input=>({key:input.dataset.setting,checked:input.checked,disabled:input.disabled})),selectedPage:panel.querySelector('.settings-nav-item[aria-current="page"]')?.dataset.settingsPage,navigation:[...panel.querySelectorAll('.settings-nav-item')].map(element=>element.dataset.settingsPage),search:panel.querySelector('#settings-search').value,theme:document.documentElement.dataset.theme};
}
module.exports={METER_RGB,METER_WIDTH,METER_HEIGHT,ownerPage,colorBounds,assertRetained,installInputProbe,downloadReadback,installDownloadProbe,settingsReadback};

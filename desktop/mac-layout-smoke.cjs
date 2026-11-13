'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,label){for(let i=0;i<150;i++){if(await check())return;await sleep(100)}throw Error('Layout timeout: '+label)}
module.exports=async({win,webContents,origin})=>{
 const js=source=>win.webContents.executeJavaScript(source);
 const click=action=>js(`document.querySelector('[data-action="${action}"]').click()`);
 const records=[];
 for(let i=0;i<6;i++){
  const url=origin+'/layout-'+i;
  const tab=await js(`OSMINOGNative.browser('open',{url:${JSON.stringify(url)}})`);
  let wc;
  await until(()=>{wc=webContents.getAllWebContents().find(w=>w.getURL()===url);return !!wc&&!wc.isLoading()},'fixture load');
  await wc.executeJavaScript(`globalThis.macRetainedValue=${JSON.stringify('retained-'+i)}`);
  records.push({id:tab.id,url,wc,wcid:wc.id});
 }
 const measure=()=>js(`(()=>{const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right}};return{width:innerWidth,layout:Number(document.querySelector('#app').dataset.layout),terminal:rect(document.querySelector('.terminal')),aiHidden:document.querySelector('#ai-panel').hidden,walletHidden:document.querySelector('#wallet-panel').hidden,slots:[...document.querySelectorAll('.native-slot[data-slot]')].map(e=>({id:e.dataset.slot,...rect(e)}))}})()`);
 async function geometry(count,closed){
  let observed;
  await until(async()=>{
   const m=await measure();observed=m;
   if(m.layout!==count||m.slots.length!==count||m.aiHidden!==closed)return false;
   if(closed&&Math.abs(m.terminal.right-m.width)>1)return false;
   if(!closed&&m.width-m.terminal.right<250)return false;
   const visible=win.contentView.children.filter(v=>v.webContents&&!v.webContents.isDestroyed()&&v.getVisible()&&records.some(r=>r.wcid===v.webContents.id));
   if(visible.length!==count)return false;
   for(const slot of m.slots){
    const record=records.find(r=>r.id===slot.id),view=visible.find(v=>v.webContents.id===record?.wcid);
    if(!view)return false;
    const b=view.getBounds();
    if(['x','y','width','height'].some(k=>Math.abs(b[k]-slot[k])>2))return false;
   }
   if(closed&&Math.abs(Math.max(...visible.map(v=>{const b=v.getBounds();return b.x+b.width}))-m.width)>2)return false;
   return true;
  },`${count} panes, closed=${closed}; native bounds must follow the full-width DOM`);
  return observed;
 }
 for(const width of [1440,1100,900]){
  win.setContentSize(width,850);
  await until(async()=>Math.abs((await measure()).width-width)<2,'window resize');
  for(const count of [1,2,4,6]){
   for(let n=0;n<4&&(await measure()).layout!==count;n++){await click('layout');await sleep(50)}
   if((await measure()).aiHidden)await click('ai');
   const before=await geometry(count,false);
   await click('close-ai');
   const expanded=await geometry(count,true);
   assert.ok(expanded.terminal.width>before.terminal.width+250);
   assert.deepEqual(expanded.slots.map(s=>s.id),before.slots.map(s=>s.id));
   if(width===1440&&count===2)await fs.writeFile('mac-layout-smoke-fullwidth.png',(await win.webContents.capturePage()).toPNG());
   await click('ai');const restored=await geometry(count,false);
   assert.ok(Math.abs(restored.terminal.width-before.terminal.width)<2);
   await click('ai');await geometry(count,true);
   await click('ai');await geometry(count,false);
   console.log(`MAC_FULLWIDTH_LAYOUT_PASS width=${width} panes=${count} close-button=pass toggle=pass reopen=pass native-bounds=pass`);
  }
 }
 // A visible wallet must still retain its own column. Once both panels are hidden, fill it.
 await click('wallet');
 await until(async()=>{const m=await measure();return m.aiHidden&&!m.walletHidden&&m.width-m.terminal.right>250},'wallet column retained');
 await click('wallet');await geometry(6,true);
 for(let i=0;i<records.length;i++){
  const r=records[i];assert.equal(r.wc.id,r.wcid);assert.equal(r.wc.isDestroyed(),false);
  assert.equal(await r.wc.executeJavaScript('globalThis.macRetainedValue'),'retained-'+i,'Tab reloaded while toggling AI');
 }
 console.log('MAC_FULLWIDTH_NO_RELOAD_PASS');
 for(const r of records)await js(`OSMINOGNative.browser('close',{id:${JSON.stringify(r.id)}})`);
 await click('ai');win.setContentSize(1440,900);
 console.log('MAC_FULLWIDTH_SMOKE_PASS');
};

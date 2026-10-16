'use strict';
const {providerFor}=require('./page-context.cjs');
function update(browser,tab,payload){
 const id=tab?.id||'@canvas',project=browser.project;
 if(!project||!browser.pointerEnabled||browser.contextScope&&!browser.contextScope.includes(id)||tab&&(tab.project!==project||tab.ephemeral||providerFor(tab.view.webContents.getURL())))return{ok:false};
 if(payload?.kind==='invalidate'){if(browser.pointerTarget?.id===id)browser.pointerTarget=null;return{ok:true}}
 const point=payload?.point,viewport=payload?.viewport;
 if(!point||!viewport||![point.x,point.y,viewport.width,viewport.height].every(Number.isFinite)||viewport.width<1||viewport.height<1||viewport.width>16000||viewport.height>16000||point.x<0||point.y<0||point.x>viewport.width||point.y>viewport.height)return{ok:false};
 if(!['move','clear','region'].includes(payload.kind))return{ok:false};
 const cursor={id,project,point,viewport,at:Date.now()};browser.pointerCursor=cursor;
 if(payload.kind==='move')return{ok:true};
 const r=payload.region;
 if(payload.kind==='region'&&(!r||![r.x,r.y,r.width,r.height].every(Number.isFinite)||r.x<0||r.y<0||r.width<3||r.height<3||r.x+r.width>viewport.width+1||r.y+r.height>viewport.height+1))return{ok:false};
 browser.pointerTarget={...cursor,region:payload.kind==='region'?{x:r.x,y:r.y,width:r.width,height:r.height}:null,url:tab?.view.webContents.getURL()||'',epoch:tab?.navigationEpoch||0,element:{tag:String(payload.element?.tag||'').slice(0,40),label:String(payload.element?.label||'').slice(0,200)}};
 return{ok:true};
}
function current(browser){const t=browser.pointerTarget;if(!browser.pointerEnabled||!t||t.project!==browser.project||browser.contextScope&&!browser.contextScope.includes(t.id))return null;if(t.id!=='@canvas'){let tab;try{tab=browser.get(t.id)}catch{return null}if(tab.view.webContents.getURL()!==t.url||(tab.navigationEpoch||0)!==t.epoch)return null}return structuredClone(t)}
async function capture(browser){const t=current(browser);if(!t?.region)return null;const rect=Object.fromEntries(Object.entries(t.region).map(([k,v])=>[k,Math.round(v)]));const image=t.id==='@canvas'?await require('./capture-window.cjs').captureWindow(browser.win,rect):await browser.get(t.id).view.webContents.capturePage(rect);if(JSON.stringify(current(browser))!==JSON.stringify(t))throw Error('Выделенная область изменилась');return{name:'selected-region.png',dataUrl:image.toDataURL()}}
module.exports={update,current,capture};

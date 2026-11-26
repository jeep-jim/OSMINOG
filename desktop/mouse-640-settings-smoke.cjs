'use strict';
// This runs inside the installed two-process feature acceptance. Navigation and
// search use exposed controls, while full-display captures retain their native
// crop/hash records in the same evidence ledger as the existing feature gates.
const assert=require('node:assert/strict');
const PAGES=['overview','appearance','workspace','privacy','imports','capture','downloads','documents','about'];
function readback(){
 const panel=document.querySelector('#settings-dialog'),main=panel.querySelector('.settings-main'),sidebar=panel.querySelector('.settings-sidebar'),input=panel.querySelector('[data-setting="blockAds"]');
 const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
 const visible=e=>!!e&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0&&getComputedStyle(e).visibility!=='hidden';
 const surface=e=>{const s=getComputedStyle(e);return{backgroundColor:s.backgroundColor,backgroundImage:s.backgroundImage,backdropFilter:s.backdropFilter,color:s.color};};
 const bounds=rect(input),hit=document.elementFromPoint(bounds.x+bounds.width/2,bounds.y+bounds.height/2),label=input.closest('label'),style=getComputedStyle(label);
 return{open:panel.open,theme:document.documentElement.dataset.theme,query:panel.querySelector('#settings-search').value,
  selectedPage:panel.querySelector('.settings-nav-item[aria-current="page"]')?.dataset.settingsPage||'',title:panel.querySelector('#settings-page-title').textContent,
  panel:rect(panel),main:{...rect(main),scrollWidth:main.scrollWidth,clientWidth:main.clientWidth,scrollTop:main.scrollTop},sidebar:rect(sidebar),surface:surface(panel),toolbar:surface(document.querySelector('.toolbar')),
  sections:[...panel.querySelectorAll('[data-settings-section]')].map(e=>({id:e.dataset.settingsSection,pages:e.dataset.pages,hidden:e.hidden,visible:visible(e)})),
  navigation:[...panel.querySelectorAll('.settings-nav-item')].map(e=>{const icon=e.querySelector('.settings-icon'),svg=icon?.querySelector('svg');return{id:e.dataset.settingsPage,current:e.getAttribute('aria-current'),label:e.querySelector('.settings-nav-label')?.textContent,icon:{tone:icon?.dataset.tone,viewBox:svg?.getAttribute('viewBox'),paths:svg?.children.length||0,background:icon?getComputedStyle(icon).backgroundImage:'none',bounds:icon?rect(icon):null},bounds:rect(e)};}),
  adblock:{visible:visible(input),bounds,receivesPoint:hit===input,checked:input.checked,disabled:input.disabled,label:label.textContent.trim(),fontSize:parseFloat(style.fontSize),state:panel.querySelector('#settings-blockads-label').textContent.trim(),status:panel.querySelector('#settings-adblock-state').textContent.trim()},
  emptyVisible:visible(panel.querySelector('#settings-empty')),clearVisible:visible(panel.querySelector('#settings-search-clear')),focused:document.activeElement?.id||''};
}
function visibleSections(value){return value.sections.filter(row=>!row.hidden).map(row=>row.id);}
function assertBase(value){
 assert.equal(value.open,true);assert.ok(value.main.clientWidth>180);assert.ok(value.main.scrollWidth<=value.main.clientWidth+1,'Settings content has no horizontal overflow');
 assert.deepEqual(value.navigation.map(row=>row.id),PAGES);assert.ok(new Set(value.navigation.map(row=>row.icon.tone)).size>=6,'Navigation has distinct colored vector icons');
 for(const row of value.navigation){assert.equal(row.icon.viewBox,'0 0 24 24');assert.ok(row.icon.paths>0);assert.ok(row.label?.trim());assert.match(row.icon.background,/gradient/);}
 const blur=value.surface.backdropFilter.match(/blur\(([0-9.]+)px\)/);assert.ok(blur&&Number(blur[1])>=16);assert.notEqual(value.surface.backgroundColor,value.toolbar.backgroundColor);
}
function assertOverview(value){
 assertBase(value);assert.equal(value.selectedPage,'overview');assert.equal(value.query,'');assert.deepEqual(visibleSections(value),['privacy','overview-links']);
 assert.equal(value.adblock.visible,true);assert.equal(value.adblock.receivesPoint,true);assert.ok(value.adblock.bounds.width>=44&&value.adblock.bounds.height>=24,'Real advertisement switch is a large exposed input');assert.ok(value.adblock.state.length>0);assert.ok(value.adblock.fontSize>=12);
 const b=value.adblock.bounds,m=value.main;assert.ok(b.x>=m.x&&b.y>=m.y&&b.x+b.width<=m.x+m.width+1&&b.y+b.height<=m.y+m.height+1,'AdBlock is visible without scrolling');assert.equal(value.main.scrollTop,0);
}
module.exports=async function settingsAcceptance({win,fixture,click,text,capture,theme,facts}){
 const report={schema:1,version:'6.0.40',source:'Installed app, trusted native controls and actual OS captures',samples:[],ok:false};facts.settings640=report;
 const originalWidth=await fixture.js('MouseTest.model.settingsWidth');
 const read=()=>fixture.js('('+readback.toString()+')()');
 async function select(page){const input=await click('#settings-dialog .settings-nav-item[data-settings-page="'+page+'"]');await fixture.until(()=>fixture.js(`document.querySelector('.settings-nav-item[aria-current="page"]')?.dataset.settingsPage===${JSON.stringify(page)}`),'visible640 category '+page);return{page,input,readback:await read()};}
 async function search(query){const input={selector:'#settings-search',source:'webContents.sendInputEvent and insertText after native focus',...await text('#settings-search',query)};await fixture.frame();return{query,input,readback:await read()};}
 try{
  for(const color of ['light','dark']){
   await theme(color);const openInput=await click('#settings-button');await fixture.until(()=>fixture.js('document.querySelector("#settings-dialog").open'),'640 Settings opens');
   const sample={theme:color,openInput,overview:await read(),navigation:[],search:[],captures:{}};report.samples.push(sample);assertOverview(sample.overview);
   sample.captures.overview=(await capture('mouse-637-settings-overview-'+color+'.png')).filename;
   for(const page of PAGES.slice(1)){const state=await select(page);assertBase(state.readback);assert.equal(state.readback.query,'');assert.ok(state.readback.sections.some(row=>row.pages.split(' ').includes(page)&&!row.hidden));assert.ok(state.readback.sections.every(row=>row.hidden||row.pages.split(' ').includes(page)));sample.navigation.push(state);}
   sample.appearance=await select('appearance');sample.captures.appearance=(await capture('mouse-637-settings-appearance-'+color+'.png')).filename;
   const adblock=await search('AdBlock');sample.search.push(adblock);assert.deepEqual(visibleSections(adblock.readback),['privacy']);assert.equal(adblock.readback.adblock.receivesPoint,true);assert.equal(adblock.readback.clearVisible,true);
   const empty=await search('mouse-no-such-setting-640');sample.empty=empty;assert.deepEqual(visibleSections(empty.readback),[]);assert.equal(empty.readback.emptyVisible,true);
   sample.clearInput=await click('#settings-search-clear');sample.cleared=await read();assert.equal(sample.cleared.selectedPage,'appearance');assert.equal(sample.cleared.query,'');assert.equal(sample.cleared.emptyVisible,false);assert.equal(sample.cleared.focused,'settings-search');
   await fixture.js('MouseTest.model.settingsWidth=420;MouseTest.applySide();true');await fixture.frame();sample.narrowSelection=await select('overview');sample.narrow=sample.narrowSelection.readback;assertOverview(sample.narrow);assert.ok(sample.narrow.panel.width<=421);assert.ok(sample.narrow.sidebar.y<sample.narrow.main.y,'Compact navigation moves above the setting groups');
   sample.captures.narrow=(await capture('mouse-637-settings-narrow-'+color+'.png')).filename;
   await fixture.js(`MouseTest.model.settingsWidth=${JSON.stringify(originalWidth)};MouseTest.applySide();true`);await fixture.frame();sample.wide=await read();assertOverview(sample.wide);
   sample.closeInput=await click('#settings-dialog [data-close-dialog]');await fixture.until(()=>fixture.js('!document.querySelector("#settings-dialog").open'),'640 Settings closes');sample.closed=await fixture.js('({open:document.querySelector("#settings-dialog").open,focused:document.activeElement?.id})');assert.equal(sample.closed.focused,'settings-button');
  }
  report.ok=true;
 }finally{
  await fixture.js(`MouseTest.model.settingsWidth=${JSON.stringify(originalWidth)};MouseTest.settingsUI.close();MouseTest.applySide();true`);
 }
 return report;
};
module.exports.fixtures={readback,assertBase,assertOverview,visibleSections,PAGES};

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const loaded={exports:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'mouse-636-agent-smoke.cjs'),'utf8'),{module:loaded,require:name=>name.startsWith('node:')?require(name):{}},{filename:'mouse-636-agent-smoke.cjs'});
const {assertOwnedPages,assertInlineView,assertLiveTransition,CAPTURES}=loaded.exports;
const plain=value=>JSON.parse(JSON.stringify(value));
const box=(x,y,width,height)=>({x,y,width,height,clientWidth:width,scrollWidth:width});
function ui(settings=false){return{panelHidden:false,view:settings?'settings':'chat',settingsOpen:settings,settingsTag:'section',settingsParent:'agent-panel',settingsPosition:'static',modals:[],settingsRole:null,settingsAriaModal:null,gearExpanded:String(settings),
 panel:box(700,46,300,600),header:box(700,46,300,90),chat:box(700,136,300,510),chatScroll:box(700,136,300,420),composer:box(710,570,280,54),settings:box(700,136,300,510),settingsHeader:box(700,136,300,58),settingsContent:box(700,194,300,396),settingsFooter:box(700,590,300,56),chatVisible:!settings,composerVisible:!settings,settingsVisible:settings,backVisible:settings,doneVisible:settings,controlsHidden:!settings,input:'Сохранённый черновик',selection:{start:2,end:8,direction:'backward'},focus:settings?'agent-endpoint':'agent-task-input'};}
function fixture(){
 const before={ui:ui(),blocked:false,surfaceHeld:false,gateSequence:7,native:[1,2].map(id=>({tabId:'tab'+id,webContentsId:id,visible:true,parentVisible:true,cachedVisible:true,attached:true,bounds:{x:(id-1)*340,y:75,width:330,height:570}})),identities:[1,2].map(id=>({id:'tab'+id,webContentsId:id,timeOrigin:123+id,field:'native typed text',scrollY:130+id,cookie:'fixture='+id,ticks:10}))};
 const settings=structuredClone(before),after=structuredClone(before);settings.ui=ui(true);settings.identities.forEach(page=>page.ticks++);after.identities.forEach(page=>page.ticks+=2);
 const identity=(first,next)=>{for(const key of Object.keys(first).filter(k=>k!=='ticks'))assert.deepEqual(next[key],first[key]);assert.ok(next.ticks>=first.ticks);};return{before,settings,after,identity};
}
test('636 inline acceptance keeps native ownership, draft, caret and focus while settings is inside the same panel',()=>{
 const f=fixture();assert.doesNotThrow(()=>assertLiveTransition(f.before,f.settings,f.after,f.identity));assertInlineView(f.settings.ui,true);assertInlineView(f.after.ui,false);
});
test('636 inline acceptance refuses a modal, overlay, wrong page or any sidebar cutoff',()=>{
 for(const alter of [u=>u.modals.push('agent-settings-dialog'),u=>{u.settingsTag='dialog';},u=>{u.settingsRole='dialog';},u=>{u.settingsAriaModal='true';},u=>{u.settingsPosition='fixed';},u=>{u.settingsPosition='absolute';},u=>{u.settingsParent='workspace';},u=>{u.view='chat';},u=>{u.composerVisible=true;},u=>{u.backVisible=false;},u=>{u.settingsContent.scrollWidth=302;},u=>{u.settingsFooter.y++;u.settingsFooter.height++;},u=>{u.settingsHeader.x=699-1;}]){
  const value=ui(true);alter(value);assert.throws(()=>assertInlineView(value,true));
 }
});
test('636 inline acceptance refuses transient modal publications, detached pages and lost draft or selection',()=>{
 for(const alter of [f=>{f.settings.blocked=true;},f=>{f.settings.surfaceHeld=true;},f=>{f.settings.gateSequence+=2;},f=>{f.after.gateSequence++;},f=>{f.settings.native[0].attached=false;},f=>{f.settings.native[0].visible=false;},f=>{f.after.native[0].bounds.width--;},f=>{f.after.identities[1].webContentsId++;},f=>{f.after.identities[1].scrollY--;},f=>{f.settings.ui.input='';},f=>{f.after.ui.selection.end++;},f=>{f.after.ui.focus='agent-settings-open';},f=>{f.settings.ui.panel.height--;}]){
  const f=fixture();alter(f);assert.throws(()=>assertLiveTransition(f.before,f.settings,f.after,f.identity));
 }
});
test('636 inline acceptance refuses a collapsed draft selection even when navigation preserves it unchanged',()=>{
 const f=fixture();for(const stage of ['before','settings','after'])f[stage].ui.selection={start:f[stage].ui.input.length,end:f[stage].ui.input.length,direction:'forward'};
 assert.throws(()=>assertLiveTransition(f.before,f.settings,f.after,f.identity),/actual native selection before settings navigation/);
 for(const stage of ['before','settings','after']){f[stage].ui.input='';f[stage].ui.selection={start:0,end:0,direction:'forward'};}
 assert.doesNotThrow(()=>assertLiveTransition(f.before,f.settings,f.after,f.identity),'Initial empty conversation still supports model setup');
});
test('636 acceptance requires two live pages before navigation, not a restored empty sidebar',()=>{
 const f=fixture();for(const key of ['visible','parentVisible','cachedVisible','attached']){const value=structuredClone({before:f.before,settings:f.settings,after:f.after});value.before.native[0][key]=false;value.settings.native=value.before.native;value.after.native=value.before.native;assert.throws(()=>assertLiveTransition(value.before,value.settings,value.after,f.identity));}
 const noPages=fixture();for(const key of ['before','settings','after'])noPages[key].native=[];assert.throws(()=>assertLiveTransition(noPages.before,noPages.settings,noPages.after,noPages.identity));
});
test('636 canonical Agent captures cover chat and inline settings in both themes at 400 and 300 pixels',()=>{
 assert.deepEqual(plain(CAPTURES),['dark-400','light-400','dark-300','light-300'].flatMap(name=>['mouse-636-agent-chat-'+name+'.png','mouse-636-agent-settings-'+name+'.png']));assert.equal(new Set(CAPTURES).size,8);
});
test('636 owned pages require the actual cookie at its matching document path before retention checks',()=>{
 const root='http://127.0.0.1:32456',pages=[201,202].map(index=>({index,url:root+'/page/'+index+'/',identity:'page-'+index,cookie:'mouse631_'+index+'=page-'+index}));assert.doesNotThrow(()=>assertOwnedPages(pages,root));
 for(const alter of [p=>{p.cookie='';},p=>{p.cookie='mouse631_202=page-202';},p=>{p.identity='';},p=>{p.url=p.url.slice(0,-1);},p=>{p.url=p.url.replace('32456','32457');}]){const value=structuredClone(pages);alter(value[0]);assert.throws(()=>assertOwnedPages(value,root));}
});

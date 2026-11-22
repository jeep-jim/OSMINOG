'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Modes=require('./mouse/modes.js'),L=require('./mouse/layout.js');

function rectangles(tree,box={x:0,y:0,width:1,height:1},out={}){
 if(tree.id){out[tree.id]=box;return out;}
 if(tree.axis==='x'){
  rectangles(tree.a,{...box,width:box.width*tree.ratio},out);rectangles(tree.b,{...box,x:box.x+box.width*tree.ratio,width:box.width*(1-tree.ratio)},out);
 }else{
  rectangles(tree.a,{...box,height:box.height*tree.ratio},out);rectangles(tree.b,{...box,y:box.y+box.height*tree.ratio,height:box.height*(1-tree.ratio)},out);
 }
 return out;
}
const near=(value,expected)=>assert.ok(Math.abs(value-expected)<1e-12,value+' differs from '+expected);
const page=(id,url,extra={})=>({id,url,lane:'main',...extra});

test('Content reproduces the requested six-column two-row site order with twelve usable panes',()=>{
 const mode=Modes.get('content'),bounds=rectangles(mode.tree),ids=L.leaves(mode.tree);L.validate(mode.tree);assert.equal(ids.length,12);assert.equal(mode.sites.length,12);
 const rows=[['www.instagram.com','www.tiktok.com','x.com','www.reddit.com','web.telegram.org','web.whatsapp.com'],['www.twitch.tv','www.youtube.com','www.facebook.com','www.threads.com','web.wechat.com','web.max.ru']];
 for(let column=0;column<6;column++)for(let row=0;row<2;row++){
  const index=column*2+row,rect=bounds[ids[index]];near(rect.x,column/6);near(rect.y,row/2);near(rect.width,1/6);near(rect.height,.5);
  assert.equal(new URL(mode.sites[index]).hostname,rows[row][column]);
 }
});

test('Support has four web chat apps at left and one full-height Maps pane; Trader keeps its chart dominant',()=>{
 const support=Modes.get('support'),supportRects=rectangles(support.tree),ids=L.leaves(support.tree);assert.equal(ids.length,5);assert.equal(support.sites.length,5);
 assert.deepEqual(support.sites,['https://web.telegram.org/k/','https://web.whatsapp.com/','https://web.max.ru/','https://web.wechat.com/','https://www.google.com/maps/']);
 for(const id of ids.slice(0,4)){near(supportRects[id].width,.32);near(supportRects[id].height,.5);assert.ok(supportRects[id].x<.64);}
 near(supportRects.p5.x,.64);near(supportRects.p5.width,.36);near(supportRects.p5.height,1);
 const trader=Modes.get('trader'),traderRects=rectangles(trader.tree);assert.equal(L.leaves(trader.tree).length,4);
 assert.deepEqual(trader.sites,['https://www.tradingview.com/chart/','https://www.investing.com/economic-calendar/','https://finviz.com/','https://coinmarketcap.com/']);
 near(traderRects.p1.height,1);near(traderRects.p1.width,.66);for(const id of ['p2','p3','p4']){near(traderRects[id].width,.34);near(traderRects[id].height,1/3);}
 for(const mode of Modes.modes){assert.equal(L.leaves(L.validate(mode.tree)).length,mode.sites.length);assert.ok(mode.sites.length<=L.LIMIT);}
});

test('preset planning reuses same-desktop matching pages and preserves unrelated main, document, and side page objects',()=>{
 const support=Modes.get('support'),unrelated=page('work','https://owned.example/work'),whatsapp=page('whatsapp',support.sites[1]),chat=page('ai','https://chat.example/',{lane:'side'}),document=page('document','mouse://document/owned',{internal:true,documentId:'owned'}),tabs=[unrelated,whatsapp,chat,document],before=structuredClone(tabs);
 const previous={slots:{p1:unrelated.id},active:'p1',tabOrder:['document','work','whatsapp','ai'],aiOpen:true,aiId:'ai',aiSessions:{'https://chat.example/':'ai'}},plan=Modes.plan('support',tabs,previous);
 assert.equal(plan.selectedIds[1],'whatsapp');assert.equal(plan.missing.length,4);assert.ok(plan.missing.every(item=>item.index!==1));assert.equal(plan.layout.slots.p2,'whatsapp');
 assert.equal(plan.layout.aiOpen,false);assert.equal(Object.hasOwn(plan.layout,'agentOpen'),false);assert.equal(plan.layout.aiId,'ai');assert.deepEqual(plan.layout.aiSessions,previous.aiSessions);
 assert.ok(plan.layout.tabOrder.includes('work'));assert.ok(plan.layout.tabOrder.includes('document'));assert.equal(plan.layout.tabOrder.filter(id=>id==='whatsapp').length,1);
 assert.deepEqual(tabs,before);assert.equal(tabs[0],unrelated);assert.equal(tabs[1],whatsapp);assert.equal(tabs[2],chat);assert.equal(tabs[3],document);assert.deepEqual(previous.slots,{p1:'work'});
 const selectedIds=[...plan.selectedIds],opened=plan.missing.map(({index,url})=>{const item=page('new-'+index,url);selectedIds[index]=item.id;return item;}),result=Modes.arranged('support',[...tabs,...opened],previous,{selectedIds});
 assert.deepEqual(Object.values(result.slots),selectedIds);assert.deepEqual(result.presetTabs.support,selectedIds);assert.ok(result.tabOrder.includes('work')&&result.tabOrder.includes('document'));
});

test('remembered preset identities survive login redirects and mode cycles without reopening or navigating them',()=>{
 const tabs=Modes.get('support').sites.map((url,index)=>page('support-'+index,url)),initial=Modes.arranged('support',tabs,{}, {selectedIds:tabs.map(item=>item.id)});
 tabs[0].url='https://web.telegram.org/k/#saved-chat';tabs[1].url='https://owned-sign-in.example/continue';
 let plan=Modes.plan('support',tabs,initial);assert.equal(plan.missing.length,0);assert.deepEqual(plan.selectedIds,tabs.map(item=>item.id));
 const contentPlan=Modes.plan('content',tabs,initial),selectedIds=[...contentPlan.selectedIds];assert.equal(contentPlan.missing.length,8,'Four chat apps are shared, including redirected pages');assert.equal(selectedIds[8],tabs[0].id);assert.equal(selectedIds[10],tabs[1].id);for(const {index,url}of contentPlan.missing){const item=page('content-'+index,url);tabs.push(item);selectedIds[index]=item.id;}
 const content=Modes.arranged('content',tabs,initial,{selectedIds});assert.deepEqual(content.presetTabs.support,initial.presetTabs.support);
 plan=Modes.plan('support',tabs,content);assert.equal(plan.missing.length,0);assert.deepEqual(plan.selectedIds,initial.presetTabs.support);
});

test('closed and foreign remembered pages become missing; duplicate or side/document placement cannot produce an accepted preset',()=>{
 const known=page('known',Modes.get('support').sites[0]),tabs=[known,page('ai','https://chat.example/',{lane:'side'}),page('doc','mouse://document/test',{documentId:'test'})];
 const previous={presetTabs:{support:['known','foreign','closed','ai','doc']},agentPreviewId:'foreign'},plan=Modes.plan('support',tabs,previous);
 assert.deepEqual(plan.selectedIds,['known','','','','']);assert.equal(plan.missing.length,4);assert.deepEqual(plan.layout.presetTabs.support,['known','','','','']);assert.equal(Object.hasOwn(plan.layout,'agentPreviewId'),false);
 for(const selectedIds of [['known','known','','',''],['known','ai','','',''],['known','doc','','',''],['foreign','','','','']])assert.throws(()=>Modes.arranged('support',tabs,previous,{selectedIds}),/недоступна/);
 assert.throws(()=>Modes.arranged('support',tabs,previous,{selectedIds:['known']}),/Неполный/);assert.throws(()=>Modes.plan('missing',tabs,previous),/Неизвестный/);
});

test('the removed mode cannot open pages and remaining presets discard its metadata while preserving all page identities',()=>{
 const ordinaryStart=page('ordinary-start','mouse://start',{internal:true}),work=page('work','http://127.0.0.1:5173/editor'),chat=page('chat','https://chat.example/',{lane:'side'}),tabs=[ordinaryStart,work,chat],before=structuredClone(tabs);
 const previous={mode:'agents',agentOpen:true,agentPreviewId:work.id,presetTabs:{agents:[work.id]},slots:{p1:work.id},tabOrder:[work.id,ordinaryStart.id,chat.id],aiOpen:true,aiId:chat.id},saved=structuredClone(previous);
 assert.deepEqual(Modes.modes.map(mode=>mode.id),['trader','support','design','content']);assert.throws(()=>Modes.plan('agents',tabs,previous),/Неизвестный/);
 const next=Modes.plan('support',tabs,previous).layout;assert.equal(Object.hasOwn(next,'agentOpen'),false);assert.equal(Object.hasOwn(next,'agentPreviewId'),false);assert.equal(Object.hasOwn(next.presetTabs,'agents'),false);
 assert.equal(next.aiId,chat.id);for(const id of [ordinaryStart.id,work.id])assert.ok(next.tabOrder.includes(id));assert.deepEqual(tabs,before);assert.deepEqual(previous,saved);assert.equal(tabs[0],ordinaryStart);assert.equal(tabs[1],work);assert.equal(tabs[2],chat);
});

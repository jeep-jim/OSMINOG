'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {assertRouting,assertReturnedGrid,assertInterceptedChatNavigation}=require('./mouse-641-ai-link-routing.cjs');
const sample=()=>{const beforeGrid={classicTabId:'',view:'grid',tree:{axis:'x',ratio:.5,a:{id:'p1'},b:{id:'p2'}},slots:{p1:'first',p2:'second'},aiId:'chat',previewId:'',panes:[{id:'p1',view:'grid'},{id:'p2',view:'grid'}],returnVisible:false},url='https://owned.test/page/3/';return{beforeGrid,state:{...structuredClone(beforeGrid),classicTabId:'linked',view:'classic',panes:[{id:'p0',view:'classic'}],returnVisible:true},returnedGrid:structuredClone(beforeGrid),url,selector:'#owned-link',chatBefore:{id:'chat',webContentsId:80},input:{selector:'#owned-link',tabId:'chat',webContentsId:80,events:[{type:'pointerdown',id:'owned-link',href:url,trusted:true,isTrusted:true,matches:true,button:0,pointerType:'mouse'}]},tab:{id:'linked',lane:'main',previewOf:'',url,webContentsId:81}};};
test('retained AI link evidence binds a new ordinary tab to the actual classic DOM and unchanged saved grid',()=>{
 const value=sample();assertRouting(value);assertReturnedGrid(value);
 for(const change of [v=>v.tab.lane='side',v=>v.tab.previewOf='chat',v=>v.tab.url='https://other.test/',v=>v.tab.webContentsId=0,v=>v.state.classicTabId='other',v=>v.state.view='grid',v=>v.state.panes=[{id:'p1',view:'classic'}],v=>v.state.panes=[{id:'p0',view:'grid'}],v=>v.state.panes.push({id:'p2',view:'grid'}),v=>v.state.returnVisible=false,v=>v.state.slots.p1='linked',v=>v.state.tree.ratio=.7,v=>v.state.aiId='other',v=>v.state.previewId='linked']){const wrong=sample();change(wrong);assert.throws(()=>assertRouting(wrong));}
});
test('isolated link evidence requires a trusted pointerdown on the exact source anchor before the new-tab result',()=>{
 for(const change of [v=>v.input.events=[],v=>v.input.selector='#other',v=>v.input.tabId='other',v=>v.input.webContentsId=81,v=>v.input.events[0].type='click',v=>v.input.events[0].id='other',v=>v.input.events[0].href='https://other.test/',v=>v.input.events[0].trusted=false,v=>v.input.events[0].isTrusted=false,v=>v.input.events[0].matches=false,v=>v.input.events[0].button=1,v=>v.input.events[0].pointerType='touch']){const wrong=sample();change(wrong);assert.throws(()=>assertRouting(wrong));}
});
test('isolated source-link interception starts no WebContents navigation and preserves the navigation epoch',()=>{
 const before={id:'chat',webContentsId:80,url:'https://chat.test/',navigationEpoch:3},witness={tabId:'chat',webContentsId:80,events:[]};let compared=false;
 assertInterceptedChatNavigation(before,{...before},witness,(a,b)=>{compared=true;assert.deepEqual(a,b);});assert.equal(compared,true);
 assert.throws(()=>assertInterceptedChatNavigation(before,{...before,navigationEpoch:4},witness,assert.deepEqual));
 assert.throws(()=>assertInterceptedChatNavigation(before,before,{...witness,events:[{type:'did-start-navigation'}]},assert.deepEqual));
 assert.throws(()=>assertInterceptedChatNavigation(before,{...before,url:'https://other.test/'},witness,assert.deepEqual));
});
test('return-to-grid evidence rejects a hidden model-only restoration, missing pane or changed grid assignment',()=>{
 for(const change of [v=>v.returnedGrid.classicTabId='linked',v=>v.returnedGrid.view='classic',v=>v.returnedGrid.returnVisible=true,v=>v.returnedGrid.slots.p2='linked',v=>v.returnedGrid.tree.ratio=.7,v=>v.returnedGrid.panes.pop(),v=>v.returnedGrid.panes[0].view='classic',v=>v.returnedGrid.aiId='',v=>v.returnedGrid.previewId='linked']){const wrong=sample();change(wrong);assert.throws(()=>assertReturnedGrid(wrong));}
});

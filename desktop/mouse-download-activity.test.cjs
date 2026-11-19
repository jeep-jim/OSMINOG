'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{DownloadActivity,VISIBLE_MS}=require('./mouse-download-activity.cjs');
const row=(changes={})=>({id:'fixture',filename:'drawing.png',received:0,total:1000,state:'progressing',url:'https://private.example/file',path:'/private/Downloads/drawing.png',...changes});
test('native download activity follows actual lifecycle and bytes, without persisting URLs or paths',()=>{
 let now=100;const service=new DownloadActivity({now:()=>now});service.start(row(),{tabId:'owner-tab',desk:'desk-a'});
 let value=service.snapshot().items[0];assert.equal(value.state,'started');assert.equal(value.tabId,'owner-tab');assert.equal(value.desk,'desk-a');assert.equal('url'in value,false);assert.equal('path'in value,false);
 now=200;service.update('fixture',row({received:235}));value=service.snapshot().items[0];assert.equal(value.state,'downloading');assert.equal(value.received,235);assert.equal(value.updatedAt,200);
 service.update('fixture',row({received:235,state:'paused'}));assert.equal(service.snapshot().items[0].state,'paused');
 service.update('fixture',row({received:1000}));assert.equal(service.snapshot().items[0].state,'downloading','Receiving all bytes does not manufacture DownloadItem.done');
 service.update('fixture',row({received:1000,state:'completed'}),{done:true});value=service.snapshot().items[0];assert.equal(value.state,'completed');assert.equal(value.expiresAt,now+VISIBLE_MS.completed);
 now=value.expiresAt;assert.deepEqual(service.snapshot().items,[]);
});
test('cancelled and failed transfers retain partial bytes and never become completed',()=>{
 let now=10;for(const [nativeState,state]of [['cancelled','cancelled'],['interrupted','error']]){const service=new DownloadActivity({now:()=>now});service.start(row({total:0}));service.update('fixture',row({received:55,total:0,state:nativeState}),{done:true});const item=service.snapshot().items[0];assert.equal(item.state,state);assert.equal(item.received,55);assert.equal(item.total,0);assert.equal(item.expiresAt,now+VISIBLE_MS[state]);now=item.expiresAt-1;assert.equal(service.snapshot().items.length,1);now++;assert.equal(service.snapshot().items.length,0);}
});
test('activity snapshots are isolated by browser session, copied on read, and explicitly cleared',()=>{
 const normal=new DownloadActivity(),privateDownloads=new DownloadActivity({privateMode:true});normal.start(row({id:'normal'}),{tabId:'normal-tab',desk:'normal-desk'});privateDownloads.start(row({id:'private',filename:'private-file'}),{tabId:'private-tab',desk:'private-desk'});
 assert.equal(normal.snapshot().privateMode,false);assert.equal(privateDownloads.snapshot().privateMode,true);assert.deepEqual(normal.snapshot().items.map(x=>x.id),['normal']);assert.deepEqual(privateDownloads.snapshot().items.map(x=>x.id),['private']);
 const copy=privateDownloads.snapshot();copy.items[0].filename='changed outside';assert.equal(privateDownloads.snapshot().items[0].filename,'private-file');privateDownloads.clear();assert.deepEqual(privateDownloads.snapshot().items,[]);assert.equal(normal.snapshot().items.length,1);
});
test('unknown, negative and non-finite lengths stay unknown; terminal state requires actual done',()=>{
 const service=new DownloadActivity();service.start(row({total:NaN,received:-20}));assert.equal(service.snapshot().items[0].total,0);assert.equal(service.snapshot().items[0].received,0);
 service.update('fixture',row({state:'completed',received:8,total:Infinity}));assert.equal(service.snapshot().items[0].state,'downloading');assert.equal(service.snapshot().items[0].total,0);assert.equal(service.snapshot().items[0].expiresAt,0);
 service.update('fixture',row({state:'completed',received:8,total:0}),{done:true});assert.equal(service.snapshot().items[0].state,'completed');
});
test('a moved download follows its real tab and retry never borrows the active pane after its tab closes',()=>{
 let now=1,desk='desk-first',exists=true;const service=new DownloadActivity({now:()=>now,resolveOrigin:origin=>exists?{tabId:origin.tabId,desk}:{tabId:'',desk:''}});service.start(row(),{tabId:'original-tab',desk});desk='desk-moved';assert.equal(service.snapshot().items[0].desk,'desk-moved');assert.equal(service.snapshot().items[0].tabId,'original-tab');
 service.update('fixture',row({state:'interrupted',received:50}),{done:true});now+=VISIBLE_MS.error;assert.deepEqual(service.snapshot().items,[]);assert.deepEqual(service.origin('fixture'),{tabId:'original-tab',desk:'desk-moved'},'Retry retains the original owner after the short visible notification expires');exists=false;assert.deepEqual(service.origin('fixture'),{tabId:'',desk:''});service.clear();assert.deepEqual(service.origin('fixture'),{tabId:'',desk:''});
});

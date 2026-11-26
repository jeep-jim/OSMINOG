'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {currentFooterControls}=require('./mouse-compact-smoke.cjs');
const absent=()=>({widgetCount:0,scripts:[],styles:[],mediaPlayerAPI:'undefined',onMediaPlayerAPI:'undefined'});
const inspect=(input,player=absent())=>currentFooterControls(input,player);
const zeroBounds=()=>({x:0,right:0,y:0,bottom:0,w:0,h:0});
const rows=()=>[
 {id:'layout-select',hidden:true,w:0,h:0,hit:false},
 {id:'layout-menu-button',hidden:false,w:54,h:22,hit:true},
 {id:'desktops-button',hidden:false,w:36,h:23,hit:true},
 {id:'settings-button',hidden:false,w:25,h:22,hit:true}
];
test('641 compact footer accepts complete player removal and excludes only the canonical select without mutating evidence',()=>{
 const input=rows(),player=absent(),before=structuredClone({input,player});
 assert.deepEqual(inspect(input,player),input.slice(1));assert.deepEqual({input,player},before);
 const otherHidden={id:'settings-hidden-regression',hidden:true,w:0,h:0,hit:false};input.push(otherHidden);
 assert.ok(inspect(input).includes(otherHidden),'Unrelated hidden controls must still reach the geometry assertions');
});
test('641 compact footer rejects the entire historical hidden player instead of exempting its zero-size buttons',()=>{
 const mediaWidget={id:'mouse-media-widget',count:1,parentId:'statusbar',directChild:true,hidden:true,mode:'hidden',room:'full',display:'none',bounds:zeroBounds()};
 const historical=rows().concat(['toggle','return','dismiss'].map(mediaAction=>({id:'',tag:'BUTTON',hidden:false,mediaAction,mediaWidget,...zeroBounds(),hit:false})));
 assert.throws(()=>inspect(historical,{...absent(),widgetCount:1}));
 assert.throws(()=>inspect(historical),/removed tray player/,'A contradictory zero widget count cannot exempt retained actions');
});
test('641 compact footer rejects visible, hidden, orphaned and renamed media action witnesses',()=>{
 for(const extra of [
  {mediaAction:'toggle',w:20,h:18,hit:true},
  {mediaAction:'dismiss',hidden:true,...zeroBounds(),hit:false},
  {mediaAction:'seek',...zeroBounds(),hit:false},
  {mediaAction:'',...zeroBounds(),hit:false},
  {mediaWidget:{id:'mouse-media-widget'},...zeroBounds(),hit:false},
  {mediaWidget:{id:'renamed-player'},w:20,h:18,hit:true}
 ])assert.throws(()=>inspect([...rows(),{id:'',tag:'BUTTON',...extra}]),/removed tray player/);
});
test('641 compact footer requires actual DOM, resource and IPC absence even when no media buttons remain',()=>{
 for(const patch of [
  {widgetCount:1},{widgetCount:2},{scripts:['file:///mouse/media-widget.js']},
  {styles:['file:///mouse/media-widget.css']},{mediaPlayerAPI:'function'},{onMediaPlayerAPI:'function'}
 ])assert.throws(()=>inspect(rows(),{...absent(),...patch}));
 for(const key of Object.keys(absent())){const incomplete=absent();delete incomplete[key];assert.throws(()=>inspect(rows(),incomplete));}
 assert.throws(()=>currentFooterControls(rows()));
});
test('compact footer cannot pass with a missing, hidden or covered native layout-menu button',()=>{
 for(const patch of [{w:0},{h:0},{hit:false}]){const input=rows();Object.assign(input[1],patch);assert.throws(()=>inspect(input));}
 assert.throws(()=>inspect(rows().filter(row=>row.id!=='layout-menu-button')));
 assert.throws(()=>inspect([...rows(),{...rows()[1]}]));
});
test('compatibility-select exclusion requires its explicit hidden flag and actual zero bounds',()=>{
 for(const patch of [{hidden:false},{w:40},{h:22},{hit:true}]){const input=rows();Object.assign(input[0],patch);assert.throws(()=>inspect(input));}
 assert.throws(()=>inspect(rows().slice(1)));
 assert.throws(()=>inspect([...rows(),{...rows()[0]}]));
});

'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'mouse-637-features-smoke.cjs'),'utf8'),moduleFixture={exports:{}};
const dependencies={electron:{},'./mouse-631-smoke-helpers.cjs':{pageHTML:index=>'<!doctype html><html><body><h1>'+index+'</h1></body></html>'},'./mouse-628-ui-smoke.cjs':{},'./mouse-smoke-hit-target.cjs':{},'./mouse-633-smoke-helpers.cjs':{}};
vm.runInNewContext(source,{module:moduleFixture,require:name=>dependencies[name]??require(name),Buffer,process});
const {ownedWave,ownedMediaPage,ownedExtensionFiles,sampleWitnesses,mediaFixtureBounds}=moduleFixture.exports.fixtures;
test('the native media fixture serves bounded, distinct real PCM tracks rather than remote media',()=>{
 const one=ownedWave(440),two=ownedWave(554);
 assert.equal(one.toString('ascii',0,4),'RIFF');assert.equal(one.readUInt32LE(4),one.length-8);
 assert.equal(one.toString('ascii',8,16),'WAVEfmt ');assert.equal(one.readUInt16LE(20),1);assert.equal(one.readUInt16LE(22),1);
 assert.equal(one.readUInt32LE(24),8000);assert.equal(one.readUInt16LE(34),16);
 assert.equal(one.readUInt32LE(40),45*8000*2);assert.equal(one.length,44+45*8000*2);assert.notDeepEqual(one,two);
 assert.ok(one.subarray(44).some(value=>value!==0),'The native media fixture contains audible samples');
 const html=ownedMediaPage(0);assert.match(html,/src="\/audio\/one\.wav"/);assert.match(html,/src="\/audio\/two\.wav"/);assert.doesNotMatch(html,/https?:\/\//);
});
test('owned replacement fixture really removes the first audio element, plays the second and updates track metadata',async()=>{
 const html=ownedMediaPage(0),script=html.match(/<script>([\s\S]*?)<\/script>/)[1],events=[],elements={};
 const audio=id=>({id,paused:true,isConnected:true,addEventListener(type,fn){events.push({id,type,fn})},pause(){this.paused=true},remove(){this.isConnected=false;delete elements['#'+id]},async play(){this.paused=false}});
 Object.assign(elements,{'#audio-one':audio('audio-one'),'#audio-two':audio('audio-two'),'#media-play':{},'#media-replace':{},'#native-witness':{style:{}}});
 const document={querySelector:selector=>elements[selector],querySelectorAll:()=>Object.values(elements).filter(e=>e.id)};
 const navigator={mediaSession:{}},context=vm.createContext({document,navigator,MediaMetadata:class{constructor(value){Object.assign(this,value)}},performance:{now:()=>12}});vm.runInContext(script,context);
 await elements['#media-play'].onclick({isTrusted:true});assert.equal(elements['#audio-one'].paused,false);assert.equal(navigator.mediaSession.metadata.title,'Owned first track');
 const old=elements['#audio-one'];await elements['#media-replace'].onclick({isTrusted:true});
 assert.equal(old.paused,true);assert.equal(old.isConnected,false);assert.equal(elements['#audio-one'],undefined);assert.equal(elements['#audio-two'].paused,false);
 assert.equal(navigator.mediaSession.metadata.title,'Owned replacement track');assert.equal(context.mouse637Media.replaceClickTrusted,true);assert.equal(context.mouse637Media.error,null);
 assert.equal(elements['#native-witness'].style.background,'rgb(153,69,193)');assert.equal(events.length,6);
});
test('owned extension passes the actual conservative manifest policy and has executable local HTML behavior',()=>{
 const files=ownedExtensionFiles(),{inspectManifest}=require('./mouse-extensions.cjs'),manifest=inspectManifest(files['manifest.json']);
 assert.equal(manifest.popupRel,'panel.html');assert.deepEqual(manifest.permissions,[]);assert.deepEqual(manifest.sites,[]);
 assert.match(files['panel.html'],/<script src="panel\.js"><\/script>/);assert.doesNotMatch(files['panel.html'],/<script>https?:|https?:\/\//);
 const button={},output={},context=vm.createContext({document:{querySelector:selector=>selector==='#extension-action'?button:output},performance:{timeOrigin:42}});
 vm.runInContext(files['panel.js'],context);button.onclick({isTrusted:true});assert.equal(context.mouse637Extension.clicks,1);assert.equal(context.mouse637Extension.trusted,true);assert.equal(output.textContent,'Action 1');
});
test('native screenshot witnesses bind mapped BGRA pixels, reject stale color and reject outside coordinates',()=>{
 const bitmap=Buffer.alloc(4*4*4,255),size={width:4,height:4},mapping={originX:0,originY:0,scaleX:2,scaleY:2};
 bitmap.set([191,143,37,255],(2*4+2)*4);const point={name:'owned',point:{x:1,y:1},expectedRGB:[37,143,191]};
 const [good]=sampleWitnesses(bitmap,size,mapping,[point]);assert.equal(good.accepted,true);assert.equal(good.x,2);assert.equal(good.y,2);
 const [stale]=sampleWitnesses(bitmap,size,mapping,[{...point,expectedRGB:[153,69,193]}]);assert.equal(stale.accepted,false);
 assert.throws(()=>sampleWitnesses(bitmap,size,mapping,[{...point,point:{x:3,y:1}}]),/inside/);
 assert.throws(()=>sampleWitnesses(Buffer.alloc(4),size,mapping,[point]));
});
test('full media fixture gains real footer space without leaving an offset or constrained native display',()=>{
 const original={x:4,y:4,width:1200,height:820},display={x:0,y:0,width:1600,height:1100};
 const fitted=mediaFixtureBounds(original,display,142);
 assert.ok(fitted.width>original.width);assert.equal(fitted.height,original.height);
 assert.ok(142+(fitted.width-original.width)/2>=287);
 for(const [bounds,work,room]of [[original,display,142],[{x:1300,y:30,width:1200,height:820},{x:1280,y:22,width:1440,height:1000},54],[{x:-1200,y:4,width:1200,height:820},{x:-1280,y:0,width:1280,height:900},142]]){
  const actual=mediaFixtureBounds(bounds,work,room);assert.ok(actual.x>=work.x&&actual.y>=work.y);assert.ok(actual.x+actual.width<=work.x+work.width&&actual.y+actual.height<=work.y+work.height);assert.ok(actual.width>=bounds.width);assert.equal(actual.height,bounds.height);
 }
 assert.deepEqual({...mediaFixtureBounds(original,display,300)},original,'An already sufficient native window is unchanged');
 assert.deepEqual(original,{x:4,y:4,width:1200,height:820},'The prior native bounds are retained for restoration');
 assert.throws(()=>mediaFixtureBounds(original,display,NaN),/measured/);
 assert.throws(()=>mediaFixtureBounds(original,{x:0,y:0,width:1000,height:600},30),/fits/);
});
test('media readback distinguishes CSS-hidden or clipped controls from their false hidden property',()=>{
 const bounds=(x,y,width,height)=>({x,y,width,height,left:x,top:y,right:x+width,bottom:y+height}),box=bounds(627,795,53,22);
 const node=(rect,style={})=>({hidden:false,textContent:'Owned track',getBoundingClientRect:()=>rect,css:{display:'block',visibility:'visible',opacity:'1',...style}});
 const controls={
  '[data-media=title]':node(bounds(0,0,0,0),{display:'none'}),
  '[data-media=seek]':node(bounds(0,0,0,0),{display:'none'}),
  '[data-media=return]':node(bounds(655,797,20,18)),
  '[data-media=dismiss]':node(bounds(0,0,0,0),{display:'none'})
 };
 const root=Object.assign(node(box),{dataset:{mode:'full',room:'buttons'},style:{getPropertyValue:()=> '142px'},querySelector:selector=>controls[selector]});
 const fixture={module:{exports:{}},require:name=>dependencies[name]??require(name),Buffer,process,innerWidth:1200,innerHeight:820,document:{querySelector:()=>root},getComputedStyle:node=>node.css,MouseTest:{model:{desktopId:'desk-3'}}};
 vm.runInNewContext(source,fixture);const read=fixture.module.exports.fixtures.widgetReadback;
 let result=read();assert.equal(result.mode,'full');assert.equal(result.visible,true);assert.equal(result.seekHidden,false);assert.equal(result.seekVisible,false);assert.equal(result.titleVisible,false);assert.equal(result.dismissVisible,false);assert.equal(result.roomPixels,142);
 root.getBoundingClientRect=()=>bounds(627,795,287,22);root.dataset.room='full';
 Object.assign(controls,{'[data-media=title]':node(bounds(655,797,100,18)),'[data-media=seek]':node(bounds(758,800,56,12)),'[data-media=dismiss]':node(bounds(842,797,20,18))});
 result=read();assert.equal(result.titleVisible,true);assert.equal(result.seekVisible,true);assert.equal(result.dismissVisible,true);
 controls['[data-media=dismiss]']=node(bounds(950,797,20,18));assert.equal(read().dismissVisible,false,'A control outside the clipped widget is not visible');
 controls['[data-media=seek]'].hidden=true;assert.equal(read().seekVisible,false);
});

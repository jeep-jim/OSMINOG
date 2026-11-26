'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'mouse-637-features-smoke.cjs'),'utf8'),moduleFixture={exports:{}};
const dependencies={electron:{},'./mouse-631-smoke-helpers.cjs':{pageHTML:index=>'<!doctype html><html><body><h1>'+index+'</h1></body></html>'},'./mouse-628-ui-smoke.cjs':{},'./mouse-smoke-hit-target.cjs':{},'./mouse-633-smoke-helpers.cjs':{}};
vm.runInNewContext(source,{module:moduleFixture,require:name=>dependencies[name]??require(name),Buffer,process});
const {ownedWave,ownedMediaPage,ownedExtensionFiles,sampleWitnesses}=moduleFixture.exports.fixtures;
function extensionButtonFixture(states){
 const start=source.indexOf('async function extensionButton('),end=source.indexOf('async function openExtensions(',start);assert.ok(start>=0&&end>start);
 let reads=0;const clicks=[],selector='.mouse-extension-row[data-id="owned-id"] .mouse-extension-actions>button';
 const fixture={async js(script){const labels=states[Math.min(reads++,states.length-1)];return vm.runInNewContext(script,{document:{querySelectorAll(actual){assert.equal(actual,selector);return labels.map(textContent=>({textContent}));}}});},async until(check,label){for(let i=0;i<states.length;i++)if(await check())return;throw Error('Fixture deadline: '+label);}};
 const run=vm.runInNewContext('('+source.slice(start,end).trim()+')',{fixture,JSON,click:async actual=>{clicks.push({selector:actual,read:reads});return'actual native click receipt';}});
 return{run,clicks,selector};
}
test('extension removal waits for the reinstalled renderer row after the main registry is ready',async()=>{
 const f=extensionButtonFixture([[],['Open page'],['Open page','Disable','Pin','Remove from Mouse']]);
 assert.equal(await f.run('owned-id','Remove from Mouse'),'actual native click receipt');
 assert.deepEqual(f.clicks,[{selector:f.selector+':nth-child(4)',read:3}]);
});
test('an absent or untranslated extension action keeps the bounded failure and sends no native click',async()=>{
 const f=extensionButtonFixture([[],['Открыть страницу','Выключить','Закрепить','Убрать из Mouse']]);
 await assert.rejects(f.run('owned-id','Remove from Mouse'),/Fixture deadline: Extension action Remove from Mouse/);assert.deepEqual(f.clicks,[]);
});
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

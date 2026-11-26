'use strict';
//641 replaces the removed tray-player scenarios with live website audio,
//ordinary tab mute, and an observed absence of the former polling world.
const assert=require('node:assert/strict');
const {sleep}=require('./mouse-631-smoke-helpers.cjs');

function shellReadback(){
 return{widgetCount:document.querySelectorAll('#mouse-media-widget,[data-media-player]').length,
  scripts:[...document.scripts].map(row=>row.src).filter(value=>/media-widget/.test(value)),
  styles:[...document.querySelectorAll('link[rel=stylesheet]')].map(row=>row.href).filter(value=>/media-widget/.test(value)),
  mediaPlayerAPI:typeof MouseNative.mediaPlayer,onMediaPlayerAPI:typeof MouseNative.onMediaPlayer};
}
function assertAbsent(value){
 assert.equal(value.widgetCount,0);assert.deepEqual(value.scripts,[]);assert.deepEqual(value.styles,[]);
 assert.equal(value.mediaPlayerAPI,'undefined');assert.equal(value.onMediaPlayerAPI,'undefined');
}
function audioReadback(){
 return{timeOrigin:performance.timeOrigin,...mouse637Media,
  audio:[...document.querySelectorAll('audio')].map(element=>({id:element.id,paused:element.paused,currentTime:element.currentTime,duration:element.duration,readyState:element.readyState}))};
}

module.exports=async function mediaRemoval({fixture,records,click,capture,facts,witness}){
 const record=records[0],wc=record.page.view.webContents,nativeEvents=[],polls=[];
 const original=wc.executeJavaScriptInIsolatedWorld,startedAt=Date.now();
 const playing=()=>nativeEvents.push({type:'media-started-playing',at:Date.now()});wc.on('media-started-playing',playing);
 wc.executeJavaScriptInIsolatedWorld=function(world,scripts,...args){if(world===1294)polls.push({world,at:Date.now(),scripts:scripts.map(row=>String(row.code).slice(0,180))});return original.call(this,world,scripts,...args);};
 const shell=()=>fixture.js('('+shellReadback.toString()+')()');
 const audio=()=>fixture.pageJS(record,'('+audioReadback.toString()+')()');
 const report={schema:2,source:'Installed website audio, native tab mute and observed removed-player polling world',removed:true,pollWorld:1294,pollIntervalWasMs:1000,polls,nativeEvents,samples:[],nativeBefore:fixture.nativeState(record)};facts.media=report;
 try{
  report.initial=await shell();assertAbsent(report.initial);
  await fixture.until(()=>fixture.pageJS(record,'[...document.querySelectorAll("audio")].every(e=>e.readyState>=2)'),'owned audio is decoded');
  report.playInput=await click('#media-play',record);await fixture.until(async()=>{const state=await audio();return state.audio[0].currentTime>0&&!state.audio[0].paused},'website audio plays');
  report.before=await audio();assert.equal(report.before.playClickTrusted,true);assert.ok(nativeEvents.length>0);
  await capture('mouse-637-media-full.png',[await witness(record)]);
  const origin=fixture.bank.active,other=fixture.bank.items.find(row=>row.id!==origin).id;report.originDesktop=origin;report.otherDesktop=other;
  await fixture.switchDesk(other);report.other=await shell();assertAbsent(report.other);
  await capture('mouse-637-media-compact.png');await fixture.switchDesk(origin);
  await fixture.until(()=>record.page.visible,'website audio source returns');
  const muteSelector='.tab-item[data-tab="'+record.id+'"] [data-tab-mute]';
  report.mute={input:await click(muteSelector),at:Date.now()};await fixture.until(()=>wc.isAudioMuted(),'native tab is muted');
  report.mute.muted=wc.isAudioMuted();report.mute.audio=await audio();assert.equal(report.mute.audio.audio[0].paused,false);
  report.unmute={input:await click(muteSelector),at:Date.now()};await fixture.until(()=>!wc.isAudioMuted(),'native tab is unmuted');
  report.unmute.muted=wc.isAudioMuted();report.unmute.audio=await audio();assert.equal(report.unmute.audio.audio[0].paused,false);
  report.replaceInput=await click('#media-replace',record);
  await fixture.until(async()=>{const state=await audio();return state.current==='audio-two'&&state.audio.length===1&&state.audio[0].currentTime>0&&!state.audio[0].paused},'site replacement audio plays');
  report.after=await audio();assert.equal(report.after.replaceClickTrusted,true);assert.equal(report.after.error,null);assert.equal(report.after.audio[0].id,'audio-two');assert.ok(nativeEvents.length>=2);
  await capture('mouse-637-media-replacement.png',[await witness(record)]);
  // Observe more than two former 1000 ms refresh periods while the real audio
  // remains active. No app instrumentation is injected into the removed world.
  const observedAt=Date.now();report.observation={startedAt:observedAt,before:await audio()};
  while(Date.now()-observedAt<2200){await sleep(100);const sample={at:Date.now(),shell:await shell(),audio:await audio()};assertAbsent(sample.shell);assert.equal(sample.audio.audio[0].paused,false);report.samples.push(sample);}
  report.observation.finishedAt=Date.now();report.observation.elapsedMs=report.observation.finishedAt-observedAt;report.observation.after=await audio();
  assert.ok(report.observation.after.audio[0].currentTime>report.observation.before.audio[0].currentTime);assert.deepEqual(polls,[]);
  report.unrelatedPaused=await fixture.pageJS(records[1],'[...document.querySelectorAll("audio")].every(e=>e.paused)');assert.equal(report.unrelatedPaused,true);
  report.final=await shell();assertAbsent(report.final);report.nativeAfter=fixture.nativeState(record);assert.equal(report.nativeAfter.webContentsId,report.nativeBefore.webContentsId);
  report.elapsedMs=Date.now()-startedAt;report.ok=true;
 }finally{wc.executeJavaScriptInIsolatedWorld=original;wc.removeListener('media-started-playing',playing);await fixture.pageJS(record,'document.querySelector("#audio-two")?.pause();document.querySelector("#audio-one")?.pause();true');}
};
module.exports.fixtures={shellReadback,assertAbsent,audioReadback};

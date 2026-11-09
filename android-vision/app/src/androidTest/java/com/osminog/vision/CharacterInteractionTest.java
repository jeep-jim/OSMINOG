package com.osminog.vision;

import static org.junit.Assert.*;
import android.Manifest;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.*;

/** Mocked model events are fixtures. Camera switching uses the actual emulator cameras. */
public class CharacterInteractionTest {
 private final OceanMenuTest ui=new OceanMenuTest();
 @Before public void before()throws Exception{ui.before();}
 @After public void after()throws Exception{ui.after();}
 void enableMock()throws Exception{
  ui.run("window.fixtureRequests=[];window.fixtureEmit=emit;emit=function(t,d){if(t==='askCharacter'){fixtureRequests.push(d);return true;}return fixtureEmit(t,d)};$('characterToggle').click();$('characterAccept').click()");
 }
 @Test public void actualCameraSwitchAndPinnedPreview()throws Exception{
  InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(ui.a.getPackageName(),Manifest.permission.CAMERA);
  ui.run("startCamera()");
  OceanMenuTest.until(()->"true".equals(OceanMenuTest.js(ui.a.shell,"!!cameraStream&&$('cameraVideo').videoWidth>0&&!cameraBusy")));
  ui.run("window.firstFacing=cameraFacing;window.firstTracks=cameraStream.getTracks();$('cameraSwitch').click()");
  OceanMenuTest.until(()->"true".equals(OceanMenuTest.js(ui.a.shell,"!!cameraStream&&!cameraBusy&&cameraFacing!==firstFacing")));
  ui.ok("firstTracks.every(t=>t.readyState==='ended')&&$('cameraArea').parentElement.id==='scene'");
  ui.run("records=Array.from({length:30},(_,i)=>({id:'camera-'+i,role:'user',text:'Тестовая длинная переписка '+i,created:Date.now()}));render();window.cameraTop=$('cameraArea').getBoundingClientRect().top;$('main').scrollTop=$('main').scrollHeight;$('text').focus()");
  ui.scenario.onActivity(a->a.applyInsets(24,300));Thread.sleep(250);
  ui.ok("!$('cameraArea').hidden&&$('cameraArea').getBoundingClientRect().bottom<$('dock').getBoundingClientRect().top&&$('cameraVideo').getBoundingClientRect().height>=70");
  ui.shot("vision-character-camera-keyboard");
  ui.run("stopCamera()");ui.ok("!cameraStream&&$('cameraArea').hidden");
 }
 @Test public void privateResponseUsesChosenCharacterAndKeepsNextDraft()throws Exception{
  enableMock();ui.run("preferences.avatar='Star 35.svg';ask('Тестовый вопрос');$('text').value='Следующий черновик';draftSave()");
  OceanMenuTest.until(()->"true".equals(OceanMenuTest.js(ui.a.shell,"fixtureRequests.length===1")));
  ui.run("OSMINOG.receive({type:'characterReply',id:fixtureRequests[0].id,reply:'Тестовый ответ модели',targetId:null,visionUsed:false})");
  ui.ok("records.length===2&&records[1].role==='assistant'&&!records[0].intent&&records[1].replyTo===records[0].id&&document.querySelector('.message.assistant img').src.endsWith('Star%2035.svg')&&$('text').value==='Следующий черновик'");
  ui.shot("vision-character-chat");
 }
 @Test public void deletedMessageRejectsLateReply()throws Exception{
  enableMock();ui.run("ask('Удалённый тестовый вопрос')");
  OceanMenuTest.until(()->"true".equals(OceanMenuTest.js(ui.a.shell,"fixtureRequests.length===1")));
  ui.run("saveRecords([]);render();OSMINOG.receive({type:'characterReply',id:fixtureRequests[0].id,reply:'Поздний тестовый ответ'})");ui.ok("records.length===0&&!CharacterAI.busy");
 }
 @Test public void consentRevocationRejectsPendingReply()throws Exception{
  enableMock();ui.run("ask('Тестовый вопрос до отзыва')");
  OceanMenuTest.until(()->"true".equals(OceanMenuTest.js(ui.a.shell,"fixtureRequests.length===1")));
  ui.run("$('characterToggle').click();OSMINOG.receive({type:'characterReply',id:fixtureRequests[0].id,reply:'Не сохранять'})");ui.ok("records.length===1&&records[0].role==='user'&&read('osminogAIConsent',true)===false");
 }
 @Test public void actualThoughtTargetAndUnknownTargetRejection()throws Exception{
  enableMock();ui.run("saveRecords([{id:'fixture-thought',role:'user',text:'Тестовая мысль: учиться плавать',intent:true,created:Date.now()}]);OceanUI.open()");
  OceanMenuTest.until(()->"true".equals(OceanMenuTest.js(ui.a.shell,"fixtureRequests.length===1")));
  ui.run("OSMINOG.receive({type:'characterReply',id:fixtureRequests[0].id,reply:'Тестовое исследование мысли',targetId:'fixture-thought'});");
  ui.ok("$('characterAgent').dataset.targetId==='fixture-thought'&&!$('characterSpeech').hidden&&document.querySelectorAll('.thought-bubble').length===1");ui.shot("vision-character-ocean");
  ui.run("$('characterExplore').click()");
  OceanMenuTest.until(()->"true".equals(OceanMenuTest.js(ui.a.shell,"fixtureRequests.length===2")));
  ui.run("OSMINOG.receive({type:'characterReply',id:fixtureRequests[1].id,reply:'Тестовая ошибка выбора',targetId:'invented-thought'})");
  ui.ok("$('characterAgent').dataset.targetId==='fixture-thought'&&document.querySelectorAll('.thought-bubble').length===1");
 }
 @Test public void ordinaryTextHasNoCameraOrPrivateArchive()throws Exception{
  enableMock();ui.run("localStorage.setItem('osminogLegacyArchive',JSON.stringify([{text:'secret-archive-fixture'}]));ask('Обычный тестовый текст')");
  OceanMenuTest.until(()->"true".equals(OceanMenuTest.js(ui.a.shell,"fixtureRequests.length===1")));
  ui.ok("fixtureRequests[0].image===''&&fixtureRequests[0].visionConsent===false&&!JSON.stringify(fixtureRequests[0]).includes('secret-archive-fixture')");
 }
}

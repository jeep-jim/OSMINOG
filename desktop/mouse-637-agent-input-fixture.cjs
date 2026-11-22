'use strict';
// Retained622 alone uses this page. The shared preset preservation field is
// never selected, cleared or edited by the separate Agent typing scenario.
const assert=require('node:assert/strict');
const {ownedPresetPage}=require('./mouse-637-presets-helpers.cjs');

function ownedAgentInputPage(label=''){
 const html=ownedPresetPage(label);
 if(label!=='')return html;
 const action='<button id="action">';
 assert.equal(html.split(action).length,2,'The owned fixture has one action button');
 return html.replace(action,'<input id="agent-draft" value="" aria-label="Agent typing fixture">'+action);
}

function agentInputReadback(){
 const preserved=document.querySelector('#draft'),agent=document.querySelector('#agent-draft');
 return{href:location.href,timeOrigin:performance.timeOrigin,identity:window.identity,
  preservedValue:preserved?.value??null,agentValue:agent?.value??null,
  agentTag:agent?.tagName??null,agentType:agent?.type??null,
  agentDisabled:agent?.disabled??null,agentReadOnly:agent?.readOnly??null};
}

async function verifyAgentInput({client,target,page,approve,evidence={}}){
 const read=async()=>{const wc=page.view.webContents;return{
  ...await wc.executeJavaScript('('+agentInputReadback.toString()+')()'),
  webContentsId:wc.id,nativeURL:wc.getURL(),navigationEpoch:page.navigationEpoch||0};};
 evidence.before=await read();
 assert.equal(typeof evidence.before.identity,'number');assert.ok(Number.isFinite(evidence.before.identity));
 assert.ok(Number.isFinite(evidence.before.timeOrigin),'The owned page has its real time origin');
 assert.ok(Number.isSafeInteger(evidence.before.webContentsId)&&evidence.before.webContentsId>0,'The owned page has its real WebContents identity');
 assert.equal(evidence.before.preservedValue,'preserved-preset-'+target,'The preset preservation sentinel is intact before Agent input');
 assert.equal(evidence.before.agentTag,'INPUT','The Agent fixture has its own input');
 assert.equal(evidence.before.agentType,'text');
 assert.equal(evidence.before.agentDisabled,false);assert.equal(evidence.before.agentReadOnly,false);
 assert.equal(evidence.before.agentValue,'','The separate Agent input starts empty');
 await approve(client.clickSelector(target,'#agent-draft'),'click');
 await approve(client.type(target,'agent-622'),'type');
 evidence.after=await read();
 assert.equal(evidence.after.agentValue,'agent-622');
 for(const key of ['preservedValue','webContentsId','nativeURL','navigationEpoch','href','timeOrigin','identity'])
  assert.equal(evidence.after[key],evidence.before[key],'Agent typing preserves '+key);
 return evidence;
}

module.exports={ownedAgentInputPage,agentInputReadback,verifyAgentInput};

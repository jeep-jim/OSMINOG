'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('gpt-presence.js','utf8');
const extract=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const env={Set,Error,chosenMode:'direct',staged:{ok:true,staged:true,proposalId:'p'},applied:{ok:true,applied:true},persisted:0,currentPromptMeta:{execution:'canvas',mutations:[]},
 ghostForPatch(){},activity(){},persist:async()=>{env.persisted++},setTimeout(){},syncUi(){},drawAgentTethers(){},q:()=>({value:env.chosenMode}),B:{executeTool:async()=>env.staged,applyPatch:()=>env.applied,renderPatch(){}}};
vm.createContext(env);vm.runInContext(extract('  function executionSatisfied(','  function executionDirective(')+extract('  async function applyCanvasPatch(','  function workspaceAppName('),env);
const meta=()=>({execution:'canvas',mutations:[]});const patch={actions:[{op:'create'}]};
(async()=>{
 assert.equal(env.executionSatisfied(meta(),{patch},true),false);
 assert.equal(env.executionSatisfied({...meta(),mutations:['propose_canvas_patch']},{patch},false),false);
 env.staged={ok:false,error:'wrong revision'};assert.equal(await env.applyCanvasPatch(patch,false),false);assert(!env.executionSatisfied(env.currentPromptMeta,{patch},false));assert.equal(env.persisted,0);
 env.staged={ok:true,staged:true,proposalId:'p'};env.chosenMode='review';env.currentPromptMeta=meta();assert.equal(await env.applyCanvasPatch(patch,false),true);assert.equal(env.currentPromptMeta.canvasPrepared,'p');assert(!env.currentPromptMeta.canvasChanged);assert(env.executionSatisfied(env.currentPromptMeta,{patch}));
 env.chosenMode='direct';env.currentPromptMeta=meta();env.applied={ok:false,applied:false,cancelled:true};await assert.rejects(()=>env.applyCanvasPatch(patch,false),/отменена/);assert(!env.currentPromptMeta.canvasPrepared);assert(!env.executionSatisfied(env.currentPromptMeta,{patch}));assert.equal(env.persisted,0);
 env.currentPromptMeta=meta();env.applied={ok:false,applied:false,error:'wrong project'};assert.equal(await env.applyCanvasPatch(patch,false),false);assert(!env.executionSatisfied(env.currentPromptMeta,{patch}));assert.equal(env.persisted,0);
 env.currentPromptMeta=meta();env.applied={ok:true,applied:true};assert.equal(await env.applyCanvasPatch(patch,false),true);assert(env.currentPromptMeta.canvasChanged);assert.equal(env.persisted,1);assert(env.executionSatisfied(env.currentPromptMeta,{patch}));
 console.log('PASS patch outcomes: raw JSON is not proof; verified staging, rejected/cancelled apply, persistence and success remain distinct');
})().catch(e=>{console.error(e);process.exitCode=1});

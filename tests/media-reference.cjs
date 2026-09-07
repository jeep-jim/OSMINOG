const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('gpt-presence.js','utf8');
const start=source.indexOf('function isGeneratedImageAction('),end=source.indexOf('async function executeDirectWebAsset(',start);
const ctx={};vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
assert.equal(ctx.isGeneratedImageAction('сгенерируй такого же человека только в другой позе'),true);
const mixed='не надо рисовать, надо найти изображение в интернете и вставить рядом или сгенерировать картинку';
assert.equal(ctx.isGeneratedImageAction(mixed),false);assert.equal(ctx.isWebAssetAction(mixed),true);assert.equal(ctx.needsMediaChoice(mixed),true);
assert.equal(ctx.isGeneratedImageAction('[MEDIA:generate] '+mixed),true);assert.equal(ctx.isWebAssetAction('[MEDIA:search] '+mixed),true);
const calls=[];ctx.activity=()=>{};ctx.B={executeTool:async(name,args)=>{calls.push({name,args});return{object:{id:'new-image'}}}};
const impStart=source.indexOf('async function importGeneratedMedia('),impEnd=source.indexOf('function lastModuleArtifact(',impStart);vm.runInContext(source.slice(impStart,impEnd),ctx);
(async()=>{
 await ctx.importGeneratedMedia([{url:'https://example.com/result.png'}],'pose',{bounds:{x:10,y:20,w:300,h:500}});
 assert.equal(calls[0].args.url,'https://example.com/result.png');assert.equal(calls[0].args.x,342);assert.equal(calls[0].args.y,20);
 ctx.B.executeTool=async()=>({error:'HTTP 403: original unavailable'});const failed=await ctx.importGeneratedMedia([{url:'https://example.com/expired.png'}]);assert.equal(failed.error,'HTTP 403: original unavailable');
 assert.match(source,/pendingAttachments=visible;sendPromptParallel/);assert.match(source,/renderTaskProgress\(task,false\);threadTasks.delete\(thread.id\)/);
 console.log('PASS same-person generation, mixed-choice routing, HTTPS import beside reference, attachment handoff');
})().catch(e=>{console.error(e);process.exitCode=1});

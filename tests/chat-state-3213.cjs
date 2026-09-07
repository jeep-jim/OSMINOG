const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const memory=require('../osminog-project-memory.js');
const key='briefCraftGptLiteChat:p1:main',marker='briefCraftGptChatCleared:p1:main',other='briefCraftGptLiteChat:p1:other';
const old=[{id:'old',at:10,text:'deleted'}],fresh=[{id:'new',at:30,text:'keep'}];
for(const [local,remote] of [
  [{[key]:fresh,[marker]:{at:20}},{[key]:old,[other]:old}],
  [{[key]:old,[other]:old},{[key]:fresh,[marker]:{at:20}}]
]){const merged={...local,...memory.merge(local,remote,['p1'])};assert.deepEqual(merged[key],fresh);assert.deepEqual(merged[other],old);assert.equal(merged[marker].at,20)}
const merged=memory.merge({[marker]:{at:20}},{'briefCraftGptLiteChat:p1':old,[key]:old},['p1']);assert.deepEqual(merged[key],[]);assert.deepEqual(merged['briefCraftGptLiteChat:p1'],[]);
assert.equal(memory.select({[marker]:{at:20},secret:'hidden'},['p1'])[marker].at,20);
const ctx={structuredClone,TextDecoder,Uint8Array,Date,AbortController,Map};vm.createContext(ctx);vm.runInContext(fs.readFileSync('osminog-generated-media.js','utf8'),ctx);
const event=(text,channel='final')=>'data: '+JSON.stringify({message:{id:'a',author:{role:'assistant'},channel,content:{parts:[text]}}})+'\n\n';
const parser=ctx.OSMINOGGeneratedMedia.createSseParser();const first=event('Привет');for(const char of first)parser.push(char);assert.equal(parser.result().answer,'Привет');parser.push('data: '+JSON.stringify({p:'/message/content/parts/0',o:'append',v:', мир'})+'\n');assert.equal(parser.result().answer,'Привет, мир');
parser.push(event('private reasoning','analysis'));assert.equal(parser.result().answer,'');
const bg=fs.readFileSync('background.js','utf8');vm.runInContext(bg.slice(bg.indexOf('async function bcReadConversationStream'),bg.indexOf('async function bcConversationFetch')),ctx);
const reset=bg.slice(bg.indexOf('function bcResetChat('),bg.indexOf('async function bcSendDirectRequest('));
let aborted=false;ctx.bcActiveChatRequests=new Map([['active',{projectId:'p1',threadId:'main',controller:{abort(){aborted=true}}}]]);ctx.bcThreads=new Map([['p1::main::0',{}],['p1::main2::0',{}]]);ctx.BC_PROVIDER_HISTORY=new Map([['custom:p1:main:0',old],['custom:p1:main2:0',old]]);vm.runInContext(reset,ctx);ctx.bcResetChat('p1','main');assert(aborted);assert.equal(ctx.bcThreads.has('p1::main::0'),false);assert.equal(ctx.bcThreads.has('p1::main2::0'),true);assert.equal(ctx.BC_PROVIDER_HISTORY.has('custom:p1:main2:0'),true);
(async()=>{
 let release,finish;const stream=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(event('Первый фрагмент')));release=()=>controller.enqueue(new TextEncoder().encode(event('Первый фрагмент. Готово')));finish=()=>controller.close()}});
 const progress=[];const pending=ctx.bcReadConversationStream(new Response(stream),text=>progress.push(text),new AbortController().signal);
 await new Promise(r=>setTimeout(r,0));assert.deepEqual(progress,['Первый фрагмент']);release();finish();const raw=await pending;assert.equal(progress.at(-1),'Первый фрагмент. Готово');assert.equal(ctx.OSMINOGGeneratedMedia.parseSse(raw).answer,progress.at(-1));
 console.log('PASS clear markers survive two-way restore; other chats preserved; UTF-8/delta streaming before EOF; analysis private; exact transport reset');
})().catch(e=>{console.error(e);process.exitCode=1});

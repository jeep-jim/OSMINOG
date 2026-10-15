'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {ConnectionDiagnostics,endpoint}=require('./connection-diagnostics.cjs');
test('report records request lifecycle without secrets or conversation identifiers',()=>{
 let now=0;const d=new ConnectionDiagnostics({now:()=>now,channel:id=>id===7?'user-tab':'service-tab'});
 const req={id:1,webContentsId:7,resourceType:'xhr',method:'POST',url:'https://chat.deepseek.com/api/v0/chat/completion?token=SECRET',uploadData:[{bytes:Buffer.from('PROMPT')}],requestHeaders:{Authorization:'SECRET'}};
 d.record('sent',req);now=300;d.record('response',{...req,statusCode:503});d.record('completed',{...req,statusCode:503});
 assert.equal(d.snapshot().pending.length,0);assert.equal(d.snapshot().events[2].status,503);assert.equal(d.snapshot().events[2].elapsedMs,300);assert.equal(d.snapshot().events[2].channel,'user-tab');
 d.record('failed',{...req,id:2,url:'https://chatgpt.com/backend-api/conversation/PRIVATE-ID?x=SECRET',error:'net::ERR_PROXY_CONNECTION_FAILED https://secret'});
 const json=JSON.stringify(d.snapshot());for(const secret of ['SECRET','PROMPT','PRIVATE-ID','https://secret','Authorization'])assert(!json.includes(secret));assert(json.includes('ERR_PROXY_CONNECTION_FAILED'));
 assert.equal(endpoint('https://evil.test/chatgpt.com'),null);assert.equal(endpoint('https://chatgpt.com.evil.test/'),null);
});
test('passive observers never alter request headers, body or response and retain bounded data',()=>{
 const hooks={},session={webRequest:Object.fromEntries(['onSendHeaders','onResponseStarted','onCompleted','onErrorOccurred'].map(name=>[name,(filter,fn)=>hooks[name]=fn]))};
 const d=new ConnectionDiagnostics({limit:3});d.attach(session);const req=Object.freeze({id:1,resourceType:'xhr',method:'POST',url:'https://chatgpt.com/backend-api/conversation'});
 hooks.onSendHeaders(req);hooks.onResponseStarted({...req,statusCode:200});hooks.onErrorOccurred({...req,error:'net::ERR_CONNECTION_RESET'});assert.equal(d.snapshot().pending.length,0);
 for(let id=0;id<10;id++)hooks.onSendHeaders({...req,id});assert.equal(d.snapshot().events.length,3);assert.equal(d.snapshot().pending.length,3);
 d.service('deepseek','fallback','HTTP 403: SECRET');assert.equal(d.snapshot().events.at(-1).error,'HTTP 403');
});

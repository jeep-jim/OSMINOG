'use strict';
// Run the bundled extension's transport, never model or page supplied JavaScript.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
class SessionTransport{
 constructor(browser,{fetch}={}){
  this.browser=browser;this.requests=new Set();
  const source=fs.readFileSync(path.join(__dirname,'board/background.js'),'utf8');
  const slice=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start);if(start<0||end<start)throw Error('Extension transport boundaries changed');return source.slice(start,end)};
  const scopedFetch=async(url,options={})=>{const u=new URL(url);if(!['http:','https:'].includes(u.protocol))throw Error('Unsupported request URL');const controller=new AbortController();this.requests.add(controller);const timer=setTimeout(()=>this.requests.delete(controller),240000);timer.unref?.();try{const response=await (fetch||((u,o)=>browser.session.fetch(u,o)))(url,{...options,signal:AbortSignal.any([controller.signal,AbortSignal.timeout(240000),...(options.signal?[options.signal]:[])])});for(const method of ['text','json','arrayBuffer']){const original=response[method].bind(response);response[method]=async()=>{try{return await original()}finally{clearTimeout(timer);this.requests.delete(controller)}}}return response}catch(e){clearTimeout(timer);this.requests.delete(controller);throw e}};
  const context=vm.createContext({fetch:scopedFetch,crypto:webcrypto,navigator:{userAgent:browser.session.getUserAgent()},performance,structuredClone,TextEncoder,TextDecoder,AbortController,AbortSignal,URL,URLSearchParams,Blob,Headers,Request,Response,atob,btoa,setTimeout,clearTimeout,console,chrome:{tabs:{get:async id=>{const tab=browser.get(id);return{id:tab.id,url:tab.view.webContents.getURL()}}},scripting:{executeScript:async({target,func,args=[]})=>{const tab=browser.get(target.tabId),wc=tab.view.webContents;if(new URL(wc.getURL()).origin!=='https://chat.deepseek.com')throw Error('DeepSeek session origin changed');const result=await wc.executeJavaScriptInIsolatedWorld(1002,[{code:`(${func.toString()})(...${JSON.stringify(args)})`}]);return[{result}]}},storage:{local:{get:k=>browser.store.get(k),set:v=>browser.store.set(v)}}}});
  for(const file of ['sha3.js','osminog-generated-media.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'board',file),'utf8'),context,{filename:file});
  const body=slice('const BC_BASE=','// Browser handles never belong')+'\n'+slice('async function bcDeepSeekDirectProbe(','async function bcProviderTabSend(');
  vm.runInContext(body+`\nlet nativeDeepSeekId;async function bcProviderLinks(){return{deepseek:{tabId:nativeDeepSeekId}}}globalThis.nativeTransport={probe:bcProbe,gpt:bcSendDirect,parse:bcParseAssistant,reset:bcResetChat,stop:()=>{for(const r of bcActiveChatRequests.values())r.controller.abort()},api:{claude:bcClaudeSend,gemini:bcGeminiSend,deepseek:bcDeepSeekSend},deepProbe:bcDeepSeekDirectProbe,deep:async(id,text,context,result,rid)=>{nativeDeepSeekId=id;return bcDeepSeekDirectTabSend(text,context,result,rid)},web:{BC_WEB_SEARCH:bcWebSearch,BC_WEB_IMAGE_SEARCH:bcWebImageSearch,BC_WEB_FETCH:bcWebFetch}}`,context,{filename:'extension-session-transport.js'});
  this.api=context.nativeTransport;
 }
 stop(){this.api.stop();for(const r of this.requests)r.abort();this.requests.clear()}
 async probe(provider,tab){if(provider==='chatgpt'){const r=await this.api.probe();return{...r,connected:r.ok,ready:r.ok,needsAuth:!r.ok,mode:'extension-session'}}if(provider==='deepseek'&&tab){const r=await this.api.deepProbe({id:tab.id});return{...r,connected:r.ok,ready:r.ok,mode:'extension-session'}}return null}
 async send(provider,payload,context,requestId,tab){
  const result=payload.result,images=[...(payload.images||[])];if(payload.imageDataUrl)images.push({name:'tool-result.png',dataUrl:payload.imageDataUrl});
  if(provider==='chatgpt')return this.api.gpt({text:payload.text||'',context,requestId,toolResult:result,images});
  let got;
  if(payload.apiKey&&this.api.api[provider]){if(provider==='deepseek'&&images.length)throw Error('DeepSeek API в этом адаптере поддерживает текст. Изображения не отправлены.');got=await this.api.api[provider](payload.text||'',context,payload.apiKey,result,requestId,images)}
  else if(provider==='deepseek'&&tab){if(images.length)throw Error('DeepSeek session: передача изображений не поддерживается этим транспортом. Используйте текстовый контекст.');got=await this.api.deep(tab.id,payload.text||'',context,result,requestId)}
  else return null;
  return{ok:true,requestId,payload:{requestId,...this.api.parse(got.answer)},diag:{provider,mode:got.mode||'api'}};
 }
}
module.exports={SessionTransport};

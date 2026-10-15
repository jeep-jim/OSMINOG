'use strict';
const hosts={'chatgpt.com':'chatgpt','chat.openai.com':'chatgpt','chat.deepseek.com':'deepseek','claude.ai':'claude','gemini.google.com':'gemini'};
const knownPaths=new Set(['/api/auth/session','/backend-api/conversation','/backend-anon/conversation','/api/v0/chat/completion','/api/v0/chat/create_pow_challenge','/api/v0/chat_session/create','/api/v0/users/current']);
function endpoint(value){try{const u=new URL(value),provider=hosts[u.hostname];if(!provider||u.protocol!=='https:')return null;return{provider,endpoint:knownPaths.has(u.pathname)?u.pathname:u.pathname==='/'?'homepage':'other'};}catch{return null}}
function errorCode(error){return String(error||'').match(/\b(?:net::)?ERR_[A-Z_]+\b/)?.[0]||String(error||'').match(/\bHTTP [1-5]\d\d\b/)?.[0]||'unspecified'}
class ConnectionDiagnostics{
 constructor({channel=()=> 'unknown',now=Date.now,limit=200}={}){this.channel=channel;this.now=now;this.limit=limit;this.events=[];this.active=new Map()}
 push(event){this.events.push({at:new Date(this.now()).toISOString(),...event});if(this.events.length>this.limit)this.events.shift()}
 record(stage,d){const ep=endpoint(d.url);if(!ep||!['xhr','mainFrame','other','webSocket'].includes(d.resourceType))return;
  const id=Number(d.id),channel=this.channel(d.webContentsId),method=['GET','POST','PUT','DELETE','PATCH','OPTIONS','HEAD'].includes(d.method)?d.method:'other';
  if(stage==='sent'){this.active.set(id,{at:this.now(),...ep,channel,method});while(this.active.size>this.limit)this.active.delete(this.active.keys().next().value);}
  const start=this.active.get(id);this.push({...ep,channel,method,stage,request:id,...(Number.isInteger(d.statusCode)?{status:d.statusCode}:{}),...(d.error?{error:errorCode(d.error)}:{}),...(start?{elapsedMs:Math.max(0,this.now()-start.at)}:{})});
  if(stage==='completed'||stage==='failed')this.active.delete(id);
 }
 attach(session){if(!session.webRequest)return;const filter={urls:Object.keys(hosts).map(h=>'https://'+h+'/*')};for(const [event,stage] of [['onSendHeaders','sent'],['onResponseStarted','response'],['onCompleted','completed'],['onErrorOccurred','failed']])session.webRequest[event](filter,d=>{try{this.record(stage,d)}catch{ /* Diagnostics cannot break page requests. */ }});}
 service(provider,stage,error){if(!Object.values(hosts).includes(provider)||!['start','complete','failed','fallback'].includes(stage))return;this.push({provider,channel:'executor',stage,...(error?{error:errorCode(error)}:{})})}
 snapshot(){return{events:this.events.map(e=>({...e})),pending:[...this.active.values()].map(({at,...x})=>({...x,elapsedMs:Math.max(0,this.now()-at)}))}}
}
module.exports={ConnectionDiagnostics,endpoint,errorCode};

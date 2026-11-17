'use strict';
// Authenticated CDP-compatible loopback gateway, never global Chromium debugging.
const http=require('node:http'),crypto=require('node:crypto');
class Gateway{
 constructor({command,targets,valid,onDisconnect=()=>{},WebSocketServer}){Object.assign(this,{command,targets,valid,onDisconnect});this.WebSocketServer=WebSocketServer||require('./deps.cjs')('ws').WebSocketServer;this.clients=new Set();}
 async start(port=9222){
  if(this.server)throw Error('Коннектор уже запущен');if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid port');this.token=crypto.randomBytes(32).toString('hex');
  const allowed=req=>this.valid()&&!req.headers.origin&&req.socket.remoteAddress==='127.0.0.1'&&req.headers.host==='127.0.0.1:'+this.port;
  const token=value=>typeof value==='string'&&value.length===this.token.length&&crypto.timingSafeEqual(Buffer.from(value),Buffer.from(this.token));
  this.server=http.createServer((req,res)=>{
   res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
   if(!allowed(req)||!token((req.headers.authorization||'').replace(/^Bearer /,''))){res.writeHead(403);res.end('Forbidden');return;}
   if(req.method!=='GET'){res.writeHead(405);res.end();return;}
   const route=req.url?.split('?')[0];let result;
   if(route==='/json/version')result={'Browser':'Agent Mouse/6.0.22','Protocol-Version':'1.3',webSocketDebuggerUrl:this.url};
   else if(['/json','/json/list'].includes(route))result=this.targets();else{res.writeHead(404);res.end();return;}
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
  });
  this.ws=new this.WebSocketServer({noServer:true,maxPayload:65536,perMessageDeflate:false});
  this.server.on('upgrade',(req,socket,head)=>{
   if(!allowed(req)||!token((req.url||'').replace(/^\/devtools\/browser\//,''))||this.clients.size>=2){socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();return;}
   this.ws.handleUpgrade(req,socket,head,client=>this.ws.emit('connection',client,req));
  });
  this.ws.on('connection',socket=>{
   const client={socket,sessions:new Map(),pressed:new Map(),queued:0};this.clients.add(client);let chain=Promise.resolve();
   socket.on('error',()=>{});socket.on('close',()=>{this.clients.delete(client);this.onDisconnect(client);});
   socket.on('message',bytes=>{
    let request;try{request=JSON.parse(bytes.toString());if(!request||!Number.isInteger(request.id)||typeof request.method!=='string'||request.method.length>100||Array.isArray(request.params)||request.params&&typeof request.params!=='object')throw Error();}catch{socket.close(1008,'Invalid CDP request');return;}
    if(++client.queued>16){socket.close(1008,'Too many requests');return;}
    chain=chain.then(async()=>{
     try{if(!this.valid()||socket.readyState!==1)throw Error('Агент остановлен');const result=await this.command(request,client);if(this.valid())this.send(client,{id:request.id,result:result||{},...(request.sessionId?{sessionId:request.sessionId}:{})});}
     catch(error){this.send(client,{id:request.id,error:{code:-32000,message:String(error.message||'Command failed').slice(0,500)},...(request.sessionId?{sessionId:request.sessionId}:{})});}finally{client.queued--;}
    }).catch(()=>{socket.close(1011,'Request failed');});
   });
  });
  await new Promise((resolve,reject)=>{const error=e=>{this.server=null;this.ws.close();reject(e.code==='EADDRINUSE'?Error('Порт занят. Другой процесс не отключён; выберите иной порт.'):e);};this.server.once('error',error);this.server.listen(port,'127.0.0.1',()=>{this.server.removeListener('error',error);this.server.on('error',()=>this.stop());this.port=this.server.address().port;resolve();});});
  this.url='ws://127.0.0.1:'+this.port+'/devtools/browser/'+this.token;return{port:this.port,url:this.url};
 }
 send(client,value){const data=JSON.stringify(value);if(data.length>8*1024*1024)throw Error('CDP result limit exceeded');if(client.socket.readyState===1)client.socket.send(data);}
 stop(){for(const c of this.clients){this.onDisconnect(c);c.socket.terminate();}this.clients.clear();this.ws?.close();this.server?.close();this.server=null;this.url='';this.token='';}
}
module.exports={Gateway};

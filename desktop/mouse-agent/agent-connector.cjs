'use strict';
// External Node SDK. Copy the owner's per-session URL from Agent Mouse; never log it.
class AgentController{
 constructor(endpoint,{CDP,timeout=120000}={}){const u=new URL(endpoint);if(u.protocol!=='ws:'||u.hostname!=='127.0.0.1'||!/^\/devtools\/browser\/[a-f0-9]{64}$/.test(u.pathname))throw Error('Use the local session URL supplied by Mouse');this.endpoint=endpoint;this.CDP=CDP;this.timeout=timeout;this.sessions=new Map();}
 async connect(){let CDP=this.CDP;if(!CDP){try{CDP=require('./deps.cjs')('chrome-remote-interface')}catch{CDP=require('chrome-remote-interface')}}this.client=await CDP({target:this.endpoint,protocol:{version:{major:'1',minor:'3'},domains:[]}});return this;}
 async send(method,params={},sessionId){if(!this.client)throw Error('CDP is disconnected');let timer;try{return await Promise.race([this.client.send(method,params,sessionId),new Promise((_,reject)=>{timer=setTimeout(()=>{void this.close();reject(Error('CDP request timed out; connection closed'));},this.timeout);})]);}finally{clearTimeout(timer)}}
 async tabs(){return(await this.send('Target.getTargets')).targetInfos;}
 async open(url){return(await this.send('Target.createTarget',{url})).targetId;}
 async session(id){if(!this.sessions.has(id))this.sessions.set(id,(await this.send('Target.attachToTarget',{targetId:id,flatten:true})).sessionId);return this.sessions.get(id);}
 async activate(id){return this.send('Target.activateTarget',{targetId:id});}
 async dom(id){return this.send('DOM.getDocument',{depth:3,pierce:false},await this.session(id));}
 async read(id){return this.send('Mouse.read',{},await this.session(id));}
 async click(id,x,y){await this.activate(id);const s=await this.session(id);for(const type of ['mouseMoved','mousePressed','mouseReleased'])await this.send('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1},s);}
 async clickSelector(id,selector){await this.activate(id);const s=await this.session(id),{root}=await this.send('DOM.getDocument',{},s),{nodeId}=await this.send('DOM.querySelector',{nodeId:root.nodeId,selector},s);if(!nodeId)throw Error('Element not found');const {model}=await this.send('DOM.getBoxModel',{nodeId},s),q=model.content;return this.click(id,(q[0]+q[2]+q[4]+q[6])/4,(q[1]+q[3]+q[5]+q[7])/4);}
 async type(id,text){await this.activate(id);return this.send('Input.insertText',{text},await this.session(id));}
 async screenshot(id){await this.activate(id);return this.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},await this.session(id));}
 async terminal(command,{background=false}={}){return this.send('Mouse.terminal',{command,background});}
 async close(){const c=this.client;this.client=null;this.sessions.clear();if(c)await c.close().catch(()=>{});}
}
module.exports={AgentController};

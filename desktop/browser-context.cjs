'use strict';
class BrowserContext{
 constructor(browser){this.browser=browser;this.project='';this.board={};this.pages=[];this.actions=[];this.pending=null;this.timer=null;this.updatedAt=0}
 sync(){if(this.project!==this.browser.project){this.project=this.browser.project;this.board={};this.pages=[];this.actions=[];this.updatedAt=0}return this.project}
 update(board){this.sync();if(!board||board.project!==this.project)throw Error('Проект изменился');if(JSON.stringify(board).length>1000000)throw Error('Слишком большой контекст доски');this.board=structuredClone(board);this.updatedAt=Date.now();return{ok:true}}
 record(name,result){this.sync();this.actions.push({name,ok:result?.ok!==false,at:Date.now()});this.actions=this.actions.slice(-40)}
 invalidate(){this.pages=[];this.board={};this.actions=[];this.pending=null;this.updatedAt=0}
 async refresh(){const project=this.sync();if(!project)return this.snapshot();if(this.pending?.project===project)return this.pending.promise;
  const revision=this.browser.contextRevision||0;const request={project};request.promise=(async()=>{try{const pages=await this.browser.command('context',{all:true,automatic:true,includeChats:false});if(this.browser.project!==project||revision!==(this.browser.contextRevision||0))return this.snapshot();this.pages=pages;this.updatedAt=Date.now();return this.snapshot()}finally{if(this.pending===request)this.pending=null}})();this.pending=request;return request.promise;
 }
 snapshot(){this.sync();const state=this.browser.state(),allowed=id=>!this.browser.contextScope||this.browser.contextScope.includes(id),board=allowed('@canvas')?this.board:{},tabs=[...(state.tabs||[]),...(state.sessions||[])].filter(t=>allowed(t.id)),active=tabs.find(t=>t.id===board.activeTab)||tabs.find(t=>this.browser.tabs?.get(t.id)?.visible||t.visible),page=this.pages.find(p=>p.id===active?.id);
  return{schema:'osminog.browser-context/v2',project:this.project,updatedAt:this.updatedAt,url:page?.url||active?.url||'',title:page?.title||active?.title||'',tabs,dom:this.pages.filter(p=>allowed(p.id)),screenshot:{mode:'on-demand',tool:'browser_read',reason:'Fresh image and action token are captured when requested'},selection:board.selection||[],cursor:this.browser.pointerEnabled?this.browser.pointerCursor||null:null,pointing:require('./pointer-context.cjs').current(this.browser),canvas:board.canvas||{},actions:this.actions};
 }
 // Metadata stays live through state(); full DOM is read explicitly before each executor turn/action.
 start(){this.sync()}
 stop(){clearInterval(this.timer);this.timer=null}
}
module.exports={BrowserContext};

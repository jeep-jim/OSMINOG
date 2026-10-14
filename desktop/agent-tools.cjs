'use strict';
const {randomUUID}=require('node:crypto'),{readPage,providerFor}=require('./page-context.cjs'),{parsePlan}=require('./control.cjs');
class AgentTools{
 constructor(browser,control){this.browser=browser;this.control=control;this.snapshots=new Map()}
 stop(){this.snapshots.clear();this.control.stop()}
 target(id){const t=this.browser.get(String(id));if(providerFor(t.view.webContents.getURL()))throw Error('Инструмент вкладок не управляет чатом ИИ');return t}
 async run(name,args={}){
  const t=this.target(args.id),wc=t.view.webContents;
  if(name==='browser_read'){
   const initialProject=this.browser.project;
   if(!t.visible){await this.browser.win.webContents.executeJavaScript(`OSMINOGNativeBrowser.revealTab(${JSON.stringify(t.id)})`);for(let i=0;i<40&&!t.visible;i++)await new Promise(r=>setTimeout(r,50));if(this.browser.project!==initialProject)throw Error('Проект изменился');if(!t.visible)throw Error('Не удалось показать вкладку для управления')}

   const project=this.browser.project,url=wc.getURL(),navigationEpoch=t.navigationEpoch||0,bounds={width:t.bounds?.width,height:t.bounds?.height};
   const page=await wc.executeJavaScript(readPage);
   const image=t.visible&&bounds.width>0&&bounds.height>0?await wc.capturePage():null;
   if(this.browser.project!==project||wc.getURL()!==url||(t.navigationEpoch||0)!==navigationEpoch)throw Error('Страница изменилась во время чтения');
   const token=randomUUID();this.snapshots.set(token,{project,target:t.id,url,navigationEpoch,size:bounds,expires:Date.now()+120000});while(this.snapshots.size>64)this.snapshots.delete(this.snapshots.keys().next().value);
   return{ok:true,id:t.id,snapshot:token,visible:t.visible,size:bounds,page,...(image&&!image.isEmpty()?{image:{mimeType:'image/png',data:image.resize(bounds).toPNG().toString('base64')}}:{})};
  }
  if(name!=='browser_act')throw Error('Неизвестный инструмент вкладки');
  const snapshot=this.snapshots.get(args.snapshot);this.snapshots.delete(args.snapshot);
  if(!snapshot||snapshot.project!==this.browser.project||snapshot.target!==t.id||snapshot.url!==wc.getURL()||snapshot.navigationEpoch!==(t.navigationEpoch||0)||snapshot.expires<Date.now())throw Error('Нужен свежий browser_read перед действием');
  if(!t.visible||snapshot.size.width!==t.bounds.width||snapshot.size.height!==t.bounds.height)throw Error('Покажите вкладку и получите свежий снимок после изменения размера');
  if(this.control.busy||this.control.task?.plan)throw Error('Управление вкладкой уже выполняется');
  const plan=parsePlan(JSON.stringify({summary:'Действие из внутреннего чата',actions:args.actions}));
  const task={id:randomUUID(),approval:randomUUID(),project:snapshot.project,source:t.id,target:t.id,sourceURL:snapshot.url,targetURL:snapshot.url,navigationEpoch:snapshot.navigationEpoch,expires:snapshot.expires,size:snapshot.size,plan,history:[]};this.control.task=task;
  try{return{ok:true,...await this.control.approve({id:task.id,approval:task.approval})}}finally{if(this.control.task===task)this.control.task=null}
 }
}
module.exports={AgentTools};

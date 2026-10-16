'use strict';
const {randomUUID}=require('node:crypto'),{readPage,providerFor}=require('./page-context.cjs'),{parsePlan}=require('./control.cjs');
class AgentTools{
 constructor(browser,control){this.browser=browser;this.control=control;this.snapshots=new Map();this.autoExecute=false}
 stop(){this.snapshots.clear();this.control.stop()}
 target(id){if(this.browser.contextScope&&!this.browser.contextScope.includes(String(id)))throw Error('Источник закрыт: разрешите вкладку в настройках контекста');const t=this.browser.get(String(id));if(providerFor(t.view.webContents.getURL()))throw Error('Инструмент вкладок не управляет чатом ИИ');return t}
 async run(name,args={},options={}){
  if(name==='browser_context')return{ok:true,context:await this.browser.context.refresh()};
  const t=this.target(args.id),wc=t.view.webContents;
  if(name==='browser_read'){
   const revision=this.browser.contextRevision||0,initialProject=this.browser.project;
   if(!t.visible){await this.browser.win.webContents.executeJavaScript(`OSMINOGNativeBrowser.revealTab(${JSON.stringify(t.id)})`);for(let i=0;i<40&&!t.visible;i++)await new Promise(r=>setTimeout(r,50));if(this.browser.project!==initialProject)throw Error('Проект изменился');if(!t.visible)throw Error('Не удалось показать вкладку для управления')}

   for(let i=0;t.loading&&i<40;i++)await new Promise(r=>setTimeout(r,50));
   if(t.loading)throw Error('Страница ещё загружается; запросите browser_read повторно');
   if(revision!==(this.browser.contextRevision||0)||this.browser.project!==initialProject)throw Error('Проект или доступ изменился');
   const project=this.browser.project,url=wc.getURL(),navigationEpoch=t.navigationEpoch||0,bounds={width:t.bounds?.width,height:t.bounds?.height};
   const page=await wc.executeJavaScript(readPage);
   const includeScreenshot=args.includeScreenshot!==false||page.canvases?.length>0;
   let image=null,imageError='';if(includeScreenshot&&t.visible&&bounds.width>0&&bounds.height>0){try{image=await wc.capturePage(undefined,{stayAwake:true})}catch(e){imageError=String(e.message||e)}}
   if(revision!==(this.browser.contextRevision||0)||this.browser.project!==project||wc.getURL()!==url||(t.navigationEpoch||0)!==navigationEpoch)throw Error('Страница изменилась во время чтения');
   const token=randomUUID();this.snapshots.set(token,{revision,project,target:t.id,url,navigationEpoch,size:bounds,includeScreenshot,expires:Date.now()+120000});while(this.snapshots.size>64)this.snapshots.delete(this.snapshots.keys().next().value);
   return{ok:true,id:t.id,snapshot:token,visible:t.visible,size:bounds,page,...(imageError?{imageError}:{}),...(image&&!image.isEmpty()?{image:{mimeType:'image/png',data:image.resize(bounds).toPNG().toString('base64')}}:{})};
  }
  if(name!=='browser_act')throw Error('Неизвестный инструмент вкладки');
  const snapshot=this.snapshots.get(args.snapshot);this.snapshots.delete(args.snapshot);
  if(!snapshot||snapshot.revision!==(this.browser.contextRevision||0)||snapshot.project!==this.browser.project||snapshot.target!==t.id||snapshot.url!==wc.getURL()||snapshot.navigationEpoch!==(t.navigationEpoch||0)||snapshot.expires<Date.now())throw Error('Нужен свежий browser_read перед действием');
  if(!t.visible||snapshot.size.width!==t.bounds.width||snapshot.size.height!==t.bounds.height)throw Error('Покажите вкладку и получите свежий снимок после изменения размера');
  if(this.control.busy||this.control.task?.plan)throw Error('Управление вкладкой уже выполняется');
  const plan=parsePlan(JSON.stringify({summary:'Действие из внутреннего чата',actions:args.actions}));
  if(plan.actions.length!==1)throw Error('Автопилот выполняет одно действие за шаг; после него возвращает свежий снимок');
  const task={autoExecute:true,manualConfirm:options.autoExecute!==true,contextRevision:snapshot.revision,id:randomUUID(),approval:randomUUID(),project:snapshot.project,source:t.id,target:t.id,sourceURL:snapshot.url,targetURL:snapshot.url,navigationEpoch:snapshot.navigationEpoch,expires:snapshot.expires,size:snapshot.size,plan,history:[]};this.control.task=task;
  let result;
  try{result={ok:true,...await this.control.approve({id:task.id,approval:task.approval})}}
  catch(e){result={ok:false,error:e.message,code:e.code||'ACTION_FAILED',stack:e.stack}}
  finally{if(this.control.task===task)this.control.task=null}
  // Return observed state even after a failed action. Input delivery is not task success.
  if(snapshot.project!==this.browser.project||snapshot.revision!==(this.browser.contextRevision||0))throw Error('Проект или доступ изменился');
  try{
   const after=await this.run('browser_read',{id:t.id,includeScreenshot:snapshot.includeScreenshot});
   result={...result,observation:{...after,image:undefined},...(after.image?{image:after.image}:{}),verificationRequired:true};
  }catch(e){result.observationError=e.message;result.verificationRequired=true}
  this.browser.context?.record(name,{ok:result.ok,completed:result.completed,error:result.error});return result
 }
}
module.exports={AgentTools};

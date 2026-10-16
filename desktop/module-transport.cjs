'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const READ=new Set(['module_status','github_status','github_list_tree','github_search_code','github_fetch_file','github_compare','github_workflow_runs','github_get_workflow_runs']);
const WRITE=new Set(['github_create_branch','github_commit_files','github_open_pr']);
const REPOS=['jeep-jim/OSMINOG','jeep-jim/OSMINOG-Releases'];
class ModuleTransport{
 constructor(browser,{fetch,confirm,source}={}){
  this.scope=new (require('node:async_hooks').AsyncLocalStorage)();this.browser=browser;this.fetch=fetch||((url,options)=>browser.session.fetch(url,options));
  this.confirm=confirm|| (async details=>{const r=await require('electron').dialog.showMessageBox(browser.win,{type:'question',buttons:['Отмена','Разрешить изменение'],defaultId:0,cancelId:0,title:'Посейдон · GitHub',message:'Разрешить эти изменения?',detail:details});return r.response===1});
  source=source||fs.readFileSync(path.join(__dirname,'board/background.js'),'utf8');const start=source.indexOf('async function bcModuleTool('),end=source.indexOf('const OSMINOG_BROWSER_HUB_KEY=',start);if(start<0||end<start)throw Error('Module transport source boundaries changed');
  const context=vm.createContext({fetch:(url,options)=>this.request(url,options),crypto:require('node:crypto').webcrypto,URL,URLSearchParams,TextEncoder,TextDecoder,atob,btoa,chrome:{storage:{local:{get:keys=>browser.store.get(keys)}}}});
  vm.runInContext(source.slice(start,end)+'\nglobalThis.moduleTool=bcModuleTool',context,{filename:'bundled-module-transport.js'});this.tool=context.moduleTool;this.busy=false;
 }
 async request(url,options={}){const u=new URL(url);if(u.origin!=='https://api.github.com'||u.username||u.password)throw Error('Unsupported module endpoint');const project=this.scope.getStore();if(project&&this.browser.project!==project)throw Error('Проект изменился');const result=await this.fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(20000)});if(project&&this.browser.project!==project)throw Error('Проект изменился');return result}
 async verify(token){
  if(typeof token!=='string'||!token.trim())throw Error('Подключите GitHub в настройках Посейдона');
  const headers={Authorization:'Bearer '+token.trim(),Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  const read=async pathname=>{const r=await this.request('https://api.github.com'+pathname,{headers});if(!r.ok)throw Error('GitHub HTTP '+r.status);return r.json()};
  const user=await read('/user'),checks=[];
  for(const repo of REPOS){const data=await read('/repos/'+repo),p=data.permissions||{};checks.push({repo,visible:true,write:!!(p.admin||p.maintain||p.push)})}
  const ok=checks.every(x=>x.write);return{ok,accountOk:true,name:user.login||'GitHub',owner:{ok,checks,repositories:REPOS},...(!ok?{error:'Требуется write-доступ к OSMINOG и OSMINOG-Releases'}:{})};
 }
 async handle(message,project){return this.scope.run(project,()=>this.run(message,project))}
 async run(message,project){
  if(this.browser.project!==project)throw Error('Проект изменился');
  if(message.type==='BC_MODULE_TEST'){if(message.module!=='github')throw Error('Этот модуль ещё не перенесён');return this.verify(message.token)}
  const name=String(message.name||'');if(!READ.has(name)&&!WRITE.has(name))throw Error('Этот инструмент ещё не перенесён: '+name);
  const args=structuredClone(message.args||{});delete args.__ownerApproved;
  if(!WRITE.has(name))return this.tool(name,args);
  if(this.busy)throw Error('Предыдущая операция GitHub ещё выполняется');this.busy=true;
  try{
   const stored=await this.browser.store.get('briefCraftModulesV1'),token=stored?.briefCraftModulesV1?.github?.token;
   const verified=await this.verify(token);if(!verified.ok)throw Error(verified.error);
   if(this.browser.project!==project)throw Error('Проект изменился');
   // The native confirmation is outside model/page DOM. A model-supplied approval flag is ignored.
   const proposal=JSON.stringify({...args,tool:name},null,2);if(proposal.length>100000)throw Error('Изменение слишком велико для просмотра; разделите его');
   if(!await this.confirm(proposal))return{ok:false,canceled:true,error:'Изменение отменено владельцем'};
   if(this.browser.project!==project)throw Error('Проект изменился после подтверждения');
   const current=await this.browser.store.get('briefCraftModulesV1');if(current?.briefCraftModulesV1?.github?.token!==token)throw Error('Подключение GitHub изменилось');
   return this.tool(name,{...args,__ownerApproved:true});
  }finally{this.busy=false}
 }
}
module.exports={ModuleTransport};

'use strict';
const {randomUUID}=require('node:crypto');
const {parsePlan}=require('./control.cjs');
const {providerFor}=require('./page-context.cjs');
// Passive observation of a fresh user send. Nothing is written back to the website.
class OriginalActions{
 constructor(browser,providers,{confirm,status=()=>{}}){Object.assign(this,{browser,providers,confirm,status});this.turns=new Map();this.epoch=0}
 stop(){this.epoch++;this.turns.clear()}
 async observe(tab,text){
  const provider=providerFor(tab.view.webContents.getURL());if(!provider||!text?.trim())return;
  const old=this.turns.get(tab.id);if(old&&old.text===text&&Date.now()-old.at<1500)return;
  const t={id:randomUUID(),text,at:Date.now(),epoch:this.epoch,project:this.browser.project,origin:new URL(tab.view.webContents.getURL()).origin};this.turns.set(tab.id,t);
  const guard=()=>{if(this.turns.get(tab.id)!==t||this.epoch!==t.epoch||this.browser.project!==t.project||tab.project!==t.project||tab.view.webContents.isDestroyed()||new URL(tab.view.webContents.getURL()).origin!==t.origin||(t.route&&tab.view.webContents.getURL().split('?')[0]!==t.route))throw Error('Задача отменена: чат или проект изменился')};
  try{
   const prepared=await this.providers.dispatch({...tab,provider},{type:'BC_PROVIDER_DIRECT_PREPARE',requestId:t.id,text});guard();if(!prepared?.ok)throw Error(prepared?.error||'Не удалось прочитать новый ответ');
   const reply=await this.providers.dispatch({...tab,provider},{type:'BC_PROVIDER_DIRECT_WAIT',requestId:t.id});guard();if(!reply?.ok)throw Error(reply?.error||'Новый ответ не получен');
   t.route=tab.view.webContents.getURL().split('?')[0];const raw=require('./control-plan.cjs')(reply.answer);
   if(!raw){this.status('Ответ чата получен. Команд для выполнения в нём нет.');return}
   const plan=parsePlan(raw);if(!plan.actions.length){this.status(plan.summary);return}
   const targets=[...this.browser.tabs.values(),...this.browser.providers.values()].filter(x=>x.project===t.project&&x.id!==tab.id&&!providerFor(x.view.webContents.getURL()));
   if(!targets.length)throw Error('Откройте вкладку, в которой нужно выполнить действия');
   // A target is chosen by the user in the same confirmation as the action list.
   const states=new Map(targets.map(x=>[x.id,{url:x.view.webContents.getURL(),epoch:x.navigationEpoch||0}]));
   const decision=await this.confirm({summary:plan.summary,actions:plan.actions,targets:targets.map(x=>({id:x.id,title:x.title,url:x.view.webContents.getURL()}))});guard();
   if(!decision?.id){this.status('Действия отменены');return}
   if(!targets.some(x=>x.id===decision.id))throw Error('Выбрана неизвестная вкладка');
   // Coordinates from an ordinary chat have no trusted old snapshot. Require the
   // user's explicit review each turn, then use a fresh host snapshot for execution.
   const target=this.browser.get(decision.id),state=states.get(decision.id);if(target.view.webContents.getURL()!==state.url||(target.navigationEpoch||0)!==state.epoch)throw Error('Страница изменилась во время подтверждения');
   const snapshot=await this.browser.agentTools.run('browser_read',{id:decision.id});guard();
   const result=await this.browser.agentTools.run('browser_act',{id:decision.id,snapshot:snapshot.snapshot,actions:plan.actions});guard();
   this.status(`Выполнено действий: ${result.completed}. ${plan.summary}`);
  }catch(e){if(this.turns.get(tab.id)===t&&this.epoch===t.epoch)this.status('Не выполнено: '+e.message)}finally{if(this.turns.get(tab.id)===t)this.turns.delete(tab.id)}
 }
}
module.exports={OriginalActions};

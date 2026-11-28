'use strict';
function install({ipcMain,trusted,service,isPrivate=()=>false}){
 const state=()=>({...service.state(),privateMode:!!isPrivate()});
 ipcMain.handle('mouse:adblock-subscriptions',async(event,action,args)=>{
  trusted(event);
  if(action==='state')return state();
  if(!['refresh','add','toggle','remove'].includes(action))throw Error('Неизвестная команда списков фильтров');
  const guard=()=>{if(isPrivate())throw Object.assign(Error('Списки фильтров меняются в обычном режиме'),{code:'MOUSE_ADBLOCK_PRIVATE'});return true;};
  guard();
  if(args!==undefined&&(!args||typeof args!=='object'||Array.isArray(args)))throw Error('Некорректные параметры списка');
  const values=args||{};
  if(action==='refresh')await service.manualRefresh(values.id,{guard});
  if(action==='add')await service.addSubscription({url:values.url,name:values.name},{guard});
  if(action==='toggle')await service.setSubscriptionEnabled(values.id,values.enabled,{guard});
  if(action==='remove')await service.removeSubscription(values.id,{guard});
  return state();
 });
 return{state};
}
module.exports={install};

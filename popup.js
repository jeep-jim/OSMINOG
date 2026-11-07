'use strict';
const $=id=>document.getElementById(id);let stagedVersion=null,busy=false;
$('version').textContent='v'+chrome.runtime.getManifest().version;
async function status(){
  const data=await chrome.storage.local.get(['osminogCollectorV1','osminogToday']),config=data.osminogCollectorV1||{},counter=data.osminogToday;
  $('captureDot').classList.toggle('active',config.enabled===true);
  if(!stagedVersion)$('status').textContent=config.error|| (config.enabled?'Автосбор работает в фоне':config.enabled===false?'Автосбор приостановлен':'Откройте стол, чтобы начать сбор');
  const count=counter?.day===new Date().toLocaleDateString('en-CA')?Number(counter.count)||0:0;
  $('todayCount').textContent=`Сегодня: ${count} · Поиск по всем столам`;
}
const stagedCheck=(async()=>{try{const installed=await OSMINOGUpdateHandoff.installedManifest();if(OSMINOGUpdateHandoff.compare(installed.version,chrome.runtime.getManifest().version)>0){stagedVersion=installed.version;document.documentElement.dataset.pendingUpdate=stagedVersion;$('open').firstChild.textContent='Завершить обновление ';$('today').disabled=true;$('status').textContent=`Файлы v${stagedVersion} готовы. Перезапустится расширение.`}}catch(error){console.warn('OSMINOG pending update:',error.message)}})();
$('open').onclick=async()=>{if(busy)return;busy=true;$('open').disabled=true;try{await stagedCheck;if(stagedVersion){await OSMINOGUpdateHandoff.prepare({from:chrome.runtime.getManifest().version,to:stagedVersion});chrome.runtime.reload()}else{const result=await chrome.runtime.sendMessage({type:'OPEN_EDITOR',query:'view=desk'});if(result?.ok===false)throw Error(result.error);close()}}catch(error){$('status').textContent=error.message;busy=false;$('open').disabled=false}};
$('today').onclick=async()=>{await chrome.runtime.sendMessage({type:'OPEN_EDITOR',query:'view=inbox'});close()};
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&(changes.osminogCollectorV1||changes.osminogToday))status().catch(()=>{})});
status().catch(error=>$('status').textContent=error.message);

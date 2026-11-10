importScripts('store.js');
let wanted=[],running=false,epoch=0;
onmessage=e=>{wanted=(e.data.ids||[]).slice(0,24);epoch=e.data.epoch;pump()};
async function pump(){if(running)return;running=true;try{while(wanted.length){const id=wanted.shift(),generation=epoch;try{let blob=await LightStore.file('thumb:'+id);if(!blob)throw Error('Для этого файла нет безопасного превью. Откройте карточку или скачайте оригинал.');postMessage({id,blob,epoch:generation})}catch(e){postMessage({id,error:e.message,epoch:generation})}await new Promise(r=>setTimeout(r,0))}}finally{running=false}}

'use strict';
const sink=document.querySelector('#clipboard');let busy=false,baseline=true,last='',pasteSeen=false;
const dataURL=f=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(f)});
async function ingest(kind,value){if(!value)return;const signature=kind+'\n'+value;if(baseline){last=signature;baseline=false;return}if(signature===last)return;const result=await chrome.runtime.sendMessage({type:'OSMINOG_COLLECTOR_CAPTURE',kind,value});if(result?.ok)last=signature;else if(result?.error)throw Error(result.error)}
sink.addEventListener('paste',e=>{e.preventDefault();pasteSeen=true;const f=[...e.clipboardData.files].find(f=>/^image\//.test(f.type));const task=f?dataURL(f).then(v=>ingest('image',v)):ingest('text',e.clipboardData.getData('text/plain'));task.catch(report)});
function report(e){chrome.runtime.sendMessage({type:'OSMINOG_COLLECTOR_ERROR',error:e.message}).catch(()=>{})}
async function tick(){if(busy)return;busy=true;try{pasteSeen=false;sink.focus();document.execCommand('paste');if(!pasteSeen){const items=await navigator.clipboard.read();let found=false;for(const item of items){const type=item.types.find(t=>/^image\/(png|jpeg|webp)$/.test(t));if(type){await ingest('image',await dataURL(await item.getType(type)));found=true;break}if(item.types.includes('text/plain')){await ingest('text',await(await item.getType('text/plain')).text());found=true;break}}if(!found)baseline=false}}catch(e){report(e)}finally{busy=false;sink.replaceChildren()}}
tick();setInterval(tick,1500);

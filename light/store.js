/* Bounded local storage: card metadata and original bytes never share a record. */
(()=>{'use strict';
const NAME='osminog-light-v1',CELL=512,MAX_FILE=32*1024*1024,MAX_TEXT=1024*1024;
let opening,previewSerial=Promise.resolve();const bus=typeof BroadcastChannel==='function'?new BroadcastChannel(NAME):null;
const req=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
function open(){return opening||=(new Promise((resolve,reject)=>{const r=indexedDB.open(NAME,1);r.onupgradeneeded=()=>{const d=r.result,c=d.createObjectStore('cards',{keyPath:'id'});c.createIndex('grid',['desk','cx','cy']);c.createIndex('desk',['desk','at','id']);d.createObjectStore('files');d.createObjectStore('desks',{keyPath:'id'});d.createObjectStore('prefs')};r.onsuccess=()=>resolve(r.result);r.onerror=()=>{opening=null;reject(r.error)}}))}
async function tx(names,mode,fn){const t=(await open()).transaction(names,mode),done=new Promise((r,j)=>{t.oncomplete=r;t.onabort=t.onerror=()=>j(t.error||Error('Не удалось сохранить'))});done.catch(()=>{});try{const v=await fn(t);await done;return v}catch(e){try{t.abort()}catch{}await done.catch(()=>{});throw e}}
const pref=k=>tx(['prefs'],'readonly',t=>req(t.objectStore('prefs').get(k)));
const setPref=(k,v)=>tx(['prefs'],'readwrite',t=>req(t.objectStore('prefs').put(v,k)));
const file=id=>tx(['files'],'readonly',t=>req(t.objectStore('files').get(id)));
const card=id=>tx(['cards'],'readonly',t=>req(t.objectStore('cards').get(id)));
const desks=()=>tx(['desks'],'readonly',t=>req(t.objectStore('desks').getAll()));
const changed=()=>bus?.postMessage({changed:true});
const month=()=>new Date().toISOString().slice(0,7);
// Payment integration is deliberately absent. Only a future verified entitlement may select Pro.
const plans={free:{screenshots:100,desks:3,archive:false},pro:{screenshots:10000,desks:1000,archive:true,priceUSD:6.99}};
async function entitlement(){return {plan:'free',...plans.free,billingReady:false}}
async function createDesk(name,id=crypto.randomUUID(),legacy=false){if(!String(name).trim())throw Error('Укажите название');const p=await entitlement();return tx(['desks'],'readwrite',async t=>{const s=t.objectStore('desks');if(await req(s.get(id)))return id;if(!legacy&&await req(s.count())>=p.desks)throw Error('Free: до 3 столов. Pro готовится к запуску.');await req(s.put({id,name:String(name).trim().slice(0,100)}));changed();return id})}
async function init(){await open();if(!(await desks()).length)await createDesk('Мои материалы','inbox');return desks()}
async function add({desk='inbox',name='',text,blob,id=crypto.randomUUID(),x,y,legacy=false,kind}){
 if(blob&&(!(blob instanceof Blob)||blob.size>MAX_FILE))throw Error('Один файл — до 32 МБ. Оригинал не сохранён.');
 if(text!==undefined&&String(text).length>MAX_TEXT)throw Error('Текст — до 1 млн символов. Разделите его на части.');
 const isText=text!==undefined,mime=isText?'text/plain':blob?.type||'application/octet-stream';
 if(!isText&&!blob)throw Error('Нет содержимого');
 const body=isText?new Blob([String(text)],{type:'text/plain;charset=utf-8'}):blob;
 const p=await entitlement(),at=Date.now(),image=mime.startsWith('image/');
 if(await card(id))return id;
 if(image&&!legacy&&(await pref('usage:'+month())||0)>=p.screenshots)throw Object.assign(Error('Достигнут лимит Free: 100 изображений в месяц.'),{code:'MONTHLY_LIMIT'});
 let thumb=null;if(image&&globalThis.LightMedia){const decode=async()=>{try{return await LightMedia.preview(body)}catch{return null}};if(globalThis.navigator?.locks)thumb=await navigator.locks.request('osminog-light-image-decode',decode);else{const run=previewSerial.then(decode);previewSerial=run.catch(()=>null);thumb=await run}}
 const result=await tx(['cards','files','prefs','desks'],'readwrite',async t=>{
  const c=t.objectStore('cards'),f=t.objectStore('files'),s=t.objectStore('prefs');
  if(await req(c.get(id)))return id;if(!await req(t.objectStore('desks').get(desk)))throw Error('Стол не найден');
  const key='usage:'+month(),usage=await req(s.get(key))||0;
  if(image&&!legacy&&usage>=p.screenshots)throw Error('Достигнут лимит Free: 100 скриншотов в месяц. Сохранённые материалы доступны. Pro ещё не продаётся.');
  const ordinal=await req(s.get('position:'+desk))||0;
  x=Number.isFinite(x)?x:ordinal%6*300;y=Number.isFinite(y)?y:Math.floor(ordinal/6)*250;
  const row={id,desk,name:String(name|| (isText?String(text).slice(0,70):'Изображение')).slice(0,160),preview:isText?String(text).slice(0,512):'',mime,kind:kind||(isText?'text':image?'image':'file'),size:body.size,at,x,y,cx:Math.floor(x/CELL),cy:Math.floor(y/CELL)};
  await req(f.put(body,id));if(thumb)await req(f.put(thumb,'thumb:'+id));await req(c.put(row));await req(s.put(ordinal+1,'position:'+desk));
  if(image&&!legacy)await req(s.put(usage+1,key));return id;
 });changed();return result;
}
async function move(id,x,y){if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Неверные координаты');await tx(['cards'],'readwrite',async t=>{const s=t.objectStore('cards'),v=await req(s.get(id));if(!v)return;await req(s.put({...v,x,y,cx:Math.floor(x/CELL),cy:Math.floor(y/CELL)}))});changed()}
async function edit(id,text,name){if(text.length>MAX_TEXT)throw Error('Текст — до 1 млн символов');await tx(['cards','files'],'readwrite',async t=>{const s=t.objectStore('cards'),v=await req(s.get(id));if(!v||v.kind!=='text')throw Error('Текст не найден');const b=new Blob([text],{type:'text/plain;charset=utf-8'});await req(t.objectStore('files').put(b,id));await req(s.put({...v,name:String(name||text.slice(0,70)||'Заметка').slice(0,160),preview:text.slice(0,512),size:b.size}))});changed()}
async function remove(id){await tx(['cards','files'],'readwrite',async t=>{await req(t.objectStore('cards').delete(id));await req(t.objectStore('files').delete(id));await req(t.objectStore('files').delete('thumb:'+id))});changed()}
async function viewport(desk,area){const rows=[];await tx(['cards'],'readonly',async t=>{const idx=t.objectStore('cards').index('grid');let cells=0;for(let cx=Math.floor((area.x-280)/CELL);cx<=Math.floor((area.x+area.w)/CELL);cx++)for(let cy=Math.floor((area.y-230)/CELL);cy<=Math.floor((area.y+area.h)/CELL);cy++){if(++cells>256||rows.length>=120)return;const found=await req(idx.getAll(IDBKeyRange.only([desk,cx,cy]),120-rows.length));for(const row of found)if(row.x+280>=area.x&&row.x<=area.x+area.w&&row.y+230>=area.y&&row.y<=area.y+area.h)rows.push(row)}});return rows.slice(0,120)}
async function page({desk,after=null,q='',kind='',limit=40}={}){limit=Math.min(100,Math.max(1,limit));q=String(q).toLocaleLowerCase().slice(0,200);return tx(['cards'],'readonly',t=>new Promise((resolve,reject)=>{const idx=t.objectStore('cards').index('desk'),lower=after||[desk,0,''],range=IDBKeyRange.bound(lower,[desk,Number.MAX_SAFE_INTEGER,'\uffff'],!!after),r=idx.openCursor(range);const rows=[];let scanned=0,last=after;r.onerror=()=>reject(r.error);r.onsuccess=()=>{const c=r.result;if(!c)return resolve({rows,next:null});const v=c.value;last=c.key;if((!kind||v.kind===kind)&&(!q||(v.name+' '+v.preview).toLocaleLowerCase().includes(q)))rows.push(v);if(rows.length>=limit||++scanned>=500)return resolve({rows,next:last});c.continue()}}))}
async function thumbnail(id,blob){return tx(['files'],'readwrite',t=>req(t.objectStore('files').put(blob,'thumb:'+id)))}
async function usage(){return {month:month(),used:await pref('usage:'+month())||0,...await entitlement()}}
globalThis.LightStore={init,desks,createDesk,add,card,file,move,edit,remove,viewport,page,pref,setPref,thumbnail,usage,entitlement,plans,bus,MAX_FILE,MAX_TEXT};
})();

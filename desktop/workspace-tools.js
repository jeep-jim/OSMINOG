'use strict';
(function(root){
 const names=['readFile','writeFile','canvas.create','canvas.duplicate','canvas.move','canvas.copy','canvas.paste','canvas.inspect','agent.say','agent.ask'];
 function create(env){let asking=false,clipboard=null;return{names,async run(name,args={}){
  if(!names.includes(name))throw Error('Unknown workspace tool');
  if(!args||typeof args!=='object'||Array.isArray(args))throw Error('Expected tool arguments');
  const project=env.project();if(!project)throw Error('Откройте проект');
  const guard=()=>{if(env.project()!==project)throw Error('Проект изменился')};
  const access=await env.scope();guard();const scope=access.ids;if(scope!==null&&!scope?.includes('@canvas'))throw Error('Рабочий стол отключён в настройках контекста');
  const check=async()=>{const current=await env.scope();guard();if(current.revision!==access.revision||JSON.stringify(current.ids)!==JSON.stringify(access.ids))throw Error('Доступ к контексту изменился')};
  const objects=()=>env.objects();
  const object=id=>{const o=objects().find(o=>o.id===id);if(!o)throw Error('Объект не найден в текущем проекте');return o};
  const observe=async(ids=[])=>{const revision=await env.snapshot();await check();return{project,revision,total:objects().length,objects:[...objects().filter(o=>ids.includes(o.id)),...objects().filter(o=>!ids.includes(o.id))].slice(0,200).map(o=>({id:o.id,type:o.type,name:o.name,fileName:o.fileName,x:o.x,y:o.y,w:o.w,h:o.h,text:String(o.text||'').slice(0,500)}))}};
  const apply=async actions=>{const expected=await env.snapshot();await check();const result=await env.apply({project,expected,summary:name,actions});guard();return{...result,observation:await observe([...(result.createdIds||[]),...actions.map(a=>a.target).filter(Boolean)])}};
  const number=value=>{if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>1000000)throw Error('Нужна конечная координата');return value};
  if(name==='canvas.inspect')return{ok:true,...await observe()};
  if(name==='canvas.copy'){
   const ids=Array.isArray(args.ids)?args.ids:[args.id];if(!ids.length||ids.length>40||ids.some(id=>typeof id!=='string'))throw Error('Укажите от 1 до 40 id объектов');
   const copied=[...new Set(ids)].map(id=>structuredClone(object(id)));
   if(JSON.stringify(copied).length>16*1024*1024)throw Error('Копия превышает 16 МиБ');
   await check();clipboard={project,revision:access.revision,objects:copied};return{ok:true,copied:copied.map(o=>({id:o.id,type:o.type,name:o.name})),clipboard:'project-local'};
  }
  if(name==='canvas.paste'){
   if(!clipboard||clipboard.project!==project||clipboard.revision!==access.revision)throw Error('Сначала скопируйте объекты в этом проекте');
   const dx=args.dx===undefined?24:number(args.dx),dy=args.dy===undefined?24:number(args.dy),actions=[];
   // Files use asset import in canvas.duplicate; do not partially paste a mixed batch.
   if(clipboard.objects.length===1&&clipboard.objects[0].type==='file'){const o=clipboard.objects[0];await check();const result=await env.importAsset({dataUrl:o.src,name:o.name,fileName:o.fileName,mime:o.mime,size:o.size,x:number(o.x||0)+dx,y:number(o.y||0)+dy,w:o.w,h:o.h});guard();return{...result,observation:await observe([result.object?.id])}}
   if(clipboard.objects.some(o=>o.type==='file'))throw Error('Файлы дублируются через canvas.duplicate; вставка набора поддерживает объекты макета и изображения');
   for(const o of clipboard.objects){const properties=structuredClone(o);delete properties.id;delete properties.group;properties.x=number(o.x)+dx;properties.y=number(o.y)+dy;actions.push({op:'create',objectType:o.type,properties})}
   return apply(actions);
  }
  if(name==='readFile'){
   const matches=args.id?[object(String(args.id))]:objects().filter(o=>(o.fileName||o.name)===args.name&&['file','image'].includes(o.type));
   if(matches.length!==1)throw Error('Укажите id файла с доски: имя не найдено или неоднозначно');
   const r=await env.read({id:matches[0].id,include_data:!!args.include_data,max_chars:args.max_chars,offset:args.offset});guard();return r;
  }
  if(name==='writeFile'){
   const name=String(args.name||args.path||'').trim();if(!name||name.length>160||/[\\/\x00-\x1f]/.test(name)||name==='.'||name==='..')throw Error('Укажите имя файла на доске без пути ОС');
   if(typeof args.content!=='string'||args.content.length>8*1024*1024)throw Error('Содержимое файла должно быть строкой до 8 МиБ');
   const mime=String(args.mime||'text/plain');if(!/^[\w.+-]+\/[\w.+-]+$/.test(mime))throw Error('Неверный MIME-тип');
   if(args.encoding&&args.encoding!=='utf-8'&&args.encoding!=='base64')throw Error('Поддерживаются utf-8 и base64');
   let bytes;if(args.encoding==='base64'){const binary=atob(args.content);bytes=Uint8Array.from(binary,c=>c.charCodeAt(0))}else bytes=new TextEncoder().encode(args.content);
   if(bytes.length>8*1024*1024)throw Error('Файл превышает 8 МиБ');
   let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
   await check();const result=await env.importAsset({name,fileName:name,mime,size:bytes.length,dataUrl:'data:'+mime+';base64,'+btoa(binary),...(args.x===undefined?{}:{x:number(args.x)}),...(args.y===undefined?{}:{y:number(args.y)})});guard();return result;
  }
  if(name==='canvas.create')return apply([{op:'create',objectType:String(args.type||'shape'),properties:args.properties||{}}]);
  if(name==='canvas.move'){const o=object(String(args.id));return apply([{op:'set',target:o.id,properties:{x:number(args.x),y:number(args.y)}}])}
  if(name==='canvas.duplicate'){
   const o=object(String(args.id)),properties=structuredClone(o);delete properties.id;delete properties.group;
   properties.x=number(o.x)+(args.dx===undefined?24:number(args.dx));properties.y=number(o.y)+(args.dy===undefined?24:number(args.dy));
   if(o.type==='file'){await check();const result=await env.importAsset({dataUrl:o.src,name:o.name,fileName:o.fileName,mime:o.mime,size:o.size,x:properties.x,y:properties.y,w:o.w,h:o.h});guard();return result}
   return apply([{op:'create',objectType:o.type,properties}]);
  }
  const message=String(args.message||'').trim();if(!message||message.length>24000)throw Error('Сообщение должно содержать от 1 до 24000 символов');
  if(name==='agent.say'){const r=await env.say({agentId:args.agentId,message,projectId:project});guard();return r}
  if(asking)throw Error('Уже ожидается ответ агента; вложенные вызовы agent.ask запрещены');
  asking=true;try{const r=await env.ask(String(args.agentId||'main'),message,{fullProject:true,execute:false,mode:'council'});guard();if(!r?.ok)throw Error(r?.error||'Агент не ответил');await env.say({agentId:r.thread.id,message:r.text,projectId:project});guard();return r}finally{asking=false}
 }}}
 if(typeof module!=='undefined'&&module.exports)module.exports={create,names};
 else root.OSMINOGWorkspaceTools=create({project:()=>root.project?.()?.id,objects:()=>root.objects?.()||[],scope:async()=>{const s=await root.OSMINOGNative.browser('state');if(s.project!==root.project?.()?.id)throw Error('Проект изменился');return {ids:s.contextScope,revision:s.contextRevision}},snapshot:()=>root.OSMINOGDirectCanvas.snapshot(),apply:p=>root.OSMINOGDirectCanvas.apply(p),read:a=>root.BriefCraftBridge.executeTool('read_asset',a),importAsset:a=>root.OSMINOGProjectAPI.importAsset(a),say:a=>root.OSMINOGTeamAPI.say(a),ask:(...a)=>root.OSMINOGAgentAPI.ask(...a)});
})(globalThis);

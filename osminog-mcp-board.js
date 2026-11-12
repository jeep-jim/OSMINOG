/* Live board adapter. Runs only in the editor, never in chatgpt.com or content scripts. */
(function(root){
  'use strict';
  const C=root.OSMINOGMCPContract||(typeof require==='function'?require('./osminog-mcp-contract.js'):null);
  const clone=v=>JSON.parse(JSON.stringify(v));
  function createExecutor(env,grant){
    const board=env.project();
    function guard(deadline){
      if(!grant.active()||env.project()!==board||board?.id!==grant.projectId)throw Error('CONNECTION_REVOKED_OR_PROJECT_CHANGED');
      if(!Number.isFinite(deadline)||Date.now()>=deadline)throw Error('REQUEST_EXPIRED');
    }
    async function execute(request){
      let changed=false,objectId;
      try{
        const {tool,args,deadline,projectId}=request;
        C.validate(tool,args);guard(deadline);
        if(projectId!==grant.projectId||args.projectId&&args.projectId!==grant.projectId)throw Error('WRONG_PROJECT');
        const before=env.status();let result;
        if(C.isWrite(tool)){
          if(grant.role!=='edit')throw Error('READ_ONLY');
          const orderedArgs=Object.fromEntries(Object.keys(args).sort().map(key=>[key,args[key]]));
          const fingerprint=await env.digest(JSON.stringify({tool,args:orderedArgs}));guard(deadline);
          board.osminogMcpReceipts=board.osminogMcpReceipts||[];
          const previous=board.osminogMcpReceipts.find(r=>r.key===args.requestKey);
          if(previous){
            if(previous.fingerprint!==fingerprint)throw Error('REQUEST_KEY_CONFLICT: reuse identical arguments');
            if(!previous.persisted){await env.save();guard(deadline);previous.persisted=true;}
            return{ok:true,...previous.result,persisted:true,replayed:true,currentRevision:env.status().revision,objectStillExists:!!env.object(previous.result.id)};
          }
          if(board.osminogMcpReceipts.length>=256)throw Error('RECEIPT_LIMIT: pilot retains 256 write receipts per board; no automatic eviction');
          if(args.expectedRevision!==env.status().revision)throw Error('REVISION_CONFLICT: read the board again before editing');
          if(tool==='create_canvas_note'){
            const anchor=args.anchorId?env.object(args.anchorId):null;if(args.anchorId&&!anchor)throw Error('ANCHOR_NOT_FOUND');
            const v=env.status().view.bounds;
            const x=anchor?anchor.x+anchor.w+32:(v.x1+v.x2)/2-240,y=anchor?anchor.y:(v.y1+v.y2)/2-160;
            const o=env.create({name:args.name,text:args.text,x,y,w:480,h:320});objectId=o?.id;
            if(!objectId)throw Error('NOTE_CREATION_FAILED');
          }else{
            const o=env.object(args.id);if(!o||!['note','text','brief'].includes(o.type))throw Error('NOT_A_TEXT_NOTE');
            objectId=o.id;env.update(o,{name:args.name,text:args.text});
          }
          changed=true;
          const receipt={key:args.requestKey,fingerprint,persisted:false,result:{id:objectId,projectId:grant.projectId,revision:env.status().revision,applied:true,appliedAt:new Date().toISOString()}};
          board.osminogMcpReceipts.push(receipt);
          // The persisted marker remains false on disk until a subsequent save.
          // After reload a replay verifies persistence again without duplicating the note.
          await env.save();guard(deadline);receipt.persisted=true;
          result={ok:true,...receipt.result,persisted:true};
        }else if(tool==='read_canvas_image'){
          const o=env.object(args.id);if(!o||o.type!=='image')throw Error('NOT_AN_IMAGE');
          const src=o.src;
          if(typeof src!=='string'||!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(src))throw Error('EMBEDDED_RASTER_REQUIRED: remote URLs and SVG are not fetched by this tool');
          if(src.length>32*1024*1024)throw Error('IMAGE_TOO_LARGE');
          const image=await env.image(src,args.max_size||2048);guard(deadline);
          if(env.object(args.id)!==o||o.src!==src)throw Error('OBJECT_CHANGED_DURING_READ');
          result={ok:true,id:o.id,image,rendering:'embedded source pixels; canvas masks, filters and surrounding annotations are not included'};
        }else{
          if(tool==='document_read'){const o=env.object(args.id);if(o?.type==='file'&&!String(o.src||'').startsWith('data:'))throw Error('EMBEDDED_DOCUMENT_REQUIRED');}
          const {projectId:unused,...localArgs}=args;
          result=await env.read(tool,localArgs);guard(deadline);
          if(result?.error||result?.ok===false)throw Error(result.error||'EDITOR_TOOL_FAILED');
          if(result==null)throw Error('EMPTY_EDITOR_RESULT');
        }
        guard(deadline);
        const after=env.status();
        if(!C.isWrite(tool)&&after.revision!==before.revision)throw Error('BOARD_CHANGED_DURING_READ: retry for a coherent revision');
        return{...clone(result),ok:true,projectId:grant.projectId,revision:after.revision,readAt:new Date().toISOString()};
      }catch(e){return{ok:false,error:e.message,...(changed?{outcome:'applied_in_memory_save_not_confirmed',id:objectId,retry:'Reuse identical requestKey and arguments; do not create another note blindly.'}:{})};}
    }
    return{execute};
  }
  root.OSMINOGMCPBoardCore={createExecutor};
  if(typeof module==='object'&&module.exports)module.exports={createExecutor};
  if(typeof document==='undefined'||!root.chrome?.runtime?.id)return;
  let session=null,pairing=null,timer=0,last='Не подключён';
  const $=s=>document.querySelector(s);
  function status(text){last=text;const el=$('#osminogMcpState');if(el)el.textContent=text;const b=$('#osminogMcpConnect');if(b)b.disabled=!!session;}
  const env={
    project:()=>root.project(),status:()=>root.BriefCraftBridge.canvasStatus(),object:id=>root.objects().find(o=>o.id===id),
    read:(tool,args)=>root.BriefCraftBridge.executeTool(tool,args),
    create:props=>root.OSMINOGEditorAPI.create('note',props),
    update:(o,props)=>{root.checkpoint();Object.assign(o,props);o.html=root.esc(props.text).replace(/\n/g,'<br>');o.documentRevision=(Number(o.documentRevision)||0)+1;root.logChange('MCP: обновлена заметка');root.renderAll(true);},
    save:()=>root.persist(),
    digest:async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),v=>v.toString(16).padStart(2,'0')).join(''),
    image:async(src,max)=>{
      const image=new Image();await new Promise((ok,no)=>{const timeout=setTimeout(()=>{image.src='';no(Error('IMAGE_DECODE_TIMEOUT'));},10000);image.onload=()=>{clearTimeout(timeout);ok();};image.onerror=()=>{clearTimeout(timeout);no(Error('IMAGE_DECODE_FAILED'));};image.src=src;});
      if(image.naturalWidth*image.naturalHeight>100000000)throw Error('IMAGE_DIMENSIONS_TOO_LARGE');
      const scale=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      const data=canvas.toDataURL('image/png').split(',')[1];if(data.length>20*1024*1024)throw Error('IMAGE_RESULT_TOO_LARGE: request a smaller max_size');
      return{mimeType:'image/png',data,width:canvas.width,height:canvas.height};
    }
  };
  async function post(s,path,body){
    const r=await fetch(s.baseUrl+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:JSON.stringify(body),signal:AbortSignal.timeout(12000),cache:'no-store',credentials:'omit',redirect:'error'});
    const result=await r.json();if(!r.ok||result.ok===false)throw Error(result.error||'LOCAL_BRIDGE_ERROR');return result;
  }
  async function disconnect(reason='Отключён'){
    const s=session;session=null;clearTimeout(timer);status(reason);
    if(s?.clientId)await post(s,'/disconnect',{clientId:s.clientId,projectId:s.projectId}).catch(()=>{});
  }
  async function poll(s){
    if(session!==s)return;
    if(root.project()?.id!==s.projectId){await disconnect('Доска сменилась — подключи нужный проект заново');return;}
    try{
      const r=await post(s,'/poll',{clientId:s.clientId,projectId:s.projectId});if(session!==s)return;s.failures=0;
      if(r.request){
        status('Запрос MCP: '+r.request.tool);
        const result=await s.executor.execute(r.request);if(session!==s)return;
        await post(s,'/result',{clientId:s.clientId,projectId:s.projectId,id:r.request.id,result});
        status(result.ok?`MCP: ${r.request.tool} · rev ${result.revision??result.currentRevision} · выполнено`:'MCP: '+result.error);
      }
    }catch(e){
      if(session!==s)return;
      if(++s.failures>=4||/REVOKED|EXPIRED/.test(e.message)){await disconnect('Связь остановлена: '+e.message);return;}
      status('Локальный мост не ответил; повтор подключения…');
    }
    if(session===s)timer=setTimeout(()=>poll(s),s.failures?2500:700);
  }
  async function connect(pair,role='view'){
    if(session)throw Error('Сначала отключи текущую доску');
    if(!pair||pair.protocol!=='osminog.local_pair/v1'||!/^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(pair.baseUrl)||!/^[a-f0-9]{64}$/.test(pair.token))throw Error('Неверный файл локального подключения');
    if(!['view','edit'].includes(role))throw Error('Неверный доступ');
    const p=root.project();if(!p)throw Error('Открой проект');
    const s={...pair,projectId:p.id,role,failures:0};session=s;status('Подключаю локальный мост…');
    try{
      const r=await post(s,'/connect',{projectId:p.id,role});s.clientId=r.clientId;
      if(session!==s||root.project()!==p){await post(s,'/disconnect',{clientId:s.clientId,projectId:p.id});if(session===s)session=null;throw Error('Проект изменился во время подключения');}
      s.executor=createExecutor(env,{projectId:p.id,role,active:()=>session===s});
      status('Локальный мост подключён · '+p.name+' · '+(role==='edit'?'чтение + заметки':'только чтение'));poll(s);return{ok:true,projectId:p.id};
    }catch(e){if(session===s)session=null;status(e.message);throw e;}
  }
  function mount(){
    const pop=$('#collabPopover');if(!pop||$('#osminogMcpSection'))return;
    const section=document.createElement('section');section.id='osminogMcpSection';section.className='collab-section';
    section.innerHTML='<div class="collab-section-title">ВНЕШНИЙ CHATGPT · MCP · ПИЛОТ</div><p style="font-size:12px;line-height:1.5">Прямые инструменты текущей доски. Без копирования переписки. Для ChatGPT требуется отдельно настроенный Secure MCP Tunnel.</p><input id="osminogMcpPair" type="file" accept=".json,application/json" aria-label="Локальный файл mcp-pairing.json"><div style="display:flex;gap:8px;margin:8px 0;flex-wrap:wrap"><select id="osminogMcpRole" aria-label="Доступ внешнего MCP"><option value="view">Только чтение</option><option value="edit">Чтение + создание и правка заметок</option></select><button id="osminogMcpConnect" type="button">Подключить эту доску</button><button id="osminogMcpDisconnect" type="button">Отключить MCP</button></div><small id="osminogMcpState" role="status"></small>';
    pop.append(section);status(last);
    $('#osminogMcpPair').onchange=async e=>{pairing=null;const f=e.target.files[0];if(!f||f.size>4096){status('Выбери небольшой файл mcp-pairing.json из локального моста');return;}try{pairing=JSON.parse(await f.text());status('Файл выбран. Доступ включится только по кнопке.');}catch{status('Не удалось прочитать файл подключения');}};
    $('#osminogMcpConnect').onclick=async()=>{
      try{if(!pairing)throw Error('Сначала выбери mcp-pairing.json');const allowed=await chrome.permissions.request({origins:['http://127.0.0.1/*']});if(!allowed)throw Error('Нет разрешения на локальный мост');await connect(pairing,$('#osminogMcpRole').value);}catch(e){status(e.message);}
    };
    $('#osminogMcpDisconnect').onclick=()=>disconnect();
    $('#osminogMcpRole').onchange=()=>{if(session)disconnect('Доступ изменён — подключи доску заново');};
  }
  root.OSMINOGMCPBoard={connect,disconnect,status:()=>({connected:!!session,projectId:session?.projectId,role:session?.role,message:last})};
  window.addEventListener('beforeunload',()=>{const s=session;session=null;if(s?.clientId)fetch(s.baseUrl+'/disconnect',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:JSON.stringify({clientId:s.clientId,projectId:s.projectId}),keepalive:true}).catch(()=>{});});
  mount();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
})(globalThis);

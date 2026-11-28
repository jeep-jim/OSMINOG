/* Mouse Flash v1: bounded, ordered RTCDataChannel transport. Native code owns files. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MouseFlashTransfer=api;
})(typeof globalThis==='object'?globalThis:this,()=>{
  'use strict';
  const BLOCK_BYTES=1048576,FRAME_BYTES=16384,HEADER_BYTES=16,CONTROL_BYTES=16384;
  const HIGH_WATER=4*1048576,LOW_WATER=1048576,MAX_PENDING=4,MAX_PAGE_ITEMS=1000;
  const MAX_FILES=250000,MAX_DIRECTORIES=250000,MAX_MANIFEST_BYTES=64*1048576;
  const MAGIC=0x4d464c31,encoder=new TextEncoder(),HASH=/^[a-f0-9]{64}$/;
  const ID=/^[a-f0-9]{32}$/,DEVICE=/^[a-f0-9]{32}$/;
  class FlashError extends Error{constructor(code,message){super(message);this.name='FlashError';this.code=code;}}
  const error=(code,message)=>new FlashError(code,message);
  const integer=n=>Number.isSafeInteger(n)&&n>=0;
  const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
  function requireThat(ok,code,message){if(!ok)throw error(code,message);}
  function bytes(value){
    if(value instanceof ArrayBuffer)return new Uint8Array(value);
    if(ArrayBuffer.isView(value)&&value.BYTES_PER_ELEMENT===1)return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
    throw error('BAD_BYTES','Получен недопустимый блок данных.');
  }
  function pathName(value){
    requireThat(typeof value==='string'&&value.length>0&&encoder.encode(value).length<=1024&&value.normalize('NFC')===value,
      'BAD_PATH','Недопустимое имя файла или папки.');
    const parts=value.split('/');
    requireThat(!/[\\\x00-\x1f\x7f<>:"|?*]/.test(value)&&parts.every(p=>p&&p!=='.'&&p!=='..'&&encoder.encode(p).length<=240&&p.toLowerCase()!=='.mouse-flash-partials'&&!/[ .]$/.test(p)&&! /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)),
      'BAD_PATH','Недопустимый путь в списке файлов.');
    return value;
  }
  function canonicalManifest(m){
    return JSON.stringify({v:1,transferId:m.transferId,files:m.files.map(({id,path,size})=>({id,path,size})),directories:m.directories,totalBytes:m.totalBytes});
  }
  function validateManifest(input){
    requireThat(object(input)&&input.v===1&&ID.test(input.transferId)&&Array.isArray(input.files)&&Array.isArray(input.directories),
      'BAD_MANIFEST','Некорректный список файлов.');
    requireThat(input.files.length<=MAX_FILES&&input.directories.length<=MAX_DIRECTORIES&&(input.files.length+input.directories.length)>0,
      'MANIFEST_LIMIT','Список файлов превышает допустимый размер.');
    let total=0,previous=null;const ids=new Set(),paths=new Set(),filePaths=new Set();
    const files=input.files.map(f=>{
      requireThat(object(f)&&typeof f.id==='string'&&ID.test(f.id)&&!ids.has(f.id)&&integer(f.size),'BAD_MANIFEST','Некорректная запись файла.');
      const p=pathName(f.path),key=p.toLowerCase();
      requireThat((previous===null||previous<p)&&!paths.has(key),'PATH_COLLISION','Имена файлов повторяются или имеют неоднозначный порядок.');
      previous=p;ids.add(f.id);paths.add(key);filePaths.add(key);total+=f.size;
      requireThat(integer(total),'SIZE_LIMIT','Общий размер файлов слишком велик.');
      return{id:f.id,path:p,size:f.size};
    });
    previous=null;
    const directories=input.directories.map(d=>{
      const p=pathName(d),key=p.toLowerCase();
      requireThat((previous===null||previous<p)&&!paths.has(key),'PATH_COLLISION','Имена папок повторяются или имеют неоднозначный порядок.');
      previous=p;paths.add(key);return p;
    });
    for(const p of paths){let end=p.lastIndexOf('/');while(end>=0){requireThat(!filePaths.has(p.slice(0,end)),'PATH_COLLISION','Файл не может быть родительской папкой.');end=p.lastIndexOf('/',end-1);}}
    requireThat(integer(input.totalBytes)&&total===input.totalBytes,'BAD_MANIFEST','Общий размер не совпадает со списком файлов.');
    const m={v:1,transferId:input.transferId,files,directories,totalBytes:total};
    requireThat(encoder.encode(canonicalManifest(m)).length<=MAX_MANIFEST_BYTES,'MANIFEST_LIMIT','Список файлов превышает допустимый размер.');
    return m;
  }
  async function sha256(value){
    let provider=globalThis.crypto;
    if(!provider?.subtle&&typeof require==='function')provider=require('node:crypto').webcrypto;
    requireThat(provider?.subtle,'NO_CRYPTO','Защищённая проверка файлов недоступна.');
    return Array.from(new Uint8Array(await provider.subtle.digest('SHA-256',value)),b=>b.toString(16).padStart(2,'0')).join('');
  }
  const hashManifest=m=>sha256(encoder.encode(canonicalManifest(m)));
  function deferred(timeoutMs,message){
    let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});promise.catch(()=>{});
    const timer=timeoutMs===null?null:setTimeout(()=>reject(error('TIMEOUT',message)),timeoutMs);
    return{promise,resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}};
  }
  function makeFrame(id,offset,data){
    const body=bytes(data);requireThat(body.length>0&&body.length<=FRAME_BYTES-HEADER_BYTES,'FRAME_LIMIT','Блок передачи слишком велик.');
    const frame=new Uint8Array(HEADER_BYTES+body.length),view=new DataView(frame.buffer);
    view.setUint32(0,MAGIC);view.setUint32(4,id);view.setUint32(8,offset);view.setUint32(12,body.length);frame.set(body,HEADER_BYTES);return frame;
  }
  function readFrame(value){
    const frame=bytes(value);requireThat(frame.length>HEADER_BYTES&&frame.length<=FRAME_BYTES,'BAD_FRAME','Неверный размер сетевого блока.');
    const view=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
    requireThat(view.getUint32(0)===MAGIC&&view.getUint32(12)===frame.length-HEADER_BYTES,'BAD_FRAME','Повреждён сетевой блок.');
    return{id:view.getUint32(4),offset:view.getUint32(8),data:frame.subarray(HEADER_BYTES)};
  }
  function validateOffsets(items,manifest){
    requireThat(Array.isArray(items)&&items.length===manifest.files.length,'BAD_RESUME','Не совпадает список подтверждённых файлов.');
    const files=new Map(manifest.files.map(f=>[f.id,f])),result=new Map();
    for(const item of items){
      const file=object(item)&&files.get(item.id);
      requireThat(file&&!result.has(item.id)&&integer(item.offset)&&item.offset<=file.size&&(item.offset===file.size||item.offset%BLOCK_BYTES===0),
        'BAD_RESUME','Недопустимая позиция продолжения передачи.');
      result.set(item.id,item.offset);
    }
    return result;
  }
  function directCandidatePair(report){
    const selected=new Set();for(const item of report.values())if(item.type==='transport'&&item.selectedCandidatePairId)selected.add(item.selectedCandidatePairId);
    let confirmed=null;
    for(const item of report.values()){
      if(item.type!=='candidate-pair'||item.state!=='succeeded'||!(selected.size?selected.has(item.id):(item.nominated||item.selected)))continue;
      const local=report.get(item.localCandidateId),remote=report.get(item.remoteCandidateId);
      requireThat(local?.candidateType!=='relay'&&remote?.candidateType!=='relay','RELAY_FORBIDDEN','Обнаружен промежуточный сервер передачи. Соединение остановлено.');
      if(['host','srflx','prflx'].includes(local?.candidateType)&&['host','srflx','prflx'].includes(remote?.candidateType))confirmed={pairId:item.id,local:local.candidateType,remote:remote.candidateType};
    }
    return confirmed;
  }
  class Transfer{
    constructor({role,channel,callNative,source=null,peerDeviceId,manifestHash,onEvent=()=>{},timeoutMs=120000}){
      requireThat((role==='host'||role==='join')&&channel&&typeof channel.send==='function'&&typeof callNative==='function'&&DEVICE.test(peerDeviceId)&&HASH.test(manifestHash),
        'BAD_SESSION','Некорректное соединение Flash.');
      requireThat(channel.ordered!==false&&(channel.maxRetransmits==null)&&(channel.maxPacketLifeTime==null),'UNRELIABLE_CHANNEL','Нужен надёжный упорядоченный канал передачи.');
      this.role=role;this.channel=channel;this.callNative=callNative;this.source=source;this.peerDeviceId=peerDeviceId;
      this.expectedHash=manifestHash;this.onEvent=onEvent;this.timeoutMs=timeoutMs;this.stopped=false;this.finished=false;this.receive=null;
      this.phase=role==='host'?'host-approval':'waiting-manifest';this.manifest=source?validateManifest(source.manifest):null;
      this.pending=new Map();this.nextBlock=1;this.lastReceivedBlock=0;this.activeBlock=null;this.offsets=new Map();this.completedFiles=new Set();
      this.serial=Promise.resolve();this.queuedBytes=0;this.queuedMessages=0;this.cleanups=new Set();this.readyParts=null;this.manifestParts=null;
      channel.binaryType='arraybuffer';channel.bufferedAmountLowThreshold=LOW_WATER;
      this.messageListener=event=>this._enqueue(event.data);
      this.closeListener=()=>{if(!this.finished&&!this.stopped)this._stop('paused','Соединение прервано. Для продолжения создайте новое приглашение.');};
      this.errorListener=()=>this._fail(error('CHANNEL_ERROR','Ошибка прямого соединения.'));
      channel.addEventListener('message',this.messageListener);channel.addEventListener('close',this.closeListener);channel.addEventListener('error',this.errorListener);
      if(channel.readyState==='closed')this.closeListener();
    }
    _emit(type,detail={}){try{Promise.resolve(this.onEvent({type,phase:this.phase,...detail})).catch(()=>{});}catch{}}
    _setPhase(phase,detail={}){this.phase=phase;this._emit('phase',detail);}
    _ensure(){if(this.stopped||this.finished)throw error('STOPPED','Передача остановлена.');}
    _enqueue(value){
      if(this.stopped||this.finished)return;
      let size;
      try{size=typeof value==='string'?encoder.encode(value).length:bytes(value).byteLength;
        requireThat(size>0&&size<=(typeof value==='string'?CONTROL_BYTES:FRAME_BYTES),'FRAME_LIMIT','Получено слишком большое сообщение.');
        requireThat(this.queuedBytes+size<=MAX_PENDING*BLOCK_BYTES+8*CONTROL_BYTES&&this.queuedMessages<2048,'QUEUE_LIMIT','Собеседник превысил окно передачи.');
      }catch(e){this._fail(e);return;}
      this.queuedBytes+=size;this.queuedMessages++;
      this.serial=this.serial.then(()=>{if(!this.stopped&&!this.finished)return typeof value==='string'?this._control(JSON.parse(value)):this._binary(value);})
        .catch(e=>this._fail(e)).finally(()=>{this.queuedBytes-=size;this.queuedMessages--;});
    }
    async _writable(length){
      this._ensure();
      if(this.channel.readyState==='open'&&this.channel.bufferedAmount+length<=HIGH_WATER)return;
      requireThat(this.channel.readyState==='open'||this.channel.readyState==='connecting','CHANNEL_CLOSED','Прямое соединение закрыто.');
      await new Promise((resolve,reject)=>{
        let done=false;
        const cleanup=()=>{clearTimeout(timer);for(const name of ['open','bufferedamountlow'])this.channel.removeEventListener(name,check);for(const name of ['close','error'])this.channel.removeEventListener(name,closed);this.cleanups.delete(cancel);};
        const finish=e=>{if(done)return;done=true;cleanup();e?reject(e):resolve();};
        const check=()=>{if(this.stopped||this.finished)finish(error('STOPPED','Передача остановлена.'));else if(this.channel.readyState==='open'&&this.channel.bufferedAmount+length<=HIGH_WATER)finish();};
        const closed=()=>finish(error('CHANNEL_CLOSED','Прямое соединение закрыто.')),cancel=()=>finish(error('STOPPED','Передача остановлена.'));
        const timer=setTimeout(()=>finish(error('TIMEOUT','Собеседник не принимает данные. Передача приостановлена.')),this.timeoutMs);
        for(const name of ['open','bufferedamountlow'])this.channel.addEventListener(name,check);
        for(const name of ['close','error'])this.channel.addEventListener(name,closed);
        this.cleanups.add(cancel);check();
      });
      this._ensure();
    }
    async _send(value){const size=typeof value==='string'?encoder.encode(value).length:bytes(value).length;await this._writable(size);this._ensure();this.channel.send(value);}
    async _sendControl(value){const text=JSON.stringify({v:1,...value});requireThat(encoder.encode(text).length<=CONTROL_BYTES,'CONTROL_LIMIT','Служебное сообщение слишком велико.');await this._send(text);}
    async _pages(type,items){
      let page=[],size=0,index=0;
      for(const item of items){
        const length=encoder.encode(JSON.stringify(item)).length+1;
        if(page.length&&(page.length>=MAX_PAGE_ITEMS||size+length>CONTROL_BYTES-512)){await this._sendControl({type,index:index++,items:page});page=[];size=0;}
        requireThat(length<=CONTROL_BYTES-512,'CONTROL_LIMIT','Запись списка файлов слишком велика.');page.push(item);size+=length;
      }
      if(page.length)await this._sendControl({type,index,items:page});
    }
    async approveHost(){
      this._ensure();requireThat(this.role==='host'&&this.phase==='host-approval'&&this.source,'BAD_STATE','Нельзя подтвердить отправку сейчас.');
      this._setPhase('preparing-manifest');
      try{
        requireThat(this.source.manifestHash===this.expectedHash&&(await hashManifest(this.manifest))===this.expectedHash,'MANIFEST_HASH','Список выбранных файлов изменился.');
        await this.callNative('bind-peer',{sourceId:this.source.sourceId,peerDeviceId:this.peerDeviceId});this._ensure();
        const m=this.manifest;
        await this._sendControl({type:'manifest-start',manifestHash:this.expectedHash,transferId:m.transferId,totalBytes:m.totalBytes,fileCount:m.files.length,directoryCount:m.directories.length});
        await this._pages('manifest-files',m.files);await this._pages('manifest-directories',m.directories);
        this._setPhase('waiting-receiver');await this._sendControl({type:'manifest-end'});
      }catch(e){this._fail(e);throw e;}
    }
    async approveReceiver({resume=false}={}){
      this._ensure();requireThat(this.role==='join'&&this.phase==='receiver-approval'&&this.manifest,'BAD_STATE','Сначала дождитесь списка файлов.');
      this._setPhase('choosing-destination');
      try{
        const received=await this.callNative('choose-destination',{manifest:this.manifest,manifestHash:this.expectedHash,peerDeviceId:this.peerDeviceId,resume:!!resume});
        requireThat(object(received)&&typeof received.receiveId==='string','NO_DESTINATION','Папка для получения не выбрана.');
        this.receive=received;this._ensure();this.offsets=validateOffsets(received.offsets,this.manifest);
        this._setPhase('receiving',{folderName:received.folderName});this._progress();
        await this._sendControl({type:'ready-start',transferId:this.manifest.transferId,manifestHash:this.expectedHash,count:this.manifest.files.length});
        await this._pages('ready-page',this.manifest.files.map(f=>({id:f.id,offset:this.offsets.get(f.id)})));
        await this._sendControl({type:'ready-end'});
      }catch(e){
        if(this.receive||this.stopped)this._fail(e);else this._setPhase('receiver-approval');
        throw e;
      }
    }
    _progress(){let transferred=0;for(const offset of this.offsets.values())transferred+=offset;this._emit('progress',{transferred,totalBytes:this.manifest?.totalBytes||0,completedFiles:this.completedFiles.size,fileCount:this.manifest?.files.length||0});}
    async _control(m){
      requireThat(object(m)&&m.v===1&&typeof m.type==='string','BAD_CONTROL','Некорректное сообщение Flash.');
      if(m.type==='pause'){await this._stop('paused','Собеседник приостановил передачу. Для продолжения нужно новое приглашение.');return;}
      if(this.role==='host')return this._hostControl(m);
      return this._joinControl(m);
    }
    async _hostControl(m){
      if(m.type==='ready-start'){
        requireThat(this.phase==='waiting-receiver'&&!this.readyParts&&m.transferId===this.manifest.transferId&&m.manifestHash===this.expectedHash&&m.count===this.manifest.files.length,'BAD_READY','Подтверждение относится к другой передаче.');
        this.readyParts={items:[],index:0};return;
      }
      if(m.type==='ready-page'){
        const p=this.readyParts;requireThat(p&&m.index===p.index&&Array.isArray(m.items)&&m.items.length>0&&m.items.length<=MAX_PAGE_ITEMS&&p.items.length+m.items.length<=this.manifest.files.length,'BAD_READY','Некорректная страница продолжения.');
        p.index++;p.items.push(...m.items);return;
      }
      if(m.type==='ready-end'){
        requireThat(this.phase==='waiting-receiver'&&this.readyParts,'BAD_READY','Получение ещё не подтверждено.');
        this.offsets=validateOffsets(this.readyParts.items,this.manifest);this.readyParts=null;this._setPhase('sending');this._progress();
        this.sending=this._sendFiles().catch(e=>this._fail(e));return;
      }
      if(m.type==='ack'){
        const item=this.pending.get(m.id);requireThat(this.phase==='sending'&&item&&m.fileId===item.fileId&&m.offset===item.end,'BAD_ACK','Неверное подтверждение сохранённого блока.');
        requireThat(this.offsets.get(item.fileId)===item.start,'BAD_ACK','Блоки подтверждены в неверном порядке.');
        this.offsets.set(item.fileId,item.end);this.pending.delete(m.id);item.wait.resolve();this._progress();return;
      }
      if(m.type==='file-ok'){
        requireThat(this.phase==='sending'&&this.fileWait&&m.fileId===this.fileWait.fileId,'BAD_ACK','Неожиданное подтверждение файла.');
        this.completedFiles.add(m.fileId);this.fileWait.wait.resolve();this.fileWait=null;this._progress();return;
      }
      if(m.type==='finish-ok'){
        requireThat(this.phase==='finishing'&&this.finishWait,'BAD_ACK','Неожиданное завершение передачи.');this.finishWait.resolve();return;
      }
      throw error('BAD_STATE','Неожиданное сообщение от получателя.');
    }
    async _joinControl(m){
      if(m.type==='manifest-start'){
        requireThat(this.phase==='waiting-manifest'&&!this.manifestParts&&m.manifestHash===this.expectedHash&&ID.test(m.transferId)&&integer(m.totalBytes)&&integer(m.fileCount)&&m.fileCount<=MAX_FILES&&integer(m.directoryCount)&&m.directoryCount<=MAX_DIRECTORIES&&(m.fileCount+m.directoryCount)>0,'BAD_MANIFEST','Неверное начало списка файлов.');
        this.manifestParts={header:m,files:[],directories:[],filePage:0,directoryPage:0,bytes:0};this._setPhase('receiving-manifest');return;
      }
      if(m.type==='manifest-files'||m.type==='manifest-directories'){
        const p=this.manifestParts,isFile=m.type==='manifest-files',list=p&&(isFile?p.files:p.directories),key=isFile?'filePage':'directoryPage',count=p&&(isFile?p.header.fileCount:p.header.directoryCount);
        requireThat(this.phase==='receiving-manifest'&&p&&m.index===p[key]&&Array.isArray(m.items)&&m.items.length>0&&m.items.length<=MAX_PAGE_ITEMS&&list.length+m.items.length<=count&&(isFile?p.directories.length===0:p.files.length===p.header.fileCount),'BAD_MANIFEST','Нарушен порядок списка файлов.');
        p.bytes+=encoder.encode(JSON.stringify(m.items)).length;requireThat(p.bytes<=MAX_MANIFEST_BYTES,'MANIFEST_LIMIT','Список файлов слишком велик.');
        p[key]++;list.push(...m.items);return;
      }
      if(m.type==='manifest-end'){
        const p=this.manifestParts;requireThat(this.phase==='receiving-manifest'&&p&&p.files.length===p.header.fileCount&&p.directories.length===p.header.directoryCount,'BAD_MANIFEST','Список файлов получен не полностью.');
        const manifest=validateManifest({v:1,transferId:p.header.transferId,files:p.files,directories:p.directories,totalBytes:p.header.totalBytes});
        requireThat((await hashManifest(manifest))===this.expectedHash,'MANIFEST_HASH','Список файлов не прошёл проверку.');this._ensure();
        this.manifest=manifest;this.manifestParts=null;this.filesById=new Map(manifest.files.map(f=>[f.id,f]));this._setPhase('receiver-approval');this._emit('manifest',{manifest,manifestHash:this.expectedHash});return;
      }
      if(m.type==='block'){
        const file=this.filesById?.get(m.fileId);
        requireThat(this.phase==='receiving'&&this.receive&&file&&!this.activeBlock&&!this.completedFiles.has(m.fileId)&&integer(m.id)&&m.id===this.lastReceivedBlock+1&&m.id<=0xffffffff&&integer(m.offset)&&m.offset===this.offsets.get(m.fileId)&&integer(m.length)&&m.length>0&&m.length<=BLOCK_BYTES&&m.offset+m.length<=file.size&&(m.length===BLOCK_BYTES||m.offset+m.length===file.size)&&HASH.test(m.sha256),'BAD_BLOCK','Неверный или преждевременный блок файла.');
        this.lastReceivedBlock=m.id;this.activeBlock={...m,data:new Uint8Array(m.length),received:0};return;
      }
      if(m.type==='file-end'){
        const file=this.filesById?.get(m.fileId);
        requireThat(this.phase==='receiving'&&this.receive&&file&&!this.activeBlock&&!this.completedFiles.has(m.fileId)&&this.offsets.get(m.fileId)===file.size&&HASH.test(m.sha256),'BAD_FILE_END','Файл ещё не получен полностью.');
        const receipt=await this.callNative('complete-file',{receiveId:this.receive.receiveId,fileId:m.fileId,sha256:m.sha256});this._ensure();
        requireThat(receipt?.ok===true&&receipt.id===m.fileId,'FILE_HASH','Файл не прошёл итоговую проверку.');this.completedFiles.add(m.fileId);this._progress();await this._sendControl({type:'file-ok',fileId:m.fileId});return;
      }
      if(m.type==='finish'){
        requireThat(this.phase==='receiving'&&this.receive&&!this.activeBlock&&this.completedFiles.size===this.manifest.files.length,'EARLY_FINISH','Не все файлы проверены.');
        this._setPhase('finishing');await this.callNative('finish',{receiveId:this.receive.receiveId});this._ensure();await this._sendControl({type:'finish-ok'});
        this.finished=true;this._setPhase('complete');this._emit('complete',{folderName:this.receive.folderName});this._detach();return;
      }
      throw error('BAD_STATE','Неожиданное сообщение от отправителя.');
    }
    async _binary(value){
      requireThat(this.role==='join'&&this.phase==='receiving'&&this.receive&&this.activeBlock,'EARLY_BYTES','Данные поступили до подтверждения получения.');
      const frame=readFrame(value),block=this.activeBlock;
      requireThat(frame.id===block.id&&frame.offset===block.received&&block.received+frame.data.length<=block.length,'BAD_FRAME','Нарушена последовательность блоков.');
      block.data.set(frame.data,block.received);block.received+=frame.data.length;
      if(block.received!==block.length)return;
      requireThat((await sha256(block.data))===block.sha256,'BLOCK_HASH','Блок файла не прошёл проверку.');this._ensure();
      const receipt=await this.callNative('write-block',{receiveId:this.receive.receiveId,fileId:block.fileId,offset:block.offset,data:block.data,sha256:block.sha256});this._ensure();
      requireThat(receipt?.id===block.fileId&&receipt.offset===block.offset+block.length,'BAD_DURABLE_ACK','Сохранение блока не подтверждено.');
      this.offsets.set(block.fileId,receipt.offset);this.activeBlock=null;this._progress();
      await this._sendControl({type:'ack',id:block.id,fileId:block.fileId,offset:receipt.offset});
    }
    async _sendFiles(){
      for(const file of this.manifest.files){
        let offset=this.offsets.get(file.id);
        while(offset<file.size){
          this._ensure();while(this.pending.size>=MAX_PENDING){await Promise.race(Array.from(this.pending.values(),x=>x.wait.promise));this._ensure();}
          const length=Math.min(BLOCK_BYTES,file.size-offset);
          const block=await this.callNative('read-block',{sourceId:this.source.sourceId,fileId:file.id,offset,length});this._ensure();
          const data=bytes(block.data);requireThat(data.length===length&&HASH.test(block.sha256),'BAD_SOURCE','Выбранный файл изменился или недоступен.');
          const id=this.nextBlock++;requireThat(id<=0xffffffff,'BLOCK_LIMIT','Исчерпан диапазон блоков этой передачи.');
          const wait=deferred(this.timeoutMs,'Сохранение блока не подтверждено. Передача приостановлена.');
          this.pending.set(id,{fileId:file.id,start:offset,end:offset+length,wait});
          await this._sendControl({type:'block',id,fileId:file.id,offset,length,sha256:block.sha256});
          for(let at=0;at<length;at+=FRAME_BYTES-HEADER_BYTES){this._ensure();await this._send(makeFrame(id,at,data.subarray(at,Math.min(length,at+FRAME_BYTES-HEADER_BYTES))));}
          offset+=length;
        }
        await Promise.all(Array.from(this.pending.values(),x=>x.wait.promise));this._ensure();
        const full=await this.callNative('source-hash',{sourceId:this.source.sourceId,fileId:file.id});this._ensure();
        requireThat(full?.size===file.size&&HASH.test(full.sha256),'BAD_SOURCE','Выбранный файл изменился.');
        // Full native hashing of a TB file can outlast a block-ACK deadline.
        // The live channel and explicit cancellation own this wait instead.
        const wait=deferred(null);this.fileWait={fileId:file.id,wait};
        await this._sendControl({type:'file-end',fileId:file.id,sha256:full.sha256});await wait.promise;this._ensure();
      }
      this._setPhase('finishing');const wait=deferred(null);this.finishWait=wait;
      await this._sendControl({type:'finish'});await wait.promise;this._ensure();
      await this.callNative('finish',{sourceId:this.source.sourceId});this._ensure();
      this.finished=true;this._setPhase('complete');this._emit('complete');this._detach();
    }
    _detach(){this.channel.removeEventListener('message',this.messageListener);this.channel.removeEventListener('close',this.closeListener);this.channel.removeEventListener('error',this.errorListener);}
    async _stop(phase,message){
      if(this.stopped||this.finished)return;this.stopped=true;this.phase=phase;
      const reason=error('STOPPED',message);
      for(const item of this.pending.values())item.wait.reject(reason);this.pending.clear();
      this.fileWait?.wait.reject(reason);this.fileWait=null;this.finishWait?.reject(reason);this.finishWait=null;
      for(const cancel of Array.from(this.cleanups))cancel();this._detach();this.activeBlock=null;this.manifestParts=null;this.readyParts=null;
      try{this.channel.close();}catch{}
      try{await this.callNative('pause',this.role==='host'?{sourceId:this.source?.sourceId}:{receiveId:this.receive?.receiveId});}catch{}
      this._emit(phase,{message});
    }
    _fail(e){if(this.stopped||this.finished)return;return this._stop('error',e instanceof Error?e.message:'Не удалось продолжить передачу.');}
    async pause(message='Передача приостановлена. Подтверждённые блоки сохранены.'){
      if(this.stopped||this.finished)return;
      if(this.channel.readyState==='open'&&this.channel.bufferedAmount<LOW_WATER){try{this.channel.send(JSON.stringify({v:1,type:'pause'}));}catch{}}
      await this._stop('paused',message);
    }
  }
  return{Transfer,FlashError,canonicalManifest,validateManifest,hashManifest,sha256,makeFrame,readFrame,validateOffsets,directCandidatePair,
    constants:Object.freeze({BLOCK_BYTES,FRAME_BYTES,HEADER_BYTES,CONTROL_BYTES,HIGH_WATER,LOW_WATER,MAX_PENDING,MAX_PAGE_ITEMS,MAX_FILES,MAX_DIRECTORIES,MAX_MANIFEST_BYTES})};
});

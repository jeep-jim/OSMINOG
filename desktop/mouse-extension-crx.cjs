'use strict';

// CRX3 is verified before any extension bytes reach Electron. The signature
// context and publisher key are defined by Chromium's components/crx_file:
// https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/crx_file/crx3.proto
// https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/crx_file/crx_verifier.cc
const crypto=require('node:crypto'),fs=require('node:fs/promises'),path=require('node:path');
const {inflateRawSync}=require('node:zlib');
const ID=/^[a-p]{32}$/;
const PUBLISHER_KEY_SHA256='61f7f2a6bfcf74cd0bc1fe2497cc9b04254c658f79f2145392867ea8366367cf';
const LIMITS=Object.freeze({download:64*1024*1024,header:1024*1024,entries:12000,file:32*1024*1024,total:160*1024*1024,path:512});
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const alphabet=hex=>hex.replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16)));
function fail(code,message){const e=Error(message);e.code=code;throw e;}
function fields(bytes){
 let pos=0,count=0;const result=new Map();
 const number=()=>{let n=0,m=1;for(let i=0;i<8;i++){if(pos>=bytes.length)fail('CRX_HEADER','Повреждён заголовок расширения.');const b=bytes[pos++];n+=(b&127)*m;if(!Number.isSafeInteger(n))break;if(!(b&128))return n;m*=128;}fail('CRX_HEADER','Повреждён заголовок расширения.');};
 while(pos<bytes.length){
  if(++count>128)fail('CRX_HEADER','Слишком большой заголовок расширения.');
  const tag=number(),id=Math.floor(tag/8),wire=tag%8;let value;
  if(!id)fail('CRX_HEADER','Повреждён заголовок расширения.');
  if(wire===2){const size=number();if(size>bytes.length-pos)fail('CRX_HEADER','Повреждён заголовок расширения.');value=bytes.subarray(pos,pos+size);pos+=size;}
  else if(wire===0){number();continue;}
  else if(wire===1||wire===5){pos+=wire===1?8:4;if(pos>bytes.length)fail('CRX_HEADER','Повреждён заголовок расширения.');continue;}
  else fail('CRX_HEADER','Неподдерживаемый заголовок расширения.');
  if(!result.has(id))result.set(id,[]);result.get(id).push(value);
 }
 return result;
}
function one(values,id){const entries=values.get(id);if(entries?.length!==1)fail('CRX_HEADER','Повреждён заголовок расширения.');return entries[0];}
function verifyCrx(input,expectedId,{requirePublisher=true}={}){
 if(!Buffer.isBuffer(input)||input.length<34||input.length>LIMITS.download||!ID.test(expectedId))fail('CRX_INPUT','Некорректный пакет расширения.');
 if(input.toString('ascii',0,4)!=='Cr24'||input.readUInt32LE(4)!==3)fail('CRX_FORMAT','Магазин должен предоставить подписанный пакет CRX3.');
 const headerSize=input.readUInt32LE(8);
 if(!headerSize||headerSize>LIMITS.header||12+headerSize>=input.length)fail('CRX_HEADER','Повреждён заголовок расширения.');
 const headerBytes=input.subarray(12,12+headerSize),header=fields(headerBytes),signed=one(header,10000),declared=one(fields(signed),1);
 if(declared.length!==16||alphabet(declared.toString('hex'))!==expectedId)fail('CRX_ID','Пакет не соответствует выбранному расширению.');
 const archive=input.subarray(12+headerSize),size=Buffer.alloc(4);size.writeUInt32LE(signed.length);
 let developerKey,publisher=false;const proofs=[];
 for(const [field,keyType] of [[2,'rsa'],[3,'ec']])for(const proofBytes of header.get(field)||[]){
  if(proofs.length>=16)fail('CRX_SIGNATURE','Слишком много подписей расширения.');
  const proof=fields(proofBytes),publicKey=one(proof,1),signature=one(proof,2);
  if(publicKey.length>8192||signature.length>8192)fail('CRX_SIGNATURE','Некорректная подпись расширения.');
  let key,valid=false;
  try{key=crypto.createPublicKey({key:publicKey,format:'der',type:'spki'});if(key.asymmetricKeyType!==keyType)throw Error('key');
   const verifier=crypto.createVerify('SHA256');verifier.update(Buffer.from('CRX3 SignedData\0'));verifier.update(size);verifier.update(signed);verifier.update(archive);valid=verifier.verify(key,signature);
  }catch{}
  if(!valid)fail('CRX_SIGNATURE','Подпись расширения не прошла проверку.');
  const keyHash=sha(publicKey),isDeveloper=alphabet(keyHash.slice(0,32))===expectedId,isPublisher=keyHash===PUBLISHER_KEY_SHA256;
  if(isDeveloper)developerKey=publicKey;if(isPublisher)publisher=true;
  proofs.push({algorithm:keyType==='rsa'?'RSA-PKCS1-SHA256':'ECDSA-SHA256',keySha256:keyHash,developer:isDeveloper,publisher:isPublisher,verified:true});
 }
 if(!developerKey||requirePublisher&&!publisher)fail('CRX_PROOF','Не найдена подпись разработчика и Chrome Web Store.');
 return {archive,publicKey:developerKey.toString('base64'),evidence:Object.freeze({format:'CRX3',extensionId:expectedId,bytes:input.length,sha256:sha(input),publisherVerified:publisher,developerVerified:true,proofs})};
}

const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^n>>>1:n>>>1;return n>>>0;});
function crc32(bytes){let n=0xffffffff;for(const b of bytes)n=crcTable[(n^b)&255]^n>>>8;return(n^0xffffffff)>>>0;}
const decoder=new TextDecoder('utf-8',{fatal:true});
function safeName(name){
 const directory=name.endsWith('/'),parts=(directory?name.slice(0,-1):name).split('/');
 if(!name||Buffer.byteLength(name)>LIMITS.path||name.startsWith('/')||/[\\\x00-\x1f\x7f:]/.test(name)||parts.length>24||
  parts.some(p=>!p||p==='.'||p==='..'||/[. ]$/.test(p)||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)))fail('CRX_PATH','Недопустимое имя файла в расширении.');
 return {name,directory,key:parts.join('/').normalize('NFC').toLowerCase()};
}
function archiveFiles(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length<22||bytes.length>LIMITS.download)fail('CRX_ZIP','Повреждён архив расширения.');
 const u16=p=>bytes.readUInt16LE(p),u32=p=>bytes.readUInt32LE(p);let end=-1;
 for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(u32(p)===0x06054b50&&p+22+u16(p+20)===bytes.length){end=p;break;}
 if(end<0)fail('CRX_ZIP','Повреждён архив расширения.');
 const count=u16(end+10),central=u32(end+16),centralSize=u32(end+12);
 if(!count||count>LIMITS.entries||u16(end+4)||u16(end+6)||u16(end+8)!==count||central+centralSize!==end||central>=end)fail('CRX_ZIP','Неподдерживаемый архив расширения.');
 const records=[],names=new Map();let p=central,total=0;
 const extra=(start,len)=>{const stop=start+len;while(start<stop){if(start+4>stop||u16(start)===1)fail('CRX_ZIP','ZIP64 не поддерживается.');const size=u16(start+2);start+=4+size;if(start>stop)fail('CRX_ZIP','Повреждён архив расширения.');}};
 for(let i=0;i<count;i++){
  if(p+46>end||u32(p)!==0x02014b50)fail('CRX_ZIP','Повреждён архив расширения.');
  const flags=u16(p+8),method=u16(p+10),crc=u32(p+16),compressed=u32(p+20),size=u32(p+24),nl=u16(p+28),el=u16(p+30),cl=u16(p+32),local=u32(p+42),mode=u32(p+38)>>>16,stop=p+46+nl+el+cl;
  if(!nl||nl>LIMITS.path||stop>end||flags&~0x080e||![0,8].includes(method)||u16(p+34)||size>LIMITS.file||compressed>LIMITS.download||![0,0x8000,0x4000].includes(mode&0xf000))fail('CRX_ZIP','Неподдерживаемый файл в расширении.');
  let name;try{name=decoder.decode(bytes.subarray(p+46,p+46+nl));}catch{fail('CRX_PATH','Некорректное имя файла расширения.');}
  const named=safeName(name);if(names.has(named.key))fail('CRX_PATH','Повторяющиеся имена файлов расширения.');names.set(named.key,named.directory?'directory':'file');
  if(!named.directory&&/\.(?:node|dll|exe|so|dylib|app|bat|cmd|sh|ps1|crx|msi)$/i.test(name))fail('CRX_NATIVE','Расширения со встроенными программами ОС не поддерживаются.');
  extra(p+46+nl,el);
  if(local+30>central||u32(local)!==0x04034b50||u16(local+6)!==flags||u16(local+8)!==method)fail('CRX_ZIP','Повреждён архив расширения.');
  const lnl=u16(local+26),lel=u16(local+28),start=local+30+lnl+lel;
  if(lnl!==nl||start>central||start+compressed>central||!bytes.subarray(local+30,local+30+lnl).equals(bytes.subarray(p+46,p+46+nl)))fail('CRX_ZIP','Повреждён архив расширения.');
  extra(local+30+lnl,lel);let localStop=start+compressed;
  if(flags&8){for(const [offset,value] of [[14,crc],[18,compressed],[22,size]])if(u32(local+offset)!==0&&u32(local+offset)!==value)fail('CRX_ZIP','Повреждён архив расширения.');
   if(localStop+12>central)fail('CRX_ZIP','Повреждён архив расширения.');let descriptor=localStop;if(u32(descriptor)===0x08074b50)descriptor+=4;
   if(descriptor+12>central||u32(descriptor)!==crc||u32(descriptor+4)!==compressed||u32(descriptor+8)!==size)fail('CRX_ZIP','Повреждён архив расширения.');localStop=descriptor+12;
  }else if(u32(local+14)!==crc||u32(local+18)!==compressed||u32(local+22)!==size)fail('CRX_ZIP','Повреждён архив расширения.');
  if(method===0&&size!==compressed||named.directory&&(size||crc))fail('CRX_ZIP','Повреждён архив расширения.');
  total+=size;if(total>LIMITS.total)fail('CRX_SIZE','Распакованное расширение превышает допустимый размер.');
  records.push({...named,local,start,localStop,compressed,size,crc,method});p=stop;
 }
 if(p!==end)fail('CRX_ZIP','Повреждён архив расширения.');
 const ordered=[...records].sort((a,b)=>a.local-b.local);for(let i=1;i<ordered.length;i++)if(ordered[i].local<ordered[i-1].localStop)fail('CRX_ZIP','Пересекающиеся записи архива.');
 for(const key of names.keys()){const parts=key.split('/');parts.pop();while(parts.length){if(names.get(parts.join('/'))==='file')fail('CRX_PATH','Конфликт имён файлов расширения.');parts.pop();}}
 const result=new Map();
 for(const record of records){const raw=bytes.subarray(record.start,record.start+record.compressed);let body;
  try{body=record.method===0?Buffer.from(raw):inflateRawSync(raw,{maxOutputLength:Math.max(1,record.size)});}catch{fail('CRX_ZIP','Не удалось распаковать расширение.');}
  if(body.length!==record.size||crc32(body)!==record.crc)fail('CRX_ZIP','Контрольная сумма файла расширения не совпала.');if(!record.directory)result.set(record.name,body);
 }
 if(!result.has('manifest.json')||result.get('manifest.json').length>256*1024)fail('CRX_MANIFEST','В расширении нет допустимого manifest.json.');
 return result;
}
function runtimeFiles(crx){
 const files=archiveFiles(crx.archive);
 // Electron 44.5.0 LoadUnpacked deletes the reserved root _metadata directory:
 // https://github.com/electron/electron/blob/v44.5.0/shell/browser/extensions/electron_extension_loader.cc
 // Keep the original signed CRX intact. Only the Store verification metadata is
 // omitted from runtime; unknown contents/aliases fail rather than lose resources.
 for(const name of files.keys())if(name.split('/')[0].toLowerCase()==='_metadata'){
  if(name!=='_metadata/verified_contents.json')fail('CRX_METADATA','Неподдерживаемые файлы в служебной папке расширения.');
  files.delete(name);
 }
 let manifest;try{manifest=JSON.parse(files.get('manifest.json').toString('utf8'));}catch{fail('CRX_MANIFEST','Некорректный manifest.json.');}
 if(!manifest||typeof manifest!=='object'||Array.isArray(manifest))fail('CRX_MANIFEST','Некорректный manifest.json.');
 if(manifest.key&&manifest.key!==crx.publicKey)fail('CRX_ID','Ключ manifest.json не соответствует подписи.');
 manifest.key=crx.publicKey;files.set('manifest.json',Buffer.from(JSON.stringify(manifest)+'\n'));
 return files;
}
async function extractVerified(crx,destination){
 const files=runtimeFiles(crx),manifest=JSON.parse(files.get('manifest.json').toString('utf8'));
 await fs.mkdir(destination,{mode:0o700});
 for(const [name,bytes] of files){const target=path.join(destination,...name.split('/'));await fs.mkdir(path.dirname(target),{recursive:true,mode:0o700});await fs.writeFile(target,bytes,{flag:'wx',mode:0o600});}
 return manifest;
}
function downloadURL(id,chromeVersion){
 if(!ID.test(id)||!/^\d+\.\d+\.\d+\.\d+$/.test(chromeVersion||''))fail('CRX_INPUT','Не удалось определить расширение или версию Chromium.');
 const url=new URL('https://clients2.google.com/service/update2/crx');url.searchParams.set('response','redirect');url.searchParams.set('acceptformat','crx3');url.searchParams.set('prodversion',chromeVersion);url.searchParams.set('x',new URLSearchParams({id,uc:''}).toString());return url.href;
}
function allowedDownloadURL(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['clients2.google.com','clients2.googleusercontent.com','clients.google.com','clients.googleusercontent.com'].includes(u.hostname);}catch{return false;}}
async function downloadCrx({fetch,id,chromeVersion,signal}){
 const initial=downloadURL(id,chromeVersion),controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),60000);timeout.unref?.();
 const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort();
 let url=initial;const redirects=[];
 try{
  for(let n=0;n<6;n++){
   if(!allowedDownloadURL(url))fail('CRX_ORIGIN','Магазин перенаправил загрузку на неподдерживаемый адрес.');
   const response=await fetch(url,{redirect:'manual',signal:controller.signal,credentials:'omit',cache:'no-store'});
   if([301,302,303,307,308].includes(response.status)){const next=new URL(response.headers.get('location')||'',url).href;await response.body?.cancel();if(!allowedDownloadURL(next)||next===url)fail('CRX_ORIGIN','Недопустимое перенаправление магазина.');redirects.push({from:url,to:next,status:response.status});url=next;continue;}
   if(!response.ok){await response.body?.cancel();fail('CRX_DOWNLOAD','Chrome Web Store не отдал расширение (HTTP '+response.status+').');}
   const length=Number(response.headers.get('content-length'));if(length>LIMITS.download){await response.body?.cancel();fail('CRX_SIZE','Расширение превышает 64 МБ.');}
   if(!response.body)fail('CRX_DOWNLOAD','Магазин вернул пустой файл.');const chunks=[];let size=0;
   for await(const chunk of response.body){size+=chunk.length;if(size>LIMITS.download){controller.abort();fail('CRX_SIZE','Расширение превышает 64 МБ.');}chunks.push(Buffer.from(chunk));}
   const bytes=Buffer.concat(chunks,size),verified=verifyCrx(bytes,id);
   return {...verified,bytes,evidence:{...verified.evidence,source:'chrome-web-store',requestedURL:initial,downloadURL:url,redirects,downloadedAt:new Date().toISOString()}};
  }
  fail('CRX_ORIGIN','Слишком много перенаправлений магазина.');
 }catch(e){if(controller.signal.aborted&&e.code!=='CRX_SIZE')fail('CRX_DOWNLOAD','Загрузка расширения отменена или не завершилась за 60 секунд.');throw e;}
 finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
}
module.exports={ID,LIMITS,PUBLISHER_KEY_SHA256,verifyCrx,archiveFiles,runtimeFiles,extractVerified,downloadURL,allowedDownloadURL,downloadCrx};

'use strict';

// OOXML packages are patched in place at the ZIP-entry level. The bytes of
// untouched local records (including compressed streams and descriptors) survive.
const {inflateRawSync, deflateRawSync} = require('node:zlib');
const LIMITS = Object.freeze({packageBytes:32*1024*1024, entries:4096, pathBytes:1024,
  fileBytes:32*1024*1024, totalBytes:128*1024*1024, xmlBytes:8*1024*1024,
  xmlTotalBytes:24*1024*1024, mediaBytes:8*1024*1024, mediaTotalBytes:32*1024*1024,
  imagePixels:16000000, imageTotalPixels:32000000, imageFrames:32});
const archives = new WeakMap();
const decoder = new TextDecoder('utf-8', {fatal:true});
const crcTable = Uint32Array.from({length:256}, (_, n) => {
  for (let i=0;i<8;i++) n = n & 1 ? 0xedb88320 ^ n >>> 1 : n >>> 1;
  return n >>> 0;
});
function crc32(bytes) {
  let n=0xffffffff;
  for (const byte of bytes) n=crcTable[(n^byte)&255]^n>>>8;
  return (n^0xffffffff)>>>0;
}
function fail(code,message='Повреждён или не поддерживается пакет Office.') {
  const error=new Error(message);error.code=code;throw error;
}
function getArchive(archive) {const value=archives.get(archive);if(!value)fail('OFFICE_ARCHIVE');return value;}
function safeName(raw) {
  if(!raw || raw.startsWith('/') || /[\\\x00-\x1f\x7f:]/.test(raw) || raw.split('/').length>64)fail('OFFICE_PATH');
  const directory=raw.endsWith('/'), path=directory?raw.slice(0,-1):raw;
  if(!path || path.split('/').some(part=>!part || part==='.' || part==='..'))fail('OFFICE_PATH');
  return {path:raw, directory, key:path.normalize('NFC').toLowerCase()};
}
function extras(bytes,start,length) {
  const end=start+length;
  while(start<end) {
    if(start+4>end)fail('OFFICE_ZIP_EXTRA');
    const id=bytes.readUInt16LE(start),size=bytes.readUInt16LE(start+2);
    if(id===1)fail('OFFICE_ZIP64','ZIP64-документы пока не поддерживаются.');
    if(start+4+size>end)fail('OFFICE_ZIP_EXTRA');
    start+=4+size;
  }
}
function isMacroPath(path) {return /(?:^|\/)(?:vbaproject(?:signature)?\.bin|vbadata\.xml|activex(?:\/|$))/i.test(path);}
function unpack(data,entry) {
  const compressed=data.bytes.subarray(entry.start,entry.start+entry.compressedSize);
  let result;
  try {result=entry.method===0?Buffer.from(compressed):inflateRawSync(compressed,{maxOutputLength:Math.max(1,entry.size)});}
  catch {fail('OFFICE_INFLATE','Не удалось распаковать часть документа в допустимом размере.');}
  if(result.length!==entry.size || crc32(result)!==entry.crc)fail('OFFICE_CRC','Контрольная сумма части документа не совпала.');
  return result;
}
function xmlText(buffer) {
  let text;try{text=decoder.decode(buffer);}catch{fail('OFFICE_XML_ENCODING','Ожидается XML в кодировке UTF-8.');}
  if(/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(text))fail('OFFICE_XML_ENTITY','XML с внешними сущностями не поддерживается.');
  return text;
}
function read(input) {
  if(!(input instanceof Uint8Array))fail('OFFICE_INPUT');
  if(input.byteLength<22 || input.byteLength>LIMITS.packageBytes)fail('OFFICE_SIZE','Документ должен быть не больше 32 МБ.');
  const bytes=Buffer.from(input), u16=p=>bytes.readUInt16LE(p),u32=p=>bytes.readUInt32LE(p);
  let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--) {
    if(u32(i)===0x06054b50 && i+22+u16(i+20)===bytes.length){end=i;break;}
  }
  if(end<0)fail('OFFICE_ZIP_END');
  const count=u16(end+10),centralSize=u32(end+12),centralOffset=u32(end+16);
  if(count===0xffff || centralSize===0xffffffff || centralOffset===0xffffffff)fail('OFFICE_ZIP64');
  if(u16(end+4)||u16(end+6)||u16(end+8)!==count||!count||count>LIMITS.entries||centralOffset+centralSize!==end||centralOffset>=end)fail('OFFICE_ZIP_DIRECTORY');
  const entries=[],names=new Map();let pos=centralOffset,total=0;
  for(let i=0;i<count;i++) {
    if(pos+46>end || u32(pos)!==0x02014b50)fail('OFFICE_ZIP_DIRECTORY');
    const flags=u16(pos+8),method=u16(pos+10),crc=u32(pos+16),compressedSize=u32(pos+20),size=u32(pos+24);
    const nameLength=u16(pos+28),extraLength=u16(pos+30),commentLength=u16(pos+32),local=u32(pos+42),mode=u32(pos+38)>>>16;
    const centralEnd=pos+46+nameLength+extraLength+commentLength;
    if(flags&1 || flags&0x40)fail('OFFICE_ENCRYPTED','Зашифрованный документ откройте и сохраните без пароля в Office.');
    if(size===0xffffffff||compressedSize===0xffffffff||local===0xffffffff)fail('OFFICE_ZIP64');
    if(!nameLength||nameLength>LIMITS.pathBytes||centralEnd>end||u16(pos+34)||flags&~0x080e||![0,8].includes(method)||size>LIMITS.fileBytes||compressedSize>LIMITS.packageBytes||![0,0x8000,0x4000].includes(mode&0xf000))fail('OFFICE_ZIP_ENTRY');
    let name;try{name=decoder.decode(bytes.subarray(pos+46,pos+46+nameLength));}catch{fail('OFFICE_PATH_ENCODING');}
    const named=safeName(name);
    if(names.has(named.key))fail('OFFICE_DUPLICATE');
    names.set(named.key,named.directory?'directory':'file');
    if(isMacroPath(name))fail('OFFICE_MACROS','Документы с макросами и ActiveX пока не поддерживаются.');
    extras(bytes,pos+46+nameLength,extraLength);
    if(local+30>centralOffset||u32(local)!==0x04034b50||u16(local+6)!==flags||u16(local+8)!==method)fail('OFFICE_LOCAL_HEADER');
    const localNameLength=u16(local+26),localExtraLength=u16(local+28),start=local+30+localNameLength+localExtraLength;
    if(start>centralOffset||start+compressedSize>centralOffset||localNameLength!==nameLength||!bytes.subarray(local+30,local+30+localNameLength).equals(bytes.subarray(pos+46,pos+46+nameLength)))fail('OFFICE_LOCAL_HEADER');
    extras(bytes,local+30+localNameLength,localExtraLength);
    let stop=start+compressedSize;
    if(flags&8) {
      // Local sizes may be zero with a descriptor, but never contradict it.
      for(const [offset,value] of [[14,crc],[18,compressedSize],[22,size]])if(u32(local+offset)!==0&&u32(local+offset)!==value)fail('OFFICE_LOCAL_HEADER');
      if(stop+12>centralOffset)fail('OFFICE_DESCRIPTOR');
      let descriptor=stop;if(u32(descriptor)===0x08074b50)descriptor+=4;
      if(descriptor+12>centralOffset||u32(descriptor)!==crc||u32(descriptor+4)!==compressedSize||u32(descriptor+8)!==size)fail('OFFICE_DESCRIPTOR');
      stop=descriptor+12;
    } else if(u32(local+14)!==crc||u32(local+18)!==compressedSize||u32(local+22)!==size)fail('OFFICE_LOCAL_HEADER');
    if(method===0&&size!==compressedSize || named.directory&&(size||compressedSize||crc))fail('OFFICE_ZIP_ENTRY');
    total+=size;if(total>LIMITS.totalBytes)fail('OFFICE_EXPANDED_SIZE');
    entries.push({...named,local,start,stop,central:pos,centralEnd,flags,method,crc,size,compressedSize});
    pos=centralEnd;
  }
  if(pos!==end)fail('OFFICE_ZIP_DIRECTORY');
  const localOrder=[...entries].sort((a,b)=>a.local-b.local);
  for(let i=1;i<localOrder.length;i++)if(localOrder[i].local<localOrder[i-1].stop)fail('OFFICE_OVERLAP');
  for(const key of names.keys()) {const parts=key.split('/');parts.pop();while(parts.length){if(names.get(parts.join('/'))==='file')fail('OFFICE_PATH_COLLISION');parts.pop();}}
  const byPath=new Map(entries.map(entry=>[entry.path,entry]));
  const word=byPath.has('word/document.xml'),sheet=byPath.has('xl/workbook.xml');
  if(word===sheet||!byPath.has('[Content_Types].xml')||!byPath.has('_rels/.rels'))fail('OFFICE_FORMAT','Поддерживаются обычные документы .docx и таблицы .xlsx.');
  let xmlTotal=0;
  for(const entry of entries)if(selectedXML(word?'docx':'xlsx',entry.path)){
    xmlTotal+=entry.size;if(entry.size>LIMITS.xmlBytes||xmlTotal>LIMITS.xmlTotalBytes)fail('OFFICE_XML_SIZE','Текстовая часть документа слишком велика.');
  }
  const data={bytes,entries,byPath,localOrder,centralOffset,end,total};
  // Validate every payload, even an unknown part that will be copied unchanged.
  for(const entry of entries)unpack(data,entry);
  const types=xmlText(unpack(data,byPath.get('[Content_Types].xml')));
  if(/macroenabled|vbaproject|activex/i.test(types))fail('OFFICE_MACROS','Документы с макросами и ActiveX пока не поддерживаются.');
  const archive=Object.freeze({kind:word?'docx':'xlsx',entries:Object.freeze(entries.map(({path,size,compressedSize,method,directory})=>Object.freeze({path,size,compressedSize,method,directory})))});
  archives.set(archive,data);return archive;
}
function extract(archive,path) {
  const data=getArchive(archive),entry=data.byPath.get(path);if(!entry||entry.directory)fail('OFFICE_PART');
  return unpack(data,entry);
}
function rewrite(archive,patches,removed=new Set()) {
  const data=getArchive(archive);
  if(!patches||typeof patches!=='object'||Array.isArray(patches))fail('OFFICE_PATCH');
  const changed=new Map();let total=data.total;
  for(const path of removed){const entry=data.byPath.get(path);if(entry)total-=entry.size;}
  for(const [path,value] of Object.entries(patches)) {
    const entry=data.byPath.get(path);if(!entry||entry.directory||removed.has(path))fail('OFFICE_PATCH_PART','Нельзя добавить неизвестную часть в исходный документ.');
    if(typeof value!=='string'&&!(value instanceof Uint8Array))fail('OFFICE_PATCH_VALUE');
    const content=typeof value==='string'?Buffer.from(value,'utf8'):Buffer.from(value);
    if(content.length>LIMITS.fileBytes||/\.(?:xml|rels)$/i.test(path)&&content.length>LIMITS.xmlBytes)fail('OFFICE_PATCH_SIZE');
    if(/\.(?:xml|rels)$/i.test(path)){
      const text=xmlText(content);
      if(path==='[Content_Types].xml'&&/macroenabled|vbaproject|activex/i.test(text))fail('OFFICE_MACROS');
    }
    if(content.equals(unpack(data,entry)))continue;
    total+=content.length-entry.size;if(total>LIMITS.totalBytes)fail('OFFICE_EXPANDED_SIZE');
    const compressed=entry.method===0?content:deflateRawSync(content),crc=crc32(content);
    const header=Buffer.from(data.bytes.subarray(entry.local,entry.start)),flags=entry.flags&~8;
    header.writeUInt16LE(flags,6);header.writeUInt32LE(crc,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(content.length,22);
    changed.set(path,{header,compressed,flags,crc,size:content.length,compressedSize:compressed.length});
  }
  if(!changed.size&&!removed.size)return Buffer.from(data.bytes);
  const pieces=[],offsets=new Map();let cursor=0,length=0;
  const push=piece=>{pieces.push(piece);length+=piece.length;};
  for(const entry of data.localOrder) {
    push(data.bytes.subarray(cursor,entry.local));
    if(removed.has(entry.path)){cursor=entry.stop;continue;}
    offsets.set(entry.path,length);
    const next=changed.get(entry.path);
    if(next){push(next.header);push(next.compressed);}else push(data.bytes.subarray(entry.local,entry.stop));
    cursor=entry.stop;
  }
  push(data.bytes.subarray(cursor,data.centralOffset));const centralOffset=length;
  for(const entry of data.entries) {
    if(removed.has(entry.path))continue;
    const central=Buffer.from(data.bytes.subarray(entry.central,entry.centralEnd)),next=changed.get(entry.path);
    central.writeUInt32LE(offsets.get(entry.path),42);
    if(next){central.writeUInt16LE(next.flags,8);central.writeUInt32LE(next.crc,16);central.writeUInt32LE(next.compressedSize,20);central.writeUInt32LE(next.size,24);}
    push(central);
  }
  const centralSize=length-centralOffset,tail=Buffer.from(data.bytes.subarray(data.end));
  const count=data.entries.filter(entry=>!removed.has(entry.path)).length;
  tail.writeUInt16LE(count,8);tail.writeUInt16LE(count,10);
  tail.writeUInt32LE(centralSize,12);tail.writeUInt32LE(centralOffset,16);push(tail);
  if(length>LIMITS.packageBytes)fail('OFFICE_SIZE','После изменений документ превышает 32 МБ.');
  return Buffer.concat(pieces,length);
}
function replace(archive,patches){return rewrite(archive,patches);}

const PACKAGE_REL='http://schemas.openxmlformats.org/package/2006/relationships';
const PACKAGE_TYPES='http://schemas.openxmlformats.org/package/2006/content-types';
const CHAIN_PATH='xl/calcChain.xml';
const CHAIN_TYPE='application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml';
const CHAIN_RELS=new Set(['http://schemas.openxmlformats.org/officeDocument/2006/relationships/calcChain','http://purl.oclc.org/ooxml/officeDocument/relationships/calcChain']);
function unescapeAttribute(text) {
  if(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);)/.test(text))fail('OFFICE_PACKAGE_XML');
  return text.replace(/&([^;]+);/g,(_,entity)=>{
    const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(Object.hasOwn(named,entity))return named[entity];
    const code=entity.startsWith('#x')?parseInt(entity.slice(2),16):Number(entity.slice(1));
    if(!Number.isInteger(code)||code<1||code>0x10ffff||code>=0xd800&&code<=0xdfff)fail('OFFICE_PACKAGE_XML');
    return String.fromCodePoint(code);
  });
}
// These two OPC metadata documents have small, flat records. Index their exact
// element ranges instead of serializing the XML: comments, unknown extensions,
// namespace declarations and every surviving byte retain their original form.
function metadataNodes(text,expectedRoot,expectedNamespace) {
  const stack=[],nodes=[];let pos=0,rootSeen=false,rootClosed=false;
  while(pos<text.length) {
    const start=text.indexOf('<',pos);
    if(start<0){if(!stack.length&&text.slice(pos).trim())fail('OFFICE_PACKAGE_XML');pos=text.length;break;}
    if(!stack.length&&text.slice(pos,start).trim())fail('OFFICE_PACKAGE_XML');
    if(text.startsWith('<!--',start)){const stop=text.indexOf('-->',start+4);if(stop<0)fail('OFFICE_PACKAGE_XML');pos=stop+3;continue;}
    if(text.startsWith('<?',start)){const stop=text.indexOf('?>',start+2);if(stop<0)fail('OFFICE_PACKAGE_XML');pos=stop+2;continue;}
    if(text.startsWith('<![CDATA[',start)){const stop=text.indexOf(']]>',start+9);if(stop<0||!stack.length)fail('OFFICE_PACKAGE_XML');pos=stop+3;continue;}
    let stop=start+1,quote='';
    for(;stop<text.length;stop++){const c=text[stop];if(quote){if(c===quote)quote='';}else if(c==='"'||c==="'")quote=c;else if(c==='>')break;}
    if(stop>=text.length||quote)fail('OFFICE_PACKAGE_XML');
    const tag=text.slice(start,stop+1);pos=stop+1;
    if(tag.startsWith('</')){
      const match=/^<\/([A-Za-z_][\w:.-]*)\s*>$/.exec(tag),frame=stack.pop();
      if(!match||!frame||match[1]!==frame.qname)fail('OFFICE_PACKAGE_XML');
      frame.end=pos;if(!stack.length)rootClosed=true;continue;
    }
    const opening=/^<([A-Za-z_][\w:.-]*)/.exec(tag);if(!opening||rootClosed)fail('OFFICE_PACKAGE_XML');
    const qname=opening[1],selfClosing=/\/\s*>$/.test(tag),attributes=Object.create(null);
    let rest=tag.slice(opening[0].length,selfClosing?tag.lastIndexOf('/'):tag.length-1);
    while(rest.trim()){
      const a=/^\s+([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(rest);
      if(!a||Object.hasOwn(attributes,a[1])||/[<]/.test(a[2]??a[3]))fail('OFFICE_PACKAGE_XML');
      attributes[a[1]]=unescapeAttribute(a[2]??a[3]);rest=rest.slice(a[0].length);
    }
    const namespaces={...(stack.at(-1)?.namespaces||{})};
    for(const [name,value] of Object.entries(attributes)){if(name==='xmlns')namespaces['']=value;else if(name.startsWith('xmlns:'))namespaces[name.slice(6)]=value;}
    const components=qname.split(':');if(components.length>2)fail('OFFICE_PACKAGE_XML');
    const name=components.at(-1),prefix=components.length===2?components[0]:'',namespace=namespaces[prefix]||'';
    if(prefix&&!namespace)fail('OFFICE_PACKAGE_XML');
    const frame={qname,name,namespace,attributes,namespaces,start,end:selfClosing?pos:null};
    if(!stack.length){if(rootSeen||name!==expectedRoot||namespace!==expectedNamespace)fail('OFFICE_PACKAGE_XML');rootSeen=true;}
    else if(stack.length===1)nodes.push(frame);
    if(!selfClosing){stack.push(frame);if(stack.length>64)fail('OFFICE_PACKAGE_XML');}
    else if(!stack.length)rootClosed=true;
  }
  if(!rootSeen||!rootClosed||stack.length)fail('OFFICE_PACKAGE_XML');
  return nodes;
}
function omitMetadata(text,nodes) {
  let result=text;for(const node of [...nodes].sort((a,b)=>b.start-a.start))result=result.slice(0,node.start)+result.slice(node.end);return result;
}
function resolvePackagePart(target,base='') {
  let decoded;try{decoded=decodeURIComponent(target);}catch{fail('OFFICE_CALC_CHAIN','Неверная ссылка на цепочку пересчёта Excel.');}
  if(!decoded||/[\\\x00-\x20?#]/.test(decoded)||/^[a-z][a-z0-9+.-]*:/i.test(decoded))fail('OFFICE_CALC_CHAIN');
  const parts=decoded.startsWith('/')?[]:base.split('/').filter(Boolean);
  for(const segment of decoded.split('/')){if(!segment||segment==='.')continue;if(segment==='..'){if(!parts.length)fail('OFFICE_CALC_CHAIN');parts.pop();}else parts.push(segment);}
  return parts.join('/');
}
function save(archive,patches) {
  if(archive.kind!=='xlsx')return replace(archive,patches);
  const data=getArchive(archive);
  if(!patches||typeof patches!=='object'||Array.isArray(patches))fail('OFFICE_PATCH');
  // Only the host can derive deletion. A patch never accepts a removal list.
  const touched=Object.entries(patches).some(([path,value])=>
    /^(?:xl\/workbook\.xml|xl\/worksheets\/[^/]+\.xml)$/.test(path)&&
    data.byPath.has(path)&&(typeof value==='string'||value instanceof Uint8Array)&&
    !Buffer.from(value).equals(unpack(data,data.byPath.get(path))));
  if(!touched)return replace(archive,patches);
  const next={...patches},removed=new Set();
  if(data.byPath.has(CHAIN_PATH))removed.add(CHAIN_PATH);
  const relationshipPath='xl/_rels/workbook.xml.rels';
  if(data.byPath.has(relationshipPath)) {
    const xml=xmlText(extract(archive,relationshipPath)),nodes=metadataNodes(xml,'Relationships',PACKAGE_REL);
    const chain=nodes.filter(node=>node.namespace===PACKAGE_REL&&node.name==='Relationship'&&CHAIN_RELS.has(node.attributes.Type));
    for(const node of chain){
      if(node.attributes.TargetMode==='External'||resolvePackagePart(node.attributes.Target||'','xl')!==CHAIN_PATH)fail('OFFICE_CALC_CHAIN','Редактирование нестандартной цепочки пересчёта Excel пока не поддерживается.');
    }
    if(chain.length)next[relationshipPath]=omitMetadata(xml,chain);
  }
  const typesPath='[Content_Types].xml',types=xmlText(extract(archive,typesPath)),typeNodes=metadataNodes(types,'Types',PACKAGE_TYPES);
  const chainTypes=typeNodes.filter(node=>node.namespace===PACKAGE_TYPES&&node.name==='Override'&&(node.attributes.ContentType===CHAIN_TYPE||node.attributes.PartName==='/'+CHAIN_PATH));
  for(const node of chainTypes)if(resolvePackagePart(node.attributes.PartName||'')!==CHAIN_PATH)fail('OFFICE_CALC_CHAIN','Редактирование нестандартной цепочки пересчёта Excel пока не поддерживается.');
  if(chainTypes.length)next[typesPath]=omitMetadata(types,chainTypes);
  return rewrite(archive,next,removed);
}
function selectedXML(kind,path) {
  if(path==='[Content_Types].xml'||path==='_rels/.rels')return true;
  if(kind==='docx')return /^word\/(?:document|styles|numbering|settings|fontTable|header\d*|footer\d*)\.xml$/.test(path)||/^word\/_rels\/(?:document|header\d*|footer\d*)\.xml\.rels$/.test(path);
  return /^xl\/(?:workbook|styles|sharedStrings)\.xml$/.test(path)||path==='xl/_rels/workbook.xml.rels'||/^xl\/worksheets\/[^/]+\.xml$/.test(path);
}
function imageMime(bytes) {
  if(bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
  if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if(bytes.length>=6&&['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6)))return 'image/gif';
  if(bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';
  return null;
}
function imageDimensions(bytes,mime) {
  const valid=(width,height,frames=1)=>Number.isInteger(width)&&Number.isInteger(height)&&width>0&&height>0&&frames>0&&frames<=LIMITS.imageFrames&&width*height*frames<=LIMITS.imagePixels?{width,height,frames,pixels:width*height*frames}:null;
  if(mime==='image/png'){
    if(bytes.length<33||bytes.readUInt32BE(8)!==13||bytes.toString('ascii',12,16)!=='IHDR'||crc32(bytes.subarray(12,29))!==bytes.readUInt32BE(29))return null;
    const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);if(!valid(width,height))return null;
    let pos=8,frames=1,frameControls=0,header=false;
    while(pos+12<=bytes.length){const size=bytes.readUInt32BE(pos),type=bytes.toString('ascii',pos+4,pos+8),end=pos+12+size;if(end>bytes.length)return null;
      if(type==='IHDR'){if(header)return null;header=true;}
      if(type==='acTL'){if(size!==8)return null;frames=bytes.readUInt32BE(pos+8);}
      if(type==='fcTL'){if(size!==26)return null;frameControls++;}
      if(!valid(width,height,Math.max(frames,frameControls)))return null;
      if(type==='IEND')return valid(width,height,Math.max(frames,frameControls));pos=end;
    }return null;
  }
  if(mime==='image/jpeg'){
    let pos=2;const frameMarkers=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
    while(pos<bytes.length){if(bytes[pos++]!==255)return null;while(pos<bytes.length&&bytes[pos]===255)pos++;if(pos>=bytes.length)return null;const marker=bytes[pos++];
      if(marker===0xd9||marker===0xda)return null;if(marker===1||marker>=0xd0&&marker<=0xd8)continue;
      if(pos+2>bytes.length)return null;const size=bytes.readUInt16BE(pos);if(size<2||pos+size>bytes.length)return null;
      if(frameMarkers.has(marker))return size>=8?valid(bytes.readUInt16BE(pos+5),bytes.readUInt16BE(pos+3)):null;pos+=size;
    }return null;
  }
  if(mime==='image/gif'){
    if(bytes.length<13)return null;const width=bytes.readUInt16LE(6),height=bytes.readUInt16LE(8);if(!valid(width,height))return null;
    let pos=13+(bytes[10]&128?3*(1<<((bytes[10]&7)+1)):0),frames=0;
    const skipBlocks=()=>{while(pos<bytes.length){const size=bytes[pos++];if(!size)return true;pos+=size;if(pos>bytes.length)return false;}return false;};
    while(pos<bytes.length){const type=bytes[pos++];if(type===0x3b)return frames?valid(width,height,frames):null;
      if(type===0x21){if(pos>=bytes.length)return null;pos++;if(!skipBlocks())return null;}
      else if(type===0x2c){if(pos+9>bytes.length)return null;const frameWidth=bytes.readUInt16LE(pos+4),frameHeight=bytes.readUInt16LE(pos+6),flags=bytes[pos+8];
        if(!valid(frameWidth,frameHeight)||frameWidth>width||frameHeight>height)return null;pos+=9+(flags&128?3*(1<<((flags&7)+1)):0);if(pos>=bytes.length)return null;pos++;if(!skipBlocks()||!valid(width,height,++frames))return null;
      }else return null;
    }return null;
  }
  if(mime==='image/webp'){
    if(bytes.length<20||bytes.readUInt32LE(4)+8!==bytes.length)return null;let pos=12,canvas=null,bitstream=null;
    while(pos+8<=bytes.length){const type=bytes.toString('ascii',pos,pos+4),size=bytes.readUInt32LE(pos+4),start=pos+8,end=start+size;if(end>bytes.length)return null;
      if(type==='VP8X'){if(size!==10||bytes[start]&2)return null;canvas=valid(bytes.readUIntLE(start+4,3)+1,bytes.readUIntLE(start+7,3)+1);if(!canvas)return null;}
      else if(type==='ANIM'||type==='ANMF')return null; // Animated WebP remains in the package, not in the preview.
      else if(type==='VP8 '){if(size<10||bytes[start+3]!==0x9d||bytes[start+4]!==1||bytes[start+5]!==0x2a)return null;bitstream=valid(bytes.readUInt16LE(start+6)&0x3fff,bytes.readUInt16LE(start+8)&0x3fff);if(!bitstream)return null;}
      else if(type==='VP8L'){if(size<5||bytes[start]!==0x2f)return null;const bits=bytes.readUInt32LE(start+1);bitstream=valid((bits&0x3fff)+1,((bits>>>14)&0x3fff)+1);if(!bitstream)return null;}
      pos=end+(size&1);
    }
    if(pos!==bytes.length||!bitstream||canvas&&(canvas.width!==bitstream.width||canvas.height!==bitstream.height))return null;return canvas||bitstream;
  }
  return null;
}
function snapshot(archive) {
  const data=getArchive(archive),parts=Object.create(null),media=Object.create(null);let xmlTotal=0,mediaTotal=0,imagePixels=0;
  for(const entry of data.entries) {
    if(selectedXML(archive.kind,entry.path)) {
      xmlTotal+=entry.size;if(entry.size>LIMITS.xmlBytes||xmlTotal>LIMITS.xmlTotalBytes)fail('OFFICE_XML_SIZE','Текстовая часть документа слишком велика.');
      parts[entry.path]=xmlText(unpack(data,entry));
    } else if(/^(?:word|xl)\/media\/[^/]+$/.test(entry.path)&&entry.size<=LIMITS.mediaBytes) {
      const bytes=unpack(data,entry),mime=imageMime(bytes),dimensions=mime&&imageDimensions(bytes,mime);
      if(!dimensions||imagePixels+dimensions.pixels>LIMITS.imageTotalPixels)continue;
      imagePixels+=dimensions.pixels;
      mediaTotal+=entry.size;if(mediaTotal>LIMITS.mediaTotalBytes)fail('OFFICE_MEDIA_SIZE');
      media[entry.path]={mime,dataUrl:`data:${mime};base64,${bytes.toString('base64')}`,width:dimensions.width,height:dimensions.height};
    }
  }
  return {kind:archive.kind,parts,media,...(archive.kind==='xlsx'?{hasCalcChain:data.byPath.has(CHAIN_PATH)}:{})};
}
module.exports={read,extract,replace,save,snapshot,LIMITS};

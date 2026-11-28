'use strict';

// Subscription transport is separate from Chromium's sessions. It has no cookie
// jar, follows no redirects and pins each connection to checked public DNS
// answers, including when a user adds a subscription URL.
const https=require('node:https'),dns=require('node:dns'),{Readable}=require('node:stream');
const {isIP,BlockList}=require('node:net'),{createHash}=require('node:crypto');
const SOURCES=Object.freeze([
 Object.freeze({id:'easylist',url:'https://easylist-downloads.adblockplus.org/easylist.txt',name:'EasyList',builtin:true,authors:'The EasyList authors',homepage:'https://easylist.to/',license:'https://creativecommons.org/licenses/by-sa/3.0/'}),
 Object.freeze({id:'ruadlist',url:'https://easylist-downloads.adblockplus.org/ruadlist.txt',name:'RU AdList',builtin:true,authors:'RU AdList authors (see the preserved list header)',homepage:'https://forums.lanik.us/viewforum.php?f=102',license:'https://creativecommons.org/licenses/by/3.0/'})
]);
const MAX_BYTES=8*1024*1024,MAX_CUSTOM_BYTES=2*1024*1024,MAX_CUSTOM_SOURCES=8,MAX_URL=2048,MAX_NAME=80;
const sha256=value=>createHash('sha256').update(value).digest('hex');
const invalidURL=()=>Object.assign(Error('Укажите публичный HTTPS-адрес списка без логина, пароля и нестандартного порта.'),{code:'MOUSE_ADBLOCK_SUBSCRIPTION_URL'});
function normalizeURL(value){
 if(typeof value!=='string'||value.length>MAX_URL||/[\s\x00-\x1f\x7f\\]/.test(value)||!/^https:\/\//i.test(value))throw invalidURL();
 const authority=value.slice(value.indexOf('://')+3).split(/[/?#]/,1)[0];
 if(!authority||authority.includes('@')||authority.includes('%')||authority.endsWith(':'))throw invalidURL();
 let url;try{url=new URL(value);}catch{throw invalidURL();}
 if(url.protocol!=='https:'||url.username||url.password||url.hash||url.port)throw invalidURL();
 const host=url.hostname.toLowerCase().replace(/\.$/,'');
 // IP literals and local-only names are not subscription endpoints. DNS is
 // checked again by the actual socket lookup, so rebinding cannot bypass this.
 if(!host.includes('.')||host.length>253||isIP(host)||host.startsWith('[')||/(?:^|\.)(?:localhost|local|internal|home|lan|test|invalid|example|onion)$/.test(host)||!host.split('.').every(label=>label.length>0&&label.length<=63&&/^[a-z\d](?:[a-z\d-]*[a-z\d])?$/.test(label)))throw invalidURL();
 url.hostname=host;if(url.href.length>MAX_URL)throw invalidURL();return url.href;
}
function customSource(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['url','name'].includes(key)))throw invalidURL();
 const url=normalizeURL(input.url),name=input.name===undefined?new URL(url).hostname:input.name;
 if(typeof name!=='string'||!name.trim()||name.length>MAX_NAME||/[\x00-\x1f\x7f]/.test(name))throw Object.assign(Error('Название списка должно содержать от 1 до '+MAX_NAME+' символов.'),{code:'MOUSE_ADBLOCK_SUBSCRIPTION_NAME'});
 return{id:'custom-'+sha256(url).slice(0,24),url,name:name.trim(),builtin:false,enabled:true};
}
function validateSource(source){
 if(SOURCES.some(item=>item.id===source?.id&&item.url===source.url))return;
 if(!source||source.builtin!==false)throw Error('Unknown filter subscription');
 const normalized=customSource({url:source.url,name:source.name});
 if(source.id!==normalized.id||source.url!==normalized.url)throw Error('Unknown filter subscription');
}
function validateText(text,{custom=false}={}){
 if(typeof text!=='string'||Buffer.byteLength(text)>(custom?MAX_CUSTOM_BYTES:MAX_BYTES)||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)||!/^\uFEFF?\[Adblock(?: Plus)? [\d.]+\]/.test(text))throw Error('Invalid filter-list format');
 const lines=text.split(/\r?\n/);
 if(lines.length<(custom?2:50)||lines.length>250000||lines.some(line=>/^\s*%include\b/i.test(line)))throw Error('Incomplete filter list');
 return text;
}
function validator(value,max=1024){
 if(value===undefined||value===null||value==='')return null;
 if(typeof value!=='string'||value.length>max||/[\x00-\x1f\x7f-\uffff]/.test(value))throw Error('Invalid HTTP cache validator');
 return value;
}
function validRecord(value,source,now=Date.now()){
 if(!value||value.schema!==1||value.source!==source.id||value.url!==source.url||typeof value.updatedAt!=='string'||value.checkedAt!==undefined&&typeof value.checkedAt!=='string')throw Error('Invalid filter cache');
 const updated=Date.parse(value.updatedAt),checked=value.checkedAt===undefined?updated:Date.parse(value.checkedAt);
 if(!Number.isFinite(updated)||!Number.isFinite(checked)||updated>now+300000||checked>now+300000||checked<updated)throw Error('Invalid filter cache date');
 validateText(value.text,{custom:source.builtin===false});
 if(value.sha256!==sha256(value.text))throw Error('Filter cache checksum mismatch');
 validator(value.etag);const modified=validator(value.lastModified,128);if(modified&&!Number.isFinite(Date.parse(modified)))throw Error('Invalid Last-Modified validator');
 return value;
}
const blocked=new BlockList();
for(const [address,prefix]of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',3]])blocked.addSubnet(address,prefix,'ipv4');
for(const [address,prefix]of [['2001::',23],['2001:db8::',32],['2002::',16],['3fff::',20]])blocked.addSubnet(address,prefix,'ipv6');
function publicAddress(address){
 const family=isIP(address);
 if(family===4)return!blocked.check(address,'ipv4');
 return family===6&&/^[23][0-9a-f]{3}:/i.test(address)&&!blocked.check(address,'ipv6');
}
function publicLookup(hostname,options,callback,lookup=dns.lookup){
 lookup(hostname,{all:true,verbatim:true},(error,answers)=>{
  if(error)return callback(error);
  if(!Array.isArray(answers)||!answers.length||answers.some(item=>!publicAddress(item.address)))return callback(Error('Subscription DNS must resolve only to public addresses'));
  const family=typeof options==='number'?options:options?.family;
  const matches=answers.filter(item=>!family||item.family===family);
  if(!matches.length)return callback(Error('Subscription address family unavailable'));
  if(options?.all)return callback(null,matches);
  callback(null,matches[0].address,matches[0].family);
 });
}
function requestResponse(url,{headers,signal}){
 return new Promise((resolve,reject)=>{
  const request=https.request(url,{method:'GET',headers,signal,agent:false,lookup:publicLookup},response=>resolve({status:response.statusCode,headers:{get:name=>{
   const value=response.headers[name.toLowerCase()];return Array.isArray(value)?value.join(', '):value||null;
  }},body:Readable.toWeb(response)}));
  request.once('error',reject);request.end();
 });
}
async function downloadList(source,{signal,fetchImpl,record,withMetadata=false,now=Date.now()}={}){
 validateSource(source);
 let previous=null;try{if(record)previous=validRecord(record,source,now);}catch{}
 const headers={Accept:'text/plain','Accept-Encoding':'identity','User-Agent':'Mouse-Browser-Filter-Updater'};
 if(previous?.etag)headers['If-None-Match']=previous.etag;
 if(previous?.lastModified)headers['If-Modified-Since']=previous.lastModified;
 const conditional=!!(headers['If-None-Match']||headers['If-Modified-Since']);
 const options={method:'GET',redirect:'error',credentials:'omit',cache:'no-store',signal,headers};
 const response=await(fetchImpl?fetchImpl(source.url,options):requestResponse(source.url,options));
 let reader;
 try{
  const etag=validator(response.headers.get('etag')),lastModified=validator(response.headers.get('last-modified'),128);
  if(lastModified&&!Number.isFinite(Date.parse(lastModified)))throw Error('Invalid Last-Modified validator');
  if(response.status===304){
   if(!previous||!conditional)throw Error('Not Modified requires a verified conditional cache');
   return withMetadata?{status:304,etag:etag||previous.etag||null,lastModified:lastModified||previous.lastModified||null}:previous.text;
  }
  if(response.status!==200||!response.body)throw Error('Filter server unavailable');
  const type=response.headers.get('content-type')||'',encoding=response.headers.get('content-encoding')||'';
  if(type&&!/^(?:text\/plain|application\/octet-stream)(?:;|$)/i.test(type))throw Error('Unexpected filter content type');
  if(encoding&&!/^identity$/i.test(encoding))throw Error('Unexpected filter content encoding');
  const limit=source.builtin===false?MAX_CUSTOM_BYTES:MAX_BYTES,declared=Number(response.headers.get('content-length'));
  if(declared>limit)throw Error('Filter list too large');
  reader=response.body.getReader();const chunks=[];let bytes=0;
  for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>limit)throw Error('Filter list too large');chunks.push(Buffer.from(value));}
  const text=validateText(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,bytes)),{custom:source.builtin===false});
  return withMetadata?{status:200,text,etag,lastModified}:text;
 }finally{
  try{if(reader){await reader.cancel();reader.releaseLock();}else await response.body?.cancel();}catch{}
 }
}
module.exports={SOURCES,MAX_BYTES,MAX_CUSTOM_BYTES,MAX_CUSTOM_SOURCES,sha256,normalizeURL,customSource,validateText,validRecord,publicAddress,publicLookup,downloadList};

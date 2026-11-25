'use strict';

// A deliberately bounded ABP network-filter subset. Unsupported blocking rules
// are dropped as a whole. Network exceptions may only become more permissive.
const {getDomain}=require('tldts');
const {domainToASCII}=require('node:url');
const MAX_URL=8192,MAX_RULE=1024,TOKEN_SIZE=5;
const TYPES=Object.freeze({script:'script',image:'image',stylesheet:'stylesheet',object:'object',
 xmlhttprequest:'xhr',subdocument:'subFrame',media:'media',font:'font',websocket:'webSocket',
 ping:'ping',other:'other',document:'mainFrame'});
const HTTP=new Set(['http:','https:','ws:','wss:']);
const RESOURCE_TYPES=new Set(Object.values(TYPES));
const COSMETIC_OPTIONS=new Set(['elemhide','generichide','specifichide','ehide','ghide','shide']);
const SEED_RULES='! Mouse basic advertising-domain fallback (owner request)\n||ads.vk.com^\n||an.yandex.ru^\n||doubleclick.net^\n';

function hostname(value){
 if(typeof value!=='string'||!value||value.length>253)return '';
 const host=domainToASCII(value.toLowerCase().replace(/\.$/,''));
 return /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(host)?host:'';
}
function sameOrSubdomain(host,domain){return host===domain||host.endsWith('.'+domain);}
function parseURL(value){
 if(typeof value!=='string'||value.length>MAX_URL)return null;
 try{const url=new URL(value);if(!HTTP.has(url.protocol))return null;url.hash='';url.hostname=url.hostname.replace(/\.$/,'');return url;}catch{return null;}
}
function site(host){return getDomain(host,{allowPrivateDomains:true,extractHostname:false})||host;}
function sourceURL(details){
 // An explicit opaque initiator is unknown, not the origin of its referrer.
 if(details.initiatorOrigin==='null')return null;
 const origin=parseURL(details.initiatorOrigin),referrer=parseURL(details.referrer);
 if(typeof details.initiatorOrigin==='string'&&details.initiatorOrigin&&!origin)return null;
 if(origin){
  if(referrer?.origin===origin.origin)return referrer;
  const frame=parseURL(details.frameUrl);if(frame?.origin===origin.origin)return frame;
  return origin;
 }
 return referrer;
}
function parseRule(input){
 if(typeof input!=='string')return null;
 let line=input.trim();if(!line||line.length>MAX_RULE||/^[!\[]/.test(line)||line.includes('#')||/\s/.test(line))return null;
 const exception=line.startsWith('@@');if(exception)line=line.slice(2);
 const dollar=line.indexOf('$');let pattern=dollar<0?line:line.slice(0,dollar);
 const optionText=dollar<0?'':line.slice(dollar+1);if(optionText.includes('$'))return null;
 if(!pattern||pattern.startsWith('/')&&pattern.endsWith('/')||pattern.includes('\\'))return null;
 const options=optionText?optionText.split(','):[];
 if(exception&&options.some(option=>COSMETIC_OPTIONS.has(option.toLowerCase()))&&!options.some(option=>option.toLowerCase()==='document'))return null;
 const canonical=(exception?'@@':'')+pattern+(options.filter(x=>x.toLowerCase()!=='badfilter').length?'$'+options.filter(x=>x.toLowerCase()!=='badfilter').sort().join(','):'');
 const rule={exception,canonical,pattern,includeTypes:new Set(),excludeTypes:new Set(),includeDomains:[],excludeDomains:[],thirdParty:null,matchCase:false,document:false,badfilter:false};
 for(const raw of options){
  const option=raw.toLowerCase();
  if(exception&&COSMETIC_OPTIONS.has(option))continue;
  if(option==='badfilter'){rule.badfilter=true;continue;}
  if(option==='match-case'){rule.matchCase=true;continue;}
  if(option==='third-party'||option==='~third-party'){if(rule.thirdParty!==null)return null;rule.thirdParty=option==='third-party';continue;}
  if(option.startsWith('domain=')){
   if(rule.includeDomains.length||rule.excludeDomains.length)return null;
   const domains=raw.slice(7).split('|').map(domain=>({negative:domain.startsWith('~'),host:hostname(domain.startsWith('~')?domain.slice(1):domain)}));
   if(domains.some(domain=>!domain.host)){if(exception)continue;return null;}
   for(const domain of domains)(domain.negative?rule.excludeDomains:rule.includeDomains).push(domain.host);
   continue;
  }
  const negative=option.startsWith('~'),type=negative?option.slice(1):option;
  if(!Object.hasOwn(TYPES,type)){if(exception)continue;return null;}
  if(type==='document'&&!negative){if(!exception)return null;rule.document=true;}
  (negative?rule.excludeTypes:rule.includeTypes).add(TYPES[type]);
 }
 if(rule.document&&(rule.includeTypes.size!==1||rule.excludeTypes.size))return null;
 rule.domainAnchor=pattern.startsWith('||');rule.leftAnchor=!rule.domainAnchor&&pattern.startsWith('|');
 if(rule.domainAnchor)pattern=pattern.slice(2);else if(rule.leftAnchor)pattern=pattern.slice(1);
 rule.rightAnchor=pattern.endsWith('|');if(rule.rightAnchor)pattern=pattern.slice(0,-1);
 if(!pattern||pattern.includes('|')||!/^[\x21-\x7e]+$/.test(pattern)||(pattern.match(/\*/g)||[]).length>12)return null;
 rule.pattern=rule.matchCase?pattern:pattern.toLowerCase();
 // Literal domain anchors go directly into a suffix index. Wildcard hosts and
 // URL patterns use a fixed-size literal token index, not a scan of every rule.
 const hostMatch=rule.domainAnchor&&/^([a-z0-9.-]+)(?=[\^/:?]|$)/i.exec(pattern);
 rule.hostKey=hostMatch&&hostname(hostMatch[1])||'';
 const tokens=(pattern.toLowerCase().match(/[a-z0-9%_-]{5,}/g)||[]).sort((a,b)=>b.length-a.length);
 rule.token=rule.hostKey?'':tokens[0]?.slice(0,TOKEN_SIZE)||'';
 if(!rule.hostKey&&!rule.token)return null;
 return rule;
}
function separator(char){return !/[a-zA-Z0-9_.%\-]/.test(char);}
function glob(pattern,value,start=0){
 // Greedy wildcard matching; list text is never evaluated as a regular expression.
 let p=0,v=start,star=-1,retry=-1;
 while(v<value.length){
  if(pattern[p]==='*'){star=p++;retry=v;}
  else if(pattern[p]===value[v]||pattern[p]==='^'&&separator(value[v])){p++;v++;}
  else if(star>=0){p=star+1;v=++retry;}
  else return false;
 }
 while(pattern[p]==='*'||pattern[p]==='^')p++;
 return p===pattern.length;
}
function patternMatches(rule,url){
 const value=rule.matchCase?url.href:url.href.toLowerCase(),end=rule.rightAnchor?'':'*';
 if(!rule.domainAnchor)return glob((rule.leftAnchor?'':'*')+rule.pattern+end,value);
 const tail=url.host+url.pathname+url.search,subject=rule.matchCase?tail:tail.toLowerCase(),pattern=rule.pattern+end;
 if(glob(pattern,subject))return true;
 for(let i=url.hostname.indexOf('.');i>=0;i=url.hostname.indexOf('.',i+1))if(glob(pattern,subject,i+1))return true;
 return false;
}
function conditionsMatch(rule,context){
 if(rule.includeTypes.size&&!rule.includeTypes.has(context.type)||rule.excludeTypes.has(context.type))return false;
 if(rule.thirdParty!==null&&(context.thirdParty===null||context.thirdParty!==rule.thirdParty))return false;
 if(rule.includeDomains.length||rule.excludeDomains.length){
  if(!context.sourceHost||rule.excludeDomains.some(d=>sameOrSubdomain(context.sourceHost,d)))return false;
  if(rule.includeDomains.length&&!rule.includeDomains.some(d=>sameOrSubdomain(context.sourceHost,d)))return false;
 }
 return true;
}
class RuleIndex{
 constructor(){this.hosts=new Map();this.tokens=new Map();}
 add(rule){const index=rule.hostKey?this.hosts:this.tokens,key=rule.hostKey||rule.token;let bucket=index.get(key);if(!bucket)index.set(key,bucket=[]);bucket.push(rule);}
 matches(context){
  const matches=bucket=>bucket?.some(rule=>conditionsMatch(rule,context)&&patternMatches(rule,context.url));
  for(let host=context.url.hostname;host;){if(matches(this.hosts.get(host)))return true;const dot=host.indexOf('.');if(dot<0)break;host=host.slice(dot+1);}
  const value=context.url.href.toLowerCase(),seen=new Set();
  for(let i=0;i<=value.length-TOKEN_SIZE;i++){const token=value.slice(i,i+TOKEN_SIZE);if(seen.has(token))continue;seen.add(token);if(matches(this.tokens.get(token)))return true;}
  return false;
 }
}
class FilterEngine{
 constructor(){this.blocks=new RuleIndex();this.allows=new RuleIndex();this.documents=new RuleIndex();this.count=0;this.blockCount=0;}
 add(rule){(rule.document?this.documents:rule.exception?this.allows:this.blocks).add(rule);this.count++;if(!rule.exception)this.blockCount++;}
 shouldBlock(details){
  if(!details||details.resourceType==='mainFrame'||!RESOURCE_TYPES.has(details.resourceType))return false;
  const url=parseURL(details.url);if(!url)return false;
  const source=sourceURL(details),sourceHost=source?.hostname||'';
  const context={url,type:details.resourceType,sourceHost,thirdParty:source?site(url.hostname)!==site(sourceHost):null};
  if(!this.blocks.matches(context)||this.allows.matches(context))return false;
  // $document exceptions disable network filtering for that document and its
  // descendants. Cosmetic-only exceptions never reach this index.
  for(const document of [source,parseURL(details.topUrl)])if(document&&this.documents.matches({url:document,type:'mainFrame',sourceHost:document.hostname,thirdParty:false}))return false;
  return true;
 }
}
function prepare(texts){
 const rules=new Map(),disabled=new Set();
 for(const text of texts)for(const line of String(text).split(/\r?\n/)){const rule=parseRule(line);if(!rule)continue;if(rule.badfilter)disabled.add(rule.canonical);else rules.set(rule.canonical,rule);}
 return{rules,disabled};
}
function compile(texts){const {rules,disabled}=prepare(texts),engine=new FilterEngine();for(const [key,rule]of rules)if(!disabled.has(key))engine.add(rule);return engine;}
async function compileAsync(texts){
 const rules=new Map(),disabled=new Set();let n=0;
 for(const text of texts)for(const line of String(text).split(/\r?\n/)){
  const rule=parseRule(line);if(rule){if(rule.badfilter)disabled.add(rule.canonical);else rules.set(rule.canonical,rule);}
  if(++n%1000===0)await new Promise(resolve=>setImmediate(resolve));
 }
 const engine=new FilterEngine();for(const [key,rule]of rules){if(!disabled.has(key))engine.add(rule);if(++n%1000===0)await new Promise(resolve=>setImmediate(resolve));}return engine;
}
module.exports={SEED_RULES,MAX_URL,parseRule,parseURL,sourceURL,sameOrSubdomain,glob,compile,compileAsync,FilterEngine};

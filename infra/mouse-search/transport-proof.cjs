'use strict';
// Runner-only diagnostics. Fixed own IP, ordinary certificate verification,
// synthetic requests, no proxy/redirect, no live service or DNS mutation.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const https=require('node:https'),crypto=require('node:crypto'),net=require('node:net'),{spawn}=require('node:child_process');
const URL='https://151.248.113.177:3082/search',MAX=2*1024*1024,DEADLINE=12000;
const kept=['content-type','content-length','content-encoding','connection','transfer-encoding','server','date'];
const headerSummary=headers=>Object.fromEntries(kept.filter(key=>headers[key]!==undefined).map(key=>[key,headers[key]]));
const ms=start=>Math.round(performance.now()-start);
function usableResult(row){
  // WHATWG accepts http:///go/v1 as http://go/v1. Require an actual authority
  // first, then apply the desktop's public-host syntax boundary. No DNS claim.
  if(typeof row?.url!=='string'||row.url.length>8192||/[\x00-\x20\x7f\\]/.test(row.url)||!/^https?:\/\/[^/?#@\\]+(?:[/?#]|$)/i.test(row.url)||typeof row.title!=='string'||!row.title.trim())return false;
  let value;try{value=new globalThis.URL(row.url);}catch{return false;}
  if(value.username||value.password)return false;
  const host=value.hostname.replace(/^\[|\]$/g,'').toLowerCase().replace(/\.$/,'');
  if(/(?:^|\.)(?:localhost|local|internal|home|lan|test|invalid|onion)$/.test(host))return false;
  if(net.isIP(host)===4){const [a,b,c]=host.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||host==='168.63.129.16'||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===2)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);}
  if(net.isIP(host)===6){const global=new net.BlockList(),reserved=new net.BlockList();global.addSubnet('2000::',3,'ipv6');for(const [address,prefix] of [['2001::',23],['2001:db8::',32],['2002::',16],['3fff::',20]])reserved.addSubnet(address,prefix,'ipv6');return global.check(host,'ipv6')&&!reserved.check(host,'ipv6');}
  return host.includes('.');
}
function bodySummary(raw){
  const value={receivedBytes:raw.length,bodySha256:crypto.createHash('sha256').update(raw).digest('hex'),firstBytes:raw.subarray(0,120).toString('utf8')};
  try{
    const data=JSON.parse(raw.toString('utf8'));value.jsonValid=true;
    if(Array.isArray(data.results)){
      const usable=data.results.filter(usableResult);
      value.resultCount=data.results.length;value.usableUrlCount=usable.length;value.unusableUrlCount=data.results.length-usable.length;
      value.usableUrlRule='Absolute public-host URL syntax; DNS reachability is not inferred';
      value.sample=usable.slice(0,3).map(row=>({title:row.title.slice(0,180),url:row.url,engine:row.engine}));
      value.unresponsiveEngines=data.unresponsive_engines;
    }else value.responseError=data.error;
  }catch{value.jsonValid=false;}
  return value;
}
async function nodeProbe(ca,body,kind){
  return new Promise(resolve=>{
    const started=performance.now(),chunks=[];let req,res,done=false,bytes=0;
    const report={client:'node-https',httpRequestVersion:'1.1',kind,requestBodyBytes:body.length,requestBody:body.toString(),chunkSizes:[]};
    const finish=error=>{
      if(done)return;done=true;clearTimeout(timer);
      if(error)report.error=String(error).slice(0,700);
      report.elapsedMs=ms(started);report.httpMessageComplete=res?.complete===true;
      Object.assign(report,bodySummary(Buffer.concat(chunks)));
      req?.destroy();res?.destroy();resolve(report);
    };
    const timer=setTimeout(()=>finish('TOTAL_DEADLINE_12000_MS'),DEADLINE);
    try{
      req=https.request(URL,{method:'POST',ca,rejectUnauthorized:true,agent:false,maxHeaderSize:16384,
        headers:{'Content-Type':'application/x-www-form-urlencoded','Content-Length':body.length,Accept:'application/json','Accept-Encoding':'identity',Connection:'close','User-Agent':'MouseSearchTransportProof/1.0'}},response=>{
        res=response;report.headersMs=ms(started);report.httpStatus=res.statusCode;report.httpResponseVersion=res.httpVersion;report.headers=headerSummary(res.headers);
        res.on('data',chunk=>{if(done)return;if(report.firstBodyMs===undefined)report.firstBodyMs=ms(started);bytes+=chunk.length;if(report.chunkSizes.length<24)report.chunkSizes.push(chunk.length);if(bytes>MAX){finish('BODY_LIMIT');return;}chunks.push(chunk);});
        res.on('end',()=>finish());res.on('aborted',()=>finish('RESPONSE_ABORTED'));res.on('error',error=>finish(error.message));
      });
      req.on('socket',socket=>{socket.once('connect',()=>{report.connectMs=ms(started);report.remoteAddress=socket.remoteAddress;});socket.once('secureConnect',()=>{report.tlsMs=ms(started);report.tlsAuthorized=socket.authorized;report.tlsProtocol=socket.getProtocol();report.peerCertificateSha256=socket.getPeerCertificate().fingerprint256;});});
      req.on('finish',()=>{report.requestFinishedMs=ms(started);});req.on('error',error=>finish(error.message));req.end(body);
    }catch(error){finish(error.message);}
  });
}
async function curlProbe(certificate,body,kind){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mouse-search-transport-'));
  const bodyPath=path.join(directory,'body'),headersPath=path.join(directory,'headers');
  const started=performance.now();
  try{
    const args=['--silent','--show-error','--noproxy','*','--http1.0','--request','POST','--cacert',certificate,
      '--connect-timeout','5','--max-time','12','--max-filesize',String(MAX),'--header','Content-Type: application/x-www-form-urlencoded',
      '--header','Accept: application/json','--header','Accept-Encoding: identity','--header','Connection: close','--data-binary','@-',
      '--output',bodyPath,'--dump-header',headersPath,'--write-out','{"httpStatus":"%{http_code}","connectSeconds":%{time_connect},"tlsSeconds":%{time_appconnect},"firstByteSeconds":%{time_starttransfer},"totalSeconds":%{time_total},"downloadBytes":%{size_download},"uploadBytes":%{size_upload},"tlsVerifyResult":%{ssl_verify_result}}',URL];
    const result=await new Promise(resolve=>{
      const child=spawn('curl',args,{stdio:['pipe','pipe','pipe']});let stdout='',stderr='';
      const timer=setTimeout(()=>child.kill('SIGKILL'),DEADLINE+2000);
      child.stdout.on('data',chunk=>{stdout=(stdout+chunk).slice(0,12000);});child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(0,1200);});
      child.on('error',error=>{clearTimeout(timer);resolve({error:error.message});});
      child.on('close',(code,signal)=>{clearTimeout(timer);let metrics;try{metrics=JSON.parse(stdout);metrics.httpStatus=Number(metrics.httpStatus);}catch{metrics={metricsError:'Missing curl timing JSON'};}resolve({exitCode:code,signal,...metrics,...(stderr?{error:stderr.trim()}:{})});});
      child.stdin.on('error',()=>{});child.stdin.end(body);
    });
    const raw=fs.existsSync(bodyPath)?fs.readFileSync(bodyPath).subarray(0,MAX):Buffer.alloc(0);
    const headers={};if(fs.existsSync(headersPath))for(const line of fs.readFileSync(headersPath,'utf8').split(/\r?\n/)){const i=line.indexOf(':');if(i>0)headers[line.slice(0,i).toLowerCase()]=line.slice(i+1).trim();}
    return {client:'curl',httpRequestVersion:'1.0',kind,requestBodyBytes:body.length,requestBody:body.toString(),elapsedMs:ms(started),...result,headers:headerSummary(headers),...bodySummary(raw)};
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
}
async function main(){
  const certificate=path.resolve(process.argv[2]||'desktop/mouse-search-ca.crt'),ca=fs.readFileSync(certificate),cert=new crypto.X509Certificate(ca);
  if(cert.fingerprint256.replaceAll(':','').toLowerCase()!=='18a7d7b3881078171848621de946b777ff682ba729ad6e4d399a1d6bff784d07'||cert.checkIP('151.248.113.177')!=='151.248.113.177')throw Error('Own certificate identity mismatch');
  const report={diagnosticOnly:true,fixture:false,verifierSourceSha:process.env.GITHUB_SHA,endpoint:URL,certificateSha256:cert.fingerprint256,probes:[]};
  if(fs.existsSync('mouse-search-runtime.json'))report.activeRuntimeSourceSha=JSON.parse(fs.readFileSync('mouse-search-runtime.json','utf8')).activeRuntimeSourceSha;
  for(const [kind,text] of [['invalid-format','q=synthetic+invalid+format&format=html'],['real-search','q=Python+programming+language&format=json&pageno=1&categories=general&safesearch=1&language=all']]){
    const body=Buffer.from(text);report.probes.push(await nodeProbe(ca,body,kind));report.probes.push(await curlProbe(certificate,body,kind));
  }
  fs.writeFileSync('mouse-search-transports.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={usableResult,bodySummary};

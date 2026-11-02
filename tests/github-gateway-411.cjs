'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const source=fs.readFileSync(require('node:path').join(__dirname,'../background.js'),'utf8');
const code=source.slice(source.indexOf('async function bcModuleTool('),source.indexOf('const OSMINOG_BROWSER_HUB_KEY'));
let head='head1',tree={},blobs={},calls=[],serial=0;
const hash=s=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0'+s).digest('hex');
const put=s=>{const sha=hash(s);blobs[sha]=s;return sha};
tree['big.js']=put('а'.repeat(245000)+'\nconst before = 1;\n');
const store={briefCraftModulesV1:{github:{token:'fixture',connected:true}},osminogOwnerGrantV1:{verified:true,ownerMax:true,verifiedAt:Date.now()}};
const fetch=async(url,opts={})=>{const p=new URL(url).pathname.replace('/repos/jeep-jim/OSMINOG',''),method=opts.method||'GET',b=opts.body?JSON.parse(opts.body):{};calls.push({p,method});let result;
 if(p===''||p==='/user')result=p===''?{full_name:'jeep-jim/OSMINOG',permissions:{push:true},default_branch:'main'}:{login:'jeep-jim'};
 else if(p.startsWith('/git/ref/heads/'))result={object:{sha:head}};
 else if(p==='/git/refs'&&method==='POST')result={object:{sha:b.sha}};
 else if(p.startsWith('/git/refs/heads/')&&method==='PATCH'){head=b.sha;result={object:{sha:head}}}
 else if(p.startsWith('/git/commits/')&&method==='GET')result={tree:{sha:'tree'}};
 else if(p==='/git/commits'&&method==='POST')result={sha:'commit'+(++serial)};
 else if(p.startsWith('/contents/')){const path=decodeURIComponent(p.slice(10));if(!tree[path])return new Response(JSON.stringify({message:'Not Found'}),{status:404});const text=blobs[tree[path]];result={type:'file',sha:tree[path],size:Buffer.byteLength(text),encoding:'base64',content:Buffer.from(text).toString('base64')}}
 else if(p==='/git/blobs'&&method==='POST')result={sha:put(b.content)};
 else if(p.startsWith('/git/blobs/'))result={encoding:'base64',content:Buffer.from(blobs[p.split('/').pop()]).toString('base64')};
 else if(p==='/git/trees'&&method==='POST'){for(const e of b.tree)if(e.sha===null)delete tree[e.path];else tree[e.path]=e.sha;result={sha:'newtree'}}
 else if(p==='/pulls')result={number:1,html_url:'https://github.com/jeep-jim/OSMINOG/pull/1',state:'open',draft:true};
 else if(p==='/actions/runs')result={workflow_runs:[{id:1,head_sha:head,status:'completed',conclusion:'success'}]};
 else throw Error('Unexpected '+method+' '+p);
 return new Response(JSON.stringify(result),{status:200});
};
const c=vm.createContext({chrome:{storage:{local:{get:async()=>store}}},fetch,TextEncoder,TextDecoder,Uint8Array,crypto:crypto.webcrypto,atob,btoa,URLSearchParams});vm.runInContext(code,c);const tool=(name,args={})=>c.bcModuleTool(name,{__ownerApproved:true,...args});
(async()=>{
 assert.equal((await tool('github_status')).ownerVerified,true);
 const first=await tool('github_fetch_file',{path:'big.js'});assert.equal(first.nextOffset,60000);let all=first.content,offset=first.nextOffset;while(offset!==null){const r=await tool('github_fetch_file',{path:'big.js',offset});all+=r.content;offset=r.nextOffset}assert.equal(all,blobs[first.sha]);
 await tool('github_create_branch',{branch:'osminog-ai/test'});
 let writes=calls.filter(x=>x.method!=='GET').length;
 await assert.rejects(tool('github_commit_files',{branch:'osminog-ai/test',message:'bad',files:[{path:'big.js',sha:'stale',content:'oops'}]}),/SHA conflict/);assert.equal(calls.filter(x=>x.method!=='GET').length,writes);
 await assert.rejects(tool('github_commit_files',{branch:'osminog-ai/test',message:'bad',files:[{path:'big.js',sha:first.sha,edits:[{search:'а',replace:'x'}]}]}),/exactly once/);
 const r=await tool('github_commit_files',{branch:'osminog-ai/test',message:'fix',files:[{path:'big.js',sha:first.sha,edits:[{search:'const before = 1;',replace:'const after = 2;'}]}]});assert.equal(r.verified,true);assert.equal(blobs[tree['big.js']],all.replace('const before = 1;','const after = 2;'));
 const readback=await tool('github_fetch_file',{path:'big.js',ref:r.commitSha,offset:245000});assert.match(readback.content,/after = 2/);
 await assert.rejects(tool('github_commit_files',{__ownerApproved:false}),/confirmation/);
 await assert.rejects(tool('github_commit_files',{branch:'main',message:'bad',files:[{path:'x',content:'x'}]}),/osminog-ai/);
 await assert.rejects(tool('github_fetch_file',{path:'.env'}),/Protected/);
 assert.equal((await tool('github_open_pr',{head:'osminog-ai/test',title:'Fix'})).number,1);
 assert.equal((await tool('github_workflow_runs',{branch:'osminog-ai/test'})).runs[0].sha,r.commitSha);
 console.log('PASS GitHub gateway: paged UTF-8 reads, stale SHA rejection, unique edits, verified commit, branch/owner guards, PR, CI. Network is a fixture, not a live-token test.');
})().catch(e=>{console.error(e);process.exitCode=1});

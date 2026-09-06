const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require.resolve('../osminog-product-core-recovery.js'),'utf8');
const start=source.indexOf('async function userGitHubTool('),end=source.indexOf('globalThis.OSMINOGUserGitHub=',start);
let requests=[];
const env={githubState:async()=>({token:'LOCAL_SECRET',repo:'person/project',repos:[{full_name:'person/project',default_branch:'main'}]}),githubFetch:async(token,path,options)=>{assert.equal(token,'LOCAL_SECRET');requests.push({path,options});return options?{content:{sha:'new'},commit:{sha:'commit'}}:{type:'file',encoding:'base64',sha:'old',content:Buffer.from('complete content').toString('base64')}},enc64:s=>Buffer.from(s).toString('base64'),atob,TextDecoder,Uint8Array};
vm.createContext(env);vm.runInContext(source.slice(start,end)+';globalThis.tool=userGitHubTool',env);
(async()=>{
 const read=await env.tool('user_github_read',{path:'src/file.txt',repo:'other/private'});assert.equal(read.content,'complete content');assert.equal(read.sha,'old');assert(requests[0].path.startsWith('/repos/person/project/'));assert(!JSON.stringify(read).includes('SECRET'));
 await assert.rejects(env.tool('user_github_write',{path:'src/file.txt',content:'change'}),/Read first/);
 await assert.rejects(env.tool('user_github_read',{path:'../private'}),/Invalid/);
 const write=await env.tool('user_github_write',{path:'src/file.txt',content:'change',sha:'old'});assert.equal(write.sha,'new');assert.equal(JSON.parse(requests.at(-1).options.body).sha,'old');
 console.log('PASS selected repository isolation, credentials omitted, path rejection, expected SHA enforced');
})().catch(error=>{console.error(error);process.exitCode=1});

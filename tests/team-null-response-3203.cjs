const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.resolve(__dirname,'../gpt-presence.js'),'utf8');
const fn=src.slice(src.indexOf('  async function osminogTeamAsk('),src.indexOf('  async function osminogTeamApplyPatch('));
const loadThreads=async()=>{},threads=[{id:'test',provider:'gpt',name:'Test'}],connected=true;
const pinsForThread=async()=>[],contextForPrompt=()=>({capabilities:{}}),textAttachmentBlock=()=>'',ROLE_LABELS={universal:'test'},providerLabel=()=> 'Test';
const teamDrainToolCalls=async(t,r)=>r;
let responses=[];const sendProviderTask=async()=>responses.shift();
eval(fn+';globalThis.testTeam=osminogTeamAsk');
(async()=>{for(const [label,seq] of [['initial null',[null]],['retry null',[{ok:true,payload:{text:'No patch'}},null]],['retry undefined',[{ok:true,payload:{text:'No patch'}},undefined]]]){responses=seq;await assert.rejects(()=>testTeam('test','test',{execute:true}),e=>e.name==='Error'&&e.message==='Test не ответил');console.log('PASS',label,'controlled failure')}})().catch(e=>{console.error(e);process.exit(1)});

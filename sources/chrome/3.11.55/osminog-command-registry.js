"use strict";
(()=>{
  const BUILT_INS=[
    {name:"/plan",description:"Переключить Team Room в режим обсуждения",builtin:true},
    {name:"/do",description:"Переключить Team Room в режим исполнения",builtin:true},
    {name:"/review",description:"Переключить Team Room в режим проверки",builtin:true},
    {name:"/stop",description:"Остановить командный цикл",builtin:true},
    {name:"/clear",description:"Очистить командный протокол",builtin:true},
    {name:"/browser",description:"Открыть внутренний браузер",builtin:true},
    {name:"/md",description:"Открыть Markdown Studio",builtin:true},
    {name:"/media",description:"Открыть Media Crew",builtin:true}
  ];
  const key=()=>`osminogCommandsV1:${globalThis.project?.()?.id||"global"}`;
  const cleanName=value=>{let name=String(value||"").trim().toLowerCase();if(!name.startsWith("/"))name="/"+name;return /^\/[a-zа-яё0-9][a-zа-яё0-9_-]{0,31}$/i.test(name)?name:""};
  async function read(){const k=key(),got=await chrome.storage.local.get(k);return Array.isArray(got[k])?got[k]:[]}
  async function write(items){await chrome.storage.local.set({[key()]:items.slice(0,80)});return items}
  function publicItem(item){return{name:item.name,description:item.description||"",kind:item.kind||"prompt",builtin:!!item.builtin,agentId:item.agentId||null,tool:item.tool||null,calls:Array.isArray(item.calls)?item.calls.length:0}}
  async function list(){return{commands:[...BUILT_INS,...await read()].map(publicItem)}}
  async function register(args={}){
    const name=cleanName(args.name),description=String(args.description||"").trim().slice(0,300),kind=["prompt","tool","chain"].includes(args.kind)?args.kind:"prompt";
    if(!name)return{error:"Command name must look like /command"};
    if(BUILT_INS.some(x=>x.name===name))return{error:"Built-in command cannot be replaced"};
    const item={name,description,kind,agentId:String(args.agentId||"main"),prompt:String(args.prompt||"").slice(0,12000),tool:String(args.tool||""),args:args.args&&typeof args.args==="object"?args.args:{},calls:Array.isArray(args.calls)?args.calls.slice(0,8).map(c=>({tool:String(c?.tool||""),args:c?.args&&typeof c.args==="object"?c.args:{}})).filter(c=>c.tool):[]};
    if(kind==="prompt"&&!item.prompt)return{error:"Prompt command requires prompt"};
    if(kind==="tool"&&!item.tool)return{error:"Tool command requires tool"};
    if(kind==="chain"&&!item.calls.length)return{error:"Chain command requires calls"};
    const approved=await globalThis.OSMINOGConfirmCommandAction?.("register",item);
    if(approved!==true)return{error:"Command registration cancelled by owner"};
    const items=await read(),index=items.findIndex(x=>x.name===name);if(index>=0)items[index]=item;else items.push(item);await write(items);return{ok:true,command:publicItem(item)}
  }
  async function remove(args={}){const name=cleanName(args.name);if(!name)return{error:"Command name is required"};if(BUILT_INS.some(x=>x.name===name))return{error:"Built-in command cannot be removed"};const items=await read(),item=items.find(x=>x.name===name);if(!item)return{error:`Command ${name} does not exist`};const approved=await globalThis.OSMINOGConfirmCommandAction?.("remove",item);if(approved!==true)return{error:"Command removal cancelled by owner"};await write(items.filter(x=>x.name!==name));return{ok:true,removed:name}}
  function expand(value,input){return String(value||"").replace(/\{\{input\}\}/g,String(input||""))}
  async function run(args={}){
    const name=cleanName(args.name),input=String(args.input||"");if(!name)return{error:"Command name is required"};
    const item=(await read()).find(x=>x.name===name);if(!item)return{error:`Command ${name} does not exist`};
    if(item.kind==="prompt")return await globalThis.OSMINOGAgentAPI?.ask?.(item.agentId||"main",`${expand(item.prompt,input)}${input&&!item.prompt.includes("{{input}}")?`\n\nВвод владельца: ${input}`:""}`,{fullProject:true,mode:"command",execute:false})||{error:"Agent API unavailable"};
    if(item.kind==="tool")return await globalThis.BriefCraftBridge?.executeTool?.(item.tool,{...(item.args||{}),...(args.args||{})})||{error:"Tool bus unavailable"};
    const results=[];for(const call of item.calls||[]){const callArgs=JSON.parse(expand(JSON.stringify(call.args||{}),input));const result=await globalThis.BriefCraftBridge?.executeTool?.(call.tool,callArgs);results.push({tool:call.tool,result});if(result?.error&&args.continueOnError!==true)break}return{ok:!results.some(x=>x.result?.error),results}
  }
  globalThis.OSMINOGConfirmCommandAction=globalThis.OSMINOGConfirmCommandAction||((action,item)=>Promise.resolve(confirm(`OSMINOG просит ${action==="remove"?"удалить":"сохранить"} команду ${item.name}.\n\n${item.description||item.prompt||item.tool||""}\n\nРазрешить?`)));
  globalThis.OSMINOGCommandAPI={list,register,remove,run};
  document.dispatchEvent(new CustomEvent("osminog:commands-ready"));
})();

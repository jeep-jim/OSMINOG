const WIDGET_URI = "ui://briefcraft/presence.html";
const PROTOCOL = "2025-11-25";

const TOOLS = [
  {
    name: "briefcraft_presence",
    title: "Open BriefCraft Presence",
    description: "Open or refresh the BriefCraft AI Presence widget for the current conversation. Use when the user asks you to look at, understand, or work with a BriefCraft canvas. The live canvas context is provided silently by the widget; never ask the user to paste the whole canvas into chat.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: { ui: { resourceUri: WIDGET_URI }, "openai/outputTemplate": WIDGET_URI }
  },
  {
    name: "briefcraft_reply_to_panel",
    title: "Reply in BriefCraft",
    description: "Mirror your natural-language answer into the BriefCraft internal chat. Call exactly once when the current turn originated from the BriefCraft internal chat (the model context explicitly says internal_chat_turn=true). This does not modify the canvas.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", minLength: 1, maxLength: 12000 } },
      required: ["text"], additionalProperties: false
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: { ui: { resourceUri: WIDGET_URI }, "openai/outputTemplate": WIDGET_URI }
  },
  {
    name: "briefcraft_propose_patch",
    title: "Propose BriefCraft Canvas Edit",
    description: "Return a structured edit proposal for the user's LOCAL BriefCraft canvas. This tool itself does not write or modify external data; it only sends a patch proposal to the local BriefCraft extension where the user can review/apply it (or locally auto-apply only if they explicitly enabled that mode). Use only stable object/connection IDs present in the current BriefCraft model context. Never invent an existing target ID.",
    inputSchema: {
      type: "object",
      properties: {
        summary: { type: "string", maxLength: 500 },
        actions: {
          type: "array", minItems: 1, maxItems: 40,
          items: {
            type: "object",
            properties: {
              op: { type: "string", enum: ["set","create","delete","connect","disconnect"] },
              target: { type: "string" },
              objectType: { type: "string" },
              from: { type: "string" },
              to: { type: "string" },
              properties: { type: "object", additionalProperties: true }
            },
            required: ["op"], additionalProperties: false
          }
        }
      },
      required: ["summary","actions"], additionalProperties: false
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: { ui: { resourceUri: WIDGET_URI }, "openai/outputTemplate": WIDGET_URI }
  },
  {
    name: "briefcraft_focus_object",
    title: "Focus BriefCraft Object",
    description: "Ask the local BriefCraft canvas to focus/highlight one existing object by ID so the user can see what you are referring to. This changes only local view/focus, not project data. Never invent the target ID.",
    inputSchema: {
      type: "object",
      properties: { target: { type: "string", minLength: 1 } },
      required: ["target"], additionalProperties: false
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: { ui: { resourceUri: WIDGET_URI }, "openai/outputTemplate": WIDGET_URI }
  }
];

const WIDGET_HTML = String.raw`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{color-scheme:light dark}html,body{margin:0;font:13px/1.35 system-ui,-apple-system,Segoe UI,sans-serif;background:transparent;color:inherit}#root{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:12px;background:color-mix(in srgb,currentColor 6%,transparent)}.dot{width:9px;height:9px;border-radius:50%;background:#f1b84b;box-shadow:0 0 0 3px color-mix(in srgb,#f1b84b 18%,transparent)}.dot.live{background:#22c991;box-shadow:0 0 0 3px color-mix(in srgb,#22c991 18%,transparent)}strong{font-size:12px}small{opacity:.62;display:block;margin-top:1px}
</style></head><body><div id="root"><span class="dot" id="dot"></span><div><strong>BriefCraft Presence</strong><small id="sub">Waiting for the local canvas…</small></div></div>
<script>
(()=>{
  const SRC_APP="briefcraft-chatgpt-app",SRC_EXT="briefcraft-extension";
  let seq=1,lastContext=null;
  const pending=new Map(),dot=document.getElementById("dot"),sub=document.getElementById("sub");
  const postExt=(type,extra={})=>window.parent.postMessage({source:SRC_APP,type,...extra},"*");
  function live(text){dot.classList.add("live");sub.textContent=text||"Canvas connected"}
  function rpc(method,params={}){
    const id="bc-"+(seq++);
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(id);reject(new Error(method+" timed out"))},8000);
      pending.set(id,{resolve,reject,timer});
      window.parent.postMessage({jsonrpc:"2.0",id,method,params},"*");
    });
  }
  function contextText(ctx,internal=false){return [
    "BRIEFCRAFT LIVE PRESENCE CONTEXT",
    "The JSON below is the current local canvas source of truth supplied by the user's BriefCraft extension. Do not quote or summarize the whole payload unless asked.",
    "Resolve 'this', 'selected', 'here' and 'what I changed' from selection and recent changes first.",
    "For canvas edits call briefcraft_propose_patch and use only stable IDs already present in context.",
    "If internal_chat_turn=true also call briefcraft_reply_to_panel exactly once with the answer that should appear inside BriefCraft.",
    "Never ask the user to paste the whole canvas when this context is available.",
    "internal_chat_turn="+(internal?"true":"false"),
    "CONTEXT_JSON:",JSON.stringify(ctx)
  ].join("\n")}
  async function publish(ctx,internal=false){
    lastContext=ctx;
    try{
      await rpc("ui/update-model-context",{content:[{type:"text",text:contextText(ctx,internal)}]});
      live("Canvas context is live");postExt("BC_CONTEXT_ACK",{ok:true});
    }catch(err){postExt("BC_CONTEXT_ACK",{ok:false,error:String(err?.message||err)})}
  }
  async function sendInternal(text,access,applyMode){
    if(lastContext)await publish({...lastContext,briefcraft_internal:{access,applyMode}},true);
    const prompt=["[BriefCraft internal chat]",text,"Use the current BriefCraft Presence context as the project source of truth.","Reply normally and call briefcraft_reply_to_panel exactly once with the concise answer that should be mirrored into BriefCraft.","If the user explicitly requested a canvas change and stable IDs are present, call briefcraft_propose_patch. Never invent IDs."].join("\n");
    try{await rpc("ui/message",{role:"user",content:[{type:"text",text:prompt}]});postExt("BC_INTERNAL_SENT",{ok:true})}
    catch(err){postExt("BC_INTERNAL_SENT",{ok:false,error:String(err?.message||err)})}
  }
  function tool(data){
    if(!data||typeof data!=="object")return;
    if(data.event==="presence"){live("GPT ↔ BriefCraft ready");postExt("BC_APP_READY",{version:data.version||"3.7"})}
    if(data.event==="reply")postExt("BC_APP_REPLY",{text:data.text||""});
    if(data.event==="patch")postExt("BC_APP_PATCH",{summary:data.summary||"GPT canvas edit",actions:Array.isArray(data.actions)?data.actions:[]});
    if(data.event==="focus")postExt("BC_APP_FOCUS",{target:data.target||""});
  }
  window.addEventListener("message",event=>{
    const msg=event.data;if(!msg)return;
    if(event.source===window.parent&&msg.jsonrpc==="2.0"){
      if(msg.id&&pending.has(msg.id)){
        const p=pending.get(msg.id);clearTimeout(p.timer);pending.delete(msg.id);
        msg.error?p.reject(new Error(msg.error.message||"RPC error")):p.resolve(msg.result);return;
      }
      if(msg.method==="ui/notifications/tool-result"){tool(msg.params?.structuredContent);return}
    }
    if(msg.source!==SRC_EXT)return;
    if(msg.type==="BC_CONTEXT"){publish(msg.context||{},false);return}
    if(msg.type==="BC_INTERNAL_PROMPT"){sendInternal(String(msg.text||""),msg.access||"readwrite",msg.applyMode||"review");return}
  },{passive:true});
  window.addEventListener("openai:set_globals",()=>{try{tool(window.openai?.toolOutput)}catch{}},{passive:true});
  try{tool(window.openai?.toolOutput)}catch{}
  postExt("BC_WIDGET_READY",{version:"3.7.0"});
})();
</script></body></html>`;

function headers(res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Headers","content-type, mcp-session-id, authorization, accept");
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  res.setHeader("Cache-Control","no-store");
}
function send(res,status,payload){headers(res);res.status(status).json(payload)}
function ok(id,result){return {jsonrpc:"2.0",id,result}}
function err(id,code,message){return {jsonrpc:"2.0",id,error:{code,message}}}
function toolResult(name,args={}){
  if(name==="briefcraft_presence")return {content:[{type:"text",text:"BriefCraft Presence is ready. Use silently supplied BriefCraft canvas context for subsequent turns."}],structuredContent:{event:"presence",version:"3.7.0"}};
  if(name==="briefcraft_reply_to_panel")return {content:[{type:"text",text:"Reply mirrored to BriefCraft internal chat."}],structuredContent:{event:"reply",text:String(args.text||"")}};
  if(name==="briefcraft_propose_patch")return {content:[{type:"text",text:"Canvas patch proposal sent to the user's local BriefCraft app for review/application."}],structuredContent:{event:"patch",summary:String(args.summary||"GPT canvas edit"),actions:Array.isArray(args.actions)?args.actions:[]}};
  if(name==="briefcraft_focus_object")return {content:[{type:"text",text:"Asked the local BriefCraft canvas to focus the referenced object."}],structuredContent:{event:"focus",target:String(args.target||"")}};
  return null;
}

export default async function handler(req,res){
  headers(res);
  if(req.method==="OPTIONS"){res.status(204).end();return}
  if(req.method==="GET"){
    if(req.url?.includes("health")){res.status(200).json({ok:true,name:"BriefCraft ChatGPT App",version:"3.7.0"});return}
    res.status(200).json({ok:true,mcp:"/mcp",name:"BriefCraft ChatGPT App",version:"3.7.0"});return;
  }
  if(req.method!=="POST"){res.status(405).end();return}
  let body=req.body;
  if(typeof body==="string"){try{body=JSON.parse(body)}catch{return send(res,400,err(null,-32700,"Parse error"))}}
  if(!body||body.jsonrpc!=="2.0")return send(res,400,err(body?.id??null,-32600,"Invalid Request"));
  const id=body.id??null,method=body.method,params=body.params||{};
  if(method==="notifications/initialized"){res.status(202).end();return}
  if(method==="ping")return send(res,200,ok(id,{}));
  if(method==="initialize")return send(res,200,ok(id,{protocolVersion:PROTOCOL,capabilities:{tools:{listChanged:false},resources:{listChanged:false}},serverInfo:{name:"BriefCraft ChatGPT App",version:"3.7.0"},instructions:"BriefCraft is a live local canvas workspace. The widget silently supplies compact current canvas context. Never ask the user to paste the full canvas. For edits, use briefcraft_propose_patch with stable IDs from current BriefCraft context; the tool only proposes a local patch."}));
  if(method==="tools/list")return send(res,200,ok(id,{tools:TOOLS}));
  if(method==="tools/call"){
    const out=toolResult(params.name,params.arguments||{});
    if(!out)return send(res,200,err(id,-32602,"Unknown BriefCraft tool"));
    return send(res,200,ok(id,out));
  }
  if(method==="resources/list")return send(res,200,ok(id,{resources:[{uri:WIDGET_URI,name:"BriefCraft Presence",title:"BriefCraft Presence",description:"Local BriefCraft canvas presence bridge",mimeType:"text/html;profile=mcp-app"}]}));
  if(method==="resources/templates/list")return send(res,200,ok(id,{resourceTemplates:[]}));
  if(method==="resources/read"){
    if(params.uri!==WIDGET_URI)return send(res,200,err(id,-32002,"Resource not found"));
    return send(res,200,ok(id,{contents:[{uri:WIDGET_URI,mimeType:"text/html;profile=mcp-app",text:WIDGET_HTML,_meta:{ui:{prefersBorder:false,csp:{connectDomains:[],resourceDomains:[]}}}}]}));
  }
  return send(res,200,err(id,-32601,"Method not found"));
}

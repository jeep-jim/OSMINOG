"use strict";
// Parse only the response to the current request; never read a personal tab.
(()=>{
  function parseSse(text){
    const messages=new Map();let envelope={},conversationId=null,parentMessageId=null,lastError="",imagePending=false,final=false,lastPath="",lastOp="";
    const remember=data=>{
      if(data?.conversation_id)conversationId=data.conversation_id;
      if(data?.error)lastError=typeof data.error==="string"?data.error:data.error.message||data.error.code||JSON.stringify(data.error);
      const msg=data?.message;if(!msg?.id)return;
      messages.set(msg.id,structuredClone(msg));
      if(["assistant","tool"].includes(msg.author?.role))parentMessageId=msg.id;
    };
    const patch=(root,operation)=>{
      const path=String(operation.p||operation.path||""),op=operation.o||operation.op,value=operation.v??operation.value;
      if(!path){if(op==="patch"&&Array.isArray(value)){for(const p of value)root=patch(root,p);return root}return value&&typeof value==="object"?structuredClone(value):root}
      const keys=path.split("/").slice(1).map(k=>k.replace(/~1/g,"/").replace(/~0/g,"~"));
      if(keys.some(k=>["__proto__","prototype","constructor"].includes(k)))return root;
      let node=root;for(let i=0;i<keys.length-1;i++){const k=keys[i];if(!node[k]||typeof node[k]!=="object")node[k]=/^\d+$/.test(keys[i+1])?[]:{};node=node[k]}
      const key=keys.at(-1);
      if(op==="append")node[key]=typeof node[key]==="string"?node[key]+String(value??""):Array.isArray(node[key])?node[key].concat(value):value;
      else if(op==="remove")delete node[key];
      else if(op==="add"&&Array.isArray(node)&&key==="-")node.push(value);
      else node[key]=value;
      return root;
    };
    for(const line of String(text||"").split(/\r?\n/)){
      if(!line.startsWith("data:"))continue;const raw=line.slice(5).trim();if(!raw||raw==="[DONE]")continue;
      let data;try{data=JSON.parse(raw)}catch{continue}
      if(data?.message){envelope=data;remember(data)}
      else if(data?.v?.message){envelope=data.v;remember(envelope)}
      else if(data&&(data.o||data.op||Object.hasOwn(data,"v")&&lastOp)){
        lastPath=data.p??data.path??lastPath;lastOp=data.o||data.op||lastOp;
        envelope=patch(envelope,{...data,p:lastPath,o:lastOp});remember(envelope);
      }
      else remember(data);
    }
    const media=[],fileRefs=[],seen=new Set();let answer="";
    const add=(value,name="generated-image",mime="image/png")=>{
      if(typeof value!=="string")return;const src=value.trim();
      const ref=src.match(/^(?:file-service|sediment):\/\/([A-Za-z0-9_-]+)$/i);
      if(ref){if(!seen.has(ref[1])){seen.add(ref[1]);fileRefs.push({id:ref[1],name,type:mime})}return}
      if(!/^data:image\/|^https:\/\//i.test(src)||seen.has(src))return;
      seen.add(src);media.push({kind:"image",name,type:mime,dataUrl:src,url:src});
    };
    const scan=(value,typed=false)=>{
      if(!value)return;
      if(typeof value==="string"){
        if(/^data:image\/|^(?:file-service|sediment):\/\//i.test(value)||(/^https:\/\//i.test(value)&&/\.(?:png|jpe?g|webp|gif)(?:\?|$)/i.test(value)))add(value);
        return;
      }
      if(Array.isArray(value)){for(const item of value)scan(item,typed);return}
      if(typeof value!=="object")return;
      const suppliedMime=value.mime_type||value.mimeType||value.type||"",mime=suppliedMime||"image/png",isImage=typed||!!value.asset_pointer||String(value.content_type||"").includes("image")||String(suppliedMime).startsWith("image/");
      const name=value.name||value.file_name||value.title||"generated-image";
      if(isImage){add(value.asset_pointer,name,mime);add(value.data_url||value.dataUrl||value.image_url?.url||value.image_url||value.download_url||value.url||value.src,name,mime);if(/^[A-Za-z0-9_-]+$/.test(value.file_id||""))add(`file-service://${value.file_id}`,name,mime)}
      for(const [key,nested] of Object.entries(value))if(/^(?:parts|images?|media|attachments?|assets?)$/i.test(key))scan(nested,/image|media/i.test(key));
    };
    for(const msg of messages.values()){
      if(!["assistant","tool"].includes(msg.author?.role))continue;
      if(/image_gen|dall.?e|imagegen/i.test(String(msg.recipient||"")+" "+String(msg.author?.name||"")))imagePending=true;
      const parts=msg.content?.parts;
      // Tool text is not a user-facing answer, but its image attachments are results.
      if(msg.author.role==="assistant"&&(!msg.recipient||msg.recipient==="all")&&msg.channel!=="analysis"&&msg.metadata?.channel!=="analysis"){
        const strings=(Array.isArray(parts)?parts:[]).filter(p=>typeof p==="string");if(strings.length)answer=strings.join("\n");
        if(msg.end_turn===true)final=true;
      }
      scan(msg.content);scan(msg.metadata);
    }
    return {answer:answer.trim(),media:media.slice(0,4),fileRefs:fileRefs.slice(0,4),conversationId,parentMessageId,lastError,imagePending,final};
  }
  function fromConversation(data,userMessageId){
    const mapping=data?.mapping||{},children=new Map();
    for(const [id,node] of Object.entries(mapping)){const p=node.parent;if(!children.has(p))children.set(p,[]);children.get(p).push(id)}
    // Follow descendants of this request, not old generated images or the uploaded reference.
    const visited=new Set(),queue=[userMessageId],events=[];
    while(queue.length&&visited.size<1000){const id=queue.shift();if(visited.has(id))continue;visited.add(id);const node=mapping[id];if(node?.message&&id!==userMessageId)events.push({conversation_id:data.conversation_id||data.id,message:node.message});queue.push(...(children.get(id)||[]))}
    return parseSse(events.map(x=>`data: ${JSON.stringify(x)}`).join("\n"));
  }
  async function resolveFiles(parsed,readFile,excludedIds=[]){
    const excluded=new Set(excludedIds),media=[...(parsed.media||[])],errors=[];
    for(const ref of parsed.fileRefs||[]){
      if(excluded.has(ref.id))continue;
      try{
        const result=await readFile(ref.id),url=result?.data?.download_url||result?.data?.url;
        if(!result?.ok||!/^https:\/\//i.test(url||"")){errors.push(`Файл изображения ${ref.id}: ${result?.httpStatus?`HTTP ${result.httpStatus}`:result?.error||"ссылка на скачивание не получена"}`);continue}
        if(!media.some(m=>(m.url||m.dataUrl)===url))media.push({kind:"image",name:ref.name,type:ref.type||"image/png",url,dataUrl:url});
      }catch(error){errors.push(`Файл изображения ${ref.id}: ${error?.message||String(error)}`)}
    }
    return {...parsed,media:media.slice(0,4),mediaError:errors.join("; ")};
  }
  function generationPrompt(context){
    const request=String(context?.intent?.imageGenerationRequest||"").replace(/^\[MEDIA:generate\]\s*/,"");
    return `${request}\n\n[OSMINOG IMAGE GENERATION]\nCreate the requested raster image using image generation. The attached image is the user's visual reference; preserve its character identity and visual style while making the requested change. Return the generated image attachment. OSMINOG places the result beside the reference automatically. If image generation is unavailable in this session, state the actual limitation. A text description is not an image result.`;
  }
  globalThis.OSMINOGGeneratedMedia={parseSse,fromConversation,resolveFiles,generationPrompt};
})();

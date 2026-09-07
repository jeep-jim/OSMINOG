"use strict";
// Shared by the service worker and chat renderer. Never infer a URL from a citation ID.
(()=>{
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function safeUrl(value){try{const u=new URL(String(value));return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:""}catch{return ""}}
  function references(metadata={}){
    const byId=new Map(),byMarker=new Map();
    function visit(item,depth=0){
      if(!item||depth>8)return;
      if(Array.isArray(item)){for(const v of item)visit(v,depth+1);return}
      if(typeof item!=="object")return;
      const url=safeUrl(item.url||item.href||item.link||item.source?.url);
      if(url){
        const entry={url,title:String(item.title||item.name||item.source?.title||url)};
        const ids=[item.ref_id,item.reference_id,item.id];
        for(const ref of item.refs||[])if(ref&&typeof ref==="object"&&Number.isInteger(ref.turn_index)&&Number.isInteger(ref.ref_index)&&/^[a-z]+$/i.test(ref.ref_type||""))ids.push(`turn${ref.turn_index}${ref.ref_type}${ref.ref_index}`);
        for(const id of ids)if(typeof id==="string"&&/^turn\d+[a-z]+\d+$/i.test(id))byId.set(id,entry);
        if(typeof item.matched_text==="string"&&item.matched_text.startsWith('\uE200'))byMarker.set(item.matched_text,entry);
      }
      for(const [key,value] of Object.entries(item))if(['content_references','citations','sources','items','refs','reference','source','search_results','safe_urls'].includes(key))visit(value,depth+1);
    }
    visit(metadata);return {byId,byMarker};
  }
  function normalize(text,metadata={}){
    const {byId,byMarker}=references(metadata);
    const link=(entry,label)=>`[${String(label||entry.title).replace(/[\[\]\\\r\n]/g,' ')}](${entry.url.replace(/\(/g,'%28').replace(/\)/g,'%29')})`;
    return String(text||'').replace(/\uE200([^\uE201]*)\uE201/g,(marker,body)=>{
      const fields=body.split('\uE202'),kind=fields.shift();
      const matched=byMarker.get(marker);if(matched)return link(matched,kind==='url'?fields[0]:null);
      if(kind==='url'){
        const entry=fields.map(id=>byId.get(id)).find(Boolean),url=fields.map(safeUrl).find(Boolean);
        return entry?link(entry,fields[0]):url?link({url,title:url},fields[0]):`${fields[0]||'Ссылка'} (адрес не получен)`;
      }
      if(kind==='cite')return fields.map(id=>byId.get(id)).filter(Boolean).filter((v,i,a)=>a.findIndex(x=>x.url===v.url)===i).map(e=>link(e)).join(', ');
      return '';
    }).replace(/\uE200[^\uE201]*$/g,'');
  }
  function render(text){
    // Tokenize before escaping; URLs cannot inject HTML or be rewritten by emphasis parsing.
    const source=normalize(text),tokens=[];
    const token=html=>`\u0000${tokens.push(html)-1}\u0000`;
    let value=source.replace(/\u0000/g,'').replace(/```[^\n]*\n([\s\S]*?)(?:```|$)/g,(_,code)=>token(`<pre><code>${esc(code)}</code></pre>`));
    value=value.replace(/`([^`\n]+)`/g,(_,code)=>token(`<code>${esc(code)}</code>`));
    const anchor=(url,label)=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
    value=value.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s<>]+)\)/g,(all,label,raw)=>{const url=safeUrl(raw);return url?token(anchor(url,label)):all});
    value=value.replace(/https?:\/\/[^\s<>\u0000]+/g,raw=>{const end=raw.match(/[.,;!?\)\]]+$/)?.[0]||'',body=end?raw.slice(0,-end.length):raw,url=safeUrl(body);return url?token(anchor(url,body))+end:raw});
    value=esc(value).replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
    return value.replace(/\u0000(\d+)\u0000/g,(_,i)=>tokens[Number(i)]||'');
  }
  globalThis.OSMINOGChatContent={normalize,render,safeUrl};
})();

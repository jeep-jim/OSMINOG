'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');

// Resolve the shipped outer-dialog border cascade, including important
// shorthands. This is a source contract; installed CI checks computed pixels.
function selectors(text){
 const out=[];let depth=0,start=0;
 for(let i=0;i<text.length;i++){if('(['.includes(text[i]))depth++;else if(')]'.includes(text[i]))depth--;else if(text[i]===','&&!depth){out.push(text.slice(start,i).trim());start=i+1;}}
 out.push(text.slice(start).trim());return out;
}
function expand(selector){const m=selector.match(/:is\(([^()]*)\)/);return m?selectors(m[1]).flatMap(part=>expand(selector.replace(m[0],part))):[selector];}
function scene(theme,mode,changeCSS=(name,css)=>css){
 const html={tag:'html',attrs:{'data-theme':theme,'data-pane-mode':mode}},body={tag:'body',attrs:{},parent:html},workspace={tag:'main',id:'workspace',attrs:{},parent:body};
 const settings={tag:'dialog',id:'settings-dialog',attrs:{open:''},parent:workspace},library={tag:'dialog',id:'library-dialog',attrs:{open:'','data-glass':'true'},parent:workspace};
 function simple(selector,node){
  if(!node)return false;let ok=true;
  selector=selector.replace(/:root/g,()=>{ok&&=node===html;return'';});
  selector=selector.replace(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g,(_,key,value)=>{ok&&=Object.hasOwn(node.attrs,key)&&(value===undefined||node.attrs[key]===value);return'';});
  selector=selector.replace(/#([\w-]+)/g,(_,id)=>{ok&&=node.id===id;return'';});
  return ok&&(selector===''||selector==='*'||selector===node.tag);
 }
 function matches(selector,node){
  if(/[>+~]/.test(selector))return false;
  const parts=selector.trim().split(/\s+/);if(!simple(parts.pop(),node))return false;
  for(let i=parts.length-1;i>=0;i--){node=node.parent;while(node&&!simple(parts[i],node))node=node.parent;if(!node)return false;}return true;
 }
 const index=fs.readFileSync(path.join(__dirname,'mouse/index.html'),'utf8'),sheets=[...index.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m=>m[1]),rules=[];
 for(const name of sheets){
  const css=changeCSS(name,fs.readFileSync(path.join(__dirname,'mouse',name),'utf8')).replace(/\/\*[\s\S]*?\*\//g,'');
  for(const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g))for(const original of selectors(match[1]))for(const selector of expand(original)){
   const weight=(selector.match(/#[\w-]+/g)||[]).length*100+(selector.match(/\.[\w-]+|\[[^\]]+\]|:root/g)||[]).length*10+(selector.match(/(?:^|\s)(?:html|body|main|dialog)(?=[\s.#\[:]|$)/g)||[]).length;
   const declarations=match[2].split(';').flatMap(text=>{const colon=text.indexOf(':');return colon<0?[]:[[text.slice(0,colon).trim(),text.slice(colon+1).trim()]];});rules.push({selector,weight,declarations});
  }
 }
 function declarations(node){
  const values=new Map(),put=(key,value,weight)=>{if(weight>=(values.get(key)?.weight??-1))values.set(key,{value,weight});};
  for(const rule of rules)if(matches(rule.selector,node))for(const [key,raw]of rule.declarations){
   const weight=rule.weight+(/!important\s*$/.test(raw)?10000:0),value=raw.replace(/\s*!important\s*$/,'');
   if(key==='border'||key==='border-left'){
    if(value==='0'||value==='none'){put('border-left-width','0px',weight);put('border-left-style','none',weight);put('border-left-color','currentColor',weight);}
    else{const m=value.match(/^(\d+(?:\.\d+)?px)\s+(solid|dashed)\s+(.+)$/);assert.ok(m,'Supported actual outer-border shorthand: '+value);put('border-left-width',m[1],weight);put('border-left-style',m[2],weight);put('border-left-color',m[3],weight);}
   }else put(key==='border-color'?'border-left-color':key,value,weight);
  }return values;
 }
 function style(node){
  const chain=[];for(let item=node;item;item=item.parent)chain.unshift(item);const variables=new Map();let color='black';
  function resolve(value){for(let i=0;i<16&&value.includes('var(');i++)value=value.replace(/var\((--[\w-]+)(?:,\s*([^()]+))?\)/g,(_,name,fallback)=>{assert.ok(variables.has(name)||fallback,'Actual variable exists: '+name);return variables.get(name)??fallback;});return value.replace(/\s+/g,'').toLowerCase();}
  for(const item of chain){const own=declarations(item);for(const [key,data]of own)if(key.startsWith('--'))variables.set(key,data.value);if(own.has('color'))color=resolve(own.get('color').value);}
  const own=declarations(node),border=resolve(own.get('border-left-color')?.value||'currentColor');
  return{color,borderColor:border==='currentcolor'?color:border,width:own.get('border-left-width')?.value,style:own.get('border-left-style')?.value};
 }
 return{library:style(library),settings:style(settings)};
}

test('library glass retains Settings edge colors without restoring retired outlines in both pane modes',()=>{
 for(const theme of ['light','dark'])for(const mode of ['rounded','square']){
  const value=scene(theme,mode);assert.equal(value.library.borderColor,value.settings.borderColor,theme+' '+mode);assert.equal(value.library.width,'0px');assert.equal(value.library.style,'none');
 }
});

test('the actual important628 reset reproduces the native currentColor regression when glass color loses priority',()=>{
 for(const theme of ['light','dark']){
  const value=scene(theme,'rounded',(name,css)=>name==='library-view.css'?css.replace('border-color:var(--library-line)!important','border-color:var(--library-line)'):css);
  assert.equal(value.library.borderColor,value.library.color);assert.notEqual(value.library.borderColor,value.settings.borderColor);
 }
});

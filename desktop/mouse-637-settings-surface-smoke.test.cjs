'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'mouse-polish-smoke.cjs'),'utf8'),loaded={exports:{}};
new Function('require','module','exports',source)(name=>name==='electron'?{}:require(name),loaded,loaded.exports);
const {settingsSurfaceReadback,assertSettingsSurface}=loaded.exports.fixtures;

// Like the retained Nora CSS test, resolve the actual loaded declarations for
// a small owned document. This is a source/cascade unit harness; Chromium's
// computed colors, native geometry and pixels are still checked in installed CI.
function splitSelectors(text){
 const result=[];let depth=0,start=0;
 for(let i=0;i<text.length;i++){if(text[i]==='('||text[i]==='[')depth++;else if(text[i]===')'||text[i]===']')depth--;else if(text[i]===','&&!depth){result.push(text.slice(start,i).trim());start=i+1;}}
 result.push(text.slice(start).trim());return result;
}
function expandIs(selector){
 const match=selector.match(/:is\(([^()]*)\)/);return match?splitSelectors(match[1]).flatMap(part=>expandIs(selector.replace(match[0],part))):[selector];
}
function cssScene({theme='dark',version='6.0.40',withoutSidebar=false,withoutGlass=false,changeCSS=(name,css)=>css}={}){
 const html={tag:'html',id:'',classes:[],attrs:{'data-theme':theme,'data-platform':'darwin'}},body={tag:'body',id:'',classes:[],attrs:{},parent:html};
 const workspace={tag:'main',id:'workspace',classes:[],attrs:{},parent:body},settings={tag:'dialog',id:'settings-dialog',classes:[],attrs:{open:''},parent:workspace},toolbar={tag:'header',id:'',classes:['toolbar'],attrs:{},parent:body};
 function simple(selector,node){
  if(!node)return false;let valid=true;
  selector=selector.replace(/:root/g,()=>{valid&&=node===html;return'';});
  selector=selector.replace(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g,(_,key,value)=>{valid&&=Object.hasOwn(node.attrs,key)&&(value===undefined||node.attrs[key]===value);return'';});
  selector=selector.replace(/#([\w-]+)/g,(_,id)=>{valid&&=node.id===id;return'';});
  selector=selector.replace(/\.([\w-]+)/g,(_,name)=>{valid&&=node.classes.includes(name);return'';});
  return valid&&(selector===''||selector==='*'||selector===node.tag);
 }
 function matches(selector,node){
  if(/[>+~]/.test(selector))return false;
  const parts=selector.trim().split(/\s+/);if(!simple(parts.pop(),node))return false;
  for(let i=parts.length-1;i>=0;i--){node=node.parent;while(node&&!simple(parts[i],node))node=node.parent;if(!node)return false;}return true;
 }
 const index=fs.readFileSync(path.join(__dirname,'mouse/index.html'),'utf8'),sheets=[...index.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(match=>match[1]).filter(name=>(!withoutSidebar||name!=='sidebar-dim.css')&&(!withoutGlass||name!=='settings-glass.css'));
 assert.ok(sheets.indexOf('sidebar-dim.css')>sheets.indexOf('mouse-633.css')||withoutSidebar);
 const rules=[];
 for(const name of sheets){
  const css=changeCSS(name,fs.readFileSync(path.join(__dirname,'mouse',name),'utf8')).replace(/\/\*[\s\S]*?\*\//g,'');
  for(const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
   const declarations=match[2].split(';').flatMap(text=>{const colon=text.indexOf(':');return colon<0?[]:[[text.slice(0,colon).trim(),text.slice(colon+1).trim()]];});
   for(const original of splitSelectors(match[1]))for(const selector of expandIs(original)){
    const weight=(selector.match(/#[\w-]+/g)||[]).length*100+(selector.match(/\.[\w-]+|\[[^\]]+\]|:root/g)||[]).length*10+(selector.match(/(?:^|\s)(?:html|body|main|header|dialog)(?=[\s.#\[:]|$)/g)||[]).length;
    rules.push({selector,weight,declarations});
   }
  }
 }
 function declarations(node){
  const values=new Map();
  for(const rule of rules)if(matches(rule.selector,node))for(const [key,raw]of rule.declarations){
   const important=/!important\s*$/.test(raw),weight=rule.weight+(important?10000:0),value=raw.replace(/\s*!important\s*$/,'');
   if(weight>=(values.get(key)?.weight??-1))values.set(key,{value,weight});
  }return values;
 }
 function variablesFor(node){const chain=[];while(node){chain.unshift(node);node=node.parent;}const variables=new Map();for(const item of chain)for(const [key,value]of declarations(item))if(key.startsWith('--'))variables.set(key,value);return variables;}
 function resolve(value,variables){for(let i=0;i<12&&value.includes('var(');i++)value=value.replace(/var\((--[\w-]+)\)/g,(_,name)=>{assert.ok(variables.has(name),'Actual CSS variable exists: '+name);return variables.get(name).value;});return value;}
 function style(node){
  assert.ok(node===settings||node===toolbar,'Readback targets the actual Settings and toolbar nodes');
  const values=new Map();
  function put(key,value,weight){if(weight>=(values.get(key)?.weight??-1))values.set(key,{value,weight});}
  for(const rule of rules)if(matches(rule.selector,node))for(const [key,raw]of rule.declarations){
   if(!['background','background-image','background-color','backdrop-filter'].includes(key))continue;
   const weight=rule.weight+(/!important\s*$/.test(raw)?10000:0),value=resolve(raw.replace(/\s*!important\s*$/,''),variablesFor(node));
   if(key==='background'){const layers=splitSelectors(value),base=layers.at(-1),hasColor=/^(?:rgba?\(|#)/.test(base);put('background-image',value.includes('gradient(')?layers.filter(layer=>layer.includes('gradient(')).join(', '):'none',weight);put('background-color',hasColor?base:'rgba(0, 0, 0, 0)',weight);}
   else put(key,value,weight);
  }
  return{backgroundImage:values.get('background-image')?.value??'none',backgroundColor:values.get('background-color')?.value??'rgba(0, 0, 0, 0)',backdropFilter:values.get('backdrop-filter')?.value??'none'};
 }
 const readback=()=>vm.runInNewContext('('+settingsSurfaceReadback.toString()+')()',{MouseNative:{version},MouseTest:{model:{theme}},document:{querySelector:selector=>selector==='#settings-dialog'?settings:selector==='.toolbar'?toolbar:null},getComputedStyle:style});
 return{readback,check:()=>assertSettingsSurface(readback())};
}

test('loaded640 settings uses the designed translucent glass in both themes',()=>{
 for(const theme of ['dark','light']){
  const scene=cssScene({theme}),value=scene.readback();assert.equal(value.version,'6.0.40');assert.equal(value.theme,theme);
  assert.equal(value.settings.backdropFilter,'blur(28px) saturate(135%)');
  assert.match(value.settings.backgroundImage,/^linear-gradient\(/);
  assert.equal(value.settings.backgroundColor,theme==='dark'?'rgba(21, 29, 42, .95)':'rgba(247, 249, 253, .94)');
  assert.notEqual(value.settings.backgroundColor,value.toolbar.backgroundColor);scene.check();
 }
});

test('the archived639 dark sidebar and earlier blur contract remain explicit',()=>{
 const dark639=cssScene({version:'6.0.39',withoutGlass:true});assert.equal(dark639.readback().settings.backdropFilter,'none');dark639.check();
 for(const version of ['6.0.36','6.0.390','6.0.39-beta']){
  const legacy=cssScene({version,withoutSidebar:true,withoutGlass:true});assert.equal(legacy.readback().settings.backdropFilter,'blur(18px)');legacy.check();
 }
});

test('missing current glass, missing blur, opaque bases and barely blurred surfaces fail',()=>{
 assert.throws(()=>cssScene({withoutGlass:true}).check(),/glass backdrop blur/);
 for(const [from,to]of [['blur(28px)','none'],['blur(28px)','blur(2px)'],['rgba(21, 29, 42, .95)','rgba(21, 29, 42, 1)'],['rgba(247, 249, 253, .94)','rgba(247, 249, 253, .2)']]){
  const theme=from.includes('247')?'light':'dark',scene=cssScene({theme,changeCSS:(name,css)=>name==='settings-glass.css'?css.replaceAll(from,to):css});assert.throws(()=>scene.check(),{code:'ERR_ASSERTION'});
 }
});

test('the surface reader rejects absent or malformed installed identities',()=>{
 for(const version of [undefined,null,640,{version:'6.0.40'}]){
  const value=cssScene().readback();value.version=version;assert.throws(()=>assertSettingsSurface(value),/installed version/);
 }
});

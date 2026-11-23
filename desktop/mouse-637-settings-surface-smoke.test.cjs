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
function cssScene({theme='dark',version='6.0.38',withoutSidebar=false,changeCSS=(name,css)=>css}={}){
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
 const index=fs.readFileSync(path.join(__dirname,'mouse/index.html'),'utf8'),sheets=[...index.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(match=>match[1]).filter(name=>(!withoutSidebar||name!=='sidebar-dim.css'));
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
 const variables=declarations(html);
 function resolve(value){for(let i=0;i<12&&value.includes('var(');i++)value=value.replace(/var\((--[\w-]+)\)/g,(_,name)=>{assert.ok(variables.has(name),'Actual CSS variable exists: '+name);return variables.get(name).value;});return value;}
 function style(node){
  assert.ok(node===settings||node===toolbar,'Readback targets the actual Settings and toolbar nodes');
  const values=new Map();
  function put(key,value,weight){if(weight>=(values.get(key)?.weight??-1))values.set(key,{value,weight});}
  for(const rule of rules)if(matches(rule.selector,node))for(const [key,raw]of rule.declarations){
   if(!['background','background-image','background-color','backdrop-filter'].includes(key))continue;
   const weight=rule.weight+(/!important\s*$/.test(raw)?10000:0),value=resolve(raw.replace(/\s*!important\s*$/,''));
   if(key==='background'){put('background-image',value.includes('gradient(')?value:'none',weight);put('background-color',value.includes('gradient(')||value==='none'?'rgba(0, 0, 0, 0)':value,weight);}
   else put(key,value,weight);
  }
  return{backgroundImage:values.get('background-image')?.value??'none',backgroundColor:values.get('background-color')?.value??'rgba(0, 0, 0, 0)',backdropFilter:values.get('backdrop-filter')?.value??'none'};
 }
 const readback=()=>vm.runInNewContext('('+settingsSurfaceReadback.toString()+')()',{MouseNative:{version},MouseTest:{model:{theme}},document:{querySelector:selector=>selector==='#settings-dialog'?settings:selector==='.toolbar'?toolbar:null},getComputedStyle:style});
 return{readback,check:()=>assertSettingsSurface(readback())};
}

test('actual loaded637 dark CSS passes the retained assertion through its actual DOM readback',()=>{
 const scene=cssScene(),value=scene.readback();assert.equal(value.version,'6.0.38');assert.equal(value.theme,'dark');
 assert.equal(value.settings.backdropFilter,'none');assert.match(value.settings.backgroundImage,/^linear-gradient\(/);assert.equal(value.settings.backgroundColor,'#10151e');
 assert.deepEqual(value.settings,value.toolbar);scene.check();
});

test('actual light Settings keeps blur and the legacy branch retains the pre637 declarations',()=>{
 const light=cssScene({theme:'light'});assert.equal(light.readback().settings.backdropFilter,'blur(18px)');light.check();
 for(const version of ['6.0.36','6.0.39','6.0.380','6.0.38-beta']){
  const legacy=cssScene({version,withoutSidebar:true});assert.equal(legacy.readback().settings.backdropFilter,'blur(18px)');legacy.check();
 }
});

test('the solid dark exception applies only to exact installed6.0.38',()=>{
 for(const version of ['6.0.36','6.0.39','6.0.380','6.0.38-beta'])assert.throws(()=>cssScene({version}).check(),/keep their backdrop blur/);
 for(const version of [undefined,null,637,{version:'6.0.38'}]){
  const value=cssScene().readback();value.version=version;assert.throws(()=>assertSettingsSurface(value),/installed version/);
 }
});

test('real dark CSS regressions in filter, gradient, base color or missing override are rejected',()=>{
 for(const [from,to]of [['backdrop-filter:none','backdrop-filter:blur(18px)'],['background:var(--mouse-chrome-background)','background:none'],['background-color:var(--bg)','background-color:#000000']]){
  const scene=cssScene({changeCSS:(name,css)=>name==='sidebar-dim.css'?css.replace(from,to):css});assert.throws(()=>scene.check(),{code:'ERR_ASSERTION'});
 }
 assert.throws(()=>cssScene({withoutSidebar:true}).check(),/solid sidebar surface/);
});

test('removing actual retained blur fails both light637 and the legacy dark branch',()=>{
 const changeCSS=(name,css)=>name==='mouse-633.css'?css.replace('backdrop-filter:blur(18px)','backdrop-filter:none'):css;
 for(const options of [{theme:'light'},{version:'6.0.36',withoutSidebar:true}])assert.throws(()=>cssScene({...options,changeCSS}).check(),/keep their backdrop blur/);
});

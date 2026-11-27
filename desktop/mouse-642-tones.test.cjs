'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const A=require('./mouse/appearance.js'),pageTone=require('./mouse-page-tone.cjs');
const root=theme=>({dataset:{theme},style:{values:new Map(),getPropertyValue(name){return this.values.get(name)||'';},setProperty(name,value){this.values.set(name,value);},removeProperty(name){this.values.delete(name);}}});
const memory=()=>{const values=new Map();return{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};};
const rgb=hex=>hex.slice(1).match(/../g).map(value=>parseInt(value,16));
const luminance=hex=>rgb(hex).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);

test('optional tone defaults preserve exact legacy preferences, payloads, colors and untouched theme surfaces',()=>{
 const legacy={paneMode:'square',whiteTone:0};
 for(const tones of [undefined,{},A.TONE_DEFAULTS])assert.deepEqual(A.normalize({...legacy,tones}),legacy);
 assert.deepEqual(A.toneSettings(A.DEFAULTS),{whiteTone:55,whiteTemperature:0,blackTone:55,blackTemperature:0});
 assert.deepEqual(A.pageTone(legacy,'dark'),{theme:'dark',whiteTone:0});
 assert.deepEqual(pageTone.normalize(A.pageTone(legacy,'dark')),{theme:'dark',whiteTone:0,color:'#A0A0A0'});
 assert.equal(A.blackColor(A.DEFAULTS),'#172033');
 for(const theme of ['light','dark']){assert.equal(A.themePalette(A.DEFAULTS,theme),null);const target=root(theme);A.apply(A.DEFAULTS,target);assert.equal(target.dataset.toneSurfaces,undefined);assert.equal(target.dataset.toneBlack,undefined);assert.equal(target.style.getPropertyValue('--mouse-tone-bg'),'');}
 for(let whiteTone=0;whiteTone<=100;whiteTone++)assert.equal(A.whiteColor({whiteTone}),A.color(whiteTone));
});

test('tone presets and independent slider changes share one typed normalized state and deterministic shades',()=>{
 let value=A.normalize({...A.DEFAULTS,tones:{whiteTemperature:30,blackTone:80,blackTemperature:-40}});
 assert.equal(A.blackColor({...A.DEFAULTS,tones:{blackTone:0}}),'#000000');assert.equal(A.blackColor({...A.DEFAULTS,tones:{blackTone:100}}),'#505050');
 for(const kind of ['white','black'])for(const preset of A.TONE_PRESETS[kind]){
  assert.ok(preset.label&&preset.labelEn);const next=A.normalize({...value,...A.tonePreset(value,kind,preset.id)}),flat=A.toneSettings(next);
  for(const[key,expected]of Object.entries(preset.values))assert.equal(flat[key],expected);
  for(const key of kind==='white'?['blackTone','blackTemperature']:['whiteTone','whiteTemperature'])assert.equal(flat[key],A.toneSettings(value)[key]);
 }
 for(const whiteTone of [0,55,100]){const cool=rgb(A.whiteColor({whiteTone,tones:{whiteTemperature:-100}})),warm=rgb(A.whiteColor({whiteTone,tones:{whiteTemperature:100}}));assert.ok(cool[2]>cool[0]);assert.ok(warm[0]>warm[2]);}
 let previous=[-1,-1,-1];for(let blackTone=0;blackTone<=100;blackTone++){const current=rgb(A.blackColor({tones:{blackTone}}));assert.ok(current.every((n,i)=>n>=previous[i]&&n<=80));previous=current;}
 const reset=A.normalize({...value,...A.toneChanges(value,{whiteTemperature:0,blackTone:55,blackTemperature:0})});assert.deepEqual(reset,A.DEFAULTS);
});

test('new tones persist through a fresh loader while private changes and invalid writes preserve saved bytes',()=>{
 const storage=memory(),target=root('light'),changes=A.toneChanges(A.DEFAULTS,{whiteTemperature:70,blackTone:85,blackTemperature:-60});
 const current=A.update(A.DEFAULTS,changes,{storage,target}).settings,saved=storage.getItem(A.KEY);
 const context=vm.createContext({document:{documentElement:root('light')},localStorage:storage});vm.runInContext(fs.readFileSync(require.resolve('./mouse/appearance.js'),'utf8'),context);
 assert.deepEqual(A.read(storage),current);assert.equal(context.document.documentElement.style.getPropertyValue('--text-primary'),A.whiteColor(current));assert.equal(context.document.documentElement.style.getPropertyValue('--mouse-tone-bg'),A.themePalette(current,'light').bg);
 A.update(current,A.tonePreset(current,'black','deep'),{storage,target,privateMode:true});assert.equal(storage.getItem(A.KEY),saved);
 for(const tones of [null,[],{whiteTemperature:101},{whiteTemperature:-101},{blackTone:-1},{blackTone:100.5},{blackTone:'50'},{blackTemperature:NaN},{blackTemperature:Infinity},{css:'filter:none'}]){
  assert.throws(()=>A.update(current,{tones},{storage,target}));assert.throws(()=>pageTone.normalize({theme:'light',whiteTone:55,tones}));assert.equal(storage.getItem(A.KEY),saved);
 }
 for(const changes of [{},{whiteTone:-1},{whiteTone:101},{whiteTemperature:1.5},{blackTone:'20'},{unknown:0}])assert.throws(()=>A.toneChanges(current,changes));
 assert.throws(()=>A.tonePreset(current,'white','missing'));assert.throws(()=>A.pageTone(current,'system'));
 const restored=A.read({getItem:()=>'{"whiteTone":35,"tones":{"whiteTemperature":"bad","blackTone":999,"unknown":5}}'});assert.deepEqual(restored,{paneMode:'rounded',whiteTone:35,tones:{blackTone:100}});
});

test('custom tones paint neutral shell surfaces and reset them without replacing explicit custom surface colors',()=>{
 const storage=memory(),target=root('light');let current=A.update(A.DEFAULTS,A.toneChanges(A.DEFAULTS,{whiteTemperature:100,blackTone:100,blackTemperature:100}),{storage,target}).settings;
 assert.equal(target.dataset.toneSurfaces,'custom');assert.equal(target.style.getPropertyValue('--mouse-tone-panel'),'#FFF1DF');assert.equal(target.style.getPropertyValue('--mouse-grid-seam'),A.themePalette(current,'light').seam);
 current=A.update(current,A.changeSurface(current,'light','top',{mode:'solid',color:'#1685C4',opacity:100}),{storage,target}).settings;
 assert.equal(target.style.getPropertyValue('--mouse-top-background'),'rgba(22, 133, 196, 1)');assert.equal(A.surfaceSample(current,'light','top'),'#1685C4');
 current=A.update(current,A.changeSurface(current,'light','workspace',{mode:'solid',color:'#AA22CC',opacity:0}),{storage,target}).settings;
 assert.equal(A.workspaceColor(current,'light'),A.themePalette(current,'light').bg);assert.equal(target.style.getPropertyValue('--mouse-grid-seam'),A.themePalette(current,'light').bg);
 target.dataset.theme='dark';A.apply(current,target);assert.equal(target.style.getPropertyValue('--mouse-tone-bg'),A.themePalette(current,'dark').bg);assert.equal(target.dataset.surfaceTop,undefined);
 current=A.update(current,A.toneChanges(current,{whiteTemperature:0,blackTone:55,blackTemperature:0}),{storage,target}).settings;
 assert.equal(target.dataset.toneSurfaces,undefined);assert.equal(target.style.getPropertyValue('--mouse-tone-bg'),'');assert.equal(target.style.getPropertyValue('--mouse-grid-seam'),'');assert.equal(current.tones,undefined);assert.equal(current.surfaces.light.top.color,'#1685C4');
 const css=fs.readFileSync(require.resolve('./mouse/appearance.css'),'utf8');assert.match(css,/:root\[data-tone-surfaces=custom\]/);assert.doesNotMatch(css,/filter\s*:\s*(?:sepia|hue-rotate|brightness|contrast)/);
});

test('even extreme tone sliders retain readable primary text over neutral light and dark theme panels',()=>{
 for(const whiteTone of [0,55,100])for(const whiteTemperature of [-100,0,100])for(const blackTone of [0,55,100])for(const blackTemperature of [-100,0,100]){
  const value={whiteTone,tones:{whiteTemperature,blackTone,blackTemperature}},dark=A.themePalette(value,'dark')||{bg:'#10151E',panel:'#19212E'},light=A.themePalette(value,'light')||{bg:'#F3F5F9',panel:'#FFFFFF'};
  for(const key of ['bg','panel']){assert.ok(contrast(A.whiteColor(value),dark[key])>=4.5,JSON.stringify({value,theme:'dark',key}));assert.ok(contrast(A.blackColor(value),light[key])>=4.5,JSON.stringify({value,theme:'light',key}));}
 }
});

test('webpage tone payload shares the shell colors and enables only neutral dark/light text candidates',()=>{
 const value=A.normalize({...A.DEFAULTS,...A.toneChanges(A.DEFAULTS,{whiteTemperature:60,blackTone:85,blackTemperature:-70})}),payload=A.pageTone(value,'light'),normalized=pageTone.normalize(payload),tools=pageTone.createReadingTools();
 assert.equal(normalized.color,A.whiteColor(value));assert.equal(normalized.blackColor,A.blackColor(value));assert.deepEqual(normalized.tones,value.tones);
 for(const color of ['rgb(0, 0, 0)','rgb(80,80,80)','rgba(30,35,40,0.8)'])assert.equal(tools.neutralDark(color),true);
 for(const color of ['rgb(0,127,255)','rgb(90,0,0)','rgb(0,90,0)','rgba(0,0,0,0)','rgb(160,160,160)'])assert.equal(tools.neutralDark(color),false);
 assert.equal(tools.lightBackground('rgb(255,255,255)'),true);assert.equal(tools.lightBackground('rgb(240,235,225)'),true);assert.equal(tools.lightBackground('rgb(200,100,50)'),false);assert.equal(tools.lightBackground('rgba(255,255,255,0)'),false);
});

let chromium;try{({chromium}=require('playwright'));}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
const executable=process.env.MOUSE_TONE_TEST_CHROMIUM||chromium?.executablePath(),browserSkip=chromium&&executable&&fs.existsSync(executable)?false:'Optional local Chromium/Playwright is unavailable';
test('actual DOM tones preserve colored text, media, backgrounds, live input and restore on reset',{skip:browserSkip},async t=>{
 const browser=await chromium.launch({executablePath:executable,headless:true});t.after(()=>browser.close());const page=await browser.newPage();
 await page.setContent('<!doctype html><style>body{margin:0;background:rgb(16,21,30);color:white;min-height:1800px}.light{background:white;color:black;padding:20px}.blue{color:rgb(0,127,255)}.red{color:rgb(150,0,0)}.colored{background:rgb(30,100,200);color:white}.gradient{background-image:linear-gradient(black,blue);color:white}</style><p id="white">White text <a id="blue" class="blue">Blue link</a><svg id="white-svg" width="20" height="20" style="fill:currentColor"><path id="white-path" d="M0 0h20v20H0z"/></svg></p><section class="light"><p id="black">Black text <a id="red" class="red">Red link</a><svg id="black-svg" width="20" height="20" style="fill:currentColor"><path id="black-path" d="M0 0h20v20H0z"/></svg></p><input id="field" value="Keep my input" style="color:black;background:white"><canvas id="canvas" width="10" height="10"></canvas><div id="dynamic"></div></section><p id="colored" class="colored">Colored surface</p><p id="gradient" class="gradient">Gradient caption</p>');
 await page.addStyleTag({content:pageTone.CSS});
 await page.evaluate(source=>{globalThis.readingTools=(0,eval)('('+source+')')();globalThis.toneService=readingTools.install(document,window);globalThis.originalNodes=[...document.querySelectorAll('p,input,svg,path,canvas')];globalThis.pageIdentity={token:'owned document'};const c=document.querySelector('canvas').getContext('2d');c.fillStyle='#ff00aa';c.fillRect(0,0,10,10);document.querySelector('#field').value='Unsubmitted retained text';scrollTo(0,240);},pageTone.createReadingTools.toString());
 const read=()=>page.evaluate(()=>({colors:Object.fromEntries(['white','blue','black','red','white-path','black-path','colored','gradient','field'].map(id=>[id,{color:getComputedStyle(document.getElementById(id)).color,fill:getComputedStyle(document.getElementById(id)).fill}])),backgrounds:[document.body,...document.querySelectorAll('.light,.colored,.gradient')].map(e=>[getComputedStyle(e).backgroundColor,getComputedStyle(e).backgroundImage]),canvas:document.querySelector('canvas').toDataURL(),field:document.querySelector('#field').value,text:document.body.textContent,scrollY,nodesRetained:originalNodes.every(e=>e===document.getElementById(e.id)),identity:pageIdentity.token,pending:toneService.state().pending}));
 const original=await read(),value=A.normalize({...A.DEFAULTS,...A.toneChanges(A.DEFAULTS,{whiteTemperature:100,blackTone:85,blackTemperature:-100})});
 async function apply(theme,appearance=value){await page.evaluate(value=>toneService.update(value),pageTone.normalize(A.pageTone(appearance,theme)));await page.waitForFunction(()=>!toneService.state().pending);}
 for(const theme of ['light','dark']){
  await apply(theme);const current=await read();assert.equal(current.colors.white.color,'rgb('+rgb(A.whiteColor(value)).join(', ')+')');assert.equal(current.colors.black.color,'rgb('+rgb(A.blackColor(value)).join(', ')+')');
  for(const key of ['blue','red','white-path','black-path','colored','gradient'])assert.deepEqual(current.colors[key],original.colors[key],key);
  for(const key of ['backgrounds','canvas','field','text','scrollY','nodesRetained','identity'])assert.deepEqual(current[key],original[key],key);
 }
 await page.evaluate(()=>{const node=document.createElement('p');node.id='late-black';node.textContent='Dynamic neutral text';document.querySelector('#dynamic').append(node);});await page.waitForFunction(()=>document.querySelector('#late-black').getAttribute('data-mouse-reading-tone')==='black');
 assert.equal(await page.locator('#late-black').evaluate(e=>getComputedStyle(e).color),'rgb('+rgb(A.blackColor(value)).join(', ')+')');
 await page.evaluate(()=>document.querySelector('#late-black').remove());await page.waitForFunction(()=>!toneService.state().pending);
 await apply('light',A.DEFAULTS);const reset=await read();assert.deepEqual(reset,original);assert.equal(await page.evaluate(()=>document.querySelectorAll('[data-mouse-reading-tone]').length),0);
 await page.evaluate(()=>toneService.dispose());
});

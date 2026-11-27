'use strict';
// Execute the actual retained fixture and its DOM readback with an owned unit
// document. Native screenshots and private-session cleanup remain CI checks.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('./mouse-611-smoke.cjs'),'utf8');

function fixture(options={}){
 const version=options.version||'6.0.43',tone=Object.hasOwn(options,'tone')?options.tone:55;
 const traces={themes:[],captures:[],messages:[],readbacks:0},root={dataset:{private:'true'}},home={};
 const model={theme:'dark',state:{tabs:[{id:'private-start'}]},appearance:{whiteTone:tone}};
 const byte=Number.isFinite(tone)?Math.round(160+95*tone/100):212;
 const primary=options.primary??('#'+byte.toString(16).padStart(2,'0').repeat(3));
 const value=(name,fallback)=>typeof options[name]==='function'?options[name](model.theme):options[name]??fallback;
 const mascot={decode:async()=>{},getAttribute:()=>value('mascotSource',model.theme==='light'?'mouse-private-light.svg':'mouse-private.svg')};
 const head={getAttribute:()=>value('headSource',model.theme==='light'?'mouse-head.svg':'mouse-head-dark.svg')};
 const renderer=vm.createContext({
  MouseNative:{version},MouseTest:{model,setTheme(theme){model.theme=theme;traces.themes.push(theme);}},
  requestAnimationFrame:callback=>queueMicrotask(callback),
  document:{documentElement:root,querySelectorAll:selector=>{assert.equal(selector,'.private-mascot');return[mascot];},
   querySelector:selector=>selector==='.home-page'?home:['#tabstrip .private-logo','.pane-icon .private-logo'].includes(selector)?head:null,
   createElement:tag=>{assert.equal(tag,'canvas');return{getContext:()=>({drawImage(){},getImageData(){
    const pixels=new Uint8ClampedArray(47*64*4),put=(x,y,color)=>pixels.set(color,(y*47+x)*4);
    put(10,2,model.theme==='light'?[0,0,0,255]:[255,255,255,255]);put(13,16,[168,85,247,255]);put(15,17,[255,255,255,255]);
    options.artwork?.(pixels,model.theme);return{data:pixels};
   }})};}},
  getComputedStyle:element=>{
   if(element===root)return{getPropertyValue:name=>{assert.equal(name,'--text-primary');return primary;}};
   if(element===mascot)return{filter:value('filter','none')};
   assert.equal(element,home);traces.readbacks++;
   return{backgroundColor:value('background',model.theme==='light'?'rgb(237, 238, 240)':'rgb(23, 24, 34)'),
    color:value('text',model.theme==='light'?'rgb(25, 25, 35)':version==='6.0.43'?`rgb(${byte}, ${byte}, ${byte})`:'rgb(245, 241, 255)')};
  }
 });
 const loaded={exports:{}};
 new Function('require','module','exports','setTimeout','console',source)(name=>{
  if(name==='node:assert/strict')return assert;
  assert.equal(name,'node:fs/promises');return{writeFile:async(filename,bytes)=>{assert.deepEqual(bytes,Buffer.from('owned unit capture'));traces.captures.push(filename);}};
 },loaded,loaded.exports,callback=>queueMicrotask(callback),{log:message=>traces.messages.push(message)});
 const win={webContents:{executeJavaScript:async script=>structuredClone(await vm.runInContext(script,renderer))},capturePage:async()=>({toPNG:()=>Buffer.from('owned unit capture')})};
 return{run:()=>loaded.exports({win}),traces,model};
}

test('actual637 private fixture accepts exact D4 default and both white-tone endpoints through its DOM readback',async()=>{
 for(const [tone,primary,text]of [[55,'#D4D4D4','rgb(212, 212, 212)'],[0,'#A0A0A0','rgb(160, 160, 160)'],[100,'#FFFFFF','rgb(255, 255, 255)']]){
  const f=fixture({tone,primary,text:theme=>theme==='dark'?text:'rgb(25, 25, 35)'});await f.run();
  assert.deepEqual(f.traces.themes,['light','dark','light','dark']);assert.equal(f.model.theme,'dark');assert.equal(f.traces.readbacks,3);
  assert.deepEqual(f.traces.captures,['mouse-611-private-light.png','mouse-611-private-dark.png','mouse-611-private-light.png']);
  assert.deepEqual(f.traces.messages,['MOUSE_611_PRIVATE_THEME_ASSETS_AND_LIVE_SWITCH_PASS']);
 }
});

test('legacy lavender remains required before637 and is rejected for637 primary text',async()=>{
 const legacy=fixture({version:'6.0.36',tone:undefined,primary:''});await legacy.run();
 assert.equal(legacy.traces.captures.length,3);
 const current=fixture({text:theme=>theme==='dark'?'rgb(245, 241, 255)':'rgb(25, 25, 35)'});
 await assert.rejects(current.run(),{code:'ERR_ASSERTION'});
 assert.deepEqual(current.traces.captures,['mouse-611-private-light.png']);assert.deepEqual(current.traces.messages,[]);assert.equal(current.model.theme,'dark');
 const wrongLegacy=fixture({version:'6.0.36',text:theme=>theme==='dark'?'rgb(212, 212, 212)':'rgb(25, 25, 35)'});
 await assert.rejects(wrongLegacy.run(),{code:'ERR_ASSERTION'});
});

test('637 rejects missing, nonnumeric, fractional and out-of-range actual tone values',async()=>{
 for(const tone of [undefined,null,'55',NaN,55.5,-1,101]){
  const f=fixture({tone});await assert.rejects(f.run(),/637 private white tone is an integer from 0 to 100/);
  assert.deepEqual(f.traces.captures,[]);assert.deepEqual(f.traces.messages,[]);assert.equal(f.model.theme,'dark');
 }
});

test('637 independently rejects a substituted primary variable or mismatched computed text',async()=>{
 for(const primary of ['', '#F5F1FF','#D5D5D5','rgb(212, 212, 212)']){
  const f=fixture({primary});await assert.rejects(f.run(),/637 private primary variable matches the selected white tone/);
  assert.deepEqual(f.traces.captures,[]);assert.deepEqual(f.traces.messages,[]);assert.equal(f.model.theme,'dark');
 }
 const f=fixture({text:theme=>theme==='dark'?'rgb(213, 213, 213)':'rgb(25, 25, 35)'});
 await assert.rejects(f.run(),{code:'ERR_ASSERTION'});assert.deepEqual(f.traces.messages,[]);assert.equal(f.model.theme,'dark');
});

test('637 keeps the exact retained mascot, glasses, glint, asset and filter guards',async()=>{
 const cases=[{mascotSource:'replacement.svg'},{headSource:'replacement.svg'},{filter:'brightness(0.8)'},
  ...[[10,2],[13,16],[15,17]].map(([x,y])=>({artwork:pixels=>pixels.set([70,80,90,255],(y*47+x)*4)}))];
 for(const options of cases){const f=fixture(options);await assert.rejects(f.run(),{code:'ERR_ASSERTION'});assert.deepEqual(f.traces.captures,[]);assert.deepEqual(f.traces.messages,[]);assert.equal(f.model.theme,'dark');}
});

test('637 retains both exact private backgrounds and the original light-theme text',async()=>{
 for(const options of [{background:'rgb(0, 0, 0)'},{background:theme=>theme==='dark'?'rgb(24, 24, 34)':'rgb(237, 238, 240)'},{text:theme=>theme==='light'?'rgb(212, 212, 212)':'rgb(212, 212, 212)'}]){
  const f=fixture(options);await assert.rejects(f.run(),{code:'ERR_ASSERTION'});assert.deepEqual(f.traces.messages,[]);assert.equal(f.model.theme,'dark');
 }
});

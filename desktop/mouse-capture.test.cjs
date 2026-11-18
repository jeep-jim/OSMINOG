'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{rect,draw}=require('./mouse/capture-core.js');
test('selection handles reverse drag, clamps pixels and rejects empty extent',()=>{assert.deepEqual(rect({x:30,y:20},{x:4,y:5},100,100),{x:4,y:5,width:26,height:15});assert.deepEqual(rect({x:-2,y:-9},{x:200,y:300},100,80),{x:0,y:0,width:100,height:80});assert.equal(rect({x:3,y:3},{x:3,y:3},100,80).width,0)});
test('all annotation tools paint, marker restores opacity and text is literal',()=>{for(const tool of ['arrow','line','rect','ellipse','pencil','marker','text']){const calls=[];const c=new Proxy({},{get:(_t,k)=>(...args)=>calls.push([k,...args]),set:(_t,k,v)=>{calls.push([k,v]);return true}});draw(c,{tool,color:'#ff0000',width:3,font:24,text:'<script>not HTML</script>',points:[{x:2,y:3},{x:90,y:80}]});assert.equal(calls[0][0],'save');assert.equal(calls.at(-1)[0],'restore');assert.ok(calls.some(x=>['stroke','strokeRect','fillText'].includes(x[0])));if(tool==='marker')assert.ok(calls.some(x=>x[0]==='globalAlpha'&&x[1]===.3))}});
test('host capture and favicon are trusted, limited and never uploaded',()=>{const code=fs.readFileSync('mouse-shell.cjs','utf8');assert.match(code,/trusted\(e\)/);assert.match(code,/40000000/);assert.match(code,/await clipboard.write\(\[new ClipboardItem/);assert.match(code,/showSaveDialog/);assert.doesNotMatch(code,/globalShortcut|setInterval|privateKey|child_process/);const icon=fs.readFileSync('mouse-icon.cjs','utf8');assert.match(icon,/mouse-brand.cjs/);assert.doesNotMatch(icon,/35,72,160/)});
test('SVG favicon accepts only bounded inert artwork, rejects executable and remote references',()=>{const {faviconData}=require('./mouse/favicon.js'),native={createFromBuffer:()=>({isEmpty:()=>true,getSize:()=>({width:0,height:0})})};assert.match(faviconData(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>'),'image/svg+xml',native),/^data:image\/svg\+xml/);for(const text of ['<svg onload="alert(1)"></svg>','<svg><script/></svg>','<svg><image href="https://x"/></svg>','<svg><foreignObject/></svg>','<!DOCTYPE svg><svg/>'])assert.equal(faviconData(Buffer.from(text),'image/svg+xml',native),'');assert.equal(faviconData(Buffer.alloc(131073),'image/png',native),'')});

test('full palette converts arbitrary RGB colors losslessly and handles every hue sector',()=>{
 const C=require('./mouse/capture-core.js');
 for(const [h,hex]of [[0,'#ff0000'],[60,'#ffff00'],[120,'#00ff00'],[180,'#00ffff'],[240,'#0000ff'],[300,'#ff00ff'],[360,'#ff0000']])assert.equal(C.colorFromHSV({h,s:1,v:1}),hex);
 for(const hex of ['#2a79c3','#6060bf','#a1b2c3','#000000','#ffffff','#808080','#32c76a'])assert.equal(C.colorFromHSV(C.colorToHSV(hex,142)),hex);
 assert.equal(C.normalizeColor(' AbC '),'#aabbcc');assert.equal(C.normalizeColor('#2A79C3'),'#2a79c3');
 for(const invalid of ['',null,'#12345','red','url(https://example.test)','#12345678'])assert.equal(C.normalizeColor(invalid),null);
 assert.throws(()=>C.colorFromHSV({h:NaN,s:1,v:1}));
});

// Execute the actual palette and canvas pointer handlers. The DOM and canvas
// boundaries below only record state; no duplicate color/annotation logic.
function paletteFixture(){
 const vm=require('node:vm'),C=require('./mouse/capture-core.js'),source=fs.readFileSync(require.resolve('./mouse/capture.js'),'utf8');
 let active;const make=()=>({value:'',dataset:{},attrs:{},style:{setProperty(k,v){this[k]=v;}},hidden:false,setAttribute(k,v){this.attrs[k]=String(v);},removeAttribute(k){delete this.attrs[k];},getAttribute(k){return this.attrs[k];},focus(){active=this;},setPointerCapture(){},contains(e){return e===this;},getBoundingClientRect(){return{left:10,top:10,x:10,y:10,bottom:40,width:200,height:100};}});
 const nodes=Object.fromEntries(['capture-palette','capture-color','capture-spectrum','capture-spectrum-thumb','capture-hue','capture-hex','capture-color-error','capture-width','capture-font','capture-text'].map(id=>[id,make()])),swatches=[],chip=make(),canvas=make(),d=make();
 const palette=nodes['capture-palette'];palette.hidden=true;palette.offsetWidth=232;palette.offsetHeight=360;palette.querySelectorAll=()=>swatches;palette.querySelector=()=>({append:b=>swatches.push(b)});nodes['capture-color'].querySelector=()=>chip;
 d.clientWidth=800;d.clientHeight=600;d.addEventListener=()=>{};canvas.width=200;canvas.height=100;canvas.clientWidth=200;
 nodes['capture-width'].value='3';nodes['capture-font'].value='24';nodes['capture-text'].value='Подпись';
 const scope={core:C,document:{createElement:make},$:s=>nodes[s.slice(1)],d,c:canvas,tool:'arrow',start:null,current:null,moving:null,selected:-1,ops:[],pos:e=>({x:e.clientX,y:e.clientY}),render(){},measure:()=>10,remember(){},crop(){}};
 scope.add=op=>scope.ops.push(op);vm.createContext(scope);
 const paletteCode=source.slice(source.indexOf(" const palette=$('#capture-palette')"),source.indexOf(' async function exportImage('));
 const pointerCode=source.slice(source.indexOf(' c.onpointerdown='),source.indexOf(" d.querySelectorAll('[data-tool]')"));
 vm.runInContext(paletteCode+'\n'+pointerCode,scope);
 const event=(x,y,extra={})=>({button:0,pointerId:1,clientX:x,clientY:y,preventDefault(){},stopPropagation(){},...extra});
 return{nodes,swatches,scope,canvas,event,active:()=>active,draw(tool){scope.tool=tool;canvas.onpointerdown(event(20,20));canvas.onpointermove(event(70,50));canvas.onpointerup(event(70,50));return scope.ops.at(-1);}};
}

test('actual HSV pointer selection drives every annotation tool and keeps presets and HEX synchronized',()=>{
 const f=paletteFixture(),n=f.nodes,C=require('./mouse/capture-core.js');n['capture-color'].onclick();assert.equal(n['capture-palette'].hidden,false);assert.equal(f.active(),n['capture-spectrum']);
 n['capture-hue'].value='240';n['capture-hue'].oninput();n['capture-spectrum'].onpointerdown(f.event(110,35));n['capture-spectrum'].onpointerup(f.event(110,35));
 assert.equal(n['capture-color'].value,'#6060bf');assert.equal(n['capture-hex'].value,'#6060bf');assert.ok(f.swatches.every(b=>b.getAttribute('aria-pressed')==='false'));
 for(const tool of ['arrow','line','rect','ellipse','pencil','marker','text']){const op=f.draw(tool);assert.equal(op.color,'#6060bf');const paint={};const ctx=new Proxy(paint,{get:(t,k)=>k in t?t[k]:()=>{},set:(t,k,v)=>{t[k]=v;return true;}});C.draw(ctx,op);assert.equal(paint.strokeStyle,'#6060bf');assert.equal(paint.fillStyle,'#6060bf');}
 n['capture-hex'].value='#2A79C3';n['capture-hex'].oninput();assert.equal(n['capture-color'].value,'#2a79c3');assert.equal(n['capture-hex'].value,'#2a79c3');assert.equal(f.draw('arrow').color,'#2a79c3');assert.equal(f.scope.ops[0].color,'#6060bf','Changing the active color preserves earlier annotations');
 f.swatches.find(b=>b.dataset.color==='#ee364b').onclick();assert.equal(n['capture-color'].value,'#ee364b');assert.equal(n['capture-hex'].value,'#ee364b');assert.equal(n['capture-palette'].hidden,true);assert.equal(f.active(),f.canvas);
});

test('actual palette keyboard and HEX validation retain the last valid drawing color',()=>{
 const f=paletteFixture(),n=f.nodes;n['capture-color'].onclick();n['capture-hex'].value='#ABC';n['capture-hex'].onkeydown(f.event(0,0,{key:'Enter'}));assert.equal(n['capture-color'].value,'#aabbcc');assert.equal(n['capture-hex'].value,'#aabbcc');assert.equal(n['capture-palette'].hidden,true);
 n['capture-color'].onclick();n['capture-hex'].value='#oops';n['capture-hex'].onkeydown(f.event(0,0,{key:'Enter'}));assert.equal(n['capture-palette'].hidden,false);assert.equal(n['capture-hex'].getAttribute('aria-invalid'),'true');assert.equal(n['capture-color-error'].hidden,false);assert.equal(f.draw('text').color,'#aabbcc');
 n['capture-color'].onclick();n['capture-hex'].value='#808080';n['capture-hex'].oninput();n['capture-hue'].value='240';n['capture-hue'].oninput();n['capture-spectrum'].onkeydown(f.event(0,0,{key:'ArrowRight',shiftKey:true}));assert.equal(n['capture-color'].value,'#737380');assert.equal(n['capture-hex'].getAttribute('aria-invalid'),undefined);assert.equal(n['capture-color-error'].hidden,true);
 const before=n['capture-color'].value;n['capture-spectrum'].onpointermove(f.event(190,10,{pointerId:9}));assert.equal(n['capture-color'].value,before,'Uncaptured pointer movement never changes the color');
});

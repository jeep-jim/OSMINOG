'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const tone=require('./mouse-page-tone.cjs'),tools=tone.createReadingTools();
test('tone endpoints, default and invalid settings are explicit',()=>{
 assert.equal(tone.normalize({theme:'dark',whiteTone:0}).color,'#A0A0A0');
 assert.equal(tone.normalize({theme:'dark',whiteTone:55}).color,'#D4D4D4');
 assert.equal(tone.normalize({theme:'light',whiteTone:100}).color,'#FFFFFF');
 for(const whiteTone of [-1,101,NaN,'55',.5])assert.throws(()=>tone.normalize({theme:'dark',whiteTone}));
 assert.throws(()=>tone.normalize({theme:'system',whiteTone:55}));
});
test('neutral light text excludes coloured links, dark text and transparent fills',()=>{
 for(const c of ['rgb(255, 255, 255)','rgb(212, 212, 212)','rgba(224, 226, 228, 0.8)','rgb(160 160 160 / 1)'])assert.equal(tools.neutralLight(c),true,c);
 for(const c of ['rgb(0, 127, 255)','rgb(23, 32, 51)','rgba(255, 255, 255, 0)','transparent','var(--white)'])assert.equal(tools.neutralLight(c),false,c);
 assert.equal(tools.darkBackground('rgb(16, 21, 30)'),true);
 for(const c of ['rgb(255, 255, 255)','rgb(30, 100, 200)','rgba(0, 0, 0, 0)'])assert.equal(tools.darkBackground(c),false);
});
function fixture(){
 let nextId=0;
 function page(url){const wc=new EventEmitter();Object.assign(wc,{id:++nextId,url,getURL:()=>wc.url,isDestroyed:()=>false,insertCSS:async(css,options)=>{wc.css={css,options};return'css-'+wc.id;}});return{view:{webContents:wc}};}
 const calls=[],browser={tabs:new Map(),providers:new Map(),make:url=>{const p=page(url);browser.tabs.set(p.view.webContents.id,p);return p;},dispose:()=>{browser.disposed=true;}};
 const service=tone.install(browser,{run:async(wc,value)=>calls.push({id:wc.id,...value})});return{calls,browser,service};
}
test('live selection reaches existing and subsequently navigated pages with user CSS',async()=>{
 const {calls,browser,service}=fixture(),first=browser.make('https://example.test');
 service.set({theme:'dark',whiteTone:0});await service.wait();
 assert.equal(calls.at(-1).color,'#A0A0A0');assert.equal(first.view.webContents.css.options.cssOrigin,'user');
 const second=browser.make('https://other.test');second.view.webContents.emit('dom-ready');await service.wait();
 assert.equal(calls.at(-1).id,second.view.webContents.id);assert.equal(calls.at(-1).color,'#A0A0A0');
 service.set({theme:'light',whiteTone:100});await service.wait();assert.equal(calls.at(-1).theme,'light');
 browser.dispose();const count=calls.length;first.view.webContents.emit('dom-ready');await service.wait();assert.equal(calls.length,count);
});
test('extensions and local documents do not receive website reading styles',async()=>{
 const {calls,browser,service}=fixture();browser.make('chrome-extension://example/popup.html');browser.make('file:///local.html');browser.make('about:blank');service.set({theme:'dark',whiteTone:55});await service.wait();assert.equal(calls.length,0);
});
test('main-document commit reapplies current preference without needing dom-ready',async()=>{
 const {calls,browser,service}=fixture(),page=browser.make('https://first.test');
 service.set({theme:'dark',whiteTone:0});await service.wait();
 service.set({theme:'light',whiteTone:100});await service.wait();const before=calls.length;
 page.view.webContents.emit('did-navigate',{},'https://first.test');await service.wait();
 assert.equal(calls.length,before+1);assert.equal(calls.at(-1).theme,'light');assert.equal(calls.at(-1).whiteTone,100);
});
test('navigation during CSS insertion cannot run reading logic in a local document',async()=>{
 const {calls,browser,service}=fixture(),page=browser.make('https://first.test'),wc=page.view.webContents;let release,inserts=0;
 wc.insertCSS=async()=>{inserts++;if(inserts===1)await new Promise(resolve=>{release=resolve;});return'css-'+inserts;};
 service.set({theme:'dark',whiteTone:0});assert.equal(typeof release,'function');
 wc.url='file:///local.html';wc.emit('did-start-navigation',{},wc.url,false,true);release();await service.wait();
 assert.equal(inserts,1);assert.equal(calls.length,0,'An old asynchronous insertion cannot execute in the replacement local document');
 wc.url='https://second.test';wc.emit('did-start-navigation',{},{isMainFrame:true,isSameDocument:false,url:wc.url});wc.emit('did-navigate',{},wc.url);await service.wait();
 assert.equal(inserts,2);assert.equal(calls.length,1);assert.equal(calls[0].color,'#A0A0A0');
});

// Optional DOM engine lives only in the test environment, never in the product.
// Run with NODE_PATH pointing at a temporary jsdom 27.4+ installation. The native
// installed-app gate separately verifies actual custom-property and pixel paint.
let JSDOM;
try{({JSDOM}=require('jsdom'));}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
function domFixture(t,{css=true,extra=''}={}){
 const dom=new JSDOM(`<!doctype html><html><head><style>body{background:rgb(16,21,30);color:rgb(255,255,255)}.blue{color:rgb(0,127,255)}.light{background:rgb(255,255,255);color:rgb(23,32,51)}.gradient{background-image:linear-gradient(black,blue)}.button{background:rgb(30,100,200)}${css?tone.CSS:''}</style></head><body><p id="white">Parent text <span id="inline">inherited <b id="bold">inline child</b></span><a id="link" class="blue">Blue nested link</a></p><div class="light"><p id="light">Light surface</p></div><p id="gradient" class="gradient">Gradient caption</p><button id="button" class="button">Coloured button</button><svg><text id="vector">Vector image</text></svg><div id="dynamic"></div>${extra}</body></html>`,{pretendToBeVisual:true,url:'https://reading.example.invalid/'});
 const {window}=dom,document=window.document,frames=new Map();let next=0,executed=0;
 window.requestAnimationFrame=fn=>{frames.set(++next,fn);return next;};window.cancelAnimationFrame=id=>frames.delete(id);
 const service=tools.install(document,window),element=id=>document.getElementById(id),marked=id=>element(id).getAttribute('data-mouse-reading-tone')==='text';
 async function frame(){await Promise.resolve();const batch=[...frames.entries()];frames.clear();for(const [,fn]of batch){executed++;fn();}await Promise.resolve();}
 async function settle(){for(let i=0;i<500;i++){await new Promise(setImmediate);if(!frames.size)return;await frame();}assert.fail('Reading tone observer did not settle');}
 t.after(()=>{service.dispose();window.close();});
 return{window,document,service,element,marked,frame,settle,frames,executed:()=>executed};
}
const domSkip=JSDOM?false:'Optional jsdom test engine is not installed';
test('marked white text preserves nested blue links and inline colour inheritance',{skip:domSkip},async t=>{
 const f=domFixture(t);f.service.update(tone.normalize({theme:'dark',whiteTone:0}));await f.settle();
 assert.equal(f.marked('white'),true);assert.equal(f.marked('link'),false);
 const computed=id=>f.window.getComputedStyle(f.element(id));
 // jsdom retains var() as a token; this proves the inherited property choice,
 // while the installed-app browser gate proves its resolved visual colour.
 assert.equal(computed('white').color,'var(--mouse-reading-tone)');
 assert.equal(computed('inline').color,computed('white').color);
 assert.equal(computed('bold').color,computed('white').color);
 assert.equal(computed('link').color,'rgb(0, 127, 255)');
 assert.equal(computed('white').getPropertyValue('-webkit-text-fill-color'),'','A fill on the parent would override its coloured descendants by inheritance');
 assert.equal(computed('light').color,'rgb(23, 32, 51)');
 for(const id of ['light','gradient','button','vector'])assert.equal(f.marked(id),false,id);
 f.service.update(tone.normalize({theme:'light',whiteTone:0}));await f.settle();
 assert.equal(computed('white').color,'rgb(255, 255, 255)');
 assert.equal(computed('inline').color,'rgb(255, 255, 255)');
 assert.equal(computed('link').color,'rgb(0, 127, 255)');
});
test('reading DOM updates are bounded, settle without polling and restore on disable',{skip:domSkip},async t=>{
 // Classification and scheduling are tested without relying on jsdom's
 // incomplete CSS custom-property resolution.
 const f=domFixture(t,{css:false,extra:Array.from({length:600},(_,i)=>`<p id="bulk-${i}">Dynamic article ${i}</p>`).join('')});
 f.service.update(tone.normalize({theme:'dark',whiteTone:0}));await f.frame();
 assert.ok(f.service.state().marked<=256);assert.equal(f.service.state().pending,true);
 await f.settle();assert.equal(f.marked('bulk-599'),true);assert.equal(f.frames.size,0);
 const complete=f.executed();await f.settle();assert.equal(f.executed(),complete,'Steady pages do not poll or observe their own marker');
 f.service.update(tone.normalize({theme:'dark',whiteTone:100}));await f.settle();
 assert.equal(f.document.documentElement.style.getPropertyValue('--mouse-reading-tone'),'#FFFFFF');
 const p=f.document.createElement('p');p.id='added';p.textContent='Added neutral text';f.element('dynamic').append(p);await f.settle();assert.equal(f.marked('added'),true);
 p.style.color='rgb(0,127,255)';await f.settle();assert.equal(f.marked('added'),false);
 p.style.color='rgb(255,255,255)';await f.settle();assert.equal(f.marked('added'),true);
 p.style.backgroundColor='rgb(255,255,255)';await f.settle();assert.equal(f.marked('added'),false);
 f.service.update(tone.normalize({theme:'light',whiteTone:55}));await f.settle();
 assert.equal(f.document.querySelectorAll('[data-mouse-reading-tone]').length,0);
 assert.equal(f.document.documentElement.style.getPropertyValue('--mouse-reading-tone'),'');assert.equal(f.frames.size,0);
});
test('existing stylesheet edits and completed stylesheet loads rescan affected text',{skip:domSkip},async t=>{
 const f=domFixture(t,{css:false,extra:'<style id="changing-rules">#white{color:rgb(255,255,255)}</style><link id="late-css" rel="stylesheet">'}),rules=f.element('changing-rules');
 f.service.update(tone.normalize({theme:'dark',whiteTone:0}));await f.settle();assert.equal(f.marked('white'),true);
 rules.textContent='#white{color:rgb(0,127,255)}';await f.settle();
 assert.equal(f.window.getComputedStyle(f.element('white')).color,'rgb(0, 127, 255)');
 assert.equal(f.marked('white'),false,'Changing text inside an existing STYLE must reconsider the article, not only the STYLE node');
 rules.firstChild.data='#white{color:rgb(255,255,255)}';await f.settle();assert.equal(f.marked('white'),true,'characterData changes also reconsider the article');
 rules.textContent='#white{color:rgb(0,127,255)}';await f.settle();assert.equal(f.marked('white'),false);
 rules.remove();await f.settle();assert.equal(f.marked('white'),true,'Removing a stylesheet restores inherited neutral text');
 const loaded=f.executed();f.element('late-css').dispatchEvent(new f.window.Event('load'));assert.equal(f.service.state().pending,true);await f.settle();assert.ok(f.executed()>loaded,'A stylesheet load runs a document rescan');
 f.service.dispose();f.element('late-css').dispatchEvent(new f.window.Event('load'));assert.equal(f.frames.size,0,'Disposal removes the captured load listener');
});
test('light surfaces and currentColor media are shielded from a marked parent without changing text nodes',{skip:domSkip},async t=>{
 const f=domFixture(t),parent=f.element('white'),light=f.document.createElement('span'),coloured=f.document.createElement('span'),svg=f.document.createElementNS('http://www.w3.org/2000/svg','svg');
 light.id='inherited-light';light.style.backgroundColor='rgb(240,240,240)';light.style.setProperty('--mouse-reading-original-color','rgb(12,34,56)','important');light.textContent='White inherited on light';
 coloured.id='inherited-coloured';coloured.style.backgroundColor='rgb(30,100,200)';coloured.textContent='White inherited on coloured';
 svg.id='inherited-media';svg.style.fill='currentColor';const path=f.document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M0 0h12v12H0z');svg.append(path);parent.append(light,coloured,svg);
 const originalNodes=[...parent.childNodes],lightText=light.firstChild;
 f.service.update(tone.normalize({theme:'dark',whiteTone:0}));await f.settle();
 assert.equal(f.marked('white'),true);assert.equal(f.window.getComputedStyle(f.element('link')).color,'rgb(0, 127, 255)');
 for(const element of [light,coloured,svg]){assert.equal(element.getAttribute('data-mouse-reading-tone'),'shield');assert.equal(element.style.getPropertyValue('--mouse-reading-original-color'),'rgb(255, 255, 255)');assert.equal(element.style.getPropertyPriority('--mouse-reading-original-color'),'important');assert.equal(f.window.getComputedStyle(element).color,'var(--mouse-reading-original-color)');}
 assert.equal(svg.style.fill.toLowerCase(),'currentcolor');assert.equal(path.hasAttribute('data-mouse-reading-tone'),false);assert.deepEqual([...parent.childNodes],originalNodes);assert.equal(light.firstChild,lightText);
 const done=f.executed();await f.settle();assert.equal(f.executed(),done,'Own shield property writes cannot start an observer loop');
 // A site changes its own surface and explicit colour while shielded.
 coloured.style.color='rgb(0,127,255)';await f.settle();assert.equal(coloured.hasAttribute('data-mouse-reading-tone'),false);assert.equal(coloured.style.getPropertyValue('--mouse-reading-original-color'),'');assert.equal(f.window.getComputedStyle(coloured).color,'rgb(0, 127, 255)');
 svg.remove();await f.settle();assert.equal(svg.hasAttribute('data-mouse-reading-tone'),false);assert.equal(svg.style.getPropertyValue('--mouse-reading-original-color'),'','Detached media restores its custom property');
 f.service.update(tone.normalize({theme:'light',whiteTone:0}));await f.settle();
 assert.equal(light.getAttribute('data-mouse-reading-tone'),null);assert.equal(light.style.getPropertyValue('--mouse-reading-original-color'),'rgb(12,34,56)');assert.equal(light.style.getPropertyPriority('--mouse-reading-original-color'),'important');assert.equal(light.firstChild,lightText);assert.equal(f.window.getComputedStyle(light).color,'rgb(255, 255, 255)');
});

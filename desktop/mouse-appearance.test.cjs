'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const appearance=require('./mouse/appearance.js'),{paneCorners}=require('./mouse/mouse-616-ui.js'),L=require('./mouse/layout.js');
const target=()=>({dataset:{},style:{values:new Map(),getPropertyValue(name){return this.values.get(name)||'';},setProperty(name,value){this.values.set(name,value);}}});
function memory(){const data=new Map();return{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),data};}

test('white tone has the exact requested endpoints and soft D4 default, with monotonic equal RGB channels',()=>{
 assert.equal(appearance.color(0),'#A0A0A0');assert.equal(appearance.color(100),'#FFFFFF');assert.equal(appearance.color(appearance.DEFAULTS.whiteTone),'#D4D4D4');
 let previous=159;for(let tone=0;tone<=100;tone++){const color=appearance.color(tone),channels=color.slice(1).match(/../g).map(value=>parseInt(value,16));assert.equal(new Set(channels).size,1);assert.ok(channels[0]>=previous&&channels[0]<=255);previous=channels[0];}
});
test('appearance changes apply immediately and a fresh loader restores both persisted choices',()=>{
 const storage=memory(),one=target();let current=appearance.read(storage);
 assert.deepEqual(current,{paneMode:'rounded',whiteTone:55});
 current=appearance.update(current,{paneMode:'square',whiteTone:0},{target:one,storage}).settings;
 assert.equal(one.dataset.paneMode,'square');assert.equal(one.style.getPropertyValue('--text-primary'),'#A0A0A0');
 const context=vm.createContext({document:{documentElement:target()},localStorage:storage});
 vm.runInContext(fs.readFileSync(require.resolve('./mouse/appearance.js'),'utf8'),context);
 assert.equal(context.document.documentElement.dataset.paneMode,'square');assert.equal(context.document.documentElement.style.getPropertyValue('--text-primary'),'#A0A0A0');
 current=appearance.update(current,{whiteTone:55},{target:one,storage}).settings;assert.equal(current.paneMode,'square');assert.equal(appearance.read(storage).whiteTone,55);
});
test('private choices work for the current view without writing normal localStorage, and leaving restores normal values',()=>{
 const storage=memory(),normal=target(),privateRoot=target();
 const normalValues=appearance.update(appearance.DEFAULTS,{whiteTone:100},{target:normal,storage}).settings,original=storage.getItem(appearance.KEY);
 const privateValues=appearance.update(normalValues,{paneMode:'square',whiteTone:0},{target:privateRoot,storage,privateMode:true});
 assert.equal(privateValues.persisted,null);assert.equal(privateRoot.dataset.paneMode,'square');assert.equal(privateRoot.style.getPropertyValue('--text-primary'),'#A0A0A0');assert.equal(storage.getItem(appearance.KEY),original);
 appearance.apply(appearance.read(storage),normal);assert.equal(normal.dataset.paneMode,'rounded');assert.equal(normal.style.getPropertyValue('--text-primary'),'#FFFFFF');
});
test('corrupt saved data and denied storage retain usable defaults; invalid writes never replace saved settings',()=>{
 for(const raw of ['broken','null','[]','{"paneMode":"unknown","whiteTone":"70"}'])assert.deepEqual(appearance.read({getItem:()=>raw}),appearance.DEFAULTS);
 const denied={getItem(){throw Error('denied');},setItem(){throw Error('full');}};assert.deepEqual(appearance.read(denied),appearance.DEFAULTS);
 const root=target(),updated=appearance.update(appearance.DEFAULTS,{whiteTone:100},{target:root,storage:denied});assert.equal(updated.persisted,false);assert.equal(root.style.getPropertyValue('--text-primary'),'#FFFFFF');
 const storage=memory();storage.setItem(appearance.KEY,'previous');for(const changes of [{},{paneMode:'dense'},{whiteTone:-1},{whiteTone:101},{whiteTone:NaN},{whiteTone:1.5},{whiteTone:'1'},{unknown:true}])assert.throws(()=>appearance.update(appearance.DEFAULTS,changes,{target:root,storage}));assert.equal(storage.getItem(appearance.KEY),'previous');
});
test('square mode removes corner masks and retains one-pixel seams in resize minima; rounded mode retains current focused behavior',()=>{
 for(const focused of [false,true])assert.deepEqual(paneCorners({paneMode:'square',focused}),{top:0,bottom:0});
 assert.deepEqual(paneCorners(),{top:12,bottom:12});assert.deepEqual(paneCorners({focused:true}),{top:12,bottom:0});
 const tree={axis:'x',ratio:.5,a:{id:'p1'},b:{axis:'x',ratio:.5,a:{id:'p2'},b:{id:'p3'}}};assert.equal(appearance.gap({paneMode:'square'}),1);assert.equal(appearance.gap({paneMode:'rounded'}),6);assert.equal(L.minimum(tree,'x',appearance.gap({paneMode:'rounded'})),432);assert.equal(L.minimum(tree,'x',appearance.gap({paneMode:'square'})),422);
});

test('shell appearance controller retains live tabs and only persists after normal-profile initialization',()=>{
 const storage=memory(),root=target(),tabs=[{id:'live-tab',url:'https://example.test'}],slots={p1:'live-tab'},tree={id:'p1'};
 const m={theme:'dark',appearance:appearance.read(storage),state:{tabs},slots,tree},calls={layout:0,round:0,sync:0},pageAppearance=[];
 const context=vm.createContext({m,N:{appearance:async value=>{pageAppearance.push(JSON.parse(JSON.stringify(value)));}},MouseAppearance:{pageTone:appearance.pageTone,update:(current,changes,options)=>appearance.update(current,changes,{...options,target:root,storage})},toneUI:{sync(){}},settingsUI:{sync(){calls.sync++;}},chromeControls:{round(){calls.round++;}},requestLayout(){calls.layout++;},setStatus(){}});
 const source=fs.readFileSync(require.resolve('./mouse/browser.js'),'utf8').match(/ function setAppearance\(changes\)\{[^\n]+/)[0];
 vm.runInContext(source,context);
 context.setAppearance({whiteTone:0});assert.equal(storage.getItem(appearance.KEY),null);assert.equal(root.style.getPropertyValue('--text-primary'),'#A0A0A0');
 m.privateMode=false;context.setAppearance({whiteTone:100});assert.equal(appearance.read(storage).whiteTone,100);assert.equal(calls.layout,0);assert.equal(calls.round,0);
 context.setAppearance({paneMode:'square'});assert.equal(calls.layout,1);assert.equal(calls.round,1);assert.equal(appearance.read(storage).paneMode,'square');
 const saved=storage.getItem(appearance.KEY);m.privateMode=true;context.setAppearance({paneMode:'rounded',whiteTone:55});assert.equal(storage.getItem(appearance.KEY),saved);
 assert.equal(m.state.tabs,tabs);assert.equal(m.slots,slots);assert.equal(m.tree,tree);assert.equal(calls.sync,4);assert.deepEqual(pageAppearance,[{theme:'dark',whiteTone:0},{theme:'dark',whiteTone:100},{theme:'dark',whiteTone:100},{theme:'dark',whiteTone:55}]);
});

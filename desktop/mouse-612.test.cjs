'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{EventEmitter}=require('node:events');
const {installWorkspace,installShellRecovery}=require('./mouse-stability.cjs');
function fixture(){
 const children=[];let seq=0,closed=0;const win=new EventEmitter();win.isDestroyed=()=>false;win.contentView={children,removeChildView:v=>{const i=children.indexOf(v);if(i>=0)children.splice(i,1)}};
 const b={win,tabs:new Map(),providers:new Map(),panels:[],state(){for(const t of this.tabs.values())assert.equal(t.view.webContents.isDestroyed(),false);return{size:this.tabs.size}},save(){this.state();return Promise.resolve()},layout(){this.state()},emit(){if(!this.disposed)this.state()},make(){const wc=new EventEmitter();wc.dead=false;wc.isDestroyed=()=>wc.dead;wc.close=()=>{wc.dead=true;closed++;this.emit();wc.emit('destroyed')};const t={id:String(++seq),view:{webContents:wc}};this.tabs.set(t.id,t);children.push(t.view);return t},dispose(){for(const t of this.tabs.values())t.view.webContents.close()}};return{b,children,closed:()=>closed};
}
test('old synchronous disposal regression is reproduced, safe teardown detaches and clears first',()=>{const old=fixture();old.b.make();assert.throws(()=>old.b.dispose());const {b,children,closed}=fixture();installWorkspace(b);for(let i=0;i<8;i++)b.make();assert.doesNotThrow(()=>b.dispose());assert.equal(children.length,0);assert.equal(b.tabs.size,0);assert.equal(closed(),8);b.dispose();assert.equal(closed(),8)});
test('unexpected guest destruction cannot poison sibling state or layout',()=>{const {b,children}=fixture();installWorkspace(b);const a=b.make(),keep=b.make();a.view.webContents.dead=true;a.view.webContents.emit('destroyed');assert.equal(b.state().size,1);assert.ok(b.tabs.has(keep.id));assert.equal(children.length,1);assert.doesNotThrow(()=>b.layout([]))});
test('stale native state gets one cleanup retry and unrelated exceptions remain observable',()=>{
 const {b,children}=fixture(),a=b.make(),keep=b.make();let calls=0;const nativeState=b.state;b.state=function(){calls++;return nativeState.call(this);};installWorkspace(b);
 a.view.webContents.dead=true;assert.equal(b.state().size,1);assert.equal(calls,2,'One failed native state and one recovery attempt');assert.equal(children.length,1);assert.equal(b.tabs.get(keep.id),keep);assert.equal(b.mouseSafety.prune(),0);
 const g=fixture(),error=Error('Unrelated state failure');let attempts=0;g.b.make();g.b.state=()=>{attempts++;throw error;};installWorkspace(g.b);assert.throws(()=>g.b.state(),e=>e===error);assert.equal(attempts,1);
});
test('late destruction of a replaced identity cannot remove its live replacement or selected panel',()=>{
 const {b,children}=fixture();installWorkspace(b);const old=b.make(),replacement=b.make();b.tabs.delete(replacement.id);replacement.id=old.id;b.tabs.set(old.id,replacement);b.panels=[{id:replacement.id}];b.layoutPages=new Set([old,replacement]);
 old.view.webContents.dead=true;old.view.webContents.emit('destroyed');assert.equal(b.tabs.get(replacement.id),replacement);assert.deepEqual(b.panels,[{id:replacement.id}]);assert.deepEqual([...b.layoutPages],[replacement]);assert.equal(children.includes(old.view),false);assert.equal(children.includes(replacement.view),true);assert.equal(b.state().size,1);
});
test('pre-existing live pages receive one destruction listener and explicit prune remains idempotent',()=>{
 const {b,children}=fixture(),pages=Array.from({length:50},()=>b.make());const safety=installWorkspace(b);assert.equal(installWorkspace(b),safety);
 for(let n=0;n<3;n++)assert.equal(safety.prune(),0);assert.ok(pages.every(page=>page.view.webContents.listenerCount('destroyed')===1));
 for(const page of pages.slice(0,10)){page.view.webContents.dead=true;page.view.webContents.emit('destroyed');}
 assert.equal(b.tabs.size,40);assert.equal(children.length,40);assert.equal(safety.prune(),0);b.dispose();assert.equal(b.tabs.size,0);assert.equal(children.length,0);
});
test('shell recovery is bounded, uses the existing workspace and never quits or deletes profiles',async()=>{const win=new EventEmitter();win.webContents=new EventEmitter();win.isDestroyed=()=>false;let loads=0,saves=0;win.loadURL=async()=>{loads++};const x=installShellRecovery({win,entry:'file:///host',isClosing:()=>false,current:()=>({browser:{save:async()=>{saves++},saveQueue:Promise.resolve()}})});await x.recover(null,{reason:'crashed'});await x.recover(null,{reason:'crashed'});assert.equal(loads,1);assert.equal(saves,1)});
test('head glasses retain identical geometry between themes without mirroring',()=>{const dark=fs.readFileSync('mouse/mouse-private.svg','utf8'),light=fs.readFileSync('mouse/mouse-private-light.svg','utf8');assert.match(dark,/<g id="owner-pixel-glasses" transform="translate\(-1 0\)">/);assert.equal(light,dark.replace('<g id="mouse-approved-left"><path fill="#ffffff"','<g id="mouse-approved-left"><path fill="#000000"'));assert.match(light,/fill="#a855f7"/)});

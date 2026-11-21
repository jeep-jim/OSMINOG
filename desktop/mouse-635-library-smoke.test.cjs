'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {assertStablePlaceholderGeometry:stable,assertStable}=require('./mouse-635-library-smoke.cjs');

test('library evidence rejects a decoded system icon in place of the real file thumbnail',()=>{
 const before={kind:'downloads',view:'grid',theme:'light',scrollTop:12,rowTop:30,order:['owned']},after={...before,sameRow:true,sameImage:true,sameCheckbox:true,sameFocus:true,focusedCheckbox:true,selected:true,removed:0,sameSource:true,sourceWrites:0,imageSize:{width:32,height:32},thumbnail:false};
 assert.throws(()=>assertStable(before,after),/decoded file thumbnail/);after.thumbnail=true;assertStable(before,after);
});

function receipt(view){
 const rows=Array.from({length:4},(_,index)=>({id:'copy-'+index,row:{x:620,y:300+index*84,width:386,height:84},image:{x:626,y:306+index*84,width:view==='grid'?150:30,height:view==='grid'?112:30},checkbox:{x:982,y:313+index*84,width:16,height:16},thumbnail:false,decoded:false}));
 const before={kind:'captures',view,scrollTop:380,rows},after=structuredClone(before),ids=['copy-0','copy-1','copy-2'];for(const row of after.rows)if(ids.includes(row.id)){row.thumbnail=true;row.decoded=true;}return{before,after,ids};
}
for(const view of ['list','grid'])test('installed '+view+' preview evidence accepts real decoding in an unchanged box',()=>{
 const {before,after,ids}=receipt(view);stable(before,after,ids);
});
test('preview evidence rejects the eighteen-pixel checkbox shift seen between hit-test and native input',()=>{
 const {before,after,ids}=receipt('list');for(const name of ['row','image','checkbox'])after.rows[3][name].y+=18;
 assert.throws(()=>stable(before,after,ids),/keeps copy-3 row y/);
});
test('preview evidence rejects a larger late image, scroll compensation and unobserved completion',()=>{
 for(const mutate of [r=>r.after.rows[0].image.height+=6,r=>r.after.scrollTop+=18,r=>r.after.rows[0].decoded=false,r=>r.before.rows[0].thumbnail=true,r=>r.ids.push('not-measured')]){
  const r=receipt('grid');mutate(r);assert.throws(()=>stable(r.before,r.after,r.ids));
 }
 const r=receipt('grid');assert.throws(()=>stable(r.before,r.after,[]),/Actual archive reads were held/);
});
test('file placeholder CSS reserves the same list and tile dimensions before the thumbnail class exists',()=>{
 const css=fs.readFileSync(path.join(__dirname,'mouse/mouse-620.css'),'utf8'),rules=[...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)].map(match=>({selector:match[1].trim(),body:match[2]}));
 const scoped=(view,suffix)=>rules.find(rule=>rule.selector==='#library-dialog:is([data-kind=downloads],[data-kind=captures]) [data-view='+view+'] '+suffix)?.body||'';
 assert.match(scoped('list','.library-icon'),/width:30px;height:30px/);
 assert.match(scoped('grid','.library-icon'),/width:100%;height:112px;box-sizing:border-box/);
 assert.match(scoped('grid','.library-icon:not(.library-thumbnail)'),/padding:38px 0/);
 assert.ok(rules.some(rule=>rule.selector.endsWith('#library-dialog:is([data-kind=downloads],[data-kind=captures]) [data-view=grid] .library-visual')&&/min-height:112px;padding-top:24px/.test(rule.body)));
 assert.doesNotMatch(css,/\.library-visual:has\(\.library-thumbnail\)/,'Loading must not change the outer preview box');
 assert.equal(112-38*2,36,'Tile fallback keeps a small icon inside the reserved preview area');
});

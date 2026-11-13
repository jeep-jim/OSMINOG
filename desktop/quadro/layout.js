'use strict';
(function(root){
 const LIMIT=12,clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
 function leaves(t){return t.id?[t.id]:[...leaves(t.a),...leaves(t.b)]}
 function preset(count=1){
  const n=clamp(Math.floor(Number(count)||1),1,LIMIT);let next=0;
  const column=k=>k===1?{id:'p'+(++next)}:{axis:'y',ratio:1/k,a:{id:'p'+(++next)},b:column(k-1)};
  const cols=n<=3?n:Math.ceil(Math.sqrt(n));
  function columns(left,c){const rows=Math.ceil(left/c);return c===1?column(left):{axis:'x',ratio:1/c,a:column(rows),b:columns(left-rows,c-1)}}
  return columns(n,cols);
 }
 function validate(value){
  let nodes=0;const ids=new Set();
  function read(t){if(!t||typeof t!=='object'||++nodes>LIMIT*2-1)throw Error('Invalid layout');if(typeof t.id==='string'){if(!/^p[0-9]{1,8}$/.test(t.id)||ids.has(t.id))throw Error('Invalid pane');ids.add(t.id);return{id:t.id}}if(!['x','y'].includes(t.axis)||!Number.isFinite(t.ratio))throw Error('Invalid split');return{axis:t.axis,ratio:clamp(t.ratio,.08,.92),a:read(t.a),b:read(t.b)}}
  const result=read(value);if(!ids.size||ids.size>LIMIT)throw Error('Too many panes');return result;
 }
 function at(tree,path){let t=tree;for(const key of path){if(!['a','b'].includes(key)||t.id)throw Error('Invalid split path');t=t[key]}return t}
 function ratio(tree,path,value){const t=at(tree,path);if(t.id||!Number.isFinite(value))throw Error('Invalid ratio');t.ratio=clamp(value,.08,.92);return tree}
 function split(tree,id,axis){
  if(!['x','y'].includes(axis))throw Error('Invalid split axis');const all=leaves(tree);if(all.length>=LIMIT)throw Error('Максимум 12 окон');if(!all.includes(id))throw Error('Окно не найдено');
  const newId='p'+(Math.max(...all.map(x=>Number(x.slice(1))))+1);
  function visit(t){return t.id?(t.id===id?{axis,ratio:.5,a:{id},b:{id:newId}}:t):{...t,a:visit(t.a),b:visit(t.b)}}
  return{tree:visit(tree),id:newId};
 }
 function remove(tree,id){if(tree.id)return tree.id===id?null:tree;const a=remove(tree.a,id),b=remove(tree.b,id);return a&&b?{...tree,a,b}:a||b}
 function minimum(tree,axis){if(tree.id)return axis==='x'?140:100;return tree.axis===axis?minimum(tree.a,axis)+minimum(tree.b,axis)+6:Math.max(minimum(tree.a,axis),minimum(tree.b,axis))}
 const api={LIMIT,clamp,leaves,preset,validate,at,ratio,split,remove,minimum};if(typeof module==='object'&&module.exports)module.exports=api;else root.QuadroLayout=Object.freeze(api);
})(globalThis);

'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {collect,resolve}=require('./element-refs.cjs');
function fixture(){
 const n={tagName:'BUTTON',type:'button',innerText:'Search',isConnected:true,disabled:false,name:'',getAttribute:()=>null,getBoundingClientRect:()=>({x:10,y:10,left:10,top:10,right:110,bottom:40,width:100,height:30}),contains:h=>h===n};
 const document={querySelectorAll:()=>[n],elementFromPoint:()=>n,activeElement:n};
 const ctx=vm.createContext({document,innerWidth:500,innerHeight:400,getComputedStyle:()=>({visibility:'visible',display:'block'})});
 const read=token=>vm.runInContext(`(${collect})(${JSON.stringify(token)})`,ctx);
 const locate=(token='s',ref='e1',kind='click')=>vm.runInContext(`(${resolve})(${JSON.stringify(token)},${JSON.stringify(ref)},${JSON.stringify(kind)})`,ctx);
 read('s');return{n,document,read,locate};
}
test('reference follows the same live node after layout movement',()=>{const f=fixture();f.n.getBoundingClientRect=()=>({left:210,top:110,right:310,bottom:140});assert.equal(f.locate().x,260);assert.equal(f.locate().y,125)});
test('removed, renamed, covered, disabled and offscreen targets fail closed',()=>{
 for(const change of [f=>f.n.isConnected=false,f=>f.n.innerText='Delete',f=>f.document.elementFromPoint=()=>({}),f=>f.n.disabled=true,f=>f.n.getBoundingClientRect=()=>({left:600,right:700,top:0,bottom:20})]){const f=fixture();change(f);assert.equal(f.locate().ok,false)}
});
test('refs cannot cross snapshots; typing cannot target another active field',()=>{const f=fixture();f.read('new');assert.equal(f.locate().ok,false);assert.equal(f.locate('new').ok,true);f.document.activeElement={};assert.match(f.locate('new','e1','type').error,/NOT_FOCUSED/)});

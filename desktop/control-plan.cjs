'use strict';
// Extract one complete plan from a code block or surrounding provider UI text.
// Strings and braces are parsed as JSON; no generated code is evaluated.
module.exports=function extractControlPlan(value){
 const text=String(value||'').slice(0,200000),plans=[];
 for(let start=0;start<text.length;start++){
  if(text[start]!=='{')continue;
  let depth=0,quoted=false,escape=false;
  for(let i=start;i<text.length;i++){
   const c=text[i];if(quoted){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quoted=false;continue}
   if(c==='"'){quoted=true;continue}if(c==='{')depth++;else if(c==='}'&&!--depth){
    try{const p=JSON.parse(text.slice(start,i+1));if(p&&typeof p.summary==='string'&&Array.isArray(p.actions)){const json=JSON.stringify(p);if(!plans.includes(json))plans.push(json)}}catch{}
    start=i;break;
   }
  }
  if(depth>0)return null;
 }
 return plans.length===1?plans[0]:null;
};

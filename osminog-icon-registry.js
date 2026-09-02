"use strict";
(()=>{
  if(globalThis.OSMINOGIconRegistry)return;
  const KEY="osminogIconOverridesV1";
  let overrides={};
  const clean=v=>String(v||"").trim().slice(0,160);
  const notify=()=>document.dispatchEvent(new CustomEvent("osminog:icons-changed",{detail:{keys:Object.keys(overrides)}}));
  async function load(){const got=await chrome.storage.local.get(KEY);overrides=got[KEY]&&typeof got[KEY]==="object"?got[KEY]:{};notify();return{...overrides}}
  function resolve(key,fallback=""){return overrides[clean(key)]||fallback||""}
  async function set(key,src){key=clean(key);src=String(src||"");if(!key)return{error:"Icon key is required"};if(!/^data:image\/(?:png|webp|svg\+xml|jpeg|gif);/i.test(src))return{error:"Icon must be an embedded image data URL"};if(src.length>3*1024*1024)return{error:"Icon is larger than 3 MB"};overrides[key]=src;await chrome.storage.local.set({[KEY]:overrides});notify();return{ok:true,key}}
  async function reset(key){key=clean(key);delete overrides[key];await chrome.storage.local.set({[KEY]:overrides});notify();return{ok:true,key}}
  function choose(key){return new Promise(resolve=>{const input=document.createElement("input");input.type="file";input.accept="image/png,image/webp,image/svg+xml,image/jpeg,image/gif";input.addEventListener("change",()=>{const file=input.files?.[0];if(!file){resolve({error:"No file selected"});return}if(file.size>2*1024*1024){resolve({error:"Icon is larger than 2 MB"});return}const reader=new FileReader();reader.onload=async()=>resolve(await set(key,String(reader.result||"")));reader.onerror=()=>resolve({error:"Could not read icon"});reader.readAsDataURL(file)},{once:true});input.click()})}
  globalThis.OSMINOGIconRegistry={load,resolve,set,reset,choose,list:()=>({...overrides})};
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",load,{once:true}):load();
})();

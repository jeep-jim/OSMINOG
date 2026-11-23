'use strict';
// Owned documents and readbacks for installed acceptance. These helpers do not
// change production styles, synthesize screenshots or substitute input events.
const assert=require('node:assert/strict');

function tonePage(){return `<!doctype html><html><head><meta charset="utf-8"><title>Mouse 638 reading fixture</title><style>
html{background:rgb(24,24,24);color:rgb(255,255,255);font:32px system-ui}body{margin:24px}p{margin:0 0 20px;font-weight:750;line-height:1.4}#neutral-light{-webkit-text-fill-color:rgb(255,255,255)}a{color:rgb(45,145,235)}#light-panel{background:rgb(240,240,240);padding:8px;color:rgb(190,190,190)}#inherit-light{background:rgb(240,240,240)}#inherit-blue{background:rgb(0,80,200)}#inherit-svg{width:80px;height:32px;display:inline-block}#media{width:180px;height:48px;display:block}#dynamic-neutral{margin-top:16px}
</style></head><body><p id="neutral-light">NEUTRAL WHITE TEXT 638</p><p id="colored-parent">WHITE PARENT <a id="colored-link" href="#owned">BLUE LINK 638</a> <span id="inherit-light">LIGHT</span> <span id="inherit-blue">BLUE</span> <svg id="inherit-svg" viewBox="0 0 80 32" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="32" fill="currentColor"/></svg></p><p id="light-panel">LIGHT PANEL 638</p><svg id="media" viewBox="0 0 180 48" xmlns="http://www.w3.org/2000/svg"><rect width="180" height="48" fill="rgb(235,40,155)"/></svg><script>globalThis.mouse638Tone={token:crypto.randomUUID(),timeOrigin:performance.timeOrigin};</script></body></html>`;}

function gridReadback(){
 const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}},root=getComputedStyle(document.documentElement);
 return{theme:MouseTest.model.theme,appearance:{...MouseTest.model.appearance},slots:{...MouseTest.model.slots},
  gap:parseFloat(root.getPropertyValue('--workspace-gap')),radius:parseFloat(root.getPropertyValue('--pane-radius')),seam:root.getPropertyValue('--mouse-grid-seam').trim()||root.getPropertyValue('--line').trim(),
  stage:rect(document.querySelector('#stage')),workspace:rect(document.querySelector('#workspace')),
  panes:[...document.querySelectorAll('#stage .pane')].map(e=>({id:e.dataset.pane,tabId:MouseTest.model.slots[e.dataset.pane],bounds:rect(e),slot:rect(e.querySelector('.page-slot')),radius:parseFloat(getComputedStyle(e).borderBottomLeftRadius)})),
  dividers:[...document.querySelectorAll('#stage .divider')].map(e=>({path:e.dataset.path,axis:e.dataset.axis,bounds:rect(e),focused:document.activeElement===e,hover:e.matches(':hover')}))};
}

function newTabReadback(){
 const root=document.querySelector('#stage .pane.active .home-page')||document.querySelector('#stage .home-page');if(!root)return null;
 const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}},view=rect(root),regions=[];
 for(const e of root.querySelectorAll('.home-welcome,.home-favorites-title,.home-site-label,.home-site-icon,.home-recent-title')){
  const b=rect(e),s=getComputedStyle(e);if(b.width<1||b.height<1||b.x<view.x||b.y<view.y||b.x+b.width>view.x+view.width+1||b.y+b.height>view.y+view.height+1||s.visibility==='hidden'||e.closest('[hidden]'))continue;
  const text=e.textContent.trim();if(!text&&!e.querySelector('img'))continue;
  let bounds=b;if(!e.classList.contains('home-site-icon')){const range=document.createRange();range.selectNodeContents(e);bounds=rect(range);bounds.width=Math.min(bounds.width,b.width);}
  regions.push({kind:e.classList.contains('home-site-icon')?'icon':'text',className:e.className,text,bounds,color:s.color});
 }
 return{bounds:view,background:root.dataset.background,backgroundImage:getComputedStyle(root).backgroundImage,theme:MouseTest.model.theme,zoom:Number(getComputedStyle(document.documentElement).getPropertyValue('--page-zoom'))||1,appearance:{...MouseTest.model.appearance},regions};
}

function toneReadback(){
 const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}};
 return{identity:{...mouse638Tone},elements:['neutral-light','colored-parent','colored-link','inherit-light','inherit-blue','inherit-svg','light-panel','media','dynamic-neutral'].map(id=>document.getElementById(id)).filter(Boolean).map(e=>({id:e.id,bounds:rect(e),color:getComputedStyle(e).color,fill:getComputedStyle(e).webkitTextFillColor,background:getComputedStyle(e).backgroundColor,tag:e.getAttribute('data-mouse-reading-tone'),...(e.id==='inherit-svg'?{svgFill:getComputedStyle(e.querySelector('rect')).fill}:{})}))};
}

function rgb(value){
 if(/^#[0-9a-f]{6}$/i.test(value))return[1,3,5].map(i=>parseInt(value.slice(i,i+2),16));
 const match=/^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(value);assert.ok(match,'An actual CSS RGB colour is required: '+value);return match.slice(1,4).map(Number);
}
function sample(bitmap,size,mapping,point){
 const x=Math.floor(mapping.originX+point.x*mapping.scaleX),y=Math.floor(mapping.originY+point.y*mapping.scaleY);assert.ok(x>=0&&y>=0&&x<size.width&&y<size.height);
 const at=(y*size.width+x)*4;return{x,y,rgba:[bitmap[at+2],bitmap[at+1],bitmap[at],bitmap[at+3]]};
}
function assertGrid(state,count){
 const square=state.appearance.paneMode==='square',gap=square?1:6;assert.equal(state.gap,gap);assert.equal(state.radius,square?0:12);assert.equal(state.panes.length,count);assert.equal(state.dividers.length,count-1);
 for(const divider of state.dividers)assert.equal(divider.bounds[divider.axis==='x'?'width':'height'],gap,'Every split owns exactly the required CSS pixel seam');
 for(const pane of state.panes){assert.equal(pane.radius,square?0:12);for(const key of ['x','y','width','height'])assert.equal(pane.bounds[key],Math.round(pane.bounds[key]),'DOM pane edges match native integer DIP bounds');}
}
module.exports={tonePage,gridReadback,newTabReadback,toneReadback,rgb,sample,assertGrid};

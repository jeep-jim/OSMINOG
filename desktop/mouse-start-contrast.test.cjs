'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const css=fs.readFileSync(require.resolve('./mouse/start.css'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
// Check the shipped palette itself. This is not a browser cascade/pixel
// simulation; the installed final smoke retains its separate >=7 check.
function rule(selector){
 const result={};let found=false;
 for(const [,selectors,body]of css.matchAll(/([^{}]+)\{([^{}]*)\}/g))if(selectors.split(',').map(value=>value.trim()).includes(selector)){
  found=true;for(const declaration of body.split(';')){const at=declaration.indexOf(':');if(at>=0)result[declaration.slice(0,at).trim()]=declaration.slice(at+1).replace(/!important\s*$/,'').trim();}
 }
 assert.equal(found,true,'Missing shipped selector '+selector);return result;
}
function opaque(value){
 const match=/^#([\da-f]{6})([\da-f]{2})?$/i.exec(value||'');
 assert.ok(match&&(!match[2]||match[2].toLowerCase()==='ff'),'A measured control must own an opaque RGB surface: '+value);
 return[0,2,4].map(at=>parseInt(match[1].slice(at,at+2),16));
}
function luminance(rgb){return rgb.map(value=>value/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);}
function contrast(ink,surface){const a=luminance(opaque(ink)),b=luminance(opaque(surface));return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);}
const engine=':root[data-theme] .home-page .home-search .home-search-engine',submit=':root[data-theme] .home-page .home-search .home-search-submit';

test('both shipped search buttons own opaque surfaces with at least7:1 control contrast',()=>{
 for(const selector of [engine,submit]){const style=rule(selector),ratio=contrast(style.color,style.background);assert.ok(ratio>=7,selector+' contrast '+ratio);}
});

test('the search field and both controls share one opaque surface without losing text contrast',()=>{
 const field=rule('.home-search'),input=rule('.home-search input');opaque(field.background);assert.ok(contrast(input.color,field.background)>=7);
 for(const selector of [engine,submit])assert.deepEqual(opaque(rule(selector).background),opaque(field.background));
});

test('hover and expanded controls retain7:1 contrast while suggestion blur remains separate',()=>{
 for(const [base,state]of [[engine,engine+':hover'],[engine,engine+'[aria-expanded=true]'],[submit,submit+':hover']]){const style={...rule(base),...rule(state)},ratio=contrast(style.color,style.background);assert.ok(ratio>=7,state+' contrast '+ratio);}
 const popup=rule('.home-search-popover');assert.match(popup['backdrop-filter'],/blur\(22px\)/);assert.match(popup['-webkit-backdrop-filter'],/blur\(22px\)/);
});

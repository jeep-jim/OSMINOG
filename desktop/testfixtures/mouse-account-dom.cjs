'use strict';
// A small DOM fixture for shipped controller behavior. Geometry is supplied by
// each test; macOS view bounds and visual layout remain native CI checks.
module.exports=function createDOM(){
 const document={},descendants=node=>node.children.flatMap(child=>[child,...descendants(child)]);
 function simple(node,selector){
  if(node.nodeType!==1)return false;
  const negatives=[...selector.matchAll(/:not\(([^)]+)\)/g)].map(x=>x[1]);selector=selector.replace(/:not\([^)]+\)/g,'');if(negatives.some(x=>simple(node,x)))return false;
  const plain=selector.replace(/\[[^\]]*\]/g,''),tag=/^[a-z][\w-]*/i.exec(plain);if(tag&&node.tagName!==tag[0].toUpperCase())return false;
  for(const match of plain.matchAll(/([.#])([\w-]+)/g))if(match[1]==='#'?node.id!==match[2]:!node.className.split(/\s+/).includes(match[2]))return false;
  for(const match of selector.matchAll(/\[([\w-]+)(?:=["']?([^\]"']*)["']?)?\]/g))if(match[2]===undefined?!node.hasAttribute(match[1]):node.getAttribute(match[1])!==match[2])return false;
  return true;
 }
 function matches(node,selector){return selector.split(',').some(item=>{const parts=item.trim().split(/\s+(?![^[]*\])/);if(!simple(node,parts.pop()))return false;for(const part of parts.reverse()){let parent=node.parentElement;while(parent&&!simple(parent,part))parent=parent.parentElement;if(!parent)return false;node=parent;}return true;});}
 class Element{
  constructor(tag){this.nodeType=1;this.tagName=tag.toUpperCase();this.localName=tag.toLowerCase();this.children=[];this.parentElement=null;this.attrs={};this.dataset={};this.id='';this.className='';this.checked=false;this.events=new Map();this.clientWidth=1200;const styles=new Map();this.style={setProperty:(key,value)=>styles.set(key,String(value)),getPropertyValue:key=>styles.get(key)||'',removeProperty:key=>styles.delete(key)};}
  setAttribute(key,value){this.attrs[key]=String(value);if(key==='id')this.id=String(value);if(key==='class')this.className=String(value);if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,l)=>l.toUpperCase())]=String(value);if(key==='value')this.value=String(value);}
  getAttribute(key){return key.startsWith('data-')?(this.dataset[key.slice(5).replace(/-([a-z])/g,(_,l)=>l.toUpperCase())]??null):(this.attrs[key]??null);}hasAttribute(key){return this.getAttribute(key)!==null;}removeAttribute(key){delete this.attrs[key];}
  get type(){return this.getAttribute('type')||'';}set type(value){this.setAttribute('type',value);}get hidden(){return this.hasAttribute('hidden');}set hidden(v){v?this.setAttribute('hidden',''):this.removeAttribute('hidden');}
  get disabled(){return this.hasAttribute('disabled');}set disabled(v){v?this.setAttribute('disabled',''):this.removeAttribute('disabled');}
  get open(){return this.hasAttribute('open');}set open(v){v?this.setAttribute('open',''):this.removeAttribute('open');}
  get value(){return this._value||'';}set value(v){this._value=String(v);}get isConnected(){return !!this.closest('body');}
  get textContent(){return this.children.map(node=>node.nodeType===3?node.data:node.textContent).join('');}set textContent(v){this.replaceChildren({nodeType:3,data:String(v),children:[],parentElement:null});}
  append(...nodes){for(const node of nodes){if(node.parentElement)node.parentElement.children=node.parentElement.children.filter(child=>child!==node);node.parentElement=this;this.children.push(node);}}
  replaceChildren(...nodes){for(const node of this.children)node.parentElement=null;this.children=[];this.append(...nodes);}
  set innerHTML(value){this.replaceChildren();const stack=[this],voids=new Set(['input','br','img']);for(const token of String(value).match(/<[^>]*>|[^<]+/g)||[]){if(token.startsWith('</')){stack.pop();continue;}if(!token.startsWith('<')){stack.at(-1).append({nodeType:3,data:token,children:[],parentElement:null});continue;}const match=/^<([\w-]+)([^>]*)>/.exec(token);if(!match)continue;const el=new Element(match[1]);for(const attr of match[2].matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s=]+)))?/g))el.setAttribute(attr[1],attr[2]??attr[3]??attr[4]??'');stack.at(-1).append(el);if(!voids.has(match[1])&&!token.endsWith('/>'))stack.push(el);}}
  querySelectorAll(selector){return descendants(this).filter(node=>matches(node,selector));}querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  closest(selector){for(let node=this;node;node=node.parentElement)if(matches(node,selector))return node;return null;}
  addEventListener(type,fn){if(!this.events.has(type))this.events.set(type,[]);this.events.get(type).push(fn);}
  dispatch(type,event={}){for(const fn of this.events.get(type)||[])fn({target:this,...event});}
  focus(){document.activeElement=this;}show(){this.open=true;}close(){this.open=false;this.dispatch('close');}
  getBoundingClientRect(){return this.rect||{x:600,y:100,width:420,height:650,left:600,right:1020,top:100,bottom:750};}
 }
 document.body=new Element('body');document.documentElement=new Element('html');document.createElement=tag=>new Element(tag);document.querySelector=selector=>document.body.querySelector(selector);document.querySelectorAll=selector=>document.body.querySelectorAll(selector);return document;
};

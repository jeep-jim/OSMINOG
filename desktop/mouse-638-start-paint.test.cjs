'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const nodes=new Map(),writes=[],tileCalls=[];let language='ru';
 function node(name){return{name,children:[],style:{},dataset:{},textContent:'',isConnected:true,querySelector:selector=>get(name+' '+selector),setAttribute(){},append(...values){this.children.push(...values);},replaceChildren(...values){writes.push(name);this.children=values;}};}
 function get(name){if(!nodes.has(name))nodes.set(name,node(name));return nodes.get(name);}
 const root=get('root');root.querySelector=get;const items=[{id:'a',url:'https://a.example.invalid',title:'First'},{id:'b',url:'https://b.example.invalid',title:'Second'}];
 const data={preferences:{background:'aurora',showRecent:true},bookmarks:{items,total:2},recent:[items[0]],search:{name:'Google',engine:'google'}};
 const context=vm.createContext({data,currentTabs:()=>[],locale:()=>language,tr:(ru,en)=>language==='en'?en:ru,button:(_label,_action,cls)=>node(cls),make:(tag,cls,text)=>Object.assign(node(cls),{textContent:text}),tile:(item,pane,recent)=>{const result={...item,pane,recent};tileCalls.push(result);return result;}});
 const source=fs.readFileSync(require.resolve('./mouse/start.js'),'utf8'),start=source.indexOf(' function paintTabs('),end=source.indexOf('\n async function refresh(',start);assert.ok(start>=0&&end>start);vm.runInContext(source.slice(start,end),context);
 const info={pane:'p3',items:[]};return{data,root,info,nodes,get,writes,tileCalls,paint:items=>context.paint(root,info,items),locale:value=>language=value};
}

test('unchanged library notifications preserve bookmark/recent controls and decoded icon owners',()=>{
 const f=fixture();f.paint();const bookmarks=f.get('.favorites-grid').children,first=bookmarks[0],recent=f.get('.recent-grid').children;
 assert.equal(bookmarks.length,3);assert.equal(recent.length,1);assert.equal(f.tileCalls.length,3);f.writes.length=0;
 for(let i=0;i<30;i++){f.data.bookmarks.items=f.data.bookmarks.items.map(item=>({...item}));f.data.recent=f.data.recent.map(item=>({...item}));f.paint();}
 assert.equal(f.get('.favorites-grid').children,bookmarks);assert.equal(f.get('.favorites-grid').children[0],first);assert.equal(f.get('.recent-grid').children,recent);assert.deepEqual(f.writes,[]);assert.equal(f.tileCalls.length,3);
});

test('real changes update their own lists, pagination and language without suppressing background preferences',()=>{
 const f=fixture();f.paint();const bookmarks=f.get('.favorites-grid').children;f.writes.length=0;
 f.data.recent=[{id:'c',url:'https://c.example.invalid',title:'Recent visit'}];f.paint();assert.equal(f.get('.favorites-grid').children,bookmarks);assert.deepEqual(f.writes,['.recent-grid']);
 f.data.bookmarks.items=[{...f.data.bookmarks.items[0],title:'Changed title'},f.data.bookmarks.items[1]];f.paint();assert.equal(f.get('.favorites-grid').children[0].title,'Changed title');
 const more={id:'d',url:'https://d.example.invalid',title:'More'};f.data.bookmarks.total=3;f.paint([...f.data.bookmarks.items,more]);assert.equal(f.get('.favorites-grid').children.length,4);assert.equal(f.info.items.at(-1).id,'d');assert.equal(f.get('.home-more').hidden,true);
 f.locale('en');f.paint();assert.equal(f.get('.home-favorites-title').textContent,'Favorites');assert.equal(f.get('.favorites-grid').children.at(-1).children[1].textContent,'Add website');
 f.data.preferences.background='custom';f.data.backgroundData='data:image/png;base64,owned-fixture';f.paint();assert.equal(f.root.dataset.background,'custom');assert.match(f.root.style.backgroundImage,/owned-fixture/);f.data.preferences.background='plain';f.paint();assert.equal(f.root.style.backgroundImage,'');
});

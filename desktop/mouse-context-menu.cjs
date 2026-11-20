'use strict';
// Mouse-only native context menu. Generic desktop products continue to use the
// unchanged context-menu.cjs template. No web page receives this privileged API.
const {webURL}=require('./mouse-library.cjs');
const Layout=require('./mouse/layout.js');
const GRID=Object.freeze([{count:1},{count:2,axis:'x'},{count:2,axis:'y'},{count:3},{count:4},{count:6},{count:8},{count:9},{count:12}]);
const EN=Object.freeze({'Открыть ссылку в новой вкладке':'Open link in new tab','Копировать адрес ссылки':'Copy link address','Сохранить файл по ссылке…':'Save linked file…','Копировать изображение':'Copy image','Копировать адрес изображения':'Copy image address','Сохранить изображение как…':'Save image as…','Копировать адрес медиа':'Copy media address','Сохранить медиа как…':'Save media as…','Добавить на рабочий стол':'Add to workspace','Прикрепить к чату':'Attach to chat','Отменить':'Undo','Повторить':'Redo','Вырезать':'Cut','Копировать':'Copy','Вставить':'Paste','Выделить всё':'Select all','Назад':'Back','Вперёд':'Forward','Обновить':'Reload'});
function distance(x,y,line){const [a,b]=line,dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/length)):0;return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);}
function inside(x,y,points){let yes=false;for(let i=0,j=points.length-1;i<points.length;j=i++)if((points[i][1]>y)!==(points[j][1]>y)&&x<(points[j][0]-points[i][0])*(y-points[i][1])/(points[j][1]-points[i][1])+points[i][0])yes=!yes;return yes;}
function iconBitmap(kind,{count=4,axis='x',filled=false}={}){
 const lines=[],star=[],line=(x1,y1,x2,y2)=>lines.push([[x1,y1],[x2,y2]]),box=(x,y,w,h)=>{line(x,y,x+w,y);line(x+w,y,x+w,y+h);line(x+w,y+h,x,y+h);line(x,y+h,x,y);};
 if(kind==='star'){for(let i=0;i<10;i++){const angle=-Math.PI/2+i*Math.PI/5,r=i%2?3:6.4;star.push([8+Math.cos(angle)*r,8+Math.sin(angle)*r]);}for(let i=0;i<10;i++)lines.push([star[i],star[(i+1)%10]]);}
 else{box(1.8,2.5,12.4,11);if(kind==='split-x'||kind==='split-y'){if(kind==='split-x'){line(8,2.5,8,13.5);line(9.5,8,12.5,8);line(11,6.5,11,9.5);}else{line(1.8,8,14.2,8);line(6.5,10.75,9.5,10.75);line(8,9.25,8,12.25);}}
  else{const tree=Layout.preset(count);if(count===2&&axis==='y')tree.axis='y';const draw=(node,x,y,w,h)=>{if(node.id)return;if(node.axis==='x'){const cut=w*node.ratio;line(x+cut,y,x+cut,y+h);draw(node.a,x,y,cut,h);draw(node.b,x+cut,y,w-cut,h);}else{const cut=h*node.ratio;line(x,y+cut,x+w,y+cut);draw(node.a,x,y,w,cut);draw(node.b,x,y+cut,w,h-cut);}};draw(tree,1.8,2.5,12.4,11);}}
 // Four coverage samples per axis for each 2x bitmap pixel. Electron's
 // CreateFromBitmap consumes N32 premultiplied alpha; transparent RGB stays zero.
 // Equal RGB channels avoid platform colour-order differences. macOS templates
 // use the native tint; Windows and Linux retain this neutral gray.
 const width=32,height=32,samples=4,data=Buffer.alloc(width*height*4),stroke=kind==='star'?.52:.45;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){let covered=0;for(let sy=0;sy<samples;sy++)for(let sx=0;sx<samples;sx++){const px=(x+(sx+.5)/samples)/2,py=(y+(sy+.5)/samples)/2;if(lines.some(segment=>distance(px,py,segment)<=stroke)||filled&&star.length&&inside(px,py,star))covered++;}const at=(y*width+x)*4,alpha=Math.round(255*covered/(samples*samples));data[at]=data[at+1]=data[at+2]=Math.round(128*alpha/255);data[at+3]=alpha;}
 return{data,width,height,scaleFactor:2};
}
function icons(nativeImage,platform=process.platform){const cache=new Map();return(kind,options={})=>{const key=JSON.stringify([kind,options]);if(!cache.has(key)){const bitmap=iconBitmap(kind,options),image=nativeImage.createFromBitmap(bitmap.data,{width:bitmap.width,height:bitmap.height,scaleFactor:bitmap.scaleFactor});if(platform==='darwin')image.setTemplateImage(true);cache.set(key,image);}return cache.get(key);};}
function paneIds(preferences){try{return Layout.leaves(Layout.validate(preferences.tree));}catch{return [];}}
function args(value,bounds){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['id','pane','x','y'].includes(key))||!['x','y'].every(key=>Number.isFinite(value[key])&&value[key]>=0&&value[key]<(key==='x'?bounds.width:bounds.height))||value.id!==undefined&&(typeof value.id!=='string'||value.id.length>100)||value.pane!==undefined&&(typeof value.pane!=='string'||value.pane!==''&&!/^p\d{1,8}$/.test(value.pane)))throw Error('Некорректная цель контекстного меню');return{id:value.id||'',pane:value.pane||'',x:Math.min(Math.floor(bounds.width)-1,Math.round(value.x)),y:Math.min(Math.floor(bounds.height)-1,Math.round(value.y))};}
function gridLabel(item,en){if(item.count===2)return en?'2 panes · '+(item.axis==='x'?'side by side':'stacked'):'2 окна · '+(item.axis==='x'?'рядом':'друг над другом');return en?item.count+' '+(item.count===1?'pane':'panes'):item.count+' '+(item.count===1?'окно':item.count<=4?'окна':'окон');}

async function install({win,browser,store,library,ipcMain,trusted,notify=()=>{},Menu,nativeImage,platform=process.platform}){
 if(!Menu||!nativeImage){const electron=require('electron');Menu??=electron.Menu;nativeImage??=electron.nativeImage;}
 // Keep the shell reference while the native window is alive. The window's
 // webContents getter may throw from its closed event, before guest disposal.
 const shellContents=win.webContents,stored=(await store.get('quadroPreferences')).quadroPreferences||{},icon=icons(nativeImage,platform);let disposed=false,generation=0,lastMenu=null,lastTarget=null;
 const preferences=()=>browser.mouseDesktops?.preferences?.()||browser.mouseDesktops?.bank?.preferences?.()||stored;
 const frame=()=>{try{const value=shellContents.mainFrame;return{processId:value.processId,routingId:value.routingId};}catch{return null;}};
 const current=()=>!disposed&&!browser.disposed&&!win.isDestroyed()&&!shellContents.isDestroyed();
 const report=error=>{if(current())shellContents.send('browser:error',String(error?.message||error));};
 function invalidate(){generation++;try{lastMenu?.closePopup(win);}catch{}}
 shellContents.on('did-start-navigation',invalidate);
 function resolve(input,source,nativePage){
  if(!current())return null;const bank=browser.mouseDesktops?.bank,p=preferences(),panes=paneIds(p),state=browser.state();if(!bank?.active||!panes.length||state.desktopId!==bank.active)return null;
  let id=input.id||'',pane=input.pane||'';if(pane&&!panes.includes(pane))return null;
  if(!id){if(!pane)pane=panes.includes(p.active)?p.active:panes[0];id=p.slots?.[pane]||'';}
  const tab=id?state.tabs.find(tab=>tab.id===id):null;if(id&&(!tab||bank.members[id]!==bank.active))return null;
  if(pane&&(p.slots?.[pane]||'')!==id)return null;
  if(!pane&&tab?.lane!=='side')pane=panes.find(key=>p.slots?.[key]===id)||'';
  const native=id?browser.tabs.get(id)||[...browser.providers.values()].find(tab=>tab.id===id):null;
  if(nativePage&&(native!==nativePage||native.project!==browser.project||native.view.webContents.isDestroyed()||source==='guest'&&(!native.visible||!native.view.getVisible())))return null;
  const url=native?.view.webContents.getURL()||tab?.url||'',epoch=native?.navigationEpoch||0;
  return{id,pane,desk:bank.active,source,project:browser.project,bank,frame:frame(),generation,native,epoch,url,lane:tab?.lane||'main',title:native?.title||tab?.title||url,internal:!!tab?.internal,panes:panes.length};
 }
 function valid(target){
  if(!current()||target.generation!==generation||target.project!==browser.project||target.bank!==browser.mouseDesktops?.bank||target.desk!==target.bank.active)return false;
  const now=frame();if(!now||!target.frame||now.processId!==target.frame.processId||now.routingId!==target.frame.routingId)return false;
  const resolved=resolve({id:target.id,pane:target.pane},target.source,target.native);return!!resolved&&resolved.id===target.id&&resolved.pane===target.pane&&resolved.url===target.url&&resolved.native===target.native&&resolved.epoch===target.epoch;
 }
 const guarded=(target,work)=>()=>{if(!valid(target))return;try{Promise.resolve(work()).catch(report);}catch(error){report(error);}};
 function template(target,legacy=[]){
  const en=preferences().locale==='en',url=target.internal?'':webURL(target.url),saved=!!url&&library.data.bookmarks.some(row=>row.url===url),canLayout=target.lane!=='side',emit=(action,extra={})=>shellContents.send('mouse:context-action',{id:target.id,pane:target.pane,action,...extra});
  const bookmark={id:'mouse-context-bookmark',label:en?(saved?'Already in favorites':'Add to favorites'):(saved?'Уже в избранном':'Добавить в избранное'),icon:icon('star',{filled:saved}),enabled:!!url&&!saved,click:guarded(target,async()=>{if(!url||library.data.bookmarks.some(row=>row.url===url))return;library.bookmark(url,target.title);if(target.native?.favicon)library.favicon(url,target.native.favicon);await library.flush();notify();})};
  const items=[bookmark,{type:'separator'},{id:'mouse-context-split-x',label:en?'Split to the right':'Разделить справа',icon:icon('split-x'),enabled:canLayout&&target.panes<Layout.LIMIT,click:guarded(target,()=>emit('split-x'))},{id:'mouse-context-split-y',label:en?'Split below':'Разделить снизу',icon:icon('split-y'),enabled:canLayout&&target.panes<Layout.LIMIT,click:guarded(target,()=>emit('split-y'))},{id:'mouse-context-grid',label:en?'Pane layout':'Расположение окон',icon:icon('grid',{count:4}),enabled:canLayout,submenu:GRID.map(item=>({id:'mouse-context-layout-'+item.count+(item.axis?'-'+item.axis:''),label:gridLabel(item,en),icon:icon('grid',item),enabled:canLayout,click:guarded(target,()=>emit('layout',item))}))}];
  if(legacy.length){items.push({type:'separator'});for(const item of legacy)items.push({...item,...(en&&item.label?{label:EN[item.label]||item.label}:{}),...(typeof item.click==='function'?{click:guarded(target,item.click)}:{})});}
  return items;
 }
 function popup(input,source,legacy=[],nativePage){const target=resolve(input,source,nativePage);if(!target)return{shown:false};invalidate();target.generation=generation;const menu=Menu.buildFromTemplate(template(target,legacy));lastMenu=menu;lastTarget={id:target.id,pane:target.pane,desk:target.desk,source};const options={window:win};if(source==='shell'){options.x=input.x;options.y=input.y;}menu.popup(options);return{shown:true,id:target.id,pane:target.pane};}
 const previousContext=browser.mouseContextMenu;browser.mouseContextMenu=(page,params,legacy)=>{try{return popup({id:page.id},'guest',legacy,page);}catch(error){report(error);return{shown:false};}};
 ipcMain.handle('mouse:context-menu',(event,value)=>{trusted(event);if(!current())throw Error('Окно закрыто');const input=args(value,win.getContentBounds());return popup(input,'shell');});
 const originalDispose=browser.dispose.bind(browser);browser.dispose=(...values)=>{dispose();return originalDispose(...values);};
 function dispose(){if(disposed)return;disposed=true;invalidate();shellContents.removeListener('did-start-navigation',invalidate);if(browser.mouseContextMenu!==previousContext)browser.mouseContextMenu=previousContext;ipcMain.removeHandler?.('mouse:context-menu');}
 return{get lastMenu(){return lastMenu;},get lastTarget(){return lastTarget?{...lastTarget}:null;},dispose};
}
module.exports={install,GRID,iconBitmap,args};

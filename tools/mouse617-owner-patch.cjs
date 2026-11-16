'use strict';
// One-use patch for the owner-approved candidate branch only; remove before merge.
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const base='29af3eaa16e07a395a8806e963021a21994aa700';
cp.execFileSync('git',['merge-base','--is-ancestor',base,'HEAD']);
const edited=new Map();
function replace(path,old,value,count=1){const s=edited.has(path)?edited.get(path):fs.readFileSync(path,'utf8');assert.equal(s.split(old).length-1,count,'Unexpected source: '+path+' '+old);edited.set(path,s.split(old).join(value))}
replace('desktop/mouse/mouse-616-ui.js','?8:0','?10:0',2);
replace('desktop/browser.cjs','const bounds={x:Math.round(x),y:Math.round(y),width:Math.round(w),height:Math.round(h)};','// Snap shared endpoints for Mouse to avoid one-pixel rims at fractional layouts.\n   const bounds=this.mouseRoundedPanes?{x:Math.round(x),y:Math.round(y),width:Math.round(x+w)-Math.round(x),height:Math.round(y+h)-Math.round(y)}:{x:Math.round(x),y:Math.round(y),width:Math.round(w),height:Math.round(h)};');
replace('desktop/browser.cjs','Number(p.roundBottom)===8&&bottom===bounds.y+bounds.height?8:0','Number(p.roundBottom)===10&&bottom===bounds.y+bounds.height?10:0');
replace('desktop/browser.cjs','filter(p=>p.radius===8)','filter(p=>p.radius===10)');
replace('desktop/mouse-native-menu.mm','CGFloat radius=8,y=NSMaxY(p)-radius;','CGFloat radius=10,y=NSMaxY(p)-radius;');
replace('desktop/mouse-native-menu.mm','a[2]<16||a[3]<16','a[2]<20||a[3]<20');
replace('desktop/mouse/mouse-616.css','border-radius:7px','border-radius:10px',2);
replace('desktop/mouse/mouse-613.css','.pane-head .pane-address{min-width:0;flex:1}','.pane-head .pane-address{min-width:0;flex:1;margin-right:8px}');
replace('desktop/mouse/mouse-613.css','.pane-head.address-editing>.pane-address{position:absolute;inset:2px 4px;z-index:10;display:flex;background:var(--panel)}','.pane-head.address-editing>.pane-address{position:relative;inset:auto;z-index:auto;display:flex;background:transparent}');
replace('desktop/mouse/mouse-613.css','.pane-head.address-editing>:not(.pane-address){visibility:hidden;pointer-events:none}','/* Editing must never hide or cover navigation, fullscreen or close. */\n.pane-head,.pane-head button,.pane-head input,.pane-head form{-webkit-app-region:no-drag}\n.ai-provider{margin-right:8px}');
replace('desktop/mouse/mouse-613-ui.js','  function swapTabs(a,b){',`  // Native guest focus can leave document.activeElement in the shell. Clear
  // only editing presentation, without consuming the next control click.
  function endAddressEditing(target){
   if(target?.closest?.('#address-suggestions'))return;
   for(const head of document.querySelectorAll('.pane-head.address-editing')){
    const input=head.querySelector('.pane-address input');if(target===input)continue;
    head.classList.remove('address-editing');if(document.activeElement===input)input.blur();
   }
  }
  document.addEventListener('pointerdown',e=>endAddressEditing(e.target),true);
  window.addEventListener('blur',()=>{endAddressEditing(null);hideHints();});
  function swapTabs(a,b){`);
replace('desktop/mouse/browser.js',"im.src=m.privateMode?privateArtwork():'brand.png';","im.src=m.privateMode&&m.theme==='dark'?'mouse-head-dark.svg':'mouse-head.svg';");
replace('desktop/mouse/browser.js',"setStatus('ИИ открыт как отдельная веб-страница')","setStatus('')");
replace('desktop/mouse/browser.js',"document.querySelectorAll('.private-mascot,.private-logo').forEach(im=>{im.src=privateArtwork()});","document.querySelectorAll('.private-mascot').forEach(im=>{im.src=privateArtwork()});document.querySelectorAll('.private-logo').forEach(im=>{im.src=theme==='light'?'mouse-head.svg':'mouse-head-dark.svg'});document.querySelector('link[rel=icon]').href=theme==='light'?'mouse-head.svg':'mouse-head-dark.svg';");
replace('desktop/mouse/index.html','<title>Mouse Browser</title>','<title>Mouse Browser</title><link rel="icon" type="image/svg+xml" href="mouse-head.svg">');
replace('desktop/mouse/index.html','title="Настройки Mouse Browser"><img src="brand.png"','title="Настройки Mouse Browser"><img src="mouse-head.svg"');
const cssPath='desktop/mouse/mouse-615.css',oldCss=fs.readFileSync(cssPath,'utf8'),marker='/* Keep the three original controls intact,';
assert.equal(oldCss.split(marker).length,2);assert.ok(oldCss.includes('width:28px;height:30px'));
edited.set(cssPath,`/* Owner's grounded burrow. Curved feet are tangent to the toolbar line. */
:root{--burrow-plus:#8b9098}
:root[data-theme] .toolbar>#new-tab{
 width:36px;height:32px;min-height:32px;flex:0 0 36px;padding:5px 6px 2px;
 align-self:flex-end;margin-bottom:-4px;display:grid;place-items:center;overflow:visible;
 border:0;border-bottom:0;border-radius:0;background:transparent url("burrow.svg") center/100% 100% no-repeat!important;
 box-shadow:none!important;filter:none!important;backdrop-filter:none;-webkit-backdrop-filter:none;
 -webkit-app-region:no-drag;transition:none;
}
#new-tab .burrow-plus{display:block;width:12px;height:12px;color:var(--burrow-plus);pointer-events:none;opacity:0;transition:opacity .12s ease;shape-rendering:auto}
:root[data-theme] .toolbar>#new-tab:hover{background:transparent url("burrow.svg") center/100% 100% no-repeat!important;box-shadow:none!important}
#new-tab:hover .burrow-plus{opacity:1}
#new-tab:focus-visible .burrow-plus{opacity:1}
#new-tab:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
@media(prefers-reduced-motion:reduce){#new-tab .burrow-plus{transition:none}}
`+marker+oldCss.split(marker)[1]);
replace('desktop/mouse-build.cjs',"version:'6.0.16'","version:'6.0.17'");
replace('desktop/mouse-build.cjs',"'mouse-616-smoke.cjs'","'mouse-616-smoke.cjs','mouse-617-smoke.cjs'");
replace('desktop/mouse-smoke.cjs',"app.getVersion(),'6.0.16'","app.getVersion(),'6.0.17'");
replace('desktop/mouse-smoke.cjs',"await require('./mouse-616-smoke.cjs')({app,win,browser,store,globalCapture});","await require('./mouse-616-smoke.cjs')({app,win,browser,store,globalCapture});\n  if(!process.argv.includes('--mouse-smoke-read'))await require('./mouse-617-smoke.cjs')({win,browser});");
replace('desktop/mouse-616.test.cjs','bottom:8','bottom:10',2);
replace('desktop/mouse-616.test.cjs','top:8','top:10',2);
replace('desktop/mouse-616.test.cjs','roundBottom:8','roundBottom:10',3);
replace('desktop/mouse-616.test.cjs','/#ai-panel.*border-radius:(?:8|10|12)px/','/#ai-panel\\s*\\{[^}]*border-radius:(?:8|10|12)px/');
replace('desktop/mouse-616-smoke.cjs',"[['0px','8px'],['8px','0px'],['0px','8px'],['8px','0px']]","[['0px','10px'],['10px','0px'],['0px','10px'],['10px','0px']]");
replace('desktop/mouse-616-smoke.cjs','const samples={inside:','const samples={cutExact10:rgb(ids[0],3,p.height-2),inside:');
replace('desktop/mouse-616-smoke.cjs','pink(samples.inside)&&!pink(samples.cutLeft)','pink(samples.inside)&&!pink(samples.cutExact10)&&!pink(samples.cutLeft)');
replace('desktop/mouse-615.test.cjs','assert.match(css,/border-radius:14px 14px 0 0/);','assert.match(css,/burrow\\.svg/);assert.match(css,/margin-bottom:-4px/);assert.match(css,/width:12px;height:12px/);assert.match(css,/pointer-events:none;opacity:0/);');
replace('desktop/mouse-615-smoke.cjs',"assert.deepEqual(look.r,[28,30]);assert.equal(look.round,'14px');","assert.deepEqual(look.r,[36,32]);assert.equal(look.round,'0px');");
replace('desktop/mouse-615-smoke.cjs',"assert.equal(look.opacity,'1');","assert.equal(look.opacity,'0');");
replace('desktop/mouse-615-smoke.cjs',`await move('#version-button');assert.equal(await js('getComputedStyle(document.querySelector(".burrow-plus")).opacity'),'1');`,`await move('#version-button');assert.equal(await js('getComputedStyle(document.querySelector(".burrow-plus")).opacity'),'0');`);
replace('desktop/mouse-613-smoke.cjs',"assert.ok(editing.input>=editing.width-9);assert.ok(editing.left<=5);assert.equal(editing.title,'none');assert.equal(editing.hidden,true);","assert.ok(editing.input>0&&editing.input<editing.width-80);assert.ok(editing.left>=60);assert.equal(editing.title,'none');assert.equal(editing.hidden,false);");
replace('desktop/mouse-611-smoke.cjs',"querySelectorAll('.private-mascot,.private-logo')","querySelectorAll('.private-mascot')");
replace('desktop/mouse-611-smoke.cjs','assert.ok(result.art.length>=3);assert.equal(result.tab,src);assert.equal(result.pane,src);',"assert.ok(result.art.length>=1);assert.equal(result.tab,light?'mouse-head.svg':'mouse-head-dark.svg');assert.equal(result.pane,light?'mouse-head.svg':'mouse-head-dark.svg');");
const pixels=['0011100000000011100','0111110000000111110','1111111000001111111','1111111000001111111','1111111000001111111','0111110000000111110','0011100000000011100','0000100110110010000','0010100110110010100','0001100000000011000','1010110000000110101','0001010000000101000','0010001000001100100','0100001000011000010','0000011100110000000','0000011111100000000','0000011100000000000'];
assert.equal(pixels.join('').replace(/0/g,'').length,128);
const d=pixels.flatMap((row,y)=>[...row].flatMap((v,x)=>v==='1'?[`M${x} ${y}h1v1h-1z`]:[])).join('');
const files={
 'desktop/mouse/mouse-head.json':JSON.stringify({source:'Owner screenshot image(20261116-095932).png, selected 304 x 272 Figma artwork',sourceSHA256:'3956dacc902c88eca6971846d700bbbff8eb0d58b1b77c6b2eaae0c33b719d73',width:19,height:17,filledPixels:128,pixels},null,2)+'\n',
 'desktop/mouse/mouse-head.svg':`<svg xmlns="http://www.w3.org/2000/svg" width="19" height="17" viewBox="0 0 19 17" shape-rendering="crispEdges"><path fill="#000000" d="${d}"/></svg>\n`,
 'desktop/mouse/mouse-head-dark.svg':`<svg xmlns="http://www.w3.org/2000/svg" width="19" height="17" viewBox="0 0 19 17" shape-rendering="crispEdges"><path fill="#ffffff" d="${d}"/></svg>\n`,
 'desktop/mouse/burrow.svg':'<svg xmlns="http://www.w3.org/2000/svg" width="36" height="32" viewBox="0 0 36 32"><defs><linearGradient id="depth" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#030406"/><stop offset=".6" stop-color="#14171c"/><stop offset="1" stop-color="#4d535d"/></linearGradient></defs><path fill="url(#depth)" d="M0 32C5 32 7 29 7 24V15C7 7 11 1 18 1S29 7 29 15V24C29 29 31 32 36 32Z"/><path fill="none" stroke="#59616e" stroke-width=".8" d="M0 32C5 32 7 29 7 24V15C7 7 11 1 18 1S29 7 29 15V24C29 29 31 32 36 32"/></svg>\n'
};
for(const [p,s]of Object.entries(files)){assert.equal(fs.existsSync(p),false,'Do not overwrite '+p);edited.set(p,s)}
const heading='## 16 ноября 2026 — кандидат 6.0.17: уточнение нижней панели и точная морда';
const roadmap=fs.readFileSync('MOUSE_BROWSER_ROADMAP.md','utf8');assert.ok(!roadmap.includes(heading));
edited.set('MOUSE_BROWSER_ROADMAP.md',roadmap+'\n'+heading+'\n\nПрямое уточнение владельца: нижнюю панель Mouse Browser, название, версию и служебные кнопки НЕ удалять. Заменить только маленький значок перед названием на его собственную пиксельную морду без хвоста. Удаляется только успешное информационное сообщение «ИИ открыт как отдельная веб-страница», ошибки остаются видимыми.\n\nПодготовлены 10 px для внутренних горизонтальных стыков, нативных вырезов и элементов шапок; постоянный отступ адреса от полного экрана; адрес больше не перекрывает и не отключает соседние кнопки; окончание редактирования не поглощает следующий клик. Координаты нативных страниц округляются по общим границам, а не независимо по ширине, чтобы не оставлять пиксельную полосу.\n\nМаленький логотип перенесён с предоставленного изображения владельца: 19×17 клеток, 128 заполненных, маска и SHA исходного изображения сохранены. Используется в нижней панели, собственных вкладках, компактных значках и собственном favicon оболочки; чужие favicon не меняются. Большой маскот, очки и Dock сохранены. Норка примыкает к линии, имеет плавные нижние сопряжения и серо-чёрный градиент; серый плюс 12 px виден только при наведении или клавиатурном фокусе.\n\nЛокальная проверка HTML-оболочки в Chromium с заглушкой native-моста прошла в обеих темах: радиусы 10 px, фактический зазор 10 px, повторные фокус/ввод/перезагрузка, настройки и сохранённый footer. Это не нативная проверка Mac и не публикация. Добавлены отдельные регрессионные и нативные проверки 6.0.17. На момент этой записи кандидат НЕ опубликован, активный канал остаётся 6.0.16. Требуется успешная macOS-проверка и отдельная публикация проверенных байтов. Профиль и другие платформы не меняются.\n');
// Validate all expected matches before writing any replacement.
for(const [p,s] of edited)fs.writeFileSync(p,s);
console.log('Applied owner-scoped patch to '+edited.size+' files; release channel untouched.');

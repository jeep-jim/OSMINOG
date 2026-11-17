'use strict';
// One-use candidate-only patch, removed before release. No user profile access.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const blob=p=>{const b=fs.readFileSync(p);return crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex')};
for(const [p,sha]of Object.entries({'desktop/mouse/browser.js':'73b7dfa57da8b87fed193d857337f92220b3a005','desktop/mouse/desktops.js':'c03f3a122826c6b92c6721751a9dd8846c745169','desktop/mouse-621-smoke.cjs':'1f8dcc9d812a7bbf8aa6788cf45dd8285a228647','desktop/mouse-621.test.cjs':'f0ef0691cda4426164779ebc3fe93bcad6e2060e'}))assert.equal(blob(p),sha,'Concurrent source change: '+p);
const edits=new Map();
function replace(p,old,value){const s=edits.get(p)||fs.readFileSync(p,'utf8');assert.equal(s.split(old).length,2,'Expected unique source '+p+' '+old);edits.set(p,s.replace(old,value));}
replace('desktop/mouse/browser.js','let frame=0;function requestLayout(){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>safe(layoutNow))}','let frame=0,layoutTimeout=0;function requestLayout(){if(frame||layoutTimeout)return;const flush=()=>{if(!frame&&!layoutTimeout)return;cancelAnimationFrame(frame);clearTimeout(layoutTimeout);frame=layoutTimeout=0;safe(layoutNow);};frame=requestAnimationFrame(flush);layoutTimeout=setTimeout(flush,16);}');
replace('desktop/mouse-621-smoke.cjs',"await click('#desktops-button');await sleep(100);await fs.writeFile('mouse-621-desktops-'","await click('#desktops-button');await until(()=>js('document.querySelector(\"#desktop-tray\").open&&!document.querySelector(\"#desktop-tray\").hidden'),'paint-ready desktop dialog');await sleep(180);await fs.writeFile('mouse-621-desktops-'");
replace('desktop/mouse-621-smoke.cjs',"await click('#global-zoom-button');await fs.writeFile('mouse-621-zoom-'","await click('#global-zoom-button');await until(()=>js('document.querySelector(\"#global-zoom-panel\").open&&!document.querySelector(\"#global-zoom-panel\").hidden'),'paint-ready zoom dialog');await sleep(120);await fs.writeFile('mouse-621-zoom-'");
const test=String.raw`'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(resolveImage=async()=>({src:'data:image/png;base64,AAAA'})){
 const images=[],calls=[];
 const rect={x:12,y:70,width:320,height:240},slot={getBoundingClientRect:()=>rect};
 const document={querySelectorAll:()=>[{dataset:{pane:'p1'},querySelector:()=>slot}],querySelector:()=>null,
  createElement:()=>({style:{},setAttribute(){},remove(){const i=images.indexOf(this);if(i>=0)images.splice(i,1)}}),body:{append:image=>images.push(image)}};
 const ctx={document,setTimeout,clearTimeout};vm.runInNewContext(fs.readFileSync('mouse/desktops.js','utf8'),ctx);
 const model={state:{tabs:[{id:'visible',internal:false}]},slots:{p1:'visible'},aiOpen:false};
 const N={desktops:async(action,args)=>{assert.equal(action,'thumbnail');assert.equal(args.id,'visible');return resolveImage();},browser:async(action,args)=>{calls.push({action,args});}};
 return{overlay:ctx.mouseFloatingBackdrop(N,model),images,calls,model};
}
test('floating popover hides native inputs without resizing and removes RAM-only previews on close',async()=>{
 const f=fixture();assert.equal(await f.overlay.show('desktops'),true);assert.equal(f.images.length,1);
 assert.equal(f.images[0].style.pointerEvents,'none');assert.equal(f.images[0].style.width,'320px');assert.equal(f.images[0].style.height,'240px');assert.equal(f.images[0].draggable,false);
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].action,'layout');assert.equal(f.calls[0].args.panels.length,0);
 f.overlay.hide('zoom');assert.equal(f.images.length,1,'another popup cannot discard the active background');f.overlay.hide('desktops');assert.equal(f.images.length,0);
});
test('closing before capture finishes rejects stale snapshots and does not hide native pages later',async()=>{
 let resolve;const f=fixture(()=>new Promise(r=>{resolve=r})),pending=f.overlay.show('desktops');f.overlay.hide('desktops');resolve({src:'data:image/png;base64,AAAA'});
 assert.equal(await pending,false);assert.equal(f.images.length,0);assert.equal(f.calls.length,0);
});
test('snapshot errors and invalid image URLs cannot block popover input or execute markup',async()=>{
 for(const value of [null,{src:'https://outside.invalid/track'},{src:'data:text/html,script'}]){
  const f=fixture(async()=>value);assert.equal(await f.overlay.show('zoom'),true);assert.equal(f.images.length,0);assert.equal(f.calls.length,1);f.overlay.hide('zoom');
 }
});
test('desktop and zoom popovers participate in the existing modal native-view gate',()=>{
 const s=fs.readFileSync('mouse/desktops.js','utf8'),browser=fs.readFileSync('mouse/browser.js','utf8');
 assert.match(s,/const tray=document.createElement\('dialog'\)/);assert.match(s,/const box=document.createElement\('dialog'\)/);assert.match(s,/tray\.showModal\(\)/);assert.match(s,/box\.showModal\(\)/);
 assert.match(browser,/dialog\[open\]:not\(\[data-nonmodal\]\)/);assert.doesNotMatch(s,/writeFile|localStorage|sessionStorage|sendBeacon|clipboard/);
});
test('native layout has a bounded fallback and coalesces a burst while RAF is stalled',async()=>{
 const s=fs.readFileSync('mouse/browser.js','utf8'),start=s.indexOf('let frame=0,layoutTimeout=0;'),end=s.indexOf('\n async function layoutNow',start);assert.ok(start>=0&&end>start);
 let calls=0,frames=0;const ctx={requestAnimationFrame:()=>++frames,cancelAnimationFrame(){},setTimeout,clearTimeout,safe:fn=>fn(),layoutNow:()=>calls++};vm.runInNewContext(s.slice(start,end)+';globalThis.layoutProbe=requestLayout',ctx);
 for(let i=0;i<50;i++)ctx.layoutProbe();await new Promise(r=>setTimeout(r,35));assert.equal(calls,1);assert.equal(frames,1);ctx.layoutProbe();await new Promise(r=>setTimeout(r,35));assert.equal(calls,2);
});
`;
assert.equal(fs.existsSync('desktop/mouse-floating-overlay.test.cjs'),false);edits.set('desktop/mouse-floating-overlay.test.cjs',test);
const existing=fs.readFileSync('desktop/mouse-621.test.cjs','utf8');assert.ok(!existing.includes("require('./mouse-floating-overlay.test.cjs')"));edits.set('desktop/mouse-621.test.cjs',existing+"\nrequire('./mouse-floating-overlay.test.cjs');\n");
const heading='## 17 ноября 2026 — 621: проверка нативных кликов и промежуточных кадров';
const roadmap=fs.readFileSync('MOUSE_BROWSER_ROADMAP.md','utf8');assert.ok(!roadmap.includes(heading));edits.set('MOUSE_BROWSER_ROADMAP.md',roadmap+'\n\n'+heading+'\n\nПри возобновлении выпуска выявлены реальные блокеры: долгий ответ layout пропускал промежуточные кадры; на macOS визуальное ограничение родительского View не ограничивало область кликов дочерней страницы. Native-проба44077826907 зафиксировала pointerdown/up/click в веб-странице ниже обрезанного родителя, вместо карточки стола. Анимация теперь ограничивает продвижение одного отображённого кадра32мс; native-проверка подтвердила6 промежуточных положений без изменения viewport.\n\nПанель столов и Т+ используют существующий modal-механизм скрытия нативных страниц. Ограниченные превью текущих видимых страниц находятся только в памяти на время панели, не записываются в архив и не передаются в сеть; при закрытии или отмене удаляются. Сами WebContents не перезагружаются. Изолированная native-проба44079485042 прошла настоящий клик по карточке: события попали в оболочку, стол переключился, дочерняя страница не получила этот клик. Проба использовала ограниченный fallback layout16мс; он перенесён в основной код с отдельной регрессией. Это ещё не полный выпускной прогон.\n\nНорка36×23CSSpx в28px нижней полосе с5px свободного места сверху сохранена. Верхний плюс28×28px, данные/профиль и остальные поручения сохранены. Временные диагностические launcher/workflow должны быть удалены до merge. Полный native621, перенос PNG, приватность, сохранение столов/профиля и обновление620→621 по-прежнему обязательны. Канал на момент записи остаётся620; публикация621 не объявляется завершённой.\n');
for(const[p,s]of edits)fs.writeFileSync(p,s);console.log('Applied guarded overlay and regression patch:',edits.size,'files. Channel untouched.');

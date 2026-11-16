from pathlib import Path
import re,sys,shutil
R=Path(sys.argv[1])
def read(p):return (R/p).read_text()
def write(p,s):
 (R/p).parent.mkdir(parents=True,exist_ok=True);(R/p).write_text(s)
def sub(p,a,b,count=1):
 s=read(p);assert s.count(a)==count,(p,a[:100],s.count(a));write(p,s.replace(a,b))
def regex(p,a,b,n=1):
 s=read(p);s,c=re.subn(a,b,s,flags=re.S);assert c==n,(p,a[:80],c);write(p,s)
for p in ['desktop/mouse-build.cjs','desktop/mouse-browser.test.cjs','desktop/mouse-606.test.cjs','desktop/mouse-smoke.cjs','tools/mouse-verify.py']:
 s=read(p);assert '6.0.15' in s,p;write(p,s.replace('6.0.15','6.0.16'))
html='desktop/mouse/index.html'
regex(html,r'(<button id="new-tab"[^>]*>).*?(</button>)',r'\1<svg class="burrow-plus" width="19" height="18" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 4v12M4 10h12"/></svg>\2')
for a in ['bookmark','split-x','split-y']:regex(html,rf'<button data-pane-action="{a}"[^>]*>.*?</button>','')
s=read(html);button=re.search(r'<button data-action="ai-reload"[^>]*>.*?</button>',s).group();s=s.replace(button,'');s=s.replace('<div class="ai-controls">','<div class="ai-controls">'+button);write(html,s)
regex(html,r'<button data-action="wallet">.*?</button>','')
regex(html,r'<dialog id="wallet-dialog">.*?</dialog>\n','')
sub(html,'<script src="web3.js"></script>','')
sub(html,'<link rel="stylesheet" href="mouse-615.css">','<link rel="stylesheet" href="mouse-615.css"><link rel="stylesheet" href="mouse-616.css">')
sub(html,'<script src="browser.js"></script>','<script src="mouse-616-ui.js"></script><script src="browser.js"></script>')
p='desktop/mouse/mouse-615.css';s=read(p);s=s.replace('burrow-mouse','burrow-plus');s=s.replace('#new-tab:hover .burrow-plus{opacity:0}','#new-tab:hover .burrow-plus{opacity:1}');s=s.replace('shape-rendering:crispEdges','shape-rendering:auto');s=s[:s.index('#footer-library{')]+'''#footer-library{display:flex;align-items:center;gap:2px;flex:none;margin-right:clamp(24px,8vw,120px);border:0;border-radius:0;overflow:visible;background:transparent;box-shadow:none}
@media(max-width:1100px){#footer-library{margin-right:24px}}
@media(max-width:850px){#footer-library{margin-right:12px}}
''';write(p,s)
write('desktop/mouse/mouse-616.css','''/* Scoped Mouse controls: no changes to website/AI content or global header/footer geometry. */
#statusbar #footer-library>button{width:23px;min-width:23px;padding:0;border:1px solid transparent;border-radius:5px;background:var(--glass);box-shadow:inset 0 1px 0 var(--glass-shine)}
#statusbar #footer-library>button:hover{background:var(--hover)}
#stage,#stage .branch,#stage .split{background:var(--line)}
#stage .pane{--pane-round-top:0px;--pane-round-bottom:0px;border-radius:var(--pane-round-top) var(--pane-round-top) var(--pane-round-bottom) var(--pane-round-bottom);overflow:hidden}
#stage .pane-head button,#ai-panel>.ai-controls>button{border-radius:7px}
#stage .pane-address input{border-radius:7px}
.mouse-reload-glyph{display:block;pointer-events:none;transform-origin:center;line-height:1}
button[data-loading=true] .mouse-reload-glyph{animation:mouse-reload-spin .7s linear infinite}
button[data-loading=true]{color:var(--accent)}
button.mouse-reload-feedback{background:var(--selected)!important}
@keyframes mouse-reload-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){button[data-loading=true] .mouse-reload-glyph{animation:none}button[data-loading=true]{box-shadow:inset 0 0 0 1px var(--accent)}}
''')
write('desktop/mouse/mouse-616-ui.js',''' 'use strict';
(function(root){
 function internalCorners(pane,stage){return{top:pane.top>stage.top+1?8:0,bottom:pane.bottom<stage.bottom-1?8:0};}
 function install({model,tab,doc=document,clock=()=>performance.now()}){
  const pulses=new WeakMap();let timer=0;
  const all=()=>[...doc.querySelectorAll('[data-pane-action="reload"],[data-action="reload"],[data-action="ai-reload"]')];
  function state(b){if(b.dataset.action==='ai-reload')return tab(model.aiId);const p=b.closest('.pane');return tab(model.slots[p?.dataset.pane||model.active]);}
  function sync(){
   for(const b of all()){
    if(!b.querySelector('.mouse-reload-glyph')){const glyph=doc.createElement('span');glyph.className='mouse-reload-glyph';glyph.setAttribute('aria-hidden','true');glyph.textContent='↻';b.replaceChildren(glyph);}
    const item=state(b),pulse=(pulses.get(b)||0)>clock(),busy=!!item?.loading;
    b.disabled=!item;b.dataset.loading=String(busy||pulse);b.classList.toggle('mouse-reload-feedback',pulse);b.setAttribute('aria-busy',String(busy));
   }
  }
  function feedback(event){const b=event.target.closest?.('[data-pane-action="reload"],[data-action="reload"],[data-action="ai-reload"]');if(!b||b.disabled)return;pulses.set(b,clock()+500);sync();clearTimeout(timer);timer=setTimeout(sync,520);}
  doc.addEventListener('click',feedback,true);
  function fullscreen(active){for(const b of doc.querySelectorAll('[data-window="zoom"],[data-action="fullscreen"]')){b.textContent=active?'⤡':'⤢';b.setAttribute('aria-pressed',String(!!active));b.title=active?'Выйти из полного экрана · ⌃⌘F':'Полный экран · ⌃⌘F';b.setAttribute('aria-label',b.title);}}
  function round(){const stage=doc.querySelector('#stage'),r=stage.getBoundingClientRect();for(const p of stage.querySelectorAll('.pane')){const c=internalCorners(p.getBoundingClientRect(),r);p.style.setProperty('--pane-round-top',c.top+'px');p.style.setProperty('--pane-round-bottom',c.bottom+'px');}}
  sync();fullscreen(false);return{sync,fullscreen,round,dispose(){clearTimeout(timer);doc.removeEventListener('click',feedback,true);}};
 }
 root.createMouseChromeControls=install;
 if(typeof module!=='undefined')module.exports={internalCorners};
})(typeof globalThis!=='undefined'?globalThis:this);
''')
p='desktop/mouse/browser.js'
sub(p,'let arrangement,aiFocusBusy=false;','let arrangement,chromeControls,nativeFullscreen=false,aiFocusBusy=false;')
sub(p,"const chrome=state=>{document.body.style.setProperty('--chrome-inset',state.inset+'px');requestLayout()}","const chrome=state=>{nativeFullscreen=!!state.fullscreen;chromeControls?.fullscreen(nativeFullscreen);document.body.style.setProperty('--chrome-inset',state.inset+'px');requestLayout()}")
sub(p,"home.mount(p.querySelector('.page-slot'),p.dataset.pane,!item||item.internal);}","home.mount(p.querySelector('.page-slot'),p.dataset.pane,!item||item.internal);}chromeControls?.sync();")
sub(p,"aiPanel.sync();$('#ai-slot .empty')","aiPanel.sync();chromeControls?.sync();$('#ai-slot .empty')")
sub(p,"const panels=[];for(const pane of m.focusAI?[]:document.querySelectorAll('.pane'))","chromeControls?.round();const panels=[];for(const pane of m.focusAI?[]:document.querySelectorAll('.pane'))")
sub(p,"panels.push({id,x:r.x,y:r.y,width:r.width,height:r.height})","panels.push({id,x:r.x,y:r.y,width:r.width,height:r.height,roundBottom:parseInt(pane.style.getPropertyValue('--pane-round-bottom'),10)||0})")
regex(p,r' async function renderWallet\(\).*?\n function renderUpdate', ' function renderUpdate')
regex(p,r' const web3=createMouseWallet\(.*?\n','')
sub(p,"if(name==='wallet')return web3.open();",'')
sub(p,' let pendingState=null;'," chromeControls=createMouseChromeControls({model:m,tab});chromeControls.fullscreen(nativeFullscreen);\n let pendingState=null;")
sub(p,'globalThis.MouseTest={model:m,','globalThis.MouseTest={model:m,chromeControls,')
p='desktop/browser.cjs'
sub(p,"desired.set(t,{bounds:clip?bounds:clipped,clipped,wrap:!!clip});", "const radius=this.mouseRoundedPanes&&t.lane!=='side'&&Number(p.roundBottom)===8&&bottom===bounds.y+bounds.height?8:0;\n   desired.set(t,{bounds:clip?bounds:clipped,clipped,wrap:!!clip||!!radius,radius});")
sub(p,'const {bounds,clipped,wrap}=next;','const {bounds,clipped,wrap,radius}=next;')
sub(p,"const viewBounds=t.clipView?{x:bounds.x-clipped.x,y:bounds.y-clipped.y,width:bounds.width,height:bounds.height}:bounds;", "if(radius&&!t.roundView){t.roundView=new View();t.roundView.setBorderRadius(8);t.clipView.removeChildView(t.view);t.roundView.addChildView(t.view);t.clipView.addChildView(t.roundView)}\n    // Move the upper curved edge outside the clipped page-slot. No rounding below the address bar.\n    // Keep radius nonzero after creation; move unused bottom corners outside the clip instead.\n    const roundBounds=t.roundView?{x:0,y:-8,width:clipped.width,height:clipped.height+8+(radius?0:8)}:null;\n    const viewBounds=t.clipView?{x:bounds.x-clipped.x,y:bounds.y-clipped.y+(t.roundView?8:0),width:bounds.width,height:bounds.height}:bounds;")
sub(p,'JSON.stringify([viewBounds,parentBounds])','JSON.stringify([viewBounds,parentBounds,roundBounds])')
sub(p,'if(t.clipView)t.clipView.setBounds(parentBounds);t.view.setBounds(viewBounds);','if(t.clipView)t.clipView.setBounds(parentBounds);if(t.roundView)t.roundView.setBounds(roundBounds);t.view.setBounds(viewBounds);')
p='desktop/mouse-stability.cjs'
sub(p,'if(t.clipView?.children.includes(t.view))t.clipView.removeChildView(t.view);','if(t.roundView?.children.includes(t.view))t.roundView.removeChildView(t.view);if(t.clipView?.children.includes(t.roundView))t.clipView.removeChildView(t.roundView);if(t.clipView?.children.includes(t.view))t.clipView.removeChildView(t.view);')
for p,needle in [('desktop/mouse-main.cjs',"browser=new (require('./browser.cjs').BrowserWorkspace)(win,store);"),('desktop/mouse-private.cjs',"const browser=new (require('./browser.cjs').BrowserWorkspace)(win,store,{session:ses,privateMode:true});")]:sub(p,needle,needle+'browser.mouseRoundedPanes=true;')
# Remove Mac wallet functionality; never delete or migrate stored user vault files.
for p in list((R/'desktop').glob('mouse-web3*')):p.unlink()
shutil.rmtree(R/'desktop/mouse-wallet-deps');(R/'desktop/mouse/web3.js').unlink()
write('desktop/mouse-page-preload.cjs',"'use strict';\n// Browser pages receive no privileged bridge or injected account provider.\n")
p='desktop/mouse-main.cjs';s=read(p).replace(',web3Service','');s='\n'.join(l for l in s.split('\n') if 'const wallet=' not in l and 'web3Service=' not in l and "ipcMain.handle('mouse:wallet'" not in l);write(p,s)
p='desktop/mouse-preload.cjs';s=read(p);s='\n'.join(l for l in s.split('\n') if not l.lstrip().startswith('web3:'));s=s.replace(" wallet:(action,args)=>ipcRenderer.invoke('mouse:wallet',action,args),update:"," update:");write(p,s)
p='desktop/mouse-private.cjs';s=read(p);s='\n'.join(l for l in s.split('\n') if "handlers.set('mouse:web3-admin'" not in l and "handlers.set('mouse:wallet'" not in l);write(p,s)
p='desktop/mouse/start.js';write(p,read(p).replace(' Кошелёк в этом режиме отключён.',''))
p='desktop/mouse/mouse-final.css';write(p,read(p).replace(':root[data-private=true] [data-action=wallet],',''))
p='desktop/mouse/mac-polish.css';write(p,'\n'.join(l for l in read(p).split('\n') if not l.startswith('#web3-dialog')))
p='desktop/mouse/browser.css';s=re.sub(r'\.wallet-row[^{}]*\{[^{}]*\}','',read(p));write(p,re.sub(r'#wallet-form\{[^{}]*\}','',s))
p='desktop/mouse/i18n.js';s=read(p).replace("'Кошелёк':'Wallet',",'');write(p,'\n'.join(l for l in s.split('\n') if "'Метакошелёк ·" not in l))
p='desktop/mouse-build.cjs';s=read(p).replace("&&x!=='icons/**/*'", "&&x!=='icons/**/*'&&!['wallet-vault.cjs','main.cjs','preload.cjs'].includes(x)")
for name in ['mouse-web3.cjs','mouse-web3-runtime.cjs','mouse-web3-smoke.cjs']:s=s.replace("'"+name+"',",'')
write(p,s.replace("'mouse-615-smoke.cjs',","'mouse-615-smoke.cjs','mouse-616-smoke.cjs',"))
p='desktop/mouse-615.test.cjs';s=read(p);start=s.index("test('burrow uses");end=s.index("test('footer keeps");s=s[:start]+'''test('arched new-tab uses a familiar plus and preserves approved mouse files',()=>{
 const h=fs.readFileSync('mouse/index.html','utf8'),button=h.match(/<button id="new-tab"[^>]*>(.*?)<\\/button>/s)[1];
 assert.match(button,/class="burrow-plus"/);assert.match(button,/M10 4v12M4 10h12/);assert.doesNotMatch(button,/burrow-mouse|burrow-floor/);
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync('mouse/mouse-original.png')).digest('hex'),require('./mouse-brand.cjs').sourceSHA256);
 const css=fs.readFileSync('mouse/mouse-615.css','utf8');assert.match(css,/border-radius:14px 14px 0 0/);assert.match(css,/border-bottom:0/);assert.match(css,/box-shadow:none!important/);assert.match(css,/#new-tab:hover \\.burrow-plus\\{opacity:1\\}/);assert.match(css,/#new-tab:focus-visible/);
});
'''+s[end:];write(p,s)
p='desktop/mouse-615-smoke.cjs';s=read(p).replace('.burrow-mouse','.burrow-plus').replace("opacity'),'0'","opacity'),'1'").replace('MOUSE_615_ARCH_BUTTON_HOVER_AND_SEPARATE_FOOTER_BOTH_THEMES_PASS','MOUSE_616_ARCH_PLUS_AND_SEPARATE_FOOTER_BOTH_THEMES_PASS');write(p,s)
p='desktop/mouse-private.test.cjs';s=read(p).replace("assert.match(fs.readFileSync(require.resolve('./mouse-page-preload.cjs'),'utf8'),/!process.argv.includes\\('--mouse-private-page'\\)/);","assert.doesNotMatch(fs.readFileSync(require.resolve('./mouse-page-preload.cjs'),'utf8'),/exposeInMainWorld|ethereum|ipcRenderer/);");write(p,s)
sub('desktop/mouse-private-smoke.cjs','MouseNative.web3("state").then(()=>false,()=>true)','typeof MouseNative.web3 === "undefined" && typeof MouseNative.wallet === "undefined"')
p='desktop/mouse-refinements-smoke.cjs';write(p,read(p).replace('[data-action=wallet]','[data-action=ai]').replace("'Wallet'","'AI'").replace("'Кошелёк'","'ИИ'"))
p='desktop/mouse-start-smoke.cjs';write(p,'\n'.join(l for l in read(p).split('\n') if "['#statusbar [data-action=wallet]'" not in l))
p='desktop/mouse-smoke.cjs';s=read(p).replace(',web3Service','').replace("assert.equal((await js('MouseNative.wallet(\"list\")'))[0]?.address,'0x1111111111111111111111111111111111111111');","assert.equal((await store.get('traderWalletWatch')).traderWalletWatch[0]?.address,'0x1111111111111111111111111111111111111111');");s='\n'.join(l for l in s.split('\n') if 'web3Service.vault' not in l and "require('./mouse-web3-smoke.cjs')" not in l);s=s.replace('MOUSE_PROFILE_COOKIE_WALLET_RESTART_PASS','MOUSE_PROFILE_COOKIE_RESTART_PASS');s=s.replace("await require('./mouse-615-smoke.cjs')({win,browser});","await require('./mouse-615-smoke.cjs')({win,browser});\n  if(!process.argv.includes('--mouse-smoke-read'))await require('./mouse-616-smoke.cjs')({app,win,browser,store,globalCapture});");write(p,s)
p='tools/mouse-verify.py';write(p,read(p).replace('MOUSE_PROFILE_COOKIE_WALLET_RESTART_PASS','MOUSE_PROFILE_COOKIE_RESTART_PASS'))
p='tools/mouse-update-verify.py';s=read(p).replace('6.0.15','6.0.16').replace('6.0.14','6.0.15').replace('614','615').replace('615_TO_615','615_TO_616').replace('MOUSE_615_REAL','MOUSE_616_REAL');write(p,s.replace('b8c371fe2a5ffcc5bdb02e0d02cdcb03f8f7616a541b5519937211db003ba5f8','ac6400a02c4503d23972f8f9c8b4f764ddcbfcc02d9bd873df37bbeb80624c88'))
print('Owner-requested source refinements applied; native checks still required')

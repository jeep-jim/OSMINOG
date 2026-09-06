const {chromium}=require('playwright'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true});try{const p=await b.newPage();
const css=['editor.css','osminog-product-core-recovery.css'].map(n=>fs.readFileSync(n,'utf8')).join('\n');
for(const theme of ['light','dark','ocean'])for(const width of [560,1200]){
 await p.setViewportSize({width,height:900});
 await p.setContent('<html data-theme="'+theme+'"><style>'+css+'</style><div id="bridgePanel" style="width:90vw"><div class="gpt-presence-shell"><div class="local-ai-projectbar">Project</div><div class="local-ai-messages"><div class="local-ai-msg gpt-msg-with-avatar user"><span class="gpt-msg-identity"><span class="gpt-msg-avatar owner">ВЫ</span><time>17:40</time></span><div class="gpt-msg-card"><header><strong>Вы</strong></header><div class="gpt-msg-text">Привет!</div></div></div></div><form class="local-ai-compose">input</form></div></div>');
 const r=await p.evaluate(()=>{const style=s=>getComputedStyle(document.querySelector(s));return {width:document.querySelector('.local-ai-msg').getBoundingClientRect().width,color:style('time').color,border:style('.gpt-msg-avatar').borderWidth,separator:style('.local-ai-projectbar').borderTopWidth,footer:style('form').borderTopWidth}});
 assert.ok(r.width<400,JSON.stringify(r));assert.equal(r.color,'rgb(255, 255, 255)');assert.equal(r.border,'0px');assert.equal(r.separator,'1px');assert.equal(r.footer,'0px');
}console.log('Chat layout: 3 themes x 2 widths passed');}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});

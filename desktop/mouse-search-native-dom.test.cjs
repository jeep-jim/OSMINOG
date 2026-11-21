'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),cheerio=require('cheerio/slim');
const {snapshotScript,WORLD_ID}=require('./mouse-search-native-dom.cjs');
function readDOM(body,engine='google',{url='https://www.google.com/search?q=topic',evidence=true}={}){
 const $=cheerio.load('<html><head><title>Selected search</title></head><body>'+body+'</body></html>'),cache=new WeakMap();
 const element=n=>!!n&&typeof n.name==='string';
 function wrap(n){if(!n)return null;if(cache.has(n))return cache.get(n);const value={
  get parentElement(){return element(n.parent)?wrap(n.parent):null;},get children(){return(n.children||[]).filter(element).map(wrap);},
  get textContent(){return $(n).text();},get innerText(){const c=$(n).clone();c.find('script,style,[data-hidden]').remove();return c.text();},
  get outerHTML(){return $.html(n);},get href(){return new URL($(n).attr('href')||'',url).href;},
  querySelectorAll:selector=>$(n).find(selector).toArray().map(wrap),closest:selector=>wrap($(n).closest(selector).get(0)),getAttribute:name=>$(n).attr(name)??null,
  contains:other=>{for(let p=other;p;p=p.parentElement)if(p===value)return true;return false;},
  getBoundingClientRect:()=>({x:10,y:100,width:$(n).attr('data-hidden')?0:240,height:$(n).attr('data-hidden')?0:22})};cache.set(n,value);return value;}
 const document={documentElement:wrap($('html').get(0)),body:wrap($('body').get(0)),title:'Selected search',readyState:'complete',visibilityState:'hidden',querySelectorAll:selector=>$.root().find(selector).toArray().map(wrap)};
 const before=document.documentElement.outerHTML,context={document,location:{href:url},innerWidth:1100,innerHeight:800,getComputedStyle:node=>({display:node.getAttribute('data-hidden')?'none':'block',visibility:'visible',opacity:'1'}),URL};
 const value=vm.runInNewContext(snapshotScript(engine,evidence),context);assert.equal(document.documentElement.outerHTML,before,'Collector may not mutate the actual document');
 return{snapshot:JSON.parse(JSON.stringify(value)),document};
}
function at(root,path){return path?.reduce((node,index)=>node.children[index],root);}
test('Google DOM extraction reads rendered organic titles/snippets and excludes ads/hidden headings',()=>{
 const body='<main id="search"><div id="tads"><div class="MjjYud"><a href="https://ads.example.com"><h3>Paid result</h3></a></div></div><div class="MjjYud"><div data-hveid="a"><a href="https://example.com/article"><h3>Use &lt;b&gt; &amp;amp; examples</h3></a></div><div class="VwiC3b">Actual <b>visible</b> excerpt</div></div><div class="g" data-hidden="1"><a href="https://hidden.example.com"><h3>Hidden result</h3></a></div><a id="pnnext" href="/search?q=topic&amp;start=10">Next</a></main>';
 const {snapshot:s,document}=readDOM(body);assert.equal(s.rows.length,1);assert.equal(s.rows[0].title,'Use <b> &amp; examples');assert.equal(s.rows[0].content,'Actual visible excerpt');assert.equal(s.next.url,'https://www.google.com/search?q=topic&start=10');
 const row=s.rows[0],container=at(document.documentElement,row.containerPath);assert.equal(container.outerHTML,row.rawOuterHTML);assert.equal(at(container,row.titlePath).textContent,row.title);assert.equal(at(container,row.linkPath).getAttribute('href'),row.rawHref);assert.equal(at(container,row.snippetPath).textContent,'Actual visible excerpt');assert.equal(row.rendered,true);assert.equal(row.inViewport,true);assert.equal(WORLD_ID===0||WORLD_ID===999,false);
});
test('Bing, DuckDuckGo and Yandex select their organic containers rather than unrelated navigation',()=>{
 const cases=[['bing','<ul id="b_results"><li class="b_algo"><h2><a href="https://example.com/bing">Bing organic</a></h2><div class="b_caption"><p>Actual Bing excerpt</p></div></li><li class="b_algo b_ad"><h2><a href="https://ads.example.com">Paid</a></h2></li></ul>','Bing organic','Actual Bing excerpt'],['duckduckgo','<article data-testid="result"><a data-testid="result-title-a" href="https://example.com/ddg">DDG organic</a><div data-testid="result-snippet">Actual DDG excerpt</div></article><article data-testid="result" class="result--ad"><a data-testid="result-title-a" href="https://ads.example.com">Paid</a></article>','DDG organic','Actual DDG excerpt'],['yandex','<li class="serp-item"><h2><a class="OrganicTitle-Link" href="https://example.com/yandex">Yandex organic</a></h2><div class="OrganicTextContentSpan">Actual Yandex excerpt</div></li><li class="serp-item"><span class="AdvLabel">Реклама</span><h2><a href="https://ads.example.com">Paid</a></h2></li>','Yandex organic','Actual Yandex excerpt']];
 for(const[engine,body,title,content]of cases){const s=readDOM(body+'<nav><a href="https://irrelevant.example.com">Unrelated</a></nav>',engine).snapshot;assert.equal(s.rows.length,1);assert.equal(s.rows[0].title,title);assert.equal(s.rows[0].content,content);}
});
test('visible verification and explicit no-results messages remain distinct from unknown layouts',()=>{
 const challenge=readDOM('<form id="challenge-form">Verify you are human</form>').snapshot;assert.equal(challenge.challenge,'visible-verification');assert.equal(challenge.empty,false);
 const hidden=readDOM('<iframe src="https://recaptcha.example.com/recaptcha" data-hidden="1"></iframe>').snapshot;assert.equal(hidden.challenge,'');assert.equal(hidden.empty,false);
 const empty=readDOM('<main>No results found for this query</main>').snapshot;assert.equal(empty.empty,true);assert.equal(empty.challenge,'');
 const unknown=readDOM('<main>A changed provider layout</main>').snapshot;assert.equal(unknown.empty,false);assert.equal(unknown.rows.length,0);
});
test('normal production collection omits full HTML and fragments; evidence collection keeps bounded actual DOM',()=>{
 const source='<main id="search"><div class="g"><a href="https://example.com"><h3>Actual</h3></a></div></main>';
 const normal=readDOM(source,'google',{evidence:false}).snapshot;assert.equal(normal.html,undefined);assert.equal(normal.rows[0].rawOuterHTML,undefined);
 const evidence=readDOM(source).snapshot;assert.equal(typeof evidence.html,'string');assert.equal(evidence.htmlTruncated,false);assert.equal(evidence.htmlLength,evidence.html.length);
 assert.throws(()=>snapshotScript('renderer-chosen-host'));
});

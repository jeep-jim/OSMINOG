'use strict';

// This function runs in a fresh isolated JavaScript world. It only reads the
// current document; it never clicks, submits, fetches, changes styles or reads
// input values. Keep every selector here independent of user-supplied text.
function collectNativeSearchDOM(engine, evidence=false) {
  const MAX_ROWS=80,MAX_HTML=4*1024*1024,MAX_FRAGMENT=128*1024;
  const clean=(value,max)=>String(value||'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').replace(/\s+/g,' ').trim().slice(0,max);
  const all=(root,selector)=>{try{return Array.from(root.querySelectorAll(selector));}catch{return [];}};
  const pathOf=(node,root=document.documentElement)=>{
    const result=[];let current=node;
    while(current&&current!==root){const parent=current.parentElement;if(!parent)return null;result.unshift(Array.from(parent.children).indexOf(current));current=parent;}
    return current===root?result:null;
  };
  const bounds=node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
  const rendered=node=>{
    if(!node)return false;
    const r=node.getBoundingClientRect();if(r.width<=0||r.height<=0)return false;
    for(let p=node;p&&p!==document.documentElement;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden'||s.visibility==='collapse'||Number(s.opacity)===0)return false;}
    return true;
  };
  const first=(root,selectors)=>{for(const selector of selectors){const node=all(root,selector).find(rendered);if(node)return{node,selector};}return{node:null,selector:''};};
  const adSelector='#tads,#bottomads,.uEierd,[data-text-ad],.b_ad,.b_adTop,.result--ad,[data-testid="ad"],.serp-item_ad,[data-fast-name="adv"],[data-is-adv="true"]';
  const isAd=node=>!!node.closest(adSelector)||all(node,'.AdvLabel,.Organic-Subtitle_type_ad,[data-testid="ad-label"]').some(rendered);
  const rows=[],seen=new Set();
  function add(container,title,link,snippet,selector,snippetSelector=''){
    if(!container||!title||!link||isAd(container)||isAd(link)||!rendered(title)||!rendered(link))return;
    const rawHref=link.getAttribute('href')||'',text=clean(title.textContent,300);if(!rawHref||!text)return;
    const key=rawHref+'\n'+text;if(seen.has(key))return;seen.add(key);
    const rect=bounds(title),row={rank:rows.length+1,title:text,url:link.href||rawHref,rawHref,content:clean(snippet?.textContent,1800),selector,snippetSelector,
      containerPath:pathOf(container),linkPath:pathOf(link,container),titlePath:pathOf(title,container),snippetPath:snippet?pathOf(snippet,container):null,
      bounds:rect,rendered:true,inViewport:rect.y+rect.height>0&&rect.y<innerHeight&&rect.x+rect.width>0&&rect.x<innerWidth};
    if(evidence){const html=container.outerHTML||'';row.rawOuterHTML=html.slice(0,MAX_FRAGMENT);row.fragmentTruncated=html.length>MAX_FRAGMENT;}
    rows.push(row);
  }
  if(engine==='google'){
    for(const title of all(document,'#search h3, #rso h3')){
      const link=title.closest('a[href]');
      const container=title.closest('.MjjYud,.g')||title.closest('[data-hveid]')||title.parentElement?.parentElement;
      if(!container||!link||!container.contains(link))continue;
      const snippet=first(container,['.VwiC3b','.IsZvec','[data-sncf]','.aCOpRe','.yXK7lf']);
      add(container,title,link,snippet.node,'#search h3, #rso h3',snippet.selector);if(rows.length>=MAX_ROWS)break;
    }
  }else if(engine==='bing'){
    for(const container of all(document,'#b_results > li.b_algo, #b_results .b_algo')){
      const title=first(container,['h2 a[href]']),snippet=first(container,['.b_caption p','p.b_lineclamp2','.b_snippet']);
      add(container,title.node,title.node,snippet.node,'#b_results .b_algo',snippet.selector);if(rows.length>=MAX_ROWS)break;
    }
  }else if(engine==='duckduckgo'){
    for(const container of all(document,'article[data-testid="result"], .result.results_links')){
      const title=first(container,['a[data-testid="result-title-a"]','h2 a[href]','.result__a']),snippet=first(container,['[data-testid="result-snippet"]','[data-result="snippet"]','.result__snippet']);
      add(container,title.node,title.node,snippet.node,'article[data-testid="result"], .result.results_links',snippet.selector);if(rows.length>=MAX_ROWS)break;
    }
  }else if(engine==='yandex'){
    for(const container of all(document,'.serp-item')){
      const title=first(container,['a.OrganicTitle-Link','.OrganicTitle a[href]','h2 a[href]']),snippet=first(container,['.OrganicTextContentSpan','.Organic-Text','.TextContainer','.text-container']);
      add(container,title.node,title.node,snippet.node,'.serp-item',snippet.selector);if(rows.length>=MAX_ROWS)break;
    }
  }
  const nextSelectors={google:['a#pnnext[href]','a[aria-label="Next page"][href]','a[aria-label="Следующая страница"][href]'],bing:['a.sb_pagN[href]'],duckduckgo:['a.result--more__btn[href]','a[rel="next"][href]'],yandex:['a.Pager-Item_type_next[href]','a[aria-label="Следующая страница"][href]']};
  const next=first(document,nextSelectors[engine]||[]);
  const bodyText=clean(document.body?.innerText||'',30000),url=String(location.href);
  const challengeNodes=all(document,'#challenge-form,#cf-challenge-running,form[action*="/sorry/"],form[action*="showcaptcha"],iframe[src*="recaptcha"],iframe[src*="hcaptcha"],.CheckboxCaptcha,#captcha').filter(rendered);
  const challengeURL=/^(?:https:\/\/)(?:consent|accounts)\.google\./i.test(url)||/\/(?:sorry|showcaptcha|checkcaptcha)(?:[/?#]|$)/i.test(url);
  const challengeText=/unusual traffic from your computer network|verify (?:that )?you are (?:a )?human|подтвердите,? что вы не робот|подтвердите,? что запросы отправляли вы|checking your browser before accessing|access to this page has been denied/i.test(bodyText);
  const challenge=challengeURL?'provider-interaction':challengeNodes.length?'visible-verification':!rows.length&&challengeText?'verification-message':'';
  const empty=!rows.length&&!challenge&&/did not match any documents|no results found for|there are no results for|по вашему запросу ничего не найдено|по запросу ничего не нашлось|ничего не нашли по запросу|ничего не найдено по запросу/i.test(bodyText);
  const snapshot={schema:1,engine,documentURL:url,documentTitle:clean(document.title,300),documentReadyState:document.readyState,visibilityState:document.visibilityState,
    viewport:{width:innerWidth,height:innerHeight},extractedAtISO:new Date().toISOString(),rows,next:next.node?{url:next.node.href||next.node.getAttribute('href'),rawHref:next.node.getAttribute('href')||'',selector:next.selector,path:pathOf(next.node)}:null,
    challenge,empty,bodyExcerpt:challenge||empty?bodyText.slice(0,1400):''};
  if(evidence){const html=document.documentElement?.outerHTML||'';snapshot.html=html.slice(0,MAX_HTML);snapshot.htmlLength=html.length;snapshot.htmlTruncated=html.length>MAX_HTML;}
  return snapshot;
}

const WORLD_ID=63510;
function snapshotScript(engine,evidence=false){
  if(!['google','bing','duckduckgo','yandex'].includes(engine))throw Error('Unknown search engine');
  return '('+collectNativeSearchDOM.toString()+')('+JSON.stringify(engine)+','+(evidence===true?'true':'false')+')';
}
module.exports={collectNativeSearchDOM,snapshotScript,WORLD_ID};

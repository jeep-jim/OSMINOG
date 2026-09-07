"use strict";
// Shared route rules for explicitly connected native conversations.
(()=>{
  const rules={gpt:[/^\/$/,/^\/c\/[^/]+\/?$/],alice:[/^\/(?:chat)?\/?$/,/^\/chat\/[^/]+\/?$/],claude:[/^\/(?:new)?\/?$/,/^\/chat\/[^/]+\/?$/],gemini:[/^\/app\/?$/,/^\/app\/[^/]+\/?$/],deepseek:[/^\/$/,/^\/a\/chat\/s\/[^/]+\/?$/],googleai:[/^\/(?:ai|prompts\/new_chat)\/?$/,/^\/(?:search|prompts\/(?!new_chat)[^/]+)\/?$/]};
  const route=url=>{try{const u=new URL(url);return u.protocol+'//'+u.host+u.pathname}catch{return ''}};
  function promoted(provider,before,after){try{const a=new URL(before),b=new URL(after),r=rules[provider==='nano-banana'?'gemini':provider];return a.origin===b.origin&&!!r?.[0].test(a.pathname)&&r[1].test(b.pathname)}catch{return false}}
  globalThis.OSMINOGChatSync={route,promoted};
})();

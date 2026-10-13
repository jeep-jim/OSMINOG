'use strict';
function proxyConfig(input={}){
 const mode=input.mode||'system';
 if(!['system','direct','fixed_servers'].includes(mode))throw Error('Неизвестный режим подключения');
 if(mode!=='fixed_servers')return{mode,server:''};
 let url;try{url=new URL(String(input.server||'').trim())}catch{throw Error('Укажите адрес HTTP, HTTPS или SOCKS5-прокси')}
 if(!['http:','https:','socks5:'].includes(url.protocol)||!url.hostname||url.username||url.password||url.pathname&&url.pathname!=='/'||url.search||url.hash)throw Error('Нужен адрес прокси без пароля, пути и параметров');
 return{mode,server:url.origin==='null'?`${url.protocol}//${url.host}`:url.origin};
}
// Keep the actual Chromium version/platform. Only remove application product tokens.
function browserUserAgent(value){return String(value||'').replace(/\s(?:Electron|osminog-desktop|OSMINOG-Preview)\/[^\s]+/gi,'')}
module.exports={proxyConfig,browserUserAgent};

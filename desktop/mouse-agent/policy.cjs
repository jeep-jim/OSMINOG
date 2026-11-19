'use strict';
function webURL(value){if(typeof value!=='string')throw Error('Нужен веб-адрес');const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||value.length>8192)throw Error('Разрешён только HTTP(S)-адрес без пароля');return u.href;}
function endpoint(value){const u=new URL(value),local=['localhost','127.0.0.1','[::1]'].includes(u.hostname);if(u.username||u.password||u.search||u.hash||(!local&&u.protocol!=='https:')||!['http:','https:'].includes(u.protocol))throw Error('Локальная модель: HTTP на loopback; облачная: HTTPS без пароля в URL');u.pathname=u.pathname.replace(/\/+$/,'')+'/';return{url:u.href,local,host:u.host};}
function preview(port){const n=Number(port);if(!Number.isInteger(n)||n<1||n>65535)throw Error('Порт должен быть от 1 до 65535');return'http://127.0.0.1:'+n+'/';}
function text(value,max=8000){if(typeof value!=='string'||!value.trim()||value.length>max||value.includes('\0'))throw Error('Недопустимый текст или превышен лимит');return value;}
function cleanEnv(source=process.env){
 // Windows environment names are case-insensitive (usually Path/SystemRoot).
 // Preserve only executable, profile and temporary-directory discovery; model
 // credentials and NODE_OPTIONS are never inherited by terminal/MCP children.
 // Keep the standard PowerShell command-discovery cache path even when the
 // Windows shell must rebuild its module search path for its own version.
 const names=['PATH','HOME','USER','LOGNAME','LANG','LC_ALL','TMPDIR','SHELL','SYSTEMROOT','SYSTEMDRIVE','WINDIR','COMSPEC','PATHEXT','USERPROFILE','HOMEDRIVE','HOMEPATH','APPDATA','LOCALAPPDATA','TEMP','TMP','PROGRAMFILES','PROGRAMFILES(X86)','COMMONPROGRAMFILES','PSModulePath','PSModuleAnalysisCachePath'];
 const keys=new Map(Object.keys(source).map(key=>[key.toUpperCase(),key]));return Object.fromEntries(names.map(key=>[key,source[keys.get(key.toUpperCase())]]).filter(([,value])=>typeof value==='string'));
}
module.exports={webURL,endpoint,preview,text,cleanEnv};

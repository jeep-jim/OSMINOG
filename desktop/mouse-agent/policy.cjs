'use strict';
function webURL(value){if(typeof value!=='string')throw Error('Нужен веб-адрес');const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||value.length>8192)throw Error('Разрешён только HTTP(S)-адрес без пароля');return u.href;}
function endpoint(value){const u=new URL(value),local=['localhost','127.0.0.1','[::1]'].includes(u.hostname);if(u.username||u.password||u.search||u.hash||(!local&&u.protocol!=='https:')||!['http:','https:'].includes(u.protocol))throw Error('Локальная модель: HTTP на loopback; облачная: HTTPS без пароля в URL');u.pathname=u.pathname.replace(/\/+$/,'')+'/';return{url:u.href,local,host:u.host};}
function preview(port){const n=Number(port);if(!Number.isInteger(n)||n<1||n>65535)throw Error('Порт должен быть от 1 до 65535');return'http://127.0.0.1:'+n+'/';}
function text(value,max=8000){if(typeof value!=='string'||!value.trim()||value.length>max||value.includes('\0'))throw Error('Недопустимый текст или превышен лимит');return value;}
function cleanEnv(source=process.env){return Object.fromEntries(['PATH','HOME','USER','LOGNAME','LANG','LC_ALL','TMPDIR','SHELL','SYSTEMROOT','WINDIR','COMSPEC'].filter(k=>typeof source[k]==='string').map(k=>[k,source[k]]));}
module.exports={webURL,endpoint,preview,text,cleanEnv};

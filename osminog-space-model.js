/* OSMINOG Space: explicit public cards, no implicit canvas export. */
(function(root){
'use strict';
const TOPICS=[['all','Вся вселенная',210],['tech','Технологии',195],['mobility','Транспорт',155],['creative','Творчество',285],['science','Исследования',235],['community','Люди',32],['business','Бизнес',345]];
const words=s=>new Set(String(s||'').toLocaleLowerCase().replace(/ё/g,'е').match(/[\p{L}\p{N}]{3,}/gu)||[]);
const text=(v,n=500)=>typeof v==='string'?v.slice(0,n):'';
const safeUrl=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:''}catch{return''}};
function clean(raw){if(!raw||typeof raw!=='object')throw Error('Некорректная карточка мира');return{schema:'osminog.world/v1',title:text(raw.title,90)||'Новый мир',about:text(raw.about,1200),topic:TOPICS.some(t=>t[0]===raw.topic)?raw.topic:'tech',intent:['explore','team','help','show'].includes(raw.intent)?raw.intent:'explore',tags:text(raw.tags,200),needs:text(raw.needs,400),url:safeUrl(raw.url),notes:Array.isArray(raw.notes)?raw.notes.slice(0,24).map(n=>({title:text(n.title,80),text:text(n.text,800)})).filter(n=>n.text):[]}}
function related(a,b){const reasons=[];let score=0;const aw=words([a.title,a.about,a.tags,a.needs].join(' ')),bw=words([b.title,b.about,b.tags,b.needs].join(' '));const common=[...aw].filter(w=>bw.has(w));if(common.length){score+=common.length*3;reasons.push('Общие слова: '+common.slice(0,5).join(', '))}if(a.topic===b.topic){score+=2;reasons.push('Общая тема')}if(a.intent==='team'&&b.intent==='help'||a.intent==='help'&&b.intent==='team'){score+=3;reasons.push('Поиск команды ↔ предложение помощи')}return{score,reasons}}
function decodeIssue(issue){if(issue.pull_request||issue.state!=='open')return null;const match=String(issue.body||'').match(/```osminog-world\s*\n([\s\S]*?)\n```/);if(!match)return null;try{const raw=JSON.parse(match[1]);if(raw.schema!=='osminog.world/v1')return null;return{...clean(raw),id:'public-'+issue.number,issue:issue.number,public:true,author:text(issue.user?.login,80),discussion:safeUrl(issue.html_url),updated:issue.updated_at}}catch{return null}}
function issueUrl(card){const c=clean(card);const body='Мир OSMINOG. Обсуждение и предложения участия — в комментариях.\n\n```osminog-world\n'+JSON.stringify(c,null,2)+'\n```';const u=new URL('https://github.com/jeep-jim/OSMINOG/issues/new');u.searchParams.set('title','[OSMINOG WORLD] '+c.title);u.searchParams.set('body',body);return u.href}
function position(i){const angle=i*2.399963229728653,r=170*Math.sqrt(i+1);return{x:Math.cos(angle)*r,y:Math.sin(angle)*r}}
const api={TOPICS,clean,related,decodeIssue,issueUrl,position,safeUrl};root.OSMINOGSpaceModel=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);

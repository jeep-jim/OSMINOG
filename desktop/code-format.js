'use strict';
(function(root){
 const languages={html:{name:'HTML',extension:'html'},python:{name:'Python',extension:'py'},javascript:{name:'JavaScript',extension:'js'},typescript:{name:'TypeScript / JSX',extension:'tsx'},css:{name:'CSS',extension:'css'},json:{name:'JSON',extension:'json'},text:{name:'Текст',extension:'txt'}};
 function inspect(value,filename=''){
  let source=String(value),fenced=false;
  const blocks=[...source.matchAll(/^\s*```([\w+-]*)[^\n]*\n([\s\S]*?)^\s*```\s*$/gm)];
  if(blocks.length>1)return{source,language:'text',error:'Вставлено несколько блоков кода. Откройте папку проекта или вставьте один полный HTML-файл.'};
  let hint='';if(blocks.length===1){hint=blocks[0][1].toLowerCase();source=blocks[0][2];fenced=true}
  const s=source.trimStart(),ext=filename.split('.').pop()?.toLowerCase();
  let language=({py:'python',python:'python',html:'html',htm:'html',javascript:'javascript',js:'javascript',jsx:'typescript',tsx:'typescript',ts:'typescript',typescript:'typescript',css:'css',json:'json'})[hint];
  if(!language){
   if(/^\s*(?:<!doctype\s+html|<!--|<(?:html|head|body|div|main|section|canvas|style|script|h[1-6]|button|svg|p)\b)/i.test(s))language='html';
   else if(/^(?:#!.*python|from\s+[\w.]+\s+import\s|import\s+[\w., ]+(?:\r?\n|$)|(?:async\s+)?def\s+\w+\s*\(|class\s+\w+[^\n]*:|print\s*\()/m.test(s))language='python';
   else if(['tsx','jsx','ts'].includes(ext)||/^(?:import\s.*from\s|export\s|interface\s|type\s+\w+\s*=)/m.test(s))language='typescript';
   else if(ext==='css'||/^[.#][\w.# :>\-]+\s*\{/.test(s))language='css';
   else if(ext==='json')language='json';
   else if(['js','mjs'].includes(ext)||/^(?:const\s|let\s|var\s|function\s|document\.|console\.)/.test(s))language='javascript';
   else if(ext==='py')language='python';
   else language='text';
  }
  return{source,language,fenced,...languages[language]};
 }
 function preview(value){const result=inspect(value);if(result.error)return result;
  if(result.language==='html')return{...result,html:result.source};
  const messages={python:'Это Python, а не веб-страница. Для запуска нужен Python. Сервер MCP не создаёт интерфейс игры; вставьте HTML-код самой игры.',typescript:'Это TypeScript / React / модуль с импортами. Откройте папку проекта; для запуска требуется сборка с его зависимостями.',javascript:'Это отдельный JavaScript-файл. Откройте HTML-страницу проекта, которая подключает этот скрипт.',css:'Это CSS. Для предпросмотра нужна HTML-страница проекта.',json:'Это данные JSON, а не исполняемая страница.',text:'Формат не определён. Вставьте полный HTML-код страницы или откройте папку проекта.'};
  return{...result,error:messages[result.language]};
 }
 const api={inspect,preview,languages};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.OSMINOGCodeFormat=api;
})(globalThis);

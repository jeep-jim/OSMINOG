'use strict';
// Classification uses the live hit target, never a model-supplied risk label.
function inspectTarget(action){
 const x=JSON.stringify(action);
 return `(()=>{const a=${x};let n=a.type==='click'||a.type==='drag'?document.elementFromPoint(a.x,a.y):document.activeElement;if(!n)return null;n=n.closest('button,a,input,textarea,select,[role="button"],[contenteditable="true"]')||n;const f=n.form||n.closest('form');return{tag:n.tagName?.toLowerCase(),type:n.type||'',role:n.getAttribute('role')||'',label:(n.getAttribute('aria-label')||n.labels?.[0]?.textContent||n.textContent||'').trim().slice(0,300),name:n.name||'',autocomplete:n.autocomplete||'',editable:n.isContentEditable,href:n.getAttribute('href')||'',bounds:(()=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})(),form:!!f,search:!!f&&(f.getAttribute('role')==='search'||!!f.querySelector('input[type="search"]')),disabled:!!n.disabled}})()`;
}
function classify(a,n){
 const block=reason=>({level:'block',reason}),warn=reason=>({level:'warn',reason}),safe=()=>({level:'safe'});
 if(a.type==='scroll')return safe();
 if(!n)return block('Не удалось определить цель действия');
 const label=[n.label,n.name,n.autocomplete,n.href].join(' ').toLowerCase();
 if(n.type==='password'||/password|current-password|new-password|one-time-code|cc-number|cc-csc|парол|плат[её]ж|оплат|удал|delete|erase|pay now|confirm payment|\/delete|\/remove|\/payment/.test(label))return block('Пароли, платёжные данные и удаление не выполняются автопилотом');
 if(n.disabled)return block('Элемент отключён');
 if(a.type==='key'){
  if(a.modifiers?.length&&!(a.modifiers.length===1&&a.modifiers[0]==='control'&&/^[acv]$/i.test(a.key)))return block('Сочетание клавиш недоступно автопилоту');
  if(a.key==='Delete')return block('Удаление клавишей не выполняется автоматически');
  if(['Enter','Space'].includes(a.key))return warn('Клавиша может отправить форму или активировать кнопку');
  return ['input','textarea'].includes(n.tag)||n.editable||['Tab','Escape','Left','Right','Up','Down','Home','End','PageUp','PageDown'].includes(a.key)?safe():warn('Клавиша вне текстового поля может вызвать команду сайта');
 }
 if(a.type==='type')return ['input','textarea'].includes(n.tag)||n.editable?safe():warn('Ввод вне распознанного текстового поля');
 if(a.type==='drag')return warn('Перетаскивание может изменить данные');
 if(/купить|заказать|отправ|опублик|сохран|buy|purchase|checkout|submit|send|publish|save/.test(label)||n.type==='submit')return warn('Подтвердите отправку или изменение данных');
 if(['input','textarea','select'].includes(n.tag)||n.editable)return safe();
 if(n.tag==='a'&&/^https?:|^\/|^#/.test(n.href))return safe();
 if(/тема|светл|тёмн|темн|поиск|найти|theme|light mode|dark mode|search/.test(label))return safe();
 return warn('Назначение элемента не определено: проверьте действие');
}
async function confirm(browser,a,n,risk){
 const {dialog}=require('electron');
 const r=await dialog.showMessageBox(browser.win,{type:'question',buttons:['Отмена','Выполнить один раз'],defaultId:0,cancelId:0,message:risk.reason,detail:`${a.type}: ${n?.label||n?.tag||'элемент'}\n${browser.project}`});
 return r.response===1;
}
module.exports={inspectTarget,classify,confirm};

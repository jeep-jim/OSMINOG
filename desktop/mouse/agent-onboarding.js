'use strict';
// A model is selected only after an explicit local probe. Nothing here enables
// the agent, grants file/terminal access, runs an installer or submits a task.
globalThis.createMouseAgentOnboarding=({panel,call,status})=>{
 const box=document.createElement('details');box.className='agent-onboarding';box.id='agent-ollama-setup';
 box.innerHTML=`<summary>Локальная модель Ollama <small>по желанию</small></summary><p>Ollama запускает скачанную модель на вашем компьютере. Можно также подключить свой API в разделе «Модель».</p><ol><li>Скачайте Ollama с официального сайта и откройте приложение.<button type="button" data-ollama-page="download">Скачать Ollama ↗</button></li><li>Выберите и скачайте в Ollama локальную модель, подходящую вашему компьютеру.<button type="button" data-ollama-page="models">Каталог моделей ↗</button><small>Через терминал: <code>ollama pull имя-модели</code>. На Linux сервер запускается командой <code>ollama serve</code>.</small></li><li>Вернитесь сюда и выберите установленную модель.<button type="button" id="agent-ollama-check">Проверить подключение</button></li></ol><p id="agent-ollama-status" role="status" aria-live="polite">Проверка запускается только по вашей кнопке.</p><label id="agent-ollama-models-label" hidden>Модель на компьютере<select id="agent-ollama-models" aria-label="Установленная модель Ollama"></select></label><button type="button" id="agent-ollama-use" hidden>Выбрать эту модель</button><button type="button" class="agent-ollama-guide" data-ollama-page="guide">Инструкция Ollama ↗</button>`;
 panel.querySelector('.agent-intro').after(box);
 const $=s=>box.querySelector(s),message=$('#agent-ollama-status'),select=$('#agent-ollama-models');let disposed=false,busy=false,available=[];
 for(const button of box.querySelectorAll('[data-ollama-page]'))button.onclick=async()=>{try{await call('ollama-help',{page:button.dataset.ollamaPage});}catch{}};
 $('#agent-ollama-check').onclick=async()=>{
  if(busy)return;busy=true;$('#agent-ollama-check').disabled=true;message.textContent='Проверяю Ollama на этом компьютере…';
  available=[];select.replaceChildren();$('#agent-ollama-models-label').hidden=true;$('#agent-ollama-use').hidden=true;
  try{
   const result=await call('ollama-models');if(disposed)return;
   if(!result?.available){message.textContent=result?.reason||'Ollama не отвечает. Откройте приложение и проверьте снова.';return;}
   available=Array.isArray(result.models)?result.models:[];
   if(!available.length){message.textContent='Ollama работает. Скачайте в нём локальную модель и проверьте снова.';return;}
   for(const item of available){const option=document.createElement('option');option.value=item.name;option.textContent=item.name;select.append(option);}
   const current=panel.querySelector('#agent-model').value;select.value=available.some(item=>item.name===current)?current:available[0].name;
   $('#agent-ollama-models-label').hidden=false;$('#agent-ollama-use').hidden=false;message.textContent='Ollama доступен. Выберите модель из списка.';
  }catch{if(!disposed)message.textContent='Не удалось проверить Ollama. Откройте приложение и повторите проверку.';}
  finally{busy=false;if(!disposed)$('#agent-ollama-check').disabled=false;}
 };
 $('#agent-ollama-use').onclick=()=>{
  if(disposed||!available.some(item=>item.name===select.value))return;
  panel.querySelector('#agent-endpoint').value='http://127.0.0.1:11434/v1/';panel.querySelector('#agent-model').value=select.value;
  panel.querySelector('#agent-key').value='';panel.querySelector('#agent-model-settings').open=true;
  message.textContent='Модель выбрана. Подключите агента, напишите задачу и нажмите «Запустить».';status('Локальная модель выбрана: '+select.value);
 };
 return{open(){box.open=true;},dispose(){disposed=true;available=[];box.remove();}};
};

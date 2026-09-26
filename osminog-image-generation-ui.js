(()=>{
  'use strict';
  const api=globalThis.OSMINOGImageGeneration;
  const panel=document.createElement('section');panel.id='imageGenerationPanel';panel.hidden=true;panel.setAttribute('aria-label','Генерация изображений');
  panel.innerHTML=`<header><strong>Генерация изображений</strong><button type="button" data-close aria-label="Свернуть">×</button></header>
  <div class="image-generation-body"><p>Создавайте персонажей, иллюстрации и раскадровки из чата. Результат сохраняется на доске в исходном PNG.</p>
  <label>Источник<select data-source><option value="native">Подключённый ChatGPT</option><option value="api">OpenAI Images API</option></select></label>
  <p data-native>Используется генерация подключённого ChatGPT, если она доступна в его сессии. Ключ API не нужен.</p>
  <fieldset data-api hidden><legend>OpenAI Images API</legend><p>Отдельная оплата в вашем API-проекте. Подписка ChatGPT её не покрывает. Запрос и приложенные референсы отправляются OpenAI.</p>
  <label>API-ключ<input data-key type="password" autocomplete="off" placeholder="Ключ хранится только до перезагрузки страницы"></label>
  <label>Модель<select data-model><option value="gpt-image-2.5-flare">GPT Image 2.5 Flare</option><option value="gpt-image-2.5-sunburst">GPT Image 2.5 Sunburst</option></select></label>
  <label>Качество<select data-quality><option value="medium">Среднее</option><option value="high" selected>Высокое</option><option value="xhigh">Очень высокое</option><option value="max">Максимальное</option></select></label>
  <label>Размер<select data-size><option value="1024x1536">Портрет · 1024 × 1536</option><option value="1536x1024">Альбом · 1536 × 1024</option><option value="1024x1024">Квадрат · 1024 × 1024</option><option value="2048x2048">Квадрат · 2048 × 2048</option></select></label></fieldset>
  <button type="button" data-save>Применить</button><button type="button" data-forget>Забыть ключ</button>
  <button type="button" data-download>Скачать последний результат</button><hr><label>Что нарисовать?<textarea data-prompt rows="5" placeholder="Нарисуй 3D-персонажа для игры, вид в полный рост…"></textarea></label>
  <p>Для работы по референсу прикрепите изображение к сообщению в чате. 3D-изображение — это картинка, а не модель с сеткой и ригом.</p>
  <button type="button" data-generate>Создать через чат</button><button type="button" data-cancel>Остановить ожидание API</button><p data-status role="status" aria-live="polite"></p></div>`;
  document.body.append(panel);const q=s=>panel.querySelector(s),report=t=>q('[data-status]').textContent=t;
  q('[data-close]').onclick=()=>panel.hidden=true;
  q('[data-source]').onchange=()=>{const isApi=q('[data-source]').value==='api';q('[data-api]').hidden=!isApi;q('[data-native]').hidden=isApi};
  q('[data-save]').onclick=async()=>{try{const enabled=q('[data-source]').value==='api';if(enabled&&!await chrome.permissions.request({origins:['https://api.openai.com/*']}))throw Error('Подключение не разрешено');const input={enabled,model:q('[data-model]').value,quality:q('[data-quality]').value,size:q('[data-size]').value};if(q('[data-key]').value)input.key=q('[data-key]').value;const state=api.configure(input);q('[data-key]').value='';report(enabled?(state.configured?'Готово. Теперь напишите в чате, что нарисовать.':'Введите API-ключ.'):'Используется подключённый ChatGPT.')}catch(e){report(e.message)}};
  q('[data-forget]').onclick=()=>{try{api.configure({key:'',enabled:false});q('[data-key]').value='';q('[data-source]').value='native';q('[data-source]').onchange();report('Ключ удалён.')}catch(e){report(e.message)}};
  q('[data-download]').onclick=()=>{const images=api.lastResult();if(!images.length)return report('В этой сессии ещё нет результата API.');for(const item of images){const a=document.createElement('a');a.href=item.dataUrl;a.download=item.name;a.click()}};
  q('[data-cancel]').onclick=()=>{api.cancel();report('Ожидание остановлено. Запрос у провайдера мог уже выполниться.')};
  q('[data-generate]').onclick=()=>{const prompt=q('[data-prompt]').value.trim();if(!prompt)return report('Опишите изображение.');globalThis.OSMINOGOpenUnifiedChat?.({team:false});const input=document.querySelector('#gptPresenceInput');if(input){input.value='[MEDIA:generate] '+prompt;input.dispatchEvent(new Event('input',{bubbles:true}));panel.hidden=true;document.querySelector('#gptPresenceForm')?.requestSubmit()}};
  globalThis.OSMINOGImageGenerationUI={open:()=>{panel.hidden=false;q('[data-prompt]').focus()}};
})();

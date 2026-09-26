/* Direct, opt-in Images API. Credentials stay in this page's private memory. */
(()=>{
  'use strict';
  const models=['gpt-image-2.5-flare','gpt-image-2.5-sunburst'];
  const qualities=['medium','high','xhigh','max'];
  const sizes=['1024x1024','1536x1024','1024x1536','2048x2048'];
  let key='',enabled=false,controller=null,lastResult=[];
  let options={model:models[0],quality:'high',size:'1024x1536'};
  function configure(input={}){
    if(controller)throw Error('Дождитесь завершения генерации');
    if('key' in input)key=String(input.key||'').trim();
    if('enabled' in input)enabled=!!input.enabled;
    for(const [k,values] of Object.entries({model:models,quality:qualities,size:sizes})){
      if(k in input){if(!values.includes(input[k]))throw Error('Недопустимый параметр '+k);options[k]=input[k]}
    }
    return status();
  }
  function status(){return {enabled,configured:!!key,busy:!!controller,...options}}
  async function generate(prompt,{references=[],signal}={}){
    if(!enabled||!key)throw Error('Подключите OpenAI API в «Снимки и изображения → Генерация изображений»');
    if(controller)throw Error('Предыдущее изображение ещё создаётся');
    if(!String(prompt||'').trim())throw Error('Опишите изображение');
    if(references.length>4)throw Error('Можно приложить до четырёх изображений');
    if(!await chrome.permissions.contains({origins:['https://api.openai.com/*']}))throw Error('Разрешите подключение OpenAI API в настройках генерации');
    const abort=new AbortController();controller=abort;
    const cancel=()=>abort.abort();signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
    const timer=setTimeout(cancel,300000);
    try{
      const parameters={...options,prompt:String(prompt),n:1,output_format:'png'};
      let body,headers={Authorization:'Bearer '+key},endpoint='generations';
      if(references.length){
        endpoint='edits';body=new FormData();for(const [k,v] of Object.entries(parameters))body.append(k,String(v));
        for(let i=0;i<references.length;i++){
          const ref=String(references[i]);const match=ref.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
          if(!match)throw Error('Референс должен быть PNG, JPEG или WebP');
          if(match[2].length>40*1024*1024)throw Error('Референс слишком большой');
          const bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));
          body.append('image[]',new Blob([bytes],{type:match[1]}),'reference-'+i+'.'+match[1].split('/')[1]);
        }
      }else{headers['Content-Type']='application/json';body=JSON.stringify(parameters)}
      const response=await fetch('https://api.openai.com/v1/images/'+endpoint,{method:'POST',headers,body,signal:abort.signal,credentials:'omit',redirect:'error'});
      if(!response.ok){
        const reasons={401:'Ключ OpenAI API не принят. Проверьте ключ.',403:'Модель недоступна этому API-проекту. Проверьте доступ и верификацию.',429:'Лимит запросов или баланс OpenAI API исчерпан.'};
        // Never echo a response body: upstream/proxy errors may contain credentials.
        throw Error(reasons[response.status]||'OpenAI Images: HTTP '+response.status+'. Запрос не повторён автоматически.');
      }
      const data=await response.json();
      const images=(data.data||[]).filter(x=>typeof x.b64_json==='string'&&/^[A-Za-z0-9+/=]+$/.test(x.b64_json)).map((x,i)=>({dataUrl:'data:image/png;base64,'+x.b64_json,name:'AI artwork '+(i+1)+'.png'}));
      if(!images.length)throw Error('OpenAI не вернул изображение. Списания и статус проверьте в API-проекте.');
      lastResult=images;return images;
    }catch(error){if(error.name==='AbortError')throw Error('Ожидание генерации остановлено. Запрос мог уже выполниться у провайдера; автоматического повтора нет.');throw error}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);controller=null}
  }
  globalThis.OSMINOGImageGeneration={configure,status,generate,lastResult:()=>lastResult.slice(),cancel:()=>controller?.abort(),models,qualities,sizes};
})();

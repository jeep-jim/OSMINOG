"use strict";
const COPY={"ru": {"tag": "Текст, скриншоты и файлы проекта", "open": "Открыть стол", "selection": "Сохранить выделенный текст", "selSub": "Добавить на стол", "shot": "Сделать скриншот", "shotSub": "Выбрать область снимка", "local": "Материалы сохраняются на этом устройстве.", "reading": "Читаю выделение…", "selectFirst": "Сначала выделите текст на странице.", "blocked": "Страница не разрешает прочитать выделение.", "capturing": "Делаю снимок…", "captureBlocked": "Не удалось снять вкладку."}, "en": {"tag": "Project text, screenshots and files", "open": "Open desk", "selection": "Save selected text", "selSub": "Add it to the desk", "shot": "Take a screenshot", "shotSub": "Choose an area to capture", "local": "Items are saved on this device.", "reading": "Reading selection…", "selectFirst": "Select some text first.", "blocked": "This page blocks selection capture.", "capturing": "Taking a screenshot…", "captureBlocked": "Could not capture this tab."}, "de": {"tag": "Texte, Bildschirmfotos und Projektdateien", "open": "Schreibtisch öffnen", "selection": "Markierten Text speichern", "selSub": "Zum Schreibtisch hinzufügen", "shot": "Bildschirmfoto erstellen", "shotSub": "Ausschnitt wählen", "local": "Inhalte werden auf diesem Gerät gespeichert.", "reading": "Auswahl wird gelesen…", "selectFirst": "Markieren Sie zuerst Text.", "blocked": "Die Seite blockiert das Lesen der Auswahl.", "capturing": "Bildschirmfoto wird erstellt…", "captureBlocked": "Aufnahme fehlgeschlagen."}, "es": {"tag": "Textos, capturas y archivos del proyecto", "open": "Abrir escritorio", "selection": "Guardar texto seleccionado", "selSub": "Añadir al escritorio", "shot": "Hacer una captura", "shotSub": "Elegir el área de captura", "local": "El contenido se guarda en este dispositivo.", "reading": "Leyendo la selección…", "selectFirst": "Selecciona texto primero.", "blocked": "La página impide leer la selección.", "capturing": "Capturando…", "captureBlocked": "No se pudo capturar la pestaña."}, "ja": {"tag": "文章、スクリーンショット、プロジェクトのファイル", "open": "デスクを開く", "selection": "選択した文章を保存", "selSub": "デスクに追加", "shot": "スクリーンショットを撮る", "shotSub": "撮影範囲を選択", "local": "項目はこの端末に保存されます。", "reading": "選択範囲を読み込み中…", "selectFirst": "先に文章を選択してください。", "blocked": "このページでは選択範囲を読み込めません。", "capturing": "撮影中…", "captureBlocked": "タブを撮影できませんでした。"}, "zh": {"tag": "项目文字、截图和文件", "open": "打开工作台", "selection": "保存选中的文字", "selSub": "添加到工作台", "shot": "截图", "shotSub": "选择截图区域", "local": "内容保存在此设备上。", "reading": "正在读取选区…", "selectFirst": "请先选中文字。", "blocked": "此页面禁止读取选区。", "capturing": "正在截图…", "captureBlocked": "无法截取此标签页。"}};
const $=s=>document.querySelector(s);let language="en",theme="dark",stagedVersion=null,restartBusy=false;
function text(){return COPY[language]||COPY.en}
function render(){const t=text();document.documentElement.lang=language;document.documentElement.dataset.theme=theme;$("#tagline").textContent=t.tag;$("#open").firstChild.textContent=(stagedVersion?(language==="ru"?"Завершить обновление":"Finish update"):t.open)+" ";$("#today span").firstChild.textContent=({ru:"Сегодня сохранено",en:"Saved today",de:"Heute gespeichert",es:"Guardado hoy",ja:"今日の保存",zh:"今日已保存"})[language];todayCount();$("#screenshot span").childNodes[0].textContent=t.shot;$("#screenshot small").textContent=t.shotSub;$("#status").textContent=stagedVersion?(language==="ru"?`Версия ${stagedVersion} установлена. Перезапустится только расширение.`:`Version ${stagedVersion} is installed. Reload the extension to finish.`):t.local;$("#language").value=language}
async function savePrefs(){await chrome.storage.local.set({osminogDisplayPrefs:{language,theme}})}
$("#open").addEventListener("click",async()=>{
  if(restartBusy)return;
  restartBusy=true;$("#open").disabled=true;
  try{
    await stagedCheck;
    if(stagedVersion){
      await OSMINOGUpdateHandoff.prepare({from:chrome.runtime.getManifest().version,to:stagedVersion});
      chrome.runtime.reload();
    }else{await chrome.runtime.sendMessage({type:"OPEN_EDITOR",query:"view=desk"});close()}
  }catch(error){$("#status").textContent=error.message||String(error);restartBusy=false;$("#open").disabled=false}
});$("#theme").addEventListener("click",()=>{theme=theme==="dark"?"light":"dark";render();savePrefs()});$("#language").addEventListener("change",e=>{language=e.target.value;render();savePrefs()});
$("#today").onclick=async()=>{await chrome.runtime.sendMessage({type:"OPEN_EDITOR",query:"view=inbox"});close()};
let fallbackCount;
async function todayCount(){
 const day=new Date().toLocaleDateString('en-CA');
 const counter=(await chrome.storage.local.get("osminogToday")).osminogToday;
 if(!counter && fallbackCount?.day!==day)fallbackCount={day,count:await osminogInitialTodayCount(day)};
 $("#today small").textContent=String(counter?(counter.day===day?counter.count:0):fallbackCount.count);
}
chrome.storage.onChanged.addListener((changes,area)=>{if(area==="local"&&changes.osminogToday)todayCount()});
$("#screenshot").addEventListener("click",async()=>{const status=$("#status"),t=text();status.textContent=t.capturing;try{const[tab]=await chrome.tabs.query({active:true,currentWindow:true});const dataUrl=await chrome.tabs.captureVisibleTab(tab.windowId,{format:"png"});await chrome.storage.local.set({richCraftPendingCapture:dataUrl,richCraftPendingAt:Date.now()});await chrome.runtime.sendMessage({type:"OPEN_SCREENSHOT"});close()}catch{status.textContent=t.captureBlocked}});
(async()=>{const got=await chrome.storage.local.get('osminogDisplayPrefs');const prefs=got.osminogDisplayPrefs||(await chrome.storage.local.get('briefCraftStudioV2')).briefCraftStudioV2||{};language=COPY[prefs.language]?prefs.language:'en';theme=prefs.theme||'dark';render()})();

// Fresh popup resources can finish a one-time repair without executing the old updater.
const stagedCheck=(async()=>{
  try{
    const installed=await OSMINOGUpdateHandoff.installedManifest();
    if(OSMINOGUpdateHandoff.compare(installed.version,chrome.runtime.getManifest().version)>0){
      stagedVersion=installed.version;
      document.documentElement.dataset.pendingUpdate=stagedVersion;
      $("#today").disabled=true;$("#screenshot").disabled=true;
      render();
    }
  }catch(error){console.warn('OSMINOG pending update check:',error.message)}
})();

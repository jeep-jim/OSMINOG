"""One-time checked source edits for Chrome 4.0.23, applied before PR checks."""
from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]
def edit(name,old,new,count=1):
 p=ROOT/name;s=p.read_text();n=s.count(old)
 if n!=count:raise RuntimeError(f'{name}: expected {count} anchors, got {n}: {old[:90]}')
 p.write_text(s.replace(old,new))
def regex(name,pattern,replacement,count=1):
 p=ROOT/name;s=p.read_text();s,n=re.subn(pattern,replacement,s,flags=re.M)
 if n!=count:raise RuntimeError(f'{name}: regex expected {count}, got {n}')
 p.write_text(s)
assert json.loads((ROOT/'manifest.json').read_text())['version']=='4.0.22','Unexpected starting version'
# Browser application retired in Chrome. Provider connection management remains.
regex('editor.html',r'<button id="workspaceBrowserMode"[^>]*>.*?</button>','')
regex('editor.html',r'\s*<button data-mode="browser"[^>]*>.*?</button>','')
regex('editor.html',r'\s*<button data-tool="browser"[^>]*>.*?</button>','')
edit('editor.html','<script src="osminog-browser-app.js"></script>','')
edit('editor.html','</body>','<link rel="stylesheet" href="osminog-workspace-polish.css"><script src="osminog-workspace-polish.js"></script></body>')
regex('editor.js',r';\$\("#workspaceBrowserMode"\)\?\.addEventListener\("click",\(\)=>\{[^\n]+?\}\);',';')
edit('editor.js','data-folder-create>＋ \'+(state.language==="ru"?"Новая папка":"New folder")+\'</button>', 'data-folder-create title="Новая папка" aria-label="Новая папка">＋</button>')
edit('editor.js','data-folder-open="\'+esc(f.id)+\'" style=', 'data-folder-open="\'+esc(f.id)+\'" data-capture="\'+!!globalThis.OSMINOGWorkspacePolish?.captureFolder(f)+\'" style=')
edit('editor.js','Number(f.members?.length||0)',"Number(globalThis.OSMINOGWorkspacePolish?.folderCount(f)??f.members?.length??0)")
# Library: remove redundant calendar button; keep its date filter in Search.
edit('osminog-library.js',",['libraryCalendar','Дата сохранения','calendar','calendar']",'')
edit('osminog-library.js','<button data-close aria-label="Закрыть">×</button></header>', '''<div class="lib-header-actions">${which==='capture'?'':'<button type="button" data-delete-selected disabled aria-label="Удалить выбранные материалы"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg><span>Удалить (0)</span></button>'}<button data-close aria-label="Закрыть">×</button></div></header>''')
edit('osminog-library.js','<option value="image">Изображения</option><option value="file">Файлы</option><option value="text">Текст</option>', '<option value="text">Текст</option><option value="media">Медиа</option><option value="file">Файлы</option>')
edit('osminog-library.js','<button type="button" data-delete-selected disabled>Удалить выбранное</button>','')
edit('osminog-library.js',"root.addEventListener('click',e=>{if(e.target.closest('[data-delete-selected]'))", "panel.addEventListener('click',e=>{if(e.target.closest('[data-delete-selected]'))")
edit('osminog-library.js',"const del=root.querySelector('[data-delete-selected]');del.disabled=!count;del.textContent=state.language==='ru'?'Удалить выбранное ('+count+')':'Delete selected ('+count+')", "const del=panel.querySelector('[data-delete-selected]');del.disabled=!count;del.querySelector('span').textContent=(state.language==='ru'?'Удалить (':'Delete (')+count+')'")
edit('osminog-library.js',"(!kind||(kind==='text'?['text','note','brief'].includes(o.type):o.type===kind))", "(!kind||globalThis.OSMINOGWorkspacePolish?.materialKind(o)===kind)")
edit('osminog-library.js',"globalThis.OSMINOGLibrary={open,close,drain,index:indexAll,matches,when,extract,reuseCapture,rememberPaste}", "globalThis.OSMINOGLibrary={open,close,drain,index:indexAll,matches,when,extract,reuseCapture,rememberPaste,destination:()=>({...cfg})}")
edit('osminog-library.js',"cfg=(await chrome.storage.local.get(KEY))[KEY]||{};renderCaptureStatus()", "cfg=(await chrome.storage.local.get(KEY))[KEY]||{};renderCaptureStatus();globalThis.OSMINOGWindowsFolders?.refresh?.();globalThis.renderLayers?.()")
edit('osminog-library.js',"if(folder)OSMINOGWindowsFolders.openVirtual(folder.id);else{selectObject(o.id,false);focusObject(o)}close()", "close();if(globalThis.OSMINOGWindowsFolders?.openObject)OSMINOGWindowsFolders.openObject(o.id);else{selectObject(o.id,false);focusObject(o)}")
# Saved text stays in its folder, but is discoverable from Layers.
edit('osminog-essential-ui.js',"const items=desktopObjects().slice().reverse().filter(o=>String(o.name||'').toLocaleLowerCase().includes(query))", "const items=desktopObjects().slice().reverse().filter(o=>[o.name,o.fileName,o.text,o.title].filter(Boolean).join(' ').toLocaleLowerCase().includes(query))")
edit('osminog-essential-ui.js',"root.append(row)}};", "root.append(row)}globalThis.OSMINOGWorkspacePolish?.appendStoredLayers(root,query)};")
edit('osminog-essential-ui.js',"text:'Текст',note:'Заметка',shape:","text:'Текст',note:'Заметка',brief:'Сохранённый текст',shape:")
edit('osminog-windows-folders.js','function folderCount(f){return (f.members?.length||0)+foldersNow().filter(x=>x.parentId===f.id).length}', 'function folderCount(f){return objectsNow().filter(o=>o.osminogFolderId===f.id).length+foldersNow().filter(x=>x.parentId===f.id).length}')
edit('osminog-windows-folders.js','el.dataset.size=f.desktopSize;el.style.left=', 'el.dataset.size=f.desktopSize;el.dataset.capture=String(!!globalThis.OSMINOGWorkspacePolish?.captureFolder(f));el.style.left=')
edit('osminog-windows-folders.js','el.querySelector("small").textContent=`${folderCount(f)} элемент(а)`;', 'el.querySelector("small").textContent=String(folderCount(f));el.querySelector("small").setAttribute("aria-label",`Элементов: ${folderCount(f)}`);')
regex('osminog-windows-folders.js',r'^  function openSavedObject\(id\)\{[^\n]+\}$', '''  function openSavedObject(id){const o=objectsNow().find(x=>x.id===id);if(!o)return false;closeExplorer();if(["text","note","brief","node","code","file","image","browser"].includes(o.type)&&globalThis.OSMINOGWorkdesk?.open){Promise.resolve(globalThis.OSMINOGWorkdesk.open(id)).catch(e=>notify(e.message));return true}state.selected=[id];globalThis.focusObject?.(o);globalThis.renderAll?.(true);notify("Материал выбран на холсте");return true}''')
edit('osminog-windows-folders.js','removeOldFolderUi();injectLayerControls()});return out}', 'removeOldFolderUi();renderDesktopFolders();injectLayerControls()});return out}')
edit('osminog-windows-folders.js','const exposed={close:closeExplorer,', 'const exposed={openObject:openSavedObject,close:closeExplorer,')
edit('osminog-workdesk.js','<button id="workdeskClose" aria-label="Закрыть">','<button id="workdeskEditImage" hidden>Редактировать</button><button id="workdeskClose" aria-label="Закрыть">')
edit('osminog-workdesk.js',"$('#workdeskDownload').hidden=!o.src&&!text;", "$('#workdeskEditImage').hidden=o.type!=='image';$('#workdeskEditImage').onclick=async()=>{const id=o.id;if(await close()){state.selected=[id];await globalThis.OSMINOGPhotoEditor?.open?.({id})}};$('#workdeskDownload').hidden=!o.src&&!text;")
edit('osminog-workdesk.js',"createObject('browser',{name:u.hostname,url:u.href,w:440,h:180,x:b.x-220,y:b.y-90})", "createObject('note',{name:u.hostname,url:u.href,text:u.href,w:440,h:180,x:b.x-220,y:b.y-90})")
edit('osminog-native-module-runtime.js','globalThis.OSMINOGBrowserApp?.newTab?.(String(def.url||""),{title:String(def.title||ext.title)})', 'globalThis.OSMINOGWorkspacePolish?.openExternal?.(String(def.url||""))')
edit('osminog-extension-studio.js','<button type="button" data-layout-copy>Редактировать копию</button>','')
regex('osminog-extension-studio.js',r'^      actions.querySelector\(\'\[data-layout-copy\]\'\)\.onclick=.*\n','')
edit('gpt-presence.js','const pos=`translate3d(${Math.round(pt.x-25)}px,${Math.round(pt.y-25)}px,0)`;', 'globalThis.OSMINOGWorkspacePolish?.pointEye(g,pt.x,pt.y);const pos=`translate3d(${Math.round(pt.x-25)}px,${Math.round(pt.y-25)}px,0)`;')
p=ROOT/'manifest.json';m=json.loads(p.read_text());m['version']='4.0.23';m['version_name']='4.0.23 · Workspace Polish';p.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
p=ROOT/'OSMINOG_BUILD.json';b=json.loads(p.read_text());b.update(version='4.0.23',versionName=m['version_name'],manifestVersion='4.0.23',artifact='OSMINOG-Chrome-4.0.23-WORKSPACE-POLISH.zip',baseVersion='4.0.22',runtimeVerified=False);b.pop('sourceCommit',None);b.pop('verificationRun',None);p.write_text(json.dumps(b,ensure_ascii=False,indent=2)+'\n')
notes={
 'ru':{'title':'Папки, поиск и рабочее пространство','items':['Новый список папок, зелёная папка сбора и заметные счётчики.','Текст и сохранённые файлы снова доступны в слоях; документы открываются по центру.','Поиск прикреплён к шапке: удаление сверху, фильтры текста, медиа и файлов.','Встроенный браузер и отдельный календарь убраны; сохранённые ссылки остаются.','Летающий помощник — красный глаз с морганием и направленным взглядом.']},
 'en':{'title':'Folders, search and workspace','items':['Redesigned folders, green capture destination and visible live counts.','Text and stored files are available in Layers; documents open centered.','Header-aligned search with top deletion and text, media and file filters.','Embedded browser and separate calendar removed; saved links retained.','Flying assistant redesigned as a blinking red lens with directional gaze.']},
 'de':{'title':'Ordner, Suche und Arbeitsbereich','items':['Neue Ordnerliste, grüner Speicherordner und sichtbare Zähler.','Text und gespeicherte Dateien in Ebenen; Dokumente öffnen zentriert.','Suche an der Kopfzeile mit Löschen oben und Filtern für Text, Medien und Dateien.','Eingebetteter Browser und separater Kalender entfernt; Links bleiben erhalten.','Fliegender Assistent als rotes, blinkendes Auge mit gerichteter Blickbewegung.']},
 'es':{'title':'Carpetas, búsqueda y espacio de trabajo','items':['Carpetas renovadas, destino de captura verde y contadores visibles.','Texto y archivos guardados en Capas; documentos centrados.','Búsqueda junto a la cabecera, eliminación arriba y filtros de texto, medios y archivos.','Se retiran el navegador integrado y el calendario separado; se conservan los enlaces.','Asistente flotante como ojo rojo con parpadeo y mirada direccional.']},
 'ja':{'title':'フォルダー・検索・作業領域','items':['フォルダー一覧を改善し、保存先を緑色で表示。件数を見やすくしました。','テキストと保存済みファイルをレイヤーで表示し、文書を中央で開きます。','検索をヘッダーに固定し、上部に削除ボタンと種類フィルターを配置。','内蔵ブラウザーと独立カレンダーを削除。保存済みリンクは保持します。','移動方向を見る、まばたきする赤い目のアシスタント。']},
 'zh':{'title':'文件夹、搜索与工作区','items':['重新设计文件夹列表，以绿色标记捕获目标并显示实时数量。','图层中显示文本和已保存文件，文档居中打开。','搜索紧贴顶部栏，删除按钮置顶，支持文本、媒体和文件筛选。','移除内置浏览器和独立日历，保留已保存链接。','悬浮助手改为会眨眼并朝移动方向看的红色眼睛。']}
}
edit('osminog-release-notes.js','const catalog={',"const catalog={\n'4.0.23':"+json.dumps(notes,ensure_ascii=False)+',')
edit('osminog-release-notes.js',"let lastVersion='4.0.22'","let lastVersion='4.0.23'")
edit('osminog-release-notes.js',"||catalog['4.0.22']","||catalog['4.0.23']")
(ROOT/'RELEASE_NOTES_CHROME_4.0.23.md').write_text('# OSMINOG Chrome 4.0.23 — Workspace Polish\n\n'+''.join('## '+lang+'\n'+''.join('- '+item+'\n' for item in value['items'])+'\n' for lang,value in notes.items())+'## Verification\nChrome and native Windows checks run separately. Existing user data and the fixed Chrome identity are preserved. No test on the owner device or Chrome Web Store publication is claimed.\n')
p=ROOT/'.github/workflows/agent-media-3207.yml'
s=p.read_text().replace('4.0.22','4.0.23').replace('workspace unification','workspace polish').replace('Workspace Unification','Workspace Polish').replace('WORKSPACE-FIX','WORKSPACE-POLISH')
assert s.count('      - run: node tests/library-420.cjs')==1
s=s.replace('      - run: node tests/library-420.cjs','      - run: node tests/workspace-423.cjs\n      - run: node tests/library-420.cjs')
s=s.replace("--exclude='desktop/'", "--exclude='desktop/' --exclude='osminog-browser-app.js'")
s=s.replace('            artifacts/canvas-ux-408-results.json','            artifacts/workspace-423-results.json\n            artifacts/canvas-ux-408-results.json')
p.write_text(s)
print('Applied 4.0.23 checked source edits')

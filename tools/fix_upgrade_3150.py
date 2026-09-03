from pathlib import Path
import re

# Apply the editor/file-lab part structurally before the main migration. The current
# editor keeps its workbench implementation on one long line, so exact string
# replacement is intentionally avoided here.
p=Path('editor.js')
s=p.read_text(encoding='utf-8')
old='    if(ext==="csv"||ext==="tsv"||mime.includes("csv")||mime.includes("spreadsheet")||mime.includes("excel"))return"table";'
new='''    if(ext==="csv"||ext==="tsv"||mime.includes("csv"))return"table";
    if(["xlsx","xls","ods"].includes(ext)||mime.includes("spreadsheet")||mime.includes("excel"))return"sheet";
    if(["smc","sfc","nes","gb","gbc","gba","n64","z64"].includes(ext))return"rom";
    if(ext==="apk"||mime.includes("android.package"))return"apk";'''
if s.count(old)!=1: raise SystemExit(f'file kind anchor expected 1 got {s.count(old)}')
s=s.replace(old,new,1)
body='''  function workbenchBody(obj){const k=kindOf(obj),raw=dataText(obj.src);if(k==="pdf")return`<iframe class="bc-workbench-pdf" src="${obj.src}#toolbar=1&navpanes=1"></iframe>`;if(k==="audio")return`<div class="bc-workbench-media"><strong>${esc(obj.fileName||obj.name)}</strong><audio controls preload="metadata" src="${obj.src}"></audio><small>${esc(obj.mime||"audio")}</small></div>`;if(k==="video")return`<div class="bc-workbench-media"><strong>${esc(obj.fileName||obj.name)}</strong><video controls preload="metadata" src="${obj.src}"></video><small>${esc(obj.mime||"video")}</small></div>`;if(k==="markdown")return`<div class="bc-workbench-split"><textarea data-file-edit>${esc(raw)}</textarea><article class="bc-markdown-preview">${markdownHtml(raw)}</article></div>`;if(k==="json"||k==="code")return`<div class="bc-workbench-split bc-code-workbench"><textarea data-file-edit spellcheck="false">${esc(raw)}</textarea><pre><code>${escLines(k==="json"?(()=>{try{return JSON.stringify(JSON.parse(raw),null,2)}catch{return raw}})():raw)}</code></pre></div>`;if(k==="table")return`<div class="bc-workbench-table">${tablePreview(raw,extOf(obj)==="tsv"?"\\t":",")}</div>`;if(k==="zip")return`<div class="bc-workbench-archive">${zipEntries(obj).map(e=>`<div><span>${esc(e.name)}</span><small>${formatBytes(e.size)}</small></div>`).join("")}</div>`;if(k==="sheet"||k==="rom"||k==="apk")return`<div class="bc-workbench-generic bc-file-lab">${fileIcon(obj)}<strong>${esc(obj.fileName||obj.name)}</strong><small>${k==="sheet"?text("Табличный бинарный файл. Его байты доступны приложениям OSMINOG через assets.read.","Binary spreadsheet. OSMINOG apps can read its bytes through assets.read."):k==="rom"?text("ROM-файл готов для эмуляторного модуля. OSMINOG передаёт его байты приложению без копирования в чат.","ROM is ready for an emulator module. OSMINOG passes its bytes directly to the app without copying them into chat."):text("APK доступен для анализа как пакет. Chrome не запускает Android-приложения нативно; AI может построить инспектор/анализатор вокруг файла.","APK is available for package analysis. Chrome cannot natively execute Android apps; AI can build an inspector/analyzer around it.")}</small><code>osminog://asset/${esc(obj.id)}</code></div>`;return`<div class="bc-workbench-generic">${fileIcon(obj)}<strong>${esc(obj.fileName||obj.name)}</strong><small>${esc(obj.mime||"")}</small></div>`}'''
s,n=re.subn(r'  function workbenchBody\(obj\)\{.*?\n(?=  function renderWorkbench\()',lambda _m: body+'\n',s,count=1,flags=re.S)
if n!=1: raise SystemExit(f'workbench function expected 1 got {n}')
p.write_text(s,encoding='utf-8')

css=Path('editor.css')
cs=css.read_text(encoding='utf-8')
marker='/* OSMINOG 3.15.0 · Interactive Capability Runtime */'
if marker not in cs:
    cs+='\n'+marker+'\n.bc-workbench-media{min-height:100%;display:grid;place-items:center;align-content:center;gap:18px;padding:32px}.bc-workbench-media audio{width:min(720px,90%)}.bc-workbench-media video{max-width:min(900px,92%);max-height:68vh;border-radius:18px;background:#000}.bc-file-lab code{display:block;margin-top:10px;padding:8px 10px;border-radius:9px;background:var(--surface);border:1px solid var(--line);font-size:10px;user-select:all}\n'
css.write_text(cs,encoding='utf-8')

# Remove the obsolete exact-match editor block from the main upgrade script. The
# rest of that migration remains unchanged.
u=Path('tools/upgrade_interactive_runtime_3150.py')
us=u.read_text(encoding='utf-8')
us,n=re.subn(r'# editor: real audio/video workbench \+ explicit binary file lab states\n.*?(?=# owner gate in access center)', '# editor/file-lab migration is applied structurally by tools/fix_upgrade_3150.py\n\n', us, count=1, flags=re.S)
if n!=1: raise SystemExit(f'obsolete editor block expected 1 got {n}')
u.write_text(us,encoding='utf-8')
print('editor migration applied; main upgrade normalized')

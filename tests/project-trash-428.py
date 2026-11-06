from playwright.sync_api import sync_playwright
from pathlib import Path
import os,tempfile,sys
import time
with sync_playwright() as pw:
 d=str(Path(os.environ.get('EXT_DIR','.')).resolve())
 ctx=pw.chromium.launch_persistent_context(tempfile.mkdtemp(), channel='chromium',headless=False,ignore_default_args=['--disable-extensions'],args=['--no-sandbox','--disable-extensions-except='+d,'--load-extension='+d])
 sw=ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event('serviceworker')
 root=sw.url.rsplit('/',1)[0]
 p=ctx.new_page();p.set_default_timeout(7000)
 p.on('pageerror',lambda e:print('PAGEERROR',e))
 p.goto(root+'/editor.html');p.wait_for_timeout(650)
 p.evaluate("""async()=>{await chrome.storage.local.set({osminogDisplayPrefs:{language:'ru',theme:'dark'},briefCraftStudioV2:{projects:[{id:'one',name:'Тестовый проект',objects:[]},{id:'two',name:'Другой',objects:[]}],activeProject:'one'}})}""")
 p.reload();p.wait_for_selector('#osminogStorageOnboarding');p.locator('#osminogStorageOnboarding button').last.click();p.locator('#showProjects').click();p.locator('.project-tile').first.hover()
 p.locator('.project-remove').first.click();p.get_by_role('button',name='Отмена',exact=True).last.click();assert p.locator('.project-tile').count()==2
 p.locator('.project-remove').first.click();p.get_by_role('button',name='В корзину',exact=True).last.click();p.wait_for_function('document.querySelectorAll(".project-tile").length===1')
 p.reload();p.wait_for_selector('#osminogStorageOnboarding');p.locator('#osminogStorageOnboarding button').last.click();p.locator('#showProjects').click();assert p.locator('.project-tile').count()==1
 p.locator('#trashToggle').click();p.get_by_role('button',name='Восстановить').click();p.locator('#trashToggle').click();p.wait_for_function('document.querySelectorAll(".project-tile").length===2')
 p.locator('.project-tile').first.hover();p.locator('.project-remove').first.click();p.get_by_role('button',name='В корзину',exact=True).last.click();p.locator('#trashToggle').click();p.get_by_role('button',name='Удалить навсегда').click();p.get_by_role('dialog').get_by_role('button',name='Удалить навсегда').click();p.wait_for_function('!document.querySelector(".trash-card")');print('PASS cancel/move/reload/restore/purge')
 p.evaluate("""async()=>{await OSMINOGTrash.change('move','expired',{id:'expired',name:'X',objects:[]});const index=await OSMINOGTrash.read();index.expired.expires=Date.now()-1;await chrome.storage.local.set({osminogTrashIndex:index});}""")
 p.wait_for_function("""async()=>!!(await OSMINOGTrash.read()).expired.purged""");print('PASS background expiry')
 pop=ctx.new_page();pop.goto(root+'/popup.html');pop.locator('#today small').wait_for();assert pop.locator('#today small').inner_text()=='0';pop.evaluate("""()=>chrome.storage.local.set({osminogToday:{day:new Date().toLocaleDateString('en-CA'),count:3}})""");pop.wait_for_function('document.querySelector("#today small").textContent==="3"')
 with ctx.expect_page() as opened: pop.locator('#today').click()
 view=opened.value;view.locator('#osminogWindowsExplorer:visible').wait_for(timeout=15000)
 assert view.locator('#osminogWindowsExplorerTitle').inner_text()=='Входящие'
 assert view.locator('.osminog-win-folder-icon[data-capture=true]').count()==1
 assert view.evaluate("getComputedStyle(document.querySelector('#osminogWindowsExplorerStatus')).fontSize")=='16px'
 assert not view.locator('#osminogDesktopFolderIcon').is_visible()
 print('PASS popup, green inbox, desk and readable footer');ctx.close()

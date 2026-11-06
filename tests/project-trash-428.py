"""Exercise real extension controls without relaxing the extension CSP."""
from playwright.sync_api import sync_playwright, expect
from pathlib import Path
import os
import tempfile
import time


def wait_storage(page, expression, timeout=30):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if page.evaluate(expression):
            return
        page.wait_for_timeout(100)
    raise AssertionError('Storage condition not reached: ' + expression)


with sync_playwright() as pw, tempfile.TemporaryDirectory() as profile:
    d = str(Path(os.environ.get('EXT_DIR', '.')).resolve())
    ctx = pw.chromium.launch_persistent_context(
        profile, channel='chromium', headless=False,
        ignore_default_args=['--disable-extensions'],
        args=['--no-sandbox', '--disable-extensions-except=' + d, '--load-extension=' + d])
    try:
        sw = ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event('serviceworker')
        root = sw.url.rsplit('/', 1)[0]
        p = ctx.new_page()
        p.set_default_timeout(15000)
        p.on('pageerror', lambda e: print('PAGEERROR', e))
        p.goto(root + '/editor.html')
        p.wait_for_timeout(650)
        p.evaluate("""async()=>{await chrome.storage.local.set({osminogDisplayPrefs:{language:'ru',theme:'dark'},briefCraftStudioV2:{projects:[{id:'one',name:'Тестовый проект',objects:[]},{id:'two',name:'Другой',objects:[]}],activeProject:'one'}})}""")
        p.reload()
        p.wait_for_selector('#osminogStorageOnboarding')
        p.locator('#osminogStorageOnboarding button').last.click()
        p.locator('#showProjects').click()
        p.locator('.project-tile').first.hover()
        p.locator('.project-remove').first.click()
        p.get_by_role('button', name='Отмена', exact=True).last.click()
        expect(p.locator('.project-tile')).to_have_count(2)
        p.locator('.project-remove').first.click()
        p.get_by_role('button', name='В корзину', exact=True).last.click()
        expect(p.locator('.project-tile')).to_have_count(1)
        p.reload()
        p.wait_for_selector('#osminogStorageOnboarding')
        p.locator('#osminogStorageOnboarding button').last.click()
        p.locator('#showProjects').click()
        expect(p.locator('.project-tile')).to_have_count(1)
        p.locator('#trashToggle').click()
        p.get_by_role('button', name='Восстановить').click()
        p.locator('#trashToggle').click()
        expect(p.locator('.project-tile')).to_have_count(2)
        p.locator('.project-tile').first.hover()
        p.locator('.project-remove').first.click()
        p.get_by_role('button', name='В корзину', exact=True).last.click()
        p.locator('#trashToggle').click()
        p.get_by_role('button', name='Удалить навсегда').click()
        p.get_by_role('dialog').get_by_role('button', name='Удалить навсегда').click()
        expect(p.locator('.trash-card')).to_have_count(0)
        print('PASS cancel/move/reload/restore/purge')
        p.evaluate("""async()=>{await OSMINOGTrash.change('move','expired',{id:'expired',name:'X',objects:[]});const index=await OSMINOGTrash.read();index.expired.expires=Date.now()-1;await chrome.storage.local.set({osminogTrashIndex:index});}""")
        wait_storage(p, "async()=>!!(await OSMINOGTrash.read()).expired?.purged")
        print('PASS background expiry')
        pop = ctx.new_page()
        pop.goto(root + '/popup.html')
        expect(pop.locator('#today small')).to_have_text('0')
        pop.evaluate("""()=>chrome.storage.local.set({osminogToday:{day:new Date().toLocaleDateString('en-CA'),count:3}})""")
        expect(pop.locator('#today small')).to_have_text('3')
        with ctx.expect_page() as opened:
            pop.locator('#today').click()
        view = opened.value
        view.locator('#osminogWindowsExplorer:visible').wait_for(timeout=15000)
        expect(view.locator('#osminogWindowsExplorerTitle')).to_have_text('Входящие')
        expect(view.locator('.osminog-win-folder-icon[data-capture=true]')).to_have_count(1)
        assert view.evaluate("() => getComputedStyle(document.querySelector('#osminogWindowsExplorerStatus')).fontSize") == '16px'
        expect(view.locator('#osminogDesktopFolderIcon')).not_to_be_visible()
        print('PASS popup, green inbox, desk and readable footer')
    except Exception:
        Path('test-results').mkdir(exist_ok=True)
        for index, page in enumerate(ctx.pages):
            try:
                page.screenshot(path=f'test-results/project-trash-{index}.png', full_page=True)
            except Exception:
                pass
        raise
    finally:
        ctx.close()

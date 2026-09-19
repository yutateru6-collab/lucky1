"""Exercise the actual deployed gentle app in a disposable browser profile."""
import json, os, pathlib, shutil
from playwright.sync_api import sync_playwright, expect
OUT=pathlib.Path('gentle-live-results');OUT.mkdir(exist_ok=True)
URL='https://lucky1.itisnowornever271.workers.dev/gentle/'
errors=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,locale='ja-JP',timezone_id='Asia/Tokyo',reduced_motion='reduce')
    page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    response=page.goto(URL,wait_until='networkidle')
    assert response.status==200
    expect(page.locator('body')).to_have_attribute('data-version','4.1.0')
    expect(page.locator('#draw-button')).to_be_visible()
    expect(page.locator('#quick-start')).to_be_visible()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(OUT/'public-home-mobile.png'),full_page=True)
    page.locator('#quick-start').click();expect(page.locator('#quick-dialog')).to_be_visible()
    assert page.locator('#quick-note-panel').is_hidden()
    page.locator('#quick-draw').click();expect(page.locator('#quick-result')).to_be_visible()
    assert page.locator('#quick-result-title').inner_text() in ('やってみる','今回はやめる')
    assert page.evaluate("localStorage.getItem('lucky.records.v2')") is None
    page.screenshot(path=str(OUT/'public-quick-result-mobile.png'),full_page=True)
    page.locator('#quick-done').click();expect(page.locator('#quick-dialog')).not_to_be_visible()
    page.locator('#draw-button').click();expect(page.locator('#result-view')).to_be_visible()
    assert page.locator('#result-title').inner_text() in ('やってみる','今回は見送る')
    page.locator('[data-choice="no"]').click();page.locator('[data-feeling="relieved"]').click()
    page.screenshot(path=str(OUT/'public-result-mobile.png'),full_page=True)
    page.locator('#save-result').click();expect(page.locator('#saved-view')).to_be_visible()
    records=page.evaluate("JSON.parse(localStorage.getItem('lucky.records.v2'))")
    assert len(records)==1 and records[0]['choice']=='no'
    page.locator('#saved-journal').click();expect(page.locator('#history-list .record-row')).to_have_count(1)
    page.screenshot(path=str(OUT/'public-history-mobile.png'),full_page=True)
    page.locator('[data-nav="home"]').click()
    page.evaluate('navigator.serviceWorker.ready.then(()=>true)')
    page.wait_for_function('navigator.serviceWorker.controller!==null')
    assert '/gentle/' in page.evaluate('navigator.serviceWorker.controller.scriptURL')
    ctx.set_offline(True);page.reload(wait_until='domcontentloaded')
    expect(page.locator('#draw-button')).to_be_visible()
    expect(page.locator('#quick-start')).to_be_visible()
    page.locator('#quick-start').click();page.locator('#quick-draw').click();expect(page.locator('#quick-result')).to_be_visible();page.locator('#quick-done').click()
    page.locator('#draw-button').click();expect(page.locator('#result-view')).to_be_visible()
    ctx.close()
    desktop=browser.new_context(viewport={'width':1440,'height':1000},locale='ja-JP')
    q=desktop.new_page();q.goto(URL,wait_until='networkidle');expect(q.locator('body')).to_have_attribute('data-version','4.1.0')
    q.screenshot(path=str(OUT/'public-home-desktop.png'),full_page=True)
    assert q.evaluate('document.documentElement.scrollWidth<=innerWidth')
    desktop.close();browser.close()
assert not errors,errors
report={'url':URL,'version':'4.1.0','httpStatus':200,'passed':True,'checks':['live mobile and desktop render','quick mode draws with zero pre-input and no autosave','draw without memo','independent choice saved in isolated localStorage','calendar entry visible','scoped service worker offline reload and draw'],'browserErrors':errors}
(OUT/'public-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))

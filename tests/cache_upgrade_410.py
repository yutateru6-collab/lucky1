"""Upgrade a real 4.0.9 worker on the same origin; preserve saved notes.
Then block model download, go offline, and finish BOTH flows with the same outcomes.
"""
import json, pathlib, threading, mimetypes, os, time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright, expect
ROOT=pathlib.Path(__file__).resolve().parents[1]
BROWSER=os.environ.get('MOTION_BROWSER','webkit')
OUT=ROOT/'upgrade-results'/BROWSER;OUT.mkdir(parents=True,exist_ok=True)
OLD=ROOT/'.upgrade/old/public'
assert (OLD/'sw.js').is_file(),'Prepare previous public/ files before running this test'
active={'root':OLD,'deny_model':False}
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw):super().__init__(*a,directory=str(active['root']),**kw)
    def log_message(self,*_):pass
    def do_GET(self):
        if active['deny_model'] and self.path.split('?')[0].endswith('.glb'):
            self.send_error(503,'Model deliberately unavailable');return
        super().do_GET()
    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; object-src 'none'")
        super().end_headers()
mimetypes.add_type('text/javascript','.mjs')
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/';report={'browser':BROWSER,'passed':False}
def poll(p,fn,seconds=20):
    until=time.monotonic()+seconds
    while time.monotonic()<until:
        if p.evaluate(fn):return
        p.wait_for_timeout(100)
    raise AssertionError(fn)
try:
  with sync_playwright() as p:
    opts={'headless':True}
    if BROWSER=='chromium':opts['args']=['--no-sandbox','--enable-unsafe-swiftshader']
    browser=getattr(p,BROWSER).launch(**opts)
    ctx=browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,locale='ja-JP',reduced_motion='reduce',record_video_dir=str(OUT/'raw'))
    page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(url,wait_until='networkidle');expect(page.locator('meta[name="lucky-version"]')).to_have_attribute('content','4.0.9')
    poll(page,'async()=>Boolean(navigator.serviceWorker.controller) && (await caches.keys()).includes("lucky-shell-v4.0.9")')
    raw=page.evaluate("""()=>{const raw=JSON.stringify([{version:2,id:'upgrade-fixture',note:'更新前から残す検証メモ',game:'coin',result:'yes',choice:'no',beforeMood:null,beforeText:'',feeling:null,reflection:'消さない',createdAt:new Date().toISOString(),localDate:'2026-09-21'}]);localStorage.setItem('lucky.records.v2',raw);localStorage.setItem('lucky.theme.v1','dark');return raw;}""")
    active.update(root=ROOT/'public',deny_model=True)
    page.evaluate('async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update();}')
    poll(page,'async()=>{const keys=await caches.keys();return keys.includes("lucky-shell-v4.0.10") && !keys.includes("lucky-shell-v4.0.9")}')
    page.reload(wait_until='networkidle');expect(page.locator('meta[name="lucky-version"]')).to_have_attribute('content','4.0.10')
    assert page.evaluate("localStorage.getItem('lucky.records.v2')")==raw
    ctx.set_offline(True);page.reload(wait_until='domcontentloaded')
    page.locator('#quick-start-home').tap();page.locator('[data-quick-pick="heads"]').tap();page.locator('#quick-draw').tap()
    expect(page.locator('#quick-animation-stage')).to_have_attribute('data-renderer','fallback',timeout=8000)
    expect(page.locator('#quick-result')).to_be_visible(timeout=24000)
    page.screenshot(path=str(OUT/'offline-quick-result.png'));page.locator('#quick-finish').tap()
    page.locator('#home-start').tap();page.locator('#decision-note').fill('更新後のカード確認');page.locator('#memo-next').tap();page.locator('#mood-skip').tap();page.locator('#flow-methods [data-method="cards"]').tap();page.locator('#method-next').tap()
    page.get_by_role('button',name='左のカードを引く',exact=True).tap()
    expect(page.locator('#normal-animation-stage')).to_be_visible()
    expect(page.locator('#result-view')).to_be_visible(timeout=25000)
    page.screenshot(path=str(OUT/'offline-memo-result.png'))
    assert page.evaluate("localStorage.getItem('lucky.records.v2')")==raw
    assert not errors,errors
    report.update(passed=True,oldVersion='4.0.9',newVersion='4.0.10',savedNotesPreserved=True,offlineQuickResult=True,offlineMemoResult=True,missingModelDidNotBlockWorker=True,errors=errors)
    v=page.video;ctx.close();v.save_as(str(OUT/'upgrade-offline.webm'));browser.close()
finally:
  (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));server.shutdown()
print(json.dumps(report,ensure_ascii=False,indent=2))

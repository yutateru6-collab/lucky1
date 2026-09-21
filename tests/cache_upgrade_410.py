"""Real 4.0.9 -> 4.0.10 worker upgrade, preserving notes, then lost network.
Chromium uses Playwright offline mode. WebKit uses a server-side socket cutoff:
its automation offline+reload can fail outside the app's service-worker handler.
No responses are served after cutoff; both entry flows must still finish.
"""
import json, pathlib, threading, mimetypes, os, time, socket
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright, expect
ROOT=pathlib.Path(__file__).resolve().parents[1]
BROWSER=os.environ.get('MOTION_BROWSER','webkit')
OUT=ROOT/'upgrade-results'/BROWSER;OUT.mkdir(parents=True,exist_ok=True)
OLD=ROOT/'.upgrade/old/public'
assert (OLD/'sw.js').is_file(),'Prepare previous public/ files before running this test'
active={'root':OLD,'deny_model':False,'disconnected':False,'refused':0,'servedAfterDisconnect':0}
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw):super().__init__(*a,directory=str(active['root']),**kw)
    def log_message(self,*_):pass
    def do_GET(self):
        if active['disconnected']:
            active['refused']+=1
            self.close_connection=True
            try:self.connection.shutdown(socket.SHUT_RDWR)
            except OSError:pass
            self.connection.close();return
        if active['deny_model'] and self.path.split('?')[0].endswith('.glb'):
            self.send_error(503,'Model deliberately unavailable');return
        super().do_GET()
    def end_headers(self):
        self.send_header('Cache-Control','no-cache, no-store' if self.path.startswith('/sw.js') else 'no-cache')
        self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; object-src 'none'")
        super().end_headers()
mimetypes.add_type('text/javascript','.mjs')
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/';report={'browser':BROWSER,'passed':False,'networkFailureMode':'socket-cutoff' if BROWSER=='webkit' else 'browser-offline'}
def poll(p,fn,seconds=20):
    until=time.monotonic()+seconds
    while time.monotonic()<until:
        if p.evaluate(fn):return
        p.wait_for_timeout(100)
    raise AssertionError(fn)
def save():
    (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
try:
  with sync_playwright() as p:
    opts={'headless':True}
    if BROWSER=='chromium':opts['args']=['--no-sandbox','--enable-unsafe-swiftshader']
    browser=getattr(p,BROWSER).launch(**opts)
    ctx=browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,locale='ja-JP',reduced_motion='reduce',record_video_dir=str(OUT/'raw'))
    page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    try:
        page.goto(url,wait_until='networkidle');expect(page.locator('meta[name="lucky-version"]')).to_have_attribute('content','4.0.9')
        poll(page,'async()=>Boolean(navigator.serviceWorker.controller) && (await caches.keys()).includes("lucky-shell-v4.0.9")')
        raw=page.evaluate("""()=>{const raw=JSON.stringify([{version:2,id:'upgrade-fixture',note:'更新前から残す検証メモ',game:'coin',result:'yes',choice:'no',beforeMood:null,beforeText:'',feeling:null,reflection:'消さない',createdAt:new Date().toISOString(),localDate:'2026-09-21'}]);localStorage.setItem('lucky.records.v2',raw);localStorage.setItem('lucky.theme.v1','dark');return raw;}""")
        active.update(root=ROOT/'public',deny_model=True)
        page.evaluate('async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update();}')
        poll(page,'async()=>{const keys=await caches.keys(),reg=await navigator.serviceWorker.getRegistration();return keys.includes("lucky-shell-v4.0.10") && !keys.includes("lucky-shell-v4.0.9") && reg.active?.state==="activated" && navigator.serviceWorker.controller?.state==="activated"}')
        page.reload(wait_until='networkidle');expect(page.locator('meta[name="lucky-version"]')).to_have_attribute('content','4.0.10')
        poll(page,'async()=>{const reg=await navigator.serviceWorker.getRegistration();return reg.active?.state==="activated" && navigator.serviceWorker.controller?.state==="activated" && !reg.installing && !reg.waiting}')
        report['beforeDisconnect']=page.evaluate('async()=>{const reg=await navigator.serviceWorker.getRegistration(),c=await caches.open("lucky-shell-v4.0.10");return {active:reg.active.state,controller:navigator.serviceWorker.controller.state,cached:(await c.keys()).map(r=>r.url)}}')
        assert any('/reveal-runtime.mjs' in u for u in report['beforeDisconnect']['cached'])
        assert page.evaluate("localStorage.getItem('lucky.records.v2')")==raw
        save()
        # Use an actual network failure on WebKit, not its unsupported worker-routing emulation.
        active['disconnected']=True
        if BROWSER=='chromium':ctx.set_offline(True)
        page.reload(wait_until='domcontentloaded')
        expect(page.locator('meta[name="lucky-version"]')).to_have_attribute('content','4.0.10')
        page.locator('#quick-start-home').tap();page.locator('[data-quick-pick="heads"]').tap();page.locator('#quick-draw').tap()
        stage=page.locator('#quick-animation-stage')
        expect(stage).to_have_attribute('data-renderer','fallback',timeout=8000)
        expect(page.locator('#quick-result')).to_be_visible(timeout=24000)
        expect(stage.locator('.quick-static-coin')).to_have_text('表' if stage.get_attribute('data-landed')=='heads' else '裏')
        page.screenshot(path=str(OUT/'offline-quick-result.png'));page.locator('#quick-finish').tap()
        page.locator('#home-start').tap();page.locator('#decision-note').fill('更新後のカード確認');page.locator('#memo-next').tap();page.locator('#mood-skip').tap();page.locator('#flow-methods [data-method="cards"]').tap();page.locator('#method-next').tap()
        page.get_by_role('button',name='左のカードを引く',exact=True).tap()
        expect(page.locator('#normal-animation-stage')).to_be_visible()
        expect(page.locator('#result-view')).to_be_visible(timeout=25000)
        page.screenshot(path=str(OUT/'offline-memo-result.png'))
        assert page.evaluate("localStorage.getItem('lucky.records.v2')")==raw
        if BROWSER=='webkit':assert active['refused']>0,'Must encounter real failed connections'
        assert not errors,errors
        report.update(passed=True,oldVersion='4.0.9',newVersion='4.0.10',savedNotesPreserved=True,offlineQuickResult=True,offlineMemoResult=True,missingModelDidNotBlockWorker=True,refusedConnections=active['refused'],errors=errors)
    except Exception as e:
        report['error']=str(e)
        try:page.screenshot(path=str(OUT/'failure.png'))
        except Exception:pass
        raise
    finally:
        v=page.video;ctx.close();v.save_as(str(OUT/'upgrade-offline.webm'));browser.close();save()
finally:
  save();server.shutdown()
print(json.dumps(report,ensure_ascii=False,indent=2))

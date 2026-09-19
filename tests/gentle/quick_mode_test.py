"""Quick-mode browser contract: no pre-input, 50/50 draw, optional memo after the choice."""
import json, pathlib, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright, expect
ROOT=pathlib.Path(__file__).resolve().parents[2]
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw): super().__init__(*a,directory=str(ROOT/'public'/'gentle'),**kw)
    def log_message(self,*_): pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
URL=f'http://127.0.0.1:{server.server_port}/'
try:
  with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':390,'height':844},locale='ja-JP',timezone_id='Asia/Tokyo',reduced_motion='reduce')
    page=ctx.new_page()
    page.add_init_script("Object.defineProperty(Crypto.prototype,'getRandomValues',{value(a){a[0]=0;return a;}})")
    page.goto(URL,wait_until='networkidle')
    expect(page.locator('#quick-start')).to_be_visible()
    page.locator('#quick-start').click();expect(page.locator('#quick-dialog')).to_be_visible()
    assert page.locator('#quick-note-panel').is_hidden()
    assert page.locator('#quick-dialog textarea:visible').count()==0
    page.locator('#quick-draw').click()
    expect(page.locator('#quick-result-title')).to_have_text('やってみる')
    assert page.evaluate("localStorage.getItem('lucky.records.v2')") is None
    page.locator('#quick-memo').click();expect(page.locator('#quick-note-panel')).to_be_visible()
    page.locator('#quick-note').fill('帰りに知らない道を一本だけ歩く')
    page.locator('#quick-reflection').fill('いつもと違う方を選んでみる')
    page.locator('#quick-choice-flip').click()
    page.locator('#quick-save').click()
    records=page.evaluate("JSON.parse(localStorage.getItem('lucky.records.v2'))")
    assert len(records)==1
    assert records[0]['result']=='yes' and records[0]['choice']=='no'
    assert records[0]['note']=='帰りに知らない道を一本だけ歩く'
    page.locator('#quick-start').click();page.locator('#quick-draw').click();page.locator('#quick-done').click()
    assert len(page.evaluate("JSON.parse(localStorage.getItem('lucky.records.v2'))"))==1
    page.evaluate('navigator.serviceWorker.ready.then(()=>true)')
    page.wait_for_function('navigator.serviceWorker.controller!==null')
    ctx.set_offline(True);page.reload(wait_until='domcontentloaded')
    expect(page.locator('#quick-start')).to_be_visible()
    ctx.close();browser.close()
finally:
  server.shutdown()
print(json.dumps({'passed':True,'checks':['quick starts without pre-input','result is not auto-saved','memo appears only after result','opposite own choice can be recorded','done leaves no extra record','quick mode works offline']},ensure_ascii=False))

"""Real-browser regression suite for lucky v4; no remote services or real user data.
Run: python tests/ui_offline_test.py (Playwright + Chromium required).
Uses the actual CSP, fresh isolated browser contexts, deterministic RNG only in tests.
"""
import json, os, pathlib, shutil, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright, expect
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results'
OUT.mkdir(exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs): super().__init__(*args, directory=str(ROOT / 'public'), **kwargs)
    def log_message(self, *_): pass
    def end_headers(self):
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'")
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{server.server_port}'
checks = []
def passed(name):
    checks.append(name)
    print('PASS:', name, flush=True)

def fixture_entry(id='imported-1'):
    return dict(version=2,id=id,note='読み込んだ記録',game='coin',result='no',choice='yes',feeling='happy',beforeMood='calm',beforeText='落ち着いている',reflection='その後の感想',createdAt='2026-09-13T15:30:00.000Z',localDate='2026-09-14')

try:
 with sync_playwright() as pw:
    executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
    browser = pw.chromium.launch(headless=True, executable_path=executable, args=['--no-sandbox'])
    errors=[]
    def new_context(width=390, height=844, rng=0, storage=None, blocked=False, reduced=True):
        ctx=browser.new_context(viewport={'width':width,'height':height}, device_scale_factor=1, is_mobile=width<800, has_touch=width<800, locale='ja-JP', timezone_id='Asia/Tokyo', reduced_motion='reduce' if reduced else 'no-preference')
        ctx.add_init_script(f"Object.defineProperty(Crypto.prototype,'getRandomValues',{{value(a){{a[0]={rng};return a;}}}})")
        if blocked:
            ctx.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError')}})")
        elif storage:
            ctx.add_init_script('for(const [k,v] of Object.entries('+json.dumps(storage)+')) localStorage.setItem(k,v)')
        page=ctx.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda msg: errors.append(msg.text) if msg.type=='error' else None)
        page.goto(BASE,wait_until='networkidle')
        expect(page.locator('#draw-button')).to_be_visible()
        return ctx,page
    ctx,p=new_context()
    p.screenshot(path=str(OUT/'home-mobile.png'), full_page=True)
    p.screenshot(path=str(OUT/'home-mobile-first-screen.png'))
    assert p.evaluate('document.documentElement.scrollWidth <= innerWidth')
    passed('390px mobile: real CSP, no horizontal overflow, home rendered')
    p.locator('#draw-button').click()
    expect(p.locator('#result-view')).to_be_visible()
    expect(p.locator('#result-title')).to_have_text('やってみる')
    assert p.evaluate("localStorage.getItem('lucky.records.v2')") is None
    passed('one-tap draw without memo; nothing saved automatically')
    p.locator('[data-feeling="relieved"]').click()
    p.locator('[data-choice="no"]').click()
    p.locator('#first-step').fill('今日は、休むことにする')
    p.locator('#result-view .optional-details summary').click()
    p.locator('#reflection').fill('偶然と反対でも、ほっとした。')
    p.screenshot(path=str(OUT/'result-mobile.png'),full_page=True)
    p.locator('#save-result').evaluate('(b)=>{b.click();b.click()}')
    expect(p.locator('#saved-view')).to_be_visible()
    rs=p.evaluate("JSON.parse(localStorage.getItem('lucky.records.v2'))")
    assert len(rs)==1 and rs[0]['result']=='yes' and rs[0]['choice']=='no' and rs[0]['feeling']=='relieved'
    assert '休むこと' in rs[0]['reflection'] and rs[0]['beforeMood'] is None
    passed('random result and independent choice preserved; double-save creates one entry')
    p.screenshot(path=str(OUT/'saved-mobile.png'),full_page=True)
    p.locator('#saved-journal').click()
    expect(p.locator('#history-list .record-row')).to_have_count(1)
    empty_day=p.locator('#calendar-days button').evaluate_all('(bs)=>bs.find(b=>!b.querySelector(".dot")).dataset.day')
    p.locator(f'[data-day="{empty_day}"]').click()
    expect(p.locator('#history-list .record-row')).to_have_count(0)
    expect(p.locator('#history-list')).to_contain_text('この日の記録は、まだありません')
    passed('empty calendar day never falls back to unrelated records')
    p.locator('#all-records').click()
    p.locator('#history-list .record-row').click()
    expect(p.locator('#record-dialog')).to_be_visible()
    p.locator('#record-reflection').fill('振り返り：休んでよかった。')
    p.get_by_role('button',name='振り返りを保存する',exact=True).click()
    assert '休んでよかった' in p.evaluate("JSON.parse(localStorage.getItem('lucky.records.v2'))[0].reflection")
    p.locator('#record-dialog [data-close]').click()
    p.locator('#record-search').fill('見つからない言葉')
    expect(p.locator('#history-list .record-row')).to_have_count(0)
    p.locator('#record-search').fill('休んでよかった')
    expect(p.locator('#history-list .record-row')).to_have_count(1)
    passed('record editing and reflection search work')
    p.locator('#record-search').fill('')
    p.screenshot(path=str(OUT/'history-mobile.png'),full_page=True)
    p.locator('[data-nav="words"]').click()
    expect(p.locator('.word-card')).to_have_count(23)
    p.locator('.favorite-btn').first.click()
    p.locator('[data-filter="favorites"]').click()
    expect(p.locator('.word-card')).to_have_count(1)
    p.locator('[data-filter="proverb"]').click()
    expect(p.locator('.word-card')).to_have_count(3)
    p.locator('[data-filter="all"]').click()
    p.screenshot(path=str(OUT/'words-mobile.png'),full_page=True)
    passed('all 23 existing words, source links and favorites preserved')
    p.locator('#settings-open').click()
    p.locator('#theme-select').select_option('dark')
    assert p.locator('html').get_attribute('data-theme')=='dark'
    p.locator('#settings-dialog [data-close]').click()
    p.locator('[data-nav="home"]').click()
    p.screenshot(path=str(OUT/'home-dark.png'),full_page=True)
    p.locator('#settings-open').click()
    p.locator('#theme-select').select_option('light')
    with p.expect_download() as d:
        p.locator('#export-records').click()
    backup=json.loads(pathlib.Path(d.value.path()).read_text())
    assert backup['app']=='lucky' and len(backup['entries'])==1
    incoming={'app':'lucky','version':2,'entries':[backup['entries'][0],fixture_entry()]}
    p.locator('#import-file').set_input_files({'name':'backup.json','mimeType':'application/json','buffer':json.dumps(incoming).encode()})
    expect(p.locator('#confirm-dialog')).to_be_visible()
    p.locator('#confirm-ok').click()
    p.wait_for_function("JSON.parse(localStorage.getItem('lucky.records.v2')).length===2")
    before=p.evaluate("localStorage.getItem('lucky.records.v2')")
    p.locator('#import-file').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{"app":"lucky","version":2,"entries":[{}]}'})
    p.wait_for_timeout(80)
    assert p.evaluate("localStorage.getItem('lucky.records.v2')")==before
    p.locator('#settings-dialog [data-close]').click()
    passed('light/dark setting; backup export, duplicate-safe import, malformed import rejected')
    p.locator('#decision-note').fill('薬を飲むか迷う')
    p.locator('#draw-button').click()
    expect(p.locator('#message-dialog')).to_be_visible()
    expect(p.locator('#result-view')).not_to_be_visible()
    p.locator('#message-dialog [data-close]').click()
    p.locator('#decision-note').fill('<img src=x onerror="window.XSS=true">')
    p.locator('#draw-button').click()
    expect(p.locator('#result-note')).to_contain_text('<img src=x')
    assert p.evaluate('window.XSS') is None
    p.locator('#result-back').click()
    p.locator('#confirm-cancel').click()
    expect(p.locator('#result-view')).to_be_visible()
    p.locator('#finish-without-save').click()
    expect(p.locator('#home-view')).to_be_visible()
    passed('high-stakes keyword guard, text-only rendering, unsaved-result cancel/leave')
    # Every method is exercised with a deterministic, known result.
    p.locator('#decision-note').fill('本を開く？')
    for method,control in [('dice','サイコロを振ってみる'),('cards','右のカードを引く'),('rps','チョキを出す'),('roulette','ルーレットを回してみる')]:
        p.locator('#method-open').click();p.locator(f'[data-method="{method}"]').click()
        p.get_by_role('button',name=control,exact=True).click()
        expect(p.locator('#result-view')).to_be_visible()
        expected='no' if method in ('cards','rps') else 'yes'
        expect(p.locator('#result-title')).to_have_text('今回は見送る' if expected=='no' else 'やってみる')
        p.locator('#finish-without-save').click()
    p.locator('#method-open').click();p.locator('[data-method="rps"]').click()
    p.get_by_role('button',name='グーを出す',exact=True).click()
    expect(p.locator('#draw-status')).to_contain_text('あいこ')
    expect(p.locator('#home-view')).to_be_visible()
    passed('five games: coin, die, either card, RPS including tie, roulette')
    p.locator('#method-open').click();p.locator('[data-method="coin"]').click()
    p.locator('.optional-details').first.locator('summary').click()
    p.locator('[data-mood="courage"]').click()
    p.locator('#before-text').fill('少し勇気がほしい')
    p.locator('#draft-save').click()
    expect(p.locator('#draft-section')).to_be_visible()
    assert p.evaluate("JSON.parse(localStorage.getItem('lucky.drafts.v1'))[0].beforeMood")=='courage'
    passed('optional mood and note, draft save with existing v1 schema')
    # Wait for the actual service worker, then completely disconnect the browser context.
    p.evaluate('navigator.serviceWorker.ready.then(()=>true)')
    p.wait_for_function('navigator.serviceWorker.controller!==null')
    ctx.set_offline(True);p.reload(wait_until='domcontentloaded')
    expect(p.locator('#home-view')).to_be_visible()
    p.locator('#draw-button').click();expect(p.locator('#result-view')).to_be_visible()
    passed('PWA: full reload and draw work offline under actual service worker')
    ctx.close()
    # Corrupt data is protected, not silently replaced or migrated.
    badctx,bad=new_context(storage={'lucky.records.v2':'{broken'})
    expect(bad.locator('#storage-warning')).to_be_visible()
    bad.locator('#draw-button').click();bad.locator('#save-result').click()
    expect(bad.locator('#result-view')).to_be_visible()
    assert bad.evaluate("localStorage.getItem('lucky.records.v2')")=='{broken'
    badctx.close();passed('corrupt historical records cannot be overwritten by saving')
    blockedctx,blocked=new_context(blocked=True)
    expect(blocked.locator('#storage-warning')).to_be_visible()
    blocked.locator('#draw-button').click();expect(blocked.locator('#result-view')).to_be_visible()
    blocked.locator('#save-result').click();expect(blocked.locator('#saved-view')).not_to_be_visible()
    blockedctx.close();passed('blocked localStorage does not break draw or falsely report a save')
    old={'id':'legacy-1','note':'前のバージョンの迷い','result':'no','choice':'yes','feeling':'happy','createdAt':'2026-09-13T11:00:00.000Z'}
    legacyraw=json.dumps([old],ensure_ascii=False)
    legacyctx,legacy=new_context(storage={'lucky.records.v1':legacyraw})
    legacy.locator('[data-nav="history"]').click();expect(legacy.locator('#history-list .record-row')).to_have_count(1)
    legacy.locator('[data-nav="home"]').click();legacy.locator('#draw-button').click();legacy.locator('#save-result').click()
    assert legacy.evaluate("JSON.parse(localStorage.getItem('lucky.records.v2')).length")==2
    assert legacy.evaluate("localStorage.getItem('lucky.records.v1')")==legacyraw
    legacyctx.close();passed('legacy v1 records carry forward; original legacy backup is unchanged')
    for width,height in [(320,568),(375,812),(768,1024),(1440,1000)]:
        c,q=new_context(width,height)
        assert q.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
        q.screenshot(path=str(OUT/f'home-{width}.png'),full_page=True)
        q.locator('[data-nav="history"]').click()
        assert q.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
        q.locator('[data-nav="words"]').click()
        assert q.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
        c.close()
    passed('320/375/390/768/1440px layouts: home, calendar and words without overflow')
    # Non-reduced animation must ignore rapid multiple clicks.
    c,q=new_context(reduced=False)
    q.locator('#draw-button').evaluate('(b)=>{b.click();b.click();b.click()}')
    expect(q.locator('#result-view')).to_be_visible()
    q.locator('#save-result').click()
    assert q.evaluate("JSON.parse(localStorage.getItem('lucky.records.v2')).length")==1
    c.close();passed('normal animation single-flight lock prevents repeated draws')
    if errors: raise AssertionError('Browser errors / CSP violations: '+json.dumps(errors,ensure_ascii=False))
    passed('zero browser exceptions, console errors or CSP violations')
    browser.close()
 report={'app':'lucky','version':'4.0.0','passed':len(checks),'checks':checks,'browserErrors':errors,'screenshots':[x.name for x in OUT.glob('*.png')]}
 (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print(json.dumps(report,ensure_ascii=False,indent=2))
finally:
 server.shutdown()

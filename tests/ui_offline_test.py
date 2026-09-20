"""Browser smoke tests for lucky v4.
LUCKY_HTTP=1 runs the actual module app from the local static server, including storage and PWA shell.
"""
import json, os, subprocess, time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results'; OUT.mkdir(exist_ok=True)
HTTP = os.environ.get('LUCKY_HTTP') == '1'
BOOT = """
window.randomValue=0;window.randomCalls=0;
Object.defineProperty(crypto,'getRandomValues',{value:a=>{window.randomCalls++;a[0]=window.randomValue;return a}});
let seq=0;Object.defineProperty(crypto,'randomUUID',{value:()=> 'ui-record-'+Date.now()+'-'+(++seq)});
"""
checks=[]; errors=[]
def check(name, condition):
    assert condition, name
    checks.append(name); print('PASS', name, flush=True)
def data(page): return json.loads(page.evaluate('localStorage.getItem("lucky.records.v2")') or '[]')
def goto_top(page, route):
    if route == 'words':
        page.evaluate("location.hash = 'words'")
    else:
        page.locator(f'[data-nav="{route}"]').click()
    page.locator(f'#{route}-view').wait_for(state='visible')

def load(browser, width=390, height=844):
    ctx=browser.new_context(viewport={'width':width,'height':height},locale='ja-JP',timezone_id='Asia/Tokyo',reduced_motion='reduce')
    page=ctx.new_page(); page.on('pageerror', lambda e: errors.append(str(e)))
    page.add_init_script(BOOT)
    page.goto('http://127.0.0.1:4173')
    page.wait_for_selector('#home-start')
    return ctx,page

server=None
if HTTP:
    server=subprocess.Popen(['node','scripts/serve.mjs'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
try:
  with sync_playwright() as p:
    launch={'headless':True,'args':['--no-sandbox']}
    if os.environ.get('CHROMIUM_PATH'): launch['executable_path']=os.environ['CHROMIUM_PATH']
    browser=p.chromium.launch(**launch)
    ctx,page=load(browser)
    check('home has five decision methods', page.locator('#home-methods .method-mini-card').count()==5)
    check('home primary CTA visible', page.locator('#home-start').is_visible())
    check('five bottom tabs visible', page.locator('#bottom-nav [data-nav]').count()==5)
    page.screenshot(path=str(OUT/'home-v4-mobile.png'), full_page=True)

    page.click('#home-start'); page.locator('#memo-view').wait_for(state='visible')
    page.fill('#decision-note','初めての喫茶店に入る？')
    page.click('#memo-next'); page.locator('#mood-view').wait_for(state='visible')
    page.click('[data-mood="courage"]'); page.fill('#before-text','少し緊張。でも気になる。')
    page.click('#mood-next'); page.locator('#method-view').wait_for(state='visible')
    page.click('#flow-methods [data-method="coin"]')
    page.click('#method-next'); page.locator('#game-view').wait_for(state='visible')
    page.evaluate('window.randomValue=0')
    page.click('#game-controls .primary-button'); page.locator('#result-view').wait_for(state='visible')
    check('coin yes result renders', page.locator('#result-title').inner_text()=='やってみる！')
    check('random result alone is not saved', len(data(page))==0)
    page.click('[data-choice="no"]'); page.click('[data-feeling="relieved"]'); page.fill('#reflection','今日は見送って、また今度。')
    page.screenshot(path=str(OUT/'result-v4-mobile.png'), full_page=True)
    page.click('#save-result'); page.locator('#record-view').wait_for(state='visible')
    record=data(page)[0]
    check('result and own choice are stored independently', record['result']=='yes' and record['choice']=='no')
    check('mood and reflection are stored', record['beforeMood']=='courage' and 'また今度' in record['reflection'])
    check('record detail renders safely', '初めての喫茶店' in page.locator('#record-detail').inner_text())

    page.click('[data-record-back]'); page.locator('#history-view').wait_for(state='visible')
    check('calendar contains 42 days', page.locator('#calendar-days button').count()==42)
    check('history contains saved record', page.locator('#history-records .record-card-button').count()>=1)
    page.screenshot(path=str(OUT/'history-v4-mobile.png'), full_page=True)

    goto_top(page,'words')
    check('words feed is populated', page.locator('#words-feed .word-card').count()>=10)
    page.locator('#words-feed .favorite-button').first.click()
    page.click('[data-word-filter="favorites"]')
    check('favorites filter works', page.locator('#words-feed .word-card').count()==1)
    page.screenshot(path=str(OUT/'words-v4-mobile.png'), full_page=True)

    goto_top(page,'profile')
    check('profile stats render', page.locator('#profile-stats .stat-card').count()==4)

    goto_top(page,'choose')
    check('choose page includes roulette', page.locator('#choose-methods [data-method="roulette"]').count()==1 or page.locator('#recommended-title').inner_text()=='ルーレット')

    goto_top(page,'home'); page.click('#home-start'); page.fill('#decision-note','薬をやめる')
    page.click('#memo-next'); page.click('#mood-skip'); page.locator('#method-view').wait_for(state='visible')
    page.click('#flow-methods [data-method="coin"]'); page.click('#method-next'); page.locator('#game-view').wait_for(state='visible')
    calls=page.evaluate('window.randomCalls'); page.click('#game-controls .primary-button'); page.wait_for_timeout(100)
    check('serious decision safety guard runs before randomness', page.evaluate('window.randomCalls')==calls and page.locator('#result-view').is_hidden())

    page.locator('#game-view .close-flow').click(); page.locator('#home-view').wait_for(state='visible')
    page.emulate_media(color_scheme='dark'); page.reload(); page.wait_for_selector('#home-view')
    check('Lucky stays light when the operating system prefers dark', page.evaluate('document.documentElement.dataset.theme')=='light')
    check('dark theme controls are removed', page.locator('#theme-dark').count()==0 and page.locator('#theme-system').count()==0)
    page.screenshot(path=str(OUT/'light-v4-under-dark-os.png'))
    for width in [320,390,768,1200]:
        page.set_viewport_size({'width':width,'height':900 if width>800 else 844})
        for route in ['home','search','choose','history','words','profile']:
            goto_top(page,route)
            check(f'no horizontal overflow {route} {width}', page.evaluate('document.documentElement.scrollWidth<=innerWidth'))

    count=len(data(page)); page.reload(); page.wait_for_selector('#bottom-nav'); goto_top(page,'home'); check('storage survives reload', len(data(page))==count)
    page.evaluate('navigator.serviceWorker.ready'); page.wait_for_timeout(250); ctx.set_offline(True); page.reload(); page.wait_for_selector('#bottom-nav'); goto_top(page,'home'); check('service worker loads app offline', page.locator('#home-methods .method-mini-card').count()==5); ctx.set_offline(False)
    check('no uncaught JavaScript errors', errors==[])
    browser.close()

  report={'mode':'real-http','passed':len(checks),'checks':checks,'errors':errors}
  print(json.dumps(report,ensure_ascii=False,indent=2)); (OUT/'ui-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
finally:
  if server: server.terminate()

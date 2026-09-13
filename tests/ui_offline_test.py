"""Offline DOM tests: no server navigation, no network, in-memory Storage adapter.
Requires Python playwright and an installed Chromium; CHROMIUM_PATH can override.
This does NOT verify hosting, real persistent browser storage, or Service Workers.
"""
import json, os, re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1] / 'public'
OUT = Path(__file__).resolve().parents[1] / 'test-results'
OUT.mkdir(exist_ok=True)
html = re.sub(r'<(?:script\b[^>]*>.*?</script>|link\b[^>]*>)', '', (ROOT/'index.html').read_text(), flags=re.S)
css = (ROOT/'styles.css').read_text()
core = re.sub(r'^export ', '', (ROOT/'decision.mjs').read_text(), flags=re.M)
app = re.sub(r'^import .*?;\n', '', (ROOT/'app.mjs').read_text(), count=1)
bootstrap = '''(()=>{
 const store=new Map(); window.testStore=store; window.randomCalls=0; window.randomValue=0;
 Object.defineProperty(window,'localStorage',{value:{getItem:k=>store.get(k)??null,setItem:(k,v)=>{if(window.failStorage)throw new Error('quota');store.set(k,String(v))},removeItem:k=>store.delete(k),clear:()=>store.clear()}});
 Object.defineProperty(crypto,'getRandomValues',{value:a=>{window.randomCalls++;a[0]=window.randomValue;return a;}});
 let sequence=0;Object.defineProperty(crypto,'randomUUID',{value:()=> 'test-record-'+(++sequence)});
})();'''
checks=[]
errors=[]
def check(name, predicate):
    assert predicate, name
    checks.append(name)
def load(browser,width=390,height=844,reduced='reduce'):
    context=browser.new_context(viewport={'width':width,'height':height},reduced_motion=reduced)
    page=context.new_page()
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/*',lambda route:route.abort())
    page.set_content(html)
    page.add_style_tag(content=css)
    page.add_script_tag(content=bootstrap)
    page.add_script_tag(content='(()=>{'+core+'\n'+app+'})();')
    return context,page

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    ctx,page=load(browser)
    check('initial toss without required input', page.locator('#toss-button').is_enabled())
    rect=page.locator('#toss-button').bounding_box(); nav=page.locator('.bottom-nav').bounding_box()
    check('primary button not hidden behind nav at 390x844',rect['y']+rect['height'] < nav['y'])
    page.screenshot(path=str(OUT/'home-mobile.png'),full_page=True)
    page.locator('#toss-button').click()
    page.locator('#result-title').wait_for(state='visible')
    check('yes random result renders',page.locator('#result-title').inner_text()=='やる')
    page.screenshot(path=str(OUT/'coin-result-mobile.png'),full_page=True)
    check('no save without explicit action',page.evaluate('testStore.has("lucky.records.v1")') is False)
    page.locator('[data-choice="no"]').click()
    check('opposite personal choice remains valid',page.locator('[data-choice="no"]').get_attribute('aria-pressed')=='true')
    page.locator('[data-feeling="relieved"]').click()
    page.screenshot(path=str(OUT/'result-mobile.png'),full_page=True)
    page.locator('#save-button').click()
    page.locator('#history-view').wait_for(state='visible')
    saved=json.loads(page.evaluate('testStore.get("lucky.records.v1")'))
    check('result and own choice saved separately',saved[0]['result']=='yes' and saved[0]['choice']=='no')
    check('optional feeling saved',saved[0]['feeling']=='relieved')
    page.screenshot(path=str(OUT/'history-mobile.png'),full_page=True)
    page.locator('[data-route="home"]').click()
    page.locator('#note-details summary').click()
    evil='<img src=x onerror=alert(1)>'
    page.locator('#decision-note').fill(evil)
    page.evaluate('window.randomValue=0xffffffff')
    page.locator('#toss-button').click()
    page.locator('#result-title').wait_for(state='visible')
    check('no random result renders',page.locator('#result-title').inner_text()=='やらない')
    check('note is inert text in result',page.locator('#result-note').inner_text()==evil and page.locator('#result-note img').count()==0)
    page.locator('[data-choice="yes"]').click()
    page.locator('#save-button').click()
    page.locator('#history-view').wait_for(state='visible')
    check('history user content is inert text',page.locator('.history-card img').count()==0)
    page.locator('#clear-history').click()
    page.locator('#cancel-delete').click()
    check('cancel deletion preserves history',page.locator('.history-card').count()==2)
    page.locator('#clear-history').click()
    page.locator('#confirm-delete').click()
    check('confirmed deletion clears history',page.locator('.history-card').count()==0)
    page.locator('[data-route="home"]').click()
    page.locator('#note-details summary').click()
    page.locator('#decision-note').fill('薬を飲むか迷う')
    before=page.evaluate('randomCalls')
    page.locator('#toss-button').click()
    check('obvious serious input stops before RNG',page.locator('#safety-area').is_visible() and page.evaluate('randomCalls')==before)
    page.locator('#safety-back').click()
    page.locator('#theme-toggle').click()
    check('dark mode works',page.evaluate('document.documentElement.dataset.theme')=='dark')
    page.locator('#toast').wait_for(state='hidden', timeout=6000)
    page.screenshot(path=str(OUT/'dark-mobile.png'),full_page=True)
    page.locator('#theme-toggle').click()
    page.evaluate('window.failStorage=true')
    page.locator('#toss-button').click()
    page.locator('#result-title').wait_for(state='visible')
    page.locator('[data-choice="undecided"]').click()
    page.locator('#save-button').click()
    check('storage failure is reported without fake save',page.locator('#result-area').is_visible() and '保存できません' in page.locator('#toast').inner_text())
    page.locator('#reset-button').click()
    for w,h in [(320,568),(390,844),(768,1024),(1440,1000)]:
        page.set_viewport_size({'width':w,'height':h})
        check(f'no horizontal overflow {w}x{h}',page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    page.screenshot(path=str(OUT/'home-desktop.png'),full_page=True)
    ctx.close()
    ctx,page=load(browser,reduced='no-preference')
    page.evaluate('document.querySelector("#toss-button").click(); document.querySelector("#coin-button").click(); document.querySelector("#toss-button").click()')
    check('rapid taps consume only one random draw',page.evaluate('randomCalls')==1)
    page.locator('[data-route="history"]').click()
    page.locator('#history-view').wait_for(state='visible')
    page.wait_for_timeout(1200)
    page.locator('[data-route="home"]').click()
    page.locator('#home-view').wait_for(state='visible')
    check('leaving mid-animation cancels stale result',page.locator('#setup-area').is_visible() and page.locator('#result-area').is_hidden())
    check('zero uncaught runtime errors',errors==[])
    ctx.close();browser.close()

(OUT/'ui-checks.json').write_text(json.dumps({'method':'offline DOM, memory Storage adapter; hosted navigation blocked in this environment','checks':checks,'uncaught_errors':errors},ensure_ascii=False,indent=2))
print(json.dumps({'passed':len(checks),'checks':checks,'uncaught_errors':errors},ensure_ascii=False,indent=2))

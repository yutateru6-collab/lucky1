"""Run UI checks. Local default uses offline DOM + in-memory Storage (not a hosting test).
LUCKY_HTTP=1 uses the actual module app at localhost; tests persistent storage and SW too.
Install: pip install playwright; python -m playwright install chromium
CHROMIUM_PATH=/usr/bin/chromium python tests/ui_offline_test.py
"""
import json, os, re, subprocess, time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results'; OUT.mkdir(exist_ok=True)
HTTP=os.environ.get('LUCKY_HTTP')=='1'
BOOT="""window.testStore=new Map();window.randomValue=0;window.randomCalls=0;window.failStorage=false;
Object.defineProperty(crypto,'getRandomValues',{value:a=>{window.randomCalls++;a[0]=window.randomValue;return a}});
let seq=0;Object.defineProperty(crypto,'randomUUID',{value:()=> 'ui-record-'+Date.now()+'-'+(++seq)});
"""
MEMORY="""Object.defineProperty(window,'localStorage',{value:{getItem:k=>testStore.get(k)??null,setItem:(k,v)=>{if(failStorage)throw new Error('quota');testStore.set(k,String(v));},removeItem:k=>testStore.delete(k)}});"""
html=re.sub(r'<(?:script\b[^>]*>.*?</script>|link\b[^>]*>)','',(ROOT/'public/index.html').read_text(),flags=re.S)
bundle='\n'.join(re.sub(r'^export ', '', re.sub(r'^import .*?;\n','',(ROOT/'public'/name).read_text(),flags=re.M),flags=re.M) for name in ['decision.mjs','games.mjs','journal.mjs','words.mjs','app.mjs'])
checks=[];errors=[]
def check(name, condition):
 assert condition,name
 checks.append(name);print("PASS",name,flush=True)
def load(browser,width=390,height=844,reduced='reduce'):
 ctx=browser.new_context(viewport={'width':width,'height':height},locale='ja-JP',timezone_id='Asia/Tokyo',reduced_motion=reduced)
 page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 if HTTP:
  page.add_init_script(BOOT);page.goto('http://127.0.0.1:4173');page.wait_for_selector('[data-mood]')
 else:
  page.route('**/*',lambda r:r.abort());page.set_content(html);page.add_style_tag(content=(ROOT/'public/styles.css').read_text());page.add_script_tag(content=BOOT+MEMORY);page.add_script_tag(content='(()=>{'+bundle+'})();')
 return ctx,page
def data(page): return json.loads(page.evaluate('localStorage.getItem("lucky.records.v2")') or '[]')
def home(page):
 page.locator('[data-route="home"]').click();page.locator('#home-view').wait_for(state='visible')
 if page.locator('#result-panel').is_visible():page.locator('#new-button').click()
 page.evaluate('window.scrollTo(0,0)')
server=None
if HTTP:
 server=subprocess.Popen(['node','scripts/serve.mjs'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
try:
 with sync_playwright() as p:
  options={'headless':True,'args':['--no-sandbox']}
  if os.environ.get('CHROMIUM_PATH'): options['executable_path']=os.environ['CHROMIUM_PATH']
  browser=p.chromium.launch(**options)
  ctx,page=load(browser)
  check('first view has four game modes',page.locator('[data-game]').count()==4)
  rect=page.locator('#play-button').bounding_box();nav=page.locator('.main-nav').bounding_box()
  check('mobile first primary action visible above nav',rect['y']+rect['height']<nav['y'])
  page.screenshot(path=str(OUT/'home-mobile.png'))
  page.fill('#decision-note','初めての喫茶店に入る');page.click('[data-mood="nervous"]');page.click('summary');page.fill('#before-text','少し緊張。でも気になる。');page.click('#play-button');page.locator('#result-title').wait_for(state='visible')
  check('coin yes renders',page.locator('#result-title').inner_text()=='やる')
  check('result alone does not save',not data(page))
  page.click('[data-choice="no"]');page.click('[data-feeling="relieved"]');page.fill('#reflection','今日は見送って、また今度。');page.screenshot(path=str(OUT/'result-mobile.png'),full_page=True);page.click('#save-button');page.locator('#calendar-view').wait_for(state='visible')
  record=data(page)[0]
  check('before and after feelings stored separately',record['beforeMood']=='nervous' and record['beforeText']=='少し緊張。でも気になる。' and record['feeling']=='relieved')
  check('independent choice stored',record['result']=='yes' and record['choice']=='no')
  check('calendar record date is local',record['localDate']==page.evaluate("`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`"))
  check('calendar contains 42 accessible dates',page.locator('[data-day]').count()==42)
  check('calendar displays note and mood',page.locator('.record-card').count()==1 and '少し緊張' in page.locator('.record-card').inner_text())
  page.screenshot(path=str(OUT/'calendar-mobile.png'),full_page=True)
  page.click('.record-card .text-button');page.fill('#edit-reflection','後日、入ってみた。静かでよかった。');page.click('#edit-save');check('reflection editable later','後日' in data(page)[0]['reflection'])
  page.click('.record-card .text-button');page.click('#delete-button');page.click('#confirm-cancel');check('delete cancellation keeps record',len(data(page))==1);page.click('[data-close="edit-dialog"]')
  home(page);page.evaluate('window.randomValue=0xffffffff');page.click('[data-game="cards"]');page.click('[data-card="0"]');page.locator('#result-title').wait_for(state='visible');check('left card can return no',page.locator('#result-title').inner_text()=='やらない');page.click('#save-button');page.locator('#calendar-view').wait_for(state='visible');check('blank memo and undecided can save',any(r['note']=='' and r['choice']=='undecided' for r in data(page)))
  home(page);page.evaluate('window.randomValue=0');page.click('[data-game="rps"]');page.click('[data-hand="rock"]');page.wait_for_timeout(100);check('tie stays in game with no forced decision',page.locator('#setup-grid').is_visible() and 'あいこ' in page.locator('#play-status').inner_text());page.evaluate('window.randomValue=1');page.click('[data-hand="rock"]');page.locator('#result-title').wait_for(state='visible');check('rock beats scissors, yes',page.locator('#result-title').inner_text()=='やる')
  home(page);page.evaluate('window.randomValue=1');page.click('[data-game="dice"]');page.click('#play-button');page.locator('#result-title').wait_for(state='visible');check('even dice returns no',page.locator('#result-title').inner_text()=='やらない')
  home(page);page.click('[data-game="coin"]');page.fill('#decision-note','<img src=x onerror=alert(1)>');page.click('#play-button');page.locator('#result-title').wait_for(state='visible');check('result text does not execute HTML',page.locator('#result-context img').count()==0 and '<img' in page.locator('#result-context').inner_text());page.click('#save-button');page.locator('#calendar-view').wait_for(state='visible');check('calendar text is not executable HTML',page.locator('#day-records img').count()==0)
  if not HTTP:
   home(page);page.click('#play-button');page.locator('#result-title').wait_for(state='visible');count=len(data(page));page.evaluate('window.failStorage=true');page.click('#save-button');check('quota failure keeps unsaved result',page.locator('#result-panel').is_visible() and len(data(page))==count);page.evaluate('window.failStorage=false')
  home(page);page.fill('#decision-note','薬をやめる');calls=page.evaluate('randomCalls');page.click('#play-button');check('safety guard runs before randomness',page.locator('#safety-dialog').is_visible() and page.evaluate('randomCalls')==calls);page.click('[data-close="safety-dialog"]');page.fill('#decision-note','')
  page.click('[data-route="words"]');page.locator('#words-view').wait_for(state='visible');check('19 words available',page.locator('#word-list .word-card').count()==19);page.locator('#word-list .favorite-button').first.click();page.click('[data-filter="favorites"]');check('word favorite filter works',page.locator('#word-list .word-card').count()==1);page.click('[data-filter="proverb"]');check('proverbs have actual source links',page.locator('#word-list .source-link').count()==3);page.screenshot(path=str(OUT/'words-mobile.png'),full_page=True)
  page.click('[data-route="calendar"]');page.locator('#calendar-view').wait_for(state='visible');page.click('#settings-open')
  with page.expect_download() as download:page.click('#export-button')
  export=download.value;export.save_as(str(OUT/'backup-test.json'));exported=json.loads((OUT/'backup-test.json').read_text());check('backup includes current records',len(exported['entries'])==len(data(page)))
  incoming={'app':'lucky','version':2,'entries':[{**data(page)[0],'id':'import-new'}]};count=len(data(page));page.locator('#import-file').set_input_files({'name':'import.json','mimeType':'application/json','buffer':json.dumps(incoming).encode()});page.locator('#confirm-ok').wait_for(state='visible');page.click('#confirm-ok');check('backup import adds without replacing',len(data(page))==count+1)
  home(page);page.click('#theme-toggle');check('dark mode enabled',page.evaluate('document.documentElement.dataset.theme')=='dark');page.screenshot(path=str(OUT/'dark-mobile.png'))
  for width in [320,390,768,1440]:
   page.set_viewport_size({'width':width,'height':900 if width>800 else 844})
   for tab in ['home','calendar','words']:
    page.click(f'[data-route="{tab}"]');page.locator(f'#{tab}-view').wait_for(state='visible');check(f'no horizontal overflow {tab} {width}',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  page.click('[data-route="home"]');page.click('#theme-toggle');page.screenshot(path=str(OUT/'home-desktop.png'),full_page=True)
  if HTTP:
   count=len(data(page));page.reload();page.wait_for_selector('[data-mood]');check('real storage survives reload',len(data(page))==count)
   page.evaluate('navigator.serviceWorker.ready');page.reload();page.wait_for_selector('[data-mood]');ctx.set_offline(True);page.reload();page.wait_for_selector('[data-mood]');check('service worker loads module app offline',page.locator('[data-game]').count()==4);ctx.set_offline(False)
  check('no uncaught JavaScript errors',errors==[])
  browser.close()
 print(json.dumps({'mode':'real-http' if HTTP else 'offline-dom-storage-adapter','passed':len(checks),'checks':checks,'errors':errors},ensure_ascii=False,indent=2))
 (OUT/'ui-report.json').write_text(json.dumps({'mode':'real-http' if HTTP else 'offline-dom-storage-adapter','passed':len(checks),'checks':checks,'errors':errors},ensure_ascii=False,indent=2))
finally:
 if server: server.terminate()

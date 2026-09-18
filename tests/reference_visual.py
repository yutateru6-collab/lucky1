"""Reference-UI contract on a REAL HTTP origin, plus screenshots for human review.
No screenshot overlays, no production demo data, no mocked browser storage.
"""
import json, os, subprocess, time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results'; OUT.mkdir(exist_ok=True)
checks, errors = [], []
def check(name, condition):
    if not condition: raise AssertionError(name)
    checks.append(name); print('PASS', name, flush=True)
server = subprocess.Popen(['node','scripts/serve.mjs'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
try:
    with sync_playwright() as p:
        options = {'headless':True,'args':['--no-sandbox']}
        if os.environ.get('CHROMIUM_PATH'): options['executable_path']=os.environ['CHROMIUM_PATH']
        browser=p.chromium.launch(**options)
        ctx=browser.new_context(viewport={'width':390,'height':844},locale='ja-JP',timezone_id='Asia/Tokyo',reduced_motion='reduce')
        page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://127.0.0.1:4173');page.wait_for_selector('#home-methods button')
        page.evaluate('document.fonts.ready')
        check('reference image decodes on the actual origin',page.evaluate("""async()=>{const image=new Image();image.src='./assets/reference-art.webp';await image.decode();return image.naturalWidth===640&&image.naturalHeight===430}"""))
        check('reference art is not a whole-page screenshot',page.locator('#home-start').evaluate('e=>e.tagName==="BUTTON"') and page.locator('#home-methods button').count()==5)
        check('first launch has no invented past records',page.evaluate('localStorage.getItem("lucky.records.v2")===null') and page.locator('#home-activity .activity-item').count()==0)
        check('empty memo cards explicitly start templates',page.locator('#home-drafts .sample-idea').count()==3 and 'タップしてはじめる' in page.locator('#home-drafts').inner_text())
        check('bottom labels match the approved reference',page.locator('#bottom-nav a b').all_text_contents()==['ホーム','さがす','えらぶ','履歴','マイページ'])
        for width in [320,375,390,430,768,941,1200]:
            height=1672 if width==941 else 900 if width>=700 else 844
            page.set_viewport_size({'width':width,'height':height});page.evaluate('scrollTo(0,0)')
            page.wait_for_timeout(60)
            check(f'page has no horizontal overflow at {width}',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
            boxes=page.locator('#home-methods button').evaluate_all('es=>es.map(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,r:e.getBoundingClientRect().right,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}))')
            check(f'all five methods visible in the same row at {width}',len(boxes)==5 and max(b['y'] for b in boxes)-min(b['y'] for b in boxes)<2 and all(b['x']>=0 and b['r']<=width and b['w']>=44 for b in boxes))
            left=page.locator('.recent-drafts-card').bounding_box();right=page.locator('.today-word-card').bounding_box()
            check(f'dashboard stays two columns at {width}',left['x']+left['width']<=right['x']+1 and abs(left['y']-right['y'])<2)
            check(f'primary CTA has a 44px hit target at {width}',page.locator('#home-start').bounding_box()['height']>=44)
            check(f'nav hit targets at {width}',all(b>=44 for b in page.locator('#bottom-nav a').evaluate_all('es=>es.map(e=>e.getBoundingClientRect().height)')))
            if width in [320,390,430,941]:
                page.screenshot(path=str(OUT/f'reference-home-empty-{width}.png'),full_page=True)
                page.screenshot(path=str(OUT/f'reference-home-viewport-{width}.png'))
        page.set_viewport_size({'width':390,'height':844})
        page.click('#home-notices');check('bell opens an actual help dialog',page.locator('#notice-dialog').is_visible())
        page.click('#quick-settings');check('settings remains reachable from the bell',page.locator('#settings-dialog').is_visible())
        page.locator('#settings-dialog').evaluate('e=>e.close()')
        page.click('[data-nav="words"]');page.fill('#idea-search','服')
        check('search filters real templates',page.locator('#idea-results .idea-card').count()==1)
        page.click('#idea-results .idea-card');check('template starts an editable decision',page.locator('#decision-note').input_value()=='いつもと違う服を着てみる？')
        page.locator('#memo-view .close-flow').click();page.click('[data-nav="home"]')
        check('closing an edited flow creates a genuine resumable memo',page.locator('#home-drafts .compact-item').count()==1 and page.locator('#home-drafts .sample-idea').count()==0)
        page.click('#home-drafts .compact-item');check('memo resume preserves its actual content',page.locator('#decision-note').input_value()=='いつもと違う服を着てみる？')
        page.locator('#memo-view .close-flow').click()
        # Seed ONLY this ephemeral test context to review the populated layout.
        page.evaluate("""()=>{const now=Date.now();localStorage.setItem('lucky.drafts.v1',JSON.stringify([
          {id:'demo-lunch',note:'ランチどこに行く？',theme:'ごはん',method:'coin',updatedAt:new Date(now).toISOString()},
          {id:'demo-clothes',note:'どっちの服を着る？',theme:'服',method:'cards',updatedAt:new Date(now-7200000).toISOString()},
          {id:'demo-trip',note:'旅行先を決めたい！',theme:'おでかけ',method:'dice',updatedAt:new Date(now-86400000).toISOString()}]));
          const localDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());
          localStorage.setItem('lucky.records.v2',JSON.stringify(['dice','roulette'].map((game,i)=>({version:2,id:'demo-record-'+i,note:i?'週末の過ごし方':'夕食のメニュー',beforeMood:null,beforeText:'',game,result:'yes',choice:'yes',feeling:null,reflection:'',createdAt:new Date(now-(i?86400000:10800000)).toISOString(),localDate}))));
        }""")
        # Reload explicitly: navigating to the same hash does not rerender seeded storage.
        page.reload();page.wait_for_selector('#home-activity .activity-item')
        for width in [390,941]:
            page.set_viewport_size({'width':width,'height':844 if width==390 else 1672})
            page.screenshot(path=str(OUT/f'reference-home-DEMO-data-{width}.png'),full_page=True)
        page.set_viewport_size({'width':390,'height':844})
        page.click('[data-nav="words"]');page.fill('#idea-search','');page.screenshot(path=str(OUT/'reference-search-390.png'),full_page=True)
        page.click('[data-nav="choose"]');page.screenshot(path=str(OUT/'reference-choose-390.png'),full_page=True)
        page.evaluate('navigator.serviceWorker.ready');page.reload();page.wait_for_selector('#bottom-nav')
        check('reference assets belong to the offline cache',page.evaluate("""async()=>{const c=await caches.open('lucky-shell-v3.1.0');return !!(await c.match('/reference.css'))&&!!(await c.match('/assets/reference-art.webp'))&&!!(await c.match('/assets/page-doodles.svg'))}"""))
        check('no uncaught JavaScript errors',errors==[])
        browser.close()
finally:
    server.terminate()
    (OUT/'reference-report.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'errors':errors,'screenshots':'DEMO-data images use test-only browser storage; production is never seeded.'},ensure_ascii=False,indent=2))

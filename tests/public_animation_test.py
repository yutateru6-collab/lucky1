"""Verify the actual public Lucky URL visibly animates in Chromium and WebKit.

This is intentionally a public-URL test, not a localhost test.  It captures two
frames during each quick-choice method and requires their pixel hashes to differ.
It also reports what happens under prefers-reduced-motion.
"""
import hashlib, json, os, pathlib, re, time
from playwright.sync_api import sync_playwright, expect

URL=os.environ.get('LUCKY_PUBLIC_URL','https://lucky1.itisnowornever271.workers.dev/')
OUT=pathlib.Path('public-animation-results'); OUT.mkdir(exist_ok=True)
METHODS={
  'coin':'.quick-anim-coin',
  'cards':'.quick-anim-card:first-child',
  'dice':'.quick-anim-die',
  'rps':'.quick-rps-player:first-child .quick-rps-hand',
  'roulette':'.quick-roulette-wheel',
}
EXPECTED=os.environ.get('EXPECTED_VERSION','').strip()
STRICT_REDUCED=os.environ.get('REQUIRE_REDUCED_MOTION','0')=='1'
REQUIRE_SUSPENSE=os.environ.get('REQUIRE_SUSPENSE','0')=='1'
if EXPECTED=='source':
  source=(pathlib.Path('public')/'index.html').read_text()
  m=re.search(r'lucky-version\" content=\"([^\"]+)',source)
  EXPECTED=m.group(1) if m else ''
report={'url':URL,'expectedVersion':EXPECTED or None,'strictReducedMotion':STRICT_REDUCED,'requireSuspense':REQUIRE_SUSPENSE,'browsers':{},'passed':True}

def digest(data): return hashlib.sha256(data).hexdigest()

with sync_playwright() as p:
  for browser_name,browser_type in [('chromium',p.chromium),('webkit',p.webkit)]:
    browser=browser_type.launch(headless=True)
    browser_report={}
    for reduced in ['no-preference','reduce']:
      ctx=browser.new_context(
        viewport={'width':390,'height':844},
        is_mobile=True,
        has_touch=True,
        locale='ja-JP',
        timezone_id='Asia/Tokyo',
        reduced_motion=reduced,
      )
      page=ctx.new_page()
      errors=[]
      page.on('pageerror',lambda e: errors.append(str(e)))
      response=None
      for attempt in range(18):
        response=page.goto(URL+'?public-animation='+str(time.time_ns()),wait_until='networkidle')
        assert response and response.status==200
        current=page.locator('meta[name="lucky-version"]').get_attribute('content')
        if not EXPECTED or current==EXPECTED: break
        page.wait_for_timeout(5000)
      if EXPECTED:
        assert page.locator('meta[name="lucky-version"]').get_attribute('content')==EXPECTED, (browser_name,reduced,EXPECTED,page.locator('meta[name="lucky-version"]').get_attribute('content'))
      expect(page.locator('#quick-start-home')).to_be_visible()
      mode_report={'errors':errors,'methods':{}}
      for method,selector in METHODS.items():
        page.locator('#quick-start-home').click()
        expect(page.locator('#quick-dialog')).to_be_visible()
        page.locator(f'[data-quick-method="{method}"]').click()
        page.locator('#quick-draw').click()
        expect(page.locator('#quick-animation-stage')).to_be_visible()
        page.wait_for_timeout(55 if reduced=='reduce' else 90)
        frame1=page.locator('#quick-dialog').screenshot()
        stage1=page.locator('#quick-animation-stage').inner_text()
        transform1=None
        if page.locator(selector).count()==1:
          transform1=page.locator(selector).evaluate("el=>getComputedStyle(el).transform")
        page.wait_for_timeout(55 if reduced=='reduce' else 180)
        frame2=page.locator('#quick-dialog').screenshot()
        transform2=None
        if page.locator(selector).count()==1:
          transform2=page.locator(selector).evaluate("el=>getComputedStyle(el).transform")
        changed=digest(frame1)!=digest(frame2)
        if reduced=='no-preference' or STRICT_REDUCED:
          assert page.locator(selector).count()==1, f'{browser_name}/{reduced}/{method}: motion element missing'
          assert transform1!=transform2, f'{browser_name}/{reduced}/{method}: transform did not change'
          assert changed, f'{browser_name}/{reduced}/{method}: rendered frames identical'
        if REQUIRE_SUSPENSE and reduced=='no-preference':
          page.wait_for_timeout(1250)
          assert page.locator('#quick-result').is_hidden(), f'{browser_name}/{method}: public result revealed before suspense window'
        mode_report['methods'][method]={
          'frameChanged':changed,
          'transform1':transform1,
          'transform2':transform2,
          'stageText':stage1,
          'selectorCount':page.locator(selector).count(),
        }
        pathlib.Path(OUT/f'{browser_name}-{reduced}-{method}-frame1.png').write_bytes(frame1)
        pathlib.Path(OUT/f'{browser_name}-{reduced}-{method}-frame2.png').write_bytes(frame2)
        page.locator('#quick-close').click()
        expect(page.locator('#quick-dialog')).not_to_be_visible()
      assert not errors, errors
      browser_report[reduced]=mode_report
      ctx.close()
    report['browsers'][browser_name]=browser_report
    browser.close()

(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))

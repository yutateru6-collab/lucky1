"""Quick-choice contract including method-specific animations."""
import json, subprocess, time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
server=subprocess.Popen(['node','scripts/serve.mjs'],cwd=ROOT,stdout=subprocess.DEVNULL)
try:
  time.sleep(1)
  with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':390,'height':844},locale='ja-JP',timezone_id='Asia/Tokyo',reduced_motion='no-preference')
    page=ctx.new_page()
    page.add_init_script("Object.defineProperty(Crypto.prototype,'getRandomValues',{value(a){a[0]=0;return a;}});let n=0;Object.defineProperty(Crypto.prototype,'randomUUID',{value(){return 'quick-'+(++n)}})")
    page.goto('http://127.0.0.1:4173',wait_until='networkidle')
    expect(page.locator('#quick-start-home')).to_be_visible()
    assert page.locator('#home-start').bounding_box()['height'] >= 44

    page.locator('#quick-start-home').click()
    expect(page.locator('#quick-dialog')).to_be_visible()
    expect(page.locator('[data-quick-method]')).to_have_count(5)
    assert page.locator('#quick-memo-panel').is_hidden()
    assert page.locator('#quick-dialog textarea:visible').count()==0

    methods={
      'coin':('🪙 コインで決めました','.quick-anim-coin'),
      'cards':('🃏 カードで決めました','.quick-cards-wrap'),
      'dice':('🎲 サイコロで決めました','.quick-anim-die'),
      'rps':('✌️ じゃんけんで決めました','.quick-rps-wrap'),
      'roulette':('🎡 ルーレットで決めました','.quick-roulette-wheel')
    }
    for i,(method,(label,visual)) in enumerate(methods.items()):
      page.locator(f'[data-quick-method="{method}"]').click()
      assert page.locator(f'[data-quick-method="{method}"]').get_attribute('aria-pressed')=='true'
      page.locator('#quick-draw').click()
      expect(page.locator('#quick-animation-stage')).to_be_visible()
      assert page.locator('#quick-animation-stage').get_attribute('data-method')==method
      expect(page.locator(visual)).to_be_visible()
      assert page.locator('#quick-result').is_hidden()
      assert page.locator(f'[data-quick-method="{method}"]').is_disabled()
      expect(page.locator('#quick-result-title')).to_have_text('やってみる!', timeout=4000) if False else None
      expect(page.locator('#quick-result-title')).to_have_text('やってみる！', timeout=4000)
      expect(page.locator('#quick-result-method')).to_have_text(label)
      assert page.evaluate("localStorage.getItem('lucky.records.v2')") is None
      if i < len(methods)-1:
        page.locator('#quick-again').click()

    page.locator('#quick-memo-open').click()
    page.locator('#quick-note').fill('気になっていた店に入る')
    page.locator('#quick-reflection').fill('いつもなら素通りしていた')
    page.locator('#quick-choice-reverse').click()
    page.locator('#quick-save').click()
    records=page.evaluate("JSON.parse(localStorage.getItem('lucky.records.v2'))")
    assert len(records)==1
    assert records[0]['game']=='roulette'
    assert records[0]['result']=='yes' and records[0]['choice']=='no'
    assert records[0]['note']=='気になっていた店に入る'

    page.locator('#quick-start-home').click()
    assert page.locator('[data-quick-method="roulette"]').get_attribute('aria-pressed')=='true'
    page.locator('#quick-draw').click()
    page.locator('#quick-close').click()
    page.wait_for_timeout(1600)
    assert page.locator('#quick-dialog').is_hidden()
    assert len(page.evaluate("JSON.parse(localStorage.getItem('lucky.records.v2'))"))==1

    page.locator('#quick-start-home').click();page.locator('#quick-draw').click()
    expect(page.locator('#quick-result-title')).to_have_text('やってみる！', timeout=4000)
    page.locator('#quick-finish').click()
    assert len(page.evaluate("JSON.parse(localStorage.getItem('lucky.records.v2'))"))==1

    page.evaluate('navigator.serviceWorker.ready');page.wait_for_function('navigator.serviceWorker.controller!==null')
    ctx.set_offline(True);page.reload(wait_until='domcontentloaded')
    expect(page.locator('#quick-start-home')).to_be_visible()
    ctx.close();browser.close()
finally:
  server.terminate();server.wait(timeout=5)
print(json.dumps({'passed':True,'checks':['root UI keeps primary CTA','five methods remain selectable','coin flip stage renders','card shuffle stage renders','dice roll stage renders','rps battle stage renders','roulette spin stage renders','result appears only after animation','repeated/closed animation cannot create a record','selected method is saved only with optional memo','last method is remembered','quick mode works offline']},ensure_ascii=False))

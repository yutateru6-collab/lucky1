"""Quick-choice contract for the approved pastel root UI."""
import json, subprocess, time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
server=subprocess.Popen(['node','scripts/serve.mjs'],cwd=ROOT,stdout=subprocess.DEVNULL)
try:
  time.sleep(1)
  with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':390,'height':844},locale='ja-JP',timezone_id='Asia/Tokyo',reduced_motion='reduce')
    page=ctx.new_page()
    page.add_init_script("Object.defineProperty(Crypto.prototype,'getRandomValues',{value(a){a[0]=0;return a;}});let n=0;Object.defineProperty(Crypto.prototype,'randomUUID',{value(){return 'quick-'+(++n)}})")
    page.goto('http://127.0.0.1:4173',wait_until='networkidle')
    expect(page.locator('#quick-start-home')).to_be_visible()
    # Existing hero remains the dominant CTA.
    assert page.locator('#home-start').bounding_box()['height'] >= 44
    page.locator('#quick-start-home').click()
    expect(page.locator('#quick-dialog')).to_be_visible()
    assert page.locator('#quick-memo-panel').is_hidden()
    assert page.locator('#quick-dialog textarea:visible').count()==0
    page.locator('#quick-draw').click()
    expect(page.locator('#quick-result-title')).to_have_text('やってみる！')
    assert page.evaluate("localStorage.getItem('lucky.records.v2')") is None
    page.locator('#quick-memo-open').click()
    page.locator('#quick-note').fill('気になっていた店に入る')
    page.locator('#quick-reflection').fill('いつもなら素通りしていた')
    page.locator('#quick-choice-reverse').click()
    page.locator('#quick-save').click()
    records=page.evaluate("JSON.parse(localStorage.getItem('lucky.records.v2'))")
    assert len(records)==1 and records[0]['result']=='yes' and records[0]['choice']=='no'
    assert records[0]['note']=='気になっていた店に入る'
    # No memo means no record.
    page.locator('#quick-start-home').click();page.locator('#quick-draw').click();page.locator('#quick-finish').click()
    assert len(page.evaluate("JSON.parse(localStorage.getItem('lucky.records.v2'))"))==1
    page.evaluate('navigator.serviceWorker.ready');page.wait_for_function('navigator.serviceWorker.controller!==null')
    ctx.set_offline(True);page.reload(wait_until='domcontentloaded');expect(page.locator('#quick-start-home')).to_be_visible()
    ctx.close();browser.close()
finally:
  server.terminate();server.wait(timeout=5)
print(json.dumps({'passed':True,'checks':['root UI keeps primary CTA','quick mode starts without input','result is not auto-saved','memo appears after result only','own opposite choice is recordable','no-memo finish creates no record','quick mode works offline']},ensure_ascii=False))

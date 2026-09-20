"""Root quick-flow regression with real, unaccelerated animation timing."""
import json, subprocess, time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from long_choice_contract import run_contract
ROOT=Path(__file__).resolve().parents[1]
server=subprocess.Popen(['node','scripts/serve.mjs'],cwd=ROOT,stdout=subprocess.DEVNULL)
try:
    time.sleep(1)
    with sync_playwright() as p:
        report=run_contract(p,'chromium','no-preference','http://127.0.0.1:4173/',ROOT/'test-results'/'quick-408','4.0.8',methods=['coin','cards','dice','rps','roulette'],videos=False)
        browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
        ctx=browser.new_context(viewport={'width':320,'height':700},locale='ja-JP',reduced_motion='reduce')
        page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://127.0.0.1:4173/',wait_until='networkidle')
        page.locator('#quick-start-home').click();page.locator('[data-quick-method="cards"]').click()
        for b in page.locator('[data-quick-pick]').all():assert b.bounding_box()['height']>=44 and b.bounding_box()['width']>=44
        page.locator('[data-quick-pick="right"]').click();page.locator('#quick-draw').click()
        page.wait_for_timeout(1200);page.locator('#quick-close').click();page.locator('#quick-start-home').click()
        assert page.locator('#quick-pick-options [aria-pressed=true]').count()==0
        page.wait_for_timeout(18000)
        assert page.locator('#quick-animation-stage').is_hidden() and page.locator('#quick-result').is_hidden()
        assert page.locator('#quick-draw').is_disabled()
        page.locator('#quick-close').click()
        page.evaluate('navigator.serviceWorker.ready');page.wait_for_function('navigator.serviceWorker.controller!==null')
        ctx.set_offline(True);page.reload(wait_until='domcontentloaded');page.locator('#quick-start-home').click()
        page.locator('[data-quick-pick="left"]').click();page.locator('#quick-draw').click()
        expect(page.locator('.quick-cards-wrap')).to_be_visible();page.wait_for_timeout(18000)
        expect(page.locator('#quick-result')).to_be_visible()
        assert not errors,errors
        ctx.close();browser.close()
        report['extraChecks']=['320px manual targets >=44px','close during motion cancels later result','reopen clears manual pick','full 17-second reduced-motion card draw works offline']
    (ROOT/'test-results'/'quick-extra-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
finally:
    server.terminate();server.wait(timeout=5)

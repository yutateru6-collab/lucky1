"""Real-clock, rendered-frame and final-outcome assertions shared by CI and live QA.
No animation/clock acceleration. LocalStorage always belongs to disposable browser profiles.
"""
import hashlib, json, os, re, time
from pathlib import Path
from playwright.sync_api import expect
DURATIONS = {'coin':15500,'cards':17000,'dice':16350,'rps':15000,'roulette':20000}
LABELS = {'coin':'コイン','cards':'カード','dice':'サイコロ','rps':'じゃんけん','roulette':'ルーレット'}

def wait_elapsed(page, target_ms):
    # Poll from the test runner; wait_for_function(string) injects eval blocked by the real CSP.
    # Keep the production CSP intact and the application clock at its normal rate.
    deadline = time.monotonic() + target_ms / 1000 + 5
    while time.monotonic() < deadline:
        elapsed = page.evaluate('() => window.__startedMs === null ? null : performance.now() - window.__startedMs')
        assert elapsed is not None, 'draw start was not observed'
        if elapsed >= target_ms:
            return elapsed
        page.wait_for_timeout(min(100, target_ms - elapsed))
    raise AssertionError(f'elapsed time did not reach {target_ms} ms')

def run_contract(pw, browser_name, motion, url, out, expected, methods=None, videos=True):
    out=Path(out);out.mkdir(parents=True,exist_ok=True)
    launch={'headless':True}
    if browser_name=='chromium':
        launch['args']=['--no-sandbox']
        if os.environ.get('CHROMIUM_PATH'):launch['executable_path']=os.environ['CHROMIUM_PATH']
    browser=getattr(pw,browser_name).launch(**launch)
    report={'url':url,'browser':browser_name,'motion':motion,'expectedVersion':expected,'realClock':True,'cases':[],'errors':[],'passed':False}
    def save_report(): (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    try:
        for method in methods or DURATIONS:
            case={'method':method,'targetMs':DURATIONS[method],'passed':False};report['cases'].append(case);save_report()
            options=dict(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True,locale='ja-JP',timezone_id='Asia/Tokyo',reduced_motion=motion,color_scheme='dark')
            if videos:options.update(record_video_dir=str(out/'raw-video'),record_video_size={'width':390,'height':844})
            ctx=browser.new_context(**options);page=ctx.new_page()
            page.on('pageerror',lambda e:report['errors'].append(str(e)))
            page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' else None)
            try:
                page.goto(url,wait_until='networkidle');expect(page.locator('meta[name="lucky-version"]')).to_have_attribute('content',expected)
                assert page.locator('html').get_attribute('data-theme')=='light'
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                if method=='coin':page.screenshot(path=str(out/'home.png'),full_page=True)
                page.locator('#quick-start-home').click();page.locator(f'[data-quick-method="{method}"]').click()
                assert page.locator('#quick-dialog textarea:visible').count()==0
                assert page.locator('#quick-memo-panel').is_hidden()
                pick=None
                if method in ('coin','cards'):
                    assert page.locator('#quick-pick-options button').count()==2
                    assert page.locator('#quick-pick-options [aria-pressed=true]').count()==0
                    assert page.locator('#quick-draw').is_disabled()
                    # A forced click on disabled/unselected draw must not sample an outcome.
                    page.locator('#quick-draw').evaluate('b=>b.click()')
                    assert page.locator('#quick-animation-stage').is_hidden()
                    pick=('heads' if motion=='no-preference' else 'tails') if method=='coin' else ('left' if motion=='no-preference' else 'right')
                    page.locator(f'[data-quick-pick="{pick}"]').click()
                    assert page.locator(f'[data-quick-pick="{pick}"]').get_attribute('aria-pressed')=='true'
                    assert page.locator('#quick-draw').is_enabled()
                case['pick']=pick
                page.screenshot(path=str(out/f'{method}-pick.png'))
                # Start/end are observed in the actual browser, not inferred from declared durations.
                page.evaluate("""()=>{
                  window.__revealMs=null;window.__startedMs=null;
                  const start=e=>{if(e.target.closest('#quick-draw')&&window.__startedMs===null)window.__startedMs=performance.now()};
                  document.addEventListener('click',start,true);
                  window.__resultObserver=new MutationObserver(()=>{if(!document.querySelector('#quick-result').hidden&&window.__revealMs===null)window.__revealMs=performance.now()-window.__startedMs;});
                  window.__resultObserver.observe(document.querySelector('#quick-result'),{attributes:true,attributeFilter:['hidden']});
                }""")
                page.locator('#quick-draw').click()
                expect(page.locator('#quick-animation-stage')).to_be_visible()
                assert page.locator('#quick-animation-stage').get_attribute('data-duration-ms')==str(DURATIONS[method])
                assert page.locator('#quick-result').is_hidden()
                assert page.locator(f'[data-quick-method="{method}"]').is_disabled()
                # Actual artwork, not the progress indicator or a layout jump, must change.
                page.wait_for_timeout(500)
                a=page.locator('.quick-animation-visual').screenshot(animations='allow')
                page.wait_for_timeout(1250)
                b=page.locator('.quick-animation-visual').screenshot(animations='allow')
                (out/f'{method}-motion-a.png').write_bytes(a);(out/f'{method}-motion-b.png').write_bytes(b)
                case['visibleArtChanged']=hashlib.sha256(a).digest()!=hashlib.sha256(b).digest()
                assert case['visibleArtChanged'],f'{method}: artwork did not change'
                # This is the point where the OLD 3–4s animation had already finished.
                wait_elapsed(page,6000)
                assert page.locator('#quick-result').is_hidden(),f'{method}: revealed within 6s'
                assert page.evaluate("localStorage.getItem('lucky.records.v2')") is None
                page.screenshot(path=str(out/f'{method}-after-6s.png'))
                wait_elapsed(page,DURATIONS[method]-1600)
                assert page.locator('#quick-result').is_hidden(),f'{method}: result arrived before target'
                if method=='cards':assert page.locator('.quick-card-front').all_text_contents()==['','']
                page.screenshot(path=str(out/f'{method}-before-reveal.png'))
                expect(page.locator('#quick-result')).to_be_visible(timeout=6000)
                elapsed=page.evaluate('window.__revealMs');case['elapsedMs']=elapsed
                assert DURATIONS[method]-35<=elapsed<=DURATIONS[method]+4000,(method,elapsed)
                text=page.locator('#quick-result-title').inner_text();detail=page.locator('#quick-result-detail').inner_text()
                assert text in ['やってみる！','今回はやらない'];case.update(result=text,detail=detail)
                if method=='coin':
                    landed=page.locator('.quick-anim-coin').get_attribute('data-landed')
                    assert (text=='やってみる！')==(pick==landed)
                    assert ('選んだ面：'+('表' if pick=='heads' else '裏')) in detail
                    assert page.locator('#quick-result-icon').inner_text()==('表' if landed=='heads' else '裏')
                elif method=='cards':
                    assert page.locator('.quick-anim-card.chosen').get_attribute('data-revealed')==('yes' if text=='やってみる！' else 'no')
                    assert ('選んだカード：'+('左' if pick=='left' else '右')) in detail
                elif method=='dice':
                    face=int(page.locator('.quick-anim-die').get_attribute('data-face'))
                    assert (text=='やってみる！')==(face%2==1)
                    assert page.locator('#quick-result-icon').inner_text()==str(face)
                elif method=='roulette':
                    slot=int(page.locator('.quick-roulette-wheel').get_attribute('data-slot'))
                    assert (text=='やってみる！')==(slot<=4)
                    angle=page.locator('.quick-roulette-wheel').evaluate("el=>{let m=new DOMMatrixReadOnly(getComputedStyle(el).transform);return Math.atan2(m.b,m.a)*180/Math.PI}")
                    assert abs((((slot-.5)*45+angle+180)%360)-180)<.1
                else:
                    assert ('勝ち' if text=='やってみる！' else '負け') in detail
                page.screenshot(path=str(out/f'{method}-result.png'))
                assert page.evaluate("localStorage.getItem('lucky.records.v2')") is None
                if method in ('coin','cards'):
                    page.locator('#quick-memo-open').click();page.locator('#quick-note').fill('検証用：いつもと違う道を歩く')
                    page.locator('#quick-choice-reverse').click()
                    page.locator('#quick-save').evaluate('b=>{b.click();b.click()}')
                    expect(page.locator('#quick-dialog')).not_to_be_visible()
                    records=page.evaluate("JSON.parse(localStorage.getItem('lucky.records.v2'))")
                    assert len(records)==1 and records[0]['game']==method
                    assert records[0]['result']!=records[0]['choice']
                    # The existing root homepage refreshes without a reload.
                    assert page.locator('#home-activity').inner_text().find(LABELS[method])>=0
                else:
                    page.locator('#quick-finish').click()
                    assert page.evaluate("localStorage.getItem('lucky.records.v2')") is None
                case['passed']=True
                print(f'PASS {browser_name}/{motion}/{method}: {elapsed:.0f}ms, pick={pick}, outcome={text}',flush=True)
            finally:
                video=page.video if videos else None
                ctx.close()
                if video:video.save_as(str(out/f'{method}-real-time.webm'))
                save_report()
        assert not report['errors'],report['errors']
        report['passed']=True
        return report
    finally:
        browser.close();save_report()

"""Cinematic review: no fake clock, no accelerated playback, original root UI.
Screenshots and continuous video are review evidence, not an automatic claim of quality.
"""
import json,os,time,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'cinematic-review'/os.environ.get('MOTION_BROWSER','chromium')/os.environ.get('MOTION_PREF','no-preference');OUT.mkdir(parents=True,exist_ok=True)
URL=os.environ.get('LUCKY_PUBLIC_URL','http://127.0.0.1:4173/')
BROWSER=os.environ.get('MOTION_BROWSER','chromium');MOTION=os.environ.get('MOTION_PREF','no-preference')
server=None
if URL.startswith('http://127.0.0.1:'):
    server=subprocess.Popen(['node','scripts/serve.mjs'],cwd=ROOT,stdout=subprocess.DEVNULL);time.sleep(1)
report={'browser':BROWSER,'motion':MOTION,'url':URL,'cases':[],'passed':False}
try:
    with sync_playwright() as p:
        opts={'headless':True}
        if BROWSER=='chromium':opts['args']=['--no-sandbox','--enable-unsafe-swiftshader']
        browser=getattr(p,BROWSER).launch(**opts)
        for method in ['cards','coin']:
            for seed in ([0,2147483648] if os.environ.get('BOTH_OUTCOMES')=='1' else [0]):
                name=f'{method}-{seed}';case={'method':method,'seed':seed,'passed':False};report['cases'].append(case)
                ctx=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True,locale='ja-JP',reduced_motion=MOTION,color_scheme='dark',record_video_dir=str(OUT/'raw'),record_video_size={'width':390,'height':844})
                page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                page.add_init_script(f"Object.defineProperty(Crypto.prototype,'getRandomValues',{{value(a){{a[0]={seed};return a;}}}})")
                try:
                    page.goto(URL,wait_until='networkidle');expect(page.locator('meta[name="lucky-version"]')).to_have_attribute('content','4.0.9')
                    expect(page.locator('#quick-start-home')).to_be_visible()
                    if method=='cards' and seed==0:page.screenshot(path=str(OUT/'home-unchanged.png'),full_page=True)
                    page.locator('#quick-start-home').click();page.locator(f'[data-quick-method="{method}"]').click()
                    assert page.locator('#quick-draw').is_disabled()
                    pick=('left' if MOTION=='no-preference' else 'right') if method=='cards' else ('heads' if MOTION=='no-preference' else 'tails')
                    page.locator(f'[data-quick-pick="{pick}"]').click();case['pick']=pick
                    page.screenshot(path=str(OUT/f'{name}-selection.png'))
                    start=time.monotonic();page.locator('#quick-draw').click()
                    expect(page.locator('.cinematic-canvas')).to_be_visible(timeout=20000)
                    assert page.locator('#quick-animation-stage').get_attribute('data-renderer')=='webgl'
                    stamps=[.5,3.2,6.5,10.5,12.5,14.7,16.4] if method=='cards' else [.5,3.2,6.5,10.5,12.5,14.7]
                    for stamp in stamps:
                        delay=stamp-(time.monotonic()-start)
                        if delay>0:page.wait_for_timeout(delay*1000)
                        if stamp<=10.5:
                            assert page.locator('#quick-result').is_hidden()
                            assert not page.locator('#quick-animation-stage').get_attribute('data-visible-result')
                        case.setdefault('samples',[]).append({'requestedSeconds':stamp,'renderedMs':page.locator('#quick-animation-stage').get_attribute('data-elapsed-ms')})
                        page.screenshot(path=str(OUT/f'{name}-{stamp:04.1f}s.png'),caret='initial',animations='allow')
                    expect(page.locator('#quick-result')).to_be_visible(timeout=7000)
                    elapsed=time.monotonic()-start;case['elapsedSeconds']=round(elapsed,3)
                    assert (17 if method=='cards' else 15.5)-.04<=elapsed<(21 if method=='cards' else 19.5),elapsed
                    assert page.locator('.cinematic-canvas').is_visible(),'revealed artwork must remain, not vanish'
                    case['pose']=json.loads(page.locator('#quick-animation-stage').get_attribute('data-pose'))
                    case['result']=page.locator('#quick-result-title').inner_text()
                    if method=='coin':assert case['pose']['normal'][1]>.99
                    else:assert abs(case['pose']['rotationY']-3.141592653589793)<.01
                    assert page.evaluate("localStorage.getItem('lucky.records.v2')") is None
                    page.screenshot(path=str(OUT/f'{name}-result-with-art.png'),caret='initial',animations='allow')
                    page.wait_for_timeout(900);page.locator('#quick-finish').click()
                    assert not errors,errors
                    case['passed']=True
                except Exception as exc:
                    case['error']=str(exc);page.screenshot(path=str(OUT/f'{name}-failure.png'));raise
                finally:
                    video=page.video;ctx.close();video.save_as(str(OUT/f'{name}-continuous.webm'))
                    (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
        browser.close();report['passed']=True
finally:
    (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    if server:server.terminate();server.wait(timeout=5)
print(json.dumps(report,ensure_ascii=False,indent=2))

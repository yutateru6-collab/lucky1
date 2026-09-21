"""Real-clock touch tests for BOTH entry flows. No UI injection or fixed outcomes.
Fault injection blocks only optional graphics. Screenshots/video are review artifacts.
"""
import json, os, time, pathlib, subprocess
from playwright.sync_api import sync_playwright, expect
ROOT=pathlib.Path(__file__).resolve().parents[1]
BROWSER=os.environ.get('MOTION_BROWSER','chromium'); MOTION=os.environ.get('MOTION_PREF','no-preference')
OUT=ROOT/'recovery-results'/BROWSER/MOTION;OUT.mkdir(parents=True,exist_ok=True)
URL=os.environ.get('LUCKY_PUBLIC_URL') or 'http://127.0.0.1:4173/'
server=None; report={'browser':BROWSER,'motion':MOTION,'url':URL,'version':'4.0.10','cases':[],'passed':False}
if URL.startswith('http://127.0.0.1:'):
    server=subprocess.Popen(['node','scripts/serve.mjs'],cwd=ROOT,stdout=subprocess.DEVNULL);time.sleep(1)
def save(): (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def poll(page,fn,seconds=12):
    deadline=time.monotonic()+seconds
    while time.monotonic()<deadline:
        if page.evaluate(fn):return
        page.wait_for_timeout(100)
    raise AssertionError('Timed out: '+fn)

def run_case(browser,flow,method,fault=None):
    name='-'.join(filter(None,[flow,method,fault]));case={'name':name,'passed':False,'errors':[]};report['cases'].append(case);save()
    options=dict(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,locale='ja-JP',timezone_id='Asia/Tokyo',reduced_motion=MOTION,color_scheme='dark',record_video_dir=str(OUT/'raw'),record_video_size={'width':390,'height':844},service_workers='block' if fault else 'allow')
    ctx=browser.new_context(**options);page=ctx.new_page();page.on('pageerror',lambda e:case['errors'].append(str(e)))
    # Observe real secure randomness; do not replace the outcome.
    page.add_init_script("window.__samples=0;const get=Crypto.prototype.getRandomValues;Crypto.prototype.getRandomValues=function(a){window.__samples++;return get.call(this,a)}")
    if fault=='asset-stall':ctx.route('**/lucky-coin.glb',lambda route:None)
    if fault=='bundle-fail':ctx.route('**/reveal/cinematic.mjs*',lambda route:route.fulfill(status=503,body='Unavailable',content_type='text/javascript'))
    if fault=='no-webgl':page.add_init_script("const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return t.includes('webgl')?null:get.call(this,t,...a)}")
    try:
        page.goto(URL,wait_until='domcontentloaded');expect(page.locator('#home-start')).to_be_visible()
        expect(page.locator('meta[name="lucky-version"]')).to_have_attribute('content','4.0.10')
        if flow=='quick':
            page.locator('#quick-start-home').tap();page.locator(f'[data-quick-method="{method}"]').tap()
            page.locator(f'[data-quick-pick="{"heads" if method=="coin" else "left"}"]').tap()
            stage=page.locator('#quick-animation-stage');result=page.locator('#quick-result')
            control=page.locator('#quick-draw')
        else:
            page.locator('#home-start').tap();page.locator('#decision-note').fill('気になっていた喫茶店に入ってみる？')
            page.locator('#memo-next').tap();page.locator('[data-mood="courage"]').tap();page.locator('#before-text').fill('いつもは通り過ぎるけれど、今日は試したい。')
            page.locator('#mood-next').tap();page.locator(f'#flow-methods [data-method="{method}"]').tap();page.locator('#method-next').tap()
            stage=page.locator('#normal-animation-stage');result=page.locator('#result-view')
            control=page.locator('#game-controls .primary-button') if method=='coin' else page.get_by_role('button',name='左のカードを引く',exact=True)
        start=time.monotonic();control.tap()
        expect(stage).to_be_visible(timeout=3000)
        case['feedbackSeconds']=round(time.monotonic()-start,3)
        assert not result.is_visible(),'No result is allowed to bypass the performance'
        page.screenshot(path=str(OUT/(name+'-start.png')),animations='allow',caret='initial')
        if fault in ('asset-stall','bundle-fail','no-webgl'):
            # A card needs no coin model, so it still starts in WebGL if only GLB is blocked.
            renderer='webgl' if fault=='asset-stall' and method=='cards' else 'fallback'
            expect(stage).to_have_attribute('data-renderer',renderer,timeout=6000)
        else:expect(stage).to_have_attribute('data-renderer','webgl',timeout=7000)
        if fault=='context-loss':
            canvas=stage.locator('canvas');canvas.evaluate("c=>c.dispatchEvent(new Event('webglcontextlost',{cancelable:true}))")
            expect(stage).to_have_attribute('data-renderer','fallback',timeout=4000)
        before=stage.get_attribute('data-elapsed-ms');page.wait_for_timeout(1250);after=stage.get_attribute('data-elapsed-ms')
        assert int(after or 0)>int(before or 0),'animation clock is not advancing'
        case['renderer']=stage.get_attribute('data-renderer');case['frameClock']=[before,after]
        page.screenshot(path=str(OUT/(name+'-motion.png')),animations='allow',caret='initial')
        assert page.evaluate('window.__samples')==1,'render fallback must not draw another outcome'
        remaining=6000-(time.monotonic()-start)*1000
        if remaining>0:page.wait_for_timeout(remaining)
        assert not result.is_visible(),'result appeared before the requested performance'
        expect(result).to_be_visible(timeout=23000)
        case['elapsedSeconds']=round(time.monotonic()-start,3)
        assert case['elapsedSeconds']>=(15.5 if method=='coin' else 17)-.1
        assert case['elapsedSeconds']<26
        assert stage.is_visible(),'final object must remain visible'
        title=page.locator('#quick-result-title' if flow=='quick' else '#result-title').inner_text();case['result']=title
        assert title in ['やってみる！','今回はやらない','今回は見送る']
        assert page.evaluate("localStorage.getItem('lucky.records.v2')") is None
        page.screenshot(path=str(OUT/(name+'-result.png')),animations='allow',caret='initial')
        if flow=='memo':
            expect(page.locator('#result-memo')).to_contain_text('喫茶店')
            page.locator('[data-choice="yes"]').tap();page.locator('#reflection').fill('確認用の振り返り');page.locator('#save-result').tap()
            expect(page.locator('#record-view')).to_be_visible()
            record=page.evaluate("JSON.parse(localStorage.getItem('lucky.records.v2'))")
            assert len(record)==1 and record[0]['beforeText']=='いつもは通り過ぎるけれど、今日は試したい。'
            assert record[0]['game']==method
        else:page.locator('#quick-finish').tap()
        assert not case['errors'],case['errors'];case['passed']=True
    except Exception as e:
        case['error']=str(e);page.screenshot(path=str(OUT/(name+'-failure.png')));raise
    finally:
        video=page.video;ctx.close();video.save_as(str(OUT/(name+'.webm')));save()

try:
    with sync_playwright() as p:
        opts={'headless':True}
        if BROWSER=='chromium':
            opts['args']=['--no-sandbox','--enable-unsafe-swiftshader']
            if os.environ.get('CHROMIUM_PATH'):opts['executable_path']=os.environ['CHROMIUM_PATH']
        browser=getattr(p,BROWSER).launch(**opts)
        selected=os.environ.get('RECOVERY_CASES','').strip()
        cases=[('quick','coin',None),('memo','coin',None),('memo','cards',None),('quick','coin','asset-stall'),('quick','cards','asset-stall'),('quick','cards','bundle-fail'),('memo','coin','no-webgl'),('quick','coin','context-loss')]
        for flow,method,fault in cases:
            if selected and '-'.join(filter(None,[flow,method,fault])) not in selected.split(','):continue
            run_case(browser,flow,method,fault)
        # Close during pending startup: no late completion, no forced stale selection.
        ctx=browser.new_context(viewport={'width':390,'height':844},has_touch=True,service_workers='block')
        ctx.route('**/reveal/cinematic.mjs*',lambda route:None)
        page=ctx.new_page();page.goto(URL,wait_until='domcontentloaded')
        page.locator('#quick-start-home').tap();page.locator('[data-quick-pick="heads"]').tap();page.locator('#quick-draw').tap();page.locator('#quick-close').tap()
        page.wait_for_timeout(2800);assert not page.locator('#quick-dialog').is_visible()
        assert page.evaluate("localStorage.getItem('lucky.records.v2')") is None
        page.locator('#quick-start-home').tap();assert page.locator('#quick-draw').is_disabled()
        ctx.close();browser.close();report['pendingCancel']=True;report['passed']=True
finally:
    save()
    if server:server.terminate();server.wait(timeout=5)
print(json.dumps(report,ensure_ascii=False,indent=2))

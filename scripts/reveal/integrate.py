"""One-time, idempotent integration; run after building the local renderer/assets."""
from pathlib import Path
R=Path(__file__).resolve().parents[2]
def change(path,fn):
    p=R/path;s=p.read_text();n=fn(s)
    if n!=s:p.write_text(n)
def quick(s):
    if "from './reveal/cinematic.mjs'" in s:return s
    s="import { prepareReveal, startCinematicMotion, setRevealSound } from './reveal/cinematic.mjs';\n"+s
    s=s.replace("const busy = state.phase === 'animating';","const busy = state.phase === 'animating' || state.phase === 'loading';")
    s=s.replace("if (state.phase === 'animating' || !Object.hasOwn(METHODS, method)) return;","if (['animating','loading'].includes(state.phase) || !Object.hasOwn(METHODS, method)) return;")
    s=s.replace("  setMethod(state.method);\n}","  $('#quick-dialog').classList.remove('cinematic-active','cinematic-finished');\n  $('#quick-animation-stage').removeAttribute('data-renderer');\n  setMethod(state.method);\n}",1)
    s=s.replace("  const ready = hasQuickPick(state.method, state.pick);","  $('#quick-sound').hidden = !['coin','cards'].includes(state.method);\n  const ready = hasQuickPick(state.method, state.pick);")
    s=s.replace('function draw() {','async function draw() {')
    needle="    // Capture immutable choice/outcome once; motion never draws or changes the result."
    s=s.replace(needle,"    const cinematic = ['coin','cards'].includes(state.method);\n    const pendingRun = state.run;\n    if (cinematic) {\n      state.phase = 'loading'; lock();\n      await prepareReveal();\n      if (pendingRun !== state.run || !$('#quick-dialog').open) return;\n    }\n"+needle)
    s=s.replace("    error(); lock();\n    state.motion = startQuickMotion(","    error(); lock();\n    $('#quick-dialog').classList.toggle('cinematic-active', cinematic);\n    state.motion = (cinematic ? startCinematicMotion : startQuickMotion)(")
    s=s.replace("state.phase = 'result'; state.motion = null;","state.phase = 'result';")
    s=s.replace("$('#quick-idle').hidden = true; $('#quick-result').hidden = false;","$('#quick-idle').hidden = !cinematic; $('#quick-result').hidden = false;\n        $('#quick-dialog').classList.toggle('cinematic-finished', cinematic);")
    s=s.replace("selection(); error(e instanceof Error ? e.message : '抽選を始められませんでした。');","$('#quick-dialog').classList.remove('cinematic-active','cinematic-finished');\n    selection(); error(e instanceof Error ? e.message : '抽選を始められませんでした。');")
    s=s.replace("if (state.phase === 'animating') { cancelMotion(); state.phase = 'idle'; }","if (['animating','loading'].includes(state.phase)) { cancelMotion(); state.phase = 'idle'; }")
    s += "\n$('#quick-sound').addEventListener('click', () => {\n  const enabled = setRevealSound($('#quick-sound').getAttribute('aria-pressed') !== 'true');\n  $('#quick-sound').setAttribute('aria-pressed', String(enabled));\n  $('#quick-sound').textContent = enabled ? '音：オン' : '音：オフ';\n});\n// Preload public, local artwork only; notes never leave local storage.\nprepareReveal().catch(() => {});\n"
    return s
change('public/quick-mode.mjs',quick)

def index(s):
    s=s.replace('4.0.8','4.0.9')
    if './reveal/cinematic.css' not in s:s=s.replace('<link rel="stylesheet" href="./quick-choice.css">','<link rel="stylesheet" href="./quick-choice.css"><link rel="stylesheet" href="./reveal/cinematic.css">')
    if 'id="quick-sound"' not in s:s=s.replace('<div id="quick-idle"','<div class="cinematic-tools"><button id="quick-sound" type="button" aria-pressed="false">音：オフ</button></div><div id="quick-idle"')
    assert './reveal/cinematic.css' in s and 'id="quick-sound"' in s
    return s
change('public/index.html',index)
assets=['reveal/cinematic.mjs','reveal/cinematic.css','reveal/lucky-coin.glb','reveal/THIRD_PARTY_LICENSES.txt']
def sw(s):
    s=s.replace('lucky-shell-v4.0.8','lucky-shell-v4.0.9')
    if './reveal/cinematic.mjs' not in s:s=s.replace("'./quick-choice.css'","'./quick-choice.css', "+', '.join(repr('./'+p) for p in assets))
    assert './reveal/cinematic.mjs' in s
    return s
change('public/sw.js',sw)
change('scripts/verify-live.mjs',lambda s:s.replace("'4.0.8'","'4.0.9'").replace("'quick-choice.css',", "'quick-choice.css', "+', '.join(repr(p) for p in assets)+',' ) if 'reveal/cinematic.mjs' not in s else s)
# The complete SHA proof must cover the new binary asset as well as the JS/CSS.
change('tests/public_animation_test.py',lambda s:s.replace("'quick-choice.css',", "'quick-choice.css', "+', '.join(repr(p) for p in assets)+',' ) if 'reveal/cinematic.mjs' not in s else s)
change('tests/assets.test.mjs',lambda s:s.replace(r'lucky-shell-v4\.0\.8',r'lucky-shell-v4\.0\.9'))
change('tests/reference_visual.py',lambda s:s.replace('4.0.8','4.0.9').replace("('coin','.quick-anim-coin',1600)","('coin','.cinematic-canvas',4500)").replace("('cards','.quick-cards-wrap',2600)","('cards','.cinematic-canvas',11000)"))
change('tests/quick_mode_test.py',lambda s:s.replace('4.0.8','4.0.9').replace("page.locator('.quick-cards-wrap')","page.locator('.cinematic-canvas')"))

def contract(s):
    if 'CINEMATIC_409' in s:return s
    s=s.replace("if method=='cards':assert page.locator('.quick-card-front').all_text_contents()==['','']","if method=='cards':assert page.locator('#quick-animation-stage').get_attribute('data-selected-card')==('0' if pick=='left' else '1')")
    needle="                  const read=selector=>"
    insert="""                  // CINEMATIC_409: inspect the renderer's real object orientation, not a hidden CSS surrogate.
                  const stage=document.querySelector('#quick-animation-stage');
                  if(stage.dataset.renderer==='webgl')return {renderer:'webgl',...JSON.parse(stage.dataset.pose),landed:stage.dataset.landed,result:stage.dataset.visibleResult,selectedCard:stage.dataset.selectedCard};
"""
    s=s.replace(needle,insert+needle)
    start=s.index("                if method=='coin':\n                    landed=")
    end=s.index("                elif method=='dice':",start)
    s=s[:start]+"""                if method=='coin':
                    landed=page.locator('#quick-animation-stage').get_attribute('data-landed')
                    assert pose['renderer']=='webgl' and pose['landed']==landed
                    assert pose['normal'][1]>.99,pose
                    assert (text=='やってみる！')==(pick==landed)
                    assert ('選んだ面：'+('表' if pick=='heads' else '裏')) in detail
                    assert page.locator('.cinematic-canvas').is_visible()
                elif method=='cards':
                    assert pose['renderer']=='webgl' and abs(pose['rotationY']-3.141592653589793)<.01,pose
                    assert pose['selectedCard']==('0' if pick=='left' else '1')
                    assert pose['result']==('yes' if text=='やってみる！' else 'no')
                    assert ('選んだカード：'+('左' if pick=='left' else '右')) in detail
                    assert page.locator('.cinematic-canvas').is_visible()
"""+s[end:]
    return s
change('tests/long_choice_contract.py',contract)
print('Cinematic integration complete; unchanged home layout, unchanged odds and durations.')

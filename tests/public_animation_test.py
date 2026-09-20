"""Checks PR bytes on localhost or the exact deployed root app; never silently tests an old build."""
import hashlib, json, os, re, subprocess, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
from long_choice_contract import run_contract
ROOT=Path(__file__).resolve().parents[1]
EXPECTED=re.search(r'lucky-version" content="([^"]+)',(ROOT/'public/index.html').read_text())[1]
BROWSER=os.environ.get('MOTION_BROWSER','chromium')
MOTION=os.environ.get('MOTION_PREF','no-preference')
URL=os.environ.get('LUCKY_PUBLIC_URL','http://127.0.0.1:4173/')
OUT=ROOT/'public-animation-results'/f'{BROWSER}-{MOTION}'
OUT.mkdir(parents=True,exist_ok=True)
server=None
try:
    if URL.startswith('http://127.0.0.1:'):
        server=subprocess.Popen(['node','scripts/serve.mjs'],cwd=ROOT,stdout=subprocess.DEVNULL);time.sleep(1)
    else:
        # Root only, including new modules. A matching version meta alone is insufficient.
        paths=['index.html','app.mjs','quick-mode.mjs','quick-draw.mjs','quick-motion.mjs','quick-mode.css','quick-choice.css','styles.css','vendor/anime.esm.min.js','sw.js']
        expected={p:hashlib.sha256((ROOT/'public'/p).read_bytes()).hexdigest() for p in paths}
        proof={}
        for attempt in range(30):
            proof={}
            for path in paths:
                try:
                    request=urllib.request.Request(URL+path+'?verify='+str(time.time_ns()),headers={'Cache-Control':'no-cache'})
                    with urllib.request.urlopen(request,timeout=15) as response: actual=hashlib.sha256(response.read()).hexdigest()
                    proof[path]={'matches':expected[path]==actual,'expected':expected[path],'actual':actual}
                except Exception as exc: proof[path]={'matches':False,'error':str(exc)}
            if all(x['matches'] for x in proof.values()):break
            time.sleep(5)
        (OUT/'deployed-hashes.json').write_text(json.dumps({'version':EXPECTED,'url':URL,'files':proof},indent=2))
        assert all(x['matches'] for x in proof.values()),proof
    with sync_playwright() as p:
        report=run_contract(p,BROWSER,MOTION,URL,OUT,EXPECTED,videos=True)
    print(json.dumps(report,ensure_ascii=False,indent=2))
finally:
    if server:server.terminate();server.wait(timeout=5)

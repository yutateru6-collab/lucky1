"""Checks PR bytes on localhost or the exact deployed root app; never silently tests an old build."""
import json, os, re, subprocess, time
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
# Deployment CI already verifies these public files using Node's standard fetch.
# Use that same HTTP client here; the separate urllib client receives HTTP 403.
# Keep the canonical origin, TLS validation, response status and every byte hash
# mandatory. This does not change the app, its CSP or its network permissions.
VERIFY_PUBLIC = r'''
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const [base, version, out] = process.argv.slice(1);
if (base !== 'https://lucky1.itisnowornever271.workers.dev/') throw new Error('Expected the approved canonical root URL');
const paths = ['index.html','app.mjs','quick-mode.mjs','quick-draw.mjs','quick-motion.mjs','quick-mode.css','quick-choice.css','styles.css','vendor/anime.esm.min.js','sw.js'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const expected = Object.fromEntries(await Promise.all(paths.map(async path => [path, hash(await readFile(`public/${path}`))])));
let report;
for (let attempt = 1; attempt <= 18; attempt++) {
  const rows = await Promise.all(paths.map(async path => {
    try {
      const response = await fetch(`${base}${path}?verify=${version}&t=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      const actual = hash(Buffer.from(await response.arrayBuffer()));
      const sameOrigin = new URL(response.url).origin === new URL(base).origin;
      return [path, { expected: expected[path], actual, status: response.status, finalUrl: response.url, matches: response.status === 200 && sameOrigin && actual === expected[path] }];
    } catch (error) { return [path, { matches: false, error: String(error.message) }]; }
  }));
  report = { version, url: base, httpClient: 'Node fetch', checkedAt: new Date().toISOString(), attempt, files: Object.fromEntries(rows) };
  await writeFile(`${out}/deployed-hashes.json`, JSON.stringify(report, null, 2));
  if (rows.every(([, value]) => value.matches)) { console.log(`Canonical public hashes: ${rows.length}/${rows.length} match`); process.exit(0); }
  console.log(`Waiting for canonical public bytes: attempt ${attempt}, ${rows.filter(([, value]) => value.matches).length}/${rows.length}`);
  if (attempt < 18) await new Promise(resolve => setTimeout(resolve, 5000));
}
console.error(JSON.stringify(report, null, 2));
process.exitCode = 1;
'''
try:
    if URL.startswith('http://127.0.0.1:'):
        server=subprocess.Popen(['node','scripts/serve.mjs'],cwd=ROOT,stdout=subprocess.DEVNULL);time.sleep(1)
    else:
        subprocess.run(['node','--input-type=module','-e',VERIFY_PUBLIC,URL,EXPECTED,str(OUT)],cwd=ROOT,check=True,timeout=390)
        proof=json.loads((OUT/'deployed-hashes.json').read_text())
        assert proof['url']==URL and proof['version']==EXPECTED
        assert len(proof['files'])==10 and all(item['matches'] for item in proof['files'].values()),proof
    with sync_playwright() as p:
        report=run_contract(p,BROWSER,MOTION,URL,OUT,EXPECTED,videos=True)
    print(json.dumps(report,ensure_ascii=False,indent=2))
finally:
    if server:server.terminate();server.wait(timeout=5)

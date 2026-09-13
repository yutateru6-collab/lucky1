// Check candidate public origins; never create or claim a Worker.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const candidates = ['https://lucky1.itisnowornever271.workers.dev', 'https://lucky1.branch-mascarpone.workers.dev'];
const paths = ['index.html', 'app.mjs', 'styles.css', 'games.mjs', 'journal.mjs', 'words.mjs'];
const expected = new Map(await Promise.all(paths.map(async p => [p, createHash('sha256').update(await readFile(`public/${p}`)).digest('hex')])));
let verified = null, observations = [];
for (let attempt = 0; attempt < 10 && !verified; attempt++) {
  observations = [];
  for (const base of candidates) {
    try {
      const first = await fetch(`${base}/?v=2.0.0`, { signal: AbortSignal.timeout(10000), redirect: 'follow' });
      const html = await first.text();
      if (!first.ok || !html.includes('name="lucky-version" content="2.0.0"')) { observations.push({ base, status: first.status, versionMatched: false }); continue; }
      let match = true;
      for (const path of paths) {
        const response = await fetch(`${base}/${path}?verify=2.0.0`, { signal: AbortSignal.timeout(10000) });
        const sha = createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
        if (!response.ok || sha !== expected.get(path)) { match = false; break; }
      }
      observations.push({ base, status: first.status, versionMatched: true, filesMatched: match });
      if (match) { verified = base; break; }
    } catch (e) { observations.push({ base, error: String(e.message) }); }
  }
  if (!verified && attempt < 9) await new Promise(r => setTimeout(r, 10000));
}
const report = { checkedAt: new Date().toISOString(), version: '2.0.0', verifiedUrl: verified, files: paths, observations };
await writeFile('live-verification.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!verified) process.exitCode = 1;

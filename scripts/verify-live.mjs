// Deployment verification, not a deployment command. Check every shipped file by hash.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const candidates = ['https://lucky1.itisnowornever271.workers.dev', 'https://lucky1.branch-mascarpone.workers.dev'];
const version = '4.0.10';
const paths = ['index.html', 'app.mjs', 'quick-mode.mjs', 'reveal-runtime.mjs', 'quick-draw.mjs', 'quick-motion.mjs', 'styles.css', 'quick-mode.css', 'quick-choice.css', 'reveal/cinematic.mjs', 'reveal/cinematic.css', 'reveal/lucky-coin.glb', 'reveal/THIRD_PARTY_LICENSES.txt', 'visuals.mjs', 'vendor/anime.esm.min.js', 'art/lucky-reference.webp', 'games.mjs', 'journal.mjs', 'words.mjs', 'sw.js'];
const expected = new Map(await Promise.all(paths.map(async p => [p, createHash('sha256').update(await readFile(`public/${p}`)).digest('hex')])));
let verified = null, observations = [];
for (let attempt = 0; attempt < 12 && !verified; attempt++) {
  observations = [];
  for (const base of candidates) {
    try {
      const first = await fetch(`${base}/?v=${version}&t=${Date.now()}`, { signal: AbortSignal.timeout(10000), redirect: 'follow', cache: 'no-store' });
      const html = await first.text();
      if (!first.ok || !html.includes(`name="lucky-version" content="${version}"`)) { observations.push({ base, status: first.status, versionMatched: false }); continue; }
      let match = true, mismatch = null;
      for (const path of paths) {
        const response = await fetch(`${base}/${path}?verify=${version}&t=${Date.now()}`, { signal: AbortSignal.timeout(10000), cache: 'no-store' });
        const sha = createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
        if (!response.ok || sha !== expected.get(path)) { match = false; mismatch = path; break; }
      }
      observations.push({ base, status: first.status, versionMatched: true, filesMatched: match, mismatch });
      if (match) { verified = base; break; }
    } catch (e) { observations.push({ base, error: String(e.message) }); }
  }
  if (!verified && attempt < 11) await new Promise(r => setTimeout(r, 10000));
}
const report = { checkedAt: new Date().toISOString(), version, verifiedUrl: verified, files: paths, observations };
await writeFile('live-verification.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!verified) process.exitCode = 1;

import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const origin = 'https://lucky1.itisnowornever271.workers.dev/gentle/';
const paths = ['index.html', 'app.mjs', 'styles.css', 'sw.js', 'manifest.webmanifest'];
const hash = value => createHash('sha256').update(value).digest('hex');
const expected = Object.fromEntries(await Promise.all(paths.map(async path => [path, hash(await readFile(new URL(`../public/gentle/${path}`, import.meta.url)))])));
let report;
for (let attempt = 1; attempt <= 18; attempt++) {
  const files = await Promise.all(paths.map(async path => {
    try {
      const response = await fetch(`${origin}${path}?verify=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      const actual = hash(Buffer.from(await response.arrayBuffer()));
      return { path, status: response.status, expected: expected[path], actual, matches: response.ok && actual === expected[path] };
    } catch (error) { return { path, matches: false, error: error.message }; }
  }));
  report = { origin, checkedAt: new Date().toISOString(), version: '4.0.0', attempt, passed: files.every(f => f.matches), files };
  await writeFile('gentle-live-verification.json', JSON.stringify(report, null, 2));
  console.log(`Live attempt ${attempt}: ${files.filter(f => f.matches).length}/${paths.length} files match`);
  if (report.passed) { console.log(JSON.stringify(report, null, 2)); process.exit(0); }
  if (attempt < 18) await new Promise(resolve => setTimeout(resolve, 10000));
}
console.error(JSON.stringify(report, null, 2));
process.exitCode = 1;

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
test('PWA manifest icon paths exist and standalone is configured', async () => {
  const manifest = JSON.parse(await read('public/manifest.webmanifest'));
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) await access(new URL(`public/${icon.src}`, root));
});
test('HTML has no external third-party scripts or inline handlers', async () => {
  const html = await read('public/index.html');
  assert.doesNotMatch(html, /(?:src|href)=["']https?:\/\//i);
  assert.doesNotMatch(html, /\son(?:click|load|error|submit)\s*=/i);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size);
});
test('user content is inserted as text, not executable HTML', async () => {
  for (const file of ['public/app.mjs', 'public/quick-mode.mjs']) {
    const app = await read(file);
    assert.doesNotMatch(app, /innerHTML|outerHTML|insertAdjacentHTML|eval\(/);
    assert.doesNotMatch(app, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket/);
  }
});
test('vendored Anime.js and its license are shipped locally', async () => {
  await access(new URL('public/vendor/anime.esm.min.js', root));
  const license = await read('public/vendor/anime.LICENSE.md');
  assert.match(license, /MIT License/i);
  const quick = await read('public/quick-mode.mjs');
  assert.match(quick, /from '\.\/vendor\/anime\.esm\.min\.js'/);
});

test('security headers and offline version are present', async () => {
  const headers = await read('public/_headers');
  assert.match(headers, /Content-Security-Policy/);
  assert.match(headers, /camera=\(\), microphone=\(\), geolocation=\(\)/);
  const sw = await read('public/sw.js');
  assert.match(sw, /lucky-shell-v4\.0\.7/);
});

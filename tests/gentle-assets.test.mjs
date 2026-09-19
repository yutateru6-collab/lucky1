import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
const root = new URL('../public/gentle/', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');

test('gentle PWA icons and isolated scope exist', async () => {
  const manifest = JSON.parse(await read('manifest.webmanifest'));
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) await access(new URL(icon.src, root));
});

test('gentle 4.1 shell has unique IDs, quick mode assets, and no third-party markup', async () => {
  const html = await read('index.html');
  assert.doesNotMatch(html, /(?:src|href)=["']https?:\/\//i);
  assert.doesNotMatch(html, /\son(?:click|load|error|submit)\s*=/i);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  assert.ok(html.includes('data-version="4.1.0"'));
  assert.ok(html.includes('./quick-mode.mjs'));
  assert.ok(html.includes('./quick-mode.css'));
  await access(new URL('quick-mode.mjs', root));
  await access(new URL('quick-mode.css', root));
});

test('gentle personal content is text-only and no app code transmits notes', async () => {
  for (const file of ['app.mjs', 'quick-mode.mjs']) {
    const app = await read(file);
    assert.doesNotMatch(app, /innerHTML|outerHTML|insertAdjacentHTML|eval\(/);
    assert.doesNotMatch(app, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket/);
  }
});

test('gentle cache cannot delete original app caches and includes quick mode', async () => {
  const sw = await read('sw.js');
  assert.ok(sw.includes('lucky-gentle-shell-v4.1.0'));
  assert.ok(sw.includes("key.startsWith('lucky-gentle-shell-')"));
  assert.ok(!sw.includes("key.startsWith('lucky-shell-')"));
  assert.ok(sw.includes('./quick-mode.mjs'));
  assert.ok(sw.includes('./quick-mode.css'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const read = p => readFile(new URL(p, root), 'utf8');

test('reviewed result artwork and stable caption space are included', async () => {
  const source = await read('src/reveal/cinematic.mjs');
  assert.ok(source.includes('RESULT_ART_409'));
  assert.ok(source.includes('bezierCurveTo'), 'result suit is deliberately drawn, not a tiny glyph');
  assert.ok(source.includes('900 80px'), 'the result needs a readable, bold title');
  assert.ok(source.includes("finalYaw=Math.PI*(outcome.landed==='heads'?4:5)"), 'both wordmarks land upright');
  assert.ok(source.includes('spin=mix(spin,finalYaw,settle)'), 'continuous motion reaches the same final yaw');
  const css = await read('public/reveal/cinematic.css');
  assert.ok(css.includes('.quick-animation-label:empty{display:block;visibility:hidden}'));
  assert.ok(css.includes('.quick-dialog.cinematic-finished'));
  assert.ok(!css.includes('.home-greeting'), 'no homepage redesign hidden in scene styling');
});

test('result art is retained, cancellation is guarded and audio is opt-in', async () => {
  const app = await read('public/quick-mode.mjs');
  assert.ok(app.includes("$('#quick-idle').hidden = !cinematic"));
  assert.ok(app.includes("pendingRun !== state.run"));
  const html = await read('public/index.html');
  assert.ok(html.includes('id="quick-sound" type="button" aria-pressed="false"'));
  assert.ok(html.includes('lucky-version" content="4.0.9"'));
  assert.ok(html.includes('./reveal/cinematic.css'));
  const source = await read('src/reveal/cinematic.mjs');
  assert.ok(source.includes('soundEnabled=false'));
  assert.ok(source.includes('document.removeEventListener'));
  assert.ok(source.includes('renderer.dispose()'));
});

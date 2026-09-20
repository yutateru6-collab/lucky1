import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { QUICK_DURATIONS } from '../public/quick-draw.mjs';
const root = new URL('../', import.meta.url);
const read = p => readFile(new URL(p, root));

test('the original Blender coin really exists as a valid bounded GLB', async () => {
  const glb = await read('public/reveal/lucky-coin.glb');
  assert.equal(glb.subarray(0, 4).toString(), 'glTF');
  assert.equal(glb.readUInt32LE(4), 2);
  assert.equal(glb.readUInt32LE(8), glb.length);
  assert.ok(glb.length > 10000 && glb.length < 5 * 1024 * 1024);
  const jsonLength = glb.readUInt32LE(12);
  const model = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
  assert.ok(model.meshes.length > 10);
  assert.ok(model.materials.some(m => m.name.includes('gold')));
  assert.ok(model.nodes.some(n => n.name.includes('Heads')));
  assert.ok(model.nodes.some(n => n.name.includes('Tails')));
});
test('the cinematic renderer and asset are local, cached and separately licensed', async () => {
  const sw = (await read('public/sw.js')).toString();
  for (const path of ['reveal/cinematic.mjs', 'reveal/cinematic.css', 'reveal/lucky-coin.glb', 'reveal/THIRD_PARTY_LICENSES.txt']) {
    assert.ok((await read('public/' + path)).length > 0);
    assert.ok(sw.includes('./' + path), 'offline dependency: ' + path);
  }
  assert.match((await read('public/reveal/THIRD_PARTY_LICENSES.txt')).toString(), /MIT License/);
  const source = (await read('src/reveal/cinematic.mjs')).toString();
  assert.doesNotMatch(source, /Math\.random|getRandomValues|drawQuick|drawDecision/);
  assert.equal(QUICK_DURATIONS.cards, 17000);
  assert.equal(QUICK_DURATIONS.coin, 15500);
  assert.match(source, /cards: 17000, coin: 15500/);
});

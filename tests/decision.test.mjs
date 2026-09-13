import test from 'node:test';
import assert from 'node:assert/strict';
import { drawDecision, needsHumanJudgment, normalizeRecords, MAX_RECORDS } from '../public/decision.mjs';
const fakeCrypto = value => ({ getRandomValues(array) { assert.equal(array.length, 1); array[0] = value; return array; } });

test('50/50 boundary: precisely 2^31 Uint32 values on each side', () => {
  assert.equal(drawDecision(fakeCrypto(0)), 'yes');
  assert.equal(drawDecision(fakeCrypto(1)), 'yes');
  assert.equal(drawDecision(fakeCrypto(0x7fffffff)), 'yes');
  assert.equal(drawDecision(fakeCrypto(0x80000000)), 'no');
  assert.equal(drawDecision(fakeCrypto(0xffffffff)), 'no');
  assert.equal(0x80000000, 0x100000000 - 0x80000000);
});
test('one random draw per result, no retries or history weighting', () => {
  let calls = 0;
  const rng = { getRandomValues(a) { calls += 1; a[0] = 7; return a; } };
  for (let i = 0; i < 10; i++) assert.equal(drawDecision(rng), 'yes');
  assert.equal(calls, 10);
});
test('uniform boundary-grid sanity check, not a randomness proof', () => {
  let yes = 0;
  for (let i = 0; i < 1024; i++) if (drawDecision(fakeCrypto(i * 0x400000)) === 'yes') yes++; 
  assert.equal(yes, 512);
});
test('no insecure fallback when crypto is missing', () => {
  assert.throws(() => drawDecision(null), /安全な抽選/);
  assert.throws(() => drawDecision({}), /安全な抽選/);
});
test('real Web Crypto returns supported results', () => {
  for (let i = 0; i < 50; i++) assert.ok(['yes', 'no'].includes(drawDecision()));
});
test('ordinary everyday situations stay usable', () => {
  for (const note of ['', 'あのお店に入ってみる？', '困っている人に声をかける', '友達に連絡する', '家で本を読もうかな', '新しい飲み物を飲む']) {
    assert.equal(needsHumanJudgment(note), false, note);
  }
});
test('limited local guard blocks obvious serious inputs', () => {
  for (const note of ['薬を飲むか迷う', '自殺する', '大金を投資する', '借金をする', '溺れている人を助けるか', '救急車を呼ぶか', '飲酒運転する', 'take medication', 'ＳＵＩＣＩＤＥ']) {
    assert.equal(needsHumanJudgment(note), true, note);
  }
});
const record = { id: 'test-1', note: 'あのお店へ', result: 'yes', choice: 'no', feeling: null, createdAt: '2026-09-13T10:00:00Z' };
test('opposite choice and undecided are valid records', () => {
  assert.deepEqual(normalizeRecords([record]), [record]);
  assert.equal(normalizeRecords([{ ...record, choice: 'undecided' }]).length, 1);
});
test('malformed records and prototype keys cannot enter history', () => {
  for (const input of [null, '', {}, [null], [{ ...record, result: '__proto__' }], [{ ...record, choice: 'constructor' }], [{ ...record, createdAt: 'bad date' }], [{ ...record, note: 'a'.repeat(121) }], [{ ...record, feeling: 'evil' }], [{ ...record, id: '" onclick="alert(1)' }]]) {
    assert.deepEqual(normalizeRecords(input), [], JSON.stringify(input));
  }
});
test('unknown fields removed, duplicate ids removed, storage bounded', () => {
  assert.deepEqual(normalizeRecords([{ ...record, unexpected: 'ignored' }, record]), [record]);
  const many = Array.from({ length: 130 }, (_, i) => ({ ...record, id: `record-${i}` }));
  assert.equal(normalizeRecords(many).length, MAX_RECORDS);
});

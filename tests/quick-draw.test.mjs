import test from 'node:test';
import assert from 'node:assert/strict';
import { QUICK_DURATIONS, hasQuickPick, drawQuick, coinLandingAngle, rouletteLandingAngle, diceLandingAngles } from '../public/quick-draw.mjs';
import { normalizeEntry } from '../public/journal.mjs';
function source(...values) { let calls = 0; return { getRandomValues(a) { a[0] = values[calls++ % values.length]; return a; }, get calls() { return calls; } }; }
test('all five durations are exactly five times the old 4.0.7 normal durations', () => {
  const old = {coin:3100,cards:3400,dice:3270,rps:3000,roulette:4000};
  for (const [method, ms] of Object.entries(old)) assert.equal(QUICK_DURATIONS[method], ms*5);
});
test('coin and card require manual selection, not an automatic default', () => {
  for (const method of ['coin','cards']) for (const pick of [null,undefined,'','constructor','__proto__','bad']) {
    const rng=source(0); assert.equal(hasQuickPick(method,pick),false);
    assert.throws(()=>drawQuick(method,pick,rng)); assert.equal(rng.calls,0);
  }
});
test('both coin choices are fair; displayed landed side need not equal the selected side', () => {
  for (const pick of ['heads','tails']) {
    const outs=[0,0xffffffff].map(v => {const rng=source(v),out=drawQuick('coin',pick,rng);assert.equal(rng.calls,1);return out;});
    assert.deepEqual(outs.map(o=>o.landed),['heads','tails']);
    assert.equal(outs.filter(o=>o.result==='yes').length,1);
    outs.forEach(o=>assert.equal(o.result, o.picked===o.landed?'yes':'no'));
  }
});
test('left/right card choices retain identity and each has one yes and one no outcome', () => {
  for (const pick of ['left','right']) {
    const outs=[0,0xffffffff].map(v=>drawQuick('cards',pick,source(v)));
    assert.equal(outs.filter(o=>o.result==='yes').length,1);
    outs.forEach(o=>{assert.equal(o.chosenCard,pick==='left'?0:1);assert.equal(o.result,o.yesAt===o.chosenCard?'yes':'no');});
  }
});
test('coin animation front/back angles agree with the sampled side', () => {
  for (const turns of [0,8]) {assert.equal(coinLandingAngle('heads',turns)%360,0);assert.equal(coinLandingAngle('tails',turns)%360,180);}
});
test('six die faces stay unbiased with three yes and three no', () => {
  const outs=[0,1,2,3,4,5].map(v=>drawQuick('dice',null,source(v)));
  assert.deepEqual(outs.map(o=>o.face),[1,2,3,4,5,6]);assert.equal(outs.filter(o=>o.result==='yes').length,3);
  // Transform each actual face normal by Y then X; the selected face must point forward.
  const normals=[[0,0,1],[0,-1,0],[1,0,0],[-1,0,0],[0,1,0],[0,0,-1]];
  for (let face=1;face<=6;face++) {
    const [rx,ry]=diceLandingAngles(face).map(x=>x*Math.PI/180), [x,y,z]=normals[face-1];
    const zz=-x*Math.sin(ry)+z*Math.cos(ry), forward=y*Math.sin(rx)+zz*Math.cos(rx);
    assert.ok(Math.abs(forward-1)<1e-9, `face ${face} must point forward`);
  }
  assert.deepEqual(diceLandingAngles(2),[-90,0]);assert.deepEqual(diceLandingAngles(5),[90,0]);
});
test('all eight wheel sectors stop under the fixed pointer and never reverse on the final leg', () => {
  for(let slot=1;slot<=8;slot++) {const angle=rouletteLandingAngle(slot);assert.ok(angle>2880);assert.equal(((slot-.5)*45+angle)%360,0);}
});
test('RPS displayed hands match the claimed result for all six combinations', () => {
  const order=['rock','scissors','paper'];
  for(let p=0;p<3;p++) for(const resultBit of [0,0xffffffff]) {
    const out=drawQuick('rps',null,source(p,resultBit));
    const diff=(order.indexOf(out.opponent)-order.indexOf(out.hand)+3)%3;
    assert.equal(out.result,diff===1?'yes':'no');assert.notEqual(diff,0);
  }
});
test('new choices still save through the existing private v2 record format', () => {
  for(const [game,pick] of [['coin','tails'],['cards','right'],['dice',null],['rps',null],['roulette',null]]) {
    const out=drawQuick(game,pick,source(0));
    assert.ok(normalizeEntry({version:2,id:'test-'+game,note:'任意メモ',game,result:out.result,choice:'no',feeling:null,beforeMood:null,beforeText:'',reflection:'',createdAt:'2026-09-20T01:00:00Z',localDate:'2026-09-20'}));
  }
});

import { drawDecision } from './decision.mjs';
import { GAMES, HANDS, playGame, randomInt } from './games.mjs';
import { putEntry, dateKey } from './journal.mjs';
import { animate, createTimeline } from './vendor/anime.esm.min.js';

const $ = s => document.querySelector(s);
const METHOD_KEY = 'lucky.quick.method.v1';
const METHODS = Object.freeze({
  coin: { label: 'コイン', icon: '🪙', rule: '表 / 裏で50 / 50', action: 'いくよ…' },
  cards: { label: 'カード', icon: '🃏', rule: '1枚引いて50 / 50', action: 'シャッフル中…' },
  dice: { label: 'サイコロ', icon: '🎲', rule: '奇数 / 偶数で50 / 50', action: 'いくよ…' },
  rps: { label: 'じゃんけん', icon: '✌️', rule: '勝ち / 負けで50 / 50', action: '最初はグー…' },
  roulette: { label: 'ルーレット', icon: '🎡', rule: '8マスを半分ずつ', action: '回すよ…' }
});
const DICE = Object.freeze(['⚀','⚁','⚂','⚃','⚄','⚅']);
const storedMethod = (() => { try { return localStorage.getItem(METHOD_KEY); } catch { return null; } })();
const state = {
  method: Object.hasOwn(METHODS, storedMethod) ? storedMethod : 'coin',
  result: null,
  choice: null,
  createdAt: null,
  detail: '',
  busy: false,
  animationRun: 0,
  motion: null
};
let toastTimer;

function resultLabel(v) { return v === 'yes' ? 'やってみる！' : '今回はやらない'; }
function choiceLabel(v) { return v === 'yes' ? 'やる' : 'やらない'; }
function other(v) { return v === 'yes' ? 'no' : 'yes'; }
function node(tag, className = '', text = '') {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== '') n.textContent = text;
  return n;
}
function reducedMotion() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function toast(text) {
  const t = $('#toast');
  if (!t) return;
  clearTimeout(toastTimer);
  t.textContent = text;
  t.hidden = false;
  toastTimer = setTimeout(() => { t.hidden = true; }, 3600);
}
function cancelMotion() {
  try { state.motion?.cancel?.(); } catch { /* no-op */ }
  state.motion = null;
}
function setControlsDisabled(disabled) {
  document.querySelectorAll('[data-quick-method]').forEach(button => { button.disabled = disabled; });
  $('#quick-draw').disabled = disabled;
}
function setMethod(method) {
  if (state.busy || !Object.hasOwn(METHODS, method)) return;
  state.method = method;
  try { localStorage.setItem(METHOD_KEY, method); } catch { /* Selection still works in this session. */ }
  document.querySelectorAll('[data-quick-method]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.quickMethod === method));
  });
  $('#quick-method-rule').textContent = METHODS[method].rule;
  $('#quick-draw-icon').textContent = METHODS[method].icon;
  $('#quick-draw-label').textContent = METHODS[method].label + 'で決める';
}
function clearAnimationStage() {
  cancelMotion();
  const stage = $('#quick-animation-stage');
  stage.replaceChildren();
  stage.hidden = true;
  stage.removeAttribute('data-method');
  stage.removeAttribute('data-phase');
  $('#quick-animation-label').textContent = '';
}
function reset() {
  state.animationRun += 1;
  state.busy = false;
  state.result = null;
  state.choice = null;
  state.createdAt = null;
  state.detail = '';
  $('#quick-idle').hidden = false;
  $('#quick-result').hidden = true;
  $('#quick-memo-panel').hidden = true;
  $('#quick-note').value = '';
  $('#quick-reflection').value = '';
  $('#quick-draw').hidden = false;
  clearAnimationStage();
  setControlsDisabled(false);
  setMethod(state.method);
}
function openQuick() {
  reset();
  const dialog = $('#quick-dialog');
  if (!dialog.open) dialog.showModal();
  $('#quick-draw').focus();
}
function playQuick(method) {
  if (method === 'coin' || method === 'dice' || method === 'roulette') return playGame(method);
  if (method === 'cards') {
    const card = randomInt(2);
    return { ...playGame('cards', { card }), chosenCard: card };
  }
  if (method === 'rps') {
    const order = Object.keys(HANDS);
    const playerIndex = randomInt(order.length);
    const result = drawDecision();
    const opponentIndex = result === 'yes' ? (playerIndex + 1) % 3 : (playerIndex + 2) % 3;
    const hand = order[playerIndex], opponent = order[opponentIndex];
    return {
      result,
      hand,
      opponent,
      detail: 'あなた ' + HANDS[hand] + ' / lucky ' + HANDS[opponent]
    };
  }
  throw new RangeError('Unknown quick method');
}
function finishAnimation(outcome, run) {
  if (state.animationRun !== run) return;
  showResult(outcome, run);
}
function coinAnimation(outcome, visual, run) {
  const wrap = node('div', 'quick-coin-wrap');
  const coin = node('div', 'quick-anim-coin');
  coin.append(node('span', 'coin-face coin-front', '表'), node('span', 'coin-face coin-back', '裏'));
  wrap.append(coin); visual.append(wrap);
  const reduced = reducedMotion();
  const finalY = outcome.result === 'yes' ? (reduced ? 720 : 3060) : (reduced ? 900 : 3240);
  const d = reduced ? [220,260,300,340] : [650,850,900,700];
  state.motion = createTimeline({ onComplete: () => finishAnimation(outcome, run) })
    .add(coin, { y: reduced ? -8 : -14, rotateY: reduced ? 90 : 180, scale: 1.03, duration: d[0], ease: 'inOut(3)' })
    .call(() => { if (state.animationRun === run) $('#quick-animation-label').textContent = '表か…裏か…'; }, d[0])
    .add(coin, { y: reduced ? -12 : -34, rotateY: reduced ? 360 : 1260, scale: 1.08, duration: d[1], ease: 'out(3)' })
    .add(coin, { y: reduced ? -4 : -10, rotateY: reduced ? 600 : 2460, scale: .99, duration: d[2], ease: 'inOut(3)' })
    .call(() => { if (state.animationRun === run) $('#quick-animation-label').textContent = '止まる…！'; }, d[0] + d[1] + d[2] - (reduced ? 120 : 180))
    .add(coin, { y: 0, rotateY: finalY, scale: 1, duration: d[3], ease: 'out(5)' });
}
function cardsAnimation(outcome, visual, run) {
  const wrap = node('div', 'quick-cards-wrap');
  const chosen = outcome.chosenCard ?? 0;
  const cards = [];
  for (let i = 0; i < 2; i++) {
    const card = node('div', 'quick-anim-card' + (i === chosen ? ' chosen' : ''));
    const inner = node('div', 'quick-card-inner');
    inner.append(node('span', 'quick-card-back', '✦'), node('span', 'quick-card-front ' + (outcome.result === 'yes' ? 'yes' : 'no'), outcome.result === 'yes' ? '♥' : '♠'));
    card.append(inner); wrap.append(card); cards.push({ card, inner });
  }
  visual.append(wrap);
  const left = cards[0].card, right = cards[1].card, selected = cards[chosen], otherCard = cards[1-chosen];
  const reduced = reducedMotion();
  const cross = reduced ? 30 : 76, center = reduced ? 30 : 50;
  const d = reduced ? [220,220,240,250,280] : [700,650,650,750,650];
  let t = 0;
  state.motion = createTimeline({ onComplete: () => finishAnimation(outcome, run) })
    .add(left, { x: cross, rotate: 13, duration: d[0], ease: 'inOut(3)' }, t)
    .add(right, { x: -cross, rotate: -13, duration: d[0], ease: 'inOut(3)' }, t);
  t += d[0];
  state.motion
    .add(left, { x: -cross * .55, rotate: -15, duration: d[1], ease: 'inOut(3)' }, t)
    .add(right, { x: cross * .55, rotate: 15, duration: d[1], ease: 'inOut(3)' }, t)
    .call(() => { if (state.animationRun === run) $('#quick-animation-label').textContent = 'どっちだ…？'; }, t + d[1] - (reduced ? 70 : 130));
  t += d[1];
  state.motion
    .add(left, { x: 0, rotate: -9, duration: d[2], ease: 'out(3)' }, t)
    .add(right, { x: 0, rotate: 9, duration: d[2], ease: 'out(3)' }, t);
  t += d[2];
  state.motion
    .call(() => { if (state.animationRun === run) $('#quick-animation-label').textContent = 'この1枚…'; }, t)
    .add(otherCard.card, { opacity: .35, scale: .94, duration: d[3], ease: 'out(3)' }, t)
    .add(selected.card, { x: chosen === 0 ? center : -center, y: -8, rotate: 0, scale: 1.12, duration: d[3], ease: 'out(4)' }, t);
  t += d[3];
  state.motion
    .call(() => { if (state.animationRun === run) $('#quick-animation-label').textContent = 'オープン！'; }, t)
    .add(selected.inner, { rotateY: 180, duration: d[4], ease: 'inOut(4)' }, t);
}
function diceAnimation(outcome, visual, run) {
  const die = node('div', 'quick-anim-die', DICE[(outcome.face || 1) - 1]);
  die.dataset.face = String(outcome.face || 1); visual.append(die);
  const reduced = reducedMotion();
  const d = reduced ? [220,220,240,260,320] : [620,620,620,650,760];
  let t = 0;
  state.motion = createTimeline({ onComplete: () => finishAnimation(outcome, run) })
    .add(die, { y: reduced ? -8 : -30, rotate: reduced ? 70 : 145, scale: 1.07, duration: d[0], ease: 'out(3)' });
  t += d[0];
  state.motion.add(die, { y: 4, rotate: reduced ? 145 : 300, scale: .94, duration: d[1], ease: 'in(3)' }, t);
  t += d[1];
  state.motion
    .call(() => { if (state.animationRun === run) $('#quick-animation-label').textContent = 'まだ転がる…'; }, t - (reduced ? 60 : 120))
    .add(die, { y: reduced ? -7 : -22, rotate: reduced ? 225 : 500, scale: 1.04, duration: d[2], ease: 'out(3)' }, t);
  t += d[2];
  state.motion.add(die, { y: 2, rotate: reduced ? 300 : 665, scale: .98, duration: d[3], ease: 'inOut(3)' }, t);
  t += d[3];
  state.motion
    .call(() => { if (state.animationRun === run) $('#quick-animation-label').textContent = '止まる…？'; }, t - (reduced ? 80 : 180))
    .add(die, { y: 0, rotate: reduced ? 360 : 720, scale: 1, duration: d[4], ease: 'out(5)' }, t);
}
function rpsAnimation(outcome, visual, run) {
  const wrap = node('div', 'quick-rps-wrap');
  const you = node('div', 'quick-rps-player');
  const lucky = node('div', 'quick-rps-player');
  you.append(node('small', '', 'あなた'), node('span', 'quick-rps-hand', '✊'));
  lucky.append(node('small', '', 'lucky'), node('span', 'quick-rps-hand', '✊'));
  wrap.append(you, node('b', 'quick-rps-vs', 'VS'), lucky); visual.append(wrap);
  const yourHand = you.querySelector('.quick-rps-hand'), luckyHand = lucky.querySelector('.quick-rps-hand');
  const reduced = reducedMotion();
  const hop = reduced ? -6 : -17;
  const d = reduced ? [200,170,200,170,300] : [620,500,620,500,760];
  let t = 0;
  state.motion = createTimeline({ onComplete: () => finishAnimation(outcome, run) })
    .add([yourHand,luckyHand], { y: hop, rotate: reduced ? -3 : -8, duration: d[0], ease: 'out(3)' });
  t += d[0];
  state.motion.add([yourHand,luckyHand], { y: 1, rotate: reduced ? 2 : 4, duration: d[1], ease: 'in(3)' }, t);
  t += d[1];
  state.motion
    .call(() => { if (state.animationRun === run) $('#quick-animation-label').textContent = 'じゃんけん…'; }, t)
    .add([yourHand,luckyHand], { y: reduced ? -5 : -15, rotate: reduced ? -2 : -6, duration: d[2], ease: 'out(3)' }, t);
  t += d[2];
  state.motion.add([yourHand,luckyHand], { y: 1, rotate: reduced ? 1 : 3, duration: d[3], ease: 'in(3)' }, t);
  t += d[3];
  state.motion
    .call(() => {
      if (state.animationRun !== run) return;
      yourHand.textContent = HANDS[outcome.hand];
      luckyHand.textContent = HANDS[outcome.opponent];
      $('#quick-animation-label').textContent = 'ぽん！';
    }, t)
    .add([yourHand,luckyHand], { y: 0, rotate: 0, scale: reduced ? [0.9,1.07,1] : [0.68,1.2,1], duration: d[4], ease: 'out(4)' }, t);
}
function rouletteAnimation(outcome, visual, run) {
  const wrap = node('div', 'quick-roulette-wrap');
  const pointer = node('span', 'quick-roulette-pointer', '▼');
  const wheel = node('div', 'quick-roulette-wheel');
  const center = node('span', 'quick-roulette-center', String(outcome.slot || 1));
  const stop = -(((outcome.slot || 1) - 0.5) * 45);
  wheel.append(center); wrap.append(pointer, wheel); visual.append(wrap);
  const reduced = reducedMotion();
  const d = reduced ? [260,320,360,420] : [900,1050,1150,900];
  let t = 0;
  state.motion = createTimeline({ onComplete: () => finishAnimation(outcome, run) })
    .add(wheel, { rotate: reduced ? 180 : 900, duration: d[0], ease: 'in(2)' });
  t += d[0];
  state.motion
    .call(() => { if (state.animationRun === run) $('#quick-animation-label').textContent = 'まだ回る…'; }, t - (reduced ? 60 : 120))
    .add(wheel, { rotate: reduced ? 390 : 2070, duration: d[1], ease: 'linear' }, t);
  t += d[1];
  state.motion
    .call(() => { if (state.animationRun === run) $('#quick-animation-label').textContent = '止まりそう…'; }, t)
    .add(wheel, { rotate: reduced ? 540 : 2790, duration: d[2], ease: 'out(3)' }, t);
  t += d[2];
  state.motion
    .call(() => { if (state.animationRun === run) $('#quick-animation-label').textContent = 'どこで止まる…？'; }, t - (reduced ? 80 : 180))
    .add(wheel, { rotate: (reduced ? 720 : 3240) + stop, duration: d[3], ease: 'out(6)' }, t)
    .add(pointer, { scale: reduced ? [1,1.08,1] : [1,1.3,1], duration: reduced ? 170 : 260, ease: 'out(3)' }, t + d[3] - (reduced ? 150 : 240));
}
function renderAnimation(outcome, run) {
  const stage = $('#quick-animation-stage');
  const visual = node('div', 'quick-animation-visual');
  stage.replaceChildren(visual);
  stage.dataset.method = state.method;
  stage.dataset.phase = 'running';
  stage.hidden = false;
  $('#quick-animation-label').textContent = METHODS[state.method].action;
  if (state.method === 'coin') coinAnimation(outcome, visual, run);
  if (state.method === 'cards') cardsAnimation(outcome, visual, run);
  if (state.method === 'dice') diceAnimation(outcome, visual, run);
  if (state.method === 'rps') rpsAnimation(outcome, visual, run);
  if (state.method === 'roulette') rouletteAnimation(outcome, visual, run);
}
function showResult(outcome, run) {
  if (state.animationRun !== run) return;
  state.busy = false;
  state.result = outcome.result;
  state.choice = outcome.result;
  state.createdAt = new Date();
  state.detail = outcome.detail || '';
  setControlsDisabled(false);
  state.motion = null;
  $('#quick-animation-stage').dataset.phase = 'done';
  $('#quick-idle').hidden = true;
  $('#quick-result').hidden = false;
  $('#quick-memo-panel').hidden = true;
  $('#quick-result-method').textContent = METHODS[state.method].icon + ' ' + GAMES[state.method] + 'で決めました';
  $('#quick-result-detail').textContent = state.detail;
  $('#quick-result-title').textContent = resultLabel(state.result);
  $('#quick-result-copy').textContent = state.result === 'yes'
    ? 'いつもなら流してしまう小さなことを、今日はひとつだけ。'
    : 'やらないのもひとつの選択。空いたぶん、別のことが入ってくるかも。';
  $('#quick-result-icon').textContent = state.result === 'yes' ? '↗' : '—';
  $('#quick-memo-open').focus();
}
function draw() {
  if (state.busy) return;
  try {
    const outcome = playQuick(state.method);
    state.busy = true;
    state.animationRun += 1;
    const run = state.animationRun;
    setControlsDisabled(true);
    $('#quick-draw').hidden = true;
    renderAnimation(outcome, run);
  } catch (error) {
    state.busy = false;
    setControlsDisabled(false);
    $('#quick-draw').hidden = false;
    toast(error instanceof Error ? error.message : '抽選できませんでした。');
  }
}
function setChoice(value) {
  state.choice = value;
  $('#quick-choice-follow').setAttribute('aria-pressed', String(value === state.result));
  $('#quick-choice-reverse').setAttribute('aria-pressed', String(value === other(state.result)));
  $('#quick-choice-follow').textContent = 'この答えでいく（' + choiceLabel(state.result) + '）';
  $('#quick-choice-reverse').textContent = 'やっぱり反対（' + choiceLabel(other(state.result)) + '）';
}
function openMemo() {
  if (!state.result) return;
  $('#quick-memo-panel').hidden = false;
  setChoice(state.choice || state.result);
  $('#quick-note').focus();
}
function saveMemo() {
  if (!state.result || !state.createdAt) return;
  try {
    putEntry({
      version: 2,
      id: crypto.randomUUID(),
      note: $('#quick-note').value.trim().slice(0, 240),
      beforeMood: null,
      beforeText: '',
      game: state.method,
      result: state.result,
      choice: state.choice || state.result,
      feeling: null,
      reflection: $('#quick-reflection').value.trim().slice(0, 1000),
      createdAt: state.createdAt.toISOString(),
      localDate: dateKey(state.createdAt)
    });
    $('#quick-dialog').close();
    reset();
    toast('メモを残しました。あとから履歴で見返せます。');
  } catch (error) {
    toast(error instanceof Error ? error.message : 'メモを保存できませんでした。');
  }
}
function finish() {
  state.animationRun += 1;
  state.busy = false;
  cancelMotion();
  $('#quick-dialog').close();
  reset();
}
document.querySelectorAll('[data-quick-method]').forEach(button => {
  button.addEventListener('click', () => setMethod(button.dataset.quickMethod));
});
$('#quick-start-home').addEventListener('click', openQuick);
$('#quick-close').addEventListener('click', finish);
$('#quick-draw').addEventListener('click', draw);
$('#quick-again').addEventListener('click', () => {
  state.animationRun += 1;
  state.busy = false;
  cancelMotion();
  $('#quick-result').hidden = true;
  $('#quick-idle').hidden = false;
  $('#quick-memo-panel').hidden = true;
  $('#quick-draw').hidden = false;
  clearAnimationStage();
  setControlsDisabled(false);
  setMethod(state.method);
  $('#quick-draw').focus();
});
$('#quick-memo-open').addEventListener('click', openMemo);
$('#quick-finish').addEventListener('click', finish);
$('#quick-memo-cancel').addEventListener('click', () => { $('#quick-memo-panel').hidden = true; $('#quick-memo-open').focus(); });
$('#quick-choice-follow').addEventListener('click', () => setChoice(state.result));
$('#quick-choice-reverse').addEventListener('click', () => setChoice(other(state.result)));
$('#quick-save').addEventListener('click', saveMemo);
$('#quick-dialog').addEventListener('cancel', event => { event.preventDefault(); finish(); });

setMethod(state.method);

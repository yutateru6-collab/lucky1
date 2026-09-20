import { drawDecision } from './decision.mjs';
import { GAMES, HANDS, playGame, randomInt } from './games.mjs';
import { putEntry, dateKey } from './journal.mjs';

const $ = s => document.querySelector(s);
const METHOD_KEY = 'lucky.quick.method.v1';
const METHODS = Object.freeze({
  coin: { label: 'コイン', icon: '🪙', rule: '表 / 裏で50 / 50', action: 'コインを投げています…', duration: 980 },
  cards: { label: 'カード', icon: '🃏', rule: '1枚引いて50 / 50', action: 'カードをシャッフル中…', duration: 1180 },
  dice: { label: 'サイコロ', icon: '🎲', rule: '奇数 / 偶数で50 / 50', action: 'サイコロを振っています…', duration: 1080 },
  rps: { label: 'じゃんけん', icon: '✌️', rule: '勝ち / 負けで50 / 50', action: '最初はグー…', duration: 1380 },
  roulette: { label: 'ルーレット', icon: '🎡', rule: '8マスを半分ずつ', action: 'ルーレットを回しています…', duration: 1480 }
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
  timers: []
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
function schedule(fn, delay) {
  const id = setTimeout(fn, delay);
  state.timers.push(id);
  return id;
}
function clearAnimationTimers() {
  state.timers.forEach(clearTimeout);
  state.timers = [];
}
function reducedMotion() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function animationDuration(method) {
  return reducedMotion() ? 160 : METHODS[method].duration;
}

function toast(text) {
  const t = $('#toast');
  if (!t) return;
  clearTimeout(toastTimer);
  t.textContent = text;
  t.hidden = false;
  toastTimer = setTimeout(() => { t.hidden = true; }, 3600);
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
  const stage = $('#quick-animation-stage');
  stage.replaceChildren();
  stage.hidden = true;
  stage.removeAttribute('data-method');
  stage.removeAttribute('data-phase');
  $('#quick-animation-label').textContent = '';
}

function reset() {
  clearAnimationTimers();
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

function coinAnimation(outcome, visual) {
  const wrap = node('div', 'quick-coin-wrap ' + (outcome.result === 'yes' ? 'land-front' : 'land-back'));
  const coin = node('div', 'quick-anim-coin');
  coin.append(node('span', 'coin-face coin-front', '表'), node('span', 'coin-face coin-back', '裏'));
  wrap.append(coin);
  visual.append(wrap);
}

function cardsAnimation(outcome, visual, run) {
  const wrap = node('div', 'quick-cards-wrap');
  const chosen = outcome.chosenCard ?? 0;
  for (let i = 0; i < 2; i++) {
    const card = node('div', 'quick-anim-card' + (i === chosen ? ' chosen' : ''));
    const inner = node('div', 'quick-card-inner');
    inner.append(node('span', 'quick-card-back', '✦'), node('span', 'quick-card-front ' + (outcome.result === 'yes' ? 'yes' : 'no'), outcome.result === 'yes' ? '♥' : '♠'));
    card.append(inner);
    wrap.append(card);
  }
  visual.append(wrap);
  schedule(() => {
    if (state.animationRun !== run) return;
    wrap.classList.add('reveal');
    $('#quick-animation-label').textContent = '1枚、オープン！';
  }, reducedMotion() ? 60 : 720);
}

function diceAnimation(outcome, visual) {
  const die = node('div', 'quick-anim-die', DICE[(outcome.face || 1) - 1]);
  die.dataset.face = String(outcome.face || 1);
  visual.append(die);
}

function rpsAnimation(outcome, visual, run) {
  const wrap = node('div', 'quick-rps-wrap');
  const you = node('div', 'quick-rps-player');
  const lucky = node('div', 'quick-rps-player');
  you.append(node('small', '', 'あなた'), node('span', 'quick-rps-hand', '✊'));
  lucky.append(node('small', '', 'lucky'), node('span', 'quick-rps-hand', '✊'));
  wrap.append(you, node('b', 'quick-rps-vs', 'VS'), lucky);
  visual.append(wrap);
  schedule(() => {
    if (state.animationRun !== run) return;
    you.querySelector('.quick-rps-hand').textContent = HANDS[outcome.hand];
    lucky.querySelector('.quick-rps-hand').textContent = HANDS[outcome.opponent];
    wrap.classList.add('pon');
    $('#quick-animation-label').textContent = 'じゃんけん、ぽん！';
  }, reducedMotion() ? 70 : 760);
}

function rouletteAnimation(outcome, visual) {
  const wrap = node('div', 'quick-roulette-wrap');
  const pointer = node('span', 'quick-roulette-pointer', '▼');
  const wheel = node('div', 'quick-roulette-wheel');
  const center = node('span', 'quick-roulette-center', String(outcome.slot || 1));
  const stop = -(((outcome.slot || 1) - 0.5) * 45);
  wheel.style.setProperty('--quick-stop-angle', stop + 'deg');
  wheel.append(center);
  wrap.append(pointer, wheel);
  visual.append(wrap);
}

function renderAnimation(outcome, run) {
  const stage = $('#quick-animation-stage');
  const visual = node('div', 'quick-animation-visual');
  stage.replaceChildren(visual);
  stage.dataset.method = state.method;
  stage.dataset.phase = 'running';
  stage.hidden = false;
  $('#quick-animation-label').textContent = METHODS[state.method].action;
  if (state.method === 'coin') coinAnimation(outcome, visual);
  if (state.method === 'cards') cardsAnimation(outcome, visual, run);
  if (state.method === 'dice') diceAnimation(outcome, visual);
  if (state.method === 'rps') rpsAnimation(outcome, visual, run);
  if (state.method === 'roulette') rouletteAnimation(outcome, visual);
}

function showResult(outcome, run) {
  if (state.animationRun !== run) return;
  state.busy = false;
  state.result = outcome.result;
  state.choice = outcome.result;
  state.createdAt = new Date();
  state.detail = outcome.detail || '';
  setControlsDisabled(false);
  clearAnimationTimers();
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
    const methodAtDraw = state.method;
    const outcome = playQuick(methodAtDraw);
    state.busy = true;
    state.animationRun += 1;
    const run = state.animationRun;
    setControlsDisabled(true);
    $('#quick-draw').hidden = true;
    renderAnimation(outcome, run);
    const duration = animationDuration(methodAtDraw);
    schedule(() => showResult(outcome, run), duration);
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
  clearAnimationTimers();
  state.animationRun += 1;
  state.busy = false;
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
  clearAnimationTimers();
  state.animationRun += 1;
  state.busy = false;
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

import { drawDecision } from './decision.mjs';
import { GAMES, HANDS, playGame, randomInt } from './games.mjs';
import { putEntry, dateKey } from './journal.mjs';

const $ = s => document.querySelector(s);
const METHOD_KEY = 'lucky.quick.method.v1';
const METHODS = Object.freeze({
  coin: { label: 'コイン', icon: '🪙', rule: '表 / 裏で50 / 50' },
  cards: { label: 'カード', icon: '🃏', rule: '1枚引いて50 / 50' },
  dice: { label: 'サイコロ', icon: '🎲', rule: '奇数 / 偶数で50 / 50' },
  rps: { label: 'じゃんけん', icon: '✌️', rule: '勝ち / 負けで50 / 50' },
  roulette: { label: 'ルーレット', icon: '🎡', rule: '8マスを半分ずつ' }
});
const storedMethod = (() => { try { return localStorage.getItem(METHOD_KEY); } catch { return null; } })();
const state = {
  method: Object.hasOwn(METHODS, storedMethod) ? storedMethod : 'coin',
  result: null,
  choice: null,
  createdAt: null,
  detail: ''
};
let toastTimer;

function resultLabel(v) { return v === 'yes' ? 'やってみる！' : '今回はやらない'; }
function choiceLabel(v) { return v === 'yes' ? 'やる' : 'やらない'; }
function other(v) { return v === 'yes' ? 'no' : 'yes'; }

function toast(text) {
  const t = $('#toast');
  if (!t) return;
  clearTimeout(toastTimer);
  t.textContent = text;
  t.hidden = false;
  toastTimer = setTimeout(() => { t.hidden = true; }, 3600);
}

function setMethod(method) {
  if (!Object.hasOwn(METHODS, method)) return;
  state.method = method;
  try { localStorage.setItem(METHOD_KEY, method); } catch { /* Selection still works in this session. */ }
  document.querySelectorAll('[data-quick-method]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.quickMethod === method));
  });
  $('#quick-method-rule').textContent = METHODS[method].rule;
  $('#quick-draw-icon').textContent = METHODS[method].icon;
  $('#quick-draw-label').textContent = METHODS[method].label + 'で決める';
}

function reset() {
  state.result = null;
  state.choice = null;
  state.createdAt = null;
  state.detail = '';
  $('#quick-idle').hidden = false;
  $('#quick-result').hidden = true;
  $('#quick-memo-panel').hidden = true;
  $('#quick-note').value = '';
  $('#quick-reflection').value = '';
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
    return playGame('cards', { card });
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

function draw() {
  try {
    const outcome = playQuick(state.method);
    state.result = outcome.result;
    state.choice = outcome.result;
    state.createdAt = new Date();
    state.detail = outcome.detail || '';
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
  } catch (error) {
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
  $('#quick-result').hidden = true;
  $('#quick-idle').hidden = false;
  $('#quick-memo-panel').hidden = true;
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

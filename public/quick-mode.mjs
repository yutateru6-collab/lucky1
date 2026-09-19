import { putEntry, dateKey } from './journal.mjs';

const $ = s => document.querySelector(s);
const state = { result: null, choice: null, createdAt: null };
let toastTimer;

function randomChoice() {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] < 0x80000000 ? 'yes' : 'no';
}
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
function reset() {
  state.result = null;
  state.choice = null;
  state.createdAt = null;
  $('#quick-idle').hidden = false;
  $('#quick-result').hidden = true;
  $('#quick-memo-panel').hidden = true;
  $('#quick-note').value = '';
  $('#quick-reflection').value = '';
}
function openQuick() {
  reset();
  const dialog = $('#quick-dialog');
  if (!dialog.open) dialog.showModal();
  $('#quick-draw').focus();
}
function draw() {
  state.result = randomChoice();
  state.choice = state.result;
  state.createdAt = new Date();
  $('#quick-idle').hidden = true;
  $('#quick-result').hidden = false;
  $('#quick-memo-panel').hidden = true;
  $('#quick-result-title').textContent = resultLabel(state.result);
  $('#quick-result-copy').textContent = state.result === 'yes'
    ? 'いつもなら流してしまう小さなことを、今日はひとつだけ。'
    : 'やらないのもひとつの選択。空いたぶん、別のことが入ってくるかも。';
  $('#quick-result-icon').textContent = state.result === 'yes' ? '↗' : '—';
  $('#quick-memo-open').focus();
}
function setChoice(value) {
  state.choice = value;
  $('#quick-choice-follow').setAttribute('aria-pressed', String(value === state.result));
  $('#quick-choice-reverse').setAttribute('aria-pressed', String(value === other(state.result)));
  $('#quick-choice-follow').textContent = `この答えでいく（${choiceLabel(state.result)}）`;
  $('#quick-choice-reverse').textContent = `やっぱり反対（${choiceLabel(other(state.result))}）`;
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
      game: 'coin',
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

$('#quick-start-home').addEventListener('click', openQuick);
$('#quick-close').addEventListener('click', finish);
$('#quick-draw').addEventListener('click', draw);
$('#quick-again').addEventListener('click', draw);
$('#quick-memo-open').addEventListener('click', openMemo);
$('#quick-finish').addEventListener('click', finish);
$('#quick-memo-cancel').addEventListener('click', () => { $('#quick-memo-panel').hidden = true; $('#quick-memo-open').focus(); });
$('#quick-choice-follow').addEventListener('click', () => setChoice(state.result));
$('#quick-choice-reverse').addEventListener('click', () => setChoice(other(state.result)));
$('#quick-save').addEventListener('click', saveMemo);
$('#quick-dialog').addEventListener('cancel', event => { event.preventDefault(); finish(); });

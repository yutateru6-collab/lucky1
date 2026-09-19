import { putEntry, dateKey } from './journal.mjs';

const $ = selector => document.querySelector(selector);
const state = { result: null, choice: null, createdAt: null };

function randomYesNo() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] < 0x80000000 ? 'yes' : 'no';
}

function label(value) {
  return value === 'yes' ? 'やってみる' : '今回はやめる';
}

function opposite(value) {
  return value === 'yes' ? 'no' : 'yes';
}

function resetQuick() {
  state.result = null;
  state.choice = null;
  state.createdAt = null;
  $('#quick-idle').hidden = false;
  $('#quick-result').hidden = true;
  $('#quick-note-panel').hidden = true;
  $('#quick-note').value = '';
  $('#quick-reflection').value = '';
  $('#quick-result-title').textContent = '';
  $('#quick-result-copy').textContent = '';
  $('#quick-choice-follow').setAttribute('aria-pressed', 'true');
  $('#quick-choice-flip').setAttribute('aria-pressed', 'false');
}

function openQuick() {
  resetQuick();
  const dialog = $('#quick-dialog');
  if (!dialog.open) dialog.showModal();
  $('#quick-draw').focus();
}

function drawQuick() {
  state.result = randomYesNo();
  state.choice = state.result;
  state.createdAt = new Date();
  $('#quick-idle').hidden = true;
  $('#quick-result').hidden = false;
  $('#quick-note-panel').hidden = true;
  $('#quick-result-title').textContent = label(state.result);
  $('#quick-result-copy').textContent = state.result === 'yes'
    ? 'いつもなら流す小さなことを、今日はひとつだけ。'
    : 'やらない選択もOK。余白ができると、別の流れが見えることも。';
  $('#quick-result-mark').textContent = state.result === 'yes' ? '↗' : '—';
  $('#quick-memo').focus();
}

function setChoice(value) {
  state.choice = value;
  $('#quick-choice-follow').setAttribute('aria-pressed', String(value === state.result));
  $('#quick-choice-flip').setAttribute('aria-pressed', String(value === opposite(state.result)));
  $('#quick-choice-follow').textContent = `この答えでいく（${label(state.result)}）`;
  $('#quick-choice-flip').textContent = `やっぱり反対（${label(opposite(state.result))}）`;
}

function openMemo() {
  if (!state.result) return;
  $('#quick-note-panel').hidden = false;
  setChoice(state.choice || state.result);
  $('#quick-note').focus();
}

function saveMemo() {
  if (!state.result || !state.createdAt) return;
  const note = $('#quick-note').value.trim().slice(0, 240);
  const reflection = $('#quick-reflection').value.trim().slice(0, 1000);
  try {
    putEntry({
      version: 2,
      id: crypto.randomUUID(),
      note,
      game: 'coin',
      result: state.result,
      choice: state.choice || state.result,
      feeling: null,
      beforeMood: null,
      beforeText: '',
      reflection,
      createdAt: state.createdAt.toISOString(),
      localDate: dateKey(state.createdAt)
    });
    $('#quick-dialog').close();
    resetQuick();
    const toast = $('#toast');
    if (toast) {
      toast.textContent = note ? 'あとから見返せるように、メモを残しました。' : 'この選択を、あしあとに残しました。';
      toast.hidden = false;
      setTimeout(() => { toast.hidden = true; }, 3600);
    }
  } catch (error) {
    const toast = $('#toast');
    if (toast) {
      toast.textContent = error instanceof Error ? error.message : 'メモを保存できませんでした。';
      toast.hidden = false;
    }
  }
}

function doneQuick() {
  $('#quick-dialog').close();
  resetQuick();
}

$('#quick-start').addEventListener('click', openQuick);
$('#quick-draw').addEventListener('click', drawQuick);
$('#quick-again').addEventListener('click', drawQuick);
$('#quick-memo').addEventListener('click', openMemo);
$('#quick-done').addEventListener('click', doneQuick);
$('#quick-close').addEventListener('click', doneQuick);
$('#quick-cancel-note').addEventListener('click', () => { $('#quick-note-panel').hidden = true; $('#quick-memo').focus(); });
$('#quick-choice-follow').addEventListener('click', () => setChoice(state.result));
$('#quick-choice-flip').addEventListener('click', () => setChoice(opposite(state.result)));
$('#quick-save').addEventListener('click', saveMemo);
$('#quick-dialog').addEventListener('cancel', event => { event.preventDefault(); doneQuick(); });

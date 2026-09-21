import { warmReveal, startDecisionMotion, setRevealSound } from './reveal-runtime.mjs';
import { putEntry, dateKey } from './journal.mjs';
import { QUICK_METHODS as METHODS, QUICK_DURATIONS, COIN_SIDES, hasQuickPick, drawQuick } from './quick-draw.mjs';

const $ = selector => document.querySelector(selector);
const METHOD_KEY = 'lucky.quick.method.v1';
let savedMethod = null;
try { savedMethod = localStorage.getItem(METHOD_KEY); } catch { /* Device may block persistence. */ }
const state = { method: Object.hasOwn(METHODS, savedMethod) ? savedMethod : 'coin', pick: null, phase: 'idle', run: 0, motion: null, outcome: null, choice: null, createdAt: null, id: null, saving: false };
const label = value => value === 'yes' ? 'やってみる！' : '今回はやらない';
const opposite = value => value === 'yes' ? 'no' : 'yes';
const node = (tag, cls, text) => { const n = document.createElement(tag); n.className = cls || ''; if (text !== undefined) n.textContent = text; return n; };
const pickText = () => state.method === 'coin' ? `選んだ面：${COIN_SIDES[state.pick]}` : state.method === 'cards' ? `選んだカード：${state.pick === 'left' ? '左' : '右'}` : '';
function error(text = '') { $('#quick-error').textContent = text; $('#quick-error').hidden = !text; }
function cancelMotion() { state.run++; state.motion?.cancel(); state.motion = null; }
function lock() {
  const busy = state.phase === 'animating' || state.phase === 'loading';
  document.querySelectorAll('[data-quick-method], [data-quick-pick]').forEach(b => b.disabled = busy);
  $('#quick-draw').disabled = busy || !hasQuickPick(state.method, state.pick);
  $('#quick-dialog').setAttribute('aria-busy', String(busy));
}
function selection() {
  const box = $('#quick-pick-options'); box.replaceChildren();
  const needsPick = state.method === 'coin' || state.method === 'cards';
  $('#quick-pick-block').hidden = !needsPick;
  $('#quick-pick-heading').textContent = state.method === 'coin' ? '表と裏、どっちでいく？' : '左と右、どっちを引く？';
  $('#quick-pick-help').textContent = state.method === 'coin' ? '選んだ面が出たら「やる」。反対なら「やらない」。' : '選んだカードを開きます。やる・やらないが1枚ずつ。';
  const picks = state.method === 'coin' ? [['heads', '表'], ['tails', '裏']] : [['left', '左のカード'], ['right', '右のカード']];
  if (needsPick) picks.forEach(([key, text]) => {
    const b = node('button', 'quick-pick-button'); b.type = 'button'; b.dataset.quickPick = key;
    b.setAttribute('aria-pressed', String(state.pick === key));
    const mark = node('span', state.method === 'coin' ? 'quick-pick-coin' : 'quick-pick-back', state.method === 'coin' ? text : '✦');
    mark.setAttribute('aria-hidden', 'true');
    b.append(mark, node('strong', '', text), node('span', 'quick-pick-check', state.pick === key ? '✓' : ''));
    b.addEventListener('click', () => {
      if (state.phase !== 'idle') return;
      state.pick = key;
      box.querySelectorAll('button').forEach(other => {
        const active = other.dataset.quickPick === key;
        other.setAttribute('aria-pressed', String(active)); other.querySelector('.quick-pick-check').textContent = active ? '✓' : '';
      });
      error(); updateDraw();
    });
    box.append(b);
  });
  updateDraw();
}
function updateDraw() {
  $('#quick-sound').hidden = !['coin','cards'].includes(state.method);
  const ready = hasQuickPick(state.method, state.pick);
  $('#quick-draw-icon').textContent = METHODS[state.method].icon;
  $('#quick-draw-label').textContent = ready ? (state.method === 'coin' ? `${COIN_SIDES[state.pick]}でいく！` : state.method === 'cards' ? `${state.pick === 'left' ? '左' : '右'}を引く！` : '決める') : 'まず選んでね';
  $('#quick-method-rule').textContent = METHODS[state.method].rule;
  const seconds = QUICK_DURATIONS[state.method] / 1000;
  $('#quick-duration').textContent = `演出は約${Number(seconds.toFixed(1))}秒。決まったあとだけ、任意でメモ。`;
  lock();
}
function setMethod(method) {
  if (['animating','loading'].includes(state.phase) || !Object.hasOwn(METHODS, method)) return;
  state.method = method; state.pick = null;
  try { localStorage.setItem(METHOD_KEY, method); } catch { /* Continue without saving preferences. */ }
  document.querySelectorAll('[data-quick-method]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.quickMethod === method)));
  selection(); error();
}
function reset() {
  cancelMotion(); state.phase = 'idle'; state.pick = null; state.outcome = null; state.choice = null; state.id = null; state.createdAt = null; state.saving = false;
  $('#quick-idle').hidden = false; $('#quick-result').hidden = true; $('#quick-memo-panel').hidden = true;
  $('#quick-draw').hidden = false; $('#quick-animation-stage').replaceChildren(); $('#quick-animation-stage').hidden = true;
  $('#quick-animation-stage').removeAttribute('data-phase'); $('#quick-animation-label').textContent = '';
  $('#quick-selection-note').textContent = ''; $('#quick-note').value = ''; $('#quick-reflection').value = '';
  $('#quick-result-title').textContent = ''; $('#quick-result-detail').textContent = ''; $('#quick-save').disabled = false;
  $('#quick-dialog').classList.remove('cinematic-active','cinematic-finished');
  $('#quick-animation-stage').removeAttribute('data-renderer');
  setMethod(state.method);
}
function openQuick() {
  if ($('#quick-dialog').open) return;
  reset(); $('#quick-dialog').showModal();
  warmReveal(state.method).catch(() => {});
  ($('#quick-pick-options button') || $('#quick-draw')).focus({ preventScroll: true });
}
function finish() {
  cancelMotion(); state.phase = 'idle';
  $('#quick-dialog').close(); reset();
  $('#quick-start-home').focus({ preventScroll: true });
}
async function draw() {
  if (state.phase !== 'idle' || !hasQuickPick(state.method, state.pick)) return;
  try {
    const cinematic = ['coin','cards'].includes(state.method);
    // Capture immutable choice/outcome once; motion never draws or changes the result.
    state.outcome = drawQuick(state.method, state.pick); state.phase = 'animating'; state.choice = state.outcome.result;
    state.createdAt = new Date(); state.id = null;
    const run = ++state.run, outcome = state.outcome, method = state.method;
    $('#quick-selection-note').textContent = pickText();
    $('#quick-pick-block').hidden = true; $('#quick-draw').hidden = true; $('#quick-result').hidden = true;
    error(); lock();
    $('#quick-dialog').classList.toggle('cinematic-active', cinematic);
    state.motion = startDecisionMotion($('#quick-animation-stage'), $('#quick-animation-label'), method, outcome, {
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      onComplete: () => {
        if (run !== state.run || !$('#quick-dialog').open || state.phase !== 'animating') return;
        state.phase = 'result';
        $('#quick-idle').hidden = !cinematic; $('#quick-result').hidden = false;
        $('#quick-dialog').classList.toggle('cinematic-finished', cinematic);
        $('#quick-result-method').textContent = `${METHODS[method].icon} ${METHODS[method].label}で決めました`;
        $('#quick-result-title').textContent = label(outcome.result);
        $('#quick-result-detail').textContent = outcome.detail;
        $('#quick-result-copy').textContent = outcome.result === 'yes' ? 'いつもなら流してしまう小さなことを、今日はひとつだけ。' : 'やらないのも、ひとつの選択。結果と反対を選んでも大丈夫。';
        $('#quick-result-icon').textContent = method === 'coin' ? COIN_SIDES[outcome.landed] : method === 'cards' ? (outcome.result === 'yes' ? '♥' : '♠') : method === 'dice' ? String(outcome.face) : method === 'roulette' ? String(outcome.slot) : '✌️';
        lock(); $('#quick-result-title').focus({ preventScroll: true });
      }
    });
  } catch (e) {
    cancelMotion(); state.phase = 'idle'; $('#quick-draw').hidden = false; $('#quick-animation-stage').hidden = true;
    $('#quick-dialog').classList.remove('cinematic-active','cinematic-finished');
    selection(); error(e instanceof Error ? e.message : '抽選を始められませんでした。');
  }
}
function setChoice(choice) {
  if (!state.outcome) return;
  state.choice = choice;
  const a = $('#quick-choice-follow'), b = $('#quick-choice-reverse');
  a.textContent = `この答えでいく（${state.outcome.result === 'yes' ? 'やる' : 'やらない'}）`;
  b.textContent = `やっぱり反対（${state.outcome.result === 'yes' ? 'やらない' : 'やる'}）`;
  a.setAttribute('aria-pressed', String(choice === state.outcome.result)); b.setAttribute('aria-pressed', String(choice !== state.outcome.result));
}
function openMemo() {
  if (state.phase !== 'result') return;
  setChoice(state.choice); $('#quick-memo-panel').hidden = false; $('#quick-note').focus();
}
function saveMemo() {
  if (state.phase !== 'result' || state.saving || !state.outcome) return;
  state.saving = true; $('#quick-save').disabled = true;
  try {
    state.id ||= crypto.randomUUID();
    putEntry({ version: 2, id: state.id, note: $('#quick-note').value.trim().slice(0,240), beforeMood: null, beforeText: '', game: state.method, result: state.outcome.result, choice: state.choice, feeling: null, reflection: $('#quick-reflection').value.trim().slice(0,1000), createdAt: state.createdAt.toISOString(), localDate: dateKey(state.createdAt) });
    finish(); $('#bottom-nav [data-nav="home"]').click();
    const toast = $('#toast'); toast.textContent = 'メモを残しました。履歴から見返せます。'; toast.hidden = false;
    setTimeout(() => { toast.hidden = true; }, 3600);
  } catch (e) { error(e instanceof Error ? e.message : '保存できませんでした。入力は残しています。'); }
  finally { state.saving = false; $('#quick-save').disabled = false; }
}
document.querySelectorAll('[data-quick-method]').forEach(b => b.addEventListener('click', () => setMethod(b.dataset.quickMethod)));
$('#quick-start-home').addEventListener('click', openQuick);
$('#quick-close').addEventListener('click', finish);
$('#quick-draw').addEventListener('click', draw);
$('#quick-again').addEventListener('click', () => { reset(); ($('#quick-pick-options button') || $('#quick-draw')).focus({ preventScroll: true }); });
$('#quick-memo-open').addEventListener('click', openMemo);
$('#quick-finish').addEventListener('click', finish);
$('#quick-memo-cancel').addEventListener('click', () => { $('#quick-memo-panel').hidden = true; $('#quick-memo-open').focus(); });
$('#quick-choice-follow').addEventListener('click', () => setChoice(state.outcome?.result));
$('#quick-choice-reverse').addEventListener('click', () => setChoice(opposite(state.outcome?.result)));
$('#quick-save').addEventListener('click', saveMemo);
$('#quick-dialog').addEventListener('cancel', e => { e.preventDefault(); finish(); });
$('#quick-dialog').addEventListener('close', () => { if (['animating','loading'].includes(state.phase)) { cancelMotion(); state.phase = 'idle'; } });
setMethod(state.method);

$('#quick-sound').addEventListener('click', () => {
  const enabled = setRevealSound($('#quick-sound').getAttribute('aria-pressed') !== 'true');
  $('#quick-sound').setAttribute('aria-pressed', String(enabled));
  $('#quick-sound').textContent = enabled ? '音：オン' : '音：オフ';
});
// Preload public, local artwork only; notes never leave local storage.
// Artwork is warmed when a decision is opened, not as a boot prerequisite.

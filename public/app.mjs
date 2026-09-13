import { drawDecision, needsHumanJudgment, normalizeRecords, RESULT_LABELS, CHOICE_LABELS, FEELING_LABELS, MAX_RECORDS } from './decision.mjs';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const STORAGE_KEY = 'lucky.records.v1';
const THEME_KEY = 'lucky.theme.v1';
let draft = null;
let busy = false;
let tossGeneration = 0;
let toastTimer;
let deleteTarget = null;
let storageWarning = false;
let records = loadRecords();

function loadRecords() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? normalizeRecords(JSON.parse(value)) : [];
  } catch {
    storageWarning = true;
    return [];
  }
}
function persist(next) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    records = next;
    return true;
  } catch {
    toast('このブラウザには保存できませんでした。抽選はそのまま使えます。');
    return false;
  }
}
function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4200);
}
function setBusy(value) {
  busy = value;
  $('#coin-button').disabled = value;
  $('#toss-button').disabled = value;
  $('#decision-note').disabled = value;
  $('#play-panel').setAttribute('aria-busy', String(value));
}
function reset(focus = false) {
  tossGeneration += 1;
  setBusy(false);
  draft = null;
  $('#coin').classList.remove('is-flipping', 'is-no');
  $('#setup-area').hidden = false;
  $('#result-area').hidden = true;
  $('#safety-area').hidden = true;
  $('#reflection').hidden = true;
  $('#note-details').open = false;
  $('#decision-note').value = '';
  $('#result-note').textContent = '';
  $('#result-note').hidden = true;
  $('#result-title').textContent = '';
  $('#panel-label').textContent = '小さな迷いに、50 / 50。';
  $('#toss-status').textContent = 'どちらが出ても、あなたが選んでいい。';
  $('.play-layout').classList.remove('is-result');
  $$('[data-choice], [data-feeling]').forEach(button => button.setAttribute('aria-pressed', 'false'));
  if (focus) $('#coin-button').focus({ preventScroll: true });
}
async function toss() {
  if (busy || draft) return;
  const note = $('#decision-note').value.trim().slice(0, 120);
  if (needsHumanJudgment(note)) {
    $('#setup-area').hidden = true;
    $('#safety-area').hidden = false;
    $('#panel-label').textContent = '安全のために。';
    $('.play-layout').classList.add('is-result');
    $('#safety-title').focus({ preventScroll: true });
    return;
  }
  let result;
  try { result = drawDecision(); } catch (error) { toast(error.message); return; }
  const generation = ++tossGeneration;
  setBusy(true);
  $('#toss-status').textContent = 'ちいさな偶然を、ひとつ。';
  $('#coin').classList.toggle('is-no', result === 'no');
  $('#coin').classList.add('is-flipping');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  await new Promise(resolve => setTimeout(resolve, reducedMotion ? 80 : 1050));
  // Leaving the view cancels an in-flight draw. Never let a stale timer restore it.
  if (generation !== tossGeneration) return;
  draft = { note, result, choice: null, feeling: null };
  setBusy(false);
  $('#setup-area').hidden = true;
  $('#result-area').hidden = false;
  $('.play-layout').classList.add('is-result');
  $('#panel-label').textContent = '偶然は、ここまで。ここからは、あなた。';
  $('#result-title').textContent = RESULT_LABELS[result];
  $('#result-emblem').textContent = result === 'yes' ? '↗' : '○';
  $('#result-emblem').classList.toggle('is-no', result === 'no');
  $('#result-note').textContent = note;
  $('#result-note').hidden = !note;
  $('#result-title').focus({ preventScroll: true });
}
function choose(choice) {
  if (!draft || !Object.hasOwn(CHOICE_LABELS, choice)) return;
  draft.choice = choice;
  $$('[data-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.choice === choice)));
  $('#reflection').hidden = false;
  $('#choice-message').textContent = ({ yes: '自分で選んだ、その一歩を。', no: '見送るのも、あなたの選択。', undecided: '今すぐ決めなくても、大丈夫。' })[choice];
}
function save() {
  if (!draft || !draft.choice) return;
  // Re-read before writing to reduce accidental overwrites from another open tab.
  records = loadRecords();
  if (records.length >= MAX_RECORDS) {
    toast('あしあとは100件までです。残したい記録を確認して、不要なものを削除してください。');
    return;
  }
  let id;
  try { id = crypto.randomUUID(); } catch { toast('保存に必要な機能が使えません。対応ブラウザで開いてください。'); return; }
  const item = { id, ...draft, createdAt: new Date().toISOString() };
  if (!persist([item, ...records])) return;
  reset();
  navigate('history');
  toast('あなたの選択を、あしあとに残しました。');
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function renderHistory() {
  records = loadRecords();
  const list = $('#history-list');
  list.replaceChildren();
  $('#history-count').textContent = records.length ? `${records.length} 件の、ちいさな選択。` : 'まだ、まっさら。';
  $('#clear-history').hidden = !records.length;
  if (!records.length) {
    const empty = element('div', 'empty-state');
    empty.append(element('div', 'empty-symbol', '✳'), element('h2', '', '急がず、あなたのペースで。'), element('p', '', '残しておきたい選択があったら、ここに。'));
    const link = element('a', '', 'コインを投げてみる ↗');
    link.href = '#home';
    empty.append(link);
    list.append(empty);
    return;
  }
  const formatter = new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  records.forEach(item => {
    const card = element('article', 'history-card');
    const head = element('div', 'history-card-head');
    const date = element('time', '', formatter.format(new Date(item.createdAt)));
    date.dateTime = item.createdAt;
    const remove = element('button', 'delete-one', '削除');
    remove.setAttribute('aria-label', `${item.note || 'この選択'}のあしあとを削除`);
    remove.addEventListener('click', () => askDelete(item.id));
    head.append(date, remove);
    const outcome = element('div', 'record-outcome');
    outcome.append(element('span', '', `コイン：${RESULT_LABELS[item.result]}`), element('span', '', '→'), element('span', 'actual', `自分：${CHOICE_LABELS[item.choice]}`));
    card.append(head, element('h2', '', item.note || '心の中で、迷っていたこと。'), outcome);
    if (item.feeling) card.append(element('p', 'record-feeling', `結果を見たとき：${FEELING_LABELS[item.feeling]}`));
    list.append(card);
  });
}
function askDelete(id) {
  deleteTarget = id;
  $('#delete-title').textContent = id === 'all' ? 'すべてのあしあとを削除しますか？' : 'このあしあとを削除しますか？';
  $('#delete-dialog').showModal();
  $('#cancel-delete').focus();
}
function confirmDelete() {
  const current = loadRecords();
  const next = deleteTarget === 'all' ? [] : current.filter(item => item.id !== deleteTarget);
  if (persist(next)) { renderHistory(); toast('あしあとを削除しました。'); }
  $('#delete-dialog').close();
  deleteTarget = null;
}
function navigate(route) {
  if (location.hash === `#${route}`) routeView();
  else location.hash = route;
}
function routeView() {
  const route = ['home', 'history', 'about'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
  if (route !== 'home') reset();
  for (const view of ['home', 'history', 'about']) $(`#${view}-view`).hidden = view !== route;
  $$('[data-route]').forEach(link => {
    if (link.dataset.route === route) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (route === 'history') renderHistory();
  if (route !== 'home') $(`#${route}-title`).focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('#theme-toggle').setAttribute('aria-label', theme === 'dark' ? 'ライトモードに切り替える' : 'ダークモードに切り替える');
  $('meta[name="theme-color"]').content = theme === 'dark' ? '#182420' : '#f6f5ef';
}
const colorScheme = matchMedia('(prefers-color-scheme: dark)');
let themeChoice = null;
try { themeChoice = localStorage.getItem(THEME_KEY); } catch { /* Optional setting. */ }
if (!['light', 'dark'].includes(themeChoice)) themeChoice = null;
applyTheme(themeChoice || (colorScheme.matches ? 'dark' : 'light'));
colorScheme.addEventListener('change', event => { if (!themeChoice) applyTheme(event.matches ? 'dark' : 'light'); });
$('#theme-toggle').addEventListener('click', () => {
  themeChoice = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(themeChoice);
  try { localStorage.setItem(THEME_KEY, themeChoice); } catch { /* Theme still applies for this session. */ }
});
$('#coin-button').addEventListener('click', toss);
$('#toss-button').addEventListener('click', toss);
$('#decision-note').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); toss(); } });
$$('[data-choice]').forEach(button => button.addEventListener('click', () => choose(button.dataset.choice)));
$$('[data-feeling]').forEach(button => button.addEventListener('click', () => {
  if (!draft) return;
  draft.feeling = draft.feeling === button.dataset.feeling ? null : button.dataset.feeling;
  $$('[data-feeling]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.feeling === draft.feeling)));
}));
$('#save-button').addEventListener('click', save);
$('#reset-button').addEventListener('click', () => { reset(true); window.scrollTo({ top: 0, behavior: 'instant' }); });
$('#safety-back').addEventListener('click', () => reset(true));
$('#clear-history').addEventListener('click', () => askDelete('all'));
$('#cancel-delete').addEventListener('click', () => $('#delete-dialog').close());
$('#confirm-delete').addEventListener('click', confirmDelete);
$('#delete-dialog').setAttribute('aria-labelledby', 'delete-title');
window.addEventListener('hashchange', routeView);
$('.brand').addEventListener('click', () => reset());
$('[data-route="home"]').addEventListener('click', () => reset());
window.addEventListener('storage', event => { if (event.key === STORAGE_KEY && location.hash === '#history') renderHistory(); });
function showConnection() { $('#offline-indicator').hidden = navigator.onLine; }
window.addEventListener('online', showConnection);
window.addEventListener('offline', showConnection);
showConnection();
routeView();
if (storageWarning) toast('保存済みデータを読み込めませんでした。抽選はそのまま使えます。');
if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* Online app works without offline caching. */ });
  });
}

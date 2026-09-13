import { needsHumanJudgment, RESULT_LABELS, CHOICE_LABELS, FEELING_LABELS } from './decision.mjs';
import { GAMES, HANDS, playGame } from './games.mjs';
import { RECORD_KEY, LEGACY_KEY, MOODS, MOOD_ICONS, dateKey, monthDays, loadEntries, putEntry, removeEntry, parseBackup, mergeEntries } from './journal.mjs';
import { WORDS, dailyWord } from './words.mjs';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const icon = name => { const n = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), u = document.createElementNS(n.namespaceURI, 'use'); u.setAttribute('href', `#i-${name}`); n.setAttribute('aria-hidden', 'true'); n.append(u); return n; };
const RULES = { coin: '表は「やる」、裏は「やらない」。どちらも50%。', rps: '勝ったら「やる」、負けたら「やらない」。あいこはもう一度。', cards: '2枚のうち、1枚は「やる」、もう1枚は「やらない」。', dice: '奇数（1・3・5）は「やる」、偶数（2・4・6）は「やらない」。' };
const THEME_KEY = 'lucky.theme.v1', FAVORITES_KEY = 'lucky.words.favorites.v1';
let game = 'coin', beforeMood = null, draft = null, saved = false, busy = false, generation = 0, toastTimer, editingId = null, confirmAction = null, route = 'home', wordFilter = 'all';
let selectedDay = dateKey(), shownMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12);
let favorites = [];
try { const value = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'); if (Array.isArray(value)) favorites = value.filter(id => WORDS.some(w => w.id === id)); } catch { /* Optional UI setting. */ }
function toast(text) { clearTimeout(toastTimer); $('#toast').textContent = text; $('#toast').hidden = false; toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5000); }
function report(error) { toast(error instanceof Error ? error.message : '操作を完了できませんでした。'); }
function getRecords() { try { return loadEntries(); } catch { toast('保存データを読み込めません。元のデータは変更していません。'); return null; } }
function mark(selector, key, value) { $$(selector).forEach(b => b.setAttribute('aria-pressed', String(b.dataset[key] === value))); }
function setBusy(value) {
  busy = value;
  $$('#setup-grid button, #setup-grid textarea').forEach(b => { b.disabled = value; });
  $('#game-stage').classList.toggle('is-playing', value);
  $('#setup-grid').setAttribute('aria-busy', String(value));
}
function setGame(value) {
  if (busy || !Object.hasOwn(GAMES, value)) return;
  game = value; mark('[data-game]', 'game', game);
  Object.keys(GAMES).forEach(id => { $(`#${id}-scene`).hidden = id !== game; });
  $('#game-stage').dataset.mode = game;
  $('#game-rule').textContent = RULES[game];
  $('#play-button').hidden = ['cards', 'rps'].includes(game);
  $('#play-label').textContent = game === 'dice' ? 'サイコロを振る' : 'コインを投げる';
  $('#play-status').textContent = '';
  $('#rps-prompt').textContent = 'あなたの手を選んでね。';
  $('#opponent-hand').textContent = '✊';
}
function showContext(target, entry, full = false) {
  target.replaceChildren();
  target.append(el('h3', '', entry.note || '心の中で迷っていたこと'));
  if (entry.beforeMood) target.append(el('p', '', `抽選前：${MOODS[entry.beforeMood]}`));
  if (entry.beforeText) target.append(el('p', '', entry.beforeText));
  if (full) {
    target.append(el('p', '', `${entry.localDate} · ${GAMES[entry.game]}：${RESULT_LABELS[entry.result]} → 自分：${CHOICE_LABELS[entry.choice]}`));
    if (entry.feeling) target.append(el('p', '', `結果を見て：${FEELING_LABELS[entry.feeling]}`));
  }
}
async function draw(input = {}) {
  if (busy || draft) return;
  const note = $('#decision-note').value.trim(), beforeText = $('#before-text').value.trim();
  if (needsHumanJudgment(`${note} ${beforeText}`)) { $('#safety-dialog').showModal(); return; }
  let outcome;
  try { outcome = playGame(game, input); } catch (error) { report(error); return; }
  const captured = { note, beforeText, beforeMood, game, createdAt: new Date().toISOString(), localDate: dateKey() };
  const token = ++generation;
  setBusy(true); $('#play-status').textContent = game === 'rps' ? 'じゃん、けん……' : 'ちいさな偶然を、ひとつ。';
  await new Promise(resolve => setTimeout(resolve, matchMedia('(prefers-reduced-motion: reduce)').matches ? 40 : 850));
  if (token !== generation) return;
  setBusy(false);
  if (outcome.result === null) {
    $('#opponent-hand').textContent = HANDS[outcome.opponent];
    $('#rps-prompt').textContent = 'あいこ！ もう一度、手を選んでね。';
    $('#play-status').textContent = `${outcome.detail} · あいこなので、まだ結果は出ていません。`;
    $(`[data-hand="${input.hand}"]`).focus({ preventScroll: true });
    return;
  }
  let id;
  try { id = crypto.randomUUID(); } catch { report(new Error('このブラウザでは記録を準備できません。')); return; }
  draft = { version: 2, id, ...captured, result: outcome.result, choice: 'undecided', feeling: null, reflection: '' };
  saved = false;
  $('#setup-grid').hidden = true; $('#result-panel').hidden = false;
  $('#result-title').textContent = RESULT_LABELS[outcome.result];
  $('#result-symbol').textContent = ({ coin: outcome.result === 'yes' ? '↗' : '○', rps: HANDS[outcome.opponent], cards: '✧', dice: String(outcome.face) })[game];
  $('#result-game').textContent = `${GAMES[game]}が選んだのは`;
  $('#result-detail').textContent = outcome.detail;
  showContext($('#result-context'), draft);
  $('#reflection').value = ''; mark('[data-choice]', 'choice', 'undecided'); mark('[data-feeling]', 'feeling', null);
  $('#save-button').disabled = false; $('#new-button').textContent = '記録せず、次の選択へ →';
  $('#result-title').focus({ preventScroll: true });
  $('#result-panel').scrollIntoView({ block: 'start', behavior: 'instant' });
}
function reset() {
  generation++; setBusy(false); draft = null; saved = false; beforeMood = null;
  $('#decision-note').value = ''; $('#before-text').value = ''; $('.feeling-details').open = false;
  mark('[data-mood]', 'mood', null);
  $('#result-panel').hidden = true; $('#setup-grid').hidden = false;
  setGame(game);
  $('#decision-note').focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' });
}
function saveDraft() {
  if (!draft) return;
  const next = { ...draft, reflection: $('#reflection').value.trim() };
  try {
    putEntry(next); draft = next; saved = true;
    selectedDay = draft.localDate; const [y, m] = selectedDay.split('-').map(Number); shownMonth = new Date(y, m - 1, 1, 12);
    $('#new-button').textContent = '新しい選択へ →';
    navigate('calendar'); toast('メモと気持ちを、カレンダーに残しました。');
  } catch (error) { report(error); }
}
function button(text, handler, cls = '') { const b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', handler); return b; }
Object.entries(MOODS).forEach(([key, text]) => {
  const b = button('', () => { beforeMood = beforeMood === key ? null : key; mark('[data-mood]', 'mood', beforeMood); });
  b.dataset.mood = key; b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', text);
  const symbol = el('span', 'mood-symbol', MOOD_ICONS[key]); symbol.setAttribute('aria-hidden', 'true'); b.append(symbol, el('span', '', ({ excited: 'わくわく', unsure: '迷ってる', nervous: '不安', tired: '気が重い', calm: '穏やか' })[key])); $('#mood-options').append(b);
});
Object.entries(FEELING_LABELS).forEach(([key, text]) => {
  const b = button(text, () => { if (!draft) return; draft.feeling = draft.feeling === key ? null : key; saved = false; $('#new-button').textContent = '記録せず、次の選択へ →'; mark('[data-feeling]', 'feeling', draft.feeling); });
  b.dataset.feeling = key; b.setAttribute('aria-pressed', 'false'); $('#after-options').append(b);
});
$$('[data-game]').forEach(b => b.addEventListener('click', () => setGame(b.dataset.game)));
$$('[data-hand]').forEach(b => b.addEventListener('click', () => draw({ hand: b.dataset.hand })));
$$('[data-card]').forEach(b => b.addEventListener('click', () => draw({ card: Number(b.dataset.card) })));
$('#play-button').addEventListener('click', () => draw());
$$('[data-choice]').forEach(b => b.addEventListener('click', () => { if (!draft) return; draft.choice = b.dataset.choice; saved = false; $('#new-button').textContent = '記録せず、次の選択へ →'; mark('[data-choice]', 'choice', draft.choice); }));
$('#reflection').addEventListener('input', () => { saved = false; $('#new-button').textContent = '記録せず、次の選択へ →'; });
$('#save-button').addEventListener('click', saveDraft);
$('#new-button').addEventListener('click', reset);
function chooseDay(key, focus = false) {
  selectedDay = key; const [y, m] = key.split('-').map(Number); shownMonth = new Date(y, m - 1, 1, 12);
  renderCalendar(); if (focus) $(`[data-day="${key}"]`)?.focus({ preventScroll: true });
}
function renderCalendar() {
  const entries = getRecords(); $('#calendar-days').replaceChildren();
  const y = shownMonth.getFullYear(), m = shownMonth.getMonth(), today = dateKey();
  $('#month-label').textContent = `${y}年 ${m + 1}月`;
  const counts = new Map(); for (const e of entries || []) counts.set(e.localDate, (counts.get(e.localDate) || 0) + 1);
  const days = monthDays(y, m), hasSelected = days.some(d => dateKey(d) === selectedDay);
  for (const day of days) {
    const key = dateKey(day), count = counts.get(key) || 0;
    const b = button(String(day.getDate()), () => chooseDay(key)); b.dataset.day = key;
    b.setAttribute('aria-label', `${day.getFullYear()}年${day.getMonth() + 1}月${day.getDate()}日、記録${count}件`);
    b.setAttribute('aria-pressed', String(key === selectedDay));
    b.tabIndex = key === selectedDay || (!hasSelected && day.getDate() === 1 && day.getMonth() === m) ? 0 : -1;
    if (day.getMonth() !== m) b.classList.add('outside'); if (key === today) { b.classList.add('today'); b.setAttribute('aria-current', 'date'); }
    if (count) { const dot = el('span', 'day-dot'); dot.setAttribute('aria-hidden', 'true'); b.append(dot); }
    b.addEventListener('keydown', event => {
      const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
      if (delta !== undefined) { event.preventDefault(); chooseDay(dateKey(new Date(day.getFullYear(), day.getMonth(), day.getDate() + delta, 12)), true); }
    });
    $('#calendar-days').append(b);
  }
  const prefix = `${y}-${String(m + 1).padStart(2, '0')}`;
  $('#month-count').textContent = `${(entries || []).filter(e => e.localDate.startsWith(prefix)).length}件の記録`;
  const [dy, dm, dd] = selectedDay.split('-').map(Number), date = new Date(dy, dm - 1, dd, 12);
  $('#day-title').textContent = `${dm}月${dd}日（${'日月火水木金土'[date.getDay()]}）`;
  const dayEntries = (entries || []).filter(e => e.localDate === selectedDay);
  $('#day-count').textContent = `${dayEntries.length}件`;
  const list = $('#day-records'); list.replaceChildren();
  if (!dayEntries.length) {
    const empty = el('div', 'empty-state'); empty.append(el('div', 'empty-icon', '✳'), el('h3', '', entries === null ? '記録を読み込めませんでした。' : 'この日は、まだまっさら。'), el('p', '', entries === null ? '元のデータは変更していません。ブラウザの保存設定を確認してください。' : '残したい小さな選択があったら、ここに。\n毎日埋めなくても大丈夫。'));
    const link = el('a', 'text-button', '今日のきっかけを選ぶ →'); link.href = '#home'; empty.append(link); list.append(empty); return;
  }
  dayEntries.forEach(entry => {
    const card = el('article', 'record-card'), head = el('div', 'record-header');
    const time = el('time', '', new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit' }).format(new Date(entry.createdAt))); time.dateTime = entry.createdAt;
    head.append(time, el('span', '', GAMES[entry.game]));
    card.append(head, el('h3', '', entry.note || '心の中で迷っていたこと'));
    if (entry.beforeMood) card.append(el('p', 'record-mood', `抽選前：${MOOD_ICONS[entry.beforeMood]} ${MOODS[entry.beforeMood]}`));
    if (entry.beforeText) card.append(el('p', 'record-mood', entry.beforeText));
    const result = el('div', 'record-outcome'), random = el('div'), actual = el('div', 'own-choice');
    random.append(el('small', '', '偶然の答え'), el('span', '', RESULT_LABELS[entry.result])); actual.append(el('small', '', '自分の選択'), el('span', '', CHOICE_LABELS[entry.choice])); result.append(random, actual); card.append(result);
    if (entry.feeling) card.append(el('p', 'record-mood', `結果を見て：${FEELING_LABELS[entry.feeling]}`));
    if (entry.reflection) card.append(el('p', 'record-reflection', entry.reflection));
    card.append(button('あとからひとこと・記録を開く →', () => openEntry(entry.id), 'text-button')); list.append(card);
  });
}
function changeMonth(delta) {
  shownMonth = new Date(shownMonth.getFullYear(), shownMonth.getMonth() + delta, 1, 12);
  if (shownMonth.getFullYear() < 1900 || shownMonth.getFullYear() > 9999) { shownMonth = new Date(); return; }
  selectedDay = dateKey(shownMonth); renderCalendar();
}
$('#prev-month').addEventListener('click', () => changeMonth(-1)); $('#next-month').addEventListener('click', () => changeMonth(1));
$('#today-button').addEventListener('click', () => chooseDay(dateKey()));
function openEntry(id) {
  const entry = getRecords()?.find(e => e.id === id); if (!entry) return;
  editingId = id; showContext($('#edit-context'), entry, true); $('#edit-reflection').value = entry.reflection; $('#edit-dialog').showModal();
}
$('#edit-save').addEventListener('click', () => {
  try {
    const entry = loadEntries().find(e => e.id === editingId); if (!entry) throw new Error('この記録は別の画面で削除されています。');
    const next = { ...entry, reflection: $('#edit-reflection').value.trim() }; putEntry(next);
    if (draft?.id === entry.id) { draft.reflection = next.reflection; $('#reflection').value = next.reflection; }
    $('#edit-dialog').close(); renderCalendar(); toast('あの日の記録に、ひとこと残しました。');
  } catch (error) { report(error); }
});
function ask(title, text, action) { $('#confirm-title').textContent = title; $('#confirm-text').textContent = text; confirmAction = action; $('#confirm-dialog').showModal(); $('#confirm-cancel').focus(); }
$('#confirm-cancel').addEventListener('click', () => { $('#confirm-dialog').close(); confirmAction = null; });
$('#confirm-ok').addEventListener('click', () => { const action = confirmAction; $('#confirm-dialog').close(); confirmAction = null; if (action) action(); });
$('#confirm-dialog').addEventListener('cancel', () => { confirmAction = null; });
$('#delete-button').addEventListener('click', () => {
  const id = editingId;
  ask('この記録を削除しますか？', 'メモ・気持ち・追記を削除します。削除後は元に戻せません。', () => {
    try { removeEntry(id); if (draft?.id === id) reset(); $('#edit-dialog').close(); renderCalendar(); toast('記録を削除しました。'); } catch (error) { report(error); }
  });
});
function wordCard(word, featured = false) {
  const node = el('article', featured ? '' : 'word-card');
  const tag = word.category === 'proverb' ? 'ことわざ · 解説はluckyの言葉で' : 'lucky オリジナル';
  node.append(el('span', 'word-tag', featured ? `今日のひとこと / ${tag}` : tag));
  const favorite = button('', () => {
    const next = favorites.includes(word.id) ? favorites.filter(id => id !== word.id) : [...favorites, word.id];
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); favorites = next; renderWords(); } catch { toast('お気に入りを保存できませんでした。'); }
  }, 'favorite-button');
  favorite.setAttribute('aria-label', `${favorites.includes(word.id) ? 'お気に入りから外す' : 'お気に入りに追加'}：${word.text.replaceAll('\n', '')}`);
  favorite.setAttribute('aria-pressed', String(favorites.includes(word.id))); favorite.append(icon('heart'));
  node.append(favorite, el('blockquote', '', word.text), el('p', '', word.note));
  if (word.source) { const a = el('a', 'source-link', '語句の意味を確認：漢字ペディア ↗'); a.href = word.source; a.target = '_blank'; a.rel = 'noopener noreferrer'; node.append(a); }
  return node;
}
function renderWords() {
  $('#featured-word').replaceChildren(wordCard(dailyWord(dateKey()), true));
  mark('[data-filter]', 'filter', wordFilter);
  const list = $('#word-list'); list.replaceChildren();
  const words = WORDS.filter(w => wordFilter === 'all' || (wordFilter === 'favorites' ? favorites.includes(w.id) : w.category === wordFilter));
  if (!words.length) { const empty = el('div', 'empty-state'); empty.append(el('div', 'empty-icon', '♡'), el('h3', '', 'また読みたい言葉を、ここに。'), el('p', '', 'ハートを押すと、お気に入りに残せます。')); list.append(empty); }
  words.forEach(w => list.append(wordCard(w)));
}
$$('[data-filter]').forEach(b => b.addEventListener('click', () => { wordFilter = b.dataset.filter; renderWords(); }));
function openSettings() { $('#settings-dialog').showModal(); }
$('#settings-open').addEventListener('click', openSettings); $('#backup-open').addEventListener('click', openSettings);
$$('[data-close]').forEach(b => b.addEventListener('click', () => $(`#${b.dataset.close}`).close()));
$('#export-button').addEventListener('click', () => {
  try {
    const entries = loadEntries(), blob = new Blob([JSON.stringify({ app: 'lucky', version: 2, exportedAt: new Date().toISOString(), entries }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = el('a'); a.href = url; a.download = `lucky-backup-${dateKey()}.json`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    toast('バックアップファイルを用意しました。');
  } catch (error) { report(error); }
});
$('#import-button').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', async event => {
  const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
  try {
    if (file.size > 8_000_000) throw new Error('ファイルが大きすぎます。');
    const incoming = parseBackup(await file.text());
    ask('バックアップを読み込みますか？', `${incoming.length}件の記録を確認しました。同じIDの記録は上書きせず、新しい記録だけを追加します。`, () => {
      try { mergeEntries(incoming); $('#settings-dialog').close(); renderCalendar(); navigate('calendar'); toast('バックアップを読み込みました。'); } catch (error) { report(error); }
    });
  } catch { toast('読み込めませんでした。luckyのJSONバックアップを確認してください。元の記録は変更していません。'); }
});
const colorScheme = matchMedia('(prefers-color-scheme: dark)'); let themeChoice = null;
try { const raw = localStorage.getItem(THEME_KEY); if (['light', 'dark'].includes(raw)) themeChoice = raw; } catch { /* Optional. */ }
function theme(value) { document.documentElement.dataset.theme = value; $('meta[name="theme-color"]').content = value === 'dark' ? '#191c20' : '#faf8f2'; $('#theme-toggle').setAttribute('aria-label', value === 'dark' ? 'ライトモードに切り替える' : 'ダークモードに切り替える'); }
theme(themeChoice || (colorScheme.matches ? 'dark' : 'light'));
$('#theme-toggle').addEventListener('click', () => { themeChoice = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; theme(themeChoice); try { localStorage.setItem(THEME_KEY, themeChoice); } catch { /* Session still works. */ } });
colorScheme.addEventListener('change', e => { if (!themeChoice) theme(e.matches ? 'dark' : 'light'); });
function navigate(value) { if (location.hash === `#${value}`) routeView(); else location.hash = value; }
function routeView() {
  let next = location.hash.slice(1); if (next === 'history') next = 'calendar'; if (next === 'about') { openSettings(); next = 'home'; }
  if (!['home', 'calendar', 'words'].includes(next)) next = 'home';
  if (busy && next !== 'home') { generation++; setBusy(false); $('#play-status').textContent = ''; }
  route = next;
  for (const id of ['home', 'calendar', 'words']) $(`#${id}-view`).hidden = id !== route;
  $$('[data-route]').forEach(a => { if (a.dataset.route === route) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $('#today-label').textContent = new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());
  $('#home-word-text').textContent = dailyWord(dateKey()).text;
  if (route === 'calendar') renderCalendar(); if (route === 'words') renderWords();
  if (route !== 'home') $(`#${route}-title`).focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'instant' });
}
window.addEventListener('hashchange', routeView);
window.addEventListener('storage', e => { if ([RECORD_KEY, LEGACY_KEY].includes(e.key) && route === 'calendar') renderCalendar(); });
window.addEventListener('beforeunload', e => { if ((!draft && ($('#decision-note').value || $('#before-text').value)) || (draft && !saved)) { e.preventDefault(); e.returnValue = ''; } });
function connection() { $('#offline-indicator').hidden = navigator.onLine; }
window.addEventListener('online', connection); window.addEventListener('offline', connection); connection(); routeView();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').then(reg => reg.update()).catch(() => {}); });
}

import { needsHumanJudgment, RESULT_LABELS, CHOICE_LABELS, FEELING_LABELS } from './decision.mjs';
import { GAMES, HANDS, playGame } from './games.mjs';
import { RECORD_KEY, LEGACY_KEY, MOODS, dateKey, monthDays, loadEntries, putEntry, removeEntry, parseBackup, mergeEntries } from './journal.mjs';
import { WORDS, dailyWord } from './words.mjs';

// This UI never weights the draw, sends notes off-device, or equates intention with completion.
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const node = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const btn = (text, fn, cls = '') => { const b = node('button', cls, text); b.type = 'button'; b.addEventListener('click', fn); return b; };
const icon = name => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('aria-hidden', 'true'); const u = document.createElementNS(s.namespaceURI, 'use'); u.setAttribute('href', `#i-${name}`); s.append(u); return s; };
const KEYS = { drafts: 'lucky.drafts.v1', favorites: 'lucky.words.favorites.v1', name: 'lucky.profile.name.v1', theme: 'lucky.theme.v1', method: 'lucky.method.v4' };
const METHODS = {
  coin: { symbol: '◉', verb: 'コインを投げてみる', rule: '表は「やる」、裏は「見送る」。それぞれ50%。' },
  dice: { symbol: '⚄', verb: 'サイコロを振ってみる', rule: '奇数は「やる」、偶数は「見送る」。3面ずつ。' },
  cards: { symbol: '♧', verb: '', rule: '2枚から1枚。やる・見送るの位置は、毎回ランダム。' },
  rps: { symbol: '✌', verb: '', rule: '勝てば「やる」、負ければ「見送る」。あいこはもう一度。' },
  roulette: { symbol: '✳', verb: 'ルーレットを回してみる', rule: '1〜4は「やる」、5〜8は「見送る」。4マスずつ。' }
};
const TEMPLATES = [
  { title: '気分を変える', sub: 'いつもの外へ', symbol: '↗', note: 'いつもと違う道を、少しだけ歩く？', step: 'まず靴を履いてみる' },
  { title: '連絡してみる', sub: '人とのつながり', symbol: '↔', note: 'しばらく話していない友達に、ひとこと送る？', step: '送る前に、一行だけ下書きする' },
  { title: '気になる一冊', sub: '自分のために', symbol: '▤', note: '気になっていた本を、1ページだけ読む？', step: '本を手に取って開く' },
  { title: 'ひと息つく', sub: '休むのも、一歩', symbol: '☾', note: 'いったん手を止めて、5分休んでみる？', step: '飲み物を用意して座る' }
];
const state = { route: 'home', method: 'coin', mood: null, template: null, draftId: null, busy: false, saving: false, outcome: null, snapshot: null, choice: 'undecided', choiceTouched: false, feeling: null, plans: { yes: '', no: '', undecided: '' }, saved: null, month: new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12), day: null, filter: 'all' };
let toastTimer, auxiliaryDamaged = false, installPrompt = null, confirmResolve = null;
function toast(text) { clearTimeout(toastTimer); $('#toast').textContent = text; $('#toast').hidden = false; toastTimer = setTimeout(() => $('#toast').hidden = true, 4500); }
function storageWarning(text) { $('#storage-warning').textContent = text; $('#storage-warning').hidden = false; }
function getRaw(key) { try { return localStorage.getItem(key); } catch { storageWarning('この環境では端末への保存が使えません。抽選は使えますが、記録は保存できません。'); return null; } }
function readJSON(key, fallback) { const raw = getRaw(key); if (raw === null) return fallback; try { return JSON.parse(raw); } catch { auxiliaryDamaged = true; storageWarning('一部の設定・下書きを読み込めません。元の保存内容を保護しています。設定から元データを救出できます。'); return fallback; } }
function write(key, value) {
  try {
    if ([KEYS.drafts, KEYS.favorites].includes(key)) {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        let previous;
        try { previous = JSON.parse(raw); } catch { previous = null; }
        const valid = Array.isArray(previous) && (key === KEYS.favorites ? previous.every(x => typeof x === 'string') : previous.every(d => d && typeof d.id === 'string' && typeof d.note === 'string' && typeof d.updatedAt === 'string' && Number.isFinite(Date.parse(d.updatedAt))));
        if (!valid) { auxiliaryDamaged = true; storageWarning('読み込めない保存データを保護しています。設定から元データを救出できます。'); throw new Error('元の保存データを保護するため、上書きを止めました。'); }
      }
    }
    localStorage.setItem(key, value);
  } catch (e) { if (auxiliaryDamaged && e.message.includes('保護')) throw e; throw new Error('端末に保存できませんでした。空き容量やブラウザの設定をご確認ください。画面の入力は残しています。'); }
}
function report(error) { if (error instanceof SyntaxError) toast('保存データの形式を読み込めません。元のデータは変更していません。'); else if (['SecurityError', 'QuotaExceededError'].includes(error?.name)) toast('端末に保存できません。空き容量やブラウザの設定を確認してください。入力は画面に残しています。'); else toast(error instanceof Error ? error.message : '操作を完了できませんでした。'); }
function records() { try { const list = loadEntries(); return list; } catch { storageWarning('保存済みの記録を読み込めません。上書きせずに保護しています。「設定」から元データを救出できます。'); return null; } }
function favorites() { const v = readJSON(KEYS.favorites, []); return Array.isArray(v) ? v.filter(id => WORDS.some(w => w.id === id)) : []; }
function drafts() { const v = readJSON(KEYS.drafts, []); return Array.isArray(v) ? v.filter(d => d && typeof d.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(d.id) && typeof d.note === 'string' && d.note.length <= 240 && typeof d.updatedAt === 'string' && Number.isFinite(Date.parse(d.updatedAt))).slice(0, 20) : []; }
function pressed(selector, key, value) { $$(selector).forEach(b => b.setAttribute('aria-pressed', String(b.dataset[key] === value))); }
function openDialog(id) { const d = $(id); if (!d.open) d.showModal(); }
function message(title, body) { $('#message-heading').textContent = title; $('#message-body').textContent = body; openDialog('#message-dialog'); }
function ask(title, body, ok = '続ける') { return new Promise(resolve => { confirmResolve = resolve; $('#confirm-heading').textContent = title; $('#confirm-body').textContent = body; $('#confirm-ok').textContent = ok; openDialog('#confirm-dialog'); }); }
function settleConfirm(value) { const resolve = confirmResolve; confirmResolve = null; $('#confirm-dialog').close(); resolve?.(value); }
function activeTop() { return ['home', 'history', 'words'].includes(state.route) ? state.route : 'home'; }
async function navigate(route, force = false) {
  const aliases = { choose: 'home', profile: 'home', calendar: 'history' };
  route = aliases[route] || route;
  if (!['home', 'history', 'words', 'result', 'saved'].includes(route)) route = 'home';
  if (state.busy) { history.replaceState(null, '', `#${activeTop()}`); return; }
  if (state.route === 'result' && route !== 'result' && !force) {
    history.replaceState(null, '', '#home');
    if (!(await ask('記録せずに、移動しますか？', '抽選の結果と今の気持ちは保存されません。記録するかどうかも、あなたの自由です。', '記録せずに移動'))) return;
  }
  if (state.saved && route === 'home' && state.route !== 'result') clearNote();
  state.route = route;
  $$('.view').forEach(v => v.hidden = v.dataset.view !== route);
  $$('#bottom-nav a').forEach(a => { if (a.dataset.nav === activeTop()) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $('#bottom-nav').hidden = route === 'result';
  history.replaceState(null, '', `#${activeTop()}`);
  if (route === 'home') renderHome();
  if (route === 'history') renderHistory();
  if (route === 'words') renderWords();
  window.scrollTo({ top: 0, behavior: 'instant' });
  const heading = $(`#${route}-view h1`); if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
}
function renderStage() {
  const stage = $('#game-stage'); stage.replaceChildren();
  if (state.method === 'coin') { stage.append(node('div', 'coin-halo')); const coin = node('div', 'coin'); coin.append(icon('clover')); stage.append(coin, node('div', 'coin-shadow'), node('span', 'stage-spark one', '✧'), node('span', 'stage-spark two', '✧')); }
  if (state.method === 'dice') stage.append(node('div', 'stage-dice', '⚄'));
  if (state.method === 'cards') { const c = node('div', 'stage-cards'); c.append(node('div', 'stage-card', '♧'), node('div', 'stage-card', '♧')); stage.append(c); }
  if (state.method === 'roulette') stage.append(node('div', 'stage-wheel'));
  if (state.method === 'rps') stage.append(node('div', 'stage-hand', '✊'));
  $('#method-open').replaceChildren(document.createTextNode(GAMES[state.method]), node('span', '', '⌄'));
  const controls = $('#game-controls'); controls.replaceChildren();
  if (METHODS[state.method].verb) { const b = btn(METHODS[state.method].verb, () => draw(), 'primary-btn'); b.id = 'draw-button'; b.append(icon('arrow')); controls.append(b); }
  else if (state.method === 'cards') { const g = node('div', 'game-options'); [0, 1].forEach(card => g.append(btn(`${card === 0 ? '左' : '右'}のカードを引く`, () => draw({ card })))); controls.append(g); }
  else { const g = node('div', 'game-options hands'); Object.entries(HANDS).forEach(([hand, symbol]) => { const b = btn(symbol, () => draw({ hand })); b.setAttribute('aria-label', `${{ rock: 'グー', scissors: 'チョキ', paper: 'パー' }[hand]}を出す`); g.append(b); }); controls.append(g); }
  $('#draw-status').textContent = '';
}
function renderMethods() {
  const list = $('#method-list'); list.replaceChildren();
  Object.entries(METHODS).forEach(([key, m]) => { const b = btn('', () => { state.method = key; try { write(KEYS.method, key); } catch (e) { report(e); } renderStage(); $('#method-dialog').close(); }, 'method-option'); b.dataset.method = key; b.setAttribute('aria-pressed', String(state.method === key)); const body = node('div'); body.append(node('strong', '', GAMES[key]), node('small', '', m.rule)); b.append(node('span', 'method-symbol', m.symbol), body, node('span', 'tick', state.method === key ? '✓' : '')); list.append(b); });
}
function renderMoods(focusKey = null) {
  const c = $('#before-moods'); c.replaceChildren(); const keys = ['courage', 'foggy', 'calm', 'excited', 'tired']; if (state.mood && !keys.includes(state.mood)) keys.push(state.mood);
  keys.forEach(key => { const b = btn(MOODS[key], () => { state.mood = state.mood === key ? null : key; renderMoods(key); }); b.dataset.mood = key; b.setAttribute('aria-pressed', String(state.mood === key)); c.append(b); });
  if (focusKey) $(`#before-moods [data-mood="${focusKey}"]`)?.focus();
}
async function chooseTemplate(t) {
  const current = $('#decision-note').value.trim();
  if (current && current !== t.note && !(await ask('メモを入れ替えますか？', '今入力しているメモを、選んだ例に置き換えます。残したいメモは先に下書き保存してください。', '入れ替える'))) return;
  state.template = t; state.draftId = null; $('#decision-note').value = t.note; $('#decision-note').focus(); $('#decision-note').scrollIntoView({ block: 'center', behavior: 'smooth' });
}
function renderHome() {
  const c = $('#templates'); c.replaceChildren(); TEMPLATES.forEach(t => { const b = btn('', () => chooseTemplate(t), 'template-btn'); b.append(node('span', 'template-icon', t.symbol), node('strong', '', t.title), node('small', '', t.sub)); c.append(b); });
  $('#home-word-text').textContent = dailyWord(dateKey()).text;
  renderDrafts(); const rs = records(), recent = $('#recent-list'); recent.replaceChildren();
  if (rs === null) recent.append(empty('保存済みの記録を保護しています。設定から元データを救出できます。'));
  else if (!rs.length) recent.append(empty('まだ、まっさらな一ページ。\n残しておきたい選択ができたら、ここに。'));
  else rs.slice(0, 2).forEach(r => recent.append(recordRow(r)));
}
function empty(text) { const n = node('div', 'empty-state'); n.append(icon('leaf'), node('div', '', text)); return n; }
function saveDraft() {
  const note = $('#decision-note').value.trim(), beforeText = $('#before-text').value.trim();
  if (!note && !beforeText && !state.mood) { toast('メモか気持ちを添えると、下書きに残せます。'); return; }
  try { const id = state.draftId || crypto.randomUUID(); const draft = { id, note, beforeText, beforeMood: state.mood, method: state.method, theme: null, updatedAt: new Date().toISOString() }; write(KEYS.drafts, JSON.stringify([draft, ...drafts().filter(d => d.id !== id)].slice(0, 20))); state.draftId = id; renderDrafts(); toast('迷いを下書きに残しました。急いで決めなくても大丈夫。'); } catch (e) { report(e); }
}
function renderDrafts() {
  const list = drafts(), c = $('#draft-list'); $('#draft-section').hidden = !list.length; c.replaceChildren();
  list.forEach(d => { const row = node('div', 'draft-row'), b = btn('', async () => { if ($('#decision-note').value.trim() && state.draftId !== d.id && !(await ask('この下書きを開きますか？', 'いま入力中のメモが置き換わります。', '下書きを開く'))) return; state.draftId = d.id; state.template = null; $('#decision-note').value = d.note; $('#before-text').value = typeof d.beforeText === 'string' ? d.beforeText.slice(0, 500) : ''; state.mood = Object.hasOwn(MOODS, d.beforeMood) ? d.beforeMood : null; state.method = Object.hasOwn(METHODS, d.method) ? d.method : 'coin'; renderStage(); renderMoods(); $('#decision-note').focus(); $('#decision-note').scrollIntoView({ block: 'center' }); }); b.append(node('strong', '', d.note || '気持ちのメモ'), node('small', '', `${new Date(d.updatedAt).toLocaleDateString('ja-JP')} · 続きから`)); const del = btn('×', async () => { if (!(await ask('この下書きを削除しますか？', '保存した記録は削除されません。', '下書きを削除'))) return; try { write(KEYS.drafts, JSON.stringify(drafts().filter(x => x.id !== d.id))); if (state.draftId === d.id) state.draftId = null; renderDrafts(); toast('下書きを削除しました。'); } catch (e) { report(e); } }); del.setAttribute('aria-label', `下書きを削除：${d.note || '気持ちのメモ'}`); row.append(b, del); c.append(row); });
}
function lockHome(locked) { state.busy = locked; $$('#home-view button, #home-view textarea').forEach(b => b.disabled = locked); $('#game-stage').classList.toggle('rolling', locked); $('#game-controls').setAttribute('aria-busy', String(locked)); }
async function draw(input = {}) {
  if (state.busy) return;
  const snapshot = { note: $('#decision-note').value.trim(), beforeText: $('#before-text').value.trim(), beforeMood: state.mood, game: state.method };
  if (needsHumanJudgment(`${snapshot.note} ${snapshot.beforeText}`)) { message('この迷いは、偶然に任せないで。', '健康・安全・大きなお金・他の人を傷つけることなどは、抽選では決めません。信頼できる人や専門家と、一緒に判断してください。\n\nこれは端末内の限られたキーワードによる補助です。危険な内容をすべて検出できる機能ではありません。'); return; }
  try {
    const out = playGame(state.method, input); lockHome(true); $('#draw-status').textContent = 'ちいさな偶然を、ひとつ。';
    await new Promise(resolve => setTimeout(resolve, matchMedia('(prefers-reduced-motion: reduce)').matches ? 25 : 850));
    lockHome(false);
    if (out.result === null) { $('#draw-status').textContent = `${out.detail} · あいこ。もう一度、好きな手を。`; const hand = $('#game-stage .stage-hand'); if (hand) hand.textContent = HANDS[out.opponent]; return; }
    state.outcome = out; const now = new Date(); state.snapshot = { ...snapshot, id: crypto.randomUUID(), createdAt: now.toISOString(), localDate: dateKey(now) };
    state.choice = 'undecided'; state.choiceTouched = false; state.feeling = null; state.plans = { yes: '', no: '', undecided: '' }; $('#first-step').value = ''; $('#reflection').value = '';
    renderResult(); await navigate('result', true);
  } catch (e) { lockHome(false); $('#draw-status').textContent = ''; report(e); }
}
function renderResult() {
  $('#result-method').textContent = `${GAMES[state.snapshot.game]}から、ひとつのきっかけ。`;
  $('#result-title').textContent = state.outcome.result === 'yes' ? 'やってみる' : '今回は見送る';
  $('#result-detail').textContent = state.outcome.detail;
  $('#result-note').textContent = state.snapshot.note || '心の中で、迷っていたこと。';
  const feelings = $('#after-feelings'); feelings.replaceChildren();
  Object.entries(FEELING_LABELS).forEach(([key, label]) => { const b = btn(label, () => { state.feeling = state.feeling === key ? null : key; updateFeelings(); }); b.dataset.feeling = key; feelings.append(b); });
  const choices = $('#own-choices'); choices.replaceChildren();
  [['yes', 'やってみる'], ['no', '今回は見送る'], ['undecided', 'まだ決めない']].forEach(([key, label]) => { const b = btn(label, () => { state.plans[state.choice] = $('#first-step').value; state.choice = key; state.choiceTouched = true; renderPlan(); }); b.dataset.choice = key; choices.append(b); });
  updateFeelings(); renderPlan();
}
function updateFeelings() {
  pressed('#after-feelings button', 'feeling', state.feeling);
  const messages = { happy: 'その「うれしい」も、あなたの本音のひとつ。', relieved: 'ほっとしたなら、その安心感を大切にしていい。', disappointed: '「本当は、違うほうがいい」が見えたのかも。反対を選んで大丈夫。', unsure: 'すぐに気持ちがわからなくても大丈夫。いまは保留でも。' };
  $('#feeling-insight').textContent = messages[state.feeling] || 'うれしくても、違うと思っても。その気持ちを大切に。';
}
function renderPlan() {
  pressed('#own-choices button', 'choice', state.choiceTouched ? state.choice : null); $('#step-plan').hidden = !state.choiceTouched;
  $('#save-result').replaceChildren(document.createTextNode(state.choiceTouched ? 'この選択を、記録する' : '今の気持ちを、記録する'), icon('arrow'));
  const labels = { yes: '最初の一歩を、小さくするなら？', no: '見送る自分に、ひとこと添えるなら？', undecided: '決める前に、確かめておきたいことは？' };
  $('#first-step-label').replaceChildren(document.createTextNode(labels[state.choice] + ' '), node('span', 'optional', '任意'));
  $('#first-step').value = state.plans[state.choice];
  $('#first-step').placeholder = { yes: '例：まず靴を履いてみる', no: '例：今日は休んで、また考える', undecided: '例：どちらが気になっているのか、少し考える' }[state.choice];
  const hints = state.choice === 'yes' ? [state.template?.step || 'まず準備をひとつだけする', '2分だけ試してみる'] : state.choice === 'no' ? ['今日は自分のペースを大切に', '気になったら、また考える'] : ['いったん、ひと息つく', '何が気になるか書き出してみる'];
  const c = $('#step-hints'); c.replaceChildren(); hints.forEach(text => c.append(btn(text, () => { $('#first-step').value = text; state.plans[state.choice] = text; })));
}
async function saveResult() {
  if (!state.outcome || state.saving) return;
  state.saving = true; $('#save-result').disabled = true;
  try {
    const plan = $('#first-step').value.trim().slice(0, 300), reflection = $('#reflection').value.trim().slice(0, 650);
    const prefix = { yes: '最初の一歩：', no: '見送る自分へ：', undecided: '決める前に：' }[state.choice];
    const entry = { version: 2, ...state.snapshot, result: state.outcome.result, choice: state.choice, feeling: state.feeling, reflection: [plan ? prefix + plan : '', reflection].filter(Boolean).join('\n\n') };
    putEntry(entry); state.saved = entry;
    if (state.draftId) { try { write(KEYS.drafts, JSON.stringify(drafts().filter(d => d.id !== state.draftId))); } catch { storageWarning('記録は保存できましたが、下書きの削除は完了しませんでした。下書きはそのまま残しています。'); } }
    $('#saved-choice').textContent = { yes: 'やってみる', no: '今回は見送る', undecided: 'まだ決めない' }[entry.choice];
    $('#saved-note').textContent = entry.note || '心の中で、迷っていたこと。'; $('#saved-plan').textContent = entry.reflection || 'あとから気づいたことも、あしあとに書き足せます。';
    $('#saved-copy').textContent = { yes: '大きく変えなくていい。まずは、できる大きさで。', no: '見送ることも、自分を大切にする選択。', undecided: '急がずに。気持ちが追いつくときで大丈夫。' }[entry.choice];
    await navigate('saved', true);
  } catch (e) { report(e); } finally { state.saving = false; $('#save-result').disabled = false; }
}
function clearNote() { state.saved = null; $('#decision-note').value = ''; $('#before-text').value = ''; state.mood = null; state.draftId = null; state.template = null; state.outcome = null; state.snapshot = null; renderStage(); renderMoods(); }
function readableDay(key) { const [y, m, d] = key.split('-').map(Number); return `${y}年${m}月${d}日`; }
function recordRow(r) { const b = btn('', () => openRecord(r.id), 'record-row'); const body = node('div', 'record-body'); body.append(node('strong', '', r.note || '心の中の、小さな迷い'), node('small', '', `${readableDay(r.localDate)} · 自分：${CHOICE_LABELS[r.choice]}`)); b.append(node('span', 'record-symbol', METHODS[r.game]?.symbol || '✳'), body, node('span', 'muted', '›')); return b; }
function renderHistory() {
  const rs = records(), y = state.month.getFullYear(), m = state.month.getMonth(); $('#month-label').textContent = `${y}年 ${m + 1}月`;
  const counts = new Map(); (rs || []).forEach(r => counts.set(r.localDate, (counts.get(r.localDate) || 0) + 1));
  const c = $('#calendar-days'); c.replaceChildren();
  monthDays(y, m).forEach(d => { const key = dateKey(d), b = btn(String(d.getDate()), () => { state.day = key; renderHistory(); $(`#calendar-days [data-day="${key}"]`)?.focus(); }); b.dataset.day = key; b.classList.toggle('outside', d.getMonth() !== m); b.classList.toggle('today', key === dateKey()); b.setAttribute('aria-label', `${readableDay(key)}、記録${counts.get(key) || 0}件`); b.setAttribute('aria-pressed', String(state.day === key)); if (key === dateKey()) b.setAttribute('aria-current', 'date'); if (counts.has(key)) b.append(node('i', 'dot')); c.append(b); });
  $('#history-label').textContent = state.day ? readableDay(state.day) : 'すべての記録';
  const list = $('#history-list'); list.replaceChildren();
  if (rs === null) { $('#record-count').textContent = ''; list.append(empty('記録を読み込めません。元のデータは変更していません。')); return; }
  const q = $('#record-search').value.trim().normalize('NFKC').toLocaleLowerCase('ja-JP');
  const filtered = rs.filter(r => (!state.day || r.localDate === state.day) && (!q || `${r.note} ${r.reflection} ${r.beforeText}`.normalize('NFKC').toLocaleLowerCase('ja-JP').includes(q)));
  $('#record-count').textContent = `${filtered.length}件`;
  if (!filtered.length) { list.append(empty(q ? 'この言葉に合う記録はありません。' : state.day ? 'この日の記録は、まだありません。\n使わない日があっても、大丈夫。' : 'まだ、まっさらな一ページ。\n残しておきたい選択ができたら、ここに。')); return; }
  filtered.forEach(r => list.append(recordRow(r)));
}
function openRecord(id) {
  const r = records()?.find(e => e.id === id); if (!r) { toast('記録が見つかりませんでした。'); return; }
  const c = $('#record-detail'); c.replaceChildren(node('p', 'eyebrow', readableDay(r.localDate)), node('h3', 'record-detail-note', r.note || '心の中の、小さな迷い'));
  const pairs = [['偶然の答え', `${GAMES[r.game]} → ${RESULT_LABELS[r.result]}`], ['自分の選択', CHOICE_LABELS[r.choice]], ['選ぶ前の気持ち', r.beforeMood ? MOODS[r.beforeMood] : '未入力'], ['結果を見た気持ち', r.feeling ? FEELING_LABELS[r.feeling] : '未入力']];
  if (r.beforeText) pairs.push(['選ぶ前のメモ', r.beforeText]);
  pairs.forEach(([label, value]) => { const p = node('div', 'detail-pair'); p.append(node('span', '', label), node('strong', '', value)); c.append(p); });
  const f = node('div', 'detail-reflection'), label = node('label', '', 'そのあと、どうだった？'), ta = node('textarea'); ta.id = 'record-reflection'; label.htmlFor = ta.id; ta.rows = 5; ta.maxLength = 1000; ta.value = r.reflection; ta.placeholder = 'やってみた感想も、見送ってよかったことも。';
  f.append(label, ta, btn('振り返りを保存する', () => { try { const latest = loadEntries().find(e => e.id === id); if (!latest) throw new Error('この記録は別の画面で削除されました。'); putEntry({ ...latest, reflection: ta.value.trim() }); toast('振り返りを保存しました。'); renderHistory(); renderHome(); } catch (e) { report(e); } }, 'primary-btn'), node('p', 'privacy-line', '実行したかどうかは、本人の振り返りとして残します。')); c.append(f);
  c.append(btn('この記録を削除する', async () => { if (!(await ask('この記録を削除しますか？', '削除すると元に戻せません。他の記録には影響しません。', 'この記録を削除'))) return; try { removeEntry(id); $('#record-dialog').close(); renderHistory(); renderHome(); toast('記録を削除しました。'); } catch (e) { report(e); } }, 'text-btn delete-btn wide'));
  openDialog('#record-dialog');
}
function renderWords(focusId = null) {
  pressed('#word-filters button', 'filter', state.filter); const favs = favorites(); const words = WORDS.filter(w => state.filter === 'all' || (state.filter === 'favorites' ? favs.includes(w.id) : w.category === state.filter)); const c = $('#words-feed'); c.replaceChildren();
  if (!words.length) { c.append(empty('好きなことばのハートを押すと、ここに残せます。')); return; }
  words.forEach(w => { const card = node('article', 'word-card'), fav = btn('', () => { const next = favorites(); try { write(KEYS.favorites, JSON.stringify(next.includes(w.id) ? next.filter(id => id !== w.id) : [...next, w.id])); renderWords(w.id); toast(next.includes(w.id) ? 'お気に入りから外しました。' : 'お気に入りに残しました。'); } catch (e) { report(e); } }, 'favorite-btn'); fav.dataset.wordId = w.id; fav.append(icon('heart')); fav.setAttribute('aria-label', `お気に入り：${w.text.replaceAll('\n', '')}`); fav.setAttribute('aria-pressed', String(favs.includes(w.id))); card.append(node('h2', '', w.text), node('p', '', w.note), fav); if (w.source) { const a = node('a', 'text-link', 'ことわざの出典 ↗'); a.href = w.source; a.target = '_blank'; a.rel = 'noopener noreferrer'; card.append(a); } c.append(card); });
  if (focusId) ($(`#words-feed [data-word-id="${focusId}"]`) || $('#word-filters [aria-pressed=true]'))?.focus();
}
function applyTheme(value) { const theme = ['light', 'dark', 'auto'].includes(value) ? value : 'auto'; const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches); document.documentElement.dataset.theme = dark ? 'dark' : 'light'; $('meta[name="theme-color"]').content = dark ? '#15221d' : '#f6f5ef'; $('#theme-select').value = theme; }
function settings() { $('#profile-name').value = getRaw(KEYS.name) || ''; const rs = records(); $('#raw-export').hidden = rs !== null && !auxiliaryDamaged; openDialog('#settings-dialog'); }
function download(name, text, type = 'application/json') { const url = URL.createObjectURL(new Blob([text], { type })); const a = node('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function exportRecords() { try { const entries = loadEntries(); download(`lucky-records-${dateKey()}.json`, JSON.stringify({ app: 'lucky', version: 2, exportedAt: new Date().toISOString(), entries }, null, 2)); toast('記録の書き出しファイルを用意しました。保存先を確認してください。'); } catch (e) { report(e); $('#raw-export').hidden = false; } }
async function importRecords(file) { if (!file) return; try { if (file.size > 8_000_000) throw new Error('ファイルが大きすぎます。8MB以内の記録ファイルを選んでください。'); const incoming = parseBackup(await file.text()); if (!(await ask('記録を読み込みますか？', `${incoming.length}件を確認しました。同じIDの記録は重複させず、現在の記録を優先します。既存の記録は消しません。`, '追加して読み込む'))) return; const before = loadEntries().length; const after = mergeEntries(incoming); toast(`${after.length - before}件の記録を追加しました。`); renderHome(); renderHistory(); } catch (e) { report(e); } finally { $('#import-file').value = ''; } }
function installHelp() { if (installPrompt) { const prompt = installPrompt; installPrompt = null; prompt.prompt().then(() => prompt.userChoice).catch(() => message('ホーム画面に追加する', 'ブラウザのメニューから「ホーム画面に追加」または「アプリをインストール」を選んでください。')); return; } const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); message('次に迷ったら、すぐそばに。', ios ? 'Safariでこのページを開き、共有ボタン →「ホーム画面に追加」を選んでください。\n\n見つからない場合は、共有メニューを下へスクロールしてください。追加は任意です。' : 'ブラウザのメニューから「ホーム画面に追加」または「アプリをインストール」を選んでください。表示されないブラウザでは、ブックマークから開けます。\n\n追加は任意です。'); }
async function shareApp() { const data = { title: 'lucky — 迷ったときの、小さな味方。', text: '決めるのはあなた。きっかけは偶然。', url: 'https://lucky1.itisnowornever271.workers.dev/' }; try { if (navigator.share) await navigator.share(data); else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(`${data.title}\n${data.url}`); toast('紹介用のURLをコピーしました。メモは含みません。'); } else message('luckyを紹介する', `紹介用URL（あなたのメモは含まれません）\n${data.url}`); } catch (e) { if (e.name !== 'AbortError') message('luckyを紹介する', data.url); } }

// Bindings are registered once; all user-authored strings go through textContent/value.
$$('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
$('#confirm-ok').addEventListener('click', () => settleConfirm(true)); $('#confirm-cancel').addEventListener('click', () => settleConfirm(false)); $('#confirm-dialog').addEventListener('cancel', e => { e.preventDefault(); settleConfirm(false); });
$$('a[href^="#"]').filter(a => a.getAttribute('href') !== '#main').forEach(a => a.addEventListener('click', e => { e.preventDefault(); navigate(a.hash.slice(1)); }));
window.addEventListener('hashchange', () => navigate(location.hash.slice(1)));
$('#method-open').addEventListener('click', () => { renderMethods(); openDialog('#method-dialog'); });
$('#decision-note').addEventListener('input', () => { if (state.template && $('#decision-note').value.trim() !== state.template.note) state.template = null; });
$('#settings-open').addEventListener('click', settings); $('#draft-save').addEventListener('click', saveDraft);
$('#safety-open').addEventListener('click', () => message('日常の、小さな迷いのために。', 'luckyは、ふだんの小さな選択に偶然を借りるアプリです。\n\n健康・安全・大きなお金・法律に関わることや、人を傷つけることは抽選で決めないでください。急ぎの対応を遅らせる用途にも使わないでください。\n\n結果は「やる／見送る」が50/50。占いや助言ではありません。結果に従う義務もありません。'));
$('#result-back').addEventListener('click', () => navigate('home')); $('#finish-without-save').addEventListener('click', () => navigate('home', true)); $('#save-result').addEventListener('click', saveResult);
$('#saved-home').addEventListener('click', () => navigate('home', true)); $('#saved-journal').addEventListener('click', () => { state.day = state.saved?.localDate || null; navigate('history', true); });
$('#month-prev').addEventListener('click', () => { if (state.month.getFullYear() <= 1900 && state.month.getMonth() === 0) return; state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1, 12); renderHistory(); });
$('#month-next').addEventListener('click', () => { if (state.month.getFullYear() >= 9999 && state.month.getMonth() === 11) return; state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1, 12); renderHistory(); });
$('#all-records').addEventListener('click', () => { state.day = null; renderHistory(); }); $('#record-search').addEventListener('input', renderHistory);
$$('#word-filters button').forEach(b => b.addEventListener('click', () => { state.filter = b.dataset.filter; renderWords(); }));
$('#theme-select').addEventListener('change', () => { try { write(KEYS.theme, $('#theme-select').value); applyTheme($('#theme-select').value); } catch (e) { report(e); } });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(getRaw(KEYS.theme) || 'auto'));
$('#name-save').addEventListener('click', () => { try { const name = $('#profile-name').value.trim(); write(KEYS.name, name); toast(name ? `${name}さんのペースで、使ってくださいね。` : '呼び名を解除しました。'); } catch (e) { report(e); } });
$('#export-records').addEventListener('click', exportRecords); $('#import-open').addEventListener('click', () => $('#import-file').click()); $('#import-file').addEventListener('change', e => importRecords(e.target.files[0]));
$('#raw-export').addEventListener('click', () => { try { download(`lucky-original-data-${dateKey()}.json`, JSON.stringify({ app: 'lucky-rescue', recordsV2: localStorage.getItem(RECORD_KEY), recordsV1: localStorage.getItem(LEGACY_KEY), drafts: localStorage.getItem(KEYS.drafts), favorites: localStorage.getItem(KEYS.favorites) }, null, 2)); } catch (e) { report(e); } });
$('#share-app').addEventListener('click', shareApp); $('#install-open').addEventListener('click', installHelp); $('#settings-install').addEventListener('click', installHelp);
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; });
function updateNetwork() { $('#network-status').hidden = navigator.onLine; } window.addEventListener('online', updateNetwork); window.addEventListener('offline', updateNetwork);
window.addEventListener('storage', e => { if ([RECORD_KEY, LEGACY_KEY, KEYS.drafts, KEYS.favorites, null].includes(e.key)) { renderHome(); if (state.route === 'history') renderHistory(); if (state.route === 'words') renderWords(); } if (e.key === KEYS.theme) applyTheme(e.newValue || 'auto'); });
const preferredMethod = getRaw(KEYS.method); if (Object.hasOwn(METHODS, preferredMethod)) state.method = preferredMethod;
applyTheme(getRaw(KEYS.theme) || 'auto'); renderStage(); renderMoods(); updateNetwork(); navigate(location.hash.slice(1) || 'home', true);
if ('serviceWorker' in navigator && navigator.onLine && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(reg => reg.update()).catch(() => { /* Online use remains available; do not claim offline readiness. */ });

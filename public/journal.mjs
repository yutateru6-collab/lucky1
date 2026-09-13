import { RESULT_LABELS, CHOICE_LABELS, FEELING_LABELS } from './decision.mjs';
import { GAMES } from './games.mjs';
export const RECORD_KEY = 'lucky.records.v2';
export const LEGACY_KEY = 'lucky.records.v1';
export const MAX_ENTRIES = 1000;
export const MOODS = Object.freeze({ excited: 'わくわく', unsure: '迷ってる', nervous: 'ちょっと不安', tired: '気が重い', calm: '落ち着いてる' });
export const MOOD_ICONS = Object.freeze({ excited: '☺', unsure: '〰', nervous: '☁', tired: '☾', calm: '☀' });
const own = (obj, key) => typeof key === 'string' && Object.hasOwn(obj, key);
export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (y < 1900 || y > 9999) return false;
  const date = new Date(y, m - 1, d, 12);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}
export function normalizeEntry(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  if (typeof item.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(item.id)) return null;
  if (typeof item.note !== 'string' || item.note.length > 240) return null;
  if (!own(RESULT_LABELS, item.result) || !own(CHOICE_LABELS, item.choice)) return null;
  if (typeof item.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(item.createdAt) || !Number.isFinite(Date.parse(item.createdAt))) return null;
  const legacy = item.version === undefined;
  if (!legacy && item.version !== 2) return null;
  const game = legacy ? 'coin' : item.game;
  if (!own(GAMES, game)) return null;
  const feeling = item.feeling ?? null, beforeMood = item.beforeMood ?? null;
  if (feeling !== null && !own(FEELING_LABELS, feeling)) return null;
  if (beforeMood !== null && !own(MOODS, beforeMood)) return null;
  const beforeText = item.beforeText ?? '', reflection = item.reflection ?? '';
  if (typeof beforeText !== 'string' || beforeText.length > 500 || typeof reflection !== 'string' || reflection.length > 1000) return null;
  const localDate = legacy ? dateKey(new Date(item.createdAt)) : item.localDate;
  if (!validDay(localDate)) return null;
  return { version: 2, id: item.id, note: item.note, beforeMood, beforeText, game, result: item.result, choice: item.choice, feeling, reflection, createdAt: item.createdAt, localDate };
}
export function parseEntries(raw) {
  if (!Array.isArray(raw)) throw new Error('記録データの形式が違います。元のデータは変更していません。');
  const seen = new Set(), entries = [];
  for (const item of raw) {
    const entry = normalizeEntry(item);
    if (!entry) throw new Error('読み込めない記録があります。データを保護するため、上書きを止めました。');
    if (!seen.has(entry.id)) { seen.add(entry.id); entries.push(entry); }
  }
  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function loadEntries(storage = globalThis.localStorage) {
  const raw = storage.getItem(RECORD_KEY) ?? storage.getItem(LEGACY_KEY);
  return raw === null ? [] : parseEntries(JSON.parse(raw));
}
export function putEntry(entry, storage = globalThis.localStorage) {
  const clean = normalizeEntry(entry);
  if (!clean) throw new Error('記録の内容を確認してください。');
  const entries = loadEntries(storage), exists = entries.some(e => e.id === clean.id);
  if (!exists && entries.length >= MAX_ENTRIES) throw new Error('記録が1,000件になりました。バックアップしてから、不要な記録を削除してください。');
  const next = [clean, ...entries.filter(e => e.id !== clean.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  storage.setItem(RECORD_KEY, JSON.stringify(next));
  return next;
}
export function removeEntry(id, storage = globalThis.localStorage) {
  const next = loadEntries(storage).filter(item => item.id !== id);
  storage.setItem(RECORD_KEY, JSON.stringify(next));
  return next;
}
export function parseBackup(text) {
  if (text.length > 8_000_000) throw new Error('ファイルが大きすぎます。');
  const data = JSON.parse(text);
  if (data?.app !== 'lucky' || data.version !== 2 || !Array.isArray(data.entries)) throw new Error('luckyのバックアップファイルを選んでください。');
  return parseEntries(data.entries);
}
export function mergeEntries(incoming, storage = globalThis.localStorage) {
  const current = loadEntries(storage), seen = new Set(current.map(e => e.id));
  const additions = parseEntries(incoming).filter(e => !seen.has(e.id));
  if (current.length + additions.length > MAX_ENTRIES) throw new Error('合計が1,000件を超えるため、取り込めません。');
  const next = [...current, ...additions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  storage.setItem(RECORD_KEY, JSON.stringify(next));
  return next;
}
/** 42 local-noon dates; avoids UTC day shifts and DST-midnight errors. */
export function monthDays(year, month) {
  const start = new Date(year, month, 1, 12);
  const offset = (start.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - offset + i, 12));
}

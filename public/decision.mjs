/** Every Uint32 value below 2^31 maps to yes; every other value maps to no. */
export function drawDecision(cryptoSource = globalThis.crypto) {
  if (!cryptoSource || typeof cryptoSource.getRandomValues !== 'function') {
    throw new Error('この環境では安全な抽選が使えません。対応ブラウザで開いてください。');
  }
  const value = new Uint32Array(1);
  cryptoSource.getRandomValues(value);
  return value[0] < 0x80000000 ? 'yes' : 'no';
}
export const RESULT_LABELS = Object.freeze({ yes: 'やる', no: 'やらない' });
export const CHOICE_LABELS = Object.freeze({ yes: 'やってみる', no: '今回はやめておく', undecided: 'まだ決めない' });
export const FEELING_LABELS = Object.freeze({ happy: 'うれしい', relieved: 'ほっとした', disappointed: '少し残念', unsure: 'わからない' });
export const MAX_RECORDS = 100;
const riskyPatterns = [
  /自殺|自傷|死にたい|死ぬ|殺す|殺害|殴る|暴行|刺す|飛び降り|首を[吊つ]|リストカット/u,
  /救急|救命|人命|意識.{0,4}(ない|不明)|呼吸.{0,4}(ない|停止)|心肺|溺れ|おぼれ/u,
  /服薬|投薬|処方|手術|通院|受診|治療|医療|診断|薬.{0,12}(飲|やめ|止め|増|減)|くすり.{0,8}(のむ|やめ)/u,
  /借金|融資|ローン|投資|全財産|大金|ギャンブル|賭博|賭け|違法|犯罪|万引|窃盗|飲酒運転|無免許|危険|立入禁止|不法侵入/u,
  /\b(suicide|self[- ]?harm|kill|medication|overdose|emergency|invest|loan|gambl\w*)\b/iu
];
/** A deliberately limited local keyword guard, NOT a safety classifier. */
export function needsHumanJudgment(note = '') {
  const text = String(note).normalize('NFKC');
  return riskyPatterns.some(pattern => pattern.test(text));
}
export function normalizeRecords(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  return input.filter(item => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(item.id) || seen.has(item.id)) return false;
    if (typeof item.note !== 'string' || item.note.length > 120) return false;
    if (!Object.hasOwn(RESULT_LABELS, item.result) || !Object.hasOwn(CHOICE_LABELS, item.choice)) return false;
    if (item.feeling !== null && !Object.hasOwn(FEELING_LABELS, item.feeling)) return false;
    if (typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt))) return false;
    seen.add(item.id);
    return true;
  }).slice(0, MAX_RECORDS).map(({ id, note, result, choice, feeling, createdAt }) => ({ id, note, result, choice, feeling, createdAt }));
}

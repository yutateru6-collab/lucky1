import { drawDecision } from './decision.mjs';
export const GAMES = Object.freeze({ coin: 'コイン', rps: 'じゃんけん', cards: 'カード', dice: 'サイコロ' });
export const HANDS = Object.freeze({ rock: '✊', scissors: '✌️', paper: '✋' });
/** Rejection sampling avoids modulo bias. No history-based weighting. */
export function randomInt(n, source = globalThis.crypto) {
  if (!Number.isInteger(n) || n < 1 || n > 256) throw new RangeError('Invalid range');
  if (!source?.getRandomValues) throw new Error('このブラウザでは抽選を使えません。');
  const limit = 0x100000000 - (0x100000000 % n);
  const a = new Uint32Array(1);
  for (let i = 0; i < 128; i++) { source.getRandomValues(a); if (a[0] < limit) return a[0] % n; }
  throw new Error('抽選を完了できませんでした。もう一度お試しください。');
}
export function playGame(game, input = {}, source = globalThis.crypto) {
  if (game === 'coin') return { result: drawDecision(source), detail: 'コインを投げました' };
  if (game === 'cards') {
    if (![0, 1].includes(input.card)) throw new RangeError('Invalid card');
    const yesAt = drawDecision(source) === 'yes' ? 0 : 1;
    return { result: yesAt === input.card ? 'yes' : 'no', yesAt, detail: `${input.card === 0 ? '左' : '右'}のカードを選びました` };
  }
  if (game === 'dice') {
    const face = randomInt(6, source) + 1;
    return { result: face % 2 ? 'yes' : 'no', face, detail: `${face}が出ました · 奇数は「やる」、偶数は「やらない」` };
  }
  if (game === 'rps') {
    const order = Object.keys(HANDS), player = order.indexOf(input.hand);
    if (player < 0) throw new RangeError('Invalid hand');
    const opponent = randomInt(3, source), diff = (opponent - player + 3) % 3;
    return { result: diff === 0 ? null : diff === 1 ? 'yes' : 'no', opponent: order[opponent], hand: input.hand, detail: `あなた ${HANDS[input.hand]} / lucky ${HANDS[order[opponent]]}` };
  }
  throw new RangeError('Unknown game');
}

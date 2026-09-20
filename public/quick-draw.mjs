import { drawDecision } from './decision.mjs';
import { HANDS, playGame, randomInt } from './games.mjs';

// Requested fivefold increase over the 4.0.7 normal-mode durations.
// Reduce Motion changes movement, never the duration or the odds.
export const QUICK_DURATIONS = Object.freeze({ coin: 15500, cards: 17000, dice: 16350, rps: 15000, roulette: 20000 });
export const COIN_SIDES = Object.freeze({ heads: '表', tails: '裏' });
export const QUICK_METHODS = Object.freeze({
  coin: { label: 'コイン', icon: '🪙', rule: '選んだ面が出たら「やる」' },
  cards: { label: 'カード', icon: '🃏', rule: 'やる・やらないが1枚ずつ' },
  dice: { label: 'サイコロ', icon: '🎲', rule: '奇数＝やる／偶数＝やらない' },
  rps: { label: 'じゃんけん', icon: '✌️', rule: '自動の手で勝ち・負け50/50' },
  roulette: { label: 'ルーレット', icon: '🎡', rule: '1〜4＝やる／5〜8＝やらない' }
});
export function hasQuickPick(method, pick) {
  if (!Object.hasOwn(QUICK_METHODS, method)) return false;
  if (method === 'coin') return Object.hasOwn(COIN_SIDES, pick);
  if (method === 'cards') return pick === 'left' || pick === 'right';
  return true;
}
/** Sample once. Appearance, selected side and actual outcome stay separate. */
export function drawQuick(method, pick = null, source = globalThis.crypto) {
  if (!hasQuickPick(method, pick)) throw new Error(method === 'coin' ? '表か裏を選んでください。' : method === 'cards' ? '左か右のカードを選んでください。' : '決め方を確認してください。');
  if (method === 'coin') {
    const landed = drawDecision(source) === 'yes' ? 'heads' : 'tails';
    return Object.freeze({ result: pick === landed ? 'yes' : 'no', picked: pick, landed, detail: `選んだ面：${COIN_SIDES[pick]} ／ 出た面：${COIN_SIDES[landed]}` });
  }
  if (method === 'cards') {
    const chosenCard = pick === 'left' ? 0 : 1;
    const out = playGame('cards', { card: chosenCard }, source);
    return Object.freeze({ ...out, picked: pick, chosenCard, detail: `選んだカード：${pick === 'left' ? '左' : '右'} ／ ${out.result === 'yes' ? 'やってみる' : '今回はやらない'}` });
  }
  if (method === 'rps') {
    const order = ['rock', 'scissors', 'paper'];
    const player = randomInt(3, source), result = drawDecision(source);
    const hand = order[player], opponent = order[(player + (result === 'yes' ? 1 : 2)) % 3];
    return Object.freeze({ result, hand, opponent, detail: `あなた ${HANDS[hand]} ／ lucky ${HANDS[opponent]} · ${result === 'yes' ? '勝ち' : '負け'}` });
  }
  return Object.freeze(playGame(method, {}, source));
}
export function coinLandingAngle(side, turns = 8) {
  if (!Object.hasOwn(COIN_SIDES, side)) throw new RangeError('Invalid coin side');
  return turns * 360 + (side === 'tails' ? 180 : 0);
}
export function rouletteLandingAngle(slot, turns = 9) {
  if (!Number.isInteger(slot) || slot < 1 || slot > 8) throw new RangeError('Invalid slot');
  return turns * 360 - (slot - 0.5) * 45;
}
// Front=1, back=6, top=2, bottom=5, right=3, left=4.
export function diceLandingAngles(face) {
  const poses = { 1: [0,0], 2: [-90,0], 3: [0,-90], 4: [0,90], 5: [90,0], 6: [0,180] };
  if (!Object.hasOwn(poses, face)) throw new RangeError('Invalid die face');
  return poses[face].slice();
}

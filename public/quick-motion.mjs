import { createTimeline } from './vendor/anime.esm.min.js';
import { HANDS } from './games.mjs';
import { QUICK_DURATIONS, coinLandingAngle, rouletteLandingAngle, diceLandingAngles } from './quick-draw.mjs';

const n = (tag, cls, text) => { const el = document.createElement(tag); el.className = cls || ''; if (text !== undefined) el.textContent = text; return el; };
const PIPS = [[4],[0,8],[0,4,8],[0,2,6,8],[0,2,4,6,8],[0,2,3,5,6,8]];

/** One complete, cancellable performance. No RNG calls here. No CSS loop controls the result. */
export function startQuickMotion(stage, label, method, outcome, { reduced = false, onComplete = () => {} } = {}) {
  const total = QUICK_DURATIONS[method];
  if (!total) throw new RangeError('Unknown motion');
  let alive = true, phase = '';
  const visual = n('div', 'quick-animation-visual');
  stage.replaceChildren(visual); stage.hidden = false;
  stage.dataset.method = method; stage.dataset.durationMs = String(total); stage.dataset.phase = 'prepare';
  stage.classList.toggle('motion-gentle', reduced);
  const track = n('div', 'quick-time-track'), fill = n('i', 'quick-time-fill');
  track.append(fill); stage.append(track);
  const clock = { ms: 0 };
  const tl = createTimeline({ autoplay: false, onComplete: () => { if (!alive) return; stage.dataset.phase = 'done'; onComplete(); } });
  const at = p => Math.round(p * total);
  const call = (p, fn) => tl.call(() => { if (alive) fn(); }, at(p));
  const cue = (p, name, text) => call(p, () => { phase = name; stage.dataset.phase = name; label.textContent = text; });
  const add = (target, props, start, end) => tl.add(target, { ...props, duration: at(end) - at(start) }, at(start));
  // Master clock keeps the same 15–20 second duration in both accessibility modes.
  tl.add(clock, { ms: total, duration: total, ease: 'linear', onUpdate: () => { if (alive) fill.style.transform = `scaleX(${Math.min(1, clock.ms / total)})`; } }, 0);
  cue(0, 'prepare', method === 'rps' ? '最初はグー…' : 'いくよ…');
  cue(.10, 'shuffle', method === 'cards' ? 'カードをシャッフル中…' : method === 'coin' ? '表か、裏か…' : method === 'rps' ? 'じゃん…' : 'まだまだ…');
  cue(.62, 'suspense', method === 'cards' ? '選んだのは、この1枚。' : method === 'rps' ? 'けん…' : 'そろそろ…？');
  cue(.83, 'suspense', method === 'cards' ? 'もうすぐ、オープン…' : method === 'rps' ? '…' : '止まりそう…');
  cue(.94, 'reveal', method === 'cards' ? 'オープン！' : method === 'rps' ? 'ぽん！' : '決まった！');

  if (method === 'coin') {
    const wrap = n('div', 'quick-coin-wrap'), coin = n('div', 'quick-anim-coin');
    coin.append(n('span', 'coin-face coin-front', '表'), n('span', 'coin-face coin-back', '裏'));
    wrap.append(coin); visual.append(wrap);
    const target = coinLandingAngle(outcome.landed, reduced ? 0 : 8);
    if (reduced) {
      // No high-speed 3D spins for Reduce Motion, but preserve the full wait and final face.
      for (let i = 0; i < 9; i++) {
        const a = .06 + i * .085;
        add(coin, { y: -3, opacity: .80, ease: 'inOut(2)' }, a, a + .04);
        add(coin, { y: 0, opacity: 1, ease: 'inOut(2)' }, a + .04, a + .08);
      }
      add(coin, { rotateY: target, y: 0, ease: 'inOut(3)' }, .90, .96);
    } else {
      for (let i = 0; i < 6; i++) {
        const a = .04 + i * .105;
        add(coin, { rotateY: i * 360 + 160, y: -27 + i * 2, rotateZ: -7, ease: 'out(2)' }, a, a + .05);
        add(coin, { rotateY: (i + 1) * 360, y: 3, rotateZ: 6, ease: 'in(2)' }, a + .05, a + .10);
      }
      add(coin, { rotateY: 2530, y: -9, rotateZ: -3, ease: 'out(2)' }, .67, .82);
      add(coin, { rotateY: target, y: 0, rotateZ: 0, ease: 'out(4)' }, .82, .96);
    }
    call(.96, () => { coin.dataset.landed = outcome.landed; });
  }

  if (method === 'cards') {
    const wrap = n('div', 'quick-cards-wrap'), cards = [];
    for (let i = 0; i < 2; i++) {
      const card = n('div', `quick-anim-card${i === outcome.chosenCard ? ' chosen' : ''}`), inner = n('div', 'quick-card-inner');
      const back = n('div', 'quick-card-back');
      back.append(n('span', '', '✦'), n('small', '', i === 0 ? 'LEFT' : 'RIGHT'));
      const front = n('div', 'quick-card-front');
      inner.append(back, front); card.append(inner); wrap.append(card); cards.push({ card, inner, front });
    }
    visual.append(wrap);
    const chosen = cards[outcome.chosenCard], other = cards[1 - outcome.chosenCard];
    for (let i = 0; i < 7; i++) {
      const a = .035 + i * .085, amount = reduced ? 5 : 64;
      add(cards[0].card, { x: amount, y: reduced ? -2 : -8, rotateZ: reduced ? -3 : 11, ease: 'inOut(3)' }, a, a + .04);
      add(cards[1].card, { x: -amount, y: reduced ? 2 : 8, rotateZ: reduced ? 3 : -11, ease: 'inOut(3)' }, a, a + .04);
      add(cards[0].card, { x: 0, y: 0, rotateZ: -7, ease: 'inOut(3)' }, a + .04, a + .08);
      add(cards[1].card, { x: 0, y: 0, rotateZ: 7, ease: 'inOut(3)' }, a + .04, a + .08);
    }
    // The same card the user chose comes forward; it is never selected for them later.
    add(other.card, { opacity: .24, x: outcome.chosenCard === 0 ? 24 : -24, scale: .9, ease: 'out(3)' }, .64, .73);
    add(chosen.card, { x: outcome.chosenCard === 0 ? 48 : -48, y: reduced ? -2 : -8, rotateZ: 0, scale: reduced ? 1 : 1.08, ease: 'out(3)' }, .64, .75);
    for (let i = 0; i < 3; i++) {
      const a = .77 + i * .047;
      add(chosen.card, { y: reduced ? -3 : -11, ease: 'inOut(2)' }, a, a + .023);
      add(chosen.card, { y: reduced ? -2 : -8, ease: 'inOut(2)' }, a + .023, a + .046);
    }
    call(.935, () => {
      const yes = outcome.result === 'yes';
      chosen.front.classList.add(yes ? 'yes' : 'no');
      chosen.front.append(n('strong', '', yes ? '♥' : '♠'), n('small', '', yes ? 'やってみる' : '今回はやらない'));
      chosen.card.style.zIndex = '5';
    });
    add(chosen.inner, { rotateY: 180, ease: 'inOut(3)' }, .94, .977);
    call(.978, () => { chosen.card.dataset.revealed = outcome.result; });
  }

  if (method === 'dice') {
    const space = n('div', 'quick-dice-space'), die = n('div', 'quick-anim-die quick-dice-cube');
    for (let face = 1; face <= 6; face++) {
      const side = n('div', `quick-die-face face-${face}`); side.setAttribute('aria-hidden', 'true');
      for (let p = 0; p < 9; p++) side.append(n('i', PIPS[face-1].includes(p) ? 'pip on' : 'pip'));
      die.append(side);
    }
    space.append(die); visual.append(space);
    const [x,y] = diceLandingAngles(outcome.face);
    if (reduced) {
      for (let i = 0; i < 8; i++) {
        const a = .04 + i * .095;
        add(die, { rotateZ: i % 2 ? 3 : -3, y: -3, opacity: .8, ease: 'inOut(2)' }, a, a + .045);
        add(die, { rotateZ: 0, y: 0, opacity: 1, ease: 'inOut(2)' }, a + .045, a + .09);
      }
      add(die, { rotateX: x, rotateY: y, rotateZ: 0, ease: 'inOut(3)' }, .88, .96);
    } else {
      for (let i = 0; i < 6; i++) {
        const a = .035 + i * .106;
        add(die, { rotateX: i * 360 + 150, rotateY: i * 180 + 100, rotateZ: -15, y: -25 + i * 2, ease: 'out(2)' }, a, a + .051);
        add(die, { rotateX: (i+1) * 360, rotateY: (i+1) * 180, rotateZ: 9, y: 3, ease: 'in(2)' }, a + .051, a + .102);
      }
      add(die, { rotateX: 2520, rotateY: 1250, rotateZ: -6, y: -8, ease: 'out(2)' }, .68, .83);
      add(die, { rotateX: 2880+x, rotateY: 1440+y, rotateZ: 0, y: 0, ease: 'out(4)' }, .83, .96);
    }
    call(.96, () => { die.dataset.face = String(outcome.face); });
  }

  if (method === 'rps') {
    const wrap = n('div', 'quick-rps-wrap'), players = [];
    for (const name of ['あなた', 'lucky']) {
      const player = n('div', 'quick-rps-player'), hand = n('span', 'quick-rps-hand', '✊');
      player.append(n('small', '', name), hand); players.push({ player, hand });
    }
    wrap.append(players[0].player, n('b', 'quick-rps-vs', 'VS'), players[1].player); visual.append(wrap);
    const hands = players.map(p => p.hand);
    for (let i = 0; i < 6; i++) {
      const a = .04 + i * .126;
      add(hands, { y: reduced ? -3 : -17, rotateZ: reduced ? -1 : -7, ease: 'inOut(2)' }, a, a + .055);
      add(hands, { y: 0, rotateZ: 0, ease: 'inOut(2)' }, a + .055, a + .11);
    }
    call(.94, () => { players[0].hand.textContent = HANDS[outcome.hand]; players[1].hand.textContent = HANDS[outcome.opponent]; });
    add(hands, { scale: reduced ? 1.02 : 1.12, ease: 'out(3)' }, .94, .958);
    add(hands, { scale: 1, ease: 'out(3)' }, .958, .98);
  }

  if (method === 'roulette') {
    const wrap = n('div', 'quick-roulette-wrap'), wheel = n('div', 'quick-roulette-wheel'), pointer = n('span', 'quick-roulette-pointer', '▼');
    for (let i = 1; i <= 8; i++) {
      const number = n('span', 'quick-wheel-number', String(i));
      number.style.transform = `translate(-50%, -50%) rotate(${(i-.5)*45}deg) translateY(-50px) rotate(${-(i-.5)*45}deg)`;
      wheel.append(number);
    }
    wheel.append(n('span', 'quick-roulette-center', '✦')); wrap.append(pointer, wheel); visual.append(wrap);
    if (reduced) {
      // Gentle mode: emphasize segments instead of multiple full-screen spins.
      for (let i = 0; i < 14; i++) call(.04+i*.06, () => { [...wheel.querySelectorAll('.quick-wheel-number')].forEach((e,j) => e.classList.toggle('lit', j === i%8)); });
      add(wheel, { rotate: rouletteLandingAngle(outcome.slot, 1), ease: 'inOut(2)' }, .87, .96);
    } else {
      add(wheel, { rotate: 720, ease: 'in(2)' }, .025, .22);
      add(wheel, { rotate: 2160, ease: 'linear' }, .22, .60);
      add(wheel, { rotate: 2880, ease: 'out(2)' }, .60, .84);
      add(wheel, { rotate: rouletteLandingAngle(outcome.slot), ease: 'out(4)' }, .84, .96);
    }
    call(.96, () => { wheel.dataset.slot = String(outcome.slot); });
  }
  // All reveal animations end before this master clock. User cannot trigger an early result.
  tl.play();
  return { duration: total, cancel() { alive = false; tl.cancel(); }, get phase() { return phase; } };
}

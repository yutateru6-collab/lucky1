import { startQuickMotion } from './quick-motion.mjs';
import { QUICK_DURATIONS } from './quick-draw.mjs';

// The optional WebGL bundle must never prevent either set of buttons from working.
let modulePromise, loaded;
function loadModule() {
  if (!modulePromise) modulePromise = import('./reveal/cinematic.mjs?v=4.0.10')
    .then(m => (loaded = m)).catch(e => { modulePromise = null; throw e; });
  return modulePromise;
}
export function warmReveal(method = 'coin') {
  if (!['coin', 'cards'].includes(method)) return Promise.resolve();
  return loadModule().then(m => m.prepareReveal(method));
}
export function setRevealSound(enabled) { return loaded?.setRevealSound(enabled) ?? false; }
const make = (tag, cls, text) => { const e = document.createElement(tag); e.className = cls; if (text) e.textContent = text; return e; };
function bounded(promise, ms) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Artwork startup timed out')), ms); })]).finally(() => clearTimeout(timer));
}

/** Same entry point for Quick Choice AND the memo flow. Receives one immutable outcome. */
export function startDecisionMotion(stage, label, method, outcome, { reduced = false, onComplete = () => {} } = {}) {
  let alive = true, completed = false, engine = null, monitor = null, lastProgress = -1, lastTick = performance.now();
  const cinematic = ['coin', 'cards'].includes(method), total = QUICK_DURATIONS[method];
  const done = () => {
    if (!alive || completed) return;
    completed = true; clearInterval(monitor);
    // A flattened CSS-3D stack must never leave the opposite face on screen.
    // The fallback still performs the full toss; the settled face is a single layer.
    if (stage.dataset.renderer === 'fallback' && method === 'coin') {
      const face = make('div', 'quick-static-coin', outcome.landed === 'heads' ? '表' : '裏');
      face.dataset.landed = outcome.landed;
      stage.querySelector('.quick-coin-wrap')?.replaceChildren(face);
    }
    stage.dataset.phase = 'done'; stage.dataset.visibleResult = outcome.result;
    if (outcome.landed) stage.dataset.landed = outcome.landed;
    if (method === 'cards') stage.dataset.selectedCard = String(outcome.chosenCard);
    onComplete();
  };
  stage.classList.add('reveal-stage'); stage.hidden = false;
  stage.dataset.method = method; stage.dataset.renderer = 'loading'; stage.dataset.phase = 'loading';
  stage.dataset.durationMs = String(total); stage.dataset.elapsedMs = '0'; stage.removeAttribute('data-visible-result'); stage.removeAttribute('data-pose');
  const pending = make('div', 'reveal-loading');
  pending.append(make('span', 'reveal-loading-mark', method === 'cards' ? '✦' : method === 'coin' ? '表' : '✧'), make('p', '', '演出を準備しています…'));
  stage.replaceChildren(pending); label.textContent = '準備中です。まもなく始まります。';

  function fallback(reason) {
    if (!alive || stage.dataset.renderer === 'fallback') return;
    const elapsedMs = Math.min(total, Math.max(0, Number(stage.dataset.elapsedMs) || 0));
    clearInterval(monitor);
    try { engine?.cancel(); } catch { /* Already released context. */ }
    engine = null;
    stage.dataset.renderer = 'fallback'; stage.classList.add('reveal-fallback');
    stage.dataset.fallbackReason = reason instanceof Error ? reason.message : 'WebGL interrupted';
    engine = startQuickMotion(stage, label, method, outcome, { reduced, elapsedMs, onComplete: done });
    const notice = make('p', 'reveal-fallback-note', '3D表示を開始できないため、軽い演出で続けています。');
    notice.setAttribute('role', 'status'); stage.append(notice);
  }
  async function begin() {
    try {
      if (cinematic) {
        await bounded(warmReveal(method), 2200);
        if (!alive) return;
        stage.classList.remove('reveal-fallback');
        engine = loaded.startCinematicMotion(stage, label, method, outcome, { reduced, onComplete: done, onError: fallback });
        // A shader/driver failure can stop frames without rejecting a loading promise.
        monitor = setInterval(() => {
          if (!alive || completed || document.hidden || stage.dataset.renderer !== 'webgl') { lastTick = performance.now(); return; }
          const now = performance.now(), progress = Number(stage.dataset.elapsedMs) || 0;
          if (progress !== lastProgress) { lastProgress = progress; lastTick = now; }
          else if (now - lastTick > 3000) fallback(new Error('3D frames stopped'));
        }, 400);
      } else {
        if (!alive) return;
        stage.dataset.renderer = 'dom';
        engine = startQuickMotion(stage, label, method, outcome, { reduced, onComplete: done });
      }
    } catch (e) { if (alive) fallback(e); }
  }
  // Let the loading feedback paint before decoding textures or compiling shaders.
  const startup = requestAnimationFrame(() => { if (alive) void begin(); });
  return {
    duration: total,
    cancel() { if (!alive) return; alive = false; cancelAnimationFrame(startup); clearInterval(monitor); try { engine?.cancel(); } catch { /* no-op */ } engine = null; },
    get phase() { return stage.dataset.phase; }
  };
}

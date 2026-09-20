# Root Lucky 4.0.8 — manual picks and fivefold duration

Scope: root pastel app only; no changes to /gentle/, the approved home artwork, global palette, normal memo-first flow, or the private v2 journal schema.

Coin: select heads or tails yourself before starting. If the sampled face equals your pick, the suggestion is yes; otherwise no. The outcome face is sampled uniformly and independently of the pick. Cards: explicitly select left or right before starting; yes/no are randomly assigned one each. There is no default pick and no automated second choice.

Durations, measured from starting the draw to opening the result: coin 15,500 ms, cards 17,000 ms, dice 16,350 ms, RPS 15,000 ms, roulette 20,000 ms. These equal five times the nominal 4.0.7 normal durations. Reduce Motion reduces movement without shortening the requested waiting time. The old home subtitle claiming 10 seconds is removed.

A single Anime.js master timeline owns the full performance. Repeated shuffles/rolls, a pause before the final reveal and a progress track replace a static waiting screen. The selected card stays selected throughout. Coin face orientation, cube face orientation and wheel sector angle correspond to the actual outcome. Randomness happens in quick-draw.mjs, never in the animation renderer.

The user can always close the modal. Cancel/reopen invalidates old callbacks and clears the manual pick. Result text is not shown before the clock completes. Memo remains optional after the result; no result is saved automatically. Saving twice cannot create two records. Existing local records are not migrated or deleted.

Verification: npm run check and build; pure tests for manual picks, fairness, duration ratios, coin/cube/wheel orientation; existing UI/reference regression; real-clock browser runs from start to final result, matching the final visual to the outcome and checking 6-second and pre-reveal frames. Public Safari motion proof runs Chromium and WebKit with Reduce Motion ON/OFF. PRs test the checked-out PR code on localhost. Main runs hash checks against the actual root Cloudflare URL before testing it. Screenshots and continuous real-time videos are artifacts. Linux WebKit automation is not a physical iPhone Safari test.

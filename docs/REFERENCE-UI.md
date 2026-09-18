# lucky 4.0 — approved reference UI

## Implementation

The supplied pastel home-screen image is the visual reference. The logo, heart-holding cloud, five method illustrations and note illustrations are extracted into `public/art/lucky-reference.webp` (800 × 480 sprite). There are no remote artwork/font dependencies. The headline, CTA, method buttons, notes, quote, history and navigation are real HTML, not a screenshot overlaid with hotspots.

- White pastel home, pink hero, five illustrated cards on one row.
- Two-column dashboard at widths of 360px and above; one-column dashboard on narrower screens, with all five methods still visible.
- Home / Search / Choose / History / My page navigation. Words remain available from the daily-word card and profile.
- Search contains 12 local, editable decision templates. First-launch notes are explicitly examples, not fabricated user history. Empty activity is honest.
- A chosen result and the user's own choice remain separate. Existing storage keys and backup data are preserved. No new accounts, tracking, location access, payments or probability changes.
- Animated draw locks repeated taps and cancels pending visual transitions when the screen is left. Reduced-motion preference is respected.

## Maintenance

`visuals.mjs` defines sprite names and templates. `styles.css` contains the reference geometry and responsive/dark variants. The shared service-worker cache version must change whenever shipped assets change. Run `npm run check`, `npm run build`, `LUCKY_HTTP=1 python tests/ui_offline_test.py`, and `python tests/reference_visual.py`.

Screenshots must be browser renders of the actual application. A generated mockup is not evidence of implementation. GitHub Actions publishes screenshots and assertion reports as artifacts. `scripts/verify-live.mjs` separately compares all relevant production file hashes; a repository commit or a successful local test alone does not establish deployment.

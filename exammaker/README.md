# ExamMaker Rebuilt

Reconstructed version of the 2025 ExamMaker app, isolated under `exammaker/` so it does not affect the Lucky app in the repository root.

## What it does

- Enter a theme
- Choose one of eight writing styles
- Generate a six-paragraph Japanese critical essay
- Convert it to an English reading-comprehension set
- Show 12 questions and Japanese explanations
- Works without an API key in reconstruction mode
- Optionally uses a user-provided Gemini API key in the browser; the key is not stored by the app

## Cloudflare

The app is deployed as a Cloudflare Worker with static assets.

- Worker name: `exammaker-rebuilt`
- Config: `wrangler.jsonc`
- Entry: `src/index.js`
- Static UI: `public/index.html`

The GitHub Actions workflow first tries a permanent deployment if a `CLOUDFLARE_API_TOKEN` secret is available. If not, it falls back to Cloudflare's temporary deployment mode so the app can still be opened without touching the existing Lucky deployment.

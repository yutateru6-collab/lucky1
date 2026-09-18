import { cp, mkdir, rm, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
for (const file of ['public/index.html', 'public/app.mjs', 'public/decision.mjs', 'public/styles.css', 'public/visuals.mjs', 'public/art/lucky-reference.webp', 'public/icons/icon-192.png', 'public/icons/icon-512.png', 'public/sw.js']) await access(new URL(file, root));
const dist = new URL('dist/', root);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(new URL('public/', root), dist, { recursive: true });
console.log(`Build complete: ${fileURLToPath(dist)}`);

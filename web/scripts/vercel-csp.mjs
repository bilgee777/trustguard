// Keeps the Content-Security-Policy in vercel.json in step with the built app.
//
// The CSP allows exactly one inline script (the theme bootstrap in index.html) by its SHA-256 hash. Vercel headers
// are static, so unlike the nginx image (which fills the hash in at build time) the hash lives in the file.
// If index.html's inline script changes, the hash changes, the page's theme script gets blocked, and this check fails.
//
//   node scripts/vercel-csp.mjs          verify (used in CI, after `npm run build`)
//   node scripts/vercel-csp.mjs --write  update vercel.json
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const configPath = new URL('../../vercel.json', import.meta.url);
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const script = /<script>([\s\S]*?)<\/script>/.exec(html);
if (!script) {
  console.error('No inline <script> found in dist/index.html. Run `npm run build` first.');
  process.exit(1);
}
const expected = `'sha256-${createHash('sha256').update(script[1]).digest('base64')}'`;

const text = readFileSync(configPath, 'utf8');
const found = /script-src 'self' ('sha256-[A-Za-z0-9+/=]+')/.exec(text);
if (!found) {
  console.error("vercel.json has no `script-src 'self' 'sha256-...'` policy.");
  process.exit(1);
}

if (found[1] === expected) {
  console.log('vercel.json CSP hash is current.');
} else if (process.argv.includes('--write')) {
  writeFileSync(configPath, text.replace(found[1], expected));
  console.log(`Updated vercel.json: ${expected}`);
} else {
  console.error(`vercel.json CSP hash is stale.\n  file:     ${found[1]}\n  built:    ${expected}`);
  console.error('Run `npm run vercel:csp -- --write` in web/ and commit vercel.json.');
  process.exit(1);
}

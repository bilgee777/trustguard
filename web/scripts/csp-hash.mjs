// Prints the CSP source expression ('sha256-...') for the inline script in a built index.html,
// so the Content-Security-Policy can allow exactly that script and nothing else.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/csp-hash.mjs <path/to/index.html>');
  process.exit(1);
}
const html = readFileSync(file, 'utf8');
const match = /<script>([\s\S]*?)<\/script>/.exec(html);
if (!match) {
  console.error('No inline <script> found');
  process.exit(1);
}
process.stdout.write(`sha256-${createHash('sha256').update(match[1]).digest('base64')}`);

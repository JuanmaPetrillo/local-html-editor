import { readFileSync } from 'node:fs';
const app = readFileSync('apps/desktop/src/app-shell.mjs', 'utf8');
if (!app.includes('safePreviewPlaceholder')) throw new Error('missing safe preview placeholder');
console.log('lint checks passed');

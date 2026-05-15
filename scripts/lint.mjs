import { readFileSync } from 'node:fs';
const app = readFileSync('apps/desktop/src/app-shell.mjs', 'utf8');
if (!app.includes('safePreviewPlaceholder')) throw new Error('missing safe preview placeholder');
const v2 = readFileSync('apps/desktop-v2/src/app-v2.mjs', 'utf8');
if (!v2.includes('stripUnsafeHtml')) throw new Error('v2: missing stripUnsafeHtml');
if (!v2.includes('blockRemoteAttributes')) throw new Error('v2: missing blockRemoteAttributes');
const v2Html = readFileSync('apps/desktop-v2/index.html', 'utf8');
if (!v2Html.includes('sandbox=')) throw new Error('v2: missing sandbox attribute in index.html');
console.log('lint checks passed');

import { readFileSync } from 'node:fs';
const source = readFileSync('apps/desktop/src/app-shell.mjs', 'utf8');
if (!source.includes('@typedef')) throw new Error('typed contract missing');
const v2 = readFileSync('apps/desktop-v2/src/app-v2.mjs', 'utf8');
for (const fn of ['mapHtmlToModel', 'exportModelToHtml', 'createProjectPayload', 'restoreProjectPayload', 'stripUnsafeHtml', 'createLivePreviewHtml']) {
  if (!v2.includes(`export function ${fn}`)) throw new Error(`v2: missing export function ${fn}`);
}
console.log('typecheck placeholder passed (JSDoc contract presence check only)');

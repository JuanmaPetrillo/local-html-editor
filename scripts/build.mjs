import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

mkdirSync('dist', { recursive: true });
const appJs = readFileSync('apps/desktop-v2/src/app-v2.mjs', 'utf8').replaceAll('export ', '');
cpSync('apps/desktop-v2/index.html', 'dist/index.html');
writeFileSync('dist/app-v2.bundle.js', appJs, 'utf8');
const html = readFileSync('dist/index.html', 'utf8');
if (!html.includes('app-v2.bundle.js')) throw new Error('missing v2 bundle reference');
if (html.includes('type="module"')) throw new Error('module script not allowed in pilot package');
console.log('build completed: dist/index.html + dist/app-v2.bundle.js');

import { cpSync, mkdirSync, readFileSync } from 'node:fs';

mkdirSync('dist/src', { recursive: true });
cpSync('apps/desktop/index.html', 'dist/index.html');
cpSync('apps/desktop/src/app-shell.mjs', 'dist/src/app-shell.mjs');

const distHtml = readFileSync('dist/index.html', 'utf8');
const distShell = readFileSync('dist/src/app-shell.mjs', 'utf8');

if (!distHtml.includes('src="./src/app-shell.mjs"')) {
  throw new Error('build output missing app-shell module reference');
}
if (distHtml.includes('<script src="http') || distHtml.includes('https://')) {
  throw new Error('remote runtime dependency detected in dist/index.html');
}
if (distShell.length === 0) {
  throw new Error('dist/src/app-shell.mjs is empty');
}

console.log('build completed: dist/index.html, dist/src/app-shell.mjs');

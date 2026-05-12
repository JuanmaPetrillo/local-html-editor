import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('dist', { recursive: true });
cpSync('apps/desktop/src/index.html', 'dist/index.html');
console.log('build completed: dist/index.html');

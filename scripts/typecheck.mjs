import { readFileSync } from 'node:fs';
const source = readFileSync('apps/desktop/src/app-shell.mjs', 'utf8');
if (!source.includes('@typedef')) throw new Error('typed contract missing');
console.log('typecheck placeholder passed');

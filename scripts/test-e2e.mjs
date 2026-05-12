import { readFileSync } from 'node:fs';
const html = readFileSync('apps/desktop/index.html', 'utf8');
if (!html.includes('Open HTML/ZIP')) throw new Error('shell ui missing open control');
console.log('e2e smoke placeholder passed');

import { readFileSync } from 'node:fs';
const html = readFileSync('apps/desktop/index.html', 'utf8');
if (html.includes('<script src="http')) throw new Error('remote runtime dependency detected');
if (!html.includes('Scripts are disabled')) throw new Error('safe preview notice missing');
console.log('security checks passed');

import { readFileSync } from 'node:fs';

const html = readFileSync('apps/desktop/index.html', 'utf8');
const shellCode = readFileSync('apps/desktop/src/app-shell.mjs', 'utf8');

if (html.includes('<script src="http')) throw new Error('remote runtime dependency detected');
if (html.includes('https://')) throw new Error('remote https runtime dependency detected');
if (!html.includes('Scripts are disabled')) throw new Error('safe preview notice missing');
if (shellCode.includes('innerHTML')) throw new Error('imported content may be rendered via innerHTML');
if (shellCode.includes('DOMParser')) throw new Error('imported content parsing is not allowed in milestone 1 follow-up');
if (shellCode.includes('.text()')) throw new Error('imported file contents must not be read');
if (shellCode.includes('.arrayBuffer()')) throw new Error('imported file contents must not be read');

console.log('security checks passed');

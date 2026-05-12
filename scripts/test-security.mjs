import { readFileSync } from 'node:fs';

const html = readFileSync('apps/desktop/index.html', 'utf8');
const shellCode = readFileSync('apps/desktop/src/app-shell.mjs', 'utf8');

if (html.includes('<script src="http')) throw new Error('remote runtime dependency detected');
if (html.includes('https://')) throw new Error('remote https runtime dependency detected');
if (!html.includes('Scripts are disabled')) throw new Error('safe preview notice missing');
if (shellCode.includes('innerHTML')) throw new Error('imported content may be rendered via innerHTML');
if (shellCode.includes('outerHTML')) throw new Error('imported content may be rendered via outerHTML');
if (shellCode.includes('insertAdjacentHTML')) throw new Error('imported content may be rendered via insertAdjacentHTML');
if (shellCode.includes('document.write')) throw new Error('imported content may be rendered via document.write');
if (shellCode.includes('DOMParser')) throw new Error('imported content parsing is not allowed in milestone 3A');
if (shellCode.includes('fetch(')) throw new Error('remote fetch must not be introduced');
if (shellCode.includes('XMLHttpRequest')) throw new Error('xhr must not be introduced in shell');
if (shellCode.includes('WebSocket')) throw new Error('websocket must not be introduced in shell');
const importerCode = readFileSync('apps/desktop/src/importer.mjs', 'utf8');

if (shellCode.includes('.arrayBuffer()')) throw new Error('imported file contents must not be read in shell');
if (shellCode.includes('.text()')) throw new Error('file text reads must stay in importer module only');
if (!importerCode.includes('.text()')) throw new Error('importer must read html text locally for scan');
if (!importerCode.includes('.arrayBuffer()')) throw new Error('importer must perform zip binary preflight reads locally');
if (importerCode.includes('innerHTML')) throw new Error('importer must not render imported content');
if (importerCode.includes('DOMParser')) throw new Error('importer must not parse/render imported DOM in milestone 2A');
if (!html.includes('id="safe-preview-frame"')) throw new Error('safe preview iframe missing');
if (!html.includes('sandbox=""')) throw new Error('safe preview iframe sandbox must be empty');
if (html.includes('allow-scripts')) throw new Error('safe preview iframe must not allow scripts');
if (html.includes('allow-same-origin')) throw new Error('safe preview iframe must not allow same-origin');
if (html.includes('allow-top-navigation')) throw new Error('safe preview iframe must not allow top navigation');
if (html.includes('allow-downloads')) throw new Error('safe preview iframe must not allow downloads');
if (html.includes('allow-popups')) throw new Error('safe preview iframe must not allow popups');
if (html.includes('allow-forms')) throw new Error('safe preview iframe must not allow forms');

console.log('security checks passed');

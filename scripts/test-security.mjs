import { readFileSync } from 'node:fs';
import { buildSafePreviewDocument } from '../apps/desktop/src/preview-sandbox.mjs';

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
if (shellCode.includes('contentDocument')) throw new Error('iframe.contentDocument access must not be introduced in shell');
if (shellCode.includes('contentWindow')) throw new Error('iframe.contentWindow access must not be introduced in shell');
if (shellCode.includes('postMessage')) throw new Error('postMessage must not be introduced in shell');
if (shellCode.includes('fetch(')) throw new Error('fetch must not be introduced in trusted shell');
if (shellCode.includes('XMLHttpRequest')) throw new Error('XMLHttpRequest must not be introduced in trusted shell');
if (shellCode.includes('WebSocket')) throw new Error('WebSocket must not be introduced in trusted shell');
if (shellCode.includes('contentWindow')) throw new Error('iframe.contentWindow access must not be introduced in shell');
if (shellCode.includes('postMessage')) throw new Error('postMessage must not be introduced in shell');
const importerCode = readFileSync('apps/desktop/src/importer.mjs', 'utf8');
const editableModelCode = readFileSync('apps/desktop/src/editable-model.mjs', 'utf8');

if (shellCode.includes('.arrayBuffer()')) throw new Error('imported file contents must not be read in shell');
if (shellCode.includes('.text()')) throw new Error('file text reads must stay in importer module only');
if (!importerCode.includes('.text()')) throw new Error('importer must read html text locally for scan');
if (!importerCode.includes('.arrayBuffer()')) throw new Error('importer must perform zip binary preflight reads locally');
if (importerCode.includes('innerHTML')) throw new Error('importer must not render imported content');
if (importerCode.includes('DOMParser')) throw new Error('importer must not parse/render imported DOM in milestone 2A');
if (editableModelCode.includes('DOMParser')) throw new Error('editable model must not use DOMParser');
if (!html.includes('id="safe-preview-frame"')) throw new Error('safe preview iframe missing');
if (!html.includes('sandbox=""')) throw new Error('safe preview iframe sandbox must be empty');
if (html.includes('allow-scripts')) throw new Error('safe preview iframe must not allow scripts');
if (html.includes('allow-same-origin')) throw new Error('safe preview iframe must not allow same-origin');
if (html.includes('allow-top-navigation')) throw new Error('safe preview iframe must not allow top navigation');
if (html.includes('allow-downloads')) throw new Error('safe preview iframe must not allow downloads');
if (html.includes('allow-popups')) throw new Error('safe preview iframe must not allow popups');
if (html.includes('allow-forms')) throw new Error('safe preview iframe must not allow forms');

const hardenedPreviewDoc = buildSafePreviewDocument(
  '<a href="mailto:test@example.com">x</a><a href="ftp://example.test/file">x</a><a href="file:///tmp/x">x</a><a href="tel:+1">x</a><a href="vbscript:msgbox(1)">x</a><a href="custom:value">x</a><a href="https://example.test">x</a><a href="//example.test">x</a><img src="data:image/png;base64,aa">'
);
if (hardenedPreviewDoc.includes('mailto:')) throw new Error('mailto scheme must be neutralized in safe preview');
if (hardenedPreviewDoc.includes('ftp://')) throw new Error('ftp scheme must be neutralized in safe preview');
if (hardenedPreviewDoc.includes('file:///')) throw new Error('file scheme must be neutralized in safe preview');
if (hardenedPreviewDoc.includes('tel:+')) throw new Error('tel scheme must be neutralized in safe preview');
if (hardenedPreviewDoc.toLowerCase().includes('vbscript:')) throw new Error('vbscript scheme must be neutralized in safe preview');
if (hardenedPreviewDoc.includes('custom:')) throw new Error('unknown scheme must be neutralized in safe preview');
if (hardenedPreviewDoc.includes('https://example.test')) throw new Error('https remote references must be neutralized in safe preview');
if (hardenedPreviewDoc.includes('//example.test')) throw new Error('protocol-relative references must be neutralized in safe preview');

console.log('security checks passed');

import { readFileSync } from 'node:fs';
import { buildSafePreviewDocument } from '../apps/desktop/src/preview-sandbox.mjs';

const html = readFileSync('apps/desktop/index.html', 'utf8');
const shellCode = readFileSync('apps/desktop/src/app-shell.mjs', 'utf8');
const importerCode = readFileSync('apps/desktop/src/importer.mjs', 'utf8');
const editableModelCode = readFileSync('apps/desktop/src/editable-model.mjs', 'utf8');
const exporterCode = readFileSync('apps/desktop/src/exporter.mjs', 'utf8');
const visualObjectModelCode = readFileSync('apps/desktop/src/visual-object-model.mjs', 'utf8');
const visualLayoutModelCode = readFileSync('apps/desktop/src/visual-layout-model.mjs', 'utf8');
const imageReplacementModelCode = readFileSync('apps/desktop/src/image-replacement-model.mjs', 'utf8');

function assertForbidden(sourceText, tokens, category) {
  for (const token of tokens) {
    if (sourceText.includes(token)) throw new Error(`[${category}] forbidden token detected: ${token}`);
  }
}

function assertRequired(sourceText, tokens, category) {
  for (const token of tokens) {
    if (!sourceText.includes(token)) throw new Error(`[${category}] required token missing: ${token}`);
  }
}

// trusted shell forbidden APIs
assertForbidden(shellCode, ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'DOMParser'], 'trusted-shell');
assertForbidden(shellCode, ['contentDocument', 'contentWindow', 'postMessage'], 'trusted-shell');
assertForbidden(shellCode, ['fetch(', 'XMLHttpRequest', 'WebSocket'], 'trusted-shell-network');

// file-read boundary
assertForbidden(shellCode, ['.text()', '.arrayBuffer()'], 'trusted-shell-file-read');
assertRequired(importerCode, ['.text()', '.arrayBuffer()'], 'importer-file-read-owner');
assertForbidden(exporterCode, ['.text()', '.arrayBuffer()'], 'exporter-file-read');

// iframe sandbox invariants
assertRequired(html, ['id="safe-preview-frame"', 'sandbox=""'], 'iframe-sandbox');
assertForbidden(html, ['allow-scripts', 'allow-same-origin', 'allow-top-navigation', 'allow-downloads', 'allow-popups', 'allow-forms'], 'iframe-sandbox');

// preview/export module forbidden APIs
assertForbidden(importerCode, ['innerHTML', 'DOMParser'], 'importer-rendering');
assertForbidden(editableModelCode, ['DOMParser'], 'editable-model');
assertForbidden(exporterCode, ['DOMParser', 'fetch(', 'XMLHttpRequest', 'WebSocket'], 'exporter');
assertForbidden(visualObjectModelCode, ['DOMParser', '.text()', '.arrayBuffer()', 'fetch(', 'XMLHttpRequest', 'WebSocket'], 'visual-object-model');
assertForbidden(visualLayoutModelCode, ['DOMParser', '.text()', '.arrayBuffer()', 'fetch(', 'XMLHttpRequest', 'WebSocket'], 'visual-layout-model');
assertForbidden(imageReplacementModelCode, ['DOMParser', '.text()', '.arrayBuffer()', 'fetch(', 'XMLHttpRequest', 'WebSocket'], 'image-replacement-model');

// network/telemetry forbidden APIs
assertForbidden(html, ['<script src="http', 'https://'], 'runtime-remote-deps');
assertForbidden(shellCode + importerCode + exporterCode, ['sendBeacon', 'telemetry', 'analytics', 'crashlytics'], 'telemetry');
assertRequired(html, ['Scripts are disabled'], 'safe-preview-copy');

const hardenedPreviewDoc = buildSafePreviewDocument(
  '<a href="mailto:test@example.com">x</a><a href="ftp://example.test/file">x</a><a href="file:///tmp/x">x</a><a href="tel:+1">x</a><a href="vbscript:msgbox(1)">x</a><a href="custom:value">x</a><a href="https://example.test">x</a><a href="//example.test">x</a><img src="data:image/png;base64,aa">'
);
assertForbidden(hardenedPreviewDoc, ['mailto:', 'ftp://', 'file:///', 'tel:+', 'custom:', 'https://example.test', '//example.test'], 'preview-scheme-hardening');
if (hardenedPreviewDoc.toLowerCase().includes('vbscript:')) throw new Error('[preview-scheme-hardening] forbidden token detected: vbscript:');

console.log('security checks passed');

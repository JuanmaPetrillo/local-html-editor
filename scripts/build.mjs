import { cpSync, mkdirSync, readFileSync } from 'node:fs';

mkdirSync('dist/src', { recursive: true });
cpSync('apps/desktop/index.html', 'dist/index.html');
cpSync('apps/desktop/src/app-shell.mjs', 'dist/src/app-shell.mjs');
cpSync('apps/desktop/src/importer.mjs', 'dist/src/importer.mjs');
cpSync('apps/desktop/src/preview-sandbox.mjs', 'dist/src/preview-sandbox.mjs');
cpSync('apps/desktop/src/editable-model.mjs', 'dist/src/editable-model.mjs');
cpSync('apps/desktop/src/exporter.mjs', 'dist/src/exporter.mjs');
cpSync('apps/desktop/src/visual-object-model.mjs', 'dist/src/visual-object-model.mjs');
cpSync('apps/desktop/src/visual-layout-model.mjs', 'dist/src/visual-layout-model.mjs');

const distHtml = readFileSync('dist/index.html', 'utf8');
const distShell = readFileSync('dist/src/app-shell.mjs', 'utf8');
const distImporter = readFileSync('dist/src/importer.mjs', 'utf8');
const distPreviewSandbox = readFileSync('dist/src/preview-sandbox.mjs', 'utf8');
const distEditableModel = readFileSync('dist/src/editable-model.mjs', 'utf8');
const distExporter = readFileSync('dist/src/exporter.mjs', 'utf8');
const distVisualObjectModel = readFileSync('dist/src/visual-object-model.mjs', 'utf8');
const distVisualLayoutModel = readFileSync('dist/src/visual-layout-model.mjs', 'utf8');

if (!distHtml.includes('src="./src/app-shell.mjs"')) {
  throw new Error('build output missing app-shell module reference');
}
if (!distShell.includes("from './importer.mjs'")) {
  throw new Error('build output missing importer module reference in app-shell');
}
if (!distShell.includes("from './exporter.mjs'") || !distShell.includes("from './visual-object-model.mjs'")) {
  throw new Error('build output missing exporter module reference in app-shell');
}
if (!distImporter.includes("from './preview-sandbox.mjs'") || !distImporter.includes("from './editable-model.mjs'")) {
  throw new Error('build output missing preview sandbox module reference in importer');
}
if (distHtml.includes('<script src="http') || distHtml.includes('https://')) {
  throw new Error('remote runtime dependency detected in dist/index.html');
}
if (distShell.length === 0) {
  throw new Error('dist/src/app-shell.mjs is empty');
}
if (distImporter.length === 0) {
  throw new Error('dist/src/importer.mjs is empty');
}
if (distPreviewSandbox.length === 0) {
  throw new Error('dist/src/preview-sandbox.mjs is empty');
}
if (distEditableModel.length === 0) {
  throw new Error('dist/src/editable-model.mjs is empty');
}
if (distExporter.length === 0) {
  throw new Error('dist/src/exporter.mjs is empty');
}
if (distVisualObjectModel.length === 0) {
  throw new Error('dist/src/visual-object-model.mjs is empty');
}
if (distVisualLayoutModel.length === 0) {
  throw new Error('dist/src/visual-layout-model.mjs is empty');
}

console.log(
  'build completed: dist/index.html, dist/src/app-shell.mjs, dist/src/importer.mjs, dist/src/preview-sandbox.mjs, dist/src/editable-model.mjs, dist/src/exporter.mjs, dist/src/visual-object-model.mjs, dist/src/visual-layout-model.mjs'
);

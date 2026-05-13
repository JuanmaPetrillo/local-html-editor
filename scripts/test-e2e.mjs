import { readFileSync } from 'node:fs';

const html = readFileSync('apps/desktop/index.html', 'utf8');

if (!html.includes('<input id="file-input"')) throw new Error('shell ui missing local file picker');
if (!html.includes('accept=".html,.htm,.zip"')) throw new Error('shell file picker missing accept hint');
if (!html.includes('Open HTML/ZIP')) throw new Error('shell ui missing open control');
if (!html.includes('Save</button>')) throw new Error('shell ui missing save placeholder');
if (!html.includes('id="export-edited-html"')) throw new Error('shell ui missing edited HTML export button');
if (!html.includes('id="file-status"')) throw new Error('shell ui missing selected-file status region');
if (!html.includes('id="file-details"')) throw new Error('shell ui missing selected-file metadata region');
if (!html.includes('id="file-scan"')) throw new Error('shell ui missing scan summary region');
if (!html.includes('id="import-report"')) throw new Error('shell ui missing import report region');
if (!html.includes('id="import-manifest"')) throw new Error('shell ui missing import manifest region');
if (!html.includes('id="visual-object-inventory"')) throw new Error('shell ui missing visual object inventory region');
if (!html.includes('id="visual-object-select"')) throw new Error('shell ui missing visual object selector');
if (!html.includes('id="visual-object-selection-status"')) throw new Error('shell ui missing visual object selection status region');
if (!html.includes('id="visual-overlay-layer"')) throw new Error('shell ui missing visual overlay layer');
if (!html.includes('id="visual-overlay-status"')) throw new Error('shell ui missing visual overlay status region');
if (!html.includes('.visual-overlay-box')) throw new Error('shell ui missing visual overlay box css class');
if (!html.includes('position: absolute')) throw new Error('shell ui missing absolute positioning style for overlay rendering');
if (!html.includes('id="editable-inventory"')) throw new Error('shell ui missing editable inventory region');
if (!html.includes('id="editable-draft-status"')) throw new Error('shell ui missing editable draft status region');
if (!html.includes('id="editable-patch-plan"')) throw new Error('shell ui missing editable patch plan region');
if (!html.includes('id="apply-patch-preview"')) throw new Error('shell ui missing apply patch preview button');
if (!html.includes('id="patch-apply-status"')) throw new Error('shell ui missing patch apply status region');
if (!html.includes('id="reset-working-preview"')) throw new Error('shell ui missing reset working preview button');
if (!html.includes('id="patch-collection-status"')) throw new Error('shell ui missing patch collection status region');
if (!html.includes('id="working-preview-status"')) throw new Error('shell ui missing working preview status region');
if (!html.includes('id="export-status"')) throw new Error('shell ui missing export status region');
if (!html.includes('id="editable-draft-text"')) throw new Error('shell ui missing editable draft textarea');
if (!html.includes('id="editable-candidate-select"')) throw new Error('shell ui missing editable candidate selector');
if (!html.includes('id="safe-preview-frame"')) throw new Error('shell ui missing safe preview iframe region');
if (!html.includes('id="safe-preview-status"')) throw new Error('shell ui missing safe preview status region');
if (!html.includes('Session Scope')) throw new Error('shell ui missing session scope section');
if (html.includes('Recent Projects')) throw new Error('shell ui still references recent projects despite no persistence');
if (!html.includes('id="preview-fit-width"')) throw new Error('shell ui missing preview fit width control');
if (!html.includes('id="preview-compact-height"')) throw new Error('shell ui missing preview compact control');
if (!html.includes('id="preview-tall-height"')) throw new Error('shell ui missing preview tall control');
if (!html.includes('id="preview-reset-layout"')) throw new Error('shell ui missing preview reset control');

const step2Index = html.indexOf('2) Review safe preview');
const step3Index = html.indexOf('3) Select editable text candidate');
if (step2Index === -1 || step3Index === -1 || step2Index > step3Index) throw new Error('shell ui step order mismatch: safe preview must be before text candidate workflow');

if (!html.includes('preview-frame--compact')) throw new Error('shell ui missing preview compact class');
if (!html.includes('preview-frame--fit')) throw new Error('shell ui missing preview fit class');
if (!html.includes('preview-frame--tall')) throw new Error('shell ui missing preview tall class');
if (!html.includes('src="./src/app-shell.mjs"')) throw new Error('shell ui not using canonical app-shell path');

console.log('e2e smoke placeholder passed');

import { readFileSync } from 'node:fs';

const html = readFileSync('apps/desktop/index.html', 'utf8');
const shellCode = readFileSync('apps/desktop/src/app-shell.mjs', 'utf8');

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

if (!html.includes('id="advanced-details"')) throw new Error('shell ui missing advanced details container');
if (html.includes('<details id="advanced-details" open')) throw new Error('advanced details should be collapsed by default');
if (!html.includes('id="visual-object-inventory"')) throw new Error('shell ui missing visual object inventory region');
if (!html.includes('id="visual-object-select"')) throw new Error('shell ui missing visual object selector');
if (!html.includes('id="visual-object-selection-status"')) throw new Error('shell ui missing visual object selection status region');
if (!html.includes('id="visual-text-edit-bridge-status"')) throw new Error('shell ui missing visual text edit bridge status region');
if (!html.includes('id="selected-text-edit-panel"')) throw new Error('shell ui missing selected text edit panel');
if (!html.includes('id="selected-text-edit-status"')) throw new Error('shell ui missing selected text edit status');
if (!html.includes('id="visual-overlay-layer"')) throw new Error('shell ui missing visual overlay layer');
if (!html.includes('id="visual-overlay-status"')) throw new Error('shell ui missing visual overlay status region');
if (!html.includes('id="image-replacement-panel"')) throw new Error('shell ui missing image replacement panel');
if (!html.includes('id="replacement-image-input"')) throw new Error('shell ui missing replacement image input');
if (!html.includes('id="image-replacement-status"')) throw new Error('shell ui missing image replacement status');
if (!html.includes('accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/avif"')) throw new Error('shell ui missing safe raster accept list');
if (!html.includes('Replace selected image')) throw new Error('shell ui missing image replacement copy');
if (!html.includes('Choose a local image file.')) throw new Error('shell ui missing image replacement chooser copy');
if (!html.includes('SVG and remote images are not supported.')) throw new Error('shell ui missing image replacement safety copy');
if (!shellCode.includes('replacementImageInput.disabled = false')) throw new Error('shell logic missing image replacement input enable path');
if (!shellCode.includes('const previousImagePatchCollection = imagePatchCollection')) throw new Error('shell logic missing image patch rollback baseline');
if (!shellCode.includes('imagePatchCollection = previousImagePatchCollection')) throw new Error('shell logic missing image patch rollback assignment');

if (!html.includes('id="visual-move-panel"')) throw new Error('shell ui missing visual move panel');
if (!html.includes('id="move-selected-up"')) throw new Error('shell ui missing move up button');
if (!html.includes('id="move-selected-down"')) throw new Error('shell ui missing move down button');
if (!html.includes('id="move-selected-left"')) throw new Error('shell ui missing move left button');
if (!html.includes('id="move-selected-right"')) throw new Error('shell ui missing move right button');
if (!html.includes('id="visual-move-status"')) throw new Error('shell ui missing visual move status');
if (!html.includes('Drag an overlay box or use nudge buttons.')) throw new Error('shell ui missing drag guidance copy');
if (!html.includes('Movement blocked: this object cannot be moved safely.')) throw new Error('shell ui missing blocked movement copy');
if (!html.includes('Resize selected object')) throw new Error('shell ui missing resize panel title');
if (!html.includes('Drag a corner handle to resize.')) throw new Error('shell ui missing resize guidance copy');
if (!html.includes('id="visual-resize-status"')) throw new Error('shell ui missing resize status');
if (!html.includes('.visual-resize-handle')) throw new Error('shell ui missing visual resize handle class');
if (shellCode.includes("const handleButton = document.createElement('button');")) throw new Error('resize handles must not be created as button elements');
if (!shellCode.includes("setResizeStatusText('Resize blocked: this object cannot be resized safely.');")) throw new Error('resize status reset text missing');
if (!html.includes('.visual-overlay-box')) throw new Error('shell ui missing visual overlay box css class');
if (!html.includes('position: absolute')) throw new Error('shell ui missing absolute positioning style for overlay rendering');
if (!html.includes('id="editable-inventory"')) throw new Error('shell ui missing editable inventory region');
if (!html.includes('id="editable-draft-status"')) throw new Error('shell ui missing editable draft status region');
if (!html.includes('id="editable-patch-plan"')) throw new Error('shell ui missing editable patch plan region');
if (!html.includes('id="apply-patch-preview"')) throw new Error('shell ui missing apply patch preview button');
if (!html.includes('Apply text edit to preview')) throw new Error('shell ui missing updated apply text edit label');
if (!html.includes('id="patch-apply-status"')) throw new Error('shell ui missing patch apply status region');
if (!html.includes('id="reset-working-preview"')) throw new Error('shell ui missing reset working preview button');
if (!html.includes('id="patch-collection-status"')) throw new Error('shell ui missing patch collection status region');
if (!html.includes('id="working-preview-status"')) throw new Error('shell ui missing working preview status region');
if (!html.includes('id="export-status"')) throw new Error('shell ui missing export status region');
if (!html.includes('id="editable-draft-text"')) throw new Error('shell ui missing editable draft textarea');
if (!html.includes('id="editable-candidate-select"')) throw new Error('shell ui missing editable candidate selector');
if (!html.includes('Advanced text candidate selector')) throw new Error('shell ui missing advanced text candidate selector label');
if (!html.includes('id="safe-preview-frame"')) throw new Error('shell ui missing safe preview iframe region');
if (!html.includes('id="safe-preview-status"')) throw new Error('shell ui missing safe preview status region');
if (!html.includes('Session Scope')) throw new Error('shell ui missing session scope section');
if (html.includes('Recent Projects')) throw new Error('shell ui still references recent projects despite no persistence');
if (!html.includes('id="preview-fit-width"')) throw new Error('shell ui missing preview fit width control');
if (!html.includes('id="preview-compact-height"')) throw new Error('shell ui missing preview compact control');
if (!html.includes('id="preview-tall-height"')) throw new Error('shell ui missing preview tall control');
if (!html.includes('id="preview-reset-layout"')) throw new Error('shell ui missing preview reset control');


const exportSectionIndex = html.indexOf('5) Export edited copy');
const exportButtonIndex = html.indexOf('id="export-edited-html"');
if (exportSectionIndex === -1 || exportButtonIndex === -1 || exportButtonIndex < exportSectionIndex) throw new Error('shell ui export button should appear in export section');

const step2Index = html.indexOf('2) Review safe preview');
const stepEditIndex = html.indexOf('3) Edit selected text');
const stepMoveIndex = html.indexOf('4) Move selected object');
const stepExportIndex = html.indexOf('5) Export edited copy');
if (step2Index === -1 || stepEditIndex === -1 || stepMoveIndex === -1 || stepExportIndex === -1 || step2Index > stepEditIndex || stepEditIndex > stepMoveIndex || stepMoveIndex > stepExportIndex) throw new Error('shell ui step order mismatch: expected 2 -> 3 -> 4 -> 5 flow');

if (!html.includes('preview-frame--compact')) throw new Error('shell ui missing preview compact class');
if (!html.includes('preview-frame--fit')) throw new Error('shell ui missing preview fit class');
if (!html.includes('preview-frame--tall')) throw new Error('shell ui missing preview tall class');
if (!html.includes('src="./src/app-shell.mjs"')) throw new Error('shell ui not using canonical app-shell path');

console.log('e2e smoke placeholder passed');

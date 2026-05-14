import { readFileSync } from 'node:fs';
import { buildSafePreviewDocument } from '../apps/desktop/src/preview-sandbox.mjs';
import {
  createImportStatusFromHtmlScan,
  createImportManifestFromStatus,
  createImportReportFromStatus,
  formatImportStatusSummary,
  formatImportManifestText,
  formatImportReportText,
  createCombinedPatchedSafePreviewResult
} from '../apps/desktop/src/importer.mjs';
import {
  createEditableTextInventory,
  createDraftEdit,
  createTextPatchPlan,
  createPatchCollectionState,
  addOrUpdatePatchInCollection,
  applyPatchCollectionToWorkingHtml
} from '../apps/desktop/src/editable-model.mjs';
import {
  createVisualObjectInventory,
  createVisualObjectSelectionState,
  createVisualTextEditBridgeState
} from '../apps/desktop/src/visual-object-model.mjs';
import {
  createVisualMovePatchCollectionState,
  applyCombinedTextAndVisualPatchesToHtml
} from '../apps/desktop/src/visual-layout-model.mjs';
import { createImageReplacementPatchCollectionState } from '../apps/desktop/src/image-replacement-model.mjs';
import { createEditedHtmlExportFromHtmlText } from '../apps/desktop/src/exporter.mjs';

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

function assertNoForbiddenFieldsInObject(value, forbiddenFields, category) {
  if (value == null) return;
  if (Array.isArray(value)) {
    for (const item of value) assertNoForbiddenFieldsInObject(item, forbiddenFields, category);
    return;
  }
  if (typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenFields.includes(key)) throw new Error(`[${category}] forbidden field detected: ${key}`);
    assertNoForbiddenFieldsInObject(child, forbiddenFields, category);
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

const forbiddenShellFields = ['rawHtmlText', 'htmlText', 'rawBytes', 'binary', 'ArrayBuffer', 'Blob', 'workingHtml'];
const secretMarker = 'SECRET_DO_NOT_LEAK_12345';
const sampleHtml = `<h1>${secretMarker}</h1><p>Hello</p>`;
const scan = {
  scriptTagCount: 0,
  inlineEventHandlerCount: 0,
  remoteUrlCount: 0,
  embeddedContentTagCount: 0,
  hasRiskMarkers: false
};
const referenceScan = {
  totalCount: 0,
  byType: { 'local-relative': 0, remote: 0, 'data-uri': 0, anchor: 0, unknown: 0 }
};
const status = createImportStatusFromHtmlScan({
  ok: true,
  fileName: 'sample.html',
  extension: 'html',
  size: sampleHtml.length,
  type: 'text/html',
  scan,
  referenceScan
});
const report = createImportReportFromStatus(status);
const manifest = createImportManifestFromStatus(status, report);
assertNoForbiddenFieldsInObject(status, forbiddenShellFields, 'shell-facing-status');
assertNoForbiddenFieldsInObject(report, forbiddenShellFields, 'shell-facing-report');
assertNoForbiddenFieldsInObject(manifest, forbiddenShellFields, 'shell-facing-manifest');
const statusSummary = formatImportStatusSummary(status);
const reportText = formatImportReportText(report);
const manifestText = formatImportManifestText(manifest);
if (statusSummary.includes(secretMarker)) throw new Error('[shell-facing-status-text] secret marker leaked');
if (reportText.includes(secretMarker)) throw new Error('[shell-facing-report-text] secret marker leaked');
if (manifestText.includes(secretMarker)) throw new Error('[shell-facing-manifest-text] secret marker leaked');

const editableInventory = createEditableTextInventory(sampleHtml);
assertNoForbiddenFieldsInObject(editableInventory, forbiddenShellFields, 'shell-facing-editable-inventory');
const firstCandidate = editableInventory.candidates[0];
const draftEdit = createDraftEdit(firstCandidate, 'Updated');
const patchPlan = createTextPatchPlan(draftEdit);
assertNoForbiddenFieldsInObject(draftEdit, forbiddenShellFields, 'shell-facing-draft-edit');
assertNoForbiddenFieldsInObject(patchPlan, forbiddenShellFields, 'shell-facing-patch-plan');
const patchCollection = addOrUpdatePatchInCollection(createPatchCollectionState(), patchPlan).collection;
const textApplyState = applyPatchCollectionToWorkingHtml(sampleHtml, patchCollection, editableInventory);
const shellFacingTextApplyState = {
  appliedAny: textApplyState.appliedAny,
  applyStatus: textApplyState.applyStatus,
  applyResults: textApplyState.applyResults,
  collectionCount: patchCollection.orderedCandidateIds.length,
  warnings: textApplyState.warnings
};
assertNoForbiddenFieldsInObject(shellFacingTextApplyState, forbiddenShellFields, 'shell-facing-text-apply-state');

const visualInventory = createVisualObjectInventory(sampleHtml);
assertNoForbiddenFieldsInObject(visualInventory, forbiddenShellFields, 'shell-facing-visual-inventory');
const visualSelection = createVisualObjectSelectionState(visualInventory, visualInventory.objects[0].objectId);
assertNoForbiddenFieldsInObject(visualSelection, forbiddenShellFields, 'shell-facing-visual-selection-state');
const visualBridge = createVisualTextEditBridgeState(visualSelection.selectedObject, editableInventory);
assertNoForbiddenFieldsInObject(visualBridge, forbiddenShellFields, 'shell-facing-visual-bridge-state');
const combinedApplyState = applyCombinedTextAndVisualPatchesToHtml(
  sampleHtml,
  patchCollection,
  createVisualMovePatchCollectionState(),
  editableInventory,
  visualInventory,
  createImageReplacementPatchCollectionState()
);
const shellFacingCombinedApplyState = {
  appliedAny: combinedApplyState.appliedAny,
  applyStatus: combinedApplyState.applyStatus,
  applyResults: combinedApplyState.applyResults,
  collectionCount: patchCollection.orderedCandidateIds.length,
  warnings: combinedApplyState.warnings
};
assertNoForbiddenFieldsInObject(shellFacingCombinedApplyState, forbiddenShellFields, 'shell-facing-combined-apply-state');
const importerShellFacingResult = await createCombinedPatchedSafePreviewResult(
  { name: 'sample.html', text: async () => sampleHtml },
  patchCollection,
  createVisualMovePatchCollectionState(),
  createImageReplacementPatchCollectionState()
);
assertNoForbiddenFieldsInObject(importerShellFacingResult.applyState, forbiddenShellFields, 'shell-facing-importer-apply-state');

const exportResult = createEditedHtmlExportFromHtmlText(sampleHtml, 'sample.html', patchCollection, createVisualMovePatchCollectionState(), createImageReplacementPatchCollectionState());
if (!(exportResult.blob instanceof Blob)) throw new Error('[export-blob] expected Blob for local download flow');
assertNoForbiddenFieldsInObject(
  {
    exportStatus: exportResult.exportStatus,
    fileName: exportResult.fileName,
    patchCount: exportResult.patchCount,
    textPatchCount: exportResult.textPatchCount,
    movePatchCount: exportResult.movePatchCount,
    imagePatchCount: exportResult.imagePatchCount,
    warnings: exportResult.warnings
  },
  forbiddenShellFields,
  'shell-facing-export-metadata'
);

console.log('security checks passed');

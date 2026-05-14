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
const projectPersistenceModelCode = readFileSync('apps/desktop/src/project-persistence-model.mjs', 'utf8');

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

function assertNoForbiddenShellPayload(value, category, options = {}) {
  const forbiddenFields = ['rawHtmlText', 'htmlText', 'rawBytes', 'binary', 'ArrayBuffer', 'Blob', 'workingHtml'];
  const forbiddenStringMarkers = ['SECRET_DO_NOT_LEAK_12345', '<h1', '<script', '<img', '<!doctype'];
  const allowBlobInstance = options.allowBlobInstance === true;
  const seen = new Set();
  const inspect = (node) => {
    if (node == null) return;
    if (typeof node === 'string') {
      const lowered = node.toLowerCase();
      for (const marker of forbiddenStringMarkers) {
        if (marker === 'SECRET_DO_NOT_LEAK_12345') {
          if (node.includes(marker)) throw new Error(`[${category}] forbidden string marker detected: ${marker}`);
        } else if (lowered.includes(marker)) {
          throw new Error(`[${category}] forbidden html marker detected: ${marker}`);
        }
      }
      return;
    }
    if (node instanceof ArrayBuffer) throw new Error(`[${category}] forbidden binary value detected: ArrayBuffer`);
    if (ArrayBuffer.isView(node)) throw new Error(`[${category}] forbidden binary value detected: TypedArray`);
    if (node instanceof Blob && !allowBlobInstance) throw new Error(`[${category}] forbidden binary value detected: Blob`);
    if (typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) inspect(item);
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (forbiddenFields.includes(key)) throw new Error(`[${category}] forbidden field detected: ${key}`);
      inspect(child);
    }
  };
  inspect(value);
}

function assertThrows(fn, expected, category) {
  let threw = false;
  try {
    fn();
  } catch (error) {
    threw = true;
    if (!String(error && error.message).includes(expected)) {
      throw new Error(`[${category}] unexpected error: ${String(error && error.message)}`);
    }
  }
  if (!threw) throw new Error(`[${category}] expected throw containing: ${expected}`);
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
assertForbidden(projectPersistenceModelCode, ['DOMParser', '.text()', '.arrayBuffer()', 'fetch(', 'XMLHttpRequest', 'WebSocket'], 'project-persistence-model');
assertRequired(importerCode, ['createProjectPayloadFromFile'], 'importer-project-read-owner');

// network/telemetry forbidden APIs
assertForbidden(html, ['<script src="http', 'https://'], 'runtime-remote-deps');
assertForbidden(shellCode + importerCode + exporterCode, ['sendBeacon', 'telemetry', 'analytics', 'crashlytics'], 'telemetry');
assertRequired(html, ['Scripts are disabled'], 'safe-preview-copy');

const hardenedPreviewDoc = buildSafePreviewDocument(
  '<a href="mailto:test@example.com">x</a><a href="ftp://example.test/file">x</a><a href="file:///tmp/x">x</a><a href="tel:+1">x</a><a href="vbscript:msgbox(1)">x</a><a href="custom:value">x</a><a href="https://example.test">x</a><a href="//example.test">x</a><img src="data:image/png;base64,aa">'
);
assertForbidden(hardenedPreviewDoc, ['mailto:', 'ftp://', 'file:///', 'tel:+', 'custom:', 'https://example.test', '//example.test'], 'preview-scheme-hardening');
if (hardenedPreviewDoc.toLowerCase().includes('vbscript:')) throw new Error('[preview-scheme-hardening] forbidden token detected: vbscript:');

const secretMarker = 'SECRET_DO_NOT_LEAK_12345';
const sampleHtml = '<h1>Visible title</h1><p>Hello</p>';
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
assertNoForbiddenShellPayload(status, 'shell-facing-status');
assertNoForbiddenShellPayload(report, 'shell-facing-report');
assertNoForbiddenShellPayload(manifest, 'shell-facing-manifest');
const statusSummary = formatImportStatusSummary(status);
const reportText = formatImportReportText(report);
const manifestText = formatImportManifestText(manifest);
assertNoForbiddenShellPayload(statusSummary, 'shell-facing-status-text');
assertNoForbiddenShellPayload(reportText, 'shell-facing-report-text');
assertNoForbiddenShellPayload(manifestText, 'shell-facing-manifest-text');

const editableInventory = createEditableTextInventory(sampleHtml);
assertNoForbiddenShellPayload(editableInventory, 'shell-facing-editable-inventory');
const firstCandidate = editableInventory.candidates[0];
const draftEdit = createDraftEdit(firstCandidate, 'Updated');
const patchPlan = createTextPatchPlan(draftEdit);
assertNoForbiddenShellPayload(draftEdit, 'shell-facing-draft-edit');
assertNoForbiddenShellPayload(patchPlan, 'shell-facing-patch-plan');
const patchCollection = addOrUpdatePatchInCollection(createPatchCollectionState(), patchPlan).collection;
const textApplyState = applyPatchCollectionToWorkingHtml(sampleHtml, patchCollection, editableInventory);
const shellFacingTextApplyState = {
  appliedAny: textApplyState.appliedAny,
  applyStatus: textApplyState.applyStatus,
  applyResults: textApplyState.applyResults,
  collectionCount: patchCollection.orderedCandidateIds.length,
  warnings: textApplyState.warnings
};
assertNoForbiddenShellPayload(shellFacingTextApplyState, 'shell-facing-text-apply-state');

const visualInventory = createVisualObjectInventory(sampleHtml);
assertNoForbiddenShellPayload(visualInventory, 'shell-facing-visual-inventory');
const visualSelection = createVisualObjectSelectionState(visualInventory, visualInventory.objects[0].objectId);
assertNoForbiddenShellPayload(visualSelection, 'shell-facing-visual-selection-state');
const visualBridge = createVisualTextEditBridgeState(visualSelection.selectedObject, editableInventory);
assertNoForbiddenShellPayload(visualBridge, 'shell-facing-visual-bridge-state');
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
assertNoForbiddenShellPayload(shellFacingCombinedApplyState, 'shell-facing-combined-apply-state');
const importerShellFacingResult = await createCombinedPatchedSafePreviewResult(
  { name: 'sample.html', text: async () => sampleHtml },
  patchCollection,
  createVisualMovePatchCollectionState(),
  createImageReplacementPatchCollectionState()
);
assertNoForbiddenShellPayload(importerShellFacingResult.applyState, 'shell-facing-importer-apply-state');

const exportResult = createEditedHtmlExportFromHtmlText(sampleHtml, 'sample.html', patchCollection, createVisualMovePatchCollectionState(), null, createImageReplacementPatchCollectionState());
if (!(exportResult.blob instanceof Blob)) throw new Error('[export-blob] expected Blob for local download flow');
assertNoForbiddenShellPayload(
  {
    exportStatus: exportResult.exportStatus,
    fileName: exportResult.fileName,
    patchCount: exportResult.patchCount,
    textPatchCount: exportResult.textPatchCount,
    movePatchCount: exportResult.movePatchCount,
    imagePatchCount: exportResult.imagePatchCount,
    warnings: exportResult.warnings
  },
  'shell-facing-export-metadata'
);

assertThrows(() => assertNoForbiddenShellPayload({ payload: 'SECRET_DO_NOT_LEAK_12345' }, 'negative-secret'), 'forbidden string marker', 'negative-secret');
assertThrows(() => assertNoForbiddenShellPayload({ payload: '<h1>secret</h1>' }, 'negative-html'), 'forbidden html marker', 'negative-html');
assertThrows(() => assertNoForbiddenShellPayload({ data: new ArrayBuffer(8) }, 'negative-arraybuffer'), 'ArrayBuffer', 'negative-arraybuffer');
assertThrows(() => assertNoForbiddenShellPayload({ data: new Uint8Array([1, 2]) }, 'negative-typed-array'), 'TypedArray', 'negative-typed-array');
assertThrows(() => assertNoForbiddenShellPayload({ blob: new Blob(['x']) }, 'negative-blob'), 'Blob', 'negative-blob');
assertNoForbiddenShellPayload({ status: 'ready', warningCount: 0, warnings: ['none'] }, 'negative-safe-metadata');
assertNoForbiddenShellPayload({ blob: new Blob(['x']) }, 'negative-blob-allowed', { allowBlobInstance: true });

console.log('security checks passed');

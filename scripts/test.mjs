import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  createProjectFileModel,
  detectExtension,
  detectSourceKind,
  renderShellState
} from '../apps/desktop/src/app-shell.mjs';
import { createPreviewLayoutState } from '../apps/desktop/src/app-shell.mjs';
import {
  createImportReportFromStatus,
  createImportManifestFromStatus,
  createImportStatusFromHtmlScan,
  createImportStatusFromZipPreflight,
  detectHtmlExtension,
  detectZipExtension,
  formatImportReportText,
  formatImportManifestText,
  formatImportStatusSummary,
  getHighestSeverityForWarningLabels,
  hasZipSignature,
  importHtmlFileScan,
  importZipFilePreflight,
  scanHtmlReferences,
  mapWarningLabelsToWarnings,
  scanHtmlRiskMarkers,
  createSafeHtmlPreviewDocument,
  createEditableInventoryForHtmlFile,
  createPatchedSafePreviewResult,
  createCollectionPatchedSafePreviewResult,
  createEditedHtmlExport,
  createVisualObjectInventoryForHtmlFile,
  createReplacementImageAssetFromFile
} from '../apps/desktop/src/importer.mjs';
import {
  buildSafePreviewDocument,
  buildSafePreviewResult,
  createUnavailablePreviewStatus,
  formatPreviewStatusText
} from '../apps/desktop/src/preview-sandbox.mjs';
import {
  createDraftEdit,
  createDraftEditState,
  createPatchPlanState,
  createEditableTextInventory,
  createTextPatchPlan,
  extractEditableTextCandidates,
  formatPatchPlanText,
  formatDraftEditText,
  formatEditableInventoryText,
  applyPlannedTextPatchToWorkingHtml,
  escapeTextForHtml,
  selectEditableCandidate,
  validatePatchPlan,
  createPatchCollectionState,
  addOrUpdatePatchInCollection,
  applyPatchCollectionToWorkingHtml,
  detectOverlappingPatchSpans,
  resetWorkingPreviewState,
  formatPatchCollectionText,
  formatWorkingPreviewStateText
} from '../apps/desktop/src/editable-model.mjs';
import { createEditedHtmlExportFromHtmlText, createSuggestedEditedHtmlFileName, formatExportStatusText } from '../apps/desktop/src/exporter.mjs';
import { createVisualMovePatchCollectionState, createVisualMovePatchPlan, addOrUpdateVisualMovePatch, createOverlayItemsWithMoveOverrides, applyCombinedTextAndVisualPatchesToHtml, createVisualDragSession, updateVisualDragSession, createVisualMovePatchFromDrag, createVisualResizeSession, updateVisualResizeSession, createVisualMovePatchFromResize, updateInlineStylePx } from '../apps/desktop/src/visual-layout-model.mjs';
import {
  createGeometryStatus,
  createVisualObjectInventory,
  createVisualObjectSelectionState,
  createVisualOverlayItems,
  createVisualOverlaySelectionState,
  extractImageAttributeGeometry,
  extractInlineGeometry,
  extractPixelValue,
  extractVisualObjectsFromHtml,
  formatGeometryText,
  formatOverlayStatusText,
  parseInlineStyle,
  formatVisualObjectInventoryText,
  formatVisualObjectOptionLabel,
  formatVisualObjectSelectionText,
  selectVisualObject,
  createVisualTextCandidateLinks,
  findEditableCandidateForVisualObject,
  createVisualTextEditBridgeState,
  formatVisualTextEditBridgeText,
  getVisualObjectEditableText,
  createSelectedTextEditStatus,
  formatSelectedTextEditStatus
} from '../apps/desktop/src/visual-object-model.mjs';

assert.equal(detectExtension('deck.html'), 'html');
assert.equal(detectExtension('deck.HTM'), 'htm');
assert.equal(detectExtension('deck.zip'), 'zip');
assert.equal(detectExtension('deck'), '');

assert.equal(detectSourceKind('html'), 'html');
assert.equal(detectSourceKind('htm'), 'html');
assert.equal(detectSourceKind('zip'), 'zip');
assert.equal(detectSourceKind('pptx'), 'unknown');

const project = createProjectFileModel({ name: 'demo.html', size: 25, type: 'text/html' });
assert.equal(project.extension, 'html');
assert.equal(project.sourceKind, 'html');
assert.match(project.selectedAt, /^\d{4}-\d{2}-\d{2}T/);

const empty = renderShellState(null);
assert.equal(empty.statusLabel, 'No file selected.');
assert.equal(empty.scanSummaryLabel, 'Scan summary: waiting for .html/.htm selection.');

const selected = renderShellState(project);
assert.equal(selected.unsupportedLabel, '');
assert.deepEqual(createPreviewLayoutState('default', true), { compact: false, tall: false, fit: true });
assert.deepEqual(createPreviewLayoutState('compact', true), { compact: true, tall: false, fit: true });
assert.deepEqual(createPreviewLayoutState('tall', true), { compact: false, tall: true, fit: true });

assert.equal(detectHtmlExtension('deck.html'), 'html');
assert.equal(detectHtmlExtension('deck.htm'), 'htm');
assert.equal(detectHtmlExtension('deck.zip'), null);
assert.equal(detectZipExtension('deck.zip'), 'zip');
assert.equal(detectZipExtension('deck.html'), null);

const scan = scanHtmlRiskMarkers('<script></script><div onclick="x()"></div><iframe></iframe>https://x.test');
assert.equal(scan.scriptTagCount, 1);
assert.equal(scan.inlineEventHandlerCount, 1);
assert.equal(scan.remoteUrlCount, 1);
assert.equal(scan.embeddedContentTagCount, 1);
assert.equal(scan.hasRiskMarkers, true);

const safeHtmlScanResult = await importHtmlFileScan({
  name: 'slides.html',
  size: 100,
  type: 'text/html',
  text: async () => '<main><h1>Safe</h1></main>'
});
const safeHtmlStatus = createImportStatusFromHtmlScan(safeHtmlScanResult);
const safeHtmlReport = createImportReportFromStatus(safeHtmlStatus);
const safeHtmlManifest = createImportManifestFromStatus(safeHtmlStatus, safeHtmlReport);
assert.equal(safeHtmlStatus.ok, true);
assert.equal(safeHtmlStatus.sourceKind, 'html');
assert.equal(safeHtmlStatus.severity, 'info');
assert.equal(safeHtmlReport.overallSeverity, 'info');
assert.equal(safeHtmlReport.warnings.length, 0);
assert.equal(safeHtmlManifest.sourceKind, 'html');
assert.equal(safeHtmlManifest.referenceSummary.totalCount, 0);
assert.equal(safeHtmlManifest.nextAvailableActions.includes('save-project'), false);
assert.equal(safeHtmlManifest.capabilities.includes('local-edited-html-export'), true);
assert.equal(safeHtmlManifest.capabilities.includes('editable-text-candidates'), true);
assert.equal(safeHtmlManifest.limitations.includes('no-persistence'), true);
assert.equal(safeHtmlManifest.limitations.includes('no-zip-extraction'), true);
assert.equal(safeHtmlManifest.limitations.includes('no-export'), false);
assert.equal(safeHtmlManifest.limitations.includes('no-edit'), false);
assert.equal(safeHtmlManifest.limitations.includes('no-preview'), false);

const localImageRefs = scanHtmlReferences('<img src="images/photo.png">');
assert.equal(localImageRefs.byType['local-relative'], 1);
const localImageStatus = createImportStatusFromHtmlScan({
  ok: true,
  reason: null,
  fileName: 'local-image.html',
  extension: 'html',
  size: 10,
  type: 'text/html',
  scan: scanHtmlRiskMarkers('<main></main>'),
  referenceScan: localImageRefs
});
assert.equal(localImageStatus.severity, 'info');
assert.equal(createImportReportFromStatus(localImageStatus).overallSeverity, 'info');

const localStylesheetRefs = scanHtmlReferences('<link rel="stylesheet" href="styles/main.css">');
assert.equal(localStylesheetRefs.byType['local-relative'], 1);
const localStylesheetStatus = createImportStatusFromHtmlScan({
  ok: true,
  reason: null,
  fileName: 'local-style.html',
  extension: 'html',
  size: 10,
  type: 'text/html',
  scan: scanHtmlRiskMarkers('<main></main>'),
  referenceScan: localStylesheetRefs
});
assert.equal(localStylesheetStatus.severity, 'info');
assert.equal(createImportReportFromStatus(localStylesheetStatus).overallSeverity, 'info');

const localScriptRefs = scanHtmlReferences('<script src="scripts/app.js"></script>');
assert.equal(localScriptRefs.byType['local-relative'], 1);

const cssUrlRefs = scanHtmlReferences('<style>.hero{background-image:url("assets/bg.png")}</style>');
assert.equal(cssUrlRefs.byType['local-relative'], 1);

const remoteHttpRefs = scanHtmlReferences('<img src="http://example.test/a.png"><script src="https://example.test/app.js"></script>');
assert.equal(remoteHttpRefs.byType.remote, 2);

const protocolRelativeRefs = scanHtmlReferences('<script src="//example.test/cdn.js"></script>');
assert.equal(protocolRelativeRefs.byType.remote, 1);

const dataUriRefs = scanHtmlReferences('<img src="data:image/png;base64,abcd">');
assert.equal(dataUriRefs.byType['data-uri'], 1);
const dataUriStatus = createImportStatusFromHtmlScan({
  ok: true,
  reason: null,
  fileName: 'data-uri.html',
  extension: 'html',
  size: 10,
  type: 'text/html',
  scan: scanHtmlRiskMarkers('<main></main>'),
  referenceScan: dataUriRefs
});
assert.equal(dataUriStatus.severity, 'info');
assert.equal(createImportReportFromStatus(dataUriStatus).overallSeverity, 'info');

const remoteReferenceStatus = createImportStatusFromHtmlScan({
  ok: true,
  reason: null,
  fileName: 'remote.html',
  extension: 'html',
  size: 10,
  type: 'text/html',
  scan: scanHtmlRiskMarkers('<main></main>'),
  referenceScan: remoteHttpRefs
});
assert.equal(remoteReferenceStatus.severity, 'warning');

const riskyHtmlScanResult = await importHtmlFileScan({
  name: 'risk.htm',
  size: 120,
  type: 'text/html',
  text: async () =>
    '<script></script><button onclick="x()">A</button><iframe></iframe><img src="https://risk.test/image.png">'
});
const riskyHtmlStatus = createImportStatusFromHtmlScan(riskyHtmlScanResult);
const riskyHtmlReport = createImportReportFromStatus(riskyHtmlStatus);
const riskyHtmlManifest = createImportManifestFromStatus(riskyHtmlStatus, riskyHtmlReport);
assert.equal(riskyHtmlStatus.ok, true);
assert.equal(riskyHtmlStatus.severity, 'warning');
assert.equal(riskyHtmlStatus.warningLabels.includes('script-tags-detected'), true);
assert.equal(riskyHtmlStatus.warningLabels.includes('remote-urls-detected'), true);
assert.equal(riskyHtmlStatus.warningLabels.includes('remote-references-detected'), true);
assert.equal(riskyHtmlReport.overallSeverity, 'warning');
assert.equal(riskyHtmlReport.warnings.length > 0, true);
assert.equal(riskyHtmlManifest.importReport.warningCount > 0, true);
assert.equal(riskyHtmlManifest.importReport.warningCodes.includes('script-tags-detected'), true);
assert.equal(riskyHtmlReport.warnings.every((w) => !!w.title && !!w.message && !!w.recommendedAction), true);

let zipReadCount = 0;
const validZipResult = await importZipFilePreflight({
  name: 'slides.zip',
  size: 2048,
  type: 'application/zip',
  slice: (start, end) => {
    assert.equal(start, 0);
    assert.equal(end, 4);
    return {
      arrayBuffer: async () => {
        zipReadCount += 1;
        return new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer;
      }
    };
  }
});
assert.equal(zipReadCount, 1);
const validZipStatus = createImportStatusFromZipPreflight(validZipResult);
const validZipReport = createImportReportFromStatus(validZipStatus);
const validZipManifest = createImportManifestFromStatus(validZipStatus, validZipReport);
assert.equal(validZipStatus.ok, true);
assert.equal(validZipStatus.sourceKind, 'zip');
assert.equal(validZipStatus.severity, 'info');
assert.equal(validZipStatus.checks.signatureStatus, 'valid-pk0304');
assert.equal(validZipReport.overallSeverity, 'info');
assert.equal(validZipManifest.sourceKind, 'zip');
assert.equal(validZipManifest.zipPreflightSummary.signatureStatus, 'valid-pk0304');
assert.equal(validZipManifest.capabilities.includes('zip-preflight'), true);
assert.equal(validZipManifest.capabilities.includes('safe-static-preview'), false);
assert.equal(validZipManifest.capabilities.includes('editable-text-candidates'), false);
assert.equal(validZipManifest.capabilities.includes('in-memory-text-patching'), false);
assert.equal(validZipManifest.capabilities.includes('local-edited-html-export'), false);
assert.equal(validZipManifest.limitations.includes('no-export-for-zip'), true);

const invalidZipResult = await importZipFilePreflight({
  name: 'bad.zip',
  size: 5,
  type: '',
  slice: () => ({
    arrayBuffer: async () => new Uint8Array([0x00, 0x11, 0x22, 0x33]).buffer
  })
});
const invalidZipStatus = createImportStatusFromZipPreflight(invalidZipResult);
const invalidZipReport = createImportReportFromStatus(invalidZipStatus);
const invalidZipManifest = createImportManifestFromStatus(invalidZipStatus, invalidZipReport);
assert.equal(invalidZipStatus.ok, false);
assert.equal(invalidZipStatus.severity, 'error');
assert.equal(invalidZipStatus.warningLabels[0], 'invalid-zip-signature');
assert.equal(invalidZipReport.overallSeverity, 'error');
assert.equal(invalidZipReport.warnings[0].recommendedAction.length > 0, true);
assert.equal(invalidZipManifest.importStatus, 'blocked');

let nonHtmlReadCount = 0;
const nonHtmlResult = await importHtmlFileScan({
  name: 'slides.zip',
  size: 100,
  type: 'application/zip',
  text: async () => {
    nonHtmlReadCount += 1;
    throw new Error('should not read');
  }
});
assert.equal(nonHtmlReadCount, 0);
const nonHtmlStatus = createImportStatusFromHtmlScan(nonHtmlResult);
const nonHtmlReport = createImportReportFromStatus(nonHtmlStatus);
const nonHtmlManifest = createImportManifestFromStatus(nonHtmlStatus, nonHtmlReport);
assert.equal(nonHtmlStatus.ok, false);
assert.equal(nonHtmlStatus.severity, 'error');
assert.equal(nonHtmlReport.overallSeverity, 'error');
assert.equal('rawHtmlText' in nonHtmlManifest, false);
assert.equal(nonHtmlManifest.capabilities.includes('safe-static-preview'), false);
assert.equal(nonHtmlManifest.capabilities.includes('editable-text-candidates'), false);
assert.equal(nonHtmlManifest.capabilities.includes('local-edited-html-export'), false);
assert.equal(nonHtmlManifest.limitations.includes('unsupported-file-type'), true);

const safePreviewDoc = buildSafePreviewDocument(
  '<meta http-equiv="refresh" content="0;url=https://example.test"><script>alert(1)</script><button onclick="x()">B</button><img src="javascript:alert(1)"><a href="https://example.test">x</a><iframe src="x"></iframe>'
);
assert.equal(safePreviewDoc.includes("Content-Security-Policy"), true);
assert.equal(safePreviewDoc.includes("default-src 'none'"), true);
assert.equal(safePreviewDoc.includes('<script'), false);
assert.equal(safePreviewDoc.includes('onclick='), false);
assert.equal(safePreviewDoc.includes('javascript:'), false);
assert.equal(safePreviewDoc.includes('https://example.test'), false);
assert.equal(safePreviewDoc.includes('<iframe'), false);
assert.equal(safePreviewDoc.toLowerCase().includes('http-equiv="refresh"'), false);
assert.equal(safePreviewDoc.includes('allow-scripts'), false);
assert.equal(safePreviewDoc.includes('allow-same-origin'), false);

const fullDocPreview = buildSafePreviewDocument('<!doctype html><html><head><style>h1{color:blue}</style><script>alert(1)</script></head><body><h1>T</h1></body></html>');
assert.equal((fullDocPreview.match(/<html\b/gi) || []).length, 1);
assert.equal((fullDocPreview.match(/<head\b/gi) || []).length, 1);
assert.equal((fullDocPreview.match(/<body\b/gi) || []).length, 1);
assert.equal(fullDocPreview.includes('Content-Security-Policy'), true);
assert.equal(fullDocPreview.includes('h1{color:blue}'), true);
assert.equal(fullDocPreview.includes('<h1>T</h1>'), true);
assert.equal(fullDocPreview.includes('<script'), false);

const malformedScriptDoc = buildSafePreviewDocument('<h1>X</h1><script src="x.js">');
assert.equal(malformedScriptDoc.includes('<script'), false);
const malformedScriptDocInline = buildSafePreviewDocument('<h1>X</h1><script>alert(1)');
assert.equal(malformedScriptDocInline.includes('<script'), false);
const malformedScriptStatus = buildSafePreviewResult('<h1>X</h1><script src="x.js">');
assert.equal(malformedScriptStatus.previewStatus.scriptsRemoved > 0, true);
assert.equal(malformedScriptStatus.previewDocument.includes("default-src 'none'"), true);

const blockedSvgData = buildSafePreviewDocument('<img src="data:image/svg+xml,%3Csvg%3E"/><a href="data:text/html,abc">x</a>');
assert.equal(blockedSvgData.includes('data:image/svg+xml'), false);
assert.equal(blockedSvgData.includes('href="#"'), true);
const allowedPngData = buildSafePreviewDocument('<img src="data:image/png;base64,AAAA">');
assert.equal(allowedPngData.includes('data:image/png;base64,AAAA'), true);

const htmlPreviewDoc = await createSafeHtmlPreviewDocument({
  name: 'preview.html',
  text: async () => '<h1>Hello</h1>'
});
assert.equal(typeof htmlPreviewDoc, 'string');
assert.equal(htmlPreviewDoc.includes('<h1>Hello</h1>'), true);
assert.equal(await createSafeHtmlPreviewDocument({ name: 'preview.zip', text: async () => '<h1>Bad</h1>' }), null);

assert.equal(getHighestSeverityForWarningLabels(['local-assets-detected']), 'info');
assert.equal(getHighestSeverityForWarningLabels(['data-uris-detected']), 'info');
assert.equal(getHighestSeverityForWarningLabels(['remote-references-detected']), 'warning');
assert.equal(getHighestSeverityForWarningLabels(['unsupported-extension']), 'error');

let nonZipReadCount = 0;
const nonZipResult = await importZipFilePreflight({
  name: 'notes.txt',
  size: 10,
  type: 'text/plain',
  slice: () => ({
    arrayBuffer: async () => {
      nonZipReadCount += 1;
      return new ArrayBuffer(0);
    }
  })
});
assert.equal(nonZipReadCount, 0);
assert.equal(nonZipResult.reason, 'unsupported-extension');

const warningObjects = mapWarningLabelsToWarnings(['script-tags-detected', 'remote-urls-detected']);
assert.equal(warningObjects.length, 2);
assert.equal(warningObjects.every((w) => !!w.title && !!w.message && !!w.recommendedAction), true);

const summary = formatImportStatusSummary(validZipStatus);
assert.match(summary, /^Scan summary: ZIP preflight:/);
const reportText = formatImportReportText(riskyHtmlReport);
assert.match(reportText, /^Import report for risk.htm/);
assert.equal('rawHtmlText' in riskyHtmlReport, false);
assert.equal('rawBytes' in validZipReport, false);
assert.equal('htmlText' in riskyHtmlReport, false);
assert.equal('binary' in validZipReport, false);
assert.equal('rawHtmlText' in riskyHtmlManifest, false);
assert.equal('htmlText' in riskyHtmlManifest, false);
assert.equal('rawBytes' in validZipManifest, false);
assert.equal('binary' in validZipManifest, false);
assert.equal(reportText.includes('<script>'), false);
assert.equal(reportText.includes('refs-total='), false);
assert.match(formatImportManifestText(validZipManifest), /^Import manifest v1/);

assert.equal(hasZipSignature(new Uint8Array([0x50, 0x4b, 0x03, 0x04])), 'valid-pk0304');
assert.equal(hasZipSignature(new Uint8Array([0x50, 0x4b, 0x05, 0x06])), 'valid-pk0506');
assert.equal(hasZipSignature(new Uint8Array([0x50, 0x4b, 0x07, 0x08])), 'valid-pk0708');
assert.equal(hasZipSignature(new Uint8Array([0x12, 0x34, 0x56, 0x78])), null);

console.log('unit tests passed');


const previewReady = buildSafePreviewResult('<h1>Hello</h1>');
assert.equal(previewReady.previewStatus.status, 'ready');

const previewWithScript = buildSafePreviewResult('<script>bad()</script><h1>Hi</h1>');
assert.equal(previewWithScript.previewStatus.scriptsRemoved > 0, true);

const previewWithInline = buildSafePreviewResult('<button onclick="bad()">x</button>');
assert.equal(previewWithInline.previewStatus.inlineHandlersRemoved > 0, true);

const previewWithDanger = buildSafePreviewResult('<a href="javascript:alert(1)">x</a>');
assert.equal(previewWithDanger.previewStatus.dangerousUrlsNeutralized > 0, true);
assert.equal(previewWithDanger.previewDocument.includes('href="javascript:'), false);

const previewWithRemote = buildSafePreviewResult('<img src="https://example.test/x.png">');
assert.equal(previewWithRemote.previewStatus.remoteReferencesNeutralized > 0, true);

const previewWithSchemes = buildSafePreviewResult(
  '<a href="mailto:test@example.com">m</a><a href="ftp://example.test/file">f</a><a href="file:///secret">fl</a><a href="tel:+123">t</a><a href="vbscript:msgbox(1)">v</a><a href="custom:value">c</a>'
);
assert.equal(previewWithSchemes.previewStatus.dangerousUrlsNeutralized >= 6, true);
assert.equal(previewWithSchemes.previewDocument.includes('mailto:'), false);
assert.equal(previewWithSchemes.previewDocument.includes('ftp://'), false);
assert.equal(previewWithSchemes.previewDocument.includes('file:///'), false);
assert.equal(previewWithSchemes.previewDocument.includes('tel:+'), false);
assert.equal(previewWithSchemes.previewDocument.toLowerCase().includes('vbscript:'), false);
assert.equal(previewWithSchemes.previewDocument.includes('custom:'), false);

const previewWithAllowedLocal = buildSafePreviewResult(
  '<a href="#slide-1">anchor</a><a href="assets/pic.png">rel</a><img src="./images/pic.png"><img src="/images/root.png">'
);
assert.equal(previewWithAllowedLocal.previewDocument.includes('href="#slide-1"'), true);
assert.equal(previewWithAllowedLocal.previewDocument.includes('href="assets/pic.png"'), true);
assert.equal(previewWithAllowedLocal.previewDocument.includes('src="./images/pic.png"'), true);
assert.equal(previewWithAllowedLocal.previewDocument.includes('src="/images/root.png"'), true);

const previewWithDataAndBlob = buildSafePreviewResult(
  '<img src="data:image/png;base64,aaaa"><img src="blob:abc"><a href="data:text/html,hello">bad</a>'
);
assert.equal(previewWithDataAndBlob.previewDocument.includes('src="data:image/png;base64,aaaa"'), true);
assert.equal(previewWithDataAndBlob.previewDocument.includes('src="blob:abc"'), true);
assert.equal(previewWithDataAndBlob.previewDocument.includes('href="data:text/html,hello"'), false);

const previewWithEmbed = buildSafePreviewResult('<iframe src="x"></iframe><object></object><embed>');
assert.equal(previewWithEmbed.previewStatus.embeddedContentRemoved > 0, true);

const previewWithMeta = buildSafePreviewResult('<meta http-equiv="refresh" content="0">');
assert.equal(previewWithMeta.previewStatus.metaRefreshRemoved > 0, true);

const statusText = formatPreviewStatusText(previewWithScript.previewStatus);
assert.equal(statusText.includes('<script>'), false);
assert.equal(statusText.includes('bad()'), false);
assert.equal(statusText.includes('PK\x03\x04'), false);

const zipPreviewStatus = createUnavailablePreviewStatus('zip', 'slides.zip');
assert.equal(zipPreviewStatus.status, 'unavailable');


const h1Candidates = extractEditableTextCandidates('<h1>Hello title</h1>');
assert.equal(h1Candidates[0].tagName, 'h1');
assert.equal(h1Candidates[0].textPreview, 'Hello title');

const pCandidates = extractEditableTextCandidates('<p>Paragraph body</p>');
assert.equal(pCandidates[0].tagName, 'p');

const linkButtonCandidates = extractEditableTextCandidates('<button>Go</button><a href="#">Read more</a>');
assert.equal(linkButtonCandidates.length, 2);

const ignoredCandidates = extractEditableTextCandidates('<script>bad</script><style>.x{}</style><template>tmp</template><p>ok</p>');
assert.equal(ignoredCandidates.length, 1);
assert.equal(ignoredCandidates[0].textPreview, 'ok');

const nestedStrip = extractEditableTextCandidates('<p>Hello <strong>World</strong></p>');
const nestedParagraph = nestedStrip.find((c) => c.tagName === 'p');
assert.equal(nestedParagraph.textPreview, 'Hello World');

const capped = extractEditableTextCandidates(`<p>${'a'.repeat(120)}</p>`);
assert.equal(capped[0].textPreview.length <= 81, true);
assert.equal(capped[0].textPreview.endsWith('…'), true);

const deterministic = extractEditableTextCandidates('<h1>A</h1><p>B</p><p>C</p>');
assert.deepEqual(deterministic.map((c) => c.candidateId), ['text-001', 'text-002', 'text-003']);
assert.equal(Number.isInteger(deterministic[0].sourceStart), true);
assert.equal(Number.isInteger(deterministic[0].sourceEnd), true);
assert.equal(deterministic[0].sourceEnd > deterministic[0].sourceStart, true);

const inventory = createEditableTextInventory('<h1>Deck &amp; Title</h1>');
assert.equal(inventory.inventoryStatus, 'read-only-discovery');
assert.equal(inventory.editingEnabled, false);
assert.equal('rawHtmlText' in inventory, false);
assert.equal('htmlText' in inventory, false);
assert.equal('rawBytes' in inventory, false);
assert.equal('binary' in inventory, false);
assert.equal(formatEditableInventoryText(inventory).includes('Editing is not enabled yet'), false);
assert.equal(formatEditableInventoryText(inventory).toLowerCase().includes('in memory'), true);

const zipInventory = await createEditableInventoryForHtmlFile({ name: 'slides.zip', text: async () => '<h1>no</h1>' });
assert.equal(zipInventory, null);


const candidateInventory = createEditableTextInventory('<h1>Hello</h1><p>World</p>');
const firstCandidateId = candidateInventory.candidates[0].candidateId;
const selectedCandidate = selectEditableCandidate(candidateInventory, firstCandidateId);
assert.equal(selectedCandidate?.candidateId, firstCandidateId);
assert.equal(selectEditableCandidate(candidateInventory, 'text-999'), null);

const draft = createDraftEdit(selectedCandidate, 'Updated hello');
assert.equal(draft?.candidateId, firstCandidateId);
assert.equal(draft?.replacementText, 'Updated hello');
assert.equal(draft?.validationStatus, 'valid');

const emptyDraft = createDraftEdit(selectedCandidate, '   ');
assert.equal(emptyDraft?.validationStatus, 'warning-empty');

const longDraft = createDraftEdit(selectedCandidate, 'x'.repeat(501));
assert.equal(longDraft?.validationStatus, 'warning-long');

const draftState = createDraftEditState(candidateInventory);
assert.equal(typeof draftState.selectedCandidateId, 'string');
const formattedDraft = formatDraftEditText({ draftEdit: draft });
assert.equal(formattedDraft.includes('Draft edit buffer'), true);
assert.equal('rawHtmlText' in draft, false);
assert.equal('htmlText' in draft, false);
assert.equal('rawBytes' in draft, false);
assert.equal('binary' in draft, false);

const patchPlan = createTextPatchPlan(draft);
assert.equal(patchPlan?.operation, 'replace-text');
assert.equal(patchPlan?.patchId, 'patch-text-001');
assert.equal(patchPlan?.candidateId, 'text-001');
assert.equal(patchPlan?.applyStatus, 'planned');
assert.equal(patchPlan?.validationStatus, 'valid');

const patchState = createPatchPlanState({ draftEdit: draft });
assert.equal(patchState.patchPlan?.patchId, 'patch-text-001');
assert.equal(formatPatchPlanText(patchState.patchPlan).includes('operation: replace-text'), true);
assert.equal(formatPatchPlanText(patchState.patchPlan).includes('candidate: text-001'), true);
assert.equal(formatPatchPlanText(patchState.patchPlan).includes('validation: valid'), true);
assert.equal(formatPatchPlanText(patchState.patchPlan).includes('apply status: planned'), true);

const emptyPatchPlan = createTextPatchPlan(emptyDraft);
assert.equal(emptyPatchPlan?.applyStatus, 'blocked');
assert.equal(emptyPatchPlan?.validationStatus, 'warning-empty');

const longPatchPlan = createTextPatchPlan(longDraft);
assert.equal(longPatchPlan?.applyStatus, 'blocked');
assert.equal(longPatchPlan?.validationStatus, 'warning-long');

const missingCandidatePatchPlan = createTextPatchPlan({
  candidateId: '',
  originalTextPreview: 'Hello',
  replacementText: 'World',
  replacementLength: 5
});
assert.equal(missingCandidatePatchPlan?.applyStatus, 'blocked');
assert.equal(missingCandidatePatchPlan?.validationStatus, 'warning-missing-candidate');

assert.equal('replacementText' in patchPlan, true);
assert.equal('rawHtmlText' in patchPlan, false);
assert.equal('htmlText' in patchPlan, false);
assert.equal('rawBytes' in patchPlan, false);
assert.equal('binary' in patchPlan, false);
assert.equal(validatePatchPlan(null).applyStatus, 'blocked');

const patchInventory = createEditableTextInventory('<h1>Hello</h1><p>Hello</p>');
const patchCandidate = patchInventory.candidates[0];
const patchDraft = createDraftEdit(patchCandidate, '<new & "quoted">');
const plannedPatch = createTextPatchPlan(patchDraft);
const appliedPatch = applyPlannedTextPatchToWorkingHtml('<h1>Hello</h1><p>Hello</p>', plannedPatch, patchInventory);
assert.equal(appliedPatch.applied, true);
assert.equal(appliedPatch.applyStatus, 'applied-to-working-preview');
assert.equal(appliedPatch.workingHtml.includes('<h1>&lt;new &amp; &quot;quoted&quot;&gt;</h1>'), true);
assert.equal(appliedPatch.workingHtml.includes('<p>Hello</p>'), true);
assert.equal(escapeTextForHtml(`5 > 2 & "q" and 's'`).includes('&gt;'), true);
assert.equal(escapeTextForHtml(`5 > 2 & "q" and 's'`).includes('&#39;'), true);

const blockedApply = applyPlannedTextPatchToWorkingHtml('<h1>Hello</h1>', { ...plannedPatch, applyStatus: 'blocked' }, patchInventory);
assert.equal(blockedApply.applied, false);
assert.equal(blockedApply.applyStatus, 'blocked');

const missingSpanInventory = { ...patchInventory, candidates: [{ ...patchCandidate, sourceStart: undefined, sourceEnd: undefined }] };
const missingSpanApply = applyPlannedTextPatchToWorkingHtml('<h1>Hello</h1>', plannedPatch, missingSpanInventory);
assert.equal(missingSpanApply.applied, false);
assert.equal(missingSpanApply.applyStatus, 'failed');

const scriptOffsetHtml = '<script>console.log("x")</script><h1>Target</h1><p>Target</p>';
const scriptOffsetInventory = createEditableTextInventory(scriptOffsetHtml);
assert.equal(scriptOffsetInventory.candidates.some((candidate) => candidate.tagName === 'script'), false);
const scriptTarget = scriptOffsetInventory.candidates.find((candidate) => candidate.tagName === 'h1');
const scriptOffsetPatch = createTextPatchPlan(createDraftEdit(scriptTarget, 'Updated target'));
const scriptOffsetApply = applyPlannedTextPatchToWorkingHtml(scriptOffsetHtml, scriptOffsetPatch, scriptOffsetInventory);
assert.equal(scriptOffsetApply.applied, true);
assert.equal(scriptOffsetApply.workingHtml.includes('<h1>Updated target</h1>'), true);
assert.equal(scriptOffsetApply.workingHtml.includes('<p>Target</p>'), true);
assert.equal(scriptOffsetApply.workingHtml.includes('<script>console.log("x")</script>'), true);

const styleOffsetHtml = '<style>.a{color:red}</style><template><p>skip</p></template><h2>Keep me</h2><p>Keep me</p>';
const styleOffsetInventory = createEditableTextInventory(styleOffsetHtml);
const styleTarget = styleOffsetInventory.candidates.find((candidate) => candidate.tagName === 'h2');
const styleOffsetPatch = createTextPatchPlan(createDraftEdit(styleTarget, 'Replaced heading'));
const styleOffsetApply = applyPlannedTextPatchToWorkingHtml(styleOffsetHtml, styleOffsetPatch, styleOffsetInventory);
assert.equal(styleOffsetApply.applied, true);
assert.equal(styleOffsetApply.workingHtml.includes('<h2>Replaced heading</h2>'), true);
assert.equal(styleOffsetApply.workingHtml.includes('<p>Keep me</p>'), true);

const patchedPreview = await createPatchedSafePreviewResult(
  { name: 'preview.html', text: async () => '<h1>Hello</h1><script>bad()</script>' },
  createTextPatchPlan(createDraftEdit(createEditableTextInventory('<h1>Hello</h1>').candidates[0], 'Updated'))
);
assert.equal(patchedPreview.applyResult.applied, true);
assert.equal(patchedPreview.previewResult.previewDocument.includes('<h1>Updated</h1>'), true);
assert.equal(patchedPreview.previewResult.previewDocument.includes("default-src 'none'"), true);
assert.equal('rawHtmlText' in patchedPreview.applyResult, false);
assert.equal('htmlText' in patchedPreview.applyResult, false);
assert.equal('rawBytes' in patchedPreview.applyResult, false);
assert.equal('binary' in patchedPreview.applyResult, false);
assert.equal('workingHtml' in patchedPreview.applyResult, false);


const collection0 = createPatchCollectionState();
assert.deepEqual(collection0, { patchesByCandidateId: {}, orderedCandidateIds: [] });
const collectionAdd = addOrUpdatePatchInCollection(collection0, plannedPatch);
assert.equal(collectionAdd.changed, true);
assert.equal(collectionAdd.collection.orderedCandidateIds.length, 1);
const updatedPatch = { ...plannedPatch, replacementText: 'Hello updated', replacementLength: 13 };
const collectionUpdate = addOrUpdatePatchInCollection(collectionAdd.collection, updatedPatch);
assert.equal(collectionUpdate.collection.orderedCandidateIds.length, 1);
assert.equal(collectionUpdate.collection.patchesByCandidateId[plannedPatch.candidateId].replacementText, 'Hello updated');
const blockedCollectionUpdate = addOrUpdatePatchInCollection(collectionUpdate.collection, { ...plannedPatch, replacementText: '   ', replacementLength: 3 });
assert.equal(blockedCollectionUpdate.changed, false);

const multiHtml = '<h1>Hello</h1><p>World</p><span>Hello</span>';
const multiInventory = createEditableTextInventory(multiHtml);
const first = multiInventory.candidates[0];
const second = multiInventory.candidates.find((c) => c.textPreview === 'World');
const p1 = createTextPatchPlan({ candidateId: first.candidateId, originalTextPreview: first.textPreview, replacementText: 'Title A', replacementLength: 7, validationStatus: 'valid' });
const p2 = createTextPatchPlan({ candidateId: second.candidateId, originalTextPreview: second.textPreview, replacementText: 'Body B', replacementLength: 6, validationStatus: 'valid' });
let c = createPatchCollectionState();
c = addOrUpdatePatchInCollection(c, p1).collection;
c = addOrUpdatePatchInCollection(c, p2).collection;
const multiApply = applyPatchCollectionToWorkingHtml(multiHtml, c, multiInventory);
assert.equal(multiApply.appliedAny, true);
assert.equal(multiApply.workingHtml, '<h1>Title A</h1><p>Body B</p><span>Hello</span>');
assert.equal('rawHtmlText' in multiApply, false);
assert.equal('htmlText' in multiApply, false);
assert.equal('workingHtml' in multiApply.applyResults[0], false);

const reverseCollection = createPatchCollectionState();
const reverseFirst = addOrUpdatePatchInCollection(reverseCollection, p2).collection;
const reverseSecond = addOrUpdatePatchInCollection(reverseFirst, p1).collection;
const reverseApply = applyPatchCollectionToWorkingHtml(multiHtml, reverseSecond, multiInventory);
assert.equal(reverseApply.workingHtml, '<h1>Title A</h1><p>Body B</p><span>Hello</span>');


const overlapHtml = '<div><h1>Title</h1></div>';
const overlapInventory = createEditableTextInventory(overlapHtml);
const overlapH1 = overlapInventory.candidates.find((candidate) => candidate.tagName === 'h1');
const overlapDiv = overlapInventory.candidates.find((candidate) => candidate.tagName === 'div');
let overlapCollection = createPatchCollectionState();
overlapCollection = addOrUpdatePatchInCollection(overlapCollection, createTextPatchPlan(createDraftEdit(overlapH1, 'New H1'))).collection;
overlapCollection = addOrUpdatePatchInCollection(overlapCollection, createTextPatchPlan(createDraftEdit(overlapDiv, 'New Div Text'))).collection;
const overlaps = detectOverlappingPatchSpans(overlapCollection, overlapInventory);
assert.equal(overlaps.length > 0, true);
const overlapApply = applyPatchCollectionToWorkingHtml(overlapHtml, overlapCollection, overlapInventory);
assert.equal(overlapApply.applyStatus, 'blocked-overlapping-patches');
assert.equal(overlapApply.appliedAny, false);
assert.equal('workingHtml' in overlapApply, false);

const blockedOverlapExport = createEditedHtmlExportFromHtmlText(overlapHtml, 'deck.html', overlapCollection);
assert.equal(blockedOverlapExport.exported, false);
assert.equal(blockedOverlapExport.exportStatus, 'blocked');

let sameCandidateCollection = createPatchCollectionState();
sameCandidateCollection = addOrUpdatePatchInCollection(sameCandidateCollection, createTextPatchPlan(createDraftEdit(first, 'Interim'))).collection;
sameCandidateCollection = addOrUpdatePatchInCollection(sameCandidateCollection, createTextPatchPlan(createDraftEdit(first, 'Final Title'))).collection;
assert.equal(sameCandidateCollection.orderedCandidateIds.length, 1);
assert.equal(detectOverlappingPatchSpans(sameCandidateCollection, multiInventory).length, 0);
const sameCandidateApply = applyPatchCollectionToWorkingHtml(multiHtml, sameCandidateCollection, multiInventory);
assert.equal(sameCandidateApply.workingHtml, '<h1>Final Title</h1><p>World</p><span>Hello</span>');

const prefixedHtml = '<script>console.log(1)</script><style>.x{color:red}</style><template><p>ignored</p></template><h2>Hello</h2><p>World</p><span>Hello</span>';
const prefixedInventory = createEditableTextInventory(prefixedHtml);
const prefixedHeading = prefixedInventory.candidates.find((candidate) => candidate.tagName === 'h2');
const prefixedBody = prefixedInventory.candidates.find((candidate) => candidate.tagName === 'p' && candidate.textPreview === 'World');
const prefixedP1 = createTextPatchPlan(createDraftEdit(prefixedHeading, 'Heading widened text'));
const prefixedP2 = createTextPatchPlan(createDraftEdit(prefixedBody, 'Body'));
let prefixedCollection = createPatchCollectionState();
prefixedCollection = addOrUpdatePatchInCollection(prefixedCollection, prefixedP1).collection;
prefixedCollection = addOrUpdatePatchInCollection(prefixedCollection, prefixedP2).collection;
const prefixedApply = applyPatchCollectionToWorkingHtml(prefixedHtml, prefixedCollection, prefixedInventory);
assert.equal(
  prefixedApply.workingHtml,
  '<script>console.log(1)</script><style>.x{color:red}</style><template><p>ignored</p></template><h2>Heading widened text</h2><p>Body</p><span>Hello</span>'
);

const collectionPreview = await createCollectionPatchedSafePreviewResult({ name: 'preview.html', text: async () => multiHtml }, c);
assert.equal(collectionPreview.previewResult.previewDocument.includes("default-src 'none'"), true);
assert.equal('workingHtml' in collectionPreview.applyState, false);
const overlapPreview = await createCollectionPatchedSafePreviewResult({ name: 'preview.html', text: async () => overlapHtml }, overlapCollection);
assert.equal(overlapPreview.previewResult, null);
assert.equal(overlapPreview.applyState.applyStatus, 'blocked-overlapping-patches');
assert.equal(overlapPreview.applyState.warnings.includes('overlapping-patches'), true);
assert.equal('workingHtml' in overlapPreview.applyState, false);
const resetState = resetWorkingPreviewState();
assert.equal(resetState.applyStatus, 'reset-to-original');
assert.equal(formatPatchCollectionText(createPatchCollectionState()).includes('none applied'), true);
assert.equal(formatWorkingPreviewStateText(resetState).includes('in-memory only'), true);
assert.equal(createSuggestedEditedHtmlFileName('deck.html'), 'deck-edited.html');
assert.equal(createSuggestedEditedHtmlFileName('q4 plan<>.html'), 'q4-plan-edited.html');

const exportSinglePure = createEditedHtmlExportFromHtmlText('<h1>Old title</h1>', 'deck.html', {
  patchesByCandidateId: { 'text-001': { patchId: 'patch-text-001', candidateId: 'text-001', replacementText: 'Hello & <b>', replacementLength: 11, applyStatus: 'planned' } },
  orderedCandidateIds: ['text-001']
});
assert.equal(exportSinglePure.exported, true);
assert.equal((await exportSinglePure.blob.text()).includes('Hello &amp; &lt;b&gt;'), true);

let exportReadCount = 0;
const exportSingle = await createEditedHtmlExport({ name: 'deck.html', text: async () => { exportReadCount += 1; return '<h1>Old title</h1>'; } }, {
  patchesByCandidateId: { 'text-001': { patchId: 'patch-text-001', candidateId: 'text-001', replacementText: 'Hello & <b>', replacementLength: 11, applyStatus: 'planned' } },
  orderedCandidateIds: ['text-001']
});
assert.equal(exportReadCount, 1);
assert.equal(exportSingle.exported, true);
assert.equal(exportSingle.mimeType, 'text/html');
assert.equal('workingHtml' in exportSingle, false);
assert.equal('rawHtmlText' in exportSingle, false);
assert.equal('htmlText' in exportSingle, false);
assert.equal('rawBytes' in exportSingle, false);
assert.equal('binary' in exportSingle, false);

const exportMulti = await createEditedHtmlExport({ name: 'deck.html', text: async () => '<h1>One</h1><p>Two</p><p>Two</p>' }, c);
assert.equal(exportMulti.exported, true);
assert.equal((await exportMulti.blob.text()).includes('<h1>Title A</h1><p>Body B</p><p>Two</p>'), true);
assert.equal(exportMulti.suggestedFileName, 'deck-edited.html');

const blockedEmpty = await createEditedHtmlExport({ name: 'deck.html', text: async () => '<h1>One</h1>' }, createPatchCollectionState());
assert.equal(blockedEmpty.exportStatus, 'blocked');
const blockedFail = await createEditedHtmlExport({ name: 'deck.html', text: async () => '<h1>One</h1>' }, { patchesByCandidateId: { missing: { patchId: 'patch-missing', candidateId: 'missing', replacementText: 'x', replacementLength: 1, applyStatus: 'planned' } }, orderedCandidateIds: ['missing'] });
assert.equal(blockedFail.exported, false);


const warningExport = createEditedHtmlExportFromHtmlText('<h1>Old title</h1>', 'slides.html', {
  patchesByCandidateId: { 'text-001': { patchId: 'patch-text-001', candidateId: 'text-001', replacementText: 'Hello!', replacementLength: 6, applyStatus: 'planned' } },
  orderedCandidateIds: ['text-001']
}, { hasScripts: true, hasRemoteReferences: false });
assert.equal(warningExport.exported, true);
assert.equal((warningExport.disclosureWarning || '').includes('blocked in safe preview'), true);
assert.equal((warningExport.blob ? 'ok' : 'missing'), 'ok');
const scriptPreservedExport = await createEditedHtmlExport({ name: 'scripted.html', text: async () => '<h1>Old title</h1><script>ok()</script>' }, {
  patchesByCandidateId: { 'text-001': { patchId: 'patch-text-001', candidateId: 'text-001', replacementText: 'Hi', replacementLength: 2, applyStatus: 'planned' } },
  orderedCandidateIds: ['text-001']
});
assert.equal((await scriptPreservedExport.blob.text()).includes('<script>ok()</script>'), true);
const cleanExport = createEditedHtmlExportFromHtmlText('<h1>Old title</h1>', 'clean.html', {
  patchesByCandidateId: { 'text-001': { patchId: 'patch-text-001', candidateId: 'text-001', replacementText: 'Hi', replacementLength: 2, applyStatus: 'planned' } },
  orderedCandidateIds: ['text-001']
}, { hasScripts: false, hasRemoteReferences: false });
assert.equal(cleanExport.disclosureWarning || '', '');
assert.equal(formatExportStatusText(warningExport).includes('blocked in safe preview'), true);

const forbiddenShellKeys = ['rawHtmlText', 'htmlText', 'rawBytes', 'binary', 'workingHtml'];
const assertNoForbiddenKeys = (label, value) => {
  if (!value || typeof value !== 'object') return;
  for (const key of forbiddenShellKeys) {
    assert.equal(key in value, false, `${label} leaked forbidden key: ${key}`);
  }
};

assertNoForbiddenKeys('import status', safeHtmlStatus);
assertNoForbiddenKeys('import report', safeHtmlReport);
assertNoForbiddenKeys('import manifest', safeHtmlManifest);
assertNoForbiddenKeys('editable inventory', candidateInventory);
assertNoForbiddenKeys('draft edit', draft);
assertNoForbiddenKeys('patch plan', patchPlan);
assertNoForbiddenKeys('patch collection apply state', collectionPreview.applyState);
assertNoForbiddenKeys('preview apply state', previewWithScript);
assertNoForbiddenKeys('export result metadata', exportSingle);
assertNoForbiddenKeys('blocked export result', blockedEmpty);
assertNoForbiddenKeys('overlap-blocked export result', blockedOverlapExport);

// UI transition/state invariants modeled by pure states in current no-browser tests
assert.equal(createPatchCollectionState().orderedCandidateIds.length, 0);
assert.equal(resetWorkingPreviewState().applyStatus, 'reset-to-original');
assert.equal(blockedEmpty.exportStatus, 'blocked');
assert.equal(blockedEmpty.exported, false);
assert.equal(validZipManifest.capabilities.includes('local-edited-html-export'), false);
assert.equal(nonHtmlManifest.capabilities.includes('editable-text-candidates'), false);
assert.equal(createDraftEditState({ candidates: [] }).selectedCandidateId, '');



const inlineStyleMap = parseInlineStyle('left: 120px; top: 80px; width: 400px; height: 240px; color: red;');
assert.equal(inlineStyleMap.left, '120px');
assert.equal(extractPixelValue(inlineStyleMap, 'left'), 120);
assert.equal(extractPixelValue(inlineStyleMap, 'top'), 80);
assert.equal(extractPixelValue(inlineStyleMap, 'width'), 400);
assert.equal(extractPixelValue(inlineStyleMap, 'height'), 240);

const inlineGeometryFull = extractInlineGeometry('<img style="left: 120px; top: 80px; width: 400px; height: 240px">');
assert.equal(inlineGeometryFull.overlayReady, true);
assert.equal(createGeometryStatus(inlineGeometryFull), 'ready');

const imageAttributeGeometry = extractImageAttributeGeometry('<img width="400" height="240">');
assert.equal(imageAttributeGeometry.source, 'image-attributes');
assert.equal(imageAttributeGeometry.width, 400);
assert.equal(imageAttributeGeometry.height, 240);
assert.equal(imageAttributeGeometry.overlayReady, false);
assert.equal(createGeometryStatus(imageAttributeGeometry), 'partial');

const ignoredUnitsGeometry = extractInlineGeometry('<div style="left: 50%; top: 2rem; width: calc(100% - 2rem); height: auto"></div>');
assert.equal(ignoredUnitsGeometry.source, 'none');
assert.equal(createGeometryStatus(ignoredUnitsGeometry), 'missing');

const malformedGeometry = extractInlineGeometry('<div style="left: abcpx; top: 10; width: px; height: 20p"></div>');
assert.equal(malformedGeometry.source, 'none');
assert.equal(createGeometryStatus(malformedGeometry), 'missing');

const partialPositionGeometry = extractInlineGeometry('<div style="left: 12px; top: 20px"></div>');
assert.equal(partialPositionGeometry.overlayReady, false);
assert.equal(createGeometryStatus(partialPositionGeometry), 'partial');
assert.equal(formatGeometryText(partialPositionGeometry).includes('partial'), true);

const overlayInventory = createVisualObjectInventory('<img src="a.png" style="left:10px;top:20px;width:30px;height:40px">');
const overlayItems = createVisualOverlayItems(overlayInventory);
assert.equal(overlayItems.length, 1);
assert.equal(overlayItems[0].objectId, 'object-001');
assert.equal(overlayItems[0].style.includes('left:10px'), true);
assert.equal(overlayItems[0].style.includes('width:30px'), true);
const overlaySelection = createVisualOverlaySelectionState(overlayItems, 'object-001');
assert.equal(overlaySelection.selectedObjectId, 'object-001');
assert.equal(formatOverlayStatusText(overlaySelection).includes('Selected: object-001'), true);
const overlayUnknown = createVisualOverlaySelectionState(overlayItems, 'object-999');
assert.equal(overlayUnknown.selectedObjectId, '');
assert.equal(formatOverlayStatusText(createVisualOverlaySelectionState([], 'object-001')).includes('No overlay-ready objects found'), true);


const visualTextObjects = extractVisualObjectsFromHtml('<h1>Title</h1><p>Body</p>');
assert.equal(visualTextObjects.filter((o) => o.type === 'text').length, 2);
assert.equal(visualTextObjects[0].editability, 'editable');
assert.equal(visualTextObjects[0].editableText, 'Title');

const visualImageObjects = extractVisualObjectsFromHtml('<img src="images/pic.png">');
assert.equal(visualImageObjects[0].type, 'image');
assert.equal(visualImageObjects[0].srcPreview, 'images/pic.png');

const excludedScriptText = extractVisualObjectsFromHtml('<script><p>Ignore me</p></script><style><p>Ignore</p></style><template><p>Ignore</p></template><p>Keep</p>');
assert.equal(excludedScriptText.some((o) => o.textPreview === 'Ignore me'), false);
assert.equal(excludedScriptText.some((o) => o.textPreview === 'Keep'), true);

const lockedObjects = extractVisualObjectsFromHtml('<iframe></iframe><object></object><embed></embed><canvas></canvas><svg></svg>');
assert.equal(lockedObjects.every((o) => o.editability === 'locked'), true);

const nestedContainer = extractVisualObjectsFromHtml('<div><p>Nested</p></div>');
const containerObject = nestedContainer.find((o) => o.type === 'container');
assert.equal(containerObject.editability === 'partially-editable' || containerObject.editability === 'locked', true);

const deterministicIds = extractVisualObjectsFromHtml('<h1>A</h1><p>B</p><img src="a.png">');
assert.deepEqual(deterministicIds.map((o) => o.objectId), ['object-001', 'object-002', 'object-003']);

const visualInventory = createVisualObjectInventory('<h1>Hello</h1>');
assert.equal(Object.prototype.hasOwnProperty.call(visualInventory, 'rawHtmlText'), false);
assert.equal(Object.prototype.hasOwnProperty.call(visualInventory, 'htmlText'), false);
assert.equal(Object.prototype.hasOwnProperty.call(visualInventory, 'rawBytes'), false);
assert.equal(Object.prototype.hasOwnProperty.call(visualInventory, 'binary'), false);
assert.equal(Object.prototype.hasOwnProperty.call(visualInventory, 'workingHtml'), false);
assert.equal(formatVisualObjectInventoryText(visualInventory).includes('object-001'), true);
assert.equal(formatVisualObjectInventoryText(visualInventory).includes('geometry overlay-ready'), true);


const spanSource = '<h1>Title</h1><p>Body</p>';
const spanVisual = createVisualObjectInventory(spanSource).objects.filter((o) => o.type === 'text');
assert.equal(Number.isInteger(spanVisual[0].textSourceStart), true);
assert.equal(Number.isInteger(spanVisual[0].textSourceEnd), true);
assert.equal(spanVisual[0].textLength, spanVisual[0].textSourceEnd - spanVisual[0].textSourceStart);

const spanOffsetHtml = '<script>bad()</script><style>.x{}</style><template><p>x</p></template><noscript>x</noscript><p>Keep</p>';
const spanOffsetVisual = createVisualObjectInventory(spanOffsetHtml).objects.find((o) => o.type === 'text' && o.tagName === 'p');
const spanOffsetEditable = createEditableTextInventory(spanOffsetHtml).candidates.find((c) => c.tagName === 'p');
assert.equal(spanOffsetVisual.textSourceStart, spanOffsetEditable.sourceStart);
assert.equal(spanOffsetVisual.textSourceEnd, spanOffsetEditable.sourceEnd);

const dupHtml = '<p>Same</p><p>Same</p>';
const dupVisual = createVisualObjectInventory(dupHtml);
const dupEditable = createEditableTextInventory(dupHtml);
const dupLinks = createVisualTextCandidateLinks(dupVisual, dupEditable);
assert.equal(dupLinks.length, 2);
assert.equal(dupLinks[0].candidateId, 'text-001');
assert.equal(dupLinks[1].candidateId, 'text-002');

const linkedCandidate = findEditableCandidateForVisualObject(dupVisual.objects[0], dupEditable);
assert.equal(linkedCandidate.candidateId, 'text-001');
const nonTextBridge = createVisualTextEditBridgeState({ objectId: 'object-999', type: 'image', editability: 'editable' }, dupEditable);
assert.equal(nonTextBridge.linked, false);
assert.equal(nonTextBridge.available, false);
const linkedBridge = createVisualTextEditBridgeState(dupVisual.objects[0], dupEditable);
assert.equal(linkedBridge.linked, true);
assert.equal(linkedBridge.candidateId, 'text-001');
assert.equal(createVisualTextEditBridgeState(dupVisual.objects[0], dupEditable).candidateId, dupEditable.candidates[0].candidateId);
assert.equal(Object.prototype.hasOwnProperty.call(linkedBridge, 'rawHtmlText'), false);
assert.equal(Object.prototype.hasOwnProperty.call(linkedBridge, 'htmlText'), false);
assert.equal(Object.prototype.hasOwnProperty.call(linkedBridge, 'rawBytes'), false);
assert.equal(Object.prototype.hasOwnProperty.call(linkedBridge, 'binary'), false);
assert.equal(Object.prototype.hasOwnProperty.call(linkedBridge, 'workingHtml'), false);
assert.equal(formatVisualTextEditBridgeText(linkedBridge).includes('text-001'), true);
assert.equal(formatVisualTextEditBridgeText(nonTextBridge).includes('object-999'), true);
assert.equal(getVisualObjectEditableText({ type: 'text', textPreview: 'Headline', editableText: 'Headline full' }), 'Headline full');
assert.equal(getVisualObjectEditableText({ type: 'image', textPreview: 'Ignored' }), '');
const longVisualText = `One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty end.`;
const longVisualObjects = extractVisualObjectsFromHtml(`<p>${longVisualText}</p>`);
assert.equal(longVisualObjects[0].textPreview.length <= 80, true);
assert.equal(getVisualObjectEditableText(longVisualObjects[0]), longVisualText);
assert.notEqual(getVisualObjectEditableText(longVisualObjects[0]), longVisualObjects[0].textPreview);
const selectedStatusEditable = createSelectedTextEditStatus({ selectedObject: dupVisual.objects[0] }, linkedBridge);
assert.equal(selectedStatusEditable.editable, true);
assert.equal(formatSelectedTextEditStatus(selectedStatusEditable).includes('Review or edit the text below'), true);
const selectedStatusLocked = createSelectedTextEditStatus({ selectedObject: { objectId: 'object-200', type: 'image' } }, nonTextBridge);
assert.equal(selectedStatusLocked.editable, false);
assert.equal(formatSelectedTextEditStatus(selectedStatusLocked).includes('not safely text-editable'), true);
assert.equal(Object.prototype.hasOwnProperty.call(selectedStatusEditable, 'rawHtmlText'), false);
assert.equal(Object.prototype.hasOwnProperty.call(selectedStatusEditable, 'htmlText'), false);
assert.equal(Object.prototype.hasOwnProperty.call(selectedStatusEditable, 'rawBytes'), false);
assert.equal(Object.prototype.hasOwnProperty.call(selectedStatusEditable, 'binary'), false);
assert.equal(Object.prototype.hasOwnProperty.call(selectedStatusEditable, 'workingHtml'), false);

const visualForZip = await createVisualObjectInventoryForHtmlFile({ name: 'slides.zip', text: async () => '<h1>X</h1>' });
assert.equal(visualForZip, null);
const visualForUnsupported = await createVisualObjectInventoryForHtmlFile({ name: 'slides.txt', text: async () => '<h1>X</h1>' });
assert.equal(visualForUnsupported, null);

const visualInventoryForHtmlFile = await createVisualObjectInventoryForHtmlFile({ name: 'demo.html', text: async () => '<h1>Deck</h1>' });
assert.equal(formatVisualObjectInventoryText(visualInventoryForHtmlFile).includes('object-001'), true);

const offsetHtml = '<script>const x = 1;</script><h1>Title</h1>';
const offsetObjects = extractVisualObjectsFromHtml(offsetHtml);
const offsetTitle = offsetObjects.find((o) => o.type === 'text' && o.tagName === 'h1');
assert.equal(offsetTitle.sourceStart, offsetHtml.indexOf('<h1>'));
assert.equal(offsetTitle.sourceEnd, offsetHtml.indexOf('<h1>') + 4);

const summaryEditable = createVisualObjectInventory('<h1>Title</h1>');
assert.equal(summaryEditable.summary.editableCount, 1);
assert.equal(summaryEditable.summary.totalCount, 1);
const summaryLocked = createVisualObjectInventory('<iframe></iframe>');
assert.equal(summaryLocked.summary.lockedCount, 1);
const summaryMixed = createVisualObjectInventory('<h1>A</h1><canvas></canvas><p>B</p>');
assert.equal(summaryMixed.summary.totalCount, 3);
assert.equal(summaryMixed.summary.geometryReadyCount, 0);
assert.equal(summaryMixed.summary.geometryPartialCount, 0);
assert.equal(summaryMixed.summary.geometryMissingCount, 3);

const selectedVisualObject = selectVisualObject(summaryMixed, 'object-001');
assert.equal(selectedVisualObject.objectId, 'object-001');
assert.equal(selectVisualObject(summaryMixed, 'object-999'), null);
const safeNullSelection = createVisualObjectSelectionState(null, 'object-001');
assert.equal(safeNullSelection.available, false);
assert.equal(safeNullSelection.selectedObject, null);
const selectionText = formatVisualObjectSelectionText(createVisualObjectSelectionState(summaryMixed, 'object-001'));
assert.equal(selectionText.includes('Selected object: object-001'), true);
assert.equal(selectionText.includes('- type:'), true);
assert.equal(selectionText.includes('- editability:'), true);
assert.equal(selectionText.includes('- confidence:'), true);
assert.equal(selectionText.includes('- geometry:'), true);
assert.equal(selectionText.includes('- reason:'), true);
const optionLabelText = formatVisualObjectOptionLabel({ objectId: 'object-001', type: 'text', textPreview: 'Hello' });
assert.equal(optionLabelText.includes('object-001'), true);
assert.equal(optionLabelText.includes('text'), true);
assert.equal(optionLabelText.includes('Hello'), true);
const optionLabelSrc = formatVisualObjectOptionLabel({ objectId: 'object-002', type: 'image', srcPreview: 'image.png' });
assert.equal(optionLabelSrc.includes('image.png'), true);
const visualSelectionState = createVisualObjectSelectionState(summaryMixed, 'object-001');
assert.equal(Object.prototype.hasOwnProperty.call(visualSelectionState, 'rawHtmlText'), false);
assert.equal(Object.prototype.hasOwnProperty.call(visualSelectionState, 'htmlText'), false);
assert.equal(Object.prototype.hasOwnProperty.call(visualSelectionState, 'rawBytes'), false);
assert.equal(Object.prototype.hasOwnProperty.call(visualSelectionState, 'binary'), false);
assert.equal(Object.prototype.hasOwnProperty.call(visualSelectionState, 'workingHtml'), false);

// --- Fixture-based regression tests ---

// entity-text-deck.html: entity decode roundtrip
{
  const html = readFileSync('tests/fixtures/entity-text-deck.html', 'utf8');
  const inv = createEditableTextInventory(html);
  const h1Candidate = inv.candidates.find((c) => c.tagName === 'h1');
  assert.ok(h1Candidate, 'entity fixture: h1 candidate found');
  // decoded text should contain literal & not &amp;
  assert.equal(h1Candidate.textPreview.includes('AT&T'), true, 'entity fixture: &amp; decoded to &');
  assert.equal(h1Candidate.textPreview.includes('&amp;'), false, 'entity fixture: raw &amp; not present in decoded text');

  // patch roundtrip: apply replacement and verify entity encoding in output
  const draftEdit = createDraftEdit(h1Candidate, 'New & Name');
  const patchPlan = createTextPatchPlan(draftEdit);
  assert.equal(patchPlan.applyStatus, 'planned', 'entity fixture: patchPlan is in planned state');
  const patchResult = applyPlannedTextPatchToWorkingHtml(html, patchPlan, inv);
  assert.equal(patchResult.applied, true, 'entity fixture: patch applied');
  assert.equal(patchResult.workingHtml.includes('New &amp; Name'), true, 'entity fixture: replacement & escaped in output');
  assert.equal(patchResult.workingHtml.includes('AT&amp;T'), false, 'entity fixture: original entity replaced');
}

// long-text-deck.html: textPreview truncated, editableText full length
{
  const html = readFileSync('tests/fixtures/long-text-deck.html', 'utf8');
  const candidates = extractEditableTextCandidates(html);
  const para = candidates.find((c) => c.tagName === 'p');
  assert.ok(para, 'long-text fixture: p candidate found');
  assert.equal(para.textPreview.length <= 81, true, 'long-text fixture: textPreview is capped (≤80 chars + ellipsis)');
  assert.equal(para.textLength > 80, true, 'long-text fixture: full text is longer than 80 chars');

  const visualObjects = extractVisualObjectsFromHtml(html);
  const visualPara = visualObjects.find((o) => o.type === 'text' && o.tagName === 'p');
  assert.ok(visualPara, 'long-text fixture: visual p object found');
  assert.equal(visualPara.textPreview.length <= 81, true, 'long-text fixture: visual textPreview capped');
  assert.equal(getVisualObjectEditableText(visualPara).length > 80, true, 'long-text fixture: editableText full length via getVisualObjectEditableText');
  assert.notEqual(getVisualObjectEditableText(visualPara), visualPara.textPreview, 'long-text fixture: editableText differs from capped preview');
}

// duplicate-text-deck.html: distinct candidateIds and correct span mapping
{
  const html = readFileSync('tests/fixtures/duplicate-text-deck.html', 'utf8');
  const candidates = extractEditableTextCandidates(html);
  const h2s = candidates.filter((c) => c.tagName === 'h2');
  const paras = candidates.filter((c) => c.tagName === 'p');
  assert.equal(h2s.length, 2, 'duplicate fixture: two h2 candidates');
  assert.equal(paras.length, 2, 'duplicate fixture: two p candidates');
  // candidateIds must be distinct even for identical text
  assert.notEqual(h2s[0].candidateId, h2s[1].candidateId, 'duplicate fixture: h2 candidateIds distinct');
  assert.notEqual(paras[0].candidateId, paras[1].candidateId, 'duplicate fixture: p candidateIds distinct');
  // spans must be distinct and ordered (second occurrence is later in source)
  assert.equal(h2s[0].sourceStart < h2s[1].sourceStart, true, 'duplicate fixture: first h2 span before second');
  assert.equal(paras[0].sourceStart < paras[1].sourceStart, true, 'duplicate fixture: first p span before second');
  // each span must reference the correct text in the original HTML
  assert.equal(html.slice(h2s[0].sourceStart, h2s[0].sourceEnd).includes('Q1 Results'), true, 'duplicate fixture: first h2 span contains correct text');
  assert.equal(html.slice(h2s[1].sourceStart, h2s[1].sourceEnd).includes('Q1 Results'), true, 'duplicate fixture: second h2 span contains correct text');

  // visual objects for duplicate text: inside body/html wrapper these are partially-editable
  // (nestedDepth guard in visual-object-model); bridge is not available for partially-editable objects
  const visualInv = createVisualObjectInventory(html);
  const dupVisualH2s = visualInv.objects.filter((o) => o.type === 'text' && o.tagName === 'h2');
  assert.equal(dupVisualH2s.length, 2, 'duplicate fixture: two visual h2 objects');
  assert.equal(dupVisualH2s[0].editability, 'partially-editable', 'duplicate fixture: h2 inside body is partially-editable');
  // spans between visual and editable models align even for partially-editable objects
  const inv = createEditableTextInventory(html);
  assert.equal(dupVisualH2s[0].textSourceStart, h2s[0].sourceStart, 'duplicate fixture: visual h2[0] span start matches editable candidate span start');
  assert.equal(dupVisualH2s[1].textSourceStart, h2s[1].sourceStart, 'duplicate fixture: visual h2[1] span start matches editable candidate span start');

  // inline-HTML bridge: top-level duplicate elements (no outer body/html) are editable and bridge correctly
  const inlineHtml = '<h2>Dup</h2><h2>Dup</h2>';
  const inlineVisual = createVisualObjectInventory(inlineHtml);
  const inlineEditable = createEditableTextInventory(inlineHtml);
  const inlineH2s = inlineVisual.objects.filter((o) => o.type === 'text' && o.tagName === 'h2');
  assert.equal(inlineH2s[0].editability, 'editable', 'duplicate inline: top-level h2 is editable');
  const bridgeLink0 = findEditableCandidateForVisualObject(inlineH2s[0], inlineEditable);
  const bridgeLink1 = findEditableCandidateForVisualObject(inlineH2s[1], inlineEditable);
  assert.ok(bridgeLink0, 'duplicate inline: first h2 bridges to a candidate');
  assert.ok(bridgeLink1, 'duplicate inline: second h2 bridges to a candidate');
  assert.notEqual(bridgeLink0.candidateId, bridgeLink1.candidateId, 'duplicate inline: duplicate visual objects bridge to distinct candidates');
}

// simple-positioned-deck.html: geometry extraction and overlay readiness
{
  const html = readFileSync('tests/fixtures/simple-positioned-deck.html', 'utf8');
  const objects = extractVisualObjectsFromHtml(html);
  const h1 = objects.find((o) => o.type === 'text' && o.tagName === 'h1');
  assert.ok(h1, 'positioned fixture: h1 visual object found');
  assert.equal(h1.geometry.left, 50, 'positioned fixture: h1 left=50');
  assert.equal(h1.geometry.top, 20, 'positioned fixture: h1 top=20');
  assert.equal(h1.geometry.width, 400, 'positioned fixture: h1 width=400');
  assert.equal(h1.geometry.height, 60, 'positioned fixture: h1 height=60');
  assert.equal(h1.geometry.overlayReady, true, 'positioned fixture: h1 geometry is overlay-ready');
  const overlayItems = createVisualOverlayItems(createVisualObjectInventory(html));
  assert.ok(overlayItems.length >= 1, 'positioned fixture: at least one overlay item');
  const overlayH1 = overlayItems.find((item) => item.objectId === h1.objectId);
  assert.ok(overlayH1, 'positioned fixture: h1 has overlay item');
  assert.equal(overlayH1.left, 50, 'positioned fixture: overlay item left=50');
  assert.equal(overlayH1.top, 20, 'positioned fixture: overlay item top=20');
}

// Offset stability: excluded blocks (script/style/template) replaced by spaces preserve span positions
{
  const html = readFileSync('tests/fixtures/risky-html-deck.html', 'utf8');
  const candidates = extractEditableTextCandidates(html);
  const h1 = candidates.find((c) => c.tagName === 'h1');
  assert.ok(h1, 'offset fixture: h1 candidate found in risky deck');
  // The source span must point back into the original HTML correctly
  assert.equal(html.slice(h1.sourceStart, h1.sourceEnd).includes('Safe Headline'), true, 'offset fixture: h1 span points to correct text in original HTML');
}

// Export exact-output verification: patched export contains replacement, not original
{
  const html = '<p>Old text here.</p>';
  const inv = createEditableTextInventory(html);
  const candidate = inv.candidates[0];
  const draftEdit = createDraftEdit(candidate, 'New text here.');
  const patchPlan = createTextPatchPlan(draftEdit);
  const addResult = addOrUpdatePatchInCollection(createPatchCollectionState(), patchPlan);
  assert.equal(addResult.changed, true, 'export fixture: patch was added to collection');
  const exportResult = createEditedHtmlExportFromHtmlText(html, 'test.html', addResult.collection);
  assert.equal(exportResult.blob instanceof Blob, true, 'export fixture: result is a Blob');
  assert.equal(exportResult.exportStatus, 'ready', 'export fixture: exportStatus is ready');
  // Read blob text to verify exact content
  const exportedText = await exportResult.blob.text();
  assert.equal(exportedText.includes('New text here.'), true, 'export fixture: replacement text present in export');
  assert.equal(exportedText.includes('Old text here.'), false, 'export fixture: original text absent from export');
}

// Reset clears patch collection
{
  const html = '<h1>Original</h1>';
  const inv = createEditableTextInventory(html);
  const candidate = inv.candidates[0];
  const draftEdit = createDraftEdit(candidate, 'Replaced');
  const patchPlan = createTextPatchPlan(draftEdit);
  const addResult = addOrUpdatePatchInCollection(createPatchCollectionState(), patchPlan);
  assert.equal(addResult.collection.orderedCandidateIds.length, 1, 'reset fixture: patch added to collection');
  const resetState = resetWorkingPreviewState();
  assert.equal(resetState.collection.orderedCandidateIds.length, 0, 'reset fixture: reset clears patch collection');
  assert.equal(resetState.applyStatus, 'reset-to-original', 'reset fixture: applyStatus is reset-to-original after clear');
}

// Malicious fixture through preview sanitizer: scripts/handlers/remote srcs removed
{
  const html = readFileSync('tests/fixtures/risky-html-deck.html', 'utf8');
  const result = buildSafePreviewResult(html);
  assert.equal(result.previewStatus.status, 'sanitized', 'risky fixture: preview sanitized successfully');
  assert.equal(result.previewStatus.scriptsRemoved > 0, true, 'risky fixture: at least one script removed');
  assert.equal(result.previewStatus.inlineHandlersRemoved > 0, true, 'risky fixture: at least one inline handler removed');
  assert.equal(result.previewStatus.dangerousUrlsNeutralized > 0, true, 'risky fixture: at least one dangerous URL neutralized');
  // srcdoc must not contain script tags or inline handlers
  assert.equal(result.previewDocument.includes('<script'), false, 'risky fixture: no script tags in srcdoc');
  assert.equal(result.previewDocument.includes('onclick='), false, 'risky fixture: no onclick in srcdoc');
  assert.equal(result.previewDocument.includes('onload='), false, 'risky fixture: no onload in srcdoc');
  assert.equal(result.previewDocument.includes('javascript:'), false, 'risky fixture: no javascript: URL in srcdoc');
  assert.equal(result.previewDocument.includes('data:image/svg+xml'), false, 'risky fixture: no svg data URI in srcdoc');
  assert.equal(result.previewDocument.includes('https://tracker.example'), false, 'risky fixture: no remote tracker URL in srcdoc');
  // safe content must be preserved
  assert.equal(result.previewDocument.includes('Safe Headline'), true, 'risky fixture: safe headline preserved in srcdoc');
  assert.equal(result.previewDocument.includes('Safe paragraph text.'), true, 'risky fixture: safe paragraph preserved in srcdoc');
}


// Phase 5A regression coverage
{
  const html = '<h1 style="left:10px;top:20px;width:100px;height:30px">Title</h1>';
  const visualInventory = createVisualObjectInventory(html);
  const editableInventory = createEditableTextInventory(html);
  const object = visualInventory.objects[0];
  const move1 = createVisualMovePatchPlan(object, 10, 0, null);
  const move2 = createVisualMovePatchPlan(object, 10, 0, move1);
  assert.equal(move2.nextGeometry.left, 30);
  let moves = createVisualMovePatchCollectionState();
  moves = addOrUpdateVisualMovePatch(moves, move2).collection;
  const apply = applyCombinedTextAndVisualPatchesToHtml(html, createPatchCollectionState(), moves, editableInventory, visualInventory);
  assert.equal(apply.applyStatus, 'applied-to-working-preview');
  assert.equal(apply.workingHtml, '<h1 style="left:30px;top:20px;width:100px;height:30px">Title</h1>');

  const overlayBefore = createOverlayItemsWithMoveOverrides(visualInventory, createVisualMovePatchCollectionState());
  assert.equal(overlayBefore[0].left, 10);
  const overlayAfter = createOverlayItemsWithMoveOverrides(visualInventory, moves);
  assert.equal(overlayAfter[0].left, 30);
  const overlayAfterReset = createOverlayItemsWithMoveOverrides(visualInventory, createVisualMovePatchCollectionState());
  assert.equal(overlayAfterReset[0].left, 10);

  const badCollection = { patchesByCandidateId: { missing: { patchId: 'patch-missing', candidateId: 'missing', replacementText: 'x' } }, orderedCandidateIds: ['missing'] };
  const blocked = applyCombinedTextAndVisualPatchesToHtml(html, badCollection, createVisualMovePatchCollectionState(), editableInventory, visualInventory);
  assert.equal(blocked.applyStatus, 'partial-or-failed');
  assert.equal(blocked.warnings.includes('candidate-not-found'), true);

  const moveOnlyExport = createEditedHtmlExportFromHtmlText(html, 'deck.html', createPatchCollectionState(), moves);
  assert.equal(moveOnlyExport.exportStatus, 'ready');
  assert.equal(moveOnlyExport.textPatchCount, 0);
  assert.equal(moveOnlyExport.movePatchCount, 1);
  assert.equal((await moveOnlyExport.blob.text()).includes('left:30px'), true);

  const htmlEscape = '<h1 style="left:10px;top:20px;width:100px;height:30px">Old</h1>';
  const escInv = createEditableTextInventory(htmlEscape);
  const escCand = escInv.candidates[0];
  const escPatchCollection = addOrUpdatePatchInCollection(createPatchCollectionState(), createTextPatchPlan(createDraftEdit(escCand, 'A & <B>'))).collection;
  const escMove = addOrUpdateVisualMovePatch(createVisualMovePatchCollectionState(), createVisualMovePatchPlan(createVisualObjectInventory(htmlEscape).objects[0], 10, 0, null)).collection;
  const escCombined = applyCombinedTextAndVisualPatchesToHtml(htmlEscape, escPatchCollection, escMove, escInv, createVisualObjectInventory(htmlEscape));
  assert.equal(escCombined.workingHtml, '<h1 style="left:20px;top:20px;width:100px;height:30px">A &amp; &lt;B&gt;</h1>');
  const escExport = createEditedHtmlExportFromHtmlText(htmlEscape, 'deck.html', escPatchCollection, escMove);
  assert.equal((await escExport.blob.text()), '<h1 style="left:20px;top:20px;width:100px;height:30px">A &amp; &lt;B&gt;</h1>');
  const maliciousPatchCollection = addOrUpdatePatchInCollection(createPatchCollectionState(), createTextPatchPlan(createDraftEdit(escCand, '<script>alert(1)</script>'))).collection;
  const maliciousExport = createEditedHtmlExportFromHtmlText(htmlEscape, 'deck.html', maliciousPatchCollection, escMove);
  assert.equal((await maliciousExport.blob.text()).includes('&lt;script&gt;alert(1)&lt;/script&gt;'), true);

  const lockedLike = { ...object, locked: true };
  assert.equal(createVisualMovePatchPlan(lockedLike, 0, 0, null).applyStatus, 'blocked');
  const partial = { ...object, geometry: { ...object.geometry, width: null, overlayReady: false } };
  assert.equal(createVisualMovePatchPlan(partial, 0, 0, null).applyStatus, 'blocked');
  const imageAttr = { ...object, geometry: { ...object.geometry, source: 'image-attributes', overlayReady: false } };
  assert.equal(createVisualMovePatchPlan(imageAttr, 0, 0, null).applyStatus, 'blocked');

}


// Phase 5B drag regression coverage
{
  const html = '<h1 style="left:10px;top:20px;width:100px;height:30px">Title</h1>';
  const visualInventory = createVisualObjectInventory(html);
  const object = visualInventory.objects[0];
  const dragStart = createVisualDragSession(object, 100, 100, null);
  assert.equal(dragStart.applyStatus, 'planned');
  const dragMove = updateVisualDragSession(dragStart, 111.6, 90.4);
  assert.equal(dragMove.deltaX, 12);
  assert.equal(dragMove.deltaY, -10);
  const dragPatch = createVisualMovePatchFromDrag(object, dragMove);
  assert.equal(dragPatch.nextGeometry.left, 22);
  assert.equal(dragPatch.nextGeometry.top, 10);

  const existing = createVisualMovePatchPlan(object, 10, 0, null);
  const dragWithExisting = createVisualDragSession(object, 0, 0, existing);
  const dragWithExistingMoved = updateVisualDragSession(dragWithExisting, 5, 5);
  const dragWithExistingPatch = createVisualMovePatchFromDrag(object, dragWithExistingMoved);
  assert.equal(dragWithExistingPatch.nextGeometry.left, 25);
  assert.equal(dragWithExistingPatch.nextGeometry.top, 25);

  const moved = applyCombinedTextAndVisualPatchesToHtml(html, createPatchCollectionState(), addOrUpdateVisualMovePatch(createVisualMovePatchCollectionState(), dragPatch).collection, createEditableTextInventory(html), visualInventory);
  assert.equal(moved.workingHtml.includes('width:100px;height:30px'), true);

  const lockedLike = { ...object, locked: true };
  assert.equal(createVisualDragSession(lockedLike, 0, 0, null).applyStatus, 'blocked');
  const partial = { ...object, geometry: { ...object.geometry, width: null, overlayReady: false } };
  assert.equal(createVisualDragSession(partial, 0, 0, null).applyStatus, 'blocked');
  const imageAttr = { ...object, geometry: { ...object.geometry, source: 'image-attributes', overlayReady: false } };
  assert.equal(createVisualDragSession(imageAttr, 0, 0, null).applyStatus, 'blocked');
}

// Phase 5C resize regression coverage
{
  const html = '<h1 style="left:10px;top:20px;width:100px;height:30px">Title</h1>';
  const visualInventory = createVisualObjectInventory(html);
  const object = visualInventory.objects[0];
  const resizeStart = createVisualResizeSession(object, 'bottom-right', 0, 0, null);
  assert.equal(resizeStart.applyStatus, 'planned');
  const resized = updateVisualResizeSession(resizeStart, 30, 15);
  assert.equal(resized.currentGeometry.width, 130);
  assert.equal(resized.currentGeometry.height, 45);
  const patch = createVisualMovePatchFromResize(object, resized);
  assert.equal(patch.nextGeometry.left, 10);
  assert.equal(patch.nextGeometry.top, 20);

  assert.equal(updateVisualResizeSession(createVisualResizeSession(object, 'right', 0, 0, null), 25, 40).currentGeometry.height, 30);
  assert.equal(updateVisualResizeSession(createVisualResizeSession(object, 'bottom', 0, 0, null), 25, 40).currentGeometry.width, 100);
  const clamped = updateVisualResizeSession(createVisualResizeSession(object, 'bottom-right', 0, 0, null), -500, -500);
  assert.equal(clamped.currentGeometry.width, 20);
  assert.equal(clamped.currentGeometry.height, 20);
  const noopPatch = createVisualMovePatchFromResize(object, updateVisualResizeSession(createVisualResizeSession(object, 'bottom-right', 0, 0, null), 0, 0));
  assert.equal(noopPatch.originalGeometry.width, noopPatch.nextGeometry.width);
  assert.equal(noopPatch.originalGeometry.height, noopPatch.nextGeometry.height);

  const lockedLike = { ...object, locked: true };
  assert.equal(createVisualResizeSession(lockedLike, 'bottom-right', 0, 0, null).applyStatus, 'blocked');
  const partial = { ...object, geometry: { ...object.geometry, width: null, overlayReady: false } };
  assert.equal(createVisualResizeSession(partial, 'bottom-right', 0, 0, null).applyStatus, 'blocked');
  const imageAttr = { ...object, geometry: { ...object.geometry, source: 'image-attributes', overlayReady: false } };
  assert.equal(createVisualResizeSession(imageAttr, 'bottom-right', 0, 0, null).applyStatus, 'blocked');

  const move = createVisualMovePatchPlan(object, 10, 10, null);
  const resizeAfterMove = createVisualMovePatchFromResize(object, updateVisualResizeSession(createVisualResizeSession(object, 'bottom-right', 0, 0, move), 5, 5));
  const exportResult = createEditedHtmlExportFromHtmlText(html, 'deck.html', createPatchCollectionState(), addOrUpdateVisualMovePatch(createVisualMovePatchCollectionState(), resizeAfterMove).collection);
  assert.equal((await exportResult.blob.text()), '<h1 style="left:20px;top:30px;width:105px;height:35px">Title</h1>');

  const missingWidth = updateInlineStylePx('<h1 style="left:10px;top:20px;height:30px">Title</h1>', { left: 10, top: 20, width: 100, height: 30 });
  assert.equal(missingWidth.ok, false);
  const malformedHeight = updateInlineStylePx('<h1 style="left:10px;top:20px;width:100px;height:auto">Title</h1>', { left: 10, top: 20, width: 100, height: 30 });
  assert.equal(malformedHeight.ok, false);
}

import { createImageReplacementPatchCollectionState, createImageReplacementPatchPlan, addOrUpdateImageReplacementPatch, createImageReplacementApplyOperations } from '../apps/desktop/src/image-replacement-model.mjs';


// Phase 6A image replacement regression coverage
{
  const col = createImageReplacementPatchCollectionState();
  assert.equal(Array.isArray(col.orderedObjectIds), true);
  const html = '<img alt="x" class="a" style="left:1px;top:2px;width:3px;height:4px" width="3" height="4" data-k="v" src="old.png">';
  const visualImage = { objectId: 'object-100', type: 'image', tagName: 'img', sourceStart: 0, sourceEnd: html.length, locked: false };
  const asset = { status: 'ready', mimeType: 'image/png', size: 10, dataUrl: 'data:image/png;base64,AAAA' };
  const patch = createImageReplacementPatchPlan(visualImage, asset);
  assert.equal(patch.applyStatus, 'planned');
  assert.equal(createImageReplacementPatchPlan({ ...visualImage, type: 'text' }, asset).applyStatus, 'blocked');
  assert.equal(createImageReplacementPatchPlan({ ...visualImage, locked: true }, asset).applyStatus, 'blocked');
  assert.equal(createImageReplacementPatchPlan({ ...visualImage, sourceStart: null }, asset).applyStatus, 'blocked');
  assert.equal(createImageReplacementPatchPlan(visualImage, { ...asset, dataUrl: 'data:image/jpeg;base64,AAAA' }).applyStatus, 'blocked');

  const added = addOrUpdateImageReplacementPatch(col, patch).collection;
  const ops = createImageReplacementApplyOperations(html, added);
  assert.equal(ops.operations.length, 1);

  const fakeFile = (name, type, size=10) => ({ name, type, size, arrayBuffer: async ()=>new Uint8Array([1,2,3]).buffer });
  assert.equal((await createReplacementImageAssetFromFile(fakeFile('a.png','image/png'))).status, 'ready');
  assert.equal((await createReplacementImageAssetFromFile(fakeFile('a.jpg','image/jpeg'))).status, 'ready');
  assert.equal((await createReplacementImageAssetFromFile(fakeFile('a.webp','image/webp'))).status, 'ready');
  assert.equal((await createReplacementImageAssetFromFile(fakeFile('a.avif','image/avif'))).status, 'ready');
  assert.equal((await createReplacementImageAssetFromFile(fakeFile('a.gif','image/gif'))).status, 'ready');
  assert.equal((await createReplacementImageAssetFromFile(fakeFile('a.svg','image/svg+xml'))).status, 'blocked');
  assert.equal((await createReplacementImageAssetFromFile(fakeFile('a.txt','text/plain'))).status, 'blocked');
  assert.equal((await createReplacementImageAssetFromFile(fakeFile('a.png','image/png',11*1024*1024))).status, 'blocked');
}

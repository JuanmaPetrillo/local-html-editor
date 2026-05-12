import { strict as assert } from 'node:assert';
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
  createPatchedSafePreviewResult
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
  validatePatchPlan
} from '../apps/desktop/src/editable-model.mjs';

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
assert.equal(safeHtmlManifest.nextAvailableActions.includes('export'), false);
assert.equal(safeHtmlManifest.nextAvailableActions.includes('edit'), false);

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
assert.equal(formatEditableInventoryText(inventory).includes('Editing is not enabled yet'), true);

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

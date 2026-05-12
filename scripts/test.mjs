import { strict as assert } from 'node:assert';
import {
  createProjectFileModel,
  detectExtension,
  detectSourceKind,
  renderShellState
} from '../apps/desktop/src/app-shell.mjs';
import {
  createImportStatusFromHtmlScan,
  createImportStatusFromZipPreflight,
  detectHtmlExtension,
  detectZipExtension,
  formatImportStatusSummary,
  hasZipSignature,
  importHtmlFileScan,
  importZipFilePreflight,
  scanHtmlRiskMarkers
} from '../apps/desktop/src/importer.mjs';

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
assert.equal(safeHtmlStatus.ok, true);
assert.equal(safeHtmlStatus.sourceKind, 'html');
assert.equal(safeHtmlStatus.severity, 'info');
assert.equal(safeHtmlStatus.warningLabels.length, 0);

const riskyHtmlScanResult = await importHtmlFileScan({
  name: 'risk.htm',
  size: 120,
  type: 'text/html',
  text: async () => '<script></script>https://risk.test'
});
const riskyHtmlStatus = createImportStatusFromHtmlScan(riskyHtmlScanResult);
assert.equal(riskyHtmlStatus.ok, true);
assert.equal(riskyHtmlStatus.severity, 'warning');
assert.equal(riskyHtmlStatus.warningLabels[0], 'risk-markers-detected');
assert.equal(riskyHtmlStatus.checks.scriptTagCount, 1);

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
assert.equal(validZipStatus.ok, true);
assert.equal(validZipStatus.sourceKind, 'zip');
assert.equal(validZipStatus.severity, 'info');
assert.equal(validZipStatus.checks.signatureStatus, 'valid-pk0304');

const invalidZipResult = await importZipFilePreflight({
  name: 'bad.zip',
  size: 5,
  type: '',
  slice: () => ({
    arrayBuffer: async () => new Uint8Array([0x00, 0x11, 0x22, 0x33]).buffer
  })
});
const invalidZipStatus = createImportStatusFromZipPreflight(invalidZipResult);
assert.equal(invalidZipStatus.ok, false);
assert.equal(invalidZipStatus.severity, 'error');
assert.equal(invalidZipStatus.warningLabels[0], 'invalid-zip-signature');

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
assert.equal(nonHtmlStatus.ok, false);

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

const summary = formatImportStatusSummary(validZipStatus);
assert.match(summary, /^Scan summary: ZIP preflight:/);
assert.equal('rawHtmlText' in riskyHtmlStatus, false);
assert.equal('rawBytes' in validZipStatus, false);

assert.equal(hasZipSignature(new Uint8Array([0x50, 0x4b, 0x03, 0x04])), 'valid-pk0304');
assert.equal(hasZipSignature(new Uint8Array([0x50, 0x4b, 0x05, 0x06])), 'valid-pk0506');
assert.equal(hasZipSignature(new Uint8Array([0x50, 0x4b, 0x07, 0x08])), 'valid-pk0708');
assert.equal(hasZipSignature(new Uint8Array([0x12, 0x34, 0x56, 0x78])), null);

console.log('unit tests passed');

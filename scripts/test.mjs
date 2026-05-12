import { strict as assert } from 'node:assert';
import {
  createProjectFileModel,
  detectExtension,
  detectSourceKind,
  formatScanSummary,
  renderShellState
} from '../apps/desktop/src/app-shell.mjs';
import {
  detectHtmlExtension,
  detectZipExtension,
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

let textReadCount = 0;
const htmlScanResult = await importHtmlFileScan({
  name: 'slides.html',
  size: 100,
  type: 'text/html',
  text: async () => {
    textReadCount += 1;
    return '<object></object>http://risk.test';
  }
});
assert.equal(textReadCount, 1);
assert.equal(htmlScanResult.ok, true);
assert.equal(htmlScanResult.scan.embeddedContentTagCount, 1);
assert.equal(htmlScanResult.scan.remoteUrlCount, 1);
assert.equal(
  formatScanSummary(htmlScanResult),
  'Scan summary: scripts=0, inline-handlers=0, remote-urls=1, embedded-tags=1.'
);

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
assert.equal(validZipResult.ok, true);
assert.equal(validZipResult.signatureStatus, 'valid-pk0304');
assert.equal(validZipResult.warningLabels.length, 0);
assert.equal(
  formatScanSummary(validZipResult),
  'Scan summary: zip-preflight ok=true, file=slides.zip, size=2048 bytes, type=application/zip, extension=.zip, source=zip, signature=valid-pk0304, warnings=none.'
);

const invalidZipResult = await importZipFilePreflight({
  name: 'bad.zip',
  size: 5,
  type: '',
  slice: () => ({
    arrayBuffer: async () => new Uint8Array([0x00, 0x11, 0x22, 0x33]).buffer
  })
});
assert.equal(invalidZipResult.ok, false);
assert.equal(invalidZipResult.warningLabels[0], 'invalid-zip-signature');
assert.equal(invalidZipResult.signatureStatus, 'invalid-or-unsupported');

assert.equal(hasZipSignature(new Uint8Array([0x50, 0x4b, 0x03, 0x04])), true);
assert.equal(hasZipSignature(new Uint8Array([0x50, 0x4b, 0x05, 0x06])), false);

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
assert.equal(nonHtmlResult.ok, false);
assert.equal(formatScanSummary(nonHtmlResult), 'Scan summary: skipped (only .html/.htm/.zip local intake is supported).');

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
assert.equal(nonZipResult.ok, false);
assert.equal(nonZipResult.warningLabels[0], 'unsupported-extension');

console.log('unit tests passed');

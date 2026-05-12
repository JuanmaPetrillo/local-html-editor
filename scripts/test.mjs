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
  importHtmlFileScan,
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

const nonHtmlResult = await importHtmlFileScan({
  name: 'slides.zip',
  size: 100,
  type: 'application/zip',
  text: async () => {
    throw new Error('should not read');
  }
});
assert.equal(nonHtmlResult.ok, false);
assert.equal(formatScanSummary(nonHtmlResult), 'Scan summary: skipped (only .html/.htm local intake is supported).');

console.log('unit tests passed');

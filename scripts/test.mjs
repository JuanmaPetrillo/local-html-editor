import { strict as assert } from 'node:assert';
import {
  createProjectFileModel,
  detectExtension,
  detectSourceKind,
  renderShellState
} from '../apps/desktop/src/app-shell.mjs';

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
assert.equal(project.name, 'demo.html');
assert.equal(project.size, 25);
assert.equal(project.type, 'text/html');
assert.match(project.selectedAt, /^\d{4}-\d{2}-\d{2}T/);

const unknown = createProjectFileModel({ name: 'slides.pptx', size: 50, type: '' });
assert.equal(unknown.extension, 'pptx');
assert.equal(unknown.sourceKind, 'unknown');
assert.equal(unknown.type, 'unknown type');

const empty = renderShellState(null);
assert.equal(empty.statusLabel, 'No file selected.');

const selected = renderShellState(project);
assert.equal(selected.statusLabel, 'Selected file: demo.html');
assert.equal(selected.unsupportedLabel, '');

const unsupported = renderShellState(unknown);
assert.equal(
  unsupported.unsupportedLabel,
  'Unsupported extension: .pptx (metadata captured only).'
);

console.log('unit tests passed');

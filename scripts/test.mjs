import { strict as assert } from 'node:assert';
import { renderShellState } from '../apps/desktop/src/app-shell.mjs';

const empty = renderShellState(null);
assert.equal(empty.selectionLabel, 'No file selected.');

const selected = renderShellState({ name: 'demo.html', size: 25, type: 'text/html' });
assert.equal(selected.selectionLabel, 'Selected file: demo.html (25 bytes, text/html)');

const selectedUnknownType = renderShellState({ name: 'deck.zip', size: 512, type: '' });
assert.equal(selectedUnknownType.selectionLabel, 'Selected file: deck.zip (512 bytes, unknown type)');

console.log('unit tests passed');

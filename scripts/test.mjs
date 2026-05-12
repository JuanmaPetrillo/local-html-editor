import { strict as assert } from 'node:assert';
import { renderShellState } from '../apps/desktop/src/app-shell.mjs';
const empty = renderShellState(null);
assert.equal(empty.selectionLabel, 'No file selected.');
const selected = renderShellState({ name: 'demo.html', size: 25 });
assert.equal(selected.selectionLabel, 'Selected file: demo.html (25 bytes)');
console.log('unit tests passed');

import { readFileSync } from 'node:fs';

const html = readFileSync('apps/desktop/index.html', 'utf8');

if (!html.includes('<input id="file-input"')) throw new Error('shell ui missing local file picker');
if (!html.includes('Open HTML/ZIP')) throw new Error('shell ui missing open control');
if (!html.includes('Save</button>')) throw new Error('shell ui missing save placeholder');
if (!html.includes('Export</button>')) throw new Error('shell ui missing export placeholder');
if (!html.includes('id="file-status"')) throw new Error('shell ui missing selected-file status region');
if (!html.includes('id="file-details"')) throw new Error('shell ui missing selected-file metadata region');
if (!html.includes('src="./src/app-shell.mjs"')) throw new Error('shell ui not using canonical app-shell path');

console.log('e2e smoke placeholder passed');

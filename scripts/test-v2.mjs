import { readFileSync } from 'node:fs';
const html = readFileSync('apps/desktop-v2/index.html','utf8');
const js = readFileSync('apps/desktop-v2/src/app-v2.mjs','utf8');
const fixture = readFileSync('tests/fixtures/v2-simple-slide.html','utf8');
for (const token of ['id="canvas"','id="file"','id="delete"','id="export"']) if (!html.includes(token)) throw new Error(`missing ${token}`);
for (const token of ['dblclick','pointerdown','pointermove','className = \'handle\'','deleteButton.addEventListener','addImageButton.addEventListener','exportModelToHtml']) if (!js.includes(token)) throw new Error(`missing ${token}`);
if (!fixture.includes('<h1') || !fixture.includes('<img')) throw new Error('fixture incomplete');
if (js.includes('fetch(') || js.includes('XMLHttpRequest') || js.includes('WebSocket')) throw new Error('network api not allowed');
console.log('v2 checks passed');

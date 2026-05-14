import { readFileSync } from 'node:fs';
import {
  mapHtmlToModel, exportModelToHtml, addTextObject, addImageObject, updateObject,
  createHistory, pushHistory, undo, redo, deleteSelectedObject, selectSlide,
  createProjectPayload, restoreProjectPayload, findSelectedObject, escapeAttribute
} from '../apps/desktop-v2/src/app-v2.mjs';

const html = readFileSync('apps/desktop-v2/index.html', 'utf8');
const js = readFileSync('apps/desktop-v2/src/app-v2.mjs', 'utf8');
const simple = readFileSync('tests/fixtures/v2-simple-slide.html', 'utf8');
const multi = readFileSync('tests/fixtures/v2-multi-slide.html', 'utf8');
const remote = readFileSync('tests/fixtures/v2-remote-image.html', 'utf8');
const attrs = readFileSync('tests/fixtures/v2-attributes.html', 'utf8');

for (const token of ['Open HTML', 'Add Text', 'Add Image', 'Delete', 'Undo', 'Redo', 'Save Project', 'Open Project', 'Export HTML', 'id="slides"', 'id="layers"', 'id="ins-x"']) if (!html.includes(token)) throw new Error(`missing UI token: ${token}`);

let m1 = mapHtmlToModel(simple);
if (!m1.slides.length) throw new Error('single slide import failed');
if (!m1.slides[0].objects.some((o) => o.type === 'text')) throw new Error('text import missing');

let m2 = mapHtmlToModel(multi);
if (m2.slides.length < 2) throw new Error('multi-slide import failed');
selectSlide(m2, m2.slides[1].id);
const t = addTextObject(m2);
if (!t.id || m2.selectedObjectId !== t.id) throw new Error('add text failed');
const img = addImageObject(m2, 'data:image/png;base64,AA==');
if (img.type !== 'image') throw new Error('add image failed');
updateObject(m2, img.id, { x: 111, y: 222, w: 123, h: 124, alt: 'x' });
if (findSelectedObject(m2).id !== img.id) throw new Error('selected object lookup failed');
m2.selectedObjectId = t.id;
deleteSelectedObject(m2);
if (m2.slides[1].objects.some((o) => o.id === t.id)) throw new Error('delete failed');

const hist = createHistory();
pushHistory(hist, m2);
updateObject(m2, img.id, { x: 444 });
m2 = undo(hist, m2);
if (m2.slides[1].objects.find((o) => o.id === img.id).x === 444) throw new Error('undo failed');
m2 = redo(hist, m2);
if (m2.slides[1].objects.find((o) => o.id === img.id).x !== 444) throw new Error('redo failed');

const mr = mapHtmlToModel(remote);
if (mr.slides[0].objects[0].type !== 'locked') throw new Error('remote image not blocked');

const ma = mapHtmlToModel(attrs);
ma.slides[0].objects.push({ id:'ot', type:'text', tagName:'p', text:'A & < B > C', x:1, y:1, w:100, h:20, className:'', dataAttrs:{} });
const exp = exportModelToHtml(ma);
if (!exp.includes('data-slide-id')) throw new Error('export slides missing');
if (!exp.includes('A &amp; &lt; B &gt; C')) throw new Error('text escaping missing');
if (escapeAttribute(`a"b'c&<>`) !== 'a&quot;b&#39;c&amp;&lt;&gt;') throw new Error('attribute escaping missing');
if (exp.includes('https://example.com/remote.png')) throw new Error('remote image leaked');

const project = createProjectPayload(m2);
const restored = restoreProjectPayload(JSON.parse(JSON.stringify(project)));
if (!restored || restored.slides.length !== m2.slides.length) throw new Error('project save/open failed');

for (const bad of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'postMessage', 'contentDocument', 'contentWindow', 'localStorage', 'indexedDB']) if (js.includes(bad)) throw new Error(`forbidden api token: ${bad}`);

console.log('v2 checks passed');

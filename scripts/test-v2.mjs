import { readFileSync } from 'node:fs';
import {
  mapHtmlToModel, exportModelToHtml, addTextObject, addImageObject, updateObject,
  createHistory, pushHistory, undo, redo, deleteSelectedObject, selectSlide,
  createProjectPayload, restoreProjectPayload, findSelectedObject, escapeAttribute,
  normalizeModelForUse, beginInteraction, markInteractionChanged, commitInteraction
} from '../apps/desktop-v2/src/app-v2.mjs';

const html = readFileSync('apps/desktop-v2/index.html', 'utf8');
const js = readFileSync('apps/desktop-v2/src/app-v2.mjs', 'utf8');
const simple = readFileSync('tests/fixtures/v2-simple-slide.html', 'utf8');
const multi = readFileSync('tests/fixtures/v2-multi-slide.html', 'utf8');
const remote = readFileSync('tests/fixtures/v2-remote-image.html', 'utf8');
const attrs = readFileSync('tests/fixtures/v2-attributes.html', 'utf8');
const realFixture = readFileSync('tests/fixtures/user-real-copilot-presentation.html', 'utf8');

for (const token of ['Open HTML', 'Add Text', 'Add Image', 'Delete', 'Undo', 'Redo', 'Save Project', 'Open Project', 'Export HTML', 'id="slides"', 'id="layers"', 'id="ins-x"']) if (!html.includes(token)) throw new Error(`missing UI token: ${token}`);

let m1 = mapHtmlToModel(simple);
if (!m1.slides.length) throw new Error('single slide import failed');
if (!m1.slides[0].objects.some((o) => o.type === 'text')) throw new Error('text import missing');
if (!m1.slides[0].objects.some((o) => o.type === 'image' || o.type === 'locked')) throw new Error('image/locked import missing');

const wrapper = mapHtmlToModel('<div style="position:relative"><h1 style="left:10px;top:10px;width:100px;height:40px;">Title</h1><img src="data:image/png;base64,AA==" style="left:10px;top:60px;width:90px;height:90px;"></div>');
if (!wrapper.slides[0].objects.some((o) => o.type === 'text')) throw new Error('wrapper import lost nested text');
if (!wrapper.slides[0].objects.some((o) => o.type === 'image')) throw new Error('wrapper import lost nested image');

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

const interHist = createHistory();
const startX = m2.slides[1].objects.find((o) => o.id === img.id).x;
let interaction = beginInteraction(m2, img.id);
updateObject(m2, img.id, { x: startX + 50 });
markInteractionChanged(interaction);
interaction = commitInteraction(interHist, interaction);
m2 = undo(interHist, m2);
if (m2.slides[1].objects.find((o) => o.id === img.id).x !== startX) throw new Error('drag interaction undo failed');

const mr = mapHtmlToModel(remote);
if (mr.slides[0].objects[0].type !== 'locked') throw new Error('remote image not blocked');

const unsafeProject = {
  schema: 'lheproj-v2', version: 2, model: {
    slides: [{ id: 's1', name: 'S', width: 'x', height: null, objects: [{ id: '1', type: 'image', src: 'https://example.com/pwn.png', x: 'bad', y: '2', w: 'evil', h: 0, alt: 'a', className: 'c', dataAttrs: { onerror: 'x', 'data-ok': 'y' } }, { id: '2', type: 'text', tagName: 'script', text: 'T', x: 'x', y: 4, w: -1, h: 'x', dataAttrs: { onclick: 'no', 'data-a': 'yes' } }] }], selectedSlideId: 's1'
  }
};
const restoredUnsafe = restoreProjectPayload(unsafeProject);
if (!restoredUnsafe) throw new Error('restore failed');
if (restoredUnsafe.slides[0].objects[0].type !== 'locked') throw new Error('unsafe image source not locked on restore');
if (restoredUnsafe.slides[0].objects[1].tagName !== 'div') throw new Error('unsafe tagName not normalized');
if ('onerror' in (restoredUnsafe.slides[0].objects[0].dataAttrs || {})) throw new Error('unsafe data attrs key not dropped');
if (!Number.isFinite(restoredUnsafe.slides[0].objects[1].x) || restoredUnsafe.slides[0].objects[1].w < 20) throw new Error('malicious geometry not normalized');

const ma = mapHtmlToModel(attrs);
ma.slides[0].objects.push({ id: 'ot', type: 'text', tagName: 'p', text: 'A & < B > C', x: 1, y: 1, w: 100, h: 20, className: '', dataAttrs: {} });
const exp = exportModelToHtml(ma);
if (!exp.includes('data-slide-id')) throw new Error('export slides missing');
if (!exp.includes('A &amp; &lt; B &gt; C')) throw new Error('text escaping missing');
if (escapeAttribute(`a"b'c&<>`) !== 'a&quot;b&#39;c&amp;&lt;&gt;') throw new Error('attribute escaping missing');
if (exp.includes('https://example.com/remote.png')) throw new Error('remote image leaked');

const badDirect = normalizeModelForUse({ slides: [{ objects: [{ type: 'image', src: 'https://evil.com/1.png', x: 'a', y: 'b', w: 'c', h: 'd' }] }] });
const expBadDirect = exportModelToHtml(badDirect);
if (expBadDirect.includes('https://evil.com/1.png')) throw new Error('direct bad model leaked remote url in export');
if (expBadDirect.includes('<script')) throw new Error('unsafe script emitted');


const real = mapHtmlToModel(realFixture);
if (real.slides.length !== 2) throw new Error('real fixture slide count mismatch');
const first = real.slides[0];
const textObjects = first.objects.filter((o) => o.type === 'text');
if (!textObjects.length) throw new Error('real fixture has zero text objects');
if (!textObjects.some((o) => /QBR Review|Revenue \+18%/.test(o.text))) throw new Error('real fixture visible text missing');
if (!first.objects.some((o) => o.type === 'image')) throw new Error('real fixture image/background missing');
if (first.objects.length === 1 && first.objects[0].label === 'Locked: <button>') throw new Error('real fixture collapsed to locked button only');
const editTarget = textObjects[0];
updateObject(real, editTarget.id, { x: editTarget.x + 3 });
editTarget.text = 'Edited real text';
const realExport = exportModelToHtml(real);
if (!realExport.includes('Edited real text')) throw new Error('real fixture edited text not exported');
if (/https:\/\//i.test(realExport)) throw new Error('real export contains remote URLs');

const project = createProjectPayload(m2);
const restored = restoreProjectPayload(JSON.parse(JSON.stringify(project)));
if (!restored || restored.slides.length !== m2.slides.length) throw new Error('project save/open failed');

for (const bad of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'postMessage', 'contentDocument', 'contentWindow', 'localStorage', 'indexedDB']) if (js.includes(bad)) throw new Error(`forbidden api token: ${bad}`);

console.log('v2 checks passed');

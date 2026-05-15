import { readFileSync } from 'node:fs';
import { mapHtmlToModel, exportModelToHtml, createProjectPayload, restoreProjectPayload } from '../apps/desktop-v2/src/app-v2.mjs';

const html = readFileSync('apps/desktop-v2/index.html', 'utf8');
for (const token of ['Open HTML', 'Add Text', 'Add Image', 'Delete', 'Undo', 'Redo', 'Save Project', 'Open Project', 'Export HTML', 'id="slides"', 'id="layers"', 'id="preview-frame"']) {
  if (!html.includes(token)) throw new Error(`missing UI token: ${token}`);
}
if (!html.includes('sandbox="allow-same-origin"')) throw new Error('preview iframe sandbox missing');

const realFixture = readFileSync('tests/fixtures/from_answers_to_tools_v3.html', 'utf8');
const model = mapHtmlToModel(realFixture);
if (model.slides.length !== 2) throw new Error('slide count mismatch');
if (model.slides[0].id !== 'slide-1') throw new Error('slide id parsing failed');

const exported = exportModelToHtml(model);
if (!exported.includes('From Answers to Tools')) throw new Error('title text missing');
for (const cls of ['topnav', 'slides-area', 'slide-inner']) if (!exported.includes(cls)) throw new Error(`expected class missing: ${cls}`);
if (/<script\b/i.test(exported)) throw new Error('script tag was not removed in safe mode');
if (/https:\/\//i.test(exported)) throw new Error('remote URL not blocked/removed');
if (!/<style\b/i.test(exported)) throw new Error('style tags were not preserved');
if (!/class="slide active"/.test(exported)) throw new Error('slide styling collapsed');

const project = createProjectPayload(model);
const restored = restoreProjectPayload(JSON.parse(JSON.stringify(project)));
if (!restored || restored.slides.length !== 2) throw new Error('project save/open failed');

console.log('v2 checks passed');

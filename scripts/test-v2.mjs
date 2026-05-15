import { readFileSync } from 'node:fs';
import {
  mapHtmlToModel, exportModelToHtml, createProjectPayload, restoreProjectPayload,
  editHeadingTextInModel, addTextBlockToSlide, deleteFirstTagInSlide, createHistory, pushHistory, undo, redo
} from '../apps/desktop-v2/src/app-v2.mjs';

const html = readFileSync('apps/desktop-v2/index.html', 'utf8');
for (const token of ['Open HTML', 'Add Text', 'Add Image', 'Delete', 'Undo', 'Redo', 'Save Project', 'Open Project', 'Export HTML', 'id="slides"', 'id="layers"', 'id="preview-frame"']) {
  if (!html.includes(token)) throw new Error(`missing UI token: ${token}`);
}
if (!html.includes('sandbox="allow-same-origin"')) throw new Error('preview iframe sandbox missing');
if (html.includes('allow-scripts')) throw new Error('allow-scripts must not be enabled for preview iframe');

const realFixture = readFileSync('tests/fixtures/from_answers_to_tools_v3.html', 'utf8');
const model = mapHtmlToModel(realFixture);
if (model.slides.length !== 4) throw new Error('slide count mismatch');
if (model.slides[0].id !== 'slide-1') throw new Error('slide id parsing failed');
if (model.slides[0].label !== 'Intro') throw new Error('data-label not preserved');

const exported = exportModelToHtml(model);
if (!exported.includes('From Answers to Tools')) throw new Error('title text missing');
for (const cls of ['topnav', 'slides-area', 'slide-inner', 'botnav', 'progress-track', 'progress-fill', 'slide active', 'prompt-block']) if (!exported.includes(cls)) throw new Error(`expected class missing: ${cls}`);
for (const cssVar of ['--navy', '--blue', '--orange']) if (!exported.includes(cssVar)) throw new Error(`css variable missing: ${cssVar}`);
if (!exported.includes('Move from one-off prompts to repeatable execution systems.')) throw new Error('first slide body text missing');
if (/<script\b/i.test(exported)) throw new Error('script tag was not removed in safe mode');
if (/https:\/\//i.test(exported)) throw new Error('remote URL not blocked/removed');
if (!/<style\b/i.test(exported)) throw new Error('style tags were not preserved');
if (!/class="slide active"/.test(exported) || !/class="slide exit"/.test(exported)) throw new Error('slide state classes collapsed');
if (/on(click|input|change|submit)\s*=/i.test(exported)) throw new Error('inline handlers were not removed');
if (!/data:image\/png;base64,AA==/.test(exported)) throw new Error('safe data image removed');

const edited = editHeadingTextInModel(model, 'Edited deck heading');
const editedHtml = exportModelToHtml(edited);
if (!editedHtml.includes('Edited deck heading')) throw new Error('heading edit missing');
if (!editedHtml.includes('slides-area')) throw new Error('heading edit broke classes');

const withAdded = addTextBlockToSlide(edited, 'Added text block');
const withAddedHtml = exportModelToHtml(withAdded);
if (!withAddedHtml.includes('lhe-added-text')) throw new Error('add text block missing');

const withDelete = deleteFirstTagInSlide(withAdded, 'button');
const withDeleteHtml = exportModelToHtml(withDelete);
if ((withDeleteHtml.match(/<button\b/gi) || []).length >= (withAddedHtml.match(/<button\b/gi) || []).length) throw new Error('delete element did not remove a button');

const restoredUnsafe = restoreProjectPayload({
  schema: 'lheproj-v2',
  version: 2,
  model: { sourceHtml: '<!doctype html><html><body><section class="slide" data-slide-id="s1"><h1 onclick="x()">Hi</h1><script>alert(1)</script><img src="https://evil/x.png"><img src="data:image/png;base64,AA=="></section></body></html>' }
});
if (!restoredUnsafe) throw new Error('restore returned null');
const restoredUnsafeHtml = exportModelToHtml(restoredUnsafe);
if (/<script\b/i.test(restoredUnsafeHtml)) throw new Error('restore did not sanitize script');
if (/https:\/\//i.test(restoredUnsafeHtml)) throw new Error('restore did not sanitize remote url');
if (/onclick\s*=/i.test(restoredUnsafeHtml)) throw new Error('restore did not sanitize inline handler');
if (!/data:image\/png;base64,AA==/.test(restoredUnsafeHtml)) throw new Error('restore dropped safe data image');

const directSanitized = exportModelToHtml({ sourceHtml: '<script>bad()</script><img src="https://evil/x.png"><img src="data:image/png;base64,AA==">' });
if (/<script\b/i.test(directSanitized) || /https:\/\//i.test(directSanitized)) throw new Error('direct export did not sanitize sourceHtml');

let undoModel = mapHtmlToModel(realFixture);
const hist = createHistory();
pushHistory(hist, undoModel);
undoModel = editHeadingTextInModel(undoModel, 'Undo Redo Heading');
undoModel = undo(hist, undoModel);
if (exportModelToHtml(undoModel).includes('Undo Redo Heading')) throw new Error('undo for text edit failed');
undoModel = redo(hist, undoModel);
if (!exportModelToHtml(undoModel).includes('Undo Redo Heading')) throw new Error('redo for text edit failed');

pushHistory(hist, undoModel);
const addedForUndo = addTextBlockToSlide(undoModel, 'Undo add text');
if (!exportModelToHtml(addedForUndo).includes('Undo add text')) throw new Error('setup add for undo failed');
const undoneAdd = undo(hist, addedForUndo);
if (exportModelToHtml(undoneAdd).includes('Undo add text')) throw new Error('undo for add text failed');

const project = createProjectPayload(model);
const restored = restoreProjectPayload(JSON.parse(JSON.stringify(project)));
if (!restored || restored.slides.length !== 4) throw new Error('project save/open failed');
if (!restored.sourceHtml.includes('slides-area')) throw new Error('project sourceHtml lost');

console.log('v2 checks passed');

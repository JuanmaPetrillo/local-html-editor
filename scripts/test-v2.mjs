import { readFileSync } from 'node:fs';
import {
  mapHtmlToModel, exportModelToHtml, createProjectPayload, restoreProjectPayload,
  editHeadingTextInModel, addTextBlockToSlide, deleteFirstTagInSlide, createHistory, pushHistory, undo, redo,
  stripUnsafeHtml
} from '../apps/desktop-v2/src/app-v2.mjs';

const html = readFileSync('apps/desktop-v2/index.html', 'utf8');
for (const token of ['Open HTML', 'Preview', 'Edit', 'Add Text', 'Add Image', 'Delete', 'Undo', 'Redo', 'Save Project', 'Open Project', 'Export HTML', 'id="slides"', 'id="layers"', 'id="live-preview-frame"', 'id="edit-frame"', 'id="edit-stage"', 'id="edit-overlay"', 'id="selection-box"']) {
  if (!html.includes(token)) throw new Error(`missing UI token: ${token}`);
}
const editStageIdx = html.indexOf('id="edit-stage"');
const editOverlayIdx = html.indexOf('id="edit-overlay"');
if (editOverlayIdx < editStageIdx) throw new Error('edit-overlay must be inside edit-stage wrapper');
if (!html.includes('id="edit-frame"') || !html.includes('sandbox="allow-same-origin"')) throw new Error('edit iframe sandbox missing');
if (!html.includes('id="live-preview-frame"') || !html.includes('sandbox="allow-scripts"')) throw new Error('live preview iframe sandbox missing');

const previewSandboxTag = (html.match(/id="live-preview-frame"[^>]*sandbox="([^"]+)"/) || [])[1] || '';
if (!/allow-scripts/.test(previewSandboxTag) || /allow-same-origin/.test(previewSandboxTag)) throw new Error('live-preview-frame sandbox policy invalid');
const editSandboxTag = (html.match(/id="edit-frame"[^>]*sandbox="([^"]+)"/) || [])[1] || '';
if (!/allow-same-origin/.test(editSandboxTag) || /allow-scripts/.test(editSandboxTag)) throw new Error('edit-frame sandbox policy invalid');

const realFixture = readFileSync('tests/fixtures/from_answers_to_tools_v3.html', 'utf8');
const staticFixture = readFileSync('tests/fixtures/v2-simple-slide.html', 'utf8');
const interactiveFixture = readFileSync('tests/fixtures/user-real-copilot-presentation.html', 'utf8');
const remoteFixture = readFileSync('tests/fixtures/v2-remote-image.html', 'utf8');
const noSlideFixture = '<!doctype html><html><head><style>.hero{color:#123}</style><script>alert(1)</script></head><body><main class="hero"><h1>Generic HTML</h1><button onclick="x()">Do</button></main></body></html>';
const cssRemoteFixture = '<!doctype html><html><head><style>.hero{background:url("https://evil.example/x.png")} .safe{background:url("data:image/png;base64,AA==")} @import url("https://evil.example/x.css");</style></head><body><div class="hero" style="background-image:url(https://evil.example/x.png)">x</div></body></html>';

const staticModel = mapHtmlToModel(staticFixture);
if (!exportModelToHtml(staticModel).includes('Quarterly Results')) throw new Error('static fixture lost text');
if (!exportModelToHtml(staticModel).includes('data:image/png;base64,AA==')) throw new Error('static fixture lost data image');

const interactiveModel = mapHtmlToModel(interactiveFixture);
if (!interactiveModel.slides.length) throw new Error('interactive fixture slide detection failed');
if (/<script\b/i.test(exportModelToHtml(interactiveModel))) throw new Error('interactive fixture script not sanitized');

const remoteModel = mapHtmlToModel(remoteFixture);
if (/https:\/\//i.test(exportModelToHtml(remoteModel))) throw new Error('remote fixture still has remote URL');

const noSlideModel = mapHtmlToModel(noSlideFixture);
if (!noSlideModel.slides.length) throw new Error('no-slide fallback failed');
if (!exportModelToHtml(noSlideModel).includes('Generic HTML')) throw new Error('no-slide text missing');

const cssRemoteModel = mapHtmlToModel(cssRemoteFixture);
const cssSanitized = exportModelToHtml(cssRemoteModel);
if (/url\(\s*["']?(https?:|\/\/)/i.test(cssSanitized)) throw new Error('remote css url not sanitized');
if (/@import\s+url\(\s*["']?(https?:|\/\/)/i.test(cssSanitized)) throw new Error('remote css @import not sanitized');
if (!cssSanitized.includes('data:image/png;base64,AA==')) throw new Error('safe data image css url removed');

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
const directCssSanitized = exportModelToHtml({ sourceHtml: '<style>.x{background:url(https://evil.example/x.png)}@import url("https://evil.example/x.css");</style><div style="background-image:url(https://evil.example/x.png)"></div><div style="background-image:url(data:image/png;base64,AA==)"></div>' });
if (/url\(\s*["']?(https?:|\/\/)/i.test(directCssSanitized) || /@import\s+url\(\s*["']?(https?:|\/\/)/i.test(directCssSanitized)) throw new Error('direct export css remote sanitization failed');
if (!directCssSanitized.includes('data:image/png;base64,AA==')) throw new Error('direct export css safe data image removed');

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


const modeFixture = '<!doctype html><html><body><button onclick="window.__x=1">Go</button><script>window.__x=2</script><img src="https://evil.example/x.png"></body></html>';
const modeMapped = mapHtmlToModel(modeFixture);
if (!modeMapped.previewHtml.includes('<script>')) throw new Error('preview html should keep script');
if (!modeMapped.previewHtml.includes('onclick=')) throw new Error('preview html should keep inline handlers');
if (/https:\/\//i.test(modeMapped.previewHtml)) throw new Error('preview html should block remote URLs');
if (modeMapped.sourceHtml.includes('<script>') || modeMapped.sourceHtml.includes('onclick=')) throw new Error('edit html should strip scripts/handlers');


const multi = mapHtmlToModel(readFileSync('tests/fixtures/v2-multi-slide.html', 'utf8'));
multi.selectedSlideId = 'b';
let editedMulti = addTextBlockToSlide(multi, 'Persist me');
if (!exportModelToHtml(editedMulti).includes('Persist me')) throw new Error('slide edit did not persist in model html');
editedMulti.selectedSlideId = 'a';
const saved = createProjectPayload(editedMulti);
const reopened = restoreProjectPayload(saved);
if (!reopened || reopened.selectedSlideId !== 'a') throw new Error('selectedSlideId not persisted through save/open');
if (!exportModelToHtml(reopened).includes('Persist me')) throw new Error('slide edit lost through save/open');

// SVG data URI blocked in sanitizer; safe raster data URIs preserved
const svgHtml = '<img src="data:image/svg+xml;base64,PHN2Zyc..." alt="x"><img src="data:image/png;base64,AA==" alt="y">';
const svgSanitized = stripUnsafeHtml(svgHtml);
if (/data:image\/svg\+xml/i.test(svgSanitized)) throw new Error('SVG data URI not stripped from src');
if (!svgSanitized.includes('data:image/png;base64,AA==')) throw new Error('safe PNG data URI removed by sanitizer');
const svgTextHtml = '<a href="data:text/html,<script>x</script>">x</a>';
if (/data:text\//i.test(stripUnsafeHtml(svgTextHtml))) throw new Error('data:text/ URI not stripped');

// createProjectPayload must not include originalHtml or raw scripts
const payloadJson = JSON.stringify(createProjectPayload(model));
if (payloadJson.includes('"originalHtml"')) throw new Error('project payload must not contain originalHtml key');
if (/<script\b/i.test(payloadJson)) throw new Error('project payload must not contain script tags');
if (payloadJson.includes('"previewHtml"')) throw new Error('project payload must not contain previewHtml key');

// meta http-equiv="refresh" stripped in edit (safe) mode
const metaHtml = '<!doctype html><html><head><meta http-equiv="refresh" content="0;url=https://evil.example/"></head><body><p>text</p></body></html>';
const metaSanitized = stripUnsafeHtml(metaHtml);
if (/http-equiv\s*=\s*["']?refresh/i.test(metaSanitized)) throw new Error('meta refresh not stripped in edit mode');
if (!metaSanitized.includes('text')) throw new Error('meta refresh strip removed non-meta content');

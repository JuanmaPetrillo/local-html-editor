import { readFileSync } from 'node:fs';
import {
  mapHtmlToModel, exportModelToHtml, createProjectPayload, restoreProjectPayload,
  editHeadingTextInModel, addTextBlockToSlide, deleteFirstTagInSlide, createHistory, pushHistory, undo, redo,
  stripUnsafeHtml, buildLivePreviewHtml, addSlideToModel, deleteSlideFromModel, duplicateSlideInModel
} from '../apps/desktop-v2/src/app-v2.mjs';

const html = readFileSync('apps/desktop-v2/index.html', 'utf8');
for (const token of ['Open HTML', 'Preview', 'Edit', 'Add Text', 'Add Image', 'Delete', 'Undo', 'Redo', 'Save Project', 'Open Project', 'Export HTML', 'id="slides"', 'id="layers"', 'id="live-preview-frame"', 'id="edit-frame"', 'id="edit-stage"', 'id="edit-overlay"', 'id="selection-box"', 'id="hover-box"', 'id="ins-replace-img"', 'id="add-slide"', 'id="del-slide"', 'id="dup-slide"', 'id="ins-font-family"', 'id="ins-align"', 'id="bring-front"', 'id="send-back"', 'id="snap-toggle"', 'id="ins-italic"', 'id="ins-underline"', 'id="ins-opacity"', 'id="slide-counter"', 'Keyboard Shortcuts']) {
  if (!html.includes(token)) throw new Error(`missing UI token: ${token}`);
}
const editStageIdx = html.indexOf('id="edit-stage"');
const editOverlayIdx = html.indexOf('id="edit-overlay"');
const hoverBoxIdx = html.indexOf('id="hover-box"');
const selectionBoxIdx = html.indexOf('id="selection-box"');
if (editOverlayIdx < editStageIdx) throw new Error('edit-overlay must be inside edit-stage wrapper');
if (hoverBoxIdx < editStageIdx) throw new Error('hover-box must be inside edit-stage wrapper');
if (selectionBoxIdx < editStageIdx) throw new Error('selection-box must be inside edit-stage wrapper');
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

// Overlay interaction fixture: edit/export sanitization + preview preservation
const overlayFixture = readFileSync('tests/fixtures/v2-overlay-interaction.html', 'utf8');
const overlayModel = mapHtmlToModel(overlayFixture);
if (overlayModel.slides.length !== 2) throw new Error('overlay fixture slide count mismatch');
if (overlayModel.slides[0].id !== 's1') throw new Error('overlay fixture slide 1 id mismatch');
if (overlayModel.slides[0].label !== 'Edit Controls') throw new Error('overlay fixture slide 1 label mismatch');
if (overlayModel.slides[1].id !== 's2') throw new Error('overlay fixture slide 2 id mismatch');
const overlayExported = exportModelToHtml(overlayModel);
// Edit/export strips handlers, scripts, remote URLs
if (/onclick\s*=/i.test(overlayExported)) throw new Error('overlay fixture button onclick not stripped in export');
if (/<script\b/i.test(overlayExported)) throw new Error('overlay fixture script not stripped in export');
if (/https:\/\//i.test(overlayExported)) throw new Error('overlay fixture remote CSS url not stripped in export');
// Safe raster data image preserved
if (!/data:image\/png;base64,AA==/i.test(overlayExported)) throw new Error('overlay fixture safe data image stripped');
// Absolute positioning preserved in export
if (!/position:absolute/i.test(overlayExported)) throw new Error('overlay fixture absolute positioning not preserved');
// Preview html keeps scripts and onclick (preview contract)
if (!(overlayModel.previewHtml.includes('<script') || overlayModel.previewHtml.includes('<script>'))) throw new Error('overlay fixture preview should keep script');
if (!overlayModel.previewHtml.includes('onclick=')) throw new Error('overlay fixture preview should keep onclick handlers');
// Preview blocks remote URLs even while keeping scripts
if (/https:\/\//i.test(overlayModel.previewHtml)) throw new Error('overlay fixture preview should block remote URLs');
// SVG data URI in src attribute should be stripped
if (/data:image\/svg\+xml/i.test(overlayExported)) throw new Error('overlay fixture SVG data URI should be stripped');
// Add text block to overlay fixture slide 1
const overlayWithText = addTextBlockToSlide(overlayModel, 'Overlay added text');
const overlayWithTextHtml = exportModelToHtml(overlayWithText);
if (!overlayWithTextHtml.includes('lhe-added-text')) throw new Error('add text to overlay fixture failed');
if (!/position:absolute/.test(overlayWithTextHtml)) throw new Error('added text block should be absolute-positioned');
if (overlayWithTextHtml.includes('onclick=')) throw new Error('add text should not re-introduce onclick');
// Project round-trip with overlay fixture
const overlayProject = createProjectPayload(overlayModel);
const overlayRestored = restoreProjectPayload(JSON.parse(JSON.stringify(overlayProject)));
if (!overlayRestored || overlayRestored.slides.length !== 2) throw new Error('overlay fixture project round-trip failed');
if (/onclick\s*=/i.test(exportModelToHtml(overlayRestored))) throw new Error('overlay fixture restore re-introduced onclick');
// Button selection: edit mode strips handlers so button activations cannot occur in export
const buttonInEdit = overlayModel.sourceHtml;
if (/onclick\s*=/i.test(buttonInEdit)) throw new Error('button onclick present in edit sourceHtml (should be stripped)');
// isMovableByPosition helper: absolute/fixed = movable, static/relative = locked
const absStyle = { getPropertyValue: (k) => k === 'position' ? 'absolute' : '' };
const relStyle = { getPropertyValue: (k) => k === 'position' ? 'relative' : '' };
const staticStyle = { getPropertyValue: () => '' };
// Test getPx / setPx helpers via exported model (node-safe: no DOM needed for model functions)
// These are DOM helpers; they are tested implicitly via addTextBlockToSlide (which uses absolute inline style)

// buildLivePreviewHtml: edits preserved, scripts injected from originalHtml, remote URLs stripped
const previewSrcHtml = '<!doctype html><html><body><section class="slide"><h1>Edited heading</h1></section></body></html>';
const previewOrigHtml = '<!doctype html><html><body><section class="slide"><h1>Original heading</h1><script>window.__slideInit=1</script><script src="https://evil.example/x.js"></script></body></html>';
const builtPreview = buildLivePreviewHtml(previewSrcHtml, previewOrigHtml);
if (!builtPreview.includes('Edited heading')) throw new Error('buildLivePreviewHtml: edited content not present');
if (builtPreview.includes('Original heading')) throw new Error('buildLivePreviewHtml: stale original text leaked into preview');
if (!builtPreview.includes('window.__slideInit=1')) throw new Error('buildLivePreviewHtml: inline script from original not injected');
if (/https:\/\//i.test(builtPreview)) throw new Error('buildLivePreviewHtml: remote URL not blocked');
// No originalHtml scripts: preview still contains edited content
const previewNoScripts = buildLivePreviewHtml(previewSrcHtml, '');
if (!previewNoScripts.includes('Edited heading')) throw new Error('buildLivePreviewHtml: edited content missing when no original scripts');
if (/<script\b/i.test(previewNoScripts)) throw new Error('buildLivePreviewHtml: script injected when original had none');

// Slide management: add, delete, duplicate
const baseSlidesModel = mapHtmlToModel(readFileSync('tests/fixtures/v2-multi-slide.html', 'utf8'));
const withNewSlide = addSlideToModel(baseSlidesModel);
if (withNewSlide.slides.length !== baseSlidesModel.slides.length + 1) throw new Error('addSlideToModel did not increase slide count');
if (withNewSlide.selectedSlideId === baseSlidesModel.selectedSlideId) throw new Error('addSlideToModel did not switch to new slide');
if (!exportModelToHtml(withNewSlide).includes('New slide')) throw new Error('addSlideToModel new slide content missing');

const withDeleted = deleteSlideFromModel(baseSlidesModel);
if (withDeleted.slides.length !== baseSlidesModel.slides.length - 1) throw new Error('deleteSlideFromModel did not reduce slide count');
if (withDeleted.selectedSlideId === baseSlidesModel.selectedSlideId) throw new Error('deleteSlideFromModel did not switch away from deleted slide');

const singleSlideModel = mapHtmlToModel('<!doctype html><html><body><section class="slide" data-slide-id="s1" data-label="Only"><h1>Only</h1></section></body></html>');
if (deleteSlideFromModel(singleSlideModel).slides.length !== 1) throw new Error('deleteSlideFromModel must not delete the last slide');

const withDuplicate = duplicateSlideInModel(baseSlidesModel);
if (withDuplicate.slides.length !== baseSlidesModel.slides.length + 1) throw new Error('duplicateSlideInModel did not increase slide count');
if (withDuplicate.selectedSlideId === baseSlidesModel.selectedSlideId) throw new Error('duplicateSlideInModel did not switch to duplicated slide');
// Test (Copy) label with a fixture that has data-label attributes
const labelModel = mapHtmlToModel(realFixture);
const withLabelDup = duplicateSlideInModel(labelModel);
if (!withLabelDup.slides.find((s) => s.label.includes('(Copy)'))) throw new Error('duplicateSlideInModel label copy suffix missing');

// Regression: Ctrl+Z/Y keyboard shortcut source markers
const appSrc = readFileSync('apps/desktop-v2/src/app-v2.mjs', 'utf8');
if (!appSrc.includes("e.key === 'z'") || !appSrc.includes('undo(history,')) throw new Error('v2: Ctrl+Z undo shortcut missing from keydown handler');
if (!appSrc.includes("e.key === 'y'") || !appSrc.includes('redo(history,')) throw new Error('v2: Ctrl+Y redo shortcut missing from keydown handler');

// Regression: reversed attribute order (data-slide-id before class)
const reversedAttrHtml = '<!doctype html><html><body><section data-slide-id="s1" class="slide" data-label="Rev"><h1>Reversed</h1></section></body></html>';
const reversedModel = mapHtmlToModel(reversedAttrHtml);
if (reversedModel.slides.length !== 1) throw new Error('getSlideRegexById: failed to find slide with data-slide-id before class attribute');
const reversedExport = exportModelToHtml(reversedModel);
if (!reversedExport.includes('Reversed')) throw new Error('getSlideRegexById: reversed-attr slide content lost on export');

// Regression: project open error messages present in source
if (!appSrc.includes('invalid JSON')) throw new Error('v2: openProjectInput missing invalid JSON error message');
if (!appSrc.includes('Project file format not recognized')) throw new Error('v2: openProjectInput missing unrecognized format error message');

// Regression: revokeObjectURL deferred via setTimeout
if (!appSrc.includes('setTimeout(() => URL.revokeObjectURL')) throw new Error('v2: URL.revokeObjectURL must be deferred via setTimeout');

// Regression: convertToAbsolute warning message
if (!appSrc.includes('Press Ctrl+Z to undo if layout changes unexpectedly')) throw new Error('v2: convertToAbsolute missing layout-change warning');

console.log('v2 full-editor checks passed');

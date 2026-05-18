const hasDom = typeof document !== 'undefined';

export function escapeHtml(s) { return String(s || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
export function escapeAttribute(v) { return String(v || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }

function stripRemoteCssUrls(cssText) {
  return String(cssText || '')
    .replace(/@import\s+url\(\s*(['"]?)(https?:|\/\/)[^)]*\)\s*;?/gi, '')
    .replace(/@import\s+(['"])(https?:|\/\/)[^'"]*\1\s*;?/gi, '')
    .replace(/url\(\s*(['"]?)(https?:|\/\/)[^)]+\)/gi, 'url()');
}

function isBlockedDataUrl(val) {
  const v = val.trim().toLowerCase();
  return /^data:image\/svg\+xml/i.test(v) || /^data:text\//i.test(v);
}

function blockRemoteAttributes(inputHtml) {
  return String(inputHtml || '')
    .replace(/\s(src|href|poster)\s*=\s*"([^"]*)"/gi, (_m, n, val) => ((/^(https?:|\/\/)/i.test(val.trim()) || isBlockedDataUrl(val)) ? '' : ` ${n}="${escapeAttribute(val)}"`))
    .replace(/\s(src|href|poster)\s*=\s*'([^']*)'/gi, (_m, n, val) => ((/^(https?:|\/\/)/i.test(val.trim()) || isBlockedDataUrl(val)) ? '' : ` ${n}='${escapeAttribute(val)}'`));
}

function sanitizeByMode(inputHtml, mode = 'edit') {
  const base = blockRemoteAttributes(
    String(inputHtml || '')
      .replace(/javascript\s*:/gi, '')
      .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_m, css) => `<style>${stripRemoteCssUrls(css)}</style>`)
      .replace(/\sstyle\s*=\s*"([^"]*)"/gi, (_m, styleValue) => ` style="${escapeAttribute(stripRemoteCssUrls(styleValue))}"`)
      .replace(/\sstyle\s*=\s*'([^']*)'/gi, (_m, styleValue) => ` style='${escapeAttribute(stripRemoteCssUrls(styleValue))}'`)
  );
  if (mode === 'preview') return base;
  return base
    .replace(/<meta\b[^>]*http-equiv\s*=\s*(?:"refresh"|'refresh'|refresh)[^>]*>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z0-9_-]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z0-9_-]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z0-9_-]+\s*=\s*[^\s>]+/gi, '');
}

export function stripUnsafeHtml(inputHtml) { return sanitizeByMode(inputHtml, 'edit'); }
export function createLivePreviewHtml(inputHtml) { return sanitizeByMode(inputHtml, 'preview'); }

export function buildLivePreviewHtml(sourceHtml, originalHtml) {
  const base = createLivePreviewHtml(sourceHtml);
  const scripts = [];
  const scriptRe = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
  let m;
  while ((m = scriptRe.exec(String(originalHtml || ''))) !== null) scripts.push(m[0]);
  if (!scripts.length) return base;
  const block = blockRemoteAttributes(scripts.join('\n'));
  return /(<\/body>)/i.test(base) ? base.replace(/(<\/body>)/i, `${block}$1`) : base + block;
}

function collectSlides(doc) {
  const selectors = ['.slide', '[data-slide]', 'section.slide', '.page', '.screen'];
  for (const selector of selectors) {
    const nodes = Array.from(doc.querySelectorAll(selector));
    if (nodes.length) return nodes;
  }
  const sections = Array.from(doc.querySelectorAll('section'));
  if (sections.length > 1) return sections;
  return [doc.body];
}

function replaceFirstTextInTag(html, tagName, replacementText) {
  const re = new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)<\/${tagName}>`, 'i');
  return String(html).replace(re, (_m, attrs) => `<${tagName}${attrs}>${escapeHtml(replacementText)}</${tagName}>`);
}

function getSlideRegexById(slideId) {
  const safeId = slideId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    '<(section|div)\\b(?=[^>]*\\bclass\\s*=\\s*["\'][^"\']*slide[^"\']*["\'])(?=[^>]*\\bdata-slide-id\\s*=\\s*["\']' + safeId + '["\'])[^>]*>[\\s\\S]*?<\\/\\1>',
    'i'
  );
}

export function editHeadingTextInModel(modelInput, newText) {
  const model = { ...modelInput };
  const next = replaceFirstTextInTag(model.sourceHtml, 'h1', newText);
  model.sourceHtml = next === model.sourceHtml ? String(model.sourceHtml).replace(/>([^<>]{1,200})</, '>' + escapeHtml(newText) + '<') : next;
  return mapHtmlToModel(model.sourceHtml);
}

export function addTextBlockToSlide(modelInput, text) {
  const model = { ...modelInput };
  const slideId = model.selectedSlideId || model.slides[0]?.id;
  if (!slideId) return model;
  const target = String(model.sourceHtml).match(getSlideRegexById(slideId))?.[0];
  if (!target) return model;
  const updated = target.replace(/<\/(section|div)>\s*$/i, `<div class="lhe-added-text" style="position:absolute;left:80px;top:80px;width:280px;min-height:30px;">${escapeHtml(text)}</div></$1>`);
  model.sourceHtml = String(model.sourceHtml).replace(getSlideRegexById(slideId), updated);
  return mapHtmlToModel(model.sourceHtml);
}

export function deleteFirstTagInSlide(modelInput, tagName) {
  const model = { ...modelInput };
  const slideId = model.selectedSlideId || model.slides[0]?.id;
  if (!slideId) return model;
  const target = String(model.sourceHtml).match(getSlideRegexById(slideId))?.[0];
  if (!target) return model;
  const updated = target.replace(new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?<\/${tagName}>`, 'i'), '');
  model.sourceHtml = String(model.sourceHtml).replace(getSlideRegexById(slideId), updated);
  return mapHtmlToModel(model.sourceHtml);
}

export function addSlideToModel(modelInput) {
  const model = { ...modelInput };
  const newId = `lhe-slide-${Date.now()}`;
  const newSlide = `<section class="slide" data-slide-id="${newId}" data-label="New Slide" style="position:relative;width:100%;min-height:100%;"><p style="position:absolute;left:80px;top:80px;font-size:24px;">New slide</p></section>`;
  const re = model.selectedSlideId ? getSlideRegexById(model.selectedSlideId) : null;
  const match = re ? String(model.sourceHtml).match(re) : null;
  const newSourceHtml = match
    ? String(model.sourceHtml).replace(re, `${match[0]}\n${newSlide}`)
    : (/(<\/body>)/i.test(String(model.sourceHtml)) ? String(model.sourceHtml).replace(/<\/body>/i, `${newSlide}</body>`) : String(model.sourceHtml) + newSlide);
  const result = mapHtmlToModel(newSourceHtml);
  result.selectedSlideId = newId;
  return result;
}

export function deleteSlideFromModel(modelInput) {
  const model = { ...modelInput };
  if (model.slides.length <= 1) return model;
  const idx = model.slides.findIndex((s) => s.id === model.selectedSlideId);
  if (idx === -1) return model;
  const newSelectedId = model.slides[idx > 0 ? idx - 1 : 1].id;
  const re = getSlideRegexById(model.selectedSlideId);
  const result = mapHtmlToModel(String(model.sourceHtml).replace(re, ''));
  result.selectedSlideId = newSelectedId;
  return result;
}

export function duplicateSlideInModel(modelInput) {
  const model = { ...modelInput };
  const re = getSlideRegexById(model.selectedSlideId);
  const match = String(model.sourceHtml).match(re);
  if (!match) return model;
  const newId = `lhe-slide-${Date.now()}`;
  let dupe = match[0].replace(/data-slide-id\s*=\s*"[^"]*"/i, `data-slide-id="${newId}"`);
  dupe = dupe.replace(/data-slide-id\s*=\s*'[^']*'/i, `data-slide-id='${newId}'`);
  const hasLabel = /data-label\s*=\s*["']/i.test(dupe);
  if (hasLabel) {
    dupe = dupe.replace(/data-label\s*=\s*"([^"]*)"/i, (_m, l) => `data-label="${l} (Copy)"`);
    dupe = dupe.replace(/data-label\s*=\s*'([^']*)'/i, (_m, l) => `data-label='${l} (Copy)'`);
  } else {
    const existingLabel = model.slides.find((s) => s.id === model.selectedSlideId)?.label || 'Slide';
    dupe = dupe.replace(/(<(section|div)\b[^>]*class\s*=\s*["'][^"']*slide[^"']*["'][^>]*data-slide-id\s*=\s*["'][^"']*["'])([^>]*>)/i, `$1 data-label="${existingLabel} (Copy)"$3`);
  }
  const result = mapHtmlToModel(String(model.sourceHtml).replace(re, `${match[0]}\n${dupe}`));
  result.selectedSlideId = newId;
  return result;
}

function getPx(style, key) { const v = style.getPropertyValue(key) || ''; const n = Number.parseFloat(v); return Number.isFinite(n) ? n : 0; }
function setPx(style, key, value) { style.setProperty(key, `${Math.round(value)}px`); }
function getPointerDistance(start, end) { return Math.hypot(end.x - start.x, end.y - start.y); }
function toStageDelta(delta) { return delta / (stageScale || 1); }
function isMovableByPosition(el) {
  const pos = (el.style.position || '').toLowerCase();
  return pos === 'absolute' || pos === 'fixed';
}

export function mapHtmlToModel(htmlText) {
  const originalHtml = String(htmlText || '');
  const sanitizedHtml = stripUnsafeHtml(originalHtml);
  const previewHtml = createLivePreviewHtml(originalHtml);
  if (!hasDom) {
    const slides = [];
    for (const m of sanitizedHtml.matchAll(/<(section|div)\b[^>]*class\s*=\s*["'][^"']*["'][^>]*>/gi)) {
      const tag = m[0];
      const cls = (tag.match(/class\s*=\s*"([^"]+)"/i) || tag.match(/class\s*=\s*'([^']+)'/i) || [])[1] || '';
      if (!/(^|\s)slide(\s|$)/i.test(cls)) continue;
      const id = (tag.match(/data-slide-id\s*=\s*["']([^"']+)["']/i) || [])[1] || `s${slides.length + 1}`;
      const label = (tag.match(/data-label\s*=\s*["']([^"']+)["']/i) || [])[1] || `Slide ${slides.length + 1}`;
      slides.push({ id, name: label, label });
    }
    return { version: 2, originalHtml, sourceHtml: sanitizedHtml, previewHtml, slides: slides.length ? slides : [{ id: 's1', name: 'Slide 1', label: 'Slide 1' }], selectedSlideId: slides[0]?.id || 's1', mode: 'edit' };
  }
  const doc = new DOMParser().parseFromString(sanitizedHtml, 'text/html');
  const slides = collectSlides(doc).map((el, i) => ({ id: el.getAttribute('data-slide-id') || `s${i + 1}`, name: el.getAttribute('data-label') || `Slide ${i + 1}`, label: el.getAttribute('data-label') || `Slide ${i + 1}` }));
  return { version: 2, originalHtml, sourceHtml: sanitizedHtml, previewHtml, slides, selectedSlideId: slides[0]?.id || 's1', mode: 'edit' };
}

export function exportModelToHtml(modelInput) { return stripUnsafeHtml(String(modelInput?.sourceHtml || '')); }
export function createProjectPayload(model) { return { schema: 'lheproj-v2', version: 2, model: { sourceHtml: stripUnsafeHtml(model.sourceHtml), slides: model.slides, selectedSlideId: model.selectedSlideId, mode: model.mode === 'preview' ? 'preview' : 'edit', masterSlideTemplateHtml: String(model.masterSlideTemplateHtml || ''), masterPreserveText: model.masterPreserveText !== false } }; }
export function restoreProjectPayload(payload) {
  if (!payload || payload.schema !== 'lheproj-v2' || payload.version !== 2) return null;
  const restored = mapHtmlToModel(String(payload.model?.sourceHtml || ''));
  restored.mode = payload.model?.mode === 'preview' ? 'preview' : 'edit';
  restored.selectedSlideId = payload.model?.selectedSlideId || restored.selectedSlideId;
  restored.masterSlideTemplateHtml = String(payload.model?.masterSlideTemplateHtml || '');
  restored.masterPreserveText = payload.model?.masterPreserveText !== false;
  return restored;
}

export function createHistory() { return { undo: [], redo: [] }; }
export function snapshot(model) { return JSON.parse(JSON.stringify(model)); }
export function pushHistory(history, model) { history.undo.push(snapshot(model)); if (history.undo.length > 100) history.undo.shift(); history.redo = []; }
export function undo(history, model) { if (!history.undo.length) return model; history.redo.push(snapshot(model)); return history.undo.pop(); }
export function redo(history, model) { if (!history.redo.length) return model; history.undo.push(snapshot(model)); return history.redo.pop(); }
export function canUndo(history) { return history.undo.length > 0; }
export function canRedo(history) { return history.redo.length > 0; }

if (hasDom) {
  const q = (s) => document.querySelector(s);
  const editFrame = q('#edit-frame');
  const liveFrame = q('#live-preview-frame');
  const status = q('#status');
  const modeEl = q('#mode-label');
  const selectedState = q('#selected-state');
  const previewBtn = q('#mode-preview');
  const editBtn = q('#mode-edit');
  const slidesList = q('#slides');
  const layersList = q('#layers');
  const fileInput = q('#file');
  const openProjectInput = q('#open-project-file');
  const addTextBtn = q('#add-text'); const addImageBtn = q('#add-image'); const delBtn = q('#delete');
  const undoBtn = q('#undo'); const redoBtn = q('#redo'); const saveBtn = q('#save-project'); const openProjectBtn = q('#open-project'); const exportBtn = q('#export');
  const insType = q('#ins-type'); const insText = q('#ins-text'); const insAlt = q('#ins-alt'); const insReplaceImgBtn = q('#ins-replace-img');
  const insX = q('#ins-x'); const insY = q('#ins-y'); const insW = q('#ins-w'); const insH = q('#ins-h');
  const insColor = q('#ins-color'); const insBg = q('#ins-bg'); const insFont = q('#ins-font'); const insBold = q('#ins-bold');
  const insFontFamily = q('#ins-font-family');
  const insAlign = q('#ins-align');
  const insMasterSlot = q('#ins-master-slot');
  const addSlideBtn = q('#add-slide');
  const delSlideBtn = q('#del-slide');
  const dupSlideBtn = q('#dup-slide');
  const setMasterBtn = q('#set-master');
  const applyMasterBtn = q('#apply-master');
  const masterPreserveTextToggle = q('#master-preserve-text');
  const bringFrontBtn = q('#bring-front');
  const sendBackBtn = q('#send-back');
  const snapToggle = q('#snap-toggle');
  const alignLeftBtn = q('#align-left');
  const alignTopBtn = q('#align-top');
  const distributeHBtn = q('#distribute-h');
  const distributeVBtn = q('#distribute-v');
  const groupSelectionBtn = q('#group-selection');
  const ungroupSelectionBtn = q('#ungroup-selection');
  const insItalic = q('#ins-italic');
  const insUnderline = q('#ins-underline');
  const insOpacity = q('#ins-opacity');
  const insRotate = q('#ins-rotate');
  const editStage = q('#edit-stage');
  const editOverlay = q('#edit-overlay');
  const hoverBox = q('#hover-box');
  const selectionBox = q('#selection-box');
  const marqueeBox = q('#marquee-box');
  const stageWrap = editStage?.parentElement || null;
  let stageScale = 1;
  const inspectorScroll = q('.inspector-scroll');
  const slideCounter = q('#slide-counter');
  const brandMark = q('.brand-mark');

  const HANDLE_DIRS = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];
  const HANDLE_CURSORS = { nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize', w: 'ew-resize', e: 'ew-resize', sw: 'nesw-resize', s: 'ns-resize', se: 'nwse-resize' };
  const HANDLE_PX = 10;
  const handles = {};

  const selectedOutlineLayer = document.createElement('div');
  selectedOutlineLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2;';
  editStage.appendChild(selectedOutlineLayer);

  for (const dir of HANDLE_DIRS) {
    const h = document.createElement('div');
    h.style.cssText = `position:absolute;width:${HANDLE_PX}px;height:${HANDLE_PX}px;background:#2563eb;border:1px solid #fff;box-sizing:border-box;cursor:${HANDLE_CURSORS[dir]};display:none;z-index:4;`;
    editStage.appendChild(h);
    handles[dir] = h;
  }

  const TAG_NAMES = { H1: 'Heading 1', H2: 'Heading 2', H3: 'Heading 3', P: 'Paragraph', DIV: 'Box', SPAN: 'Text span', IMG: 'Image', BUTTON: 'Button', LI: 'List item', A: 'Link', LABEL: 'Label', SECTION: 'Section', MAIN: 'Box', ARTICLE: 'Box' };

  let model = mapHtmlToModel('');
  let sourceFileName = '';
  const history = createHistory();
  let isDirty = false;
  const DRAFT_KEY = 'lhe-draft-v2';
  let draftSaveTimer = null;
  function scheduleDraftSave() {
    clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(createProjectPayload({ ...model, masterSlideTemplateHtml, masterPreserveText }))); } catch {}
    }, 3000);
  }
  const markDirty = () => { if (!isDirty) { isDirty = true; brandMark?.classList.add('has-unsaved'); document.title = '● HTML Presentation Editor — Tenaris'; } scheduleDraftSave(); };
  const markClean = () => { isDirty = false; brandMark?.classList.remove('has-unsaved'); document.title = 'HTML Presentation Editor — Tenaris'; localStorage.removeItem(DRAFT_KEY); };
  let selectedEl = null;
  let activeEditingEl = null;
  let selectionId = '';
  let selectedIds = new Set();
  let resizeState = null;
  let clipboard = null;
  let snapEnabled = false;
  let masterSlideTemplateHtml = String(model.masterSlideTemplateHtml || '');
  let masterPreserveText = model.masterPreserveText !== false;
  const snapCoord = (v) => snapEnabled ? Math.round(v / 10) * 10 : Math.round(v);

  const setStatus = (t) => {
    status.textContent = t;
    const lo = t.toLowerCase();
    const cls = /export|opened|saved|replaced|pasted|copied|enabled|disabled|snap/.test(lo) ? 'ok'
      : /cannot|blocked|not recognized|could not|only|unsupported|invalid|failed/.test(lo) ? 'error'
      : /stripped|converted|scripts removed|snap/.test(lo) ? 'warn'
      : 'info';
    status.className = cls;
  };

  function refreshButtons() {
    undoBtn.disabled = !canUndo(history);
    redoBtn.disabled = !canRedo(history);
    const editable = model.mode === 'edit';
    delBtn.disabled = !selectedEl || !editable;
    addTextBtn.disabled = !editable;
    addImageBtn.disabled = !editable;
    addSlideBtn.disabled = !editable;
    delSlideBtn.disabled = !editable || model.slides.length <= 1;
    dupSlideBtn.disabled = !editable || !model.selectedSlideId;
    setMasterBtn.disabled = !editable || !model.selectedSlideId;
    applyMasterBtn.disabled = !editable || !masterSlideTemplateHtml;
    bringFrontBtn.disabled = !selectedEl || !editable;
    sendBackBtn.disabled = !selectedEl || !editable;
    const canArrange = editable && selectedIds.size > 1;
    alignLeftBtn.disabled = !canArrange;
    alignTopBtn.disabled = !canArrange;
    distributeHBtn.disabled = !canArrange;
    distributeVBtn.disabled = !canArrange;
    groupSelectionBtn.disabled = !canArrange;
    ungroupSelectionBtn.disabled = !selectedEl || selectedEl.tagName !== 'DIV' || !selectedEl.classList.contains('lhe-group') || !editable;
    previewBtn.classList.toggle('active', model.mode === 'preview');
    editBtn.classList.toggle('active', model.mode === 'edit');
  }

  function describeSelected(el) {
    if (!el) {
      selectedState.textContent = 'No element selected';
      inspectorScroll.classList.add('ins-empty');
      inspectorScroll.classList.remove('ins-flow-warning-visible');
      return;
    }
    inspectorScroll.classList.remove('ins-empty');
    const typeName = TAG_NAMES[el.tagName] || el.tagName.toLowerCase();
    const editable = ['H1', 'H2', 'H3', 'P', 'SPAN', 'BUTTON', 'DIV'].includes(el.tagName);
    selectedState.textContent = editable
      ? `${typeName} selected · Double-click to edit`
      : `${typeName} selected`;
  }

  function updateSlideVisibility(doc) {
    const slides = collectSlides(doc);
    if (slides.length <= 1 || slides[0] === doc.body) {
      if (doc.body) doc.body.style.display = '';
      return;
    }
    const hasSelected = slides.some((slide, i) => (slide.getAttribute('data-slide-id') || `s${i + 1}`) === model.selectedSlideId);
    const selectedId = hasSelected ? model.selectedSlideId : (slides[0].getAttribute('data-slide-id') || 's1');
    slides.forEach((slide, i) => {
      const id = slide.getAttribute('data-slide-id') || `s${i + 1}`;
      slide.style.display = id === selectedId ? '' : 'none';
    });
  }

  function setFrameHtml() {
    editStage.style.display = model.mode === 'edit' ? 'block' : 'none';
    liveFrame.style.display = model.mode === 'preview' ? 'block' : 'none';
    if (model.mode === 'preview') {
      liveFrame.srcdoc = buildLivePreviewHtml(model.sourceHtml, model.originalHtml);
      liveFrame.onload = () => { liveFrame.focus(); };
      modeEl.textContent = 'Preview mode — your presentation plays as designed, including animations and interactions. Switch to Edit to make changes.';
      return;
    }
    editFrame.srcdoc = model.sourceHtml;
    modeEl.textContent = 'Edit mode — click any element to select it, double-click text to edit inline. Use the Inspector on the right to change colors, fonts, and size.';
    editFrame.onload = () => {
      const doc = editFrame.contentDocument;
      if (!doc) return;
      updateSlideVisibility(doc);
      wireOverlayInteractions();
      applySelectionMarker();
      refreshLayers();
    };
  }

  function commitFrameToModel() {
    if (model.mode !== 'edit') return;
    const doc = editFrame.contentDocument;
    if (!doc) return;
    if (activeEditingEl) finishTextEdit(true);
    doc.querySelectorAll('[data-lhe-selected]').forEach((x) => x.removeAttribute('data-lhe-selected'));
    doc.querySelectorAll('[data-lhe-id]').forEach((x) => {
      if (!x.getAttribute('data-lhe-id')) x.removeAttribute('data-lhe-id');
    });
    model.sourceHtml = stripUnsafeHtml(`<!doctype html>\n${doc.documentElement.outerHTML}`);
    model = { ...mapHtmlToModel(model.sourceHtml), originalHtml: model.originalHtml, previewHtml: model.previewHtml, mode: model.mode, selectedSlideId: model.selectedSlideId };
  }

  function loadInspector(el) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const cr = editOverlay.getBoundingClientRect();
    insType.textContent = TAG_NAMES[el.tagName] || el.tagName.toLowerCase();
    insText.value = el.tagName === 'IMG' ? '' : (el.textContent || '');
    insAlt.value = ['IMG', 'BUTTON'].includes(el.tagName) ? (el.getAttribute('alt') || '') : '';
    insReplaceImgBtn.style.display = el.tagName === 'IMG' ? '' : 'none';
    insMasterSlot.value = el.getAttribute('data-master-slot') || '';
    const movable = isMovableByPosition(el);
    insX.value = String(movable ? getPx(el.style, 'left') : Math.round(r.left - cr.left));
    insY.value = String(movable ? getPx(el.style, 'top') : Math.round(r.top - cr.top));
    insW.value = String(getPx(el.style, 'width') || Math.round(r.width));
    insH.value = String(getPx(el.style, 'height') || Math.round(r.height));
    insColor.value = rgbToHex(cs.color);
    insBg.value = rgbToHex(cs.backgroundColor);
    insFont.value = String(Math.round(parseFloat(cs.fontSize) || 16));
    insBold.checked = (cs.fontWeight === 'bold' || Number.parseInt(cs.fontWeight, 10) >= 600);
    insItalic.checked = cs.fontStyle === 'italic';
    insUnderline.checked = (cs.textDecoration || '').includes('underline');
    insOpacity.value = String(Math.round((parseFloat(cs.opacity || '1')) * 100));
    const rot = (el.style.transform || '').match(/rotate\(([-0-9.]+)deg\)/i);
    insRotate.value = rot ? String(Math.round(Number(rot[1]) || 0)) : '0';
    const inlineFontFamily = el.style.fontFamily || '';
    insFontFamily.value = Array.from(insFontFamily.options).some((o) => o.value === inlineFontFamily) ? inlineFontFamily : '';
    insAlign.value = el.style.textAlign || cs.textAlign || 'left';
    inspectorScroll.classList.toggle('ins-flow-warning-visible', !isMovableByPosition(el));
  }

  function rgbToHex(rgb) {
    const m = String(rgb || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!m) return '#000000';
    return `#${[1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join('')}`;
  }

  function refreshLayers() {
    layersList.textContent = '';
    const doc = editFrame.contentDocument;
    if (!doc) return;
    const active = collectSlides(doc).find((s, i) => (s.getAttribute('data-slide-id') || `s${i + 1}`) === model.selectedSlideId);
    if (!active) return;
    Array.from(active.querySelectorAll('h1,h2,h3,p,button,div,span,img,li,a,label')).slice(0, 120).forEach((el) => {
      const b = document.createElement('button');
      const humanTag = TAG_NAMES[el.tagName] || el.tagName.toLowerCase();
      const preview = el.tagName === 'IMG'
        ? `${humanTag}: ${(el.getAttribute('alt') || '').slice(0, 22) || '(image)'}`
        : `${humanTag}: ${(el.textContent || '').trim().slice(0, 28) || '(empty)'}`;
      b.textContent = preview;
      b.title = preview;
      b.onclick = () => selectElement(el);
      layersList.appendChild(b);
    });
  }


  function renderSelectedOutlines() {
    selectedOutlineLayer.textContent = '';
    const doc = editFrame.contentDocument;
    if (!doc || selectedIds.size <= 1) return;
    selectedIds.forEach((id) => {
      if (id === selectionId) return;
      const el = doc.querySelector(`[data-lhe-id="${id}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const box = document.createElement('div');
      box.style.cssText = `position:absolute;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;border:1px solid rgba(37,99,235,.85);border-radius:2px;box-sizing:border-box;`;
      selectedOutlineLayer.appendChild(box);
    });
  }

  function applySelectionMarker() {
    const doc = editFrame.contentDocument;
    if (!doc) return;
    doc.querySelectorAll('[data-lhe-selected]').forEach((x) => x.removeAttribute('data-lhe-selected'));
    if (!selectionId) { clearSelectionBox(); renderSelectedOutlines(); return; }
    const el = doc.querySelector(`[data-lhe-id="${selectionId}"]`);
    if (!el) {
      clearSelectionState();
      return;
    }
    selectedEl = el;
    updateSelectionBox(el);
    loadInspector(selectedEl);
    describeSelected(selectedEl);
    renderSelectedOutlines();
  }

  function selectElement(el, additive = false) {
    if (!el) return;
    if (!el.getAttribute('data-lhe-id')) el.setAttribute('data-lhe-id', `lhe-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`);
    const id = el.getAttribute('data-lhe-id') || '';
    if (!additive) selectedIds.clear();
    if (id) selectedIds.add(id);
    selectionId = id;
    selectedEl = el;
    applySelectionMarker();
    refreshButtons();
  }


  function getSelectedElements(doc) {
    if (!doc || !selectedIds.size) return selectedEl ? [selectedEl] : [];
    const out = [];
    selectedIds.forEach((id) => {
      const el = doc.querySelector(`[data-lhe-id="${id}"]`);
      if (el) out.push(el);
    });
    return out.length ? out : (selectedEl ? [selectedEl] : []);
  }


  function clearSelectionState() {
    selectedEl = null;
    selectionId = '';
    selectedIds.clear();
    clearSelectionBox();
    renderSelectedOutlines();
    describeSelected(null);
    refreshButtons();
  }

  function finishTextEdit(commit) {
    if (!activeEditingEl) return;
    if (!commit && activeEditingEl.dataset.lheOriginalText !== undefined) activeEditingEl.textContent = activeEditingEl.dataset.lheOriginalText;
    activeEditingEl.removeAttribute('contenteditable');
    delete activeEditingEl.dataset.lheOriginalText;
    activeEditingEl = null;
    editOverlay.style.pointerEvents = 'all';
    if (commit) { pushHistory(history, model); markDirty(); }
    commitFrameToModel();
    render();
  }

  function enterTextEditMode(el) {
    if (!el || !['H1', 'H2', 'H3', 'P', 'SPAN', 'BUTTON', 'DIV', 'LI', 'A', 'LABEL'].includes(el.tagName)) return;
    activeEditingEl = el;
    el.dataset.lheOriginalText = el.textContent || '';
    el.setAttribute('contenteditable', 'true');
    editOverlay.style.pointerEvents = 'none';
    hideResizeHandles();
    el.focus();
    describeSelected(el);
    setStatus('Text editing. Press Enter or click away to commit. Escape to cancel.');
  }

  function getIframeElementAt(clientX, clientY) {
    const doc = editFrame.contentDocument;
    if (!doc) return null;
    const r = editOverlay.getBoundingClientRect();
    const el = doc.elementFromPoint(toStageDelta(clientX - r.left), toStageDelta(clientY - r.top));
    if (!el || el === doc.body || el === doc.documentElement) return null;
    return el;
  }

  function updateSelectionBox(el) {
    if (!el) { clearSelectionBox(); return; }
    const r = el.getBoundingClientRect();
    selectionBox.style.left = r.left + 'px';
    selectionBox.style.top = r.top + 'px';
    selectionBox.style.width = r.width + 'px';
    selectionBox.style.height = r.height + 'px';
    selectionBox.style.border = '2px solid var(--c-blue)';
    selectionBox.style.display = 'block';
    updateResizeHandles(el);
  }

  function clearSelectionBox() {
    selectionBox.style.display = 'none';
    marqueeBox.style.display = 'none';
    selectedOutlineLayer.textContent = '';
    hoverBox.style.display = 'none';
    hideResizeHandles();
  }

  function showMultiSelectionBox(els) {
    if (!els.length) { clearSelectionBox(); return; }
    const rects = els.map(el => el.getBoundingClientRect());
    const left = Math.min(...rects.map(r => r.left));
    const top = Math.min(...rects.map(r => r.top));
    const right = Math.max(...rects.map(r => r.right));
    const bottom = Math.max(...rects.map(r => r.bottom));
    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
    selectionBox.style.width = (right - left) + 'px';
    selectionBox.style.height = (bottom - top) + 'px';
    selectionBox.style.border = '2px dashed var(--c-blue)';
    selectionBox.style.display = 'block';
    hideResizeHandles();
  }

  function updateResizeHandles(el) {
    if (!el) { hideResizeHandles(); return; }
    const r = el.getBoundingClientRect();
    const hs = HANDLE_PX / 2;
    const pts = {
      nw: [r.left, r.top], n: [r.left + r.width / 2, r.top], ne: [r.right, r.top],
      w: [r.left, r.top + r.height / 2], e: [r.right, r.top + r.height / 2],
      sw: [r.left, r.bottom], s: [r.left + r.width / 2, r.bottom], se: [r.right, r.bottom],
    };
    for (const dir of HANDLE_DIRS) {
      const [x, y] = pts[dir];
      handles[dir].style.left = (x - hs) + 'px';
      handles[dir].style.top = (y - hs) + 'px';
      handles[dir].style.display = 'block';
    }
  }

  function hideResizeHandles() {
    for (const h of Object.values(handles)) h.style.display = 'none';
  }

  for (const dir of HANDLE_DIRS) {
    handles[dir].onpointerdown = (e) => {
      e.stopPropagation();
      if (!selectedEl) return;
      if (!isMovableByPosition(selectedEl)) convertToAbsolute(selectedEl);
      const r = selectedEl.getBoundingClientRect();
      resizeState = {
        dir, el: selectedEl, startX: e.clientX, startY: e.clientY,
        origLeft: getPx(selectedEl.style, 'left'), origTop: getPx(selectedEl.style, 'top'),
        origW: getPx(selectedEl.style, 'width') || Math.round(r.width),
        origH: getPx(selectedEl.style, 'height') || Math.round(r.height),
      };
      handles[dir].setPointerCapture(e.pointerId);
    };
    handles[dir].onpointermove = (e) => {
      if (!resizeState || resizeState.dir !== dir) return;
      const dx = toStageDelta(e.clientX - resizeState.startX);
      const dy = toStageDelta(e.clientY - resizeState.startY);
      const el = resizeState.el;
      let newW = resizeState.origW;
      let newH = resizeState.origH;
      let newLeft = resizeState.origLeft;
      let newTop = resizeState.origTop;
      if (dir.includes('e')) newW = Math.max(20, resizeState.origW + dx);
      if (dir.includes('w')) { newW = Math.max(20, resizeState.origW - dx); newLeft = resizeState.origLeft + (resizeState.origW - newW); }
      if (dir.includes('s')) newH = Math.max(20, resizeState.origH + dy);
      if (dir.includes('n')) { newH = Math.max(20, resizeState.origH - dy); newTop = resizeState.origTop + (resizeState.origH - newH); }
      setPx(el.style, 'left', newLeft);
      setPx(el.style, 'top', newTop);
      setPx(el.style, 'width', newW);
      setPx(el.style, 'height', newH);
      updateSelectionBox(el);
      loadInspector(el);
    };
    handles[dir].onpointerup = () => {
      if (!resizeState) return;
      pushHistory(history, model);
      commitFrameToModel();
      resizeState = null;
      render();
      markDirty();
    };
  }

  function convertToAbsolute(el) {
    setStatus('Element repositioned freely. Nearby elements may have shifted — press Ctrl+Z to undo if needed.');
    const r = el.getBoundingClientRect();
    const op = el.offsetParent;
    const pr = op ? op.getBoundingClientRect() : editOverlay.getBoundingClientRect();
    el.style.position = 'absolute';
    setPx(el.style, 'left', Math.round(r.left - pr.left));
    setPx(el.style, 'top', Math.round(r.top - pr.top));
    setPx(el.style, 'width', Math.round(r.width));
    setPx(el.style, 'height', Math.round(r.height));
  }

  function wireOverlayInteractions() {
    const doc = editFrame.contentDocument;
    if (!doc) return;

    let hoveredEl = null;
    let overlayPointerDown = null;
    let overlayDragState = null;
    let marqueeState = null;

    editOverlay.style.pointerEvents = 'all';

    editOverlay.onpointermove = (e) => {
      if (!activeEditingEl && !overlayDragState) {
        const iframeEl = getIframeElementAt(e.clientX, e.clientY);
        if (iframeEl !== hoveredEl) {
          hoveredEl = iframeEl;
          if (iframeEl) {
            const r = iframeEl.getBoundingClientRect();
            hoverBox.style.left = r.left + 'px';
            hoverBox.style.top = r.top + 'px';
            hoverBox.style.width = r.width + 'px';
            hoverBox.style.height = r.height + 'px';
            hoverBox.style.display = 'block';
            editOverlay.style.cursor = 'pointer';
          } else {
            hoverBox.style.display = 'none';
            editOverlay.style.cursor = 'default';
          }
        }
      }
      if (marqueeState) {
        const _or = editOverlay.getBoundingClientRect();
        const cx = toStageDelta(e.clientX - _or.left);
        const cy = toStageDelta(e.clientY - _or.top);
        const x = Math.min(marqueeState.startX, cx);
        const y = Math.min(marqueeState.startY, cy);
        const w = Math.abs(cx - marqueeState.startX);
        const h = Math.abs(cy - marqueeState.startY);
        marqueeBox.style.left = x + 'px'; marqueeBox.style.top = y + 'px'; marqueeBox.style.width = w + 'px'; marqueeBox.style.height = h + 'px'; marqueeBox.style.display = 'block';
      }
      if (overlayPointerDown && !overlayDragState && !activeEditingEl && !marqueeState) {
        if (getPointerDistance(overlayPointerDown, { x: e.clientX, y: e.clientY }) >= 4) {
          if (!selectedEl) { const _or2 = editOverlay.getBoundingClientRect(); marqueeState = { startX: toStageDelta(overlayPointerDown.x - _or2.left), startY: toStageDelta(overlayPointerDown.y - _or2.top) }; return; }
          if (!isMovableByPosition(selectedEl)) convertToAbsolute(selectedEl);
          const dragElements = getSelectedElements(doc);
          dragElements.forEach((el) => { if (!isMovableByPosition(el)) convertToAbsolute(el); });
          overlayDragState = { startX: e.clientX, startY: e.clientY, items: dragElements.map((el) => ({ el, left: getPx(el.style, 'left'), top: getPx(el.style, 'top') })) };
        }
      }
      if (overlayDragState) {
        overlayDragState.items.forEach((item) => {
          setPx(item.el.style, 'left', snapCoord(item.left + toStageDelta(e.clientX - overlayDragState.startX)));
          setPx(item.el.style, 'top', snapCoord(item.top + toStageDelta(e.clientY - overlayDragState.startY)));
        });
        updateSelectionBox(selectedEl);
        loadInspector(selectedEl);
        renderSelectedOutlines();
      }
    };

    editOverlay.onclick = (e) => {
      const iframeEl = getIframeElementAt(e.clientX, e.clientY);
      if (e.ctrlKey || e.metaKey) {
        if (iframeEl) iframeEl.click();
        return;
      }
      if (activeEditingEl && iframeEl !== activeEditingEl) { finishTextEdit(true); return; }
      if (iframeEl) selectElement(iframeEl, e.shiftKey || e.ctrlKey || e.metaKey);
      else { clearSelectionState(); }
    };

    editOverlay.ondblclick = (e) => {
      const iframeEl = getIframeElementAt(e.clientX, e.clientY);
      if (!iframeEl) return;
      selectElement(iframeEl);
      enterTextEditMode(iframeEl);
    };

    editOverlay.onpointerdown = (e) => {
      if (activeEditingEl) return;
      const iframeEl = getIframeElementAt(e.clientX, e.clientY);
      if (iframeEl) {
        if (iframeEl !== selectedEl) selectElement(iframeEl, e.shiftKey || e.ctrlKey || e.metaKey);
        overlayPointerDown = { x: e.clientX, y: e.clientY };
        editOverlay.setPointerCapture(e.pointerId);
        return;
      }
      overlayPointerDown = { x: e.clientX, y: e.clientY };
      const _or0 = editOverlay.getBoundingClientRect();
      marqueeState = { startX: toStageDelta(e.clientX - _or0.left), startY: toStageDelta(e.clientY - _or0.top) };
      editOverlay.setPointerCapture(e.pointerId);
    };

    editOverlay.onpointerup = () => {
      if (marqueeState) {
        const mr = marqueeBox.getBoundingClientRect();
        const hits = [];
        (doc.body ? Array.from(doc.body.querySelectorAll('*')) : []).forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return;
          const intersect = !(r.right < mr.left || r.left > mr.right || r.bottom < mr.top || r.top > mr.bottom);
          if (intersect) {
            if (!el.getAttribute('data-lhe-id')) el.setAttribute('data-lhe-id', `lhe-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`);
            hits.push(el);
          }
        });
        selectedIds.clear();
        hits.forEach((el) => selectedIds.add(el.getAttribute('data-lhe-id')));
        if (hits[0]) {
          selectedEl = hits[0];
          selectionId = hits[0].getAttribute('data-lhe-id') || '';
          applySelectionMarker();
          updateSelectionBox(selectedEl);
          loadInspector(selectedEl);
        } else {
          clearSelectionState();
        }
        renderSelectedOutlines();
        refreshButtons();
        marqueeState = null;
        marqueeBox.style.display = 'none';
      }
      overlayPointerDown = null;
      if (overlayDragState) {
        pushHistory(history, model);
        commitFrameToModel();
        overlayDragState = null;
        render();
        markDirty();
      }
    };

    doc.addEventListener('keydown', (e) => {
      if (!activeEditingEl) return;
      if (e.key === 'Escape') { e.preventDefault(); finishTextEdit(false); }
      if (e.key === 'Enter' && activeEditingEl.tagName !== 'DIV') { e.preventDefault(); finishTextEdit(true); }
    }, true);

    doc.addEventListener('focusout', (e) => {
      if (!activeEditingEl || e.target !== activeEditingEl) return;
      setTimeout(() => { if (activeEditingEl) finishTextEdit(true); }, 50);
    }, true);
  }



  function applyMasterTemplateToSlide(slide, templateHtml, preserveText) {
    if (!slide) return;
    if (!preserveText) { slide.innerHTML = templateHtml; return; }
    const textSelector = 'h1,h2,h3,p,li,a,label,button,span';
    const originalNodes = Array.from(slide.querySelectorAll(textSelector));
    const originalBySlot = new Map();
    originalNodes.forEach((el) => {
      const slot = el.getAttribute('data-master-slot');
      if (slot) originalBySlot.set(slot, el.textContent || '');
    });
    const originalPositional = originalNodes.map((el) => el.textContent || '');
    slide.innerHTML = templateHtml;
    const mapped = Array.from(slide.querySelectorAll(textSelector));
    mapped.forEach((el, i) => {
      const slot = el.getAttribute('data-master-slot');
      if (slot && originalBySlot.has(slot)) {
        el.textContent = originalBySlot.get(slot) || '';
        return;
      }
      if (i < originalPositional.length) el.textContent = originalPositional[i];
    });
  }

  function getActiveSlideElement(doc) {
    if (!doc) return null;
    return collectSlides(doc).find((s, i) => (s.getAttribute('data-slide-id') || `s${i + 1}`) === model.selectedSlideId) || null;
  }

  const thumbFrames = new Map();
  let thumbRefreshTimer = null;

  function buildSlideThumbHtml(slideId) {
    try {
      const parsed = new DOMParser().parseFromString(stripUnsafeHtml(model.sourceHtml), 'text/html');
      const slides = collectSlides(parsed);
      const slide = slides.find((s, i) => (s.getAttribute('data-slide-id') || `s${i + 1}`) === slideId);
      if (!slide) return '';
      const styles = Array.from(parsed.querySelectorAll('style')).map((st) => st.outerHTML).join('');
      return `<!doctype html><html><head><meta charset="UTF-8">${styles}<style>*{box-sizing:border-box;}html,body{margin:0;padding:0;overflow:hidden;width:960px;height:540px;}</style></head><body>${slide.outerHTML}</body></html>`;
    } catch { return ''; }
  }

  function refreshThumbnails() {
    if (!model.slides.length) return;
    model.slides.forEach((s, i) => {
      const btn = slidesList.children[i];
      if (!btn) return;
      const wrap = btn.querySelector('.slide-thumb-wrap');
      if (!wrap) return;
      let frame = thumbFrames.get(s.id);
      if (!frame) {
        frame = document.createElement('iframe');
        frame.setAttribute('sandbox', 'allow-same-origin');
        frame.setAttribute('aria-hidden', 'true');
        frame.tabIndex = -1;
        frame.style.cssText = 'width:960px;height:540px;border:0;pointer-events:none;transform:scale(0.09375);transform-origin:top left;display:block;';
        thumbFrames.set(s.id, frame);
      }
      if (!wrap.contains(frame)) wrap.appendChild(frame);
      const html = buildSlideThumbHtml(s.id);
      if (html && frame.getAttribute('data-lhe-hash') !== String(html.length)) {
        frame.srcdoc = html;
        frame.setAttribute('data-lhe-hash', String(html.length));
      }
    });
    thumbFrames.forEach((frame, id) => {
      if (!model.slides.some((s) => s.id === id)) { frame.remove(); thumbFrames.delete(id); }
    });
  }

  function scheduleThumbRefresh() {
    clearTimeout(thumbRefreshTimer);
    thumbRefreshTimer = setTimeout(refreshThumbnails, 250);
  }



  function render() {
    slidesList.textContent = '';
    const slideIdx = model.slides.findIndex((s) => s.id === model.selectedSlideId);
    slideCounter.textContent = model.slides.length > 1 ? `${slideIdx + 1} / ${model.slides.length}` : '';
    model.slides.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = s.id === model.selectedSlideId ? 'active' : '';
      const thumbWrap = document.createElement('div');
      thumbWrap.className = 'slide-thumb-wrap';
      const numBadge = document.createElement('span');
      numBadge.className = 'slide-num';
      numBadge.textContent = String(i + 1);
      const labelEl = document.createElement('span');
      labelEl.className = 'slide-label-text';
      labelEl.textContent = s.label || s.name;
      labelEl.title = s.label || s.name;
      b.appendChild(thumbWrap);
      b.appendChild(numBadge);
      b.appendChild(labelEl);
      b.onclick = () => {
        if (model.mode === 'edit') commitFrameToModel();
        model.selectedSlideId = s.id;
        updateStageScale();
        setFrameHtml();
        refreshButtons();
      };
      slidesList.appendChild(b);
    });
    scheduleThumbRefresh();
    setFrameHtml();
    refreshButtons();
    describeSelected(selectedEl);
  }

  function applyStyle(fn) {
    if (!selectedEl || model.mode !== 'edit') return;
    pushHistory(history, model);
    fn();
    commitFrameToModel();
    render();
    markDirty();
  }

  async function openHtmlFile(f) {
    if (!f) return;
    if (isDirty && !confirm('You have unsaved changes. Open a new file and discard them?')) return;
    model = mapHtmlToModel(await f.text());
    sourceFileName = f.name.replace(/\.html?$/i, '');
    masterSlideTemplateHtml = '';
    masterPreserveText = true;
    masterPreserveTextToggle.checked = true;
    history.undo = [];
    history.redo = [];
    clearSelectionState();
    document.body.classList.remove('no-file');
    render();
    markClean();
    setStatus(`Opened: ${f.name}`);
  }

  fileInput.onchange = async () => { await openHtmlFile(fileInput.files?.[0]); fileInput.value = ''; };
  previewBtn.onclick = () => { model.mode = 'preview'; clearSelectionState(); render(); };
  editBtn.onclick = () => { model.mode = 'edit'; clearSelectionState(); render(); };

  document.body.addEventListener('dragover', (e) => {
    const hasFile = Array.from(e.dataTransfer?.items || []).some((it) => it.kind === 'file');
    if (hasFile) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; document.body.classList.add('drag-over'); }
  });
  document.body.addEventListener('dragleave', (e) => {
    if (!e.relatedTarget || !document.body.contains(e.relatedTarget)) document.body.classList.remove('drag-over');
  });
  document.body.addEventListener('drop', async (e) => {
    e.preventDefault();
    document.body.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer?.files || []);
    const htmlFile = files.find((f) => /\.html?$/i.test(f.name));
    const imgFile = files.find((f) => /\.(png|jpe?g|gif|webp|avif)$/i.test(f.name));
    if (htmlFile) {
      await openHtmlFile(htmlFile);
    } else if (imgFile && model.mode === 'edit') {
      const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(imgFile); });
      if (!/^data:image\/(png|jpeg|jpg|gif|webp|avif)/i.test(data)) { setStatus('Unsupported image format. Use PNG, JPEG, GIF, WebP, or AVIF.'); return; }
      const doc = editFrame.contentDocument;
      if (!doc) { setStatus('Switch to Edit mode to add an image.'); return; }
      applyStyle(() => {
        const active = collectSlides(doc).find((s, idx) => (s.getAttribute('data-slide-id') || `s${idx + 1}`) === model.selectedSlideId) || doc.body;
        const img = doc.createElement('img');
        img.src = data;
        img.style.cssText = 'position:absolute;left:80px;top:120px;width:240px;height:140px;';
        active.appendChild(img);
      });
      setStatus(`Image "${imgFile.name}" added to slide.`);
    } else {
      setStatus('Drop an HTML file to open it, or drop an image to add it to the current slide.');
    }
  });

  let nudgeTimer = null;
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input,textarea,select')) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveBtn.click(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') { e.preventDefault(); exportBtn.click(); return; }
    if ((e.ctrlKey || e.metaKey) && !activeEditingEl) {
      if (!e.shiftKey && e.key === 'z') { e.preventDefault(); model = undo(history, model); render(); markDirty(); setStatus('Undone.'); return; }
      if (e.key === 'y' || (e.shiftKey && e.key === 'z')) { e.preventDefault(); model = redo(history, model); render(); markDirty(); setStatus('Redone.'); return; }
    }
    if (model.mode !== 'edit' || activeEditingEl) return;
    if (e.key === 'Escape' && selectedEl) {
      e.preventDefault();
      clearSelectionState();
      return;
    }
    if (e.key === 'Delete' && (selectedEl || selectedIds.size)) {
      e.preventDefault();
      applyStyle(() => { getSelectedElements(editFrame.contentDocument).forEach((el) => el.remove()); clearSelectionState(); });
      setStatus('Element deleted. Press Ctrl+Z to undo.');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedEl) {
      clipboard = selectedEl.outerHTML;
      setStatus('Copied. Ctrl+V to paste.');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboard) {
      e.preventDefault();
      const doc = editFrame.contentDocument;
      if (!doc) return;
      const temp = doc.createElement('div');
      temp.innerHTML = stripUnsafeHtml(clipboard);
      const clone = temp.firstElementChild;
      if (!clone) return;
      clone.removeAttribute('data-lhe-id');
      if (isMovableByPosition(clone)) {
        setPx(clone.style, 'left', snapCoord(getPx(clone.style, 'left') + 20));
        setPx(clone.style, 'top', snapCoord(getPx(clone.style, 'top') + 20));
      } else {
        clone.style.position = 'absolute';
        setPx(clone.style, 'left', 100); setPx(clone.style, 'top', 100);
        if (!getPx(clone.style, 'width')) setPx(clone.style, 'width', 200);
        if (!getPx(clone.style, 'height')) setPx(clone.style, 'height', 40);
      }
      const active = collectSlides(doc).find((s, i) => (s.getAttribute('data-slide-id') || `s${i + 1}`) === model.selectedSlideId) || doc.body;
      active.appendChild(clone);
      selectElement(clone);
      pushHistory(history, model);
      commitFrameToModel();
      render();
      setStatus('Pasted.');
      return;
    }
    const nudge = e.shiftKey ? 10 : 1;
    const dir = { ArrowLeft: [-nudge, 0], ArrowRight: [nudge, 0], ArrowUp: [0, -nudge], ArrowDown: [0, nudge] }[e.key];
    if (dir && selectedEl) {
      e.preventDefault();
      const targets = getSelectedElements(editFrame.contentDocument);
      targets.forEach((el) => {
        if (!isMovableByPosition(el)) convertToAbsolute(el);
        setPx(el.style, 'left', snapCoord(getPx(el.style, 'left') + dir[0]));
        setPx(el.style, 'top', snapCoord(getPx(el.style, 'top') + dir[1]));
      });
      updateSelectionBox(selectedEl);
      loadInspector(selectedEl);
      renderSelectedOutlines();
      clearTimeout(nudgeTimer);
      nudgeTimer = setTimeout(() => { pushHistory(history, model); commitFrameToModel(); render(); markDirty(); }, 300);
    }
  });
  addTextBtn.onclick = () => {
    pushHistory(history, model);
    commitFrameToModel();
    model = addTextBlockToSlide(model, 'New text');
    render();
    markDirty();
  };
  addImageBtn.onclick = () => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = 'image/png,image/jpeg,image/jpg,image/gif,image/webp,image/avif';
    i.onchange = async () => {
      const f = i.files?.[0];
      if (!f) return;
      const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
      if (!/^data:image\/(png|jpeg|jpg|gif|webp|avif)/i.test(data)) { setStatus('Only PNG, JPEG, GIF, WebP, AVIF images are supported.'); return; }
      applyStyle(() => {
        const doc = editFrame.contentDocument;
        const active = collectSlides(doc).find((s, idx) => (s.getAttribute('data-slide-id') || `s${idx + 1}`) === model.selectedSlideId) || doc.body;
        const img = doc.createElement('img');
        img.src = data;
        img.style.position = 'absolute'; img.style.left = '80px'; img.style.top = '120px'; img.style.width = '240px'; img.style.height = '140px';
        active.appendChild(img);
      });
    };
    i.click();
  };

  insReplaceImgBtn.onclick = () => {
    if (!selectedEl || selectedEl.tagName !== 'IMG') return;
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = 'image/png,image/jpeg,image/jpg,image/gif,image/webp,image/avif';
    i.onchange = async () => {
      const f = i.files?.[0];
      if (!f) return;
      const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
      if (!/^data:image\/(png|jpeg|jpg|gif|webp|avif)/i.test(data)) { setStatus('Only PNG, JPEG, GIF, WebP, AVIF images are supported.'); return; }
      applyStyle(() => { if (selectedEl?.tagName === 'IMG') selectedEl.src = data; });
      setStatus('Image replaced.');
    };
    i.click();
  };

  delBtn.onclick = () => { applyStyle(() => { getSelectedElements(editFrame.contentDocument).forEach((el) => el.remove()); clearSelectionState(); }); setStatus('Element deleted. Press Ctrl+Z to undo.'); };
  insText.onchange = () => applyStyle(() => { if (selectedEl && selectedEl.tagName !== 'IMG') selectedEl.textContent = insText.value; });
  insAlt.onchange = () => applyStyle(() => { if (selectedEl?.tagName === 'IMG' || selectedEl?.tagName === 'BUTTON') selectedEl.setAttribute('alt', insAlt.value); });
  insColor.onchange = () => applyStyle(() => { if (selectedEl) selectedEl.style.color = insColor.value; });
  insBg.onchange = () => applyStyle(() => { if (selectedEl) selectedEl.style.backgroundColor = insBg.value; });
  insFont.onchange = () => applyStyle(() => { if (selectedEl) selectedEl.style.fontSize = `${Number(insFont.value || 16)}px`; });
  insBold.onchange = () => applyStyle(() => { if (selectedEl) selectedEl.style.fontWeight = insBold.checked ? '700' : '400'; });
  insFontFamily.onchange = () => applyStyle(() => { if (selectedEl) selectedEl.style.fontFamily = insFontFamily.value; });
  insAlign.onchange = () => applyStyle(() => { if (selectedEl) selectedEl.style.textAlign = insAlign.value; });
  insMasterSlot.onchange = () => applyStyle(() => {
    if (!selectedEl) return;
    const v = String(insMasterSlot.value || '').trim();
    if (!v) selectedEl.removeAttribute('data-master-slot');
    else selectedEl.setAttribute('data-master-slot', v.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64));
  });
  insItalic.onchange = () => applyStyle(() => { if (selectedEl) selectedEl.style.fontStyle = insItalic.checked ? 'italic' : 'normal'; });
  insUnderline.onchange = () => applyStyle(() => { if (selectedEl) selectedEl.style.textDecoration = insUnderline.checked ? 'underline' : 'none'; });
  insOpacity.onchange = () => applyStyle(() => { if (selectedEl) selectedEl.style.opacity = String(Math.max(0, Math.min(100, Number(insOpacity.value || 100))) / 100); });
  insRotate.onchange = () => applyStyle(() => {
    const deg = Math.max(-360, Math.min(360, Number(insRotate.value || 0)));
    getSelectedElements(editFrame.contentDocument).forEach((el) => {
      const existing = el.style.transform || '';
      const cleaned = existing.replace(/\s*rotate\(([-0-9.]+)deg\)/ig, '').trim();
      el.style.transform = `${cleaned}${cleaned ? ' ' : ''}rotate(${deg}deg)`;
    });
  });
  bringFrontBtn.onclick = () => applyStyle(() => { getSelectedElements(editFrame.contentDocument).forEach((el) => { if (el.parentElement) el.parentElement.appendChild(el); }); });
  sendBackBtn.onclick = () => applyStyle(() => { getSelectedElements(editFrame.contentDocument).slice().reverse().forEach((el) => { if (el.parentElement) el.parentElement.insertBefore(el, el.parentElement.firstChild); }); });

  alignLeftBtn.onclick = () => applyStyle(() => {
    const items = getSelectedElements(editFrame.contentDocument);
    if (items.length < 2) return;
    items.forEach((el) => { if (!isMovableByPosition(el)) convertToAbsolute(el); });
    const left = Math.min(...items.map((el) => getPx(el.style, 'left')));
    items.forEach((el) => setPx(el.style, 'left', left));
  });
  alignTopBtn.onclick = () => applyStyle(() => {
    const items = getSelectedElements(editFrame.contentDocument);
    if (items.length < 2) return;
    items.forEach((el) => { if (!isMovableByPosition(el)) convertToAbsolute(el); });
    const top = Math.min(...items.map((el) => getPx(el.style, 'top')));
    items.forEach((el) => setPx(el.style, 'top', top));
  });
  distributeHBtn.onclick = () => applyStyle(() => {
    const items = getSelectedElements(editFrame.contentDocument).slice().sort((a, b) => getPx(a.style, 'left') - getPx(b.style, 'left'));
    if (items.length < 3) return;
    items.forEach((el) => { if (!isMovableByPosition(el)) convertToAbsolute(el); });
    const minX = getPx(items[0].style, 'left');
    const maxX = getPx(items[items.length - 1].style, 'left');
    const step = (maxX - minX) / (items.length - 1);
    items.forEach((el, i) => setPx(el.style, 'left', minX + step * i));
  });
  distributeVBtn.onclick = () => applyStyle(() => {
    const items = getSelectedElements(editFrame.contentDocument).slice().sort((a, b) => getPx(a.style, 'top') - getPx(b.style, 'top'));
    if (items.length < 3) return;
    items.forEach((el) => { if (!isMovableByPosition(el)) convertToAbsolute(el); });
    const minY = getPx(items[0].style, 'top');
    const maxY = getPx(items[items.length - 1].style, 'top');
    const step = (maxY - minY) / (items.length - 1);
    items.forEach((el, i) => setPx(el.style, 'top', minY + step * i));
  });

  groupSelectionBtn.onclick = () => applyStyle(() => {
    const doc = editFrame.contentDocument;
    const items = getSelectedElements(doc);
    if (items.length < 2) return;
    items.forEach((el) => { if (!isMovableByPosition(el)) convertToAbsolute(el); });
    const left = Math.min(...items.map((el) => getPx(el.style, 'left')));
    const top = Math.min(...items.map((el) => getPx(el.style, 'top')));
    const right = Math.max(...items.map((el) => getPx(el.style, 'left') + (getPx(el.style, 'width') || Math.round(el.getBoundingClientRect().width))));
    const bottom = Math.max(...items.map((el) => getPx(el.style, 'top') + (getPx(el.style, 'height') || Math.round(el.getBoundingClientRect().height))));
    const group = doc.createElement('div');
    group.className = 'lhe-group';
    group.style.position = 'absolute';
    setPx(group.style, 'left', left);
    setPx(group.style, 'top', top);
    setPx(group.style, 'width', right - left);
    setPx(group.style, 'height', bottom - top);
    const parent = items[0].parentElement;
    if (!parent) return;
    parent.appendChild(group);
    items.forEach((el) => {
      setPx(el.style, 'left', getPx(el.style, 'left') - left);
      setPx(el.style, 'top', getPx(el.style, 'top') - top);
      group.appendChild(el);
    });
    selectedIds.clear();
    selectedEl = group;
    if (!group.getAttribute('data-lhe-id')) group.setAttribute('data-lhe-id', `lhe-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`);
    selectionId = group.getAttribute('data-lhe-id') || '';
    selectedIds.add(selectionId);
  });

  ungroupSelectionBtn.onclick = () => applyStyle(() => {
    if (!selectedEl || selectedEl.tagName !== 'DIV' || !selectedEl.classList.contains('lhe-group')) return;
    const group = selectedEl;
    const parent = group.parentElement;
    if (!parent) return;
    const gx = getPx(group.style, 'left');
    const gy = getPx(group.style, 'top');
    const children = Array.from(group.children);
    children.forEach((child) => {
      if (!(child instanceof HTMLElement)) return;
      if (!isMovableByPosition(child)) child.style.position = 'absolute';
      setPx(child.style, 'left', gx + getPx(child.style, 'left'));
      setPx(child.style, 'top', gy + getPx(child.style, 'top'));
      parent.appendChild(child);
    });
    group.remove();
    clearSelectionState();
  });


  snapToggle.onchange = () => { snapEnabled = snapToggle.checked; setStatus(snapEnabled ? 'Snap to 10px grid enabled.' : 'Snap disabled.'); };
  [insX, insY, insW, insH].forEach((input) => input.onchange = () => applyStyle(() => {
    if (!selectedEl) return;
    if (!isMovableByPosition(selectedEl)) convertToAbsolute(selectedEl);
    const x = Number(insX.value); const y = Number(insY.value); const w = Number(insW.value); const h = Number(insH.value);
    if (Number.isFinite(x)) setPx(selectedEl.style, 'left', x);
    if (Number.isFinite(y)) setPx(selectedEl.style, 'top', y);
    if (Number.isFinite(w) && w > 0) setPx(selectedEl.style, 'width', w);
    if (Number.isFinite(h) && h > 0) setPx(selectedEl.style, 'height', h);
  }));


  masterPreserveTextToggle.onchange = () => { masterPreserveText = masterPreserveTextToggle.checked; };

  setMasterBtn.onclick = () => {
    commitFrameToModel();
    const doc = editFrame.contentDocument;
    const active = getActiveSlideElement(doc);
    if (!active) { setStatus('Could not capture master from current slide.'); return; }
    masterSlideTemplateHtml = active.innerHTML;
    refreshButtons();
    setStatus(masterPreserveText ? 'Master template captured. Apply preserves existing slide text.' : 'Master template captured from current slide.');
  };
  applyMasterBtn.onclick = () => {
    if (!masterSlideTemplateHtml) { setStatus('Set a master template first.'); return; }
    pushHistory(history, model);
    commitFrameToModel();
    const doc = editFrame.contentDocument;
    if (!doc) return;
    collectSlides(doc).forEach((slide) => { applyMasterTemplateToSlide(slide, masterSlideTemplateHtml, masterPreserveText); });
    commitFrameToModel();
    render();
    markDirty();
    setStatus(masterPreserveText ? 'Master applied to all slides (text preserved where possible).' : 'Master template applied to all slides.');
  };

  addSlideBtn.onclick = () => {
    pushHistory(history, model);
    commitFrameToModel();
    model = addSlideToModel(model);
    clearSelectionState();
    render();
    markDirty();
  };
  delSlideBtn.onclick = () => {
    if (model.slides.length <= 1) { setStatus('Cannot delete the only slide.'); return; }
    pushHistory(history, model);
    commitFrameToModel();
    model = deleteSlideFromModel(model);
    clearSelectionState();
    render();
    setStatus('Slide deleted. Press Ctrl+Z to undo.');
    markDirty();
  };
  dupSlideBtn.onclick = () => {
    pushHistory(history, model);
    commitFrameToModel();
    model = duplicateSlideInModel(model);
    clearSelectionState();
    render();
    markDirty();
  };
  undoBtn.onclick = () => { model = undo(history, model); render(); markDirty(); setStatus('Undone. Ctrl+Z to undo more, Ctrl+Y to redo.'); };
  redoBtn.onclick = () => { model = redo(history, model); render(); markDirty(); setStatus('Redone.'); };
  saveBtn.onclick = () => {
    commitFrameToModel();
    const text = JSON.stringify(createProjectPayload({ ...model, masterSlideTemplateHtml, masterPreserveText }), null, 2);
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'project.lheproj-v2.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    markClean();
    setStatus('Project saved.');
  };
  openProjectBtn.onclick = () => openProjectInput.click();
  openProjectInput.onchange = async () => {
    const f = openProjectInput.files?.[0];
    if (!f) return;
    if (isDirty && !confirm('You have unsaved changes. Open a project file and discard them?')) { openProjectInput.value = ''; return; }
    let payload;
    try { payload = JSON.parse(await f.text()); } catch { setStatus('Project file could not be opened — invalid JSON. Select a .lheproj-v2.json file saved by this editor.'); return; }
    const restored = restoreProjectPayload(payload);
    if (!restored) { setStatus('Project file format not recognized. Select a .lheproj-v2.json file saved by this editor.'); return; }
    model = restored;
    masterSlideTemplateHtml = String(restored.masterSlideTemplateHtml || '');
    masterPreserveText = restored.masterPreserveText !== false;
    masterPreserveTextToggle.checked = masterPreserveText;
    clearSelectionState();
    document.body.classList.remove('no-file');
    render();
    markClean();
    setStatus(`Opened project: ${f.name}`);
  };
  exportBtn.onclick = () => {
    commitFrameToModel();
    const url = URL.createObjectURL(new Blob([exportModelToHtml(model)], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url; a.download = (sourceFileName ? `${sourceFileName}-edited.html` : 'edited-presentation.html'); a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    const fname = sourceFileName ? `${sourceFileName}-edited.html` : 'edited-presentation.html';
    setStatus(`Exported as "${fname}". Note: interactive scripts are removed from the export for safety.`);
  };

  function updateStageScale() {
    const pad = 40;
    const availW = stageWrap.clientWidth - pad;
    const availH = stageWrap.clientHeight - pad;
    if (availW <= 0 || availH <= 0) return;
    const s = Math.min(availW / 960, availH / 540, 1);
    stageScale = s;
    editStage.style.transform = s < 1 ? `scale(${s.toFixed(4)})` : '';
    editStage.style.marginBottom = s < 1 ? `${-(540 * (1 - s))}px` : '';
    liveFrame.style.transform = editStage.style.transform;
    liveFrame.style.marginBottom = editStage.style.marginBottom;
    const zoomEl = q('#zoom-level');
    if (zoomEl) zoomEl.textContent = s < 1 ? `${Math.round(s * 100)}%` : '';
    if (selectedEl) updateSelectionBox(selectedEl);
  }

  new ResizeObserver(updateStageScale).observe(stageWrap);
  updateStageScale();

  render();

  try {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      const payload = JSON.parse(savedDraft);
      const restored = restoreProjectPayload(payload);
      if (restored && restored.sourceHtml && restored.sourceHtml.trim().length > 20) {
        model = restored;
        masterSlideTemplateHtml = String(restored.masterSlideTemplateHtml || '');
        masterPreserveText = restored.masterPreserveText !== false;
        masterPreserveTextToggle.checked = masterPreserveText;
        clearSelectionState();
        document.body.classList.remove('no-file');
        render();
        isDirty = true;
        brandMark?.classList.add('has-unsaved');
        document.title = '● HTML Presentation Editor — Tenaris';
        setStatus('Draft restored from last session. Press Ctrl+S to save as a project file.');
      }
    }
  } catch {}
}

const hasDom = typeof document !== 'undefined';

export function escapeHtml(s) { return String(s || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
export function escapeAttribute(v) { return String(v || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }

function stripRemoteCssUrls(cssText) {
  return String(cssText || '')
    .replace(/@import\s+url\(\s*(['"]?)(https?:|\/\/)[^)]*\)\s*;?/gi, '')
    .replace(/@import\s+(['"])(https?:|\/\/)[^'"]*\1\s*;?/gi, '')
    .replace(/url\(\s*(['"]?)(https?:|\/\/)[^)]+\)/gi, 'url()');
}

function blockRemoteAttributes(inputHtml) {
  return String(inputHtml || '')
    .replace(/\s(src|href|poster)\s*=\s*"([^"]*)"/gi, (_m, n, val) => (/^(https?:|\/\/)/i.test(val.trim()) ? '' : ` ${n}="${escapeAttribute(val)}"`))
    .replace(/\s(src|href|poster)\s*=\s*'([^']*)'/gi, (_m, n, val) => (/^(https?:|\/\/)/i.test(val.trim()) ? '' : ` ${n}='${escapeAttribute(val)}'`));
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
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z0-9_-]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z0-9_-]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z0-9_-]+\s*=\s*[^\s>]+/gi, '');
}

export function stripUnsafeHtml(inputHtml) { return sanitizeByMode(inputHtml, 'edit'); }
export function createLivePreviewHtml(inputHtml) { return sanitizeByMode(inputHtml, 'preview'); }

function collectSlides(doc) {
  const nodes = Array.from(doc.querySelectorAll('.slide'));
  if (nodes.length) return nodes;
  return [doc.body];
}


function replaceFirstTextInTag(html, tagName, replacementText) {
  const re = new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)<\/${tagName}>`, 'i');
  return String(html).replace(re, (_m, attrs) => `<${tagName}${attrs}>${escapeHtml(replacementText)}</${tagName}>`);
}
function getSlideRegexById(slideId) {
  return new RegExp('<(section|div)\\b[^>]*class\\s*=\\s*["\'][^"\']*slide[^"\']*["\'][^>]*data-slide-id\\s*=\\s*["\']' + slideId + '["\'][^>]*>[\\s\\S]*?<\\/\\1>', 'i');
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
  const updated = target.replace(/<\/(section|div)>\s*$/i, `<div class="lhe-added-text">${escapeHtml(text)}</div></$1>`);
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

function getPx(style, key) { const v = style.getPropertyValue(key) || ''; const n = Number.parseFloat(v); return Number.isFinite(n) ? n : 0; }
function setPx(style, key, value) { style.setProperty(key, `${Math.round(value)}px`); }

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
export function createProjectPayload(model) { return { schema: 'lheproj-v2', version: 2, model: { ...model, sourceHtml: stripUnsafeHtml(model.sourceHtml), previewHtml: createLivePreviewHtml(model.originalHtml || model.previewHtml || model.sourceHtml) } }; }
export function restoreProjectPayload(payload) {
  if (!payload || payload.schema !== 'lheproj-v2' || payload.version !== 2) return null;
  const restored = mapHtmlToModel(String(payload.model?.sourceHtml || ''));
  restored.mode = payload.model?.mode === 'preview' ? 'preview' : 'edit';
  restored.selectedSlideId = payload.model?.selectedSlideId || restored.selectedSlideId;
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
  const previewBtn = q('#mode-preview');
  const editBtn = q('#mode-edit');
  const slidesList = q('#slides');
  const layersList = q('#layers');
  const fileInput = q('#file');
  const openProjectInput = q('#open-project-file');
  const addTextBtn = q('#add-text'); const addImageBtn = q('#add-image'); const delBtn = q('#delete');
  const undoBtn = q('#undo'); const redoBtn = q('#redo'); const saveBtn = q('#save-project'); const openProjectBtn = q('#open-project'); const exportBtn = q('#export');
  const insType = q('#ins-type'); const insText = q('#ins-text'); const insAlt = q('#ins-alt');
  const insX = q('#ins-x'); const insY = q('#ins-y'); const insW = q('#ins-w'); const insH = q('#ins-h');
  const insColor = q('#ins-color'); const insBg = q('#ins-bg'); const insFont = q('#ins-font'); const insBold = q('#ins-bold');

  let model = mapHtmlToModel('');
  const history = createHistory();
  let selectedEl = null;
  let drag = null;

  const setStatus = (t) => { status.textContent = t; };
  const activeFrame = () => model.mode === 'preview' ? liveFrame : editFrame;

  function refreshButtons() {
    undoBtn.disabled = !canUndo(history); redoBtn.disabled = !canRedo(history);
    const editable = model.mode === 'edit';
    delBtn.disabled = !selectedEl || !editable;
    addTextBtn.disabled = !editable; addImageBtn.disabled = !editable;
    previewBtn.classList.toggle('active', model.mode === 'preview'); editBtn.classList.toggle('active', model.mode === 'edit');
  }

  function setFrameHtml() {
    editFrame.style.display = model.mode === 'edit' ? 'block' : 'none';
    liveFrame.style.display = model.mode === 'preview' ? 'block' : 'none';
    if (model.mode === 'preview') {
      liveFrame.srcdoc = model.previewHtml;
      modeEl.textContent = 'Preview mode: interactive view. Scripts may run in isolated sandbox; remote URLs are blocked where possible.';
      return;
    }
    editFrame.srcdoc = model.sourceHtml;
    modeEl.textContent = 'Edit mode: safe editing view. Scripts are disabled.';
    editFrame.onload = () => {
      const doc = editFrame.contentDocument;
      if (!doc) return;
      const style = doc.createElement('style');
      style.textContent = '[data-lhe-selected="1"]{outline:2px solid #2563eb !important;}';
      doc.head.appendChild(style);
      wireSlideVisibility(); wireEditableClicks(); refreshLayers();
    };
  }

  function commitFrameToModel() {
    const doc = editFrame.contentDocument; if (!doc) return;
    doc.querySelectorAll('[data-lhe-selected]').forEach((x) => x.removeAttribute('data-lhe-selected'));
    model.sourceHtml = stripUnsafeHtml(`<!doctype html>\n${doc.documentElement.outerHTML}`);
    model = { ...mapHtmlToModel(model.sourceHtml), originalHtml: model.originalHtml, previewHtml: model.previewHtml, mode: model.mode, selectedSlideId: model.selectedSlideId };
  }

  function wireSlideVisibility() {
    const doc = editFrame.contentDocument; if (!doc) return;
    collectSlides(doc).forEach((slide, i) => {
      const id = slide.getAttribute('data-slide-id') || `s${i + 1}`;
      slide.style.display = id === model.selectedSlideId ? '' : 'none';
    });
  }

  function isEditableText(el) { return !!el && ['H1','H2','H3','P','SPAN','BUTTON','DIV'].includes(el.tagName); }
  function isSafeMovable(el) { return !!el && !['CANVAS','SVG','IFRAME'].includes(el.tagName); }

  function loadInspector(el) {
    const cs = getComputedStyle(el);
    insType.textContent = el.tagName.toLowerCase();
    insText.value = el.tagName === 'IMG' ? '' : (el.textContent || '');
    insAlt.value = el.tagName === 'IMG' ? (el.getAttribute('alt') || '') : '';
    insX.value = String(getPx(el.style, 'left')); insY.value = String(getPx(el.style, 'top'));
    insW.value = String(getPx(el.style, 'width') || Math.round(el.getBoundingClientRect().width));
    insH.value = String(getPx(el.style, 'height') || Math.round(el.getBoundingClientRect().height));
    insColor.value = rgbToHex(cs.color); insBg.value = rgbToHex(cs.backgroundColor);
    insFont.value = String(Math.round(parseFloat(cs.fontSize) || 16));
    insBold.checked = (cs.fontWeight === 'bold' || Number.parseInt(cs.fontWeight, 10) >= 600);
  }

  function rgbToHex(rgb) {
    const m = String(rgb || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!m) return '#000000';
    return `#${[1,2,3].map((i)=>Number(m[i]).toString(16).padStart(2,'0')).join('')}`;
  }

  function refreshLayers() {
    layersList.textContent = '';
    const doc = editFrame.contentDocument; if (!doc) return;
    const active = collectSlides(doc).find((s, i) => (s.getAttribute('data-slide-id') || `s${i + 1}`) === model.selectedSlideId);
    if (!active) return;
    Array.from(active.querySelectorAll('h1,h2,h3,p,button,div,span,img')).slice(0, 120).forEach((el, i) => {
      const b = document.createElement('button'); b.textContent = `${el.tagName.toLowerCase()} ${i + 1}`; b.onclick = () => selectElement(el); layersList.appendChild(b);
    });
  }

  function selectElement(el) {
    const doc = editFrame.contentDocument; if (!doc) return;
    doc.querySelectorAll('[data-lhe-selected="1"]').forEach((x) => x.removeAttribute('data-lhe-selected'));
    selectedEl = el; selectedEl.setAttribute('data-lhe-selected', '1');
    loadInspector(el); refreshButtons();
  }

  function ensurePositionable(el) {
    if (!isSafeMovable(el)) return false;
    if (!el.style.position) el.style.position = 'absolute';
    if (!el.style.left) setPx(el.style, 'left', el.offsetLeft || 0);
    if (!el.style.top) setPx(el.style, 'top', el.offsetTop || 0);
    if (!el.style.width) setPx(el.style, 'width', el.getBoundingClientRect().width);
    if (!el.style.height) setPx(el.style, 'height', el.getBoundingClientRect().height);
    return true;
  }

  function wireEditableClicks() {
    const doc = editFrame.contentDocument; if (!doc) return;
    doc.querySelectorAll('*').forEach((el) => {
      el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); selectElement(el); });
      if (isEditableText(el)) el.setAttribute('contenteditable', 'true');
      el.addEventListener('pointerdown', (e) => {
        if (model.mode !== 'edit') return;
        if (!isSafeMovable(el)) return;
        if (e.target !== el) return;
        if (!ensurePositionable(el)) { setStatus('Selected element is locked for movement.'); return; }
        selectElement(el);
        drag = { el, startX: e.clientX, startY: e.clientY, left: getPx(el.style, 'left'), top: getPx(el.style, 'top') };
      });
    });
    doc.addEventListener('pointermove', (e) => {
      if (!drag) return;
      setPx(drag.el.style, 'left', drag.left + (e.clientX - drag.startX));
      setPx(drag.el.style, 'top', drag.top + (e.clientY - drag.startY));
      loadInspector(drag.el);
    });
    doc.addEventListener('pointerup', () => {
      if (!drag) return;
      pushHistory(history, model); commitFrameToModel(); drag = null; render();
    });
  }

  function render() {
    slidesList.textContent = '';
    model.slides.forEach((s) => {
      const b = document.createElement('button'); b.textContent = s.label || s.name; b.className = s.id === model.selectedSlideId ? 'active' : '';
      b.onclick = () => { commitFrameToModel(); model.selectedSlideId = s.id; setFrameHtml(); };
      slidesList.appendChild(b);
    });
    setFrameHtml(); refreshButtons();
  }

  function applyStyle(fn) { if (!selectedEl || model.mode !== 'edit') return; pushHistory(history, model); fn(); commitFrameToModel(); render(); }

  fileInput.onchange = async () => { const f = fileInput.files?.[0]; if (!f) return; model = mapHtmlToModel(await f.text()); history.undo = []; history.redo = []; render(); setStatus(`Opened HTML: ${f.name}`); };
  previewBtn.onclick = () => { model.mode = 'preview'; selectedEl = null; render(); };
  editBtn.onclick = () => { model.mode = 'edit'; render(); };
  addTextBtn.onclick = () => applyStyle(() => { const doc = editFrame.contentDocument; const active = collectSlides(doc).find((s, i) => (s.getAttribute('data-slide-id') || `s${i + 1}`) === model.selectedSlideId) || doc.body; const p = doc.createElement('p'); p.textContent = 'New text'; p.style.position = 'absolute'; p.style.left = '80px'; p.style.top = '80px'; p.style.width = '280px'; p.style.minHeight = '30px'; active.appendChild(p); });
  addImageBtn.onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/png,image/jpeg,image/jpg,image/gif,image/webp,image/avif'; i.onchange = async () => { const f = i.files?.[0]; if (!f) return; const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f); }); applyStyle(() => { const doc = editFrame.contentDocument; const active = collectSlides(doc).find((s, idx) => (s.getAttribute('data-slide-id') || `s${idx + 1}`) === model.selectedSlideId) || doc.body; const img = doc.createElement('img'); img.src = data; img.style.position = 'absolute'; img.style.left = '80px'; img.style.top = '120px'; img.style.width = '240px'; img.style.height = '140px'; active.appendChild(img); }); }; i.click(); };
  delBtn.onclick = () => applyStyle(() => { if (selectedEl) selectedEl.remove(); selectedEl = null; });
  insText.onchange = () => applyStyle(() => { if (selectedEl && selectedEl.tagName !== 'IMG') selectedEl.textContent = insText.value; });
  insAlt.onchange = () => applyStyle(() => { if (selectedEl?.tagName === 'IMG') selectedEl.setAttribute('alt', insAlt.value); });
  insColor.onchange = () => applyStyle(() => { if (selectedEl) selectedEl.style.color = insColor.value; });
  insBg.onchange = () => applyStyle(() => { if (selectedEl) selectedEl.style.backgroundColor = insBg.value; });
  insFont.onchange = () => applyStyle(() => { if (selectedEl) selectedEl.style.fontSize = `${Number(insFont.value || 16)}px`; });
  insBold.onchange = () => applyStyle(() => { if (selectedEl) selectedEl.style.fontWeight = insBold.checked ? '700' : '400'; });
  [insX, insY, insW, insH].forEach((input) => input.onchange = () => applyStyle(() => { if (!selectedEl || !ensurePositionable(selectedEl)) return; setPx(selectedEl.style, 'left', Number(insX.value || 0)); setPx(selectedEl.style, 'top', Number(insY.value || 0)); setPx(selectedEl.style, 'width', Number(insW.value || 10)); setPx(selectedEl.style, 'height', Number(insH.value || 10)); }));
  undoBtn.onclick = () => { model = undo(history, model); render(); };
  redoBtn.onclick = () => { model = redo(history, model); render(); };
  saveBtn.onclick = () => { commitFrameToModel(); const text = JSON.stringify(createProjectPayload(model), null, 2); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = 'project.lheproj-v2.json'; a.click(); URL.revokeObjectURL(a.href); };
  openProjectBtn.onclick = () => openProjectInput.click();
  openProjectInput.onchange = async () => { const f = openProjectInput.files?.[0]; if (!f) return; const restored = restoreProjectPayload(JSON.parse(await f.text())); if (!restored) return; model = restored; render(); };
  exportBtn.onclick = () => { commitFrameToModel(); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exportModelToHtml(model)], { type: 'text/html' })); a.download = 'edited-v2.html'; a.click(); URL.revokeObjectURL(a.href); setStatus('Exported safe edited HTML (scripts removed).'); };

  render();
}

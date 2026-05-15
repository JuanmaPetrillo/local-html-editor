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

function getPx(style, key) { const v = style.getPropertyValue(key) || ''; const n = Number.parseFloat(v); return Number.isFinite(n) ? n : 0; }
function setPx(style, key, value) { style.setProperty(key, `${Math.round(value)}px`); }
function getPointerDistance(start, end) { return Math.hypot(end.x - start.x, end.y - start.y); }
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
export function createProjectPayload(model) { return { schema: 'lheproj-v2', version: 2, model: { sourceHtml: stripUnsafeHtml(model.sourceHtml), slides: model.slides, selectedSlideId: model.selectedSlideId, mode: model.mode === 'preview' ? 'preview' : 'edit' } }; }
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
  const selectedState = q('#selected-state');
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
  const editStage = q('#edit-stage');
  const editOverlay = q('#edit-overlay');
  const hoverBox = q('#hover-box');
  const selectionBox = q('#selection-box');

  let model = mapHtmlToModel('');
  const history = createHistory();
  let selectedEl = null;
  let activeEditingEl = null;
  let selectionId = '';

  const setStatus = (t) => { status.textContent = t; };

  function refreshButtons() {
    undoBtn.disabled = !canUndo(history);
    redoBtn.disabled = !canRedo(history);
    const editable = model.mode === 'edit';
    delBtn.disabled = !selectedEl || !editable;
    addTextBtn.disabled = !editable;
    addImageBtn.disabled = !editable;
    previewBtn.classList.toggle('active', model.mode === 'preview');
    editBtn.classList.toggle('active', model.mode === 'edit');
  }

  function describeSelected(el) {
    if (!el) {
      selectedState.textContent = 'Selected: none';
      return;
    }
    const editableText = ['H1', 'H2', 'H3', 'P', 'SPAN', 'BUTTON', 'DIV'].includes(el.tagName);
    const movable = isMovableByPosition(el);
    const resizable = movable && el.tagName !== 'BUTTON';
    const lock = movable ? '' : ' (move/resize locked: element is not absolute/fixed)';
    selectedState.textContent = `Selected: ${el.tagName.toLowerCase()} | text:${editableText ? 'yes' : 'no'} move:${movable ? 'yes' : 'no'} resize:${resizable ? 'yes' : 'no'}${lock}`;
  }

  function updateSlideVisibility(doc) {
    collectSlides(doc).forEach((slide, i) => {
      const id = slide.getAttribute('data-slide-id') || `s${i + 1}`;
      slide.style.display = id === model.selectedSlideId ? '' : 'none';
    });
  }

  function setFrameHtml() {
    editStage.style.display = model.mode === 'edit' ? 'block' : 'none';
    liveFrame.style.display = model.mode === 'preview' ? 'block' : 'none';
    if (model.mode === 'preview') {
      liveFrame.srcdoc = model.previewHtml;
      liveFrame.onload = () => { liveFrame.focus(); };
      modeEl.textContent = 'Interactive preview. Use this to test buttons/navigation. Switch to Edit to modify.';
      return;
    }
    editFrame.srcdoc = model.sourceHtml;
    modeEl.textContent = 'Edit mode. Click to select, double-click to edit text, drag to move. Ctrl+click to follow links.';
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
    insType.textContent = el.tagName.toLowerCase();
    insText.value = el.tagName === 'IMG' ? '' : (el.textContent || '');
    insAlt.value = ['IMG', 'BUTTON'].includes(el.tagName) ? (el.getAttribute('alt') || '') : '';
    insX.value = String(getPx(el.style, 'left'));
    insY.value = String(getPx(el.style, 'top'));
    insW.value = String(getPx(el.style, 'width') || Math.round(el.getBoundingClientRect().width));
    insH.value = String(getPx(el.style, 'height') || Math.round(el.getBoundingClientRect().height));
    insColor.value = rgbToHex(cs.color);
    insBg.value = rgbToHex(cs.backgroundColor);
    insFont.value = String(Math.round(parseFloat(cs.fontSize) || 16));
    insBold.checked = (cs.fontWeight === 'bold' || Number.parseInt(cs.fontWeight, 10) >= 600);
    const movable = isMovableByPosition(el);
    [insX, insY, insW, insH].forEach((input) => { input.disabled = !movable; });
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
    Array.from(active.querySelectorAll('h1,h2,h3,p,button,div,span,img')).slice(0, 120).forEach((el, i) => {
      const b = document.createElement('button');
      b.textContent = `${el.tagName.toLowerCase()} ${i + 1}`;
      b.onclick = () => selectElement(el);
      layersList.appendChild(b);
    });
  }

  function applySelectionMarker() {
    const doc = editFrame.contentDocument;
    if (!doc) return;
    doc.querySelectorAll('[data-lhe-selected]').forEach((x) => x.removeAttribute('data-lhe-selected'));
    if (!selectionId) { clearSelectionBox(); return; }
    const el = doc.querySelector(`[data-lhe-id="${selectionId}"]`);
    if (!el) {
      selectedEl = null;
      selectionId = '';
      describeSelected(null);
      clearSelectionBox();
      return;
    }
    selectedEl = el;
    updateSelectionBox(el);
    loadInspector(selectedEl);
    describeSelected(selectedEl);
  }

  function selectElement(el) {
    if (!el) return;
    if (!el.getAttribute('data-lhe-id')) el.setAttribute('data-lhe-id', `lhe-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`);
    selectionId = el.getAttribute('data-lhe-id') || '';
    selectedEl = el;
    applySelectionMarker();
    refreshButtons();
  }

  function finishTextEdit(commit) {
    if (!activeEditingEl) return;
    if (!commit && activeEditingEl.dataset.lheOriginalText !== undefined) activeEditingEl.textContent = activeEditingEl.dataset.lheOriginalText;
    activeEditingEl.removeAttribute('contenteditable');
    delete activeEditingEl.dataset.lheOriginalText;
    activeEditingEl = null;
    editOverlay.style.pointerEvents = 'all';
    if (commit) pushHistory(history, model);
    commitFrameToModel();
    render();
  }

  function enterTextEditMode(el) {
    if (!el || !['H1', 'H2', 'H3', 'P', 'SPAN', 'BUTTON', 'DIV'].includes(el.tagName)) return;
    activeEditingEl = el;
    el.dataset.lheOriginalText = el.textContent || '';
    el.setAttribute('contenteditable', 'true');
    editOverlay.style.pointerEvents = 'none';
    el.focus();
    describeSelected(el);
    setStatus('Text editing. Press Enter or click away to commit. Escape to cancel.');
  }

  function getIframeElementAt(clientX, clientY) {
    const doc = editFrame.contentDocument;
    if (!doc) return null;
    const r = editOverlay.getBoundingClientRect();
    const el = doc.elementFromPoint(clientX - r.left, clientY - r.top);
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
    selectionBox.style.display = 'block';
  }

  function clearSelectionBox() {
    selectionBox.style.display = 'none';
    hoverBox.style.display = 'none';
  }

  function wireOverlayInteractions() {
    const doc = editFrame.contentDocument;
    if (!doc) return;

    let hoveredEl = null;
    let overlayPointerDown = null;
    let overlayDragState = null;

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
      if (overlayPointerDown && !overlayDragState && !activeEditingEl) {
        if (getPointerDistance(overlayPointerDown, { x: e.clientX, y: e.clientY }) >= 4) {
          if (!isMovableByPosition(selectedEl)) {
            setStatus('Element is not absolute/fixed — use inspector X/Y fields to reposition.');
            overlayPointerDown = null;
          } else {
            overlayDragState = { el: selectedEl, startX: e.clientX, startY: e.clientY, left: getPx(selectedEl.style, 'left'), top: getPx(selectedEl.style, 'top') };
          }
        }
      }
      if (overlayDragState) {
        setPx(overlayDragState.el.style, 'left', overlayDragState.left + (e.clientX - overlayDragState.startX));
        setPx(overlayDragState.el.style, 'top', overlayDragState.top + (e.clientY - overlayDragState.startY));
        updateSelectionBox(overlayDragState.el);
        loadInspector(overlayDragState.el);
      }
    };

    editOverlay.onclick = (e) => {
      const iframeEl = getIframeElementAt(e.clientX, e.clientY);
      if (e.ctrlKey || e.metaKey) {
        if (iframeEl) iframeEl.click();
        return;
      }
      if (activeEditingEl && iframeEl !== activeEditingEl) { finishTextEdit(true); return; }
      if (iframeEl) selectElement(iframeEl);
      else { selectedEl = null; selectionId = ''; clearSelectionBox(); describeSelected(null); refreshButtons(); }
    };

    editOverlay.ondblclick = (e) => {
      const iframeEl = getIframeElementAt(e.clientX, e.clientY);
      if (!iframeEl) return;
      selectElement(iframeEl);
      enterTextEditMode(iframeEl);
    };

    editOverlay.onpointerdown = (e) => {
      if (activeEditingEl || !selectedEl) return;
      const iframeEl = getIframeElementAt(e.clientX, e.clientY);
      if (iframeEl && iframeEl === selectedEl) {
        overlayPointerDown = { x: e.clientX, y: e.clientY };
        editOverlay.setPointerCapture(e.pointerId);
      }
    };

    editOverlay.onpointerup = () => {
      overlayPointerDown = null;
      if (overlayDragState) {
        pushHistory(history, model);
        commitFrameToModel();
        overlayDragState = null;
        render();
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

  function render() {
    slidesList.textContent = '';
    model.slides.forEach((s) => {
      const b = document.createElement('button');
      b.textContent = s.label || s.name;
      b.className = s.id === model.selectedSlideId ? 'active' : '';
      b.onclick = () => {
        if (model.mode === 'edit') commitFrameToModel();
        model.selectedSlideId = s.id;
        setFrameHtml();
        refreshButtons();
      };
      slidesList.appendChild(b);
    });
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
  }

  fileInput.onchange = async () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    model = mapHtmlToModel(await f.text());
    history.undo = [];
    history.redo = [];
    selectedEl = null;
    selectionId = '';
    render();
    setStatus(`Opened HTML: ${f.name}`);
  };
  previewBtn.onclick = () => { model.mode = 'preview'; selectedEl = null; selectionId = ''; render(); };
  editBtn.onclick = () => { model.mode = 'edit'; render(); };
  addTextBtn.onclick = () => {
    pushHistory(history, model);
    commitFrameToModel();
    model = addTextBlockToSlide(model, 'New text');
    render();
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

  delBtn.onclick = () => applyStyle(() => { if (selectedEl) selectedEl.remove(); selectedEl = null; selectionId = ''; });
  insText.onchange = () => applyStyle(() => { if (selectedEl && selectedEl.tagName !== 'IMG') selectedEl.textContent = insText.value; });
  insAlt.onchange = () => applyStyle(() => { if (selectedEl?.tagName === 'IMG' || selectedEl?.tagName === 'BUTTON') selectedEl.setAttribute('alt', insAlt.value); });
  insColor.onchange = () => applyStyle(() => { if (selectedEl) selectedEl.style.color = insColor.value; });
  insBg.onchange = () => applyStyle(() => { if (selectedEl) selectedEl.style.backgroundColor = insBg.value; });
  insFont.onchange = () => applyStyle(() => { if (selectedEl) selectedEl.style.fontSize = `${Number(insFont.value || 16)}px`; });
  insBold.onchange = () => applyStyle(() => { if (selectedEl) selectedEl.style.fontWeight = insBold.checked ? '700' : '400'; });
  [insX, insY, insW, insH].forEach((input) => input.onchange = () => applyStyle(() => {
    if (!selectedEl || !isMovableByPosition(selectedEl)) return;
    const x = Number(insX.value); const y = Number(insY.value); const w = Number(insW.value); const h = Number(insH.value);
    if (Number.isFinite(x)) setPx(selectedEl.style, 'left', x);
    if (Number.isFinite(y)) setPx(selectedEl.style, 'top', y);
    if (Number.isFinite(w) && w > 0) setPx(selectedEl.style, 'width', w);
    if (Number.isFinite(h) && h > 0) setPx(selectedEl.style, 'height', h);
  }));

  undoBtn.onclick = () => { model = undo(history, model); render(); };
  redoBtn.onclick = () => { model = redo(history, model); render(); };
  saveBtn.onclick = () => {
    commitFrameToModel();
    const text = JSON.stringify(createProjectPayload(model), null, 2);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = 'project.lheproj-v2.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  openProjectBtn.onclick = () => openProjectInput.click();
  openProjectInput.onchange = async () => {
    const f = openProjectInput.files?.[0];
    if (!f) return;
    const restored = restoreProjectPayload(JSON.parse(await f.text()));
    if (!restored) return;
    model = restored;
    render();
  };
  exportBtn.onclick = () => {
    commitFrameToModel();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([exportModelToHtml(model)], { type: 'text/html' }));
    a.download = 'edited-v2.html';
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus('Exported safe edited HTML (scripts removed).');
  };

  render();
}

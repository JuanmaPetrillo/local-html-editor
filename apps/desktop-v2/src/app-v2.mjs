const hasDom = typeof document !== 'undefined';

export function escapeHtml(s) { return String(s || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
export function escapeAttribute(v) { return String(v || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }

function stripUnsafeHtml(inputHtml) {
  const cleaned = String(inputHtml || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z0-9_-]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z0-9_-]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z0-9_-]+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript\s*:/gi, '');
  const remoteBlocked = cleaned
    .replace(/\s(src|href|poster)\s*=\s*"([^"]*)"/gi, (_m, n, val) => (/^(https?:|\/\/)/i.test(val.trim()) ? '' : ` ${n}="${escapeAttribute(val)}"`))
    .replace(/\s(src|href|poster)\s*=\s*'([^']*)'/gi, (_m, n, val) => (/^(https?:|\/\/)/i.test(val.trim()) ? '' : ` ${n}='${escapeAttribute(val)}'`));
  return remoteBlocked.replace(/<(img|source|video|audio|track|embed|object|iframe|link)\b([^>]*?)>/gi, (full, tag, attrs) => {
    const rewritten = attrs
      .replace(/\s(src|href|poster)\s*=\s*"([^"]*)"/gi, (_m, n, val) => (/^(https?:|\/\/)/i.test(val.trim()) ? '' : ` ${n}="${escapeAttribute(val)}"`))
      .replace(/\s(src|href|poster)\s*=\s*'([^']*)'/gi, (_m, n, val) => (/^(https?:|\/\/)/i.test(val.trim()) ? '' : ` ${n}='${escapeAttribute(val)}'`));
    return `<${tag}${rewritten}>`;
  });
}

function collectSlides(doc) {
  const nodes = Array.from(doc.querySelectorAll('.slide'));
  if (nodes.length) return nodes;
  return [doc.body];
}

function replaceFirstTextInTag(html, tagName, replacementText) {
  const re = new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  return String(html).replace(re, (_m, attrs) => `<${tagName}${attrs}>${escapeHtml(replacementText)}</${tagName}>`);
}

function getSlideRegexById(slideId) {
  return new RegExp(`<(section|div)\\b[^>]*class\\s*=\\s*["'][^"']*slide[^"']*["'][^>]*data-slide-id\\s*=\\s*["']${slideId}["'][^>]*>[\\s\\S]*?<\\/\\1>`, 'i');
}

export function editHeadingTextInModel(modelInput, newText) {
  const model = { ...modelInput };
  model.sourceHtml = replaceFirstTextInTag(model.sourceHtml, 'h1', newText);
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
  const updated = target.replace(new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}>`, 'i'), '');
  model.sourceHtml = String(model.sourceHtml).replace(getSlideRegexById(slideId), updated);
  return mapHtmlToModel(model.sourceHtml);
}

export function mapHtmlToModel(htmlText) {
  const sanitizedHtml = stripUnsafeHtml(htmlText);
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
    return { version: 2, sourceHtml: sanitizedHtml, slides: slides.length ? slides : [{ id: 's1', name: 'Slide 1', label: 'Slide 1' }], selectedSlideId: slides[0]?.id || 's1', selectedObjectSelector: null, nextId: 1 };
  }
  const doc = new DOMParser().parseFromString(sanitizedHtml, 'text/html');
  const slides = collectSlides(doc).map((el, i) => ({ id: el.getAttribute('data-slide-id') || `s${i + 1}`, name: el.getAttribute('data-label') || `Slide ${i + 1}`, label: el.getAttribute('data-label') || `Slide ${i + 1}` }));
  return { version: 2, sourceHtml: sanitizedHtml, slides, selectedSlideId: slides[0]?.id || 's1', selectedObjectSelector: null, nextId: 1 };
}

export function exportModelToHtml(modelInput) {
  return String(modelInput?.sourceHtml || '');
}

export function createProjectPayload(model) { return { schema: 'lheproj-v2', version: 2, model }; }
export function restoreProjectPayload(payload) { return payload && payload.schema === 'lheproj-v2' && payload.version === 2 ? payload.model : null; }
export function createHistory() { return { undo: [], redo: [] }; }
export function snapshot(model) { return JSON.parse(JSON.stringify(model)); }
export function pushHistory(history, model) { history.undo.push(snapshot(model)); if (history.undo.length > 100) history.undo.shift(); history.redo = []; }
export function undo(history, model) { if (!history.undo.length) return model; history.redo.push(snapshot(model)); return history.undo.pop(); }
export function redo(history, model) { if (!history.redo.length) return model; history.undo.push(snapshot(model)); return history.redo.pop(); }
export function canUndo(history) { return history.undo.length > 0; }
export function canRedo(history) { return history.redo.length > 0; }

if (hasDom) {
  const q = (s) => document.querySelector(s);
  const frame = q('#preview-frame');
  const status = q('#status');
  const slidesList = q('#slides');
  const layersList = q('#layers');
  const fileInput = q('#file');
  const openProjectInput = q('#open-project-file');
  const addTextBtn = q('#add-text');
  const addImageBtn = q('#add-image');
  const delBtn = q('#delete');
  const undoBtn = q('#undo');
  const redoBtn = q('#redo');
  const saveBtn = q('#save-project');
  const openProjectBtn = q('#open-project');
  const exportBtn = q('#export');
  const insType = q('#ins-type'); const insText = q('#ins-text');

  let model = mapHtmlToModel('');
  const history = createHistory();
  let selectedEl = null;

  const setStatus = (t) => { status.textContent = t; };
  const refreshButtons = () => { undoBtn.disabled = !canUndo(history); redoBtn.disabled = !canRedo(history); delBtn.disabled = !selectedEl; };

  function setFrameHtml() {
    frame.srcdoc = model.sourceHtml;
    frame.onload = () => {
      const doc = frame.contentDocument;
      if (!doc) return;
      const style = doc.createElement('style');
      style.textContent = '[data-lhe-selected="1"]{outline:2px solid #2563eb !important;}';
      doc.head.appendChild(style);
      wireSlideVisibility();
      wireEditableClicks();
      refreshLayers();
    };
  }

  function wireSlideVisibility() {
    const doc = frame.contentDocument;
    if (!doc) return;
    const slides = collectSlides(doc);
    slides.forEach((slide, i) => {
      const id = slide.getAttribute('data-slide-id') || `s${i + 1}`;
      slide.style.display = id === model.selectedSlideId ? '' : 'none';
    });
  }

  function isEditableText(el) {
    return !!el && ['H1','H2','H3','P','SPAN','BUTTON','DIV'].includes(el.tagName) && el.textContent.trim();
  }

  function refreshLayers() {
    layersList.textContent = '';
    const doc = frame.contentDocument;
    if (!doc) return;
    const active = collectSlides(doc).find((s, i) => (s.getAttribute('data-slide-id') || `s${i + 1}`) === model.selectedSlideId);
    if (!active) return;
    Array.from(active.querySelectorAll('h1,h2,h3,p,button,div,span,img')).slice(0, 120).forEach((el, i) => {
      if (!isEditableText(el) && el.tagName !== 'IMG') return;
      const b = document.createElement('button');
      b.textContent = `${el.tagName.toLowerCase()} ${i + 1}`;
      b.onclick = () => selectElement(el);
      layersList.appendChild(b);
    });
  }

  function selectElement(el) {
    const doc = frame.contentDocument;
    if (!doc) return;
    doc.querySelectorAll('[data-lhe-selected="1"]').forEach((x) => x.removeAttribute('data-lhe-selected'));
    selectedEl = el;
    selectedEl.setAttribute('data-lhe-selected', '1');
    insType.textContent = selectedEl.tagName.toLowerCase();
    insText.value = selectedEl.tagName === 'IMG' ? '' : selectedEl.textContent;
    refreshButtons();
  }

  function wireEditableClicks() {
    const doc = frame.contentDocument;
    if (!doc) return;
    doc.querySelectorAll('*').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (isEditableText(el) || el.tagName === 'IMG') selectElement(el);
      });
      if (isEditableText(el)) {
        el.setAttribute('contenteditable', 'true');
        el.addEventListener('input', () => {
          if (selectedEl === el) insText.value = el.textContent;
        });
      }
    });
  }

  function serializeDoc() {
    const doc = frame.contentDocument;
    if (!doc) return;
    doc.querySelectorAll('[data-lhe-selected]').forEach((x) => x.removeAttribute('data-lhe-selected'));
    model.sourceHtml = '<!doctype html>\n' + doc.documentElement.outerHTML;
  }

  function render() {
    slidesList.textContent = '';
    model.slides.forEach((s) => {
      const b = document.createElement('button'); b.textContent = s.label || s.name; b.className = s.id === model.selectedSlideId ? 'active' : '';
      b.onclick = () => { model.selectedSlideId = s.id; setFrameHtml(); };
      slidesList.appendChild(b);
    });
    setFrameHtml();
    refreshButtons();
  }

  fileInput.onchange = async () => { const f = fileInput.files?.[0]; if (!f) return; model = mapHtmlToModel(await f.text()); history.undo = []; history.redo = []; render(); setStatus(`Opened HTML: ${f.name}`); };
  addTextBtn.onclick = () => {
    const doc = frame.contentDocument; if (!doc) return; const active = collectSlides(doc).find((s, i) => (s.getAttribute('data-slide-id') || `s${i + 1}`) === model.selectedSlideId) || doc.body;
    const p = doc.createElement('p'); p.textContent = 'New text'; p.style.position = 'absolute'; p.style.left = '80px'; p.style.top = '80px'; p.style.width = '280px'; p.style.minHeight = '30px';
    active.appendChild(p); serializeDoc(); model = mapHtmlToModel(model.sourceHtml); render();
  };
  addImageBtn.onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/png,image/jpeg,image/jpg,image/gif,image/webp,image/avif'; i.onchange = async () => { const f = i.files?.[0]; if (!f) return; const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f); }); const doc = frame.contentDocument; if (!doc) return; const active = collectSlides(doc).find((s, idx) => (s.getAttribute('data-slide-id') || `s${idx + 1}`) === model.selectedSlideId) || doc.body; const img = doc.createElement('img'); img.src = data; img.style.position = 'absolute'; img.style.left = '80px'; img.style.top = '120px'; img.style.width = '240px'; img.style.height = '140px'; active.appendChild(img); serializeDoc(); model = mapHtmlToModel(model.sourceHtml); render(); }; i.click(); };
  delBtn.onclick = () => { if (!selectedEl) return; selectedEl.remove(); selectedEl = null; serializeDoc(); model = mapHtmlToModel(model.sourceHtml); render(); };
  insText.onchange = () => { if (!selectedEl || selectedEl.tagName === 'IMG') return; selectedEl.textContent = insText.value; serializeDoc(); };
  undoBtn.onclick = () => { model = undo(history, model); render(); };
  redoBtn.onclick = () => { model = redo(history, model); render(); };
  saveBtn.onclick = () => { const text = JSON.stringify(createProjectPayload(model), null, 2); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = 'project.lheproj-v2.json'; a.click(); URL.revokeObjectURL(a.href); };
  openProjectBtn.onclick = () => openProjectInput.click();
  openProjectInput.onchange = async () => { const f = openProjectInput.files?.[0]; if (!f) return; const restored = restoreProjectPayload(JSON.parse(await f.text())); if (!restored) return; model = restored; render(); };
  exportBtn.onclick = () => { serializeDoc(); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exportModelToHtml(model)], { type: 'text/html' })); a.download = 'edited-v2.html'; a.click(); URL.revokeObjectURL(a.href); };

  render();
}

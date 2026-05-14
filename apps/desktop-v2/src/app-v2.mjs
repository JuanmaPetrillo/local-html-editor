const hasDom = typeof document !== 'undefined';
const ALLOWED_TEXT_TAGS = new Set(['h1', 'h2', 'h3', 'p', 'span', 'div', 'button']);

export function escapeHtml(s) { return String(s || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
export function escapeAttribute(v) { return String(v || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
function parsePx(style, key, fallback) { const m = new RegExp(`${key}\\s*:\\s*([0-9.]+)px`, 'i').exec(style || ''); return m ? Number(m[1]) : fallback; }
function getAttr(tag, name) { const m = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i').exec(tag) || new RegExp(`${name}\\s*=\\s*'([^']*)'`, 'i').exec(tag); return m ? m[1] : ''; }
function getDataAttrs(tag) { const out = {}; for (const m of tag.matchAll(/\s(data-[a-z0-9_-]+)\s*=\s*"([^"]*)"/gi)) out[m[1]] = m[2]; for (const m of tag.matchAll(/\s(data-[a-z0-9_-]+)\s*=\s*'([^']*)'/gi)) out[m[1]] = m[2]; return out; }
function parseTextFromTag(tag) { return String(tag || '').replace(/^<[^>]+>/, '').replace(/<\/[^>]+>$/, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function stripTags(s) { return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function parseStyleRules(htmlText) {
  const rules = new Map();
  for (const m of String(htmlText).matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const css = m[1] || '';
    for (const r of css.matchAll(/\.([a-z0-9_-]+)\s*\{([^}]*)\}/gi)) {
      const cls = r[1]; const body = r[2] || ''; const item = rules.get(cls) || {};
      for (const k of ['left', 'top', 'width', 'height']) { const pm = new RegExp(`${k}\\s*:\\s*([0-9.]+)px`, 'i').exec(body); if (pm) item[k] = Number(pm[1]); }
      const bm = /background-image\s*:\s*url\(([^)]+)\)/i.exec(body); if (bm) item.backgroundImage = String(bm[1]).replace(/^["']|["']$/g, '');
      rules.set(cls, item);
    }
  }
  return rules;
}
function getMergedClassRule(className, styleRules) { const merged = {}; for (const cls of String(className || '').trim().split(/\s+/)) { if (!cls) continue; Object.assign(merged, styleRules.get(cls) || {}); } return merged; }
function getBackgroundUrl(style, className, styleRules) { const classRule = getMergedClassRule(className, styleRules); const inline = /background-image\s*:\s*url\(([^)]+)\)/i.exec(style || ''); const raw = inline ? inline[1] : classRule.backgroundImage || ''; return String(raw || '').trim().replace(/^["']|["']$/g, ''); }
function resolveGeometry(style, className, styleRules, fallback, inheritedGeometry = null) { const classRule = getMergedClassRule(className, styleRules); const base = inheritedGeometry || fallback; return normalizeGeometry({ x: parsePx(style, 'left', classRule.left ?? base.x), y: parsePx(style, 'top', classRule.top ?? base.y), w: parsePx(style, 'width', classRule.width ?? base.w), h: parsePx(style, 'height', classRule.height ?? base.h) }); }

export function classifyImageSource(src) { const value = String(src || '').trim(); const safe = /^data:image\/(png|jpeg|jpg|gif|webp|avif);base64,[a-z0-9+/=]+$/i.test(value); return { safe, normalizedSrc: safe ? value : '' }; }
function classifyBackgroundSource(src) { const value = String(src || '').trim(); if (!value) return { kind: 'none', value: '' }; const safe = classifyImageSource(value); if (safe.safe) return { kind: 'safe', value: safe.normalizedSrc }; return { kind: 'blocked', value: '' }; }

function tokenizeHtmlTags(html) {
  const tokens = []; const re = /<\/?[a-zA-Z][^>]*>/g; let m;
  while ((m = re.exec(String(html || '')))) {
    const raw = m[0]; const isClose = /^<\//.test(raw); const name = (raw.match(/^<\/?\s*([a-z0-9:-]+)/i) || [])[1]?.toLowerCase() || ''; const selfClosing = /\/\s*>$/.test(raw) || ['img', 'br', 'hr', 'meta', 'link', 'input'].includes(name);
    tokens.push({ raw, name, isClose, selfClosing, start: m.index, end: re.lastIndex });
  }
  return tokens;
}
function findSlideContainers(html) {
  const tokens = tokenizeHtmlTags(html); const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]; if (t.isClose || t.selfClosing || !['section', 'div', 'article'].includes(t.name)) continue;
    if (!/(class\s*=\s*"[^"]*\bslide\b[^"]*"|class\s*=\s*'[^']*\bslide\b[^']*'|data-slide-id\s*=)/i.test(t.raw)) continue;
    let depth = 1; let j = i + 1;
    for (; j < tokens.length; j++) { const n = tokens[j]; if (n.name !== t.name) continue; if (!n.isClose && !n.selfClosing) depth += 1; if (n.isClose) depth -= 1; if (depth === 0) break; }
    if (depth === 0) out.push({ openTag: t.raw, body: String(html).slice(t.end, tokens[j].start), start: t.start, end: tokens[j].end });
  }
  return out;
}

function nextId(model, p = 'o') { return `${p}${model.nextId++}`; }
function safeNum(v, fallback) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function normalizeGeometry(obj) { return { x: Math.max(0, safeNum(obj?.x, 20)), y: Math.max(0, safeNum(obj?.y, 20)), w: Math.max(20, safeNum(obj?.w, 120)), h: Math.max(20, safeNum(obj?.h, 40)) }; }
function normalizeDataAttrs(raw) { const out = {}; for (const [k, v] of Object.entries(raw || {})) if (/^data-[a-z0-9_-]+$/i.test(k)) out[k] = String(v ?? ''); return out; }

function parseSlideObjects(slideBody, indexStart, styleRules = new Map()) {
  const objects = []; let i = indexStart;
  const matches = slideBody.matchAll(/<(h1|h2|h3|p|span|button|div)\b[^>]*>[\s\S]*?<\/\1>|<img\b[^>]*>|<(?!\/)([^\s>\/]+)\b[^>]*>/gi);
  for (const m of matches) {
    const tag = m[0]; const tagName = (m[1] || m[2] || '').toLowerCase(); const style = getAttr(tag, 'style'); const className = getAttr(tag, 'class');
    if (tag.toLowerCase().startsWith('<img')) {
      const src = classifyImageSource(getAttr(tag, 'src')); const g = resolveGeometry(style, className, styleRules, { x: 20, y: 20 + i * 18, w: 180, h: 120 });
      if (src.safe) objects.push({ id: `o${i++}`, type: 'image', src: src.normalizedSrc, ...g, alt: getAttr(tag, 'alt'), className, dataAttrs: getDataAttrs(tag), lockedReason: '' });
      else objects.push({ id: `o${i++}`, type: 'locked', label: 'Blocked remote image', ...g, lockedReason: 'blocked-remote-image' });
      continue;
    }
    if (!tagName || ['section', 'body', 'html', 'head', 'meta', 'title', 'style', 'script'].includes(tagName)) continue;

    const bg = classifyBackgroundSource(getBackgroundUrl(style, className, styleRules));
    const textValue = parseTextFromTag(tag);
    const nestedImg = /<img\b/i.test(tag);
    const g = resolveGeometry(style, className, styleRules, { x: 20, y: 20 + i * 18, w: 300, h: 40 });

    if (bg.kind === 'safe' && !textValue) { objects.push({ id: `o${i++}`, type: 'image', src: bg.value, ...g, alt: '', className, dataAttrs: getDataAttrs(tag), lockedReason: '' }); continue; }
    if (bg.kind === 'blocked' && !textValue) { objects.push({ id: `o${i++}`, type: 'locked', label: 'Blocked remote background image', ...g, lockedReason: 'blocked-remote-background-image' }); continue; }

    if (ALLOWED_TEXT_TAGS.has(tagName)) {
      if (tagName === 'div' && nestedImg && !textValue) continue;
      if (!textValue) continue;
      objects.push({ id: `o${i++}`, type: 'text', tagName, text: textValue, ...g, className, dataAttrs: getDataAttrs(tag) });
      continue;
    }

    const fallbackText = stripTags(tag);
    if (fallbackText) objects.push({ id: `o${i++}`, type: 'text', tagName: 'div', text: fallbackText, ...g, className, dataAttrs: getDataAttrs(tag) });
    else objects.push({ id: `o${i++}`, type: 'locked', label: `Locked: <${tagName}>`, ...g, lockedReason: 'unsupported-element' });
  }

  for (const im of slideBody.matchAll(/<img\b[^>]*>/gi)) {
    const tag = im[0];
    const src = classifyImageSource(getAttr(tag, 'src'));
    const className = getAttr(tag, 'class');
    const style = getAttr(tag, 'style');
    const g = resolveGeometry(style, className, styleRules, { x: 20, y: 20 + i * 18, w: 180, h: 120 });
    if (objects.some((o) => o.type === 'image' && o.x === g.x && o.y === g.y && o.w === g.w && o.h === g.h)) continue;
    if (src.safe) objects.push({ id: `o${i++}`, type: 'image', src: src.normalizedSrc, ...g, alt: getAttr(tag, 'alt'), className, dataAttrs: getDataAttrs(tag), lockedReason: '' });
    else objects.push({ id: `o${i++}`, type: 'locked', label: 'Blocked remote image', ...g, lockedReason: 'blocked-remote-image' });
  }

  return { objects, nextIndex: i };
}

export function normalizeObject(input, index) {
  const g = normalizeGeometry(input || {});
  if (input?.type === 'text') return { id: String(input.id || `o${index}`), type: 'text', tagName: ALLOWED_TEXT_TAGS.has(String(input.tagName || '').toLowerCase()) ? String(input.tagName).toLowerCase() : 'div', text: String(input.text || ''), ...g, className: String(input.className || ''), dataAttrs: normalizeDataAttrs(input.dataAttrs) };
  if (input?.type === 'image') {
    const checked = classifyImageSource(input.src);
    if (!checked.safe) return { id: String(input.id || `o${index}`), type: 'locked', label: 'Blocked remote image', ...g, lockedReason: 'blocked-remote-image' };
    return { id: String(input.id || `o${index}`), type: 'image', src: checked.normalizedSrc, ...g, alt: String(input.alt || ''), className: String(input.className || ''), dataAttrs: normalizeDataAttrs(input.dataAttrs), lockedReason: '' };
  }
  return { id: String(input?.id || `o${index}`), type: 'locked', label: String(input?.label || 'Locked object'), ...g, lockedReason: String(input?.lockedReason || 'unsupported-object') };
}
export function normalizeSlide(input, index) { const objects = Array.isArray(input?.objects) ? input.objects.map((o, i) => normalizeObject(o, i + 1)) : []; return { id: String(input?.id || `s${index + 1}`), name: String(input?.name || `Slide ${index + 1}`), width: Math.max(100, safeNum(input?.width, 960)), height: Math.max(100, safeNum(input?.height, 540)), objects }; }
export function normalizeModelForUse(inputModel) { const slides = Array.isArray(inputModel?.slides) ? inputModel.slides.map((s, i) => normalizeSlide(s, i)) : [normalizeSlide({}, 0)]; const selectedSlideId = slides.some((s) => s.id === inputModel?.selectedSlideId) ? inputModel.selectedSlideId : slides[0].id; const selectedObjectId = slides.find((s) => s.id === selectedSlideId)?.objects.some((o) => o.id === inputModel?.selectedObjectId) ? inputModel.selectedObjectId : null; const maxId = slides.flatMap((s) => s.objects).reduce((m, o) => Math.max(m, Number(String(o.id).replace(/\D/g, '')) || 0), 0); return { version: 2, slides, selectedSlideId, selectedObjectId, nextId: Math.max(maxId + 1, safeNum(inputModel?.nextId, maxId + 1)) }; }

export function mapHtmlToModel(htmlText) {
  const slidesFound = findSlideContainers(htmlText);
  const slidesRaw = slidesFound.length ? slidesFound.map((m, idx) => ({ id: getAttr(m.openTag, 'data-slide-id') || `s${idx + 1}`, name: `Slide ${idx + 1}`, width: 960, height: 540, body: m.body })) : [{ id: 's1', name: 'Slide 1', width: 960, height: 540, body: String(htmlText || '') }];
  const styleRules = parseStyleRules(htmlText);
  const slides = []; let i = 0;
  for (const s of slidesRaw) { const parsed = parseSlideObjects(s.body, i, styleRules); i = parsed.nextIndex; slides.push({ id: s.id, name: s.name, width: s.width, height: s.height, objects: parsed.objects }); }
  return normalizeModelForUse({ version: 2, slides, selectedSlideId: slides[0]?.id || 's1', selectedObjectId: null, nextId: i + 1 });
}

function objectToHtml(o) {
  if (o.type === 'text') { const attrs = `${o.className ? ` class="${escapeAttribute(o.className)}"` : ''}${Object.entries(o.dataAttrs || {}).map(([k, v]) => ` ${k}="${escapeAttribute(v)}"`).join('')}`; return `<${o.tagName}${attrs} style="position:absolute;left:${o.x}px;top:${o.y}px;width:${o.w}px;height:${o.h}px;">${escapeHtml(o.text)}</${o.tagName}>`; }
  if (o.type === 'image') { const attrs = `${o.className ? ` class="${escapeAttribute(o.className)}"` : ''} alt="${escapeAttribute(o.alt || '')}"${Object.entries(o.dataAttrs || {}).map(([k, v]) => ` ${k}="${escapeAttribute(v)}"`).join('')}`; return `<img src="${escapeAttribute(o.src)}"${attrs} style="position:absolute;left:${o.x}px;top:${o.y}px;width:${o.w}px;height:${o.h}px;"/>`; }
  return `<div style="position:absolute;left:${o.x}px;top:${o.y}px;width:${o.w}px;height:${o.h}px;border:1px dashed #999;background:#f3f4f6;color:#374151;">${escapeHtml(o.label || 'Locked object')}</div>`;
}

export function exportModelToHtml(modelInput) { const model = normalizeModelForUse(modelInput); const css = '.slide{position:relative;margin:12px auto;border:1px solid #ddd;background:#fff;}'; const slides = model.slides.map((s, idx) => `<section class="slide" data-slide-id="${escapeAttribute(s.id)}" data-slide-index="${idx}" style="width:${s.width}px;height:${s.height}px;">${s.objects.map(objectToHtml).join('\n')}</section>`).join('\n'); return `<!doctype html><html><head><meta charset="UTF-8"><title>Edited Presentation</title><style>${css}</style></head><body>${slides}</body></html>`; }
export function createProjectPayload(model) { return { schema: 'lheproj-v2', version: 2, model: normalizeModelForUse(model) }; }
export function restoreProjectPayload(payload) { return payload && payload.schema === 'lheproj-v2' && payload.version === 2 ? normalizeModelForUse(payload.model) : null; }
export function createHistory() { return { undo: [], redo: [] }; }
export function snapshot(model) { return JSON.parse(JSON.stringify(model)); }
export function pushHistory(history, model) { history.undo.push(snapshot(model)); if (history.undo.length > 100) history.undo.shift(); history.redo = []; }
export function undo(history, model) { if (!history.undo.length) return model; history.redo.push(snapshot(model)); return history.undo.pop(); }
export function redo(history, model) { if (!history.redo.length) return model; history.undo.push(snapshot(model)); return history.redo.pop(); }
export function canUndo(history) { return history.undo.length > 0; }
export function canRedo(history) { return history.redo.length > 0; }
export function selectSlide(model, id) { model.selectedSlideId = id; model.selectedObjectId = null; }
export function findSelectedObject(model) { const s = model.slides.find((x) => x.id === model.selectedSlideId); return s?.objects.find((o) => o.id === model.selectedObjectId) || null; }
export function updateObject(model, id, patch) { for (const s of model.slides) { const o = s.objects.find((x) => x.id === id); if (o) Object.assign(o, normalizeGeometry({ ...o, ...patch })); } }
export function deleteSelectedObject(model) { for (const s of model.slides) s.objects = s.objects.filter((o) => o.id !== model.selectedObjectId); model.selectedObjectId = null; }
export function addTextObject(model) { const s = model.slides.find((x) => x.id === model.selectedSlideId) || model.slides[0]; const o = normalizeObject({ id: nextId(model), type: 'text', tagName: 'p', text: 'New text', x: 80, y: 80, w: 260, h: 40, className: '', dataAttrs: {} }, model.nextId); s.objects.push(o); model.selectedObjectId = o.id; return o; }
export function addImageObject(model, src) { const s = model.slides.find((x) => x.id === model.selectedSlideId) || model.slides[0]; const o = normalizeObject({ id: nextId(model), type: 'image', src, x: 80, y: 80, w: 240, h: 140, alt: '', className: '', dataAttrs: {} }, model.nextId); s.objects.push(o); model.selectedObjectId = o.id; return o; }
export function beginInteraction(beforeModel, targetId) { return { targetId, before: snapshot(beforeModel), changed: false }; }
export function markInteractionChanged(state) { if (state) state.changed = true; }
export function commitInteraction(history, state) { if (state && state.changed) { history.undo.push(state.before); if (history.undo.length > 100) history.undo.shift(); history.redo = []; } return null; }

if (hasDom) {
  const q = (s) => document.querySelector(s);
  const canvas = q('#canvas'); const status = q('#status'); const slidesList = q('#slides'); const layersList = q('#layers');
  const fileInput = q('#file'); const openProjectInput = q('#open-project-file'); const addTextBtn = q('#add-text'); const addImageBtn = q('#add-image'); const delBtn = q('#delete'); const undoBtn = q('#undo'); const redoBtn = q('#redo'); const saveBtn = q('#save-project'); const openProjectBtn = q('#open-project'); const exportBtn = q('#export');
  const insType = q('#ins-type'); const insX = q('#ins-x'); const insY = q('#ins-y'); const insW = q('#ins-w'); const insH = q('#ins-h'); const insText = q('#ins-text'); const insAlt = q('#ins-alt');
  let model = mapHtmlToModel(''); let drag = null; let resize = null; let editingId = null; let interaction = null; const history = createHistory();
  const currentSlide = () => model.slides.find((s) => s.id === model.selectedSlideId) || model.slides[0];
  const setStatus = (t) => { status.textContent = t; };
  const refreshButtons = () => { undoBtn.disabled = !canUndo(history); redoBtn.disabled = !canRedo(history); delBtn.disabled = !model.selectedObjectId; };
  function renderInspector() { const o = findSelectedObject(model); insType.textContent = o ? o.type : 'none'; [insX, insY, insW, insH, insText, insAlt].forEach((el) => { el.disabled = !o; }); if (!o) { insX.value = ''; insY.value = ''; insW.value = ''; insH.value = ''; insText.value = ''; insAlt.value = ''; return; } insX.value = o.x; insY.value = o.y; insW.value = o.w; insH.value = o.h; insText.value = o.type === 'text' ? o.text : ''; insAlt.value = o.type === 'image' ? (o.alt || '') : ''; insText.disabled = o.type !== 'text'; insAlt.disabled = o.type !== 'image'; }
  function render() {
    model = normalizeModelForUse(model);
    slidesList.textContent = ''; model.slides.forEach((s) => { const b = document.createElement('button'); b.textContent = s.name; b.className = s.id === model.selectedSlideId ? 'active' : ''; b.onclick = () => { pushHistory(history, model); selectSlide(model, s.id); render(); }; slidesList.appendChild(b); });
    layersList.textContent = ''; currentSlide().objects.forEach((o) => { const b = document.createElement('button'); b.textContent = `${o.type} ${o.id}`; b.className = o.id === model.selectedObjectId ? 'active' : ''; b.onclick = () => { model.selectedObjectId = o.id; render(); }; layersList.appendChild(b); });
    canvas.style.width = `${currentSlide().width}px`; canvas.style.height = `${currentSlide().height}px`; canvas.textContent = '';
    currentSlide().objects.forEach((o) => { const el = document.createElement(o.type === 'image' ? 'img' : 'div'); el.className = `obj ${o.id === model.selectedObjectId ? 'selected' : ''}`; el.style.left = `${o.x}px`; el.style.top = `${o.y}px`; el.style.width = `${o.w}px`; el.style.height = `${o.h}px`; el.dataset.id = o.id; if (o.type === 'text') { el.classList.add('text'); el.textContent = o.text; } else if (o.type === 'image') el.src = o.src; else { el.classList.add('locked'); el.textContent = o.label || 'Locked object'; } el.onclick = (e) => { e.stopPropagation(); model.selectedObjectId = o.id; render(); }; el.ondblclick = () => { if (o.type !== 'text') return; editingId = o.id; el.contentEditable = 'true'; el.focus(); }; el.onkeydown = (e) => { if (e.key === 'Enter' && editingId === o.id) { e.preventDefault(); el.blur(); } if (e.key === 'Escape' && editingId === o.id) { e.preventDefault(); el.textContent = o.text; el.blur(); } }; el.onblur = () => { if (editingId === o.id) { pushHistory(history, model); o.text = el.textContent || ''; editingId = null; el.contentEditable = 'false'; render(); } }; el.onpointerdown = (e) => { if (e.target.classList.contains('handle') || o.type === 'locked') return; model.selectedObjectId = o.id; drag = { id: o.id, sx: e.clientX, sy: e.clientY, ox: o.x, oy: o.y }; interaction = beginInteraction(model, o.id); render(); }; if (o.id === model.selectedObjectId && o.type !== 'locked') { const h = document.createElement('div'); h.className = 'handle'; h.onpointerdown = (e) => { e.stopPropagation(); resize = { id: o.id, sx: e.clientX, sy: e.clientY, ow: o.w, oh: o.h }; interaction = beginInteraction(model, o.id); }; el.appendChild(h); } canvas.appendChild(el); });
    renderInspector(); refreshButtons();
  }
  window.onpointermove = (e) => { if (drag) { const nx = Math.max(0, Math.round(drag.ox + e.clientX - drag.sx)); const ny = Math.max(0, Math.round(drag.oy + e.clientY - drag.sy)); if (nx !== drag.ox || ny !== drag.oy) markInteractionChanged(interaction); updateObject(model, drag.id, { x: nx, y: ny }); render(); } if (resize) { const nw = Math.max(20, Math.round(resize.ow + e.clientX - resize.sx)); const nh = Math.max(20, Math.round(resize.oh + e.clientY - resize.sy)); if (nw !== resize.ow || nh !== resize.oh) markInteractionChanged(interaction); updateObject(model, resize.id, { w: nw, h: nh }); render(); } };
  window.onpointerup = () => { interaction = commitInteraction(history, interaction); drag = null; resize = null; refreshButtons(); };
  window.onkeydown = (e) => { if (e.key === 'Escape') { editingId = null; model.selectedObjectId = null; render(); return; } const o = findSelectedObject(model); if (!o) return; const step = e.shiftKey ? 10 : 1; if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Delete'].includes(e.key)) e.preventDefault(); if (e.key === 'Delete') { pushHistory(history, model); deleteSelectedObject(model); render(); return; } if (e.key === 'ArrowLeft') { pushHistory(history, model); o.x = Math.max(0, o.x - step); } if (e.key === 'ArrowRight') { pushHistory(history, model); o.x += step; } if (e.key === 'ArrowUp') { pushHistory(history, model); o.y = Math.max(0, o.y - step); } if (e.key === 'ArrowDown') { pushHistory(history, model); o.y += step; } render(); };
  canvas.onclick = () => { model.selectedObjectId = null; render(); };
  const applyInspector = () => { const o = findSelectedObject(model); if (!o) return; pushHistory(history, model); Object.assign(o, normalizeGeometry({ x: insX.value, y: insY.value, w: insW.value, h: insH.value })); if (o.type === 'text') o.text = insText.value; if (o.type === 'image') o.alt = insAlt.value; render(); };
  [insX, insY, insW, insH, insText, insAlt].forEach((el) => el.onchange = applyInspector);
  fileInput.onchange = async () => { const f = fileInput.files?.[0]; if (!f) return; model = mapHtmlToModel(await f.text()); history.undo = []; history.redo = []; render(); setStatus(`Opened HTML: ${f.name}`); };
  addTextBtn.onclick = () => { pushHistory(history, model); addTextObject(model); render(); setStatus('Text added'); };
  addImageBtn.onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/png,image/jpeg,image/jpg,image/gif,image/webp,image/avif'; i.onchange = async () => { const f = i.files?.[0]; if (!f) return; const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f); }); pushHistory(history, model); addImageObject(model, data); render(); setStatus('Image added'); }; i.click(); };
  delBtn.onclick = () => { if (!model.selectedObjectId) return; pushHistory(history, model); deleteSelectedObject(model); render(); };
  undoBtn.onclick = () => { model = undo(history, model); render(); };
  redoBtn.onclick = () => { model = redo(history, model); render(); };
  saveBtn.onclick = () => { const text = JSON.stringify(createProjectPayload(model), null, 2); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = 'project.lheproj-v2.json'; a.click(); URL.revokeObjectURL(a.href); setStatus('Project saved (can include image data URLs).'); };
  openProjectBtn.onclick = () => openProjectInput.click();
  openProjectInput.onchange = async () => { const f = openProjectInput.files?.[0]; if (!f) return; const restored = restoreProjectPayload(JSON.parse(await f.text())); if (!restored) return; model = restored; history.undo = []; history.redo = []; render(); setStatus(`Project opened: ${f.name}`); };
  exportBtn.onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exportModelToHtml(model)], { type: 'text/html' })); a.download = 'edited-v2.html'; a.click(); URL.revokeObjectURL(a.href); setStatus('Exported HTML'); };
  render(); setStatus('Open HTML and edit directly on the canvas.');
}

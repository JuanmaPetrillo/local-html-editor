const hasDom = typeof document !== 'undefined';

export function escapeHtml(s) { return String(s || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
export function escapeAttribute(value) { return String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
function parsePx(style, key, fallback) { const m = new RegExp(`${key}\\s*:\\s*([0-9.]+)px`, 'i').exec(style || ''); return m ? Number(m[1]) : fallback; }
function getAttr(tag, name) { const m = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i').exec(tag) || new RegExp(`${name}\\s*=\\s*'([^']*)'`, 'i').exec(tag); return m ? m[1] : ''; }
function getDataAttrs(tag) { const out = {}; for (const m of tag.matchAll(/\s(data-[a-z0-9_-]+)\s*=\s*"([^"]*)"/gi)) out[m[1]] = m[2]; for (const m of tag.matchAll(/\s(data-[a-z0-9_-]+)\s*=\s*'([^']*)'/gi)) out[m[1]] = m[2]; return out; }
function parseTextFromTag(tag) { const m = tag.match(/>([\s\S]*?)<\//); return m ? m[1].replace(/<[^>]+>/g, '') : ''; }
function nextId(model) { return `o${model.nextId++}`; }

export function classifyImageSource(src) {
  const value = String(src || '').trim();
  const safe = /^data:image\/(png|jpeg|jpg|gif|webp|avif);base64,[a-z0-9+/=]+$/i.test(value);
  return { safe, normalizedSrc: safe ? value : '' };
}

export function mapHtmlToModel(htmlText) {
  const slideMatches = [...String(htmlText).matchAll(/<(section\s+class="slide"|section\s+[^>]*data-slide-id[^>]*|div\s+class="slide")[^>]*>([\s\S]*?)<\/\s*(section|div)\s*>/gi)];
  const slides = slideMatches.length ? slideMatches.map((m, i) => ({ id: `s${i + 1}`, name: `Slide ${i + 1}`, raw: m[0], body: m[2] })) : [{ id: 's1', name: 'Slide 1', raw: htmlText, body: htmlText }];
  const outSlides = [];
  let globalIndex = 0;
  for (const s of slides) {
    const objects = [];
    const matches = s.body.matchAll(/<(h1|h2|h3|p|span|div)\b[^>]*>[\s\S]*?<\/(h1|h2|h3|p|span|div)>|<img\b[^>]*>/gi);
    for (const m of matches) {
      const tag = m[0];
      const name = (m[1] || 'img').toLowerCase();
      const style = getAttr(tag, 'style');
      if (name === 'img') {
        const source = classifyImageSource(getAttr(tag, 'src'));
        objects.push({ id: `o${globalIndex++}`, type: 'image', x: parsePx(style, 'left', 20), y: parsePx(style, 'top', 20 + globalIndex * 20), w: parsePx(style, 'width', 180), h: parsePx(style, 'height', 120), src: source.normalizedSrc, blockedSource: source.safe ? '' : getAttr(tag, 'src'), lockedReason: source.safe ? '' : 'blocked-remote-image', alt: getAttr(tag, 'alt'), className: getAttr(tag, 'class'), dataAttrs: getDataAttrs(tag) });
      } else {
        objects.push({ id: `o${globalIndex++}`, type: 'text', tagName: name, x: parsePx(style, 'left', 20), y: parsePx(style, 'top', 20 + globalIndex * 20), w: parsePx(style, 'width', 300), h: parsePx(style, 'height', 40), text: parseTextFromTag(tag), className: getAttr(tag, 'class'), dataAttrs: getDataAttrs(tag) });
      }
    }
    outSlides.push({ id: s.id, name: s.name, objects });
  }
  return { version: 2, width: 960, height: 540, slides: outSlides, currentSlideId: outSlides[0]?.id || 's1', nextId: globalIndex + 1 };
}

export function exportModelToHtml(model) {
  const slides = model.slides.map((slide) => {
    const body = slide.objects.map((o) => {
      if (o.type === 'text') {
        const attrs = `${o.className ? ` class="${escapeAttribute(o.className)}"` : ''}${Object.entries(o.dataAttrs || {}).map(([k, v]) => ` ${k}="${escapeAttribute(v)}"`).join('')}`;
        return `<${o.tagName || 'div'}${attrs} style="position:absolute;left:${o.x}px;top:${o.y}px;width:${o.w}px;height:${o.h}px;">${escapeHtml(o.text)}</${o.tagName || 'div'}>`;
      }
      if (o.src) {
        const attrs = `${o.className ? ` class="${escapeAttribute(o.className)}"` : ''} alt="${escapeAttribute(o.alt || '')}"${Object.entries(o.dataAttrs || {}).map(([k, v]) => ` ${k}="${escapeAttribute(v)}"`).join('')}`;
        return `<img src="${escapeAttribute(o.src)}"${attrs} style="position:absolute;left:${o.x}px;top:${o.y}px;width:${o.w}px;height:${o.h}px;"/>`;
      }
      return `<div style="position:absolute;left:${o.x}px;top:${o.y}px;width:${o.w}px;height:${o.h}px;border:1px dashed #999;background:#f3f4f6;">Blocked remote image</div>`;
    }).join('\n');
    return `<section class="slide" data-slide-id="${escapeAttribute(slide.id)}" style="position:relative;width:${model.width}px;height:${model.height}px;overflow:hidden;">${body}</section>`;
  }).join('\n');
  return `<!doctype html><html><head><meta charset="UTF-8"><title>Edited Presentation</title></head><body>${slides}</body></html>`;
}

export function createHistory() { return { undo: [], redo: [] }; }
export function snapshot(model) { return JSON.parse(JSON.stringify(model)); }
export function pushHistory(history, model) { history.undo.push(snapshot(model)); if (history.undo.length > 50) history.undo.shift(); history.redo = []; }
export function undo(history, model) { if (!history.undo.length) return model; history.redo.push(snapshot(model)); return history.undo.pop(); }
export function redo(history, model) { if (!history.redo.length) return model; history.undo.push(snapshot(model)); return history.redo.pop(); }

export function updateObject(model, id, patch) { for (const s of model.slides) { const o = s.objects.find((x) => x.id === id); if (o) Object.assign(o, patch); } }
export function deleteObject(model, id) { for (const s of model.slides) s.objects = s.objects.filter((o) => o.id !== id); }
export function addTextObject(model, slideId) { const s = model.slides.find((x) => x.id === slideId) || model.slides[0]; const obj = { id: nextId(model), type: 'text', tagName: 'p', x: 60, y: 60, w: 260, h: 40, text: 'New text', className: '', dataAttrs: {} }; s.objects.push(obj); return obj; }
export function addImageObject(model, slideId, src) { const s = model.slides.find((x) => x.id === slideId) || model.slides[0]; const obj = { id: nextId(model), type: 'image', x: 80, y: 80, w: 240, h: 140, src: classifyImageSource(src).normalizedSrc, blockedSource: '', lockedReason: '', alt: '', className: '', dataAttrs: {} }; s.objects.push(obj); return obj; }

if (hasDom) {
  const qs = (sel) => document.querySelector(sel);
  const canvas = qs('#canvas'); const status = qs('#status'); const slidesEl = qs('#slides'); const layersEl = qs('#layers');
  const fileInput = qs('#file'); const openProjectInput = qs('#open-project-file'); const addTextBtn = qs('#add-text'); const addImageBtn = qs('#add-image'); const replaceImageBtn = qs('#replace-image'); const delBtn = qs('#delete'); const undoBtn = qs('#undo'); const redoBtn = qs('#redo'); const saveBtn = qs('#save-project'); const openProjectBtn = qs('#open-project'); const exportBtn = qs('#export');
  let model = { version: 2, width: 960, height: 540, slides: [{ id: 's1', name: 'Slide 1', objects: [] }], currentSlideId: 's1', nextId: 1 };
  let selectedId = null; let editingId = null; let drag = null; let resize = null; const history = createHistory();
  const selected = () => model.slides.flatMap((s) => s.objects).find((o) => o.id === selectedId);
  const currentSlide = () => model.slides.find((s) => s.id === model.currentSlideId) || model.slides[0];
  const setStatus = (t) => { status.textContent = t; };
  const select = (id) => { selectedId = id; delBtn.disabled = !id; replaceImageBtn.disabled = !(selected() && selected().type === 'image'); render(); };
  const commit = (msg) => { pushHistory(history, model); setStatus(msg); };

  function render() {
    slidesEl.textContent = ''; model.slides.forEach((s) => { const b = document.createElement('button'); b.textContent = s.name; b.className = s.id === model.currentSlideId ? 'active' : ''; b.onclick = () => { model.currentSlideId = s.id; selectedId = null; render(); }; slidesEl.appendChild(b); });
    layersEl.textContent = ''; currentSlide().objects.forEach((o) => { const b = document.createElement('button'); b.textContent = `${o.type === 'text' ? 'Text' : 'Image'} ${o.id}`; b.className = o.id === selectedId ? 'active' : ''; b.onclick = () => select(o.id); layersEl.appendChild(b); });
    canvas.textContent = '';
    currentSlide().objects.forEach((o) => {
      const blocked = o.type === 'image' && !o.src;
      const el = document.createElement(o.type === 'image' && !blocked ? 'img' : 'div');
      el.className = `obj ${o.id === selectedId ? 'selected' : ''}`; el.style.left = `${o.x}px`; el.style.top = `${o.y}px`; el.style.width = `${o.w}px`; el.style.height = `${o.h}px`; el.dataset.id = o.id;
      if (o.type === 'text') { el.classList.add('text'); el.textContent = o.text; }
      else if (blocked) { el.textContent = 'Blocked remote image'; el.classList.add('blocked'); }
      else { el.src = o.src; }
      el.onclick = (e) => { e.stopPropagation(); select(o.id); };
      el.ondblclick = () => { if (o.type !== 'text') return; editingId = o.id; el.contentEditable = 'true'; el.focus(); };
      el.onkeydown = (e) => { if (e.key === 'Enter' && editingId === o.id) { e.preventDefault(); el.blur(); } if (e.key === 'Escape' && editingId === o.id) { e.preventDefault(); el.textContent = o.text; el.blur(); } };
      el.onblur = () => { if (editingId === o.id) { commit(`Edited text ${o.id}`); o.text = el.textContent || ''; editingId = null; el.contentEditable = 'false'; render(); } };
      el.onpointerdown = (e) => { if (e.target.classList.contains('handle')) return; select(o.id); drag = { id: o.id, sx: e.clientX, sy: e.clientY, ox: o.x, oy: o.y }; };
      if (o.id === selectedId) { const h = document.createElement('div'); h.className = 'handle'; h.onpointerdown = (e) => { e.stopPropagation(); resize = { id: o.id, sx: e.clientX, sy: e.clientY, ow: o.w, oh: o.h }; }; el.appendChild(h); }
      canvas.appendChild(el);
    });
  }

  window.onpointermove = (e) => { if (drag) { updateObject(model, drag.id, { x: Math.max(0, Math.round(drag.ox + e.clientX - drag.sx)), y: Math.max(0, Math.round(drag.oy + e.clientY - drag.sy)) }); render(); } if (resize) { updateObject(model, resize.id, { w: Math.max(20, Math.round(resize.ow + e.clientX - resize.sx)), h: Math.max(20, Math.round(resize.oh + e.clientY - resize.sy)) }); render(); } };
  window.onpointerup = () => { if (drag) commit(`Moved ${drag.id}`); if (resize) commit(`Resized ${resize.id}`); drag = null; resize = null; };
  window.onkeydown = (e) => { if (!selectedId) return; const d = e.shiftKey ? 10 : 1; if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Delete'].includes(e.key)) e.preventDefault(); if (e.key === 'Delete') { commit(`Deleted ${selectedId}`); deleteObject(model, selectedId); selectedId = null; render(); return; } const o = selected(); if (!o) return; if (e.key === 'ArrowLeft') { commit(`Nudged ${o.id}`); o.x = Math.max(0, o.x - d); } if (e.key === 'ArrowRight') { commit(`Nudged ${o.id}`); o.x += d; } if (e.key === 'ArrowUp') { commit(`Nudged ${o.id}`); o.y = Math.max(0, o.y - d); } if (e.key === 'ArrowDown') { commit(`Nudged ${o.id}`); o.y += d; } render(); };

  fileInput.onchange = async () => { const f = fileInput.files?.[0]; if (!f) return; model = mapHtmlToModel(await f.text()); history.undo = []; history.redo = []; selectedId = null; render(); setStatus(`Opened ${f.name}`); };
  addTextBtn.onclick = () => { commit('Added text'); const o = addTextObject(model, model.currentSlideId); select(o.id); };
  addImageBtn.onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/png,image/jpeg,image/jpg,image/gif,image/webp,image/avif'; i.onchange = async () => { const f = i.files?.[0]; if (!f) return; const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f); }); commit('Added image'); const o = addImageObject(model, model.currentSlideId, data); select(o.id); }; i.click(); };
  replaceImageBtn.onclick = () => { const t = selected(); if (!t || t.type !== 'image') return; const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/png,image/jpeg,image/jpg,image/gif,image/webp,image/avif'; i.onchange = async () => { const f = i.files?.[0]; if (!f) return; const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f); }); commit('Replaced image'); t.src = classifyImageSource(data).normalizedSrc; render(); }; i.click(); };
  delBtn.onclick = () => { if (!selectedId) return; commit(`Deleted ${selectedId}`); deleteObject(model, selectedId); selectedId = null; render(); };
  undoBtn.onclick = () => { model = undo(history, model); render(); setStatus('Undo'); };
  redoBtn.onclick = () => { model = redo(history, model); render(); setStatus('Redo'); };
  saveBtn.onclick = () => { const text = JSON.stringify({ version: 2, model }, null, 2); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = 'project.lheproj.json'; a.click(); URL.revokeObjectURL(a.href); setStatus('Project saved (may contain data image content).'); };
  openProjectBtn.onclick = () => openProjectInput.click();
  openProjectInput.onchange = async () => { const f = openProjectInput.files?.[0]; if (!f) return; const payload = JSON.parse(await f.text()); if (!payload.model || payload.version !== 2) return; model = payload.model; selectedId = null; history.undo = []; history.redo = []; render(); setStatus(`Opened project ${f.name}`); };
  exportBtn.onclick = () => { const html = exportModelToHtml(model); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); a.download = 'edited-v2.html'; a.click(); URL.revokeObjectURL(a.href); setStatus('Exported HTML'); };
  canvas.onclick = () => select(null);
  render(); setStatus('Open HTML, click objects, double-click text to edit inline, drag, resize, save, and export.');
}

const hasDom = typeof document !== 'undefined';
const fileInput = hasDom ? document.querySelector('#file') : null;
const canvas = hasDom ? document.querySelector('#canvas') : null;
const status = hasDom ? document.querySelector('#status') : null;
const deleteButton = hasDom ? document.querySelector('#delete') : null;
const addImageButton = hasDom ? document.querySelector('#add-image') : null;
const exportButton = hasDom ? document.querySelector('#export') : null;

let model = { width: 960, height: 540, objects: [] };
let selectedId = null;
let drag = null;
let resize = null;

function setStatus(text) { if (status) status.textContent = text; }
function select(id) { selectedId = id; if (deleteButton) deleteButton.disabled = !id; render(); }
function parsePx(style, key, fallback) { const m = new RegExp(`${key}\\s*:\\s*([0-9.]+)px`, 'i').exec(style || ''); return m ? Number(m[1]) : fallback; }
function getAttr(tag, name) { const m = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i').exec(tag) || new RegExp(`${name}\\s*=\\s*'([^']*)'`, 'i').exec(tag); return m ? m[1] : ''; }
function getDataAttrs(tag) { const out = {}; for (const m of tag.matchAll(/\s(data-[a-z0-9_-]+)\s*=\s*"([^"]*)"/gi)) out[m[1]] = m[2]; for (const m of tag.matchAll(/\s(data-[a-z0-9_-]+)\s*=\s*'([^']*)'/gi)) out[m[1]] = m[2]; return out; }
function parseTextFromTag(tag) { const m = tag.match(/>([\s\S]*?)<\//); return m ? m[1].replace(/<[^>]+>/g, '') : ''; }
export function escapeHtml(s) { return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
export function escapeAttribute(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }

export function classifyImageSource(src) {
  const value = String(src || '').trim();
  const ok = /^data:image\/(png|jpeg|jpg|gif|webp|avif);base64,[a-z0-9+/=]+$/i.test(value);
  return { safe: ok, normalizedSrc: ok ? value : '' };
}

function encodeAttrs(attrs) { return Object.entries(attrs).map(([k, v]) => ` ${k}="${escapeAttribute(v)}"`).join(''); }

export function mapHtmlToModel(htmlText) {
  const matches = htmlText.matchAll(/<(h1|h2|h3|p|span)\b[^>]*>[\s\S]*?<\/(h1|h2|h3|p|span)>|<img\b[^>]*>/gi);
  const objects = [];
  let i = 0;
  for (const m of matches) {
    const tag = m[0];
    const name = (m[1] || 'img').toLowerCase();
    const style = getAttr(tag, 'style');
    if (name === 'img') {
      const source = classifyImageSource(getAttr(tag, 'src'));
      objects.push({
        id: `o${i++}`,
        type: 'image',
        x: parsePx(style, 'left', 20), y: parsePx(style, 'top', 20 + i * 30), w: parsePx(style, 'width', 200), h: parsePx(style, 'height', 120),
        src: source.normalizedSrc,
        blockedSource: source.safe ? '' : (getAttr(tag, 'src') || ''),
        lockedReason: source.safe ? '' : 'missing-image-source',
        alt: getAttr(tag, 'alt'),
        className: getAttr(tag, 'class'),
        dataAttrs: getDataAttrs(tag)
      });
      continue;
    }
    objects.push({
      id: `o${i++}`,
      type: 'text',
      tagName: name,
      x: parsePx(style, 'left', 20), y: parsePx(style, 'top', 20 + i * 30), w: parsePx(style, 'width', 260), h: parsePx(style, 'height', 40),
      text: parseTextFromTag(tag)
    });
  }
  return { width: 960, height: 540, objects };
}

export function exportModelToHtml(current) {
  const body = current.objects.map((o) => {
    if (o.type === 'text') {
      const tag = o.tagName || 'div';
      return `<${tag} style="position:absolute;left:${o.x}px;top:${o.y}px;width:${o.w}px;height:${o.h}px;">${escapeHtml(o.text || '')}</${tag}>`;
    }
    if (o.src) {
      const attrs = { ...(o.className ? { class: o.className } : {}), ...(o.alt ? { alt: o.alt } : { alt: '' }), ...(o.dataAttrs || {}) };
      return `<img src="${escapeAttribute(o.src)}" style="position:absolute;left:${o.x}px;top:${o.y}px;width:${o.w}px;height:${o.h}px;"${encodeAttrs(attrs)}/>`;
    }
    return `<div style="position:absolute;left:${o.x}px;top:${o.y}px;width:${o.w}px;height:${o.h}px;border:1px dashed #999;background:#f3f4f6;color:#374151;">Blocked remote image</div>`;
  }).join('\n');
  return `<!doctype html><html><head><meta charset="UTF-8"><title>Export</title></head><body><div style="position:relative;width:${current.width}px;height:${current.height}px;">${body}</div></body></html>`;
}

function render() {
  canvas.textContent = '';
  for (const obj of model.objects) {
    const isBlockedImage = obj.type === 'image' && !obj.src;
    const el = document.createElement(obj.type === 'image' && !isBlockedImage ? 'img' : 'div');
    el.className = `obj ${selectedId === obj.id ? 'selected' : ''}`;
    if (obj.type === 'text') { el.classList.add('text-edit'); el.textContent = obj.text; }
    else if (isBlockedImage) { el.textContent = 'Blocked remote image'; el.style.border = '1px dashed #999'; el.style.background = '#f3f4f6'; }
    else { el.src = obj.src; }
    el.style.left = `${obj.x}px`; el.style.top = `${obj.y}px`; el.style.width = `${obj.w}px`; el.style.height = `${obj.h}px`;
    el.dataset.id = obj.id;
    el.addEventListener('click', (e) => { e.stopPropagation(); select(obj.id); });
    el.addEventListener('dblclick', () => { if (obj.type !== 'text') return; el.contentEditable = 'true'; el.focus(); });
    el.addEventListener('blur', () => { if (obj.type !== 'text') return; obj.text = el.textContent || ''; el.contentEditable = 'false'; setStatus(`Edited text: ${obj.id}`); }, true);
    el.addEventListener('pointerdown', (e) => { if (e.target.classList.contains('handle')) return; select(obj.id); drag = { id: obj.id, sx: e.clientX, sy: e.clientY, ox: obj.x, oy: obj.y }; });
    if (selectedId === obj.id) {
      const h = document.createElement('div'); h.className = 'handle'; h.addEventListener('pointerdown', (e) => { e.stopPropagation(); resize = { id: obj.id, sx: e.clientX, sy: e.clientY, ow: obj.w, oh: obj.h }; }); el.appendChild(h);
    }
    canvas.appendChild(el);
  }
}

if (hasDom) {
window.addEventListener('pointermove', (e) => {
  if (drag) { const o = model.objects.find((x) => x.id === drag.id); o.x = Math.max(0, Math.round(drag.ox + e.clientX - drag.sx)); o.y = Math.max(0, Math.round(drag.oy + e.clientY - drag.sy)); render(); }
  if (resize) { const o = model.objects.find((x) => x.id === resize.id); o.w = Math.max(20, Math.round(resize.ow + e.clientX - resize.sx)); o.h = Math.max(20, Math.round(resize.oh + e.clientY - resize.sy)); render(); }
});
window.addEventListener('pointerup', () => { drag = null; resize = null; });
canvas.addEventListener('click', () => select(null));

deleteButton.addEventListener('click', () => { if (!selectedId) return; model.objects = model.objects.filter((o) => o.id !== selectedId); setStatus(`Deleted ${selectedId}`); selectedId = null; render(); });
addImageButton.addEventListener('click', () => {
  const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/png,image/jpeg,image/jpg,image/gif,image/webp,image/avif';
  input.onchange = async () => { const f = input.files && input.files[0]; if (!f) return; const data = await new Promise((res, rej)=>{ const r = new FileReader(); r.onload = ()=>res(String(r.result)); r.onerror=()=>rej(r.error); r.readAsDataURL(f);}); model.objects.push({ id:`o${Date.now()}`, type:'image', x:40, y:40, w:220, h:140, src:classifyImageSource(data).normalizedSrc, blockedSource:'', lockedReason:'', alt:'', className:'', dataAttrs:{} }); render(); setStatus('Added local image.'); };
  input.click();
});
fileInput.addEventListener('change', async () => { const f = fileInput.files && fileInput.files[0]; if (!f) return; const text = await f.text(); model = mapHtmlToModel(text); selectedId = null; render(); const blockedCount = model.objects.filter((o) => o.type === 'image' && o.lockedReason === 'missing-image-source').length; setStatus(`Loaded ${f.name}. Objects: ${model.objects.length}${blockedCount ? `. Remote images blocked: ${blockedCount}.` : ''}`); });
exportButton.addEventListener('click', () => { const html = exportModelToHtml(model); const blob = new Blob([html], { type: 'text/html' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'edited-v2.html'; a.click(); URL.revokeObjectURL(a.href); setStatus('Exported edited-v2.html'); });

setStatus('Load a simple HTML file. No script execution, no network, local only.');
}


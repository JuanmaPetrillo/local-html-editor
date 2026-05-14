const fileInput = document.querySelector('#file');
const canvas = document.querySelector('#canvas');
const status = document.querySelector('#status');
const deleteButton = document.querySelector('#delete');
const addImageButton = document.querySelector('#add-image');
const exportButton = document.querySelector('#export');

let model = { width: 960, height: 540, objects: [] };
let selectedId = null;
let drag = null;
let resize = null;

function setStatus(text) { status.textContent = text; }
function select(id) { selectedId = id; deleteButton.disabled = !id; render(); }
function parsePx(style, key, fallback) { const m = new RegExp(`${key}\\s*:\\s*([0-9.]+)px`, 'i').exec(style || ''); return m ? Number(m[1]) : fallback; }

export function mapHtmlToModel(htmlText) {
  const template = document.createElement('template');
  template.innerHTML = htmlText;
  const nodes = template.content.querySelectorAll('p, h1, h2, h3, span, img');
  const objects = [];
  let i = 0;
  for (const node of nodes) {
    const style = node.getAttribute('style') || '';
    const obj = { id: `o${i++}`, x: parsePx(style, 'left', 20), y: parsePx(style, 'top', 20 + i * 30), w: parsePx(style, 'width', node.tagName === 'IMG' ? 200 : 260), h: parsePx(style, 'height', node.tagName === 'IMG' ? 120 : 40), type: node.tagName === 'IMG' ? 'image' : 'text', text: node.textContent || '', src: node.getAttribute('src') || '' };
    objects.push(obj);
  }
  return { width: 960, height: 540, objects };
}

export function exportModelToHtml(current) {
  const body = current.objects.map((o) => o.type === 'text'
    ? `<div style="position:absolute;left:${o.x}px;top:${o.y}px;width:${o.w}px;height:${o.h}px;">${escapeHtml(o.text)}</div>`
    : `<img src="${o.src}" style="position:absolute;left:${o.x}px;top:${o.y}px;width:${o.w}px;height:${o.h}px;" alt=""/>`).join('\n');
  return `<!doctype html><html><head><meta charset="UTF-8"><title>Export</title></head><body><div style="position:relative;width:${current.width}px;height:${current.height}px;">${body}</div></body></html>`;
}
function escapeHtml(s) { return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

function render() {
  canvas.textContent = '';
  for (const obj of model.objects) {
    const el = document.createElement(obj.type === 'image' ? 'img' : 'div');
    el.className = `obj ${selectedId === obj.id ? 'selected' : ''}`;
    if (obj.type === 'text') { el.classList.add('text-edit'); el.textContent = obj.text; }
    else el.src = obj.src;
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

window.addEventListener('pointermove', (e) => {
  if (drag) { const o = model.objects.find((x) => x.id === drag.id); o.x = Math.max(0, Math.round(drag.ox + e.clientX - drag.sx)); o.y = Math.max(0, Math.round(drag.oy + e.clientY - drag.sy)); render(); }
  if (resize) { const o = model.objects.find((x) => x.id === resize.id); o.w = Math.max(20, Math.round(resize.ow + e.clientX - resize.sx)); o.h = Math.max(20, Math.round(resize.oh + e.clientY - resize.sy)); render(); }
});
window.addEventListener('pointerup', () => { drag = null; resize = null; });
canvas.addEventListener('click', () => select(null));

deleteButton.addEventListener('click', () => { if (!selectedId) return; model.objects = model.objects.filter((o) => o.id !== selectedId); setStatus(`Deleted ${selectedId}`); selectedId = null; render(); });
addImageButton.addEventListener('click', () => {
  const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/png,image/jpeg,image/jpg,image/gif,image/webp,image/avif';
  input.onchange = async () => { const f = input.files && input.files[0]; if (!f) return; const data = await new Promise((res, rej)=>{ const r = new FileReader(); r.onload = ()=>res(String(r.result)); r.onerror=()=>rej(r.error); r.readAsDataURL(f);}); model.objects.push({ id:`o${Date.now()}`, type:'image', x:40, y:40, w:220, h:140, src:data, text:''}); render(); setStatus('Added local image.'); };
  input.click();
});
fileInput.addEventListener('change', async () => { const f = fileInput.files && fileInput.files[0]; if (!f) return; const text = await f.text(); model = mapHtmlToModel(text); selectedId = null; render(); setStatus(`Loaded ${f.name}. Objects: ${model.objects.length}`); });
exportButton.addEventListener('click', () => { const html = exportModelToHtml(model); const blob = new Blob([html], { type: 'text/html' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'edited-v2.html'; a.click(); URL.revokeObjectURL(a.href); setStatus('Exported edited-v2.html'); });

setStatus('Load a simple HTML file. No script execution, no network, local only.');

import { readFileSync } from 'node:fs';
import { mapHtmlToModel, exportModelToHtml, classifyImageSource, escapeHtml, escapeAttribute } from '../apps/desktop-v2/src/app-v2.mjs';

const html = readFileSync('apps/desktop-v2/index.html', 'utf8');
const js = readFileSync('apps/desktop-v2/src/app-v2.mjs', 'utf8');
const fixture = readFileSync('tests/fixtures/v2-simple-slide.html', 'utf8');

for (const token of ['id="canvas"', 'id="file"', 'id="delete"', 'id="export"']) if (!html.includes(token)) throw new Error(`missing ${token}`);

const model = mapHtmlToModel(fixture);
const textCount = model.objects.filter((o) => o.type === 'text').length;
const imageCount = model.objects.filter((o) => o.type === 'image').length;
if (textCount < 1 || imageCount < 1) throw new Error('model should include text + image objects');

const firstText = model.objects.find((o) => o.type === 'text');
firstText.text = 'A & B < C > D';
const firstImage = model.objects.find((o) => o.type === 'image');
firstImage.x = 333; firstImage.y = 222; firstImage.w = 111; firstImage.h = 99;
const export1 = exportModelToHtml(model);
if (!export1.includes('A &amp; B &lt; C &gt; D')) throw new Error('escaped text missing from export');
if (!export1.includes('left:333px;top:222px;width:111px;height:99px')) throw new Error('geometry change missing from export');

model.objects = model.objects.filter((o) => o.id !== firstText.id);
const export2 = exportModelToHtml(model);
if (export2.includes('A &amp; B &lt; C &gt; D')) throw new Error('deleted object still present in export');

model.objects.push({ id: 'add1', type: 'image', x: 10, y: 20, w: 30, h: 40, src: 'data:image/png;base64,AA==', blockedSource: '', lockedReason: '', alt: 'new', className: 'img-added', dataAttrs: { 'data-kind': 'added' } });
const export3 = exportModelToHtml(model);
if (!export3.includes('data:image/png;base64,AA==')) throw new Error('added data image missing from export');
if (!export3.includes('class="img-added"') || !export3.includes('data-kind="added"') || !export3.includes('alt="new"')) throw new Error('image attributes missing from export');

const trickyModel = { width: 10, height: 10, objects: [{ id:'t1', type:'image', x:1, y:2, w:3, h:4, src:'data:image/png;base64,AA==', blockedSource:'', lockedReason:'', alt:`a"b'`, className:`c"d'`, dataAttrs:{'data-x':`e"f'<>&`} }] };
const trickyExport = exportModelToHtml(trickyModel);
if (!trickyExport.includes('src="data:image/png;base64,AA=="')) throw new Error('src should use escaped attribute path');
if (trickyExport.includes("alt=\"a\"b'")) throw new Error('raw quote leaked in alt attribute');
if (!trickyExport.includes('alt="a&quot;b&#39;"')) throw new Error('escaped alt missing');
if (!trickyExport.includes('class="c&quot;d&#39;"')) throw new Error('escaped class missing');
if (!trickyExport.includes('data-x="e&quot;f&#39;&lt;&gt;&amp;"')) throw new Error('escaped data attribute missing');

const remoteFixture = '<img src="https://example.com/x.png" style="left:1px;top:2px;width:3px;height:4px;" alt="x" class="c" data-id="r">';
const remoteModel = mapHtmlToModel(remoteFixture);
const remoteImage = remoteModel.objects[0];
if (remoteImage.src) throw new Error('remote image should be blocked');
if (remoteImage.lockedReason !== 'missing-image-source') throw new Error('blocked image reason missing');
const remoteExport = exportModelToHtml(remoteModel);
if (remoteExport.includes('https://example.com/x.png')) throw new Error('remote source leaked into export');
if (!remoteExport.includes('Blocked remote image')) throw new Error('blocked placeholder missing in export');

if (!classifyImageSource('data:image/png;base64,AA==').safe) throw new Error('png data url should be allowed');
if (classifyImageSource('https://example.com/x.png').safe) throw new Error('https source should be blocked');
if (escapeHtml('&<>') !== '&amp;&lt;&gt;') throw new Error('escapeHtml failed');

if (escapeAttribute(`a" b' c & < >`) !== 'a&quot; b&#39; c &amp; &lt; &gt;') throw new Error('escapeAttribute failed');

for (const token of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'postMessage', 'contentDocument', 'contentWindow', 'localStorage', 'indexedDB']) {
  if (js.includes(token)) throw new Error(`forbidden token detected: ${token}`);
}

console.log('v2 checks passed');

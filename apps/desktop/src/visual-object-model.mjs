const TEXT_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'button', 'a', 'li', 'label', 'figcaption', 'small']);
const CONTAINER_TAGS = new Set(['div', 'section', 'article', 'main', 'aside']);
const LOCKED_TAGS = new Set(['canvas', 'iframe', 'object', 'embed', 'svg']);

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function stripExcludedBlocks(htmlText) {
  return htmlText.replace(/<\s*(script|style|template|noscript)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ');
}

function getAttribute(tagSource, attributeName) {
  const regex = new RegExp(`\\b${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = regex.exec(tagSource);
  return match ? (match[1] || match[2] || match[3] || '') : '';
}

function classifyImageSrc(srcValue) {
  const src = String(srcValue || '').trim();
  if (!src) return { editability: 'locked', confidence: 'low', reason: 'Image source missing.' };
  if (/^(https?:)?\/\//i.test(src)) return { editability: 'partially-editable', confidence: 'low', reason: 'Remote image source detected; preserve cautiously.' };
  if (/^(data:|blob:)/i.test(src)) return { editability: 'editable', confidence: 'high', reason: 'Inline/local image source detected.' };
  if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return { editability: 'partially-editable', confidence: 'low', reason: 'Non-local scheme detected.' };
  return { editability: 'editable', confidence: 'high', reason: 'Local relative image source detected.' };
}

export function classifyVisualObject(input) {
  return { ...input };
}

export function extractVisualObjectsFromHtml(htmlText) {
  const source = stripExcludedBlocks(String(htmlText || ''));
  const tagRegex = /<\s*(\/)?\s*([a-zA-Z0-9:-]+)\b([^>]*)>/g;
  const objects = [];
  const containerStack = [];
  let objectNumber = 0;
  let match = tagRegex.exec(source);
  while (match) {
    const closing = !!match[1];
    const tagName = match[2].toLowerCase();
    const tagSource = match[0];
    const sourceStart = match.index;
    const sourceEnd = sourceStart + tagSource.length;

    if (closing) {
      if (containerStack.length > 0 && containerStack[containerStack.length - 1] === tagName) {
        containerStack.pop();
      }
      match = tagRegex.exec(source);
      continue;
    }

    const isSelfClosing = /\/\s*>$/.test(tagSource);
    const depth = containerStack.length;

    if (LOCKED_TAGS.has(tagName)) {
      objectNumber += 1;
      objects.push(classifyVisualObject({ objectId: `object-${String(objectNumber).padStart(3, '0')}`, type: 'unknown', tagName, editability: 'locked', allowedActions: [], reason: 'Unsupported or unsafe embedded object.', confidence: 'high', sourceStart, sourceEnd }));
    } else if (tagName === 'img') {
      const srcPreview = getAttribute(tagSource, 'src');
      const imageClass = classifyImageSrc(srcPreview);
      objectNumber += 1;
      objects.push(classifyVisualObject({ objectId: `object-${String(objectNumber).padStart(3, '0')}`, type: 'image', tagName, srcPreview, editability: imageClass.editability, allowedActions: [], reason: imageClass.reason, confidence: imageClass.confidence, sourceStart, sourceEnd }));
    } else if (TEXT_TAGS.has(tagName)) {
      const closeTag = new RegExp(`<\\s*\\/\\s*${tagName}\\s*>`, 'ig');
      closeTag.lastIndex = tagRegex.lastIndex;
      const closeMatch = closeTag.exec(source);
      const textRegionEnd = closeMatch ? closeMatch.index : tagRegex.lastIndex;
      const between = source.slice(tagRegex.lastIndex, textRegionEnd);
      const withoutTags = normalizeWhitespace(between.replace(/<[^>]*>/g, ''));
      if (withoutTags) {
        objectNumber += 1;
        const hasNestedTag = /<\s*[a-z][^>]*>/i.test(between);
        const nestedDepth = depth > 0;
        const editable = !hasNestedTag && !nestedDepth;
        objects.push(classifyVisualObject({ objectId: `object-${String(objectNumber).padStart(3, '0')}`, type: 'text', tagName, textPreview: withoutTags.slice(0, 80), editability: editable ? 'editable' : 'partially-editable', allowedActions: editable ? ['text'] : ['text'], reason: editable ? 'Simple text leaf object.' : 'Nested or structured text object; limited text-safe edits only.', confidence: editable ? 'high' : 'medium', sourceStart, sourceEnd }));
      }
    } else if (CONTAINER_TAGS.has(tagName) && !isSelfClosing) {
      const closeTag = new RegExp(`<\\s*\\/\\s*${tagName}\\s*>`, 'ig');
      closeTag.lastIndex = tagRegex.lastIndex;
      const closeMatch = closeTag.exec(source);
      const content = source.slice(tagRegex.lastIndex, closeMatch ? closeMatch.index : tagRegex.lastIndex);
      if (/(<\s*(h[1-6]|p|button|a|li|label|figcaption|small|img)\b)/i.test(content)) {
        objectNumber += 1;
        objects.push(classifyVisualObject({ objectId: `object-${String(objectNumber).padStart(3, '0')}`, type: 'container', tagName, editability: 'partially-editable', allowedActions: [], reason: 'Container includes child visual objects; do not apply destructive overlap edits.', confidence: 'medium', sourceStart, sourceEnd }));
      }
    }

    if (!isSelfClosing) {
      containerStack.push(tagName);
    }
    match = tagRegex.exec(source);
  }

  return objects;
}

export function createVisualObjectInventory(htmlText) {
  return {
    summary: { totalCount: 0, editableCount: 0, partiallyEditableCount: 0, lockedCount: 0 },
    objects: extractVisualObjectsFromHtml(htmlText)
  };
}

export function formatVisualObjectInventoryText(inventory) {
  if (!inventory || !Array.isArray(inventory.objects) || inventory.objects.length === 0) {
    return 'Visual object discovery: no best-effort visual objects detected.';
  }
  const editableCount = inventory.objects.filter((obj) => obj.editability === 'editable').length;
  const partiallyEditableCount = inventory.objects.filter((obj) => obj.editability === 'partially-editable').length;
  const lockedCount = inventory.objects.filter((obj) => obj.editability === 'locked').length;
  const lines = [
    `Visual object discovery: ${inventory.objects.length} object(s) detected.`,
    `- editable: ${editableCount}`,
    `- partially-editable: ${partiallyEditableCount}`,
    `- locked: ${lockedCount}`,
    ''
  ];
  for (const obj of inventory.objects) {
    lines.push(`${obj.objectId} | ${obj.type} | <${obj.tagName}> | ${obj.editability} | confidence:${obj.confidence}`);
    if (obj.textPreview) lines.push(`  text: ${obj.textPreview}`);
    if (obj.srcPreview) lines.push(`  src: ${obj.srcPreview}`);
    lines.push(`  reason: ${obj.reason}`);
  }
  return lines.join('\n');
}

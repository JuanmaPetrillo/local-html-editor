const TEXT_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'button', 'a', 'li', 'label', 'figcaption', 'small']);
const CONTAINER_TAGS = new Set(['div', 'section', 'article', 'main', 'aside']);
const LOCKED_TAGS = new Set(['canvas', 'iframe', 'object', 'embed', 'svg']);

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

const EXCLUDED_BLOCKS_PATTERN = /<\s*(script|style|template|noscript)\b[\s\S]*?<\s*\/\s*\1\s*>/gi;

function stripExcludedBlocks(htmlText) {
  return htmlText.replace(EXCLUDED_BLOCKS_PATTERN, (match) => ' '.repeat(match.length));
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

export function parseInlineStyle(styleText) {
  const map = Object.create(null);
  const raw = String(styleText || '');
  if (!raw) return map;
  const segments = raw.split(';');
  for (const segment of segments) {
    const separator = segment.indexOf(':');
    if (separator < 0) continue;
    const name = segment.slice(0, separator).trim().toLowerCase();
    const value = segment.slice(separator + 1).trim();
    if (!name || !value) continue;
    map[name] = value;
  }
  return map;
}

export function extractPixelValue(styleMap, propertyName) {
  if (!styleMap || typeof styleMap !== 'object') return null;
  const raw = String(styleMap[propertyName] || '').trim();
  if (!raw) return null;
  const match = /^(-?\d+(?:\.\d+)?)px$/i.exec(raw);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
}

function createEmptyGeometry() {
  return {
    source: 'none',
    left: null,
    top: null,
    width: null,
    height: null,
    hasPosition: false,
    hasSize: false,
    overlayReady: false
  };
}

export function createGeometryStatus(geometry) {
  if (!geometry) return 'missing';
  if (geometry.overlayReady) return 'ready';
  if (geometry.hasPosition || geometry.hasSize) return 'partial';
  return 'missing';
}

export function extractInlineGeometry(tagSource) {
  const styleText = getAttribute(tagSource, 'style');
  if (!styleText) return createEmptyGeometry();
  const styleMap = parseInlineStyle(styleText);
  const geometry = {
    ...createEmptyGeometry(),
    source: 'inline-style',
    left: extractPixelValue(styleMap, 'left'),
    top: extractPixelValue(styleMap, 'top'),
    width: extractPixelValue(styleMap, 'width'),
    height: extractPixelValue(styleMap, 'height')
  };
  geometry.hasPosition = geometry.left !== null && geometry.top !== null;
  geometry.hasSize = geometry.width !== null && geometry.height !== null;
  geometry.overlayReady = geometry.hasPosition && geometry.hasSize;
  if (!geometry.hasPosition && !geometry.hasSize) return createEmptyGeometry();
  return geometry;
}

export function extractImageAttributeGeometry(tagSource) {
  const widthRaw = getAttribute(tagSource, 'width').trim();
  const heightRaw = getAttribute(tagSource, 'height').trim();
  const width = /^\d+(?:\.\d+)?$/.test(widthRaw) ? Number.parseFloat(widthRaw) : null;
  const height = /^\d+(?:\.\d+)?$/.test(heightRaw) ? Number.parseFloat(heightRaw) : null;
  if (width === null && height === null) return createEmptyGeometry();
  const geometry = createEmptyGeometry();
  geometry.source = 'image-attributes';
  geometry.width = Number.isFinite(width) ? width : null;
  geometry.height = Number.isFinite(height) ? height : null;
  geometry.hasSize = geometry.width !== null && geometry.height !== null;
  return geometry;
}

function extractObjectGeometry(tagName, tagSource) {
  const inline = extractInlineGeometry(tagSource);
  if (inline.source !== 'none') return inline;
  if (tagName === 'img') return extractImageAttributeGeometry(tagSource);
  return createEmptyGeometry();
}

export function formatGeometryText(geometry) {
  const status = createGeometryStatus(geometry);
  if (status === 'missing') return 'missing';
  const left = geometry.left === null ? '-' : String(geometry.left);
  const top = geometry.top === null ? '-' : String(geometry.top);
  const width = geometry.width === null ? '-' : String(geometry.width);
  const height = geometry.height === null ? '-' : String(geometry.height);
  return `${status} (${geometry.source}; left:${left}, top:${top}, width:${width}, height:${height})`;
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
      const geometry = extractObjectGeometry(tagName, tagSource);
      objects.push(classifyVisualObject({ objectId: `object-${String(objectNumber).padStart(3, '0')}`, type: 'unknown', tagName, editability: 'locked', allowedActions: [], reason: 'Unsupported or unsafe embedded object.', confidence: 'high', sourceStart, sourceEnd, geometry }));
    } else if (tagName === 'img') {
      const srcPreview = getAttribute(tagSource, 'src');
      const imageClass = classifyImageSrc(srcPreview);
      objectNumber += 1;
      const geometry = extractObjectGeometry(tagName, tagSource);
      objects.push(classifyVisualObject({ objectId: `object-${String(objectNumber).padStart(3, '0')}`, type: 'image', tagName, srcPreview, editability: imageClass.editability, allowedActions: [], reason: imageClass.reason, confidence: imageClass.confidence, sourceStart, sourceEnd, geometry }));
    } else if (TEXT_TAGS.has(tagName)) {
      const closeTag = new RegExp(`<\\s*\\/\\s*${tagName}\\s*>`, 'ig');
      closeTag.lastIndex = tagRegex.lastIndex;
      const closeMatch = closeTag.exec(source);
      const textRegionEnd = closeMatch ? closeMatch.index : tagRegex.lastIndex;
      const between = source.slice(tagRegex.lastIndex, textRegionEnd);
      const withoutTags = normalizeWhitespace(between.replace(/<[^>]*>/g, ''));
      if (withoutTags) {
        const textSourceStart = tagRegex.lastIndex;
        objectNumber += 1;
        const hasNestedTag = /<\s*[a-z][^>]*>/i.test(between);
        const nestedDepth = depth > 0;
        const editable = !hasNestedTag && !nestedDepth;
        const geometry = extractObjectGeometry(tagName, tagSource);
        objects.push(classifyVisualObject({ objectId: `object-${String(objectNumber).padStart(3, '0')}`, type: 'text', tagName, textPreview: withoutTags.slice(0, 80), editableText: withoutTags, editability: editable ? 'editable' : 'partially-editable', allowedActions: editable ? ['text'] : ['text'], reason: editable ? 'Simple text leaf object.' : 'Nested or structured text object; limited text-safe edits only.', confidence: editable ? 'high' : 'medium', sourceStart, sourceEnd, textSourceStart, textSourceEnd: textRegionEnd, textLength: textRegionEnd - textSourceStart, geometry }));
      }
    } else if (CONTAINER_TAGS.has(tagName) && !isSelfClosing) {
      const closeTag = new RegExp(`<\\s*\\/\\s*${tagName}\\s*>`, 'ig');
      closeTag.lastIndex = tagRegex.lastIndex;
      const closeMatch = closeTag.exec(source);
      const content = source.slice(tagRegex.lastIndex, closeMatch ? closeMatch.index : tagRegex.lastIndex);
      if (/(<\s*(h[1-6]|p|button|a|li|label|figcaption|small|img)\b)/i.test(content)) {
        objectNumber += 1;
        const geometry = extractObjectGeometry(tagName, tagSource);
        objects.push(classifyVisualObject({ objectId: `object-${String(objectNumber).padStart(3, '0')}`, type: 'container', tagName, editability: 'partially-editable', allowedActions: [], reason: 'Container includes child visual objects; do not apply destructive overlap edits.', confidence: 'medium', sourceStart, sourceEnd, geometry }));
      }
    }

    if (!isSelfClosing) {
      containerStack.push(tagName);
    }
    match = tagRegex.exec(source);
  }

  return objects;
}

export function findEditableCandidateForVisualObject(visualObject, editableInventory) {
  if (!visualObject || visualObject.type !== 'text' || visualObject.editability !== 'editable') return null;
  if (!Number.isInteger(visualObject.textSourceStart) || !Number.isInteger(visualObject.textSourceEnd)) return null;
  const candidates = editableInventory && Array.isArray(editableInventory.candidates) ? editableInventory.candidates : [];
  return candidates.find((candidate) => (
    candidate &&
    Number.isInteger(candidate.sourceStart) &&
    Number.isInteger(candidate.sourceEnd) &&
    candidate.sourceStart === visualObject.textSourceStart &&
    candidate.sourceEnd === visualObject.textSourceEnd
  )) || null;
}

export function createVisualTextCandidateLinks(visualInventory, editableInventory) {
  const objects = visualInventory && Array.isArray(visualInventory.objects) ? visualInventory.objects : [];
  return objects
    .map((object) => {
      const candidate = findEditableCandidateForVisualObject(object, editableInventory);
      return candidate ? { objectId: object.objectId, candidateId: candidate.candidateId } : null;
    })
    .filter(Boolean);
}

export function createVisualTextEditBridgeState(visualObject, editableInventory) {
  const state = {
    objectId: visualObject && visualObject.objectId ? visualObject.objectId : '',
    linked: false,
    available: false,
    candidateId: '',
    reason: 'Selected object is not safely text-editable in this MVP.'
  };
  if (!visualObject) {
    return { ...state, reason: 'No visual object selected.' };
  }
  if (visualObject.type !== 'text') {
    return { ...state, reason: 'Selected object is not text.' };
  }
  if (visualObject.editability !== 'editable') {
    return { ...state, reason: 'Selected object is not safely text-editable in this MVP.' };
  }
  const candidate = findEditableCandidateForVisualObject(visualObject, editableInventory);
  if (!candidate) {
    return { ...state, reason: 'Selected object is not safely text-editable in this MVP.' };
  }
  return { objectId: visualObject.objectId, linked: true, available: true, candidateId: candidate.candidateId, reason: '' };
}

export function formatVisualTextEditBridgeText(bridgeState) {
  if (!bridgeState || !bridgeState.objectId) return 'Visual text edit bridge: unavailable.';
  if (bridgeState.linked && bridgeState.candidateId) {
    return `Selected visual text object is linked to editable text candidate ${bridgeState.candidateId}.`;
  }
  return `Selected object is not safely text-editable in this MVP.\nobjectId: ${bridgeState.objectId}\nreason: ${bridgeState.reason || 'unavailable'}`;
}

export function getVisualObjectEditableText(visualObject) {
  if (!visualObject || visualObject.type !== 'text') return '';
  return String(visualObject.editableText || '');
}

export function createSelectedTextEditStatus(selectionState, bridgeState) {
  const selectedObject = selectionState && selectionState.selectedObject ? selectionState.selectedObject : null;
  if (!selectedObject) {
    return { editable: false, message: 'Select a visual text object to edit.' };
  }
  if (bridgeState && bridgeState.linked && bridgeState.candidateId) {
    return { editable: true, message: 'Selected text is editable. Review or edit the text below, then apply to preview.' };
  }
  return { editable: false, message: 'This object is locked or not safely text-editable.' };
}

export function formatSelectedTextEditStatus(status) {
  if (!status) return 'Select a visual text object to edit.';
  return status.message || 'Select a visual text object to edit.';
}

export function createVisualObjectInventory(htmlText) {
  const objects = extractVisualObjectsFromHtml(htmlText);
  return {
    summary: {
      totalCount: objects.length,
      editableCount: objects.filter((obj) => obj.editability === 'editable').length,
      partiallyEditableCount: objects.filter((obj) => obj.editability === 'partially-editable').length,
      lockedCount: objects.filter((obj) => obj.editability === 'locked').length,
      geometryReadyCount: objects.filter((obj) => createGeometryStatus(obj.geometry) === 'ready').length,
      geometryPartialCount: objects.filter((obj) => createGeometryStatus(obj.geometry) === 'partial').length,
      geometryMissingCount: objects.filter((obj) => createGeometryStatus(obj.geometry) === 'missing').length
    },
    objects
  };
}

export function formatVisualObjectInventoryText(inventory) {
  if (!inventory || !Array.isArray(inventory.objects) || inventory.objects.length === 0) {
    return 'Visual object discovery: no best-effort visual objects detected.';
  }
  const editableCount = inventory.objects.filter((obj) => obj.editability === 'editable').length;
  const partiallyEditableCount = inventory.objects.filter((obj) => obj.editability === 'partially-editable').length;
  const lockedCount = inventory.objects.filter((obj) => obj.editability === 'locked').length;
  const geometryReadyCount = inventory.objects.filter((obj) => createGeometryStatus(obj.geometry) === 'ready').length;
  const geometryPartialCount = inventory.objects.filter((obj) => createGeometryStatus(obj.geometry) === 'partial').length;
  const geometryMissingCount = inventory.objects.filter((obj) => createGeometryStatus(obj.geometry) === 'missing').length;
  const lines = [
    `Visual object discovery: ${inventory.objects.length} object(s) detected.`,
    `- editable: ${editableCount}`,
    `- partially-editable: ${partiallyEditableCount}`,
    `- locked: ${lockedCount}`,
    `- geometry overlay-ready: ${geometryReadyCount}`,
    `- geometry partial: ${geometryPartialCount}`,
    `- geometry missing: ${geometryMissingCount}`,
    ''
  ];
  for (const obj of inventory.objects) {
    lines.push(`${obj.objectId} | ${obj.type} | <${obj.tagName}> | ${obj.editability} | confidence:${obj.confidence}`);
    lines.push(`  geometry: ${formatGeometryText(obj.geometry)}`);
    if (obj.textPreview) lines.push(`  text: ${obj.textPreview}`);
    if (obj.srcPreview) lines.push(`  src: ${obj.srcPreview}`);
    lines.push(`  reason: ${obj.reason}`);
  }
  return lines.join('\n');
}


export function createMovePatchCollectionState() {
  return { movePatchesByObjectId: {}, orderedObjectIds: [] };
}

export function addOrUpdateMovePatch(collection, patch) {
  const next = collection && Array.isArray(collection.orderedObjectIds)
    ? { movePatchesByObjectId: { ...collection.movePatchesByObjectId }, orderedObjectIds: [...collection.orderedObjectIds] }
    : createMovePatchCollectionState();
  if (!patch || !patch.objectId || !patch.nextGeometry) return { collection: next, changed: false };
  if (!next.orderedObjectIds.includes(patch.objectId)) next.orderedObjectIds.push(patch.objectId);
  next.movePatchesByObjectId[patch.objectId] = { ...patch };
  return { collection: next, changed: true };
}

export function createMovePatchFromNudge(object, dx, dy, existingPatch = null) {
  if (!object || !object.objectId || !object.geometry || !Number.isFinite(object.geometry.left) || !Number.isFinite(object.geometry.top)) return null;
  const baseLeft = existingPatch && existingPatch.nextGeometry ? existingPatch.nextGeometry.left : object.geometry.left;
  const baseTop = existingPatch && existingPatch.nextGeometry ? existingPatch.nextGeometry.top : object.geometry.top;
  return {
    patchId: `patch-move-${object.objectId}`,
    objectId: object.objectId,
    operation: 'move-object',
    deltaX: (existingPatch && Number.isFinite(existingPatch.deltaX) ? existingPatch.deltaX : 0) + dx,
    deltaY: (existingPatch && Number.isFinite(existingPatch.deltaY) ? existingPatch.deltaY : 0) + dy,
    nextGeometry: { left: baseLeft + dx, top: baseTop + dy, width: object.geometry.width, height: object.geometry.height }
  };
}

export function createVisualOverlayItems(inventory, movePatchCollection = null) {
  if (!inventory || !Array.isArray(inventory.objects)) return [];
  return inventory.objects
    .filter((obj) => obj && obj.geometry && obj.geometry.overlayReady)
    .map((obj) => {
      const moved = movePatchCollection && movePatchCollection.movePatchesByObjectId
        ? movePatchCollection.movePatchesByObjectId[obj.objectId]
        : null;
      const geometry = moved && moved.nextGeometry ? moved.nextGeometry : obj.geometry;
      return ({
      objectId: obj.objectId,
      left: geometry.left,
      top: geometry.top,
      width: geometry.width,
      height: geometry.height,
      style: `left:${geometry.left}px;top:${geometry.top}px;width:${geometry.width}px;height:${geometry.height}px;`,
      label: `Overlay ${obj.objectId} (${obj.type})`
      });
    });
}

export function createVisualOverlaySelectionState(overlayItems, selectedObjectId) {
  const items = Array.isArray(overlayItems) ? overlayItems : [];
  return {
    items,
    selectedObjectId: items.some((item) => item.objectId === selectedObjectId) ? selectedObjectId : '',
    hasItems: items.length > 0
  };
}

export function formatOverlayStatusText(selectionState) {
  if (!selectionState || !selectionState.hasItems) {
    return 'Overlay status: No overlay-ready objects found. Objects may still be listed below.';
  }
  if (!selectionState.selectedObjectId) {
    return `Overlay status: ${selectionState.items.length} overlay box(es) ready.`;
  }
  return `Overlay status: ${selectionState.items.length} overlay box(es) ready. Selected: ${selectionState.selectedObjectId}.`;
}

export function selectVisualObject(inventory, objectId) {
  if (!inventory || !Array.isArray(inventory.objects) || !objectId) {
    return null;
  }
  return inventory.objects.find((obj) => obj.objectId === objectId) || null;
}

export function createVisualObjectSelectionState(inventory, objectId) {
  const selectedObject = selectVisualObject(inventory, objectId);
  return {
    available: !!inventory && Array.isArray(inventory.objects) && inventory.objects.length > 0,
    selectedObjectId: selectedObject ? selectedObject.objectId : '',
    selectedObject
  };
}

export function formatVisualObjectOptionLabel(object) {
  if (!object) return '';
  const preview = object.textPreview || object.srcPreview || 'no-preview';
  return `${object.objectId} | ${object.type} | ${preview}`;
}

export function formatVisualObjectSelectionText(selectionState) {
  if (!selectionState || !selectionState.selectedObject) {
    return 'Visual object selection: unavailable.';
  }
  const object = selectionState.selectedObject;
  const actions = Array.isArray(object.allowedActions) && object.allowedActions.length > 0
    ? object.allowedActions.join(', ')
    : 'none';
  const lines = [
    `Selected object: ${object.objectId}`,
    `- type: ${object.type}`,
    `- tag: <${object.tagName}>`,
    `- editability: ${object.editability}`,
    `- confidence: ${object.confidence}`,
    `- allowed actions: ${actions}`,
    `- geometry: ${formatGeometryText(object.geometry)}`,
    `- reason: ${object.reason}`
  ];
  if (object.textPreview) lines.push(`- text preview: ${object.textPreview}`);
  if (object.srcPreview) lines.push(`- source preview: ${object.srcPreview}`);
  return lines.join('\n');
}

const SAFE_IMAGE_MIME_TYPES = new Set(['image/png','image/jpeg','image/jpg','image/gif','image/webp','image/avif']);

export function createImageReplacementPatchCollectionState() {
  return { patchesByObjectId: {}, orderedObjectIds: [] };
}

export function createImageReplacementPatchPlan(visualObject, imageAsset) {
  if (!visualObject || visualObject.type !== 'image' || visualObject.tagName !== 'img' || visualObject.locked) return { applyStatus: 'blocked', warnings: ['not-safely-replaceable'] };
  if (!Number.isInteger(visualObject.sourceStart) || !Number.isInteger(visualObject.sourceEnd) || visualObject.sourceEnd <= visualObject.sourceStart) return { applyStatus: 'blocked', warnings: ['invalid-source-span'] };
  if (!imageAsset || imageAsset.status !== 'ready' || !SAFE_IMAGE_MIME_TYPES.has(String(imageAsset.mimeType || '').toLowerCase())) return { applyStatus: 'blocked', warnings: ['invalid-image-asset'] };
  const prefix = `data:${String(imageAsset.mimeType || '').toLowerCase()};base64,`;
  const dataUrl = String(imageAsset.dataUrl || '');
  if (!dataUrl.startsWith(prefix)) return { applyStatus: 'blocked', warnings: ['invalid-data-url-prefix'] };
  if (/^data:image\/svg\+xml/i.test(dataUrl) || /^data:text\/html/i.test(dataUrl) || /javascript:/i.test(dataUrl)) return { applyStatus: 'blocked', warnings: ['blocked-data-url-type'] };
  return {
    patchId: `image-patch-${visualObject.objectId}`,
    objectId: visualObject.objectId,
    sourceStart: visualObject.sourceStart,
    sourceEnd: visualObject.sourceEnd,
    operation: 'replace-image-src',
    replacementMimeType: imageAsset.mimeType,
    replacementSize: imageAsset.size,
    replacementDataUrl: dataUrl,
    applyStatus: 'planned',
    warnings: []
  };
}

export function addOrUpdateImageReplacementPatch(collection, patch) {
  if (!collection || !patch || patch.applyStatus !== 'planned') return { collection: collection || createImageReplacementPatchCollectionState(), changed: false };
  const next = { patchesByObjectId: { ...collection.patchesByObjectId }, orderedObjectIds: [...collection.orderedObjectIds] };
  if (!next.patchesByObjectId[patch.objectId]) next.orderedObjectIds.push(patch.objectId);
  next.patchesByObjectId[patch.objectId] = patch;
  return { collection: next, changed: true };
}

export function createImageReplacementApplyOperations(htmlText, imagePatchCollection) {
  const ops = [];
  const ids = imagePatchCollection && Array.isArray(imagePatchCollection.orderedObjectIds) ? imagePatchCollection.orderedObjectIds : [];
  for (const objectId of ids) {
    const patch = imagePatchCollection.patchesByObjectId[objectId];
    if (!patch) return { operations: [], warnings: ['missing-image-patch'] };
    const tagSource = htmlText.slice(patch.sourceStart, patch.sourceEnd);
    const match = /\bsrc\s*=\s*(["'])(.*?)\1/i.exec(tagSource);
    if (!match || typeof match.index !== 'number') return { operations: [], warnings: ['missing-src-attribute'] };
    const valueStart = patch.sourceStart + match.index + match[0].indexOf(match[2]);
    const valueEnd = valueStart + match[2].length;
    ops.push({ operationId: `image-${objectId}`, sourceStart: valueStart, sourceEnd: valueEnd, replacementText: patch.replacementDataUrl });
  }
  return { operations: ops, warnings: [] };
}

export function formatImageReplacementStatusText(state) { return state; }

import { createPatchCollectionApplyOperations, applyCombinedPatchOperationsToHtml } from './editable-model.mjs';

export function createVisualMovePatchCollectionState() {
  return { movePatchesByObjectId: {}, orderedObjectIds: [] };
}

export function createVisualMovePatchPlan(visualObject, deltaX, deltaY, existingPatch = null) {
  if (!visualObject || visualObject.locked) return { applyStatus: 'blocked', warnings: ['object-locked'] };
  const geometry = visualObject && visualObject.geometry ? visualObject.geometry : null;
  if (!geometry || geometry.overlayReady !== true || geometry.source !== 'inline-style') return { applyStatus: 'blocked', warnings: ['missing-explicit-inline-geometry'] };
  if (![geometry.left, geometry.top, geometry.width, geometry.height].every(Number.isFinite)) return { applyStatus: 'blocked', warnings: ['missing-explicit-inline-geometry'] };
  if (!Number.isInteger(visualObject.sourceStart) || !Number.isInteger(visualObject.sourceEnd) || visualObject.sourceEnd <= visualObject.sourceStart) return { applyStatus: 'blocked', warnings: ['invalid-source-span'] };
  const base = existingPatch && existingPatch.nextGeometry ? existingPatch.nextGeometry : geometry;
  const prevDx = existingPatch && Number.isFinite(existingPatch.deltaX) ? existingPatch.deltaX : 0;
  const prevDy = existingPatch && Number.isFinite(existingPatch.deltaY) ? existingPatch.deltaY : 0;
  return {
    objectId: visualObject.objectId,
    sourceStart: visualObject.sourceStart,
    sourceEnd: visualObject.sourceEnd,
    originalGeometry: { left: geometry.left, top: geometry.top, width: geometry.width, height: geometry.height },
    nextGeometry: { left: base.left + deltaX, top: base.top + deltaY, width: base.width, height: base.height },
    deltaX: prevDx + deltaX,
    deltaY: prevDy + deltaY,
    applyStatus: 'planned',
    warnings: []
  };
}

export function addOrUpdateVisualMovePatch(collection, movePatch) {
  const next = collection && Array.isArray(collection.orderedObjectIds) ? { movePatchesByObjectId: { ...collection.movePatchesByObjectId }, orderedObjectIds: [...collection.orderedObjectIds] } : createVisualMovePatchCollectionState();
  if (!movePatch || movePatch.applyStatus !== 'planned' || !movePatch.objectId) return { collection: next, changed: false };
  if (!next.orderedObjectIds.includes(movePatch.objectId)) next.orderedObjectIds.push(movePatch.objectId);
  next.movePatchesByObjectId[movePatch.objectId] = movePatch;
  return { collection: next, changed: true };
}

export function updateInlineStylePx(tagSource, nextGeometry) {
  if (typeof tagSource !== 'string' || !tagSource.includes('style=')) return { ok: false, warning: 'style-missing' };
  if (![nextGeometry.left, nextGeometry.top].every(Number.isFinite)) return { ok: false, warning: 'geometry-invalid' };
  const styleMatch = tagSource.match(/style\s*=\s*(["'])([\s\S]*?)\1/i);
  if (!styleMatch) return { ok: false, warning: 'style-missing' };
  const styleText = styleMatch[2];
  if (!/\bleft\s*:\s*-?\d+(?:\.\d+)?px\b/i.test(styleText) || !/\btop\s*:\s*-?\d+(?:\.\d+)?px\b/i.test(styleText)) return { ok: false, warning: 'non-px-or-malformed' };
  const nextStyle = styleText
    .replace(/\bleft\s*:\s*-?\d+(?:\.\d+)?px\b/i, `left:${nextGeometry.left}px`)
    .replace(/\btop\s*:\s*-?\d+(?:\.\d+)?px\b/i, `top:${nextGeometry.top}px`);
  return { ok: true, tagSource: tagSource.replace(styleMatch[0], `style=${styleMatch[1]}${nextStyle}${styleMatch[1]}`) };
}

export function createOverlayItemsWithMoveOverrides(inventory, visualMoveCollection) {
  const objects = inventory && Array.isArray(inventory.objects) ? inventory.objects : [];
  return objects.filter((obj) => obj.geometry && obj.geometry.overlayReady).map((obj) => {
    const patch = visualMoveCollection && visualMoveCollection.movePatchesByObjectId ? visualMoveCollection.movePatchesByObjectId[obj.objectId] : null;
    const geometry = patch && patch.nextGeometry ? patch.nextGeometry : obj.geometry;
    return { objectId: obj.objectId, left: geometry.left, top: geometry.top, width: geometry.width, height: geometry.height, style: `left:${geometry.left}px;top:${geometry.top}px;width:${geometry.width}px;height:${geometry.height}px;` };
  });
}

export function applyVisualMovePatchesToHtml(htmlText, visualMoveCollection, visualInventory) {
  return applyCombinedTextAndVisualPatchesToHtml(htmlText, { patchesByCandidateId: {}, orderedCandidateIds: [] }, visualMoveCollection, { candidates: [] }, visualInventory);
}

export function applyCombinedTextAndVisualPatchesToHtml(htmlText, textPatchCollection, visualMoveCollection, editableInventory, visualInventory) {
  const textOperations = createPatchCollectionApplyOperations(textPatchCollection, editableInventory);
  const visualObjects = visualInventory && Array.isArray(visualInventory.objects) ? visualInventory.objects : [];
  const moveOps = [];
  const moveIds = visualMoveCollection && Array.isArray(visualMoveCollection.orderedObjectIds) ? visualMoveCollection.orderedObjectIds : [];
  for (const objectId of moveIds) {
    const movePatch = visualMoveCollection.movePatchesByObjectId[objectId];
    const visualObject = visualObjects.find((obj) => obj.objectId === objectId);
    if (!movePatch || !visualObject) return { applyStatus: 'blocked-invalid-operations', appliedAny: false, warnings: ['missing-move-object'] };
    const tagSource = htmlText.slice(movePatch.sourceStart, movePatch.sourceEnd);
    const updated = updateInlineStylePx(tagSource, movePatch.nextGeometry);
    if (!updated.ok) return { applyStatus: 'blocked-invalid-operations', appliedAny: false, warnings: [updated.warning] };
    moveOps.push({ operationId: `move-${objectId}`, sourceStart: movePatch.sourceStart, sourceEnd: movePatch.sourceEnd, replacementText: updated.tagSource });
  }
  return applyCombinedPatchOperationsToHtml(htmlText, [...textOperations, ...moveOps]);
}

export function formatVisualMoveStatusText(state) {
  return state;
}

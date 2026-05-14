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

export function createVisualResizeSession(visualObject, handle, pointerStartX, pointerStartY, existingPatch = null) {
  const movePatch = createVisualMovePatchPlan(visualObject, 0, 0, existingPatch);
  if (!movePatch || movePatch.applyStatus !== 'planned') return { applyStatus: 'blocked', warnings: movePatch && movePatch.warnings ? movePatch.warnings : ['missing-explicit-inline-geometry'] };
  if (!['bottom-right', 'right', 'bottom'].includes(handle)) return { applyStatus: 'blocked', warnings: ['invalid-resize-handle'] };
  if (![pointerStartX, pointerStartY].every(Number.isFinite)) return { applyStatus: 'blocked', warnings: ['invalid-pointer-start'] };
  return { applyStatus: 'planned', warnings: [], objectId: visualObject.objectId, handle, pointerStartX, pointerStartY, baseGeometry: movePatch.nextGeometry, existingPatch: existingPatch || null, currentGeometry: movePatch.nextGeometry };
}

export function clampResizeGeometry(geometry, minWidth = 20, minHeight = 20) {
  return { left: Math.round(geometry.left), top: Math.round(geometry.top), width: Math.max(minWidth, Math.round(geometry.width)), height: Math.max(minHeight, Math.round(geometry.height)) };
}

export function updateVisualResizeSession(resizeSession, pointerX, pointerY) {
  if (!resizeSession || resizeSession.applyStatus !== 'planned') return { applyStatus: 'blocked', warnings: ['resize-session-unavailable'] };
  const dx = Math.round(pointerX - resizeSession.pointerStartX);
  const dy = Math.round(pointerY - resizeSession.pointerStartY);
  const next = { ...resizeSession.baseGeometry };
  if (resizeSession.handle === 'bottom-right' || resizeSession.handle === 'right') next.width = resizeSession.baseGeometry.width + dx;
  if (resizeSession.handle === 'bottom-right' || resizeSession.handle === 'bottom') next.height = resizeSession.baseGeometry.height + dy;
  return { ...resizeSession, currentGeometry: clampResizeGeometry(next) };
}

export function createVisualMovePatchFromResize(visualObject, resizeSession) {
  if (!resizeSession || resizeSession.applyStatus !== 'planned') return { applyStatus: 'blocked', warnings: ['resize-session-unavailable'] };
  const nextGeometry = clampResizeGeometry(resizeSession.currentGeometry);
  const movePatch = createVisualMovePatchPlan(visualObject, 0, 0, resizeSession.existingPatch || null);
  if (!movePatch || movePatch.applyStatus !== 'planned') return movePatch;
  return { ...movePatch, nextGeometry };
}



export function createVisualDragSession(visualObject, pointerStartX, pointerStartY, existingPatch = null) {
  const movePatch = createVisualMovePatchPlan(visualObject, 0, 0, existingPatch);
  if (!movePatch || movePatch.applyStatus !== 'planned') return { applyStatus: 'blocked', warnings: movePatch && movePatch.warnings ? movePatch.warnings : ['missing-explicit-inline-geometry'] };
  if (![pointerStartX, pointerStartY].every(Number.isFinite)) return { applyStatus: 'blocked', warnings: ['invalid-pointer-start'] };
  return {
    applyStatus: 'planned',
    warnings: [],
    objectId: visualObject.objectId,
    pointerStartX,
    pointerStartY,
    baseGeometry: movePatch.nextGeometry,
    existingPatch: existingPatch || null,
    deltaX: 0,
    deltaY: 0,
    currentGeometry: movePatch.nextGeometry
  };
}

export function clampDragDelta(deltaX, deltaY) {
  return { deltaX: Math.round(Number.isFinite(deltaX) ? deltaX : 0), deltaY: Math.round(Number.isFinite(deltaY) ? deltaY : 0) };
}

export function updateVisualDragSession(dragSession, pointerX, pointerY) {
  if (!dragSession || dragSession.applyStatus !== 'planned') return { applyStatus: 'blocked', warnings: ['drag-session-unavailable'] };
  const clamped = clampDragDelta(pointerX - dragSession.pointerStartX, pointerY - dragSession.pointerStartY);
  return {
    ...dragSession,
    deltaX: clamped.deltaX,
    deltaY: clamped.deltaY,
    currentGeometry: {
      left: dragSession.baseGeometry.left + clamped.deltaX,
      top: dragSession.baseGeometry.top + clamped.deltaY,
      width: dragSession.baseGeometry.width,
      height: dragSession.baseGeometry.height
    }
  };
}

export function createVisualMovePatchFromDrag(visualObject, dragSession) {
  if (!dragSession || dragSession.applyStatus !== 'planned') return { applyStatus: 'blocked', warnings: ['drag-session-unavailable'] };
  return createVisualMovePatchPlan(visualObject, dragSession.deltaX, dragSession.deltaY, dragSession.existingPatch || null);
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
  if (![nextGeometry.left, nextGeometry.top, nextGeometry.width, nextGeometry.height].every(Number.isFinite)) return { ok: false, warning: 'geometry-invalid' };
  const styleMatch = tagSource.match(/style\s*=\s*(["'])([\s\S]*?)\1/i);
  if (!styleMatch) return { ok: false, warning: 'style-missing' };
  const styleText = styleMatch[2];
  if (!/\bleft\s*:\s*-?\d+(?:\.\d+)?px\b/i.test(styleText) || !/\btop\s*:\s*-?\d+(?:\.\d+)?px\b/i.test(styleText)) return { ok: false, warning: 'non-px-or-malformed' };
  const nextStyle = styleText
    .replace(/\bleft\s*:\s*-?\d+(?:\.\d+)?px\b/i, `left:${nextGeometry.left}px`)
    .replace(/\btop\s*:\s*-?\d+(?:\.\d+)?px\b/i, `top:${nextGeometry.top}px`)
    .replace(/\bwidth\s*:\s*-?\d+(?:\.\d+)?px\b/i, `width:${nextGeometry.width}px`)
    .replace(/\bheight\s*:\s*-?\d+(?:\.\d+)?px\b/i, `height:${nextGeometry.height}px`);
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
  const textPatchIds = textPatchCollection && Array.isArray(textPatchCollection.orderedCandidateIds) ? textPatchCollection.orderedCandidateIds : [];
  const textOperations = createPatchCollectionApplyOperations(textPatchCollection, editableInventory);
  if (textPatchIds.length > 0 && textOperations.length !== textPatchIds.length) {
    return { applyStatus: 'partial-or-failed', appliedAny: false, warnings: ['candidate-not-found', 'patch-application-failed'] };
  }
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

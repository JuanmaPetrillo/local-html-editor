export function createVisualMovePatchCollectionState() {
  return { patchesByObjectId: {}, orderedObjectIds: [] };
}

function hasValidSpan(object) {
  return Number.isInteger(object?.sourceStart) && Number.isInteger(object?.sourceEnd) && object.sourceEnd > object.sourceStart;
}

function hasNumericGeometry(geometry) {
  return Number.isFinite(geometry?.left) && Number.isFinite(geometry?.top) && Number.isFinite(geometry?.width) && Number.isFinite(geometry?.height);
}

export function createVisualMovePatchPlan(visualObject, deltaX, deltaY) {
  const blocked = {
    objectId: visualObject?.objectId || '', applyStatus: 'blocked', warnings: [], message: 'Movement blocked.', deltaX: 0, deltaY: 0
  };
  if (!visualObject) return { ...blocked, warnings: ['no-selected-object'], message: 'No selected object.' };
  if (visualObject.locked || visualObject.editability === 'locked') return { ...blocked, objectId: visualObject.objectId, warnings: ['object-locked'], message: 'Object is locked.' };
  const geometry = visualObject.geometry;
  if (!geometry || geometry.overlayReady !== true) return { ...blocked, objectId: visualObject.objectId, warnings: ['missing-geometry'], message: 'Missing overlay-ready geometry.' };
  if (geometry.source !== 'inline-style') return { ...blocked, objectId: visualObject.objectId, warnings: ['unsupported-geometry-source'], message: 'Geometry source is not inline style.' };
  if (!hasNumericGeometry(geometry)) return { ...blocked, objectId: visualObject.objectId, warnings: ['partial-geometry'], message: 'Geometry is partial.' };
  if (!hasValidSpan(visualObject)) return { ...blocked, objectId: visualObject.objectId, warnings: ['invalid-source-span'], message: 'Invalid opening tag source span.' };
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return { ...blocked, objectId: visualObject.objectId, warnings: ['invalid-delta'], message: 'Invalid movement delta.' };
  const nextGeometry = { ...geometry, left: geometry.left + deltaX, top: geometry.top + deltaY };
  return {
    objectId: visualObject.objectId,
    sourceStart: visualObject.sourceStart,
    sourceEnd: visualObject.sourceEnd,
    originalGeometry: { left: geometry.left, top: geometry.top, width: geometry.width, height: geometry.height },
    nextGeometry: { left: nextGeometry.left, top: nextGeometry.top, width: geometry.width, height: geometry.height },
    deltaX,
    deltaY,
    applyStatus: 'planned',
    warnings: [],
    message: 'Movement planned.'
  };
}

export function addOrUpdateVisualMovePatch(collection, movePatch) {
  const current = collection && Array.isArray(collection.orderedObjectIds) ? collection : createVisualMovePatchCollectionState();
  if (!movePatch || movePatch.applyStatus !== 'planned' || !movePatch.objectId) {
    return { collection: current, updated: false };
  }
  const exists = current.orderedObjectIds.includes(movePatch.objectId);
  return {
    updated: true,
    collection: {
      patchesByObjectId: { ...current.patchesByObjectId, [movePatch.objectId]: { ...movePatch } },
      orderedObjectIds: exists ? [...current.orderedObjectIds] : [...current.orderedObjectIds, movePatch.objectId]
    }
  };
}

export function updateInlineStylePx(tagSource, nextGeometry) {
  const source = String(tagSource || '');
  const styleMatch = source.match(/\bstyle\s*=\s*("([^"]*)"|'([^']*)')/i);
  if (!styleMatch) return null;
  const quoteAndValue = styleMatch[1];
  const styleValue = styleMatch[2] ?? styleMatch[3] ?? '';
  if (!/(^|;)\s*left\s*:\s*-?\d+(?:\.\d+)?px\s*(;|$)/i.test(styleValue)) return null;
  if (!/(^|;)\s*top\s*:\s*-?\d+(?:\.\d+)?px\s*(;|$)/i.test(styleValue)) return null;
  const updatedStyle = styleValue
    .replace(/(^|;)\s*left\s*:\s*-?\d+(?:\.\d+)?px\s*(?=;|$)/i, `$1 left:${nextGeometry.left}px`)
    .replace(/(^|;)\s*top\s*:\s*-?\d+(?:\.\d+)?px\s*(?=;|$)/i, `$1 top:${nextGeometry.top}px`);
  return source.replace(quoteAndValue, `${quoteAndValue[0]}${updatedStyle}${quoteAndValue[0]}`);
}

function spanOverlap(a, b) { return a.start < b.end && b.start < a.end; }

export function applyVisualMovePatchesToHtml(htmlText, visualMoveCollection, visualInventory) {
  const source = String(htmlText || '');
  const base = { workingHtml: source, applyStatus: 'no-move-patches', appliedAny: false, applyResults: [], collectionCount: 0, warnings: [] };
  const ids = visualMoveCollection?.orderedObjectIds || [];
  if (ids.length === 0) return base;
  const objectById = new Map((visualInventory?.objects || []).map((obj) => [obj.objectId, obj]));
  const patches = ids.map((id) => visualMoveCollection.patchesByObjectId[id]).filter(Boolean);
  const sorted = patches.slice().sort((a,b)=> b.sourceStart-a.sourceStart || b.sourceEnd-a.sourceEnd);
  for (let i=0;i<sorted.length;i++) for (let j=i+1;j<sorted.length;j++) if (spanOverlap({start:sorted[i].sourceStart,end:sorted[i].sourceEnd},{start:sorted[j].sourceStart,end:sorted[j].sourceEnd})) {
    return { ...base, applyStatus:'blocked-overlapping-move-patches', collectionCount: sorted.length, warnings:['overlapping-move-patches'] };
  }
  let working = source;
  const results = [];
  for (const patch of sorted) {
    const obj = objectById.get(patch.objectId);
    if (!obj || !hasValidSpan(obj) || patch.applyStatus !== 'planned') { results.push({ objectId: patch.objectId, applied:false, applyStatus:'blocked', warnings:['invalid-move-patch'] }); continue; }
    const openingTag = working.slice(patch.sourceStart, patch.sourceEnd);
    const updatedTag = updateInlineStylePx(openingTag, patch.nextGeometry);
    if (!updatedTag) { results.push({ objectId: patch.objectId, applied:false, applyStatus:'blocked', warnings:['inline-style-update-failed'] }); continue; }
    working = working.slice(0, patch.sourceStart) + updatedTag + working.slice(patch.sourceEnd);
    results.push({ objectId: patch.objectId, applied:true, applyStatus:'applied', warnings:[] });
  }
  const appliedCount = results.filter((r)=>r.applied).length;
  return { workingHtml: working, applyStatus: appliedCount === results.length ? 'applied' : 'partial-or-failed', appliedAny: appliedCount>0, applyResults: results, collectionCount: sorted.length, warnings: [] };
}

export function formatVisualMoveStatusText(state) {
  if (!state) return 'Visual move status: unavailable.';
  return `Visual move status\nstatus: ${state.applyStatus || 'unknown'}\ntracked patches: ${state.collectionCount || 0}`;
}

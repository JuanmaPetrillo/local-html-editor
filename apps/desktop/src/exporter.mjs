import { applyPatchCollectionToWorkingHtml } from './editable-model.mjs';
import { createEditableTextInventory } from './editable-model.mjs';
import { applyVisualMovePatchesToHtml } from './visual-layout-model.mjs';
import { createVisualObjectInventory } from './visual-object-model.mjs';

/** @param {string} fileName */
export function createSuggestedEditedHtmlFileName(fileName) {
  const raw = String(fileName || '').trim();
  const dot = raw.lastIndexOf('.');
  const base = dot > 0 ? raw.slice(0, dot) : raw || 'presentation';
  const safeBase = base.replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'presentation';
  return `${safeBase}-edited.html`;
}

/** @param {string} htmlText @param {string} fileName @param {any} patchCollection */
export function createEditedHtmlExportFromHtmlText(htmlText, fileName, patchCollection, safetySummary = null, visualMoveCollection = null) {
  const patchCount = patchCollection && Array.isArray(patchCollection.orderedCandidateIds)
    ? patchCollection.orderedCandidateIds.length
    : 0;
  const movePatchCount = visualMoveCollection && Array.isArray(visualMoveCollection.orderedObjectIds)
    ? visualMoveCollection.orderedObjectIds.length
    : 0;
  if (patchCount === 0 && movePatchCount === 0) {
    return { fileName, suggestedFileName: createSuggestedEditedHtmlFileName(fileName), mimeType: 'text/html', patchCount, movePatchCount, exported: false, exportStatus: 'blocked', warnings: ['no-patches'], message: 'Export blocked: apply at least one in-memory patch first.' };
  }
  const inventory = createEditableTextInventory(htmlText);
  const applyState = applyPatchCollectionToWorkingHtml(htmlText, patchCollection, inventory);
  if (applyState.applyStatus === 'blocked-overlapping-patches') {
    return { fileName, suggestedFileName: createSuggestedEditedHtmlFileName(fileName), mimeType: 'text/html', patchCount, movePatchCount, exported: false, exportStatus: 'blocked', warnings: ['overlapping-patches'], message: 'Export blocked: overlapping patches target the same source range.' };
  }
  if (patchCount > 0 && (!applyState.appliedAny || applyState.applyStatus !== 'applied-to-working-preview')) {
    return { fileName, suggestedFileName: createSuggestedEditedHtmlFileName(fileName), mimeType: 'text/html', patchCount, movePatchCount, exported: false, exportStatus: 'failed', warnings: ['patch-application-failed'], message: 'Export blocked: one or more patches failed to apply.' };
  }
  const visualInventory = createVisualObjectInventory(htmlText);
  const moveState = applyVisualMovePatchesToHtml(applyState.workingHtml || htmlText, visualMoveCollection, visualInventory);
  if (Array.isArray(moveState.warnings) && moveState.warnings.length > 0) {
    return { fileName, suggestedFileName: createSuggestedEditedHtmlFileName(fileName), mimeType: 'text/html', patchCount, movePatchCount, exported: false, exportStatus: 'blocked', warnings: moveState.warnings, message: 'Export blocked: one or more visual move patches failed to apply safely.' };
  }
  const blob = new Blob([moveState.workingHtml], { type: 'text/html' });
  return {
    fileName,
    suggestedFileName: createSuggestedEditedHtmlFileName(fileName),
    mimeType: 'text/html',
    patchCount,
    movePatchCount,
    exported: true,
    exportStatus: 'ready',
    warnings: [],
    message: 'Edited HTML prepared for local download. The app did not save a copy.',
    disclosureWarning: safetySummary && (safetySummary.hasScripts || safetySummary.hasRemoteReferences)
      ? 'Exported HTML may contain scripts or remote references that were blocked in safe preview. Review before forwarding.'
      : '',
    blob
  };
}

/** @param {any} exportResult */
export function formatExportStatusText(exportResult) {
  if (!exportResult) return 'Export status: unavailable.';
  return [
    `Export status: ${exportResult.exportStatus}.`,
    `File: ${exportResult.fileName}`,
    `Suggested download: ${exportResult.suggestedFileName}`,
    `MIME type: ${exportResult.mimeType}`,
    `Patch count: ${exportResult.patchCount}`,
    `Move patch count: ${exportResult.movePatchCount || 0}`,
    exportResult.message,
    exportResult.disclosureWarning || '',
    'Download is local only and unsaved by the app.'
  ].join('\n');
}

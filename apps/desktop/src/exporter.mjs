import { createEditableTextInventory } from './editable-model.mjs';
import { applyCombinedTextAndVisualPatchesToHtml } from './visual-layout-model.mjs';
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
export function createEditedHtmlExportFromHtmlText(htmlText, fileName, patchCollection, visualMoveCollection, safetySummary = null) {
  const textPatchCount = patchCollection && Array.isArray(patchCollection.orderedCandidateIds) ? patchCollection.orderedCandidateIds.length : 0;
  const movePatchCount = visualMoveCollection && Array.isArray(visualMoveCollection.orderedObjectIds) ? visualMoveCollection.orderedObjectIds.length : 0;
  const patchCount = textPatchCount + movePatchCount;
  if (patchCount === 0) {
    return { fileName, suggestedFileName: createSuggestedEditedHtmlFileName(fileName), mimeType: 'text/html', patchCount, exported: false, exportStatus: 'blocked', warnings: ['no-patches'], message: 'Export blocked: apply at least one in-memory patch first.' };
  }
  const inventory = createEditableTextInventory(htmlText);
  const visualInventory = createVisualObjectInventory(htmlText);
  const applyState = applyCombinedTextAndVisualPatchesToHtml(htmlText, patchCollection, visualMoveCollection, inventory, visualInventory);
  if (!applyState.appliedAny || applyState.applyStatus !== 'applied-to-working-preview') {
    const overlapBlocked = applyState.applyStatus === 'blocked-overlapping-patches' || applyState.applyStatus === 'blocked-overlapping-operations';
    return {
      fileName,
      suggestedFileName: createSuggestedEditedHtmlFileName(fileName),
      mimeType: 'text/html',
      patchCount,
      exported: false,
      exportStatus: overlapBlocked ? 'blocked' : 'failed',
      warnings: overlapBlocked ? ['overlapping-patches'] : ['patch-application-failed'],
      message: overlapBlocked
        ? 'Export blocked: overlapping patches target the same source range.'
        : 'Export blocked: one or more patches failed to apply.'
    };
  }
  const blob = new Blob([applyState.workingHtml], { type: 'text/html' });
  return {
    fileName,
    suggestedFileName: createSuggestedEditedHtmlFileName(fileName),
    mimeType: 'text/html',
    patchCount,
    exported: true,
    exportStatus: 'ready',
    warnings: [],
    message: 'Edited HTML prepared for local download. The app did not save a copy.',
    disclosureWarning: safetySummary && (safetySummary.hasScripts || safetySummary.hasRemoteReferences)
      ? 'Exported HTML may contain scripts or remote references that were blocked in safe preview. Review before forwarding.'
      : '',
    textPatchCount,
    movePatchCount,
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
    `Text patch count: ${exportResult.textPatchCount || 0}`,
    `Move patch count: ${exportResult.movePatchCount || 0}`,
    `Patch count: ${exportResult.patchCount}`,
    exportResult.message,
    exportResult.disclosureWarning || '',
    'Download is local only and unsaved by the app.'
  ].join('\n');
}

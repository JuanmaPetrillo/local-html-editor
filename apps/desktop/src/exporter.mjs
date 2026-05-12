import { applyPatchCollectionToWorkingHtml } from './editable-model.mjs';
import { createEditableTextInventory } from './editable-model.mjs';

/** @param {string} fileName */
export function createSuggestedEditedHtmlFileName(fileName) {
  const raw = String(fileName || '').trim();
  const dot = raw.lastIndexOf('.');
  const base = dot > 0 ? raw.slice(0, dot) : raw || 'presentation';
  const safeBase = base.replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'presentation';
  return `${safeBase}-edited.html`;
}

/** @param {string} htmlText @param {string} fileName @param {any} patchCollection */
export function createEditedHtmlExportFromHtmlText(htmlText, fileName, patchCollection) {
  const patchCount = patchCollection && Array.isArray(patchCollection.orderedCandidateIds)
    ? patchCollection.orderedCandidateIds.length
    : 0;
  if (patchCount === 0) {
    return { fileName, suggestedFileName: createSuggestedEditedHtmlFileName(fileName), mimeType: 'text/html', patchCount, exported: false, exportStatus: 'blocked', warnings: ['no-patches'], message: 'Export blocked: apply at least one in-memory patch first.' };
  }
  const inventory = createEditableTextInventory(htmlText);
  const applyState = applyPatchCollectionToWorkingHtml(htmlText, patchCollection, inventory);
  if (!applyState.appliedAny || applyState.applyStatus !== 'applied-to-working-preview') {
    return { fileName, suggestedFileName: createSuggestedEditedHtmlFileName(fileName), mimeType: 'text/html', patchCount, exported: false, exportStatus: 'failed', warnings: ['patch-application-failed'], message: 'Export blocked: one or more patches failed to apply.' };
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
    exportResult.message,
    'Download is local only and unsaved by the app.'
  ].join('\n');
}

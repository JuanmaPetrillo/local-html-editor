import {
  createImportStatusFromHtmlScan,
  createImportStatusFromZipPreflight,
  createImportManifestFromStatus,
  formatImportStatusSummary,
  formatImportReportText,
  formatImportManifestText,
  importHtmlFileScan,
  importZipFilePreflight,
  createImportReportFromStatus,
  createSafeHtmlPreviewResult,
  createEditableInventoryForHtmlFile,
  createVisualObjectInventoryForHtmlFile,
  createCombinedPatchedSafePreviewResult,
  createEditedHtmlExport
} from './importer.mjs';
import {
  createUnavailablePreviewStatus,
  formatPreviewStatusText
} from './preview-sandbox.mjs';
import {
  createDraftEdit,
  createDraftEditState,
  createPatchPlanState,
  formatPatchPlanText,
  formatDraftEditText,
  formatEditableInventoryText,
  selectEditableCandidate,
  addOrUpdatePatchInCollection,
  createPatchCollectionState,
  formatPatchCollectionText,
  formatWorkingPreviewStateText,
  resetWorkingPreviewState
} from './editable-model.mjs';
import { formatExportStatusText } from './exporter.mjs';
import {
  createVisualObjectSelectionState,
  createVisualOverlayItems,
  
  createVisualOverlaySelectionState,
  formatOverlayStatusText,
  formatVisualObjectInventoryText,
  formatVisualObjectOptionLabel,
  formatVisualObjectSelectionText,
  createVisualTextEditBridgeState,
  formatVisualTextEditBridgeText,
  getVisualObjectEditableText,
  createSelectedTextEditStatus,
  formatSelectedTextEditStatus
} from './visual-object-model.mjs';
import { createVisualMovePatchCollectionState, addOrUpdateVisualMovePatch, createVisualMovePatchPlan, createOverlayItemsWithMoveOverrides } from './visual-layout-model.mjs';

/** @typedef {'html' | 'zip' | 'unknown'} SourceKind */

/**
 * @typedef {object} ProjectFileModel
 * @property {string} name
 * @property {number} size
 * @property {string} type
 * @property {string} extension
 * @property {SourceKind} sourceKind
 * @property {string} selectedAt
 */

/** @param {string} fileName */
export function detectExtension(fileName) {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === fileName.length - 1) {
    return '';
  }

  return fileName.slice(lastDot + 1).toLowerCase();
}

/** @param {string} extension */
export function detectSourceKind(extension) {
  if (extension === 'html' || extension === 'htm') return 'html';
  if (extension === 'zip') return 'zip';
  return 'unknown';
}

/** @param {{name: string, size: number, type: string}} file */
export function createProjectFileModel(file) {
  const extension = detectExtension(file.name);

  return {
    name: file.name,
    size: file.size,
    type: file.type || 'unknown type',
    extension,
    sourceKind: detectSourceKind(extension),
    selectedAt: new Date().toISOString()
  };
}

/** @param {ProjectFileModel | null} project */
export function renderShellState(project) {
  if (!project) {
    return {
      safePreviewPlaceholder: true,
      hasProject: false,
      statusLabel: 'No file selected.',
      detailsLabel: 'Choose an .html, .htm, or .zip file to start a local project model.',
      unsupportedLabel: '',
      scanSummaryLabel: 'Scan summary: waiting for .html/.htm selection.'
    };
  }

  const unsupportedLabel =
    project.sourceKind === 'unknown'
      ? `Unsupported extension: .${project.extension || '(none)'} (metadata captured only).`
      : '';

  const scanSummaryLabel =
    project.sourceKind === 'html'
      ? 'Scan summary: pending local HTML intake scan.'
      : project.sourceKind === 'zip'
        ? 'Scan summary: pending local ZIP preflight.'
        : 'Scan summary: only .html/.htm/.zip files are scanned in this milestone.';

  return {
    safePreviewPlaceholder: true,
    hasProject: true,
    statusLabel: `Selected file: ${project.name}`,
    detailsLabel: `Size: ${project.size} bytes | Type: ${project.type} | Extension: .${project.extension || '(none)'} | Source kind: ${project.sourceKind} | Selected at: ${project.selectedAt}`,
    unsupportedLabel,
    scanSummaryLabel
  };
}

/**
 * @param {'default' | 'compact' | 'tall'} heightMode
 * @param {boolean} fitWidth
 */
export function createPreviewLayoutState(heightMode, fitWidth) {
  return {
    compact: heightMode === 'compact',
    tall: heightMode === 'tall',
    fit: fitWidth
  };
}

const hasDom = typeof document !== 'undefined';
const fileInput = hasDom ? document.querySelector('#file-input') : null;
const fileStatus = hasDom ? document.querySelector('#file-status') : null;
const fileDetails = hasDom ? document.querySelector('#file-details') : null;
const fileWarning = hasDom ? document.querySelector('#file-warning') : null;
const fileScan = hasDom ? document.querySelector('#file-scan') : null;
const importReport = hasDom ? document.querySelector('#import-report') : null;
const importManifest = hasDom ? document.querySelector('#import-manifest') : null;
const editableInventory = hasDom ? document.querySelector('#editable-inventory') : null;
const visualObjectInventory = hasDom ? document.querySelector('#visual-object-inventory') : null;
const visualObjectSelect = hasDom ? document.querySelector('#visual-object-select') : null;
const visualObjectSelectionStatus = hasDom ? document.querySelector('#visual-object-selection-status') : null;
const visualTextEditBridgeStatus = hasDom ? document.querySelector('#visual-text-edit-bridge-status') : null;
const selectedTextEditStatus = hasDom ? document.querySelector('#selected-text-edit-status') : null;
const visualOverlayLayer = hasDom ? document.querySelector('#visual-overlay-layer') : null;
const visualOverlayStatus = hasDom ? document.querySelector('#visual-overlay-status') : null;
const safePreviewFrame = hasDom ? document.querySelector('#safe-preview-frame') : null;
const safePreviewFrameWrap = hasDom ? document.querySelector('#safe-preview-frame-wrap') : null;
const safePreviewStatus = hasDom ? document.querySelector('#safe-preview-status') : null;
const editableCandidateSelect = hasDom ? document.querySelector('#editable-candidate-select') : null;
const editableDraftText = hasDom ? document.querySelector('#editable-draft-text') : null;
const editableDraftStatus = hasDom ? document.querySelector('#editable-draft-status') : null;
const editablePatchPlan = hasDom ? document.querySelector('#editable-patch-plan') : null;
const applyPatchPreview = hasDom ? document.querySelector('#apply-patch-preview') : null;
const patchApplyStatus = hasDom ? document.querySelector('#patch-apply-status') : null;
const patchCollectionStatus = hasDom ? document.querySelector('#patch-collection-status') : null;
const workingPreviewStatus = hasDom ? document.querySelector('#working-preview-status') : null;
const resetWorkingPreview = hasDom ? document.querySelector('#reset-working-preview') : null;
const exportEditedHtml = hasDom ? document.querySelector('#export-edited-html') : null;
const exportStatus = hasDom ? document.querySelector('#export-status') : null;
const nudgeLeft = hasDom ? document.querySelector('#move-selected-left') : null;
const nudgeRight = hasDom ? document.querySelector('#move-selected-right') : null;
const nudgeUp = hasDom ? document.querySelector('#move-selected-up') : null;
const nudgeDown = hasDom ? document.querySelector('#move-selected-down') : null;
const previewFitWidth = hasDom ? document.querySelector('#preview-fit-width') : null;
const previewCompactHeight = hasDom ? document.querySelector('#preview-compact-height') : null;
const previewTallHeight = hasDom ? document.querySelector('#preview-tall-height') : null;
const previewResetLayout = hasDom ? document.querySelector('#preview-reset-layout') : null;

if (
  hasDom &&
  fileInput instanceof HTMLInputElement &&
  fileStatus != null &&
  fileDetails != null &&
  fileWarning != null &&
  fileScan != null &&
  importReport != null &&
  importManifest != null &&
  editableInventory != null &&
  visualObjectInventory != null &&
  visualObjectSelect instanceof HTMLSelectElement &&
  visualObjectSelectionStatus != null &&
  visualTextEditBridgeStatus != null &&
  selectedTextEditStatus != null &&
  visualOverlayLayer != null &&
  visualOverlayStatus != null &&
  safePreviewFrame instanceof HTMLIFrameElement &&
  safePreviewFrameWrap != null &&
  safePreviewStatus != null &&
  editableCandidateSelect instanceof HTMLSelectElement &&
  editableDraftText instanceof HTMLTextAreaElement &&
  editableDraftStatus != null &&
  editablePatchPlan != null &&
  applyPatchPreview != null &&
  patchApplyStatus != null &&
  patchCollectionStatus != null &&
  workingPreviewStatus != null &&
  resetWorkingPreview != null &&
  exportEditedHtml != null &&
  exportStatus != null &&
  previewFitWidth != null &&
  previewCompactHeight != null &&
  previewTallHeight != null &&
  previewResetLayout != null
) {
  /** @param {{compact: boolean, tall: boolean, fit: boolean}} layout */
  const applyPreviewLayoutState = (layout) => {
    safePreviewFrameWrap.classList.toggle('preview-frame--compact', layout.compact);
    safePreviewFrameWrap.classList.toggle('preview-frame--tall', layout.tall);
    safePreviewFrameWrap.classList.toggle('preview-frame--fit', layout.fit);
  };
  applyPreviewLayoutState(createPreviewLayoutState('default', true));
  previewFitWidth.addEventListener('click', () => {
    applyPreviewLayoutState(createPreviewLayoutState('default', true));
  });
  previewCompactHeight.addEventListener('click', () => {
    applyPreviewLayoutState(createPreviewLayoutState('compact', true));
  });
  previewTallHeight.addEventListener('click', () => {
    applyPreviewLayoutState(createPreviewLayoutState('tall', true));
  });
  previewResetLayout.addEventListener('click', () => {
    applyPreviewLayoutState(createPreviewLayoutState('default', true));
  });
  /** @type {{selectedCandidateId: string, draftEdit: any} | null} */
  let draftState = null;
  /** @type {File | null} */
  let currentHtmlFile = null;
  /** @type {any} */
  let currentPatchPlan = null;
  let patchCollection = createPatchCollectionState();
  let movePatchCollection = createVisualMovePatchCollectionState();
  let currentSelectionGeneration = 0;
  let currentExportSafetySummary = null;
  const updateExportUi = () => {
    const textPatchCount = patchCollection.orderedCandidateIds.length;
    const movePatchCount = movePatchCollection.orderedObjectIds.length;
    const totalPatchCount = textPatchCount + movePatchCount;
    exportEditedHtml.disabled = !currentHtmlFile || totalPatchCount === 0;
    exportStatus.textContent = totalPatchCount === 0
      ? 'Export status: blocked (no in-memory patches).'
      : `Export status: ready. ${totalPatchCount} patch(es) in memory.`;
  };

  const resetDraftUi = () => {
    editableCandidateSelect.replaceChildren();
    editableCandidateSelect.disabled = true;
    editableDraftText.value = '';
    editableDraftText.disabled = true;
    editableDraftStatus.textContent = 'Draft edit: unavailable.';
    editablePatchPlan.textContent = 'Patch plan: unavailable.';
    applyPatchPreview.disabled = true;
    patchApplyStatus.textContent = 'Patch apply status: unavailable.';
    patchCollectionStatus.textContent = formatPatchCollectionText(patchCollection);
    workingPreviewStatus.textContent = formatWorkingPreviewStateText(resetWorkingPreviewState());
    updateExportUi();
    draftState = null;
    currentExportSafetySummary = null;
  };
  const resetVisualObjectSelectionUi = () => {
    visualObjectSelect.replaceChildren();
    visualObjectSelect.disabled = true;
    visualObjectSelectionStatus.textContent = 'Visual object selection: unavailable.';
    visualTextEditBridgeStatus.textContent = 'Visual text edit bridge: unavailable.';
    selectedTextEditStatus.textContent = 'Select a visual text object to edit.';
    visualOverlayLayer.replaceChildren();
    visualOverlayStatus.textContent = 'Overlay status: waiting for .html/.htm selection.';
  };

  const renderVisualOverlay = (inventory, selectedObjectId) => {
    visualOverlayLayer.replaceChildren();
    const overlayItems = createOverlayItemsWithMoveOverrides(inventory, movePatchCollection);
    const overlayState = createVisualOverlaySelectionState(overlayItems, selectedObjectId);
    for (const item of overlayState.items) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'visual-overlay-box';
      button.dataset.objectId = item.objectId;
      button.style.cssText = item.style;
      button.setAttribute('aria-label', item.label);
      button.setAttribute('aria-pressed', item.objectId === overlayState.selectedObjectId ? 'true' : 'false');
      button.addEventListener('click', () => {
        visualObjectSelect.value = item.objectId;
        renderVisualObjectSelection(currentVisualInventory);
      });
      visualOverlayLayer.appendChild(button);
    }
    visualOverlayStatus.textContent = formatOverlayStatusText(overlayState);
  };

  const renderVisualObjectSelection = (inventory) => {
    const state = createVisualObjectSelectionState(inventory, visualObjectSelect.value);
    visualObjectSelectionStatus.textContent = formatVisualObjectSelectionText(state);
    const bridgeState = createVisualTextEditBridgeState(state.selectedObject, currentInventory);
    visualTextEditBridgeStatus.textContent = formatVisualTextEditBridgeText(bridgeState);
    selectedTextEditStatus.textContent = formatSelectedTextEditStatus(createSelectedTextEditStatus(state, bridgeState));
    if (bridgeState.linked && bridgeState.candidateId) {
      const selectedText = getVisualObjectEditableText(state.selectedObject);
      if (!draftPrefillByCandidateId.has(bridgeState.candidateId)) {
        draftPrefillByCandidateId.set(bridgeState.candidateId, selectedText);
      }
      editableCandidateSelect.value = bridgeState.candidateId;
      editableDraftText.value = draftPrefillByCandidateId.get(bridgeState.candidateId) || '';
      renderDraftFromSelection(currentInventory);
    }
    renderVisualOverlay(inventory, state.selectedObjectId);
    const selected = state.selectedObject;
    const nudgeEnabled = !!(selected && selected.geometry && Number.isFinite(selected.geometry.left) && Number.isFinite(selected.geometry.top));
    if (nudgeLeft != null) nudgeLeft.disabled = !nudgeEnabled;
    if (nudgeRight != null) nudgeRight.disabled = !nudgeEnabled;
    if (nudgeUp != null) nudgeUp.disabled = !nudgeEnabled;
    if (nudgeDown != null) nudgeDown.disabled = !nudgeEnabled;
  };

  const renderDraftFromSelection = (inventory) => {
    const candidate = selectEditableCandidate(inventory, editableCandidateSelect.value);
    draftState = { selectedCandidateId: editableCandidateSelect.value, draftEdit: createDraftEdit(candidate, editableDraftText.value) };
    editableDraftStatus.textContent = formatDraftEditText(draftState);
    currentPatchPlan = createPatchPlanState(draftState).patchPlan;
    editablePatchPlan.textContent = formatPatchPlanText(currentPatchPlan);
    applyPatchPreview.disabled = !currentPatchPlan || currentPatchPlan.applyStatus !== 'planned';
  };

  resetDraftUi();
  resetVisualObjectSelectionUi();
  if (nudgeLeft != null) nudgeLeft.disabled = true;
  if (nudgeRight != null) nudgeRight.disabled = true;
  if (nudgeUp != null) nudgeUp.disabled = true;
  if (nudgeDown != null) nudgeDown.disabled = true;

  visualObjectSelect.addEventListener('change', () => {
    renderVisualObjectSelection(currentVisualInventory);
  });

  editableCandidateSelect.addEventListener('change', () => {
    editableDraftText.value = draftPrefillByCandidateId.get(editableCandidateSelect.value) || '';
    renderDraftFromSelection(currentInventory);
  });

  editableDraftText.addEventListener('input', () => {
    draftPrefillByCandidateId.set(editableCandidateSelect.value, editableDraftText.value);
    renderDraftFromSelection(currentInventory);
  });

  /** @type {any} */
  let currentInventory = null;
  /** @type {any} */
  let currentVisualInventory = null;
  const draftPrefillByCandidateId = new Map();


  applyPatchPreview.addEventListener('click', async () => {
    if (!currentHtmlFile || !currentPatchPlan || currentPatchPlan.applyStatus !== 'planned') {
      patchApplyStatus.textContent = 'Patch apply status: blocked (no planned patch available).';
      return;
    }
    const nextCollection = addOrUpdatePatchInCollection(patchCollection, currentPatchPlan);
    patchCollection = nextCollection.collection;
    patchCollectionStatus.textContent = formatPatchCollectionText(patchCollection);
    updateExportUi();
    const patched = await createCombinedPatchedSafePreviewResult(currentHtmlFile, patchCollection, movePatchCollection);
    if (!patched) {
      patchApplyStatus.textContent = 'Patch apply status: failed (no HTML preview path).';
      return;
    }
    patchApplyStatus.textContent = `Patch apply status: ${patched.applyState.applyStatus}.`;
    workingPreviewStatus.textContent = formatWorkingPreviewStateText(patched.applyState);
    if (patched.previewResult) {
      safePreviewFrame.srcdoc = patched.previewResult.previewDocument;
      safePreviewStatus.textContent = formatPreviewStatusText(patched.previewResult.previewStatus);
    }
  });


  resetWorkingPreview.addEventListener('click', async () => {
    if (!currentHtmlFile) return;
    patchCollection = createPatchCollectionState();
    movePatchCollection = createVisualMovePatchCollectionState();
    patchCollectionStatus.textContent = formatPatchCollectionText(patchCollection);
    updateExportUi();
    workingPreviewStatus.textContent = formatWorkingPreviewStateText(resetWorkingPreviewState());
    patchApplyStatus.textContent = 'Patch apply status: reset to original preview.';
    const previewResult = await createSafeHtmlPreviewResult(currentHtmlFile);
    if (previewResult) {
      safePreviewFrame.srcdoc = previewResult.previewDocument;
      safePreviewStatus.textContent = formatPreviewStatusText(previewResult.previewStatus);
    }
  });

  fileInput.addEventListener('change', async () => {
    currentSelectionGeneration += 1;
    const selectionGeneration = currentSelectionGeneration;
    const selected = fileInput.files && fileInput.files.length > 0 ? fileInput.files[0] : null;
    const project = selected
      ? createProjectFileModel({
          name: selected.name,
          size: selected.size,
          type: selected.type
        })
      : null;
    const shellState = renderShellState(project);
    fileStatus.textContent = shellState.statusLabel;
    fileDetails.textContent = shellState.detailsLabel;
    fileWarning.textContent = shellState.unsupportedLabel;
    fileScan.textContent = shellState.scanSummaryLabel;
    importReport.textContent = '';
    importManifest.textContent = '';
    visualObjectInventory.textContent = 'Visual object discovery: waiting for .html/.htm selection.';
    resetVisualObjectSelectionUi();
    currentVisualInventory = null;
    visualTextEditBridgeStatus.textContent = 'Visual text edit bridge: unavailable.';
    editableInventory.textContent = 'Editable text candidates: unavailable.';
    currentInventory = null;
    currentHtmlFile = null;
    currentPatchPlan = null;
    patchCollection = createPatchCollectionState();
    movePatchCollection = createVisualMovePatchCollectionState();
    resetDraftUi();
    updateExportUi();
    safePreviewFrame.srcdoc =
      '<!doctype html><html><body><p>Safe preview unavailable for this selection.</p></body></html>';

    if (selected && project && project.sourceKind === 'html') {
      const scanResult = await importHtmlFileScan(selected);
      if (selectionGeneration !== currentSelectionGeneration) return;
      currentHtmlFile = selected;
      const status = createImportStatusFromHtmlScan(scanResult);
      currentExportSafetySummary = {
        hasScripts: scanResult.ok && scanResult.scan.scriptTagCount > 0,
        hasRemoteReferences: scanResult.ok && (scanResult.scan.remoteUrlCount > 0 || scanResult.referenceScan.byType.remote > 0)
      };
      const report = createImportReportFromStatus(status);
      fileScan.textContent = formatImportStatusSummary(status);
      importReport.textContent = formatImportReportText(report);
      importManifest.textContent = formatImportManifestText(createImportManifestFromStatus(status, report));
      const inventory = await createEditableInventoryForHtmlFile(selected);
      if (selectionGeneration !== currentSelectionGeneration) return;
      const visualInventory = await createVisualObjectInventoryForHtmlFile(selected);
      if (selectionGeneration !== currentSelectionGeneration) return;
      currentVisualInventory = visualInventory;
      currentInventory = inventory;
      draftPrefillByCandidateId.clear();
      visualObjectInventory.textContent = formatVisualObjectInventoryText(visualInventory);
      visualObjectSelect.replaceChildren();
      if (visualInventory && Array.isArray(visualInventory.objects)) {
        for (const object of visualInventory.objects) {
          const option = document.createElement('option');
          option.value = object.objectId;
          option.textContent = formatVisualObjectOptionLabel(object);
          visualObjectSelect.appendChild(option);
        }
      }
      visualObjectSelect.disabled = !visualInventory || !Array.isArray(visualInventory.objects) || visualInventory.objects.length === 0;
      if (!visualObjectSelect.disabled) {
        visualObjectSelect.value = visualInventory.objects[0].objectId;
      }
      editableInventory.textContent = formatEditableInventoryText(inventory);
      draftState = createDraftEditState(inventory);
      editableCandidateSelect.replaceChildren();
      for (const candidate of inventory.candidates) {
        const option = document.createElement('option');
        option.value = candidate.candidateId;
        option.textContent = `${candidate.candidateId} | <${candidate.tagName}> | ${candidate.textPreview}`;
        editableCandidateSelect.appendChild(option);
      }
      editableCandidateSelect.disabled = inventory.candidates.length === 0;
      editableDraftText.disabled = inventory.candidates.length === 0;
      if (draftState.selectedCandidateId && !editableCandidateSelect.value) {
        editableCandidateSelect.value = draftState.selectedCandidateId;
      }
      editableDraftText.value = '';
      renderVisualObjectSelection(visualInventory);
      renderDraftFromSelection(inventory);
      const previewResult = await createSafeHtmlPreviewResult(selected);
      if (selectionGeneration !== currentSelectionGeneration) return;
      safePreviewFrame.srcdoc = previewResult ? previewResult.previewDocument : safePreviewFrame.srcdoc;
      safePreviewStatus.textContent = previewResult
        ? formatPreviewStatusText(previewResult.previewStatus)
        : 'Safe static preview: unavailable.';
    }

    if (selected && project && project.sourceKind === 'zip') {
      const scanResult = await importZipFilePreflight(selected);
      if (selectionGeneration !== currentSelectionGeneration) return;
      const status = createImportStatusFromZipPreflight(scanResult);
      currentExportSafetySummary = null;
      const report = createImportReportFromStatus(status);
      fileScan.textContent = formatImportStatusSummary(status);
      importReport.textContent = formatImportReportText(report);
      importManifest.textContent = formatImportManifestText(createImportManifestFromStatus(status, report));
      visualObjectInventory.textContent = 'Visual object discovery: unavailable for ZIP selection.';
      resetVisualObjectSelectionUi();
      editableInventory.textContent = 'Editable text candidates: unavailable for ZIP selection.';
      safePreviewStatus.textContent = formatPreviewStatusText(createUnavailablePreviewStatus('zip', project.name));
    }

    if (selected && project && project.sourceKind === 'unknown') {
      currentExportSafetySummary = null;
      const unsupportedStatus = {
        sourceKind: 'unknown',
        fileName: project.name,
        fileSize: project.size,
        type: project.type,
        extension: project.extension || null,
        ok: false,
        severity: 'error',
        warningLabels: ['unsupported-extension'],
        checks: null
      };
      const report = createImportReportFromStatus(unsupportedStatus);
      importManifest.textContent = formatImportManifestText(
        createImportManifestFromStatus(unsupportedStatus, report)
      );
      visualObjectInventory.textContent = 'Visual object discovery: unavailable for this file type.';
      resetVisualObjectSelectionUi();
      editableInventory.textContent = 'Editable text candidates: unavailable for this file type.';
      safePreviewStatus.textContent = formatPreviewStatusText(
        createUnavailablePreviewStatus('unknown', project.name)
      );
    }
  });

  exportEditedHtml.addEventListener('click', async () => {
    if (!currentHtmlFile) return;
    const exportResult = await createEditedHtmlExport(currentHtmlFile, patchCollection, movePatchCollection, currentExportSafetySummary);
    exportStatus.textContent = formatExportStatusText(exportResult);
    if (!exportResult.exported || !exportResult.blob) return;
    const objectUrl = URL.createObjectURL(exportResult.blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = exportResult.suggestedFileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    exportStatus.textContent = formatExportStatusText({ ...exportResult, exportStatus: 'exported' });
  });
}
  const applyNudge = (dx, dy) => {
    const state = createVisualObjectSelectionState(currentVisualInventory, visualObjectSelect.value);
    if (!state.selectedObject) return;
    const existing = movePatchCollection.movePatchesByObjectId[state.selectedObject.objectId];
    const patch = createVisualMovePatchPlan(state.selectedObject, dx, dy, existing);
    if (!patch) return;
    movePatchCollection = addOrUpdateVisualMovePatch(movePatchCollection, patch).collection;
    const moveStatus = document.querySelector('#visual-move-status'); if (moveStatus) moveStatus.textContent = patch.applyStatus === "planned" ? "Moved selected object." : "Movement blocked: missing explicit inline geometry.";
    updateExportUi();
    renderVisualOverlay(currentVisualInventory, state.selectedObject.objectId);
  };
  if (nudgeLeft != null) nudgeLeft.addEventListener('click', () => applyNudge(-10, 0));
  if (nudgeRight != null) nudgeRight.addEventListener('click', () => applyNudge(10, 0));
  if (nudgeUp != null) nudgeUp.addEventListener('click', () => applyNudge(0, -10));
  if (nudgeDown != null) nudgeDown.addEventListener('click', () => applyNudge(0, 10));

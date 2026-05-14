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
  createEditedHtmlExport,
  createReplacementImageAssetFromFile,
  createProjectPayloadFromFile
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
import { createVisualMovePatchCollectionState, addOrUpdateVisualMovePatch, createVisualMovePatchPlan, createOverlayItemsWithMoveOverrides, createVisualDragSession, updateVisualDragSession, createVisualMovePatchFromDrag, createVisualResizeSession, updateVisualResizeSession, createVisualMovePatchFromResize } from './visual-layout-model.mjs';
import { createImageReplacementPatchCollectionState, createImageReplacementPatchPlan, addOrUpdateImageReplacementPatch } from './image-replacement-model.mjs';
import { createProjectSavePayload, parseProjectSavePayload, createSourceFileFingerprint, validateSourceFileFingerprint, createProjectFileName, formatProjectPersistenceStatusText } from './project-persistence-model.mjs';

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


export function createZipMainHtmlSelectionUiState(zipManifest) {
  const htmlEntries = zipManifest && Array.isArray(zipManifest.htmlEntries) ? zipManifest.htmlEntries : [];
  if (htmlEntries.length === 0) {
    return {
      disabled: true,
      selectedPath: '',
      statusText: 'ZIP main HTML selection: unavailable (entry listing not available in this build).'
    };
  }
  if (zipManifest && zipManifest.selectionRequired) {
    return {
      disabled: false,
      selectedPath: '',
      statusText: 'ZIP main HTML selection: multiple entries detected; choose one entry.'
    };
  }
  const selectedPath = zipManifest && zipManifest.autoSelectedMainHtmlPath ? zipManifest.autoSelectedMainHtmlPath : htmlEntries[0].normalizedPath;
  return {
    disabled: true,
    selectedPath,
    statusText: `ZIP main HTML selection: auto-selected ${selectedPath}.`
  };
}

/** @param {any} visualObject */
export function canCreateImageReplacementPatchForObject(visualObject) {
  return !!(
    visualObject &&
    visualObject.type === 'image' &&
    visualObject.tagName === 'img' &&
    !visualObject.locked &&
    Number.isInteger(visualObject.sourceStart) &&
    Number.isInteger(visualObject.sourceEnd) &&
    visualObject.sourceEnd > visualObject.sourceStart
  );
}

const hasDom = typeof document !== 'undefined';
const fileInput = hasDom ? document.querySelector('#file-input') : null;
const fileStatus = hasDom ? document.querySelector('#file-status') : null;
const fileDetails = hasDom ? document.querySelector('#file-details') : null;
const fileWarning = hasDom ? document.querySelector('#file-warning') : null;
const fileScan = hasDom ? document.querySelector('#file-scan') : null;
const importReport = hasDom ? document.querySelector('#import-report') : null;
const importManifest = hasDom ? document.querySelector('#import-manifest') : null;
const zipMainHtmlSelect = hasDom ? document.querySelector('#zip-main-html-select') : null;
const zipMainHtmlStatus = hasDom ? document.querySelector('#zip-main-html-status') : null;
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
const replacementImageInput = hasDom ? document.querySelector('#replacement-image-input') : null;
const imageReplacementStatus = hasDom ? document.querySelector('#image-replacement-status') : null;
const saveProjectFile = hasDom ? document.querySelector('#save-project-file') : null;
const openProjectFile = hasDom ? document.querySelector('#open-project-file') : null;
const projectPersistenceStatus = hasDom ? document.querySelector('#project-persistence-status') : null;

if (
  hasDom &&
  fileInput instanceof HTMLInputElement &&
  fileStatus != null &&
  fileDetails != null &&
  fileWarning != null &&
  fileScan != null &&
  importReport != null &&
  importManifest != null &&
  zipMainHtmlSelect instanceof HTMLSelectElement &&
  zipMainHtmlStatus != null &&
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
  previewResetLayout != null &&
  replacementImageInput instanceof HTMLInputElement &&
  imageReplacementStatus != null &&
  saveProjectFile != null &&
  openProjectFile instanceof HTMLInputElement &&
  projectPersistenceStatus != null
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
  let imagePatchCollection = createImageReplacementPatchCollectionState();
  let currentSelectionGeneration = 0;
  let currentExportSafetySummary = null;
  let currentDragSession = null;
  let currentResizeSession = null;
  let pendingProjectPayload = null;
  projectPersistenceStatus.textContent = formatProjectPersistenceStatusText('neutral');
  const updateExportUi = () => {
    const textPatchCount = patchCollection.orderedCandidateIds.length;
    const movePatchCount = movePatchCollection.orderedObjectIds.length;
    const imagePatchCount = imagePatchCollection.orderedObjectIds.length;
    const totalPatchCount = textPatchCount + movePatchCount + imagePatchCount;
    exportEditedHtml.disabled = !currentHtmlFile || totalPatchCount === 0;
    saveProjectFile.disabled = !currentHtmlFile || totalPatchCount === 0;
    exportStatus.textContent = totalPatchCount === 0
      ? 'Export status: blocked (no in-memory patches).'
      : `Export status: ready. ${totalPatchCount} patch(es) in memory.`;
  };

  const resetZipMainHtmlSelectionUi = () => {
    zipMainHtmlSelect.replaceChildren();
    zipMainHtmlSelect.disabled = true;
    zipMainHtmlStatus.textContent = 'ZIP main HTML selection: unavailable.';
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
    replacementImageInput.value = '';
    replacementImageInput.disabled = true;
    resetZipMainHtmlSelectionUi();
    imageReplacementStatus.textContent = 'Selected object is not safely image-replaceable.';
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
    if (nudgeLeft != null) nudgeLeft.disabled = true;
    if (nudgeRight != null) nudgeRight.disabled = true;
    if (nudgeUp != null) nudgeUp.disabled = true;
    if (nudgeDown != null) nudgeDown.disabled = true;
    const moveStatus = document.querySelector('#visual-move-status');
    if (moveStatus) moveStatus.textContent = 'Movement blocked: this object cannot be moved safely.';
    setResizeStatusText('Resize blocked: this object cannot be resized safely.');
    replacementImageInput.disabled = true;
    replacementImageInput.value = '';
    imageReplacementStatus.textContent = 'Selected object is not safely image-replaceable.';
  };

  const setMoveStatusText = (text) => {
    const moveStatus = document.querySelector('#visual-move-status');
    if (moveStatus) moveStatus.textContent = text;
  };
  const setResizeStatusText = (text) => {
    const resizeStatus = document.querySelector('#visual-resize-status');
    if (resizeStatus) resizeStatus.textContent = text;
  };

  const handleDragCancel = () => {
    if (!currentDragSession || !currentVisualInventory) return;
    renderVisualOverlay(currentVisualInventory, currentDragSession.objectId);
    currentDragSession = null;
    setMoveStatusText('Drag canceled.');
  };
  const handleResizeCancel = () => {
    if (!currentResizeSession || !currentVisualInventory) return;
    renderVisualOverlay(currentVisualInventory, currentResizeSession.objectId);
    currentResizeSession = null;
    setResizeStatusText('Resize blocked: this object cannot be resized safely.');
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
      button.addEventListener('pointerdown', (event) => {
        if (event.target && event.target instanceof HTMLElement && event.target.classList.contains('visual-resize-handle')) return;
        if (!currentVisualInventory) return;
        visualObjectSelect.value = item.objectId;
        const state = createVisualObjectSelectionState(currentVisualInventory, item.objectId);
        const selected = state.selectedObject;
        const existingMovePatch = selected && selected.objectId ? movePatchCollection.movePatchesByObjectId[selected.objectId] : null;
        const dragSession = createVisualDragSession(selected, event.clientX, event.clientY, existingMovePatch);
        if (!dragSession || dragSession.applyStatus !== 'planned') {
          setMoveStatusText('Movement blocked: this object cannot be moved safely.');
          return;
        }
        currentDragSession = dragSession;
        button.setPointerCapture(event.pointerId);
        setMoveStatusText('Drag selected object');
      });
      button.addEventListener('pointermove', (event) => {
        if (!currentDragSession || currentDragSession.objectId !== item.objectId) return;
        currentDragSession = updateVisualDragSession(currentDragSession, event.clientX, event.clientY);
        if (currentDragSession.applyStatus !== 'planned') return;
        button.style.cssText = `left:${currentDragSession.currentGeometry.left}px;top:${currentDragSession.currentGeometry.top}px;width:${currentDragSession.currentGeometry.width}px;height:${currentDragSession.currentGeometry.height}px;`;
      });
      button.addEventListener('pointerup', async (event) => {
        if (!currentDragSession || currentDragSession.objectId !== item.objectId || !currentVisualInventory) return;
        const state = createVisualObjectSelectionState(currentVisualInventory, item.objectId);
        const patch = createVisualMovePatchFromDrag(state.selectedObject, currentDragSession);
        currentDragSession = null;
        if (!patch || patch.applyStatus !== 'planned') {
          setMoveStatusText('Movement blocked: this object cannot be moved safely.');
          renderVisualOverlay(currentVisualInventory, item.objectId);
          return;
        }
        if (patch.deltaX === 0 && patch.deltaY === 0) {
          renderVisualOverlay(currentVisualInventory, item.objectId);
          setMoveStatusText('Drag selected object');
          return;
        }
        const previousCollection = movePatchCollection;
        movePatchCollection = addOrUpdateVisualMovePatch(movePatchCollection, patch).collection;
        let commitSucceeded = true;
        if (currentHtmlFile) {
          const patched = await createCombinedPatchedSafePreviewResult(currentHtmlFile, patchCollection, movePatchCollection, imagePatchCollection);
          if (patched && patched.previewResult && patched.previewResult.previewDocument) {
            safePreviewFrame.srcdoc = patched.previewResult.previewDocument;
            safePreviewStatus.textContent = formatPreviewStatusText(patched.previewResult.previewStatus);
          } else {
            commitSucceeded = false;
            movePatchCollection = previousCollection;
            updateExportUi();
            renderVisualOverlay(currentVisualInventory, item.objectId);
            setMoveStatusText('Movement blocked: this object cannot be moved safely.');
            visualObjectSelect.value = item.objectId;
            return;
          }
        }
        updateExportUi();
        visualObjectSelect.value = item.objectId;
        renderVisualObjectSelection(currentVisualInventory);
        if (commitSucceeded) setMoveStatusText('Moved selected object.');
      });
      button.addEventListener('pointercancel', () => { handleDragCancel(); });
      if (item.objectId === overlayState.selectedObjectId) {
        for (const handle of ['bottom-right', 'right', 'bottom']) {
          const handleEl = document.createElement('span');
          handleEl.className = 'visual-resize-handle';
          handleEl.dataset.resizeHandle = handle;
          handleEl.setAttribute('role', 'presentation');
          handleEl.setAttribute('title', `Resize selected object (${handle})`);
          handleEl.addEventListener('pointerdown', (event) => {
            if (!currentVisualInventory) return;
            const state = createVisualObjectSelectionState(currentVisualInventory, item.objectId);
            const selected = state.selectedObject;
            const existingMovePatch = selected && selected.objectId ? movePatchCollection.movePatchesByObjectId[selected.objectId] : null;
            const resizeSession = createVisualResizeSession(selected, handle, event.clientX, event.clientY, existingMovePatch);
            if (!resizeSession || resizeSession.applyStatus !== 'planned') {
              setResizeStatusText('Resize blocked: this object cannot be resized safely.');
              return;
            }
            currentResizeSession = resizeSession;
            handleEl.setPointerCapture(event.pointerId);
          });
          handleEl.addEventListener('pointermove', (event) => {
            if (!currentResizeSession || currentResizeSession.objectId !== item.objectId || currentResizeSession.handle !== handle) return;
            currentResizeSession = updateVisualResizeSession(currentResizeSession, event.clientX, event.clientY);
            if (currentResizeSession.applyStatus !== 'planned') return;
            button.style.cssText = `left:${currentResizeSession.currentGeometry.left}px;top:${currentResizeSession.currentGeometry.top}px;width:${currentResizeSession.currentGeometry.width}px;height:${currentResizeSession.currentGeometry.height}px;`;
          });
          handleEl.addEventListener('pointerup', async () => {
            if (!currentResizeSession || currentResizeSession.objectId !== item.objectId || !currentVisualInventory) return;
            const state = createVisualObjectSelectionState(currentVisualInventory, item.objectId);
            const patch = createVisualMovePatchFromResize(state.selectedObject, currentResizeSession);
            currentResizeSession = null;
            if (!patch || patch.applyStatus !== 'planned') {
              setResizeStatusText('Resize blocked: this object cannot be resized safely.');
              renderVisualOverlay(currentVisualInventory, item.objectId);
              return;
            }
            const unchanged = patch.originalGeometry.left === patch.nextGeometry.left
              && patch.originalGeometry.top === patch.nextGeometry.top
              && patch.originalGeometry.width === patch.nextGeometry.width
              && patch.originalGeometry.height === patch.nextGeometry.height;
            if (unchanged) {
              renderVisualOverlay(currentVisualInventory, item.objectId);
              setResizeStatusText('Drag a corner handle to resize.');
              return;
            }
            const previousCollection = movePatchCollection;
            movePatchCollection = addOrUpdateVisualMovePatch(movePatchCollection, patch).collection;
            if (currentHtmlFile) {
              const patched = await createCombinedPatchedSafePreviewResult(currentHtmlFile, patchCollection, movePatchCollection, imagePatchCollection);
              if (patched && patched.previewResult && patched.previewResult.previewDocument) {
                safePreviewFrame.srcdoc = patched.previewResult.previewDocument;
                safePreviewStatus.textContent = formatPreviewStatusText(patched.previewResult.previewStatus);
              } else {
                movePatchCollection = previousCollection;
                updateExportUi();
                renderVisualOverlay(currentVisualInventory, item.objectId);
                setResizeStatusText('Resize blocked: this object cannot be resized safely.');
                visualObjectSelect.value = item.objectId;
                return;
              }
            }
            updateExportUi();
            visualObjectSelect.value = item.objectId;
            renderVisualObjectSelection(currentVisualInventory);
            setResizeStatusText('Resized selected object.');
          });
          handleEl.addEventListener('pointercancel', () => { handleResizeCancel(); });
          button.appendChild(handleEl);
        }
      }
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
    const existingMovePatch = selected && selected.objectId ? movePatchCollection.movePatchesByObjectId[selected.objectId] : null;
    const movePlan = selected ? createVisualMovePatchPlan(selected, 0, 0, existingMovePatch) : null;
    const nudgeEnabled = !!(movePlan && movePlan.applyStatus === 'planned');
    if (nudgeLeft != null) nudgeLeft.disabled = !nudgeEnabled;
    if (nudgeRight != null) nudgeRight.disabled = !nudgeEnabled;
    if (nudgeUp != null) nudgeUp.disabled = !nudgeEnabled;
    if (nudgeDown != null) nudgeDown.disabled = !nudgeEnabled;
    const moveStatus = document.querySelector('#visual-move-status');
    if (moveStatus) moveStatus.textContent = nudgeEnabled ? 'Drag an overlay box or use nudge buttons.' : 'Movement blocked: this object cannot be moved safely.';
    setResizeStatusText(nudgeEnabled ? 'Drag a corner handle to resize.' : 'Resize blocked: this object cannot be resized safely.');
    if (canCreateImageReplacementPatchForObject(selected)) {
      replacementImageInput.disabled = false;
      imageReplacementStatus.textContent = 'Choose a local image file.';
    } else {
      replacementImageInput.disabled = true;
      replacementImageInput.value = '';
      imageReplacementStatus.textContent = 'Selected object is not safely image-replaceable.';
    }
  };

  const renderDraftFromSelection = (inventory) => {
    const candidate = selectEditableCandidate(inventory, editableCandidateSelect.value);
    draftState = { selectedCandidateId: editableCandidateSelect.value, draftEdit: createDraftEdit(candidate, editableDraftText.value) };
    editableDraftStatus.textContent = formatDraftEditText(draftState);
    currentPatchPlan = createPatchPlanState(draftState).patchPlan;
    editablePatchPlan.textContent = formatPatchPlanText(currentPatchPlan);
    applyPatchPreview.disabled = !currentPatchPlan || currentPatchPlan.applyStatus !== 'planned';
  };

  resetZipMainHtmlSelectionUi();
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
    const patched = await createCombinedPatchedSafePreviewResult(currentHtmlFile, patchCollection, movePatchCollection, imagePatchCollection);
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
    imagePatchCollection = createImageReplacementPatchCollectionState();
    patchCollectionStatus.textContent = formatPatchCollectionText(patchCollection);
    updateExportUi();
    workingPreviewStatus.textContent = formatWorkingPreviewStateText(resetWorkingPreviewState());
    replacementImageInput.value = '';
    replacementImageInput.disabled = true;
    pendingProjectPayload = null;
    openProjectFile.value = '';
    projectPersistenceStatus.textContent = formatProjectPersistenceStatusText('neutral');
    resetZipMainHtmlSelectionUi();
    imageReplacementStatus.textContent = 'Selected object is not safely image-replaceable.';
    patchApplyStatus.textContent = 'Patch apply status: reset to original preview.';
    const previewResult = await createSafeHtmlPreviewResult(currentHtmlFile);
    if (previewResult) {
      safePreviewFrame.srcdoc = previewResult.previewDocument;
      safePreviewStatus.textContent = formatPreviewStatusText(previewResult.previewStatus);
    }
    if (currentVisualInventory) {
      renderVisualObjectSelection(currentVisualInventory);
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
    imagePatchCollection = createImageReplacementPatchCollectionState();
    resetZipMainHtmlSelectionUi();
    resetDraftUi();
    updateExportUi();
    safePreviewFrame.srcdoc =
      '<!doctype html><html><body><p>Safe preview unavailable for this selection.</p></body></html>';

    if (selected && project && project.sourceKind === 'html') {
      resetZipMainHtmlSelectionUi();
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
      if (pendingProjectPayload && pendingProjectPayload.sourceFile) {
        const actualFingerprint = createSourceFileFingerprint(selected);
        const match = validateSourceFileFingerprint(pendingProjectPayload.sourceFile, actualFingerprint);
        if (!match.ok) {
          projectPersistenceStatus.textContent = formatProjectPersistenceStatusText('mismatch');
          patchCollection = createPatchCollectionState();
          movePatchCollection = createVisualMovePatchCollectionState();
          imagePatchCollection = createImageReplacementPatchCollectionState();
          updateExportUi();
          return;
        }
        patchCollection = pendingProjectPayload.patches.textPatchCollection;
        movePatchCollection = pendingProjectPayload.patches.visualMoveCollection;
        imagePatchCollection = pendingProjectPayload.patches.imagePatchCollection;
        patchCollectionStatus.textContent = formatPatchCollectionText(patchCollection);
        const patched = await createCombinedPatchedSafePreviewResult(currentHtmlFile, patchCollection, movePatchCollection, imagePatchCollection);
        if (patched && patched.previewResult && patched.previewResult.previewDocument) {
          safePreviewFrame.srcdoc = patched.previewResult.previewDocument;
          safePreviewStatus.textContent = formatPreviewStatusText(patched.previewResult.previewStatus);
        }
        projectPersistenceStatus.textContent = formatProjectPersistenceStatusText('loaded');
      }
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
      const zipManifest = status && status.checks ? status.checks.zipManifest : null;
      zipMainHtmlSelect.replaceChildren();
      if (zipManifest && Array.isArray(zipManifest.htmlEntries) && zipManifest.htmlEntries.length > 0) {
        for (const entry of zipManifest.htmlEntries) {
          const option = document.createElement('option');
          option.value = entry.normalizedPath;
          option.textContent = entry.normalizedPath;
          zipMainHtmlSelect.appendChild(option);
        }
        const zipSelectionUiState = createZipMainHtmlSelectionUiState(zipManifest);
        zipMainHtmlSelect.disabled = zipSelectionUiState.disabled;
        if (zipSelectionUiState.selectedPath) {
          zipMainHtmlSelect.value = zipSelectionUiState.selectedPath;
        }
        zipMainHtmlStatus.textContent = zipSelectionUiState.statusText;
      } else {
        const zipSelectionUiState = createZipMainHtmlSelectionUiState(zipManifest);
        zipMainHtmlSelect.disabled = zipSelectionUiState.disabled;
        zipMainHtmlStatus.textContent = zipSelectionUiState.statusText;
      }
      safePreviewStatus.textContent = formatPreviewStatusText(createUnavailablePreviewStatus('zip', project.name));
    }

    if (selected && project && project.sourceKind === 'unknown') {
      resetZipMainHtmlSelectionUi();
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

  replacementImageInput.addEventListener('change', async () => {
    if (!currentVisualInventory) return;
    const file = replacementImageInput.files && replacementImageInput.files[0];
    if (!file) return;
    const selectionState = createVisualObjectSelectionState(currentVisualInventory, visualObjectSelect.value);
    const selected = selectionState.selectedObject;
    if (!canCreateImageReplacementPatchForObject(selected)) {
      replacementImageInput.disabled = true;
      replacementImageInput.value = '';
      imageReplacementStatus.textContent = 'Selected object is not safely image-replaceable.';
      return;
    }
    const asset = await createReplacementImageAssetFromFile(file);
    if (asset.status !== 'ready') {
      imageReplacementStatus.textContent = 'Selected object is not safely image-replaceable.';
      return;
    }
    const patch = createImageReplacementPatchPlan(selected, asset);
    if (patch.applyStatus !== 'planned') {
      imageReplacementStatus.textContent = 'Selected object is not safely image-replaceable.';
      return;
    }
    const previousImagePatchCollection = imagePatchCollection;
    imagePatchCollection = addOrUpdateImageReplacementPatch(imagePatchCollection, patch).collection;
    if (currentHtmlFile) {
      const patched = await createCombinedPatchedSafePreviewResult(currentHtmlFile, patchCollection, movePatchCollection, imagePatchCollection);
      if (!patched || !patched.previewResult || !patched.previewResult.previewDocument) {
        imagePatchCollection = previousImagePatchCollection;
        updateExportUi();
        renderVisualObjectSelection(currentVisualInventory);
        const warnings = patched && patched.applyState && Array.isArray(patched.applyState.warnings) ? patched.applyState.warnings : [];
        if (warnings.includes('missing-src-attribute') || warnings.includes('empty-src-attribute')) {
          imageReplacementStatus.textContent = 'Selected image does not have a safely replaceable source.';
          return;
        }
        imageReplacementStatus.textContent = 'Image replacement could not be applied safely.';
        return;
      }
      safePreviewFrame.srcdoc = patched.previewResult.previewDocument;
      safePreviewStatus.textContent = formatPreviewStatusText(patched.previewResult.previewStatus);
      imageReplacementStatus.textContent = 'Image replacement applied to preview.';
    }
    updateExportUi();
  });

  exportEditedHtml.addEventListener('click', async () => {
    if (!currentHtmlFile) return;
    const exportResult = await createEditedHtmlExport(currentHtmlFile, patchCollection, movePatchCollection, currentExportSafetySummary, imagePatchCollection);
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

  saveProjectFile.addEventListener('click', () => {
    if (!currentHtmlFile) return;
    const payload = createProjectSavePayload(
      createSourceFileFingerprint(currentHtmlFile),
      patchCollection,
      movePatchCollection,
      imagePatchCollection
    );
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = createProjectFileName(currentHtmlFile.name);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    projectPersistenceStatus.textContent = formatProjectPersistenceStatusText('saved');
  });

  openProjectFile.addEventListener('change', async () => {
    const file = openProjectFile.files && openProjectFile.files[0];
    if (!file) return;
    const projectText = await createProjectPayloadFromFile(file);
    const parsed = parseProjectSavePayload(projectText);
    if (!parsed.ok || !parsed.payload) {
      projectPersistenceStatus.textContent = formatProjectPersistenceStatusText('blocked', parsed.reason);
      pendingProjectPayload = null;
      return;
    }
    pendingProjectPayload = parsed.payload;
    projectPersistenceStatus.textContent = formatProjectPersistenceStatusText('loaded');
  });

  const applyNudge = async (dx, dy) => {
    const state = createVisualObjectSelectionState(currentVisualInventory, visualObjectSelect.value);
    const moveStatus = document.querySelector('#visual-move-status');
    if (!state.selectedObject) {
      if (moveStatus) moveStatus.textContent = 'Movement blocked: this object cannot be moved safely.';
      return;
    }
    const existing = movePatchCollection.movePatchesByObjectId[state.selectedObject.objectId];
    const patch = createVisualMovePatchPlan(state.selectedObject, dx, dy, existing);
    if (!patch || patch.applyStatus !== 'planned') {
      if (moveStatus) moveStatus.textContent = 'Movement blocked: this object cannot be moved safely.';
      return;
    }
    movePatchCollection = addOrUpdateVisualMovePatch(movePatchCollection, patch).collection;
    if (moveStatus) moveStatus.textContent = 'Moved selected object.';
    updateExportUi();
    if (currentHtmlFile) {
      const patched = await createCombinedPatchedSafePreviewResult(currentHtmlFile, patchCollection, movePatchCollection, imagePatchCollection);
      if (patched && patched.previewResult && patched.previewResult.previewDocument) {
        safePreviewFrame.srcdoc = patched.previewResult.previewDocument;
        safePreviewStatus.textContent = formatPreviewStatusText(patched.previewResult.previewStatus);
      }
    }
    renderVisualOverlay(currentVisualInventory, state.selectedObject.objectId);
  };
  if (nudgeLeft != null) nudgeLeft.addEventListener('click', () => { void applyNudge(-10, 0); });
  if (nudgeRight != null) nudgeRight.addEventListener('click', () => { void applyNudge(10, 0); });
  if (nudgeUp != null) nudgeUp.addEventListener('click', () => { void applyNudge(0, -10); });
  if (nudgeDown != null) nudgeDown.addEventListener('click', () => { void applyNudge(0, 10); });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') handleDragCancel();
    if (event.key === 'Escape') handleResizeCancel();
  });

}

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
  createEditableInventoryForHtmlFile
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
  selectEditableCandidate
} from './editable-model.mjs';

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
const safePreviewFrame = hasDom ? document.querySelector('#safe-preview-frame') : null;
const safePreviewFrameWrap = hasDom ? document.querySelector('#safe-preview-frame-wrap') : null;
const safePreviewStatus = hasDom ? document.querySelector('#safe-preview-status') : null;
const editableCandidateSelect = hasDom ? document.querySelector('#editable-candidate-select') : null;
const editableDraftText = hasDom ? document.querySelector('#editable-draft-text') : null;
const editableDraftStatus = hasDom ? document.querySelector('#editable-draft-status') : null;
const editablePatchPlan = hasDom ? document.querySelector('#editable-patch-plan') : null;
const previewFitWidth = hasDom ? document.querySelector('#preview-fit-width') : null;
const previewCompactHeight = hasDom ? document.querySelector('#preview-compact-height') : null;
const previewTallHeight = hasDom ? document.querySelector('#preview-tall-height') : null;
const previewResetLayout = hasDom ? document.querySelector('#preview-reset-layout') : null;

if (
  hasDom &&
  fileInput instanceof HTMLInputElement &&
  fileStatus instanceof HTMLElement &&
  fileDetails instanceof HTMLElement &&
  fileWarning instanceof HTMLElement &&
  fileScan instanceof HTMLElement &&
  importReport instanceof HTMLElement &&
  importManifest instanceof HTMLElement &&
  editableInventory instanceof HTMLElement &&
  safePreviewFrame instanceof HTMLIFrameElement &&
  safePreviewFrameWrap instanceof HTMLElement &&
  safePreviewStatus instanceof HTMLElement &&
  editableCandidateSelect instanceof HTMLSelectElement &&
  editableDraftText instanceof HTMLTextAreaElement &&
  editableDraftStatus instanceof HTMLElement &&
  editablePatchPlan instanceof HTMLElement &&
  previewFitWidth instanceof HTMLButtonElement &&
  previewCompactHeight instanceof HTMLButtonElement &&
  previewTallHeight instanceof HTMLButtonElement &&
  previewResetLayout instanceof HTMLButtonElement
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

  const resetDraftUi = () => {
    editableCandidateSelect.replaceChildren();
    editableCandidateSelect.disabled = true;
    editableDraftText.value = '';
    editableDraftText.disabled = true;
    editableDraftStatus.textContent = 'Draft edit: unavailable.';
    editablePatchPlan.textContent = 'Patch plan: unavailable.';
    draftState = null;
  };

  const renderDraftFromSelection = (inventory) => {
    const candidate = selectEditableCandidate(inventory, editableCandidateSelect.value);
    draftState = { selectedCandidateId: editableCandidateSelect.value, draftEdit: createDraftEdit(candidate, editableDraftText.value) };
    editableDraftStatus.textContent = formatDraftEditText(draftState);
    editablePatchPlan.textContent = formatPatchPlanText(createPatchPlanState(draftState).patchPlan);
  };

  resetDraftUi();

  editableCandidateSelect.addEventListener('change', () => {
    renderDraftFromSelection(currentInventory);
  });

  editableDraftText.addEventListener('input', () => {
    renderDraftFromSelection(currentInventory);
  });

  /** @type {any} */
  let currentInventory = null;


  fileInput.addEventListener('change', async () => {
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
    editableInventory.textContent = 'Editable text candidates: unavailable.';
    currentInventory = null;
    resetDraftUi();
    safePreviewFrame.srcdoc =
      '<!doctype html><html><body><p>Safe preview unavailable for this selection.</p></body></html>';

    if (selected && project && project.sourceKind === 'html') {
      const scanResult = await importHtmlFileScan(selected);
      const status = createImportStatusFromHtmlScan(scanResult);
      const report = createImportReportFromStatus(status);
      fileScan.textContent = formatImportStatusSummary(status);
      importReport.textContent = formatImportReportText(report);
      importManifest.textContent = formatImportManifestText(createImportManifestFromStatus(status, report));
      const inventory = await createEditableInventoryForHtmlFile(selected);
      currentInventory = inventory;
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
      if (draftState.selectedCandidateId) {
        editableCandidateSelect.value = draftState.selectedCandidateId;
      }
      renderDraftFromSelection(inventory);
      const previewResult = await createSafeHtmlPreviewResult(selected);
      safePreviewFrame.srcdoc = previewResult ? previewResult.previewDocument : safePreviewFrame.srcdoc;
      safePreviewStatus.textContent = previewResult
        ? formatPreviewStatusText(previewResult.previewStatus)
        : 'Safe static preview: unavailable.';
    }

    if (selected && project && project.sourceKind === 'zip') {
      const scanResult = await importZipFilePreflight(selected);
      const status = createImportStatusFromZipPreflight(scanResult);
      const report = createImportReportFromStatus(status);
      fileScan.textContent = formatImportStatusSummary(status);
      importReport.textContent = formatImportReportText(report);
      importManifest.textContent = formatImportManifestText(createImportManifestFromStatus(status, report));
      editableInventory.textContent = 'Editable text candidates: unavailable for ZIP selection.';
      safePreviewStatus.textContent = formatPreviewStatusText(createUnavailablePreviewStatus('zip', project.name));
    }

    if (selected && project && project.sourceKind === 'unknown') {
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
      editableInventory.textContent = 'Editable text candidates: unavailable for this file type.';
      safePreviewStatus.textContent = formatPreviewStatusText(
        createUnavailablePreviewStatus('unknown', project.name)
      );
    }
  });
}

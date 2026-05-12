import {
  createImportStatusFromHtmlScan,
  createImportStatusFromZipPreflight,
  formatImportStatusSummary,
  formatImportReportText,
  importHtmlFileScan,
  importZipFilePreflight,
  createImportReportFromStatus
} from './importer.mjs';

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

const hasDom = typeof document !== 'undefined';
const fileInput = hasDom ? document.querySelector('#file-input') : null;
const fileStatus = hasDom ? document.querySelector('#file-status') : null;
const fileDetails = hasDom ? document.querySelector('#file-details') : null;
const fileWarning = hasDom ? document.querySelector('#file-warning') : null;
const fileScan = hasDom ? document.querySelector('#file-scan') : null;
const importReport = hasDom ? document.querySelector('#import-report') : null;

if (
  hasDom &&
  fileInput instanceof HTMLInputElement &&
  fileStatus instanceof HTMLElement &&
  fileDetails instanceof HTMLElement &&
  fileWarning instanceof HTMLElement &&
  fileScan instanceof HTMLElement &&
  importReport instanceof HTMLElement
) {
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

    if (selected && project && project.sourceKind === 'html') {
      const scanResult = await importHtmlFileScan(selected);
      const status = createImportStatusFromHtmlScan(scanResult);
      fileScan.textContent = formatImportStatusSummary(status);
      importReport.textContent = formatImportReportText(createImportReportFromStatus(status));
    }

    if (selected && project && project.sourceKind === 'zip') {
      const scanResult = await importZipFilePreflight(selected);
      const status = createImportStatusFromZipPreflight(scanResult);
      fileScan.textContent = formatImportStatusSummary(status);
      importReport.textContent = formatImportReportText(createImportReportFromStatus(status));
    }
  });
}

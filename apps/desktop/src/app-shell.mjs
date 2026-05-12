/** @typedef {{name: string, size: number, type: string}} OpenedFile */

/** @param {OpenedFile | null} file */
export function renderShellState(file) {
  return {
    safePreviewPlaceholder: true,
    selectionLabel: file
      ? `Selected file: ${file.name} (${file.size} bytes, ${file.type || 'unknown type'})`
      : 'No file selected.'
  };
}

const hasDom = typeof document !== 'undefined';
const fileInput = hasDom ? document.querySelector('#file-input') : null;
const fileMeta = hasDom ? document.querySelector('#file-meta') : null;

if (hasDom && fileInput instanceof HTMLInputElement && fileMeta instanceof HTMLElement) {
  fileInput.addEventListener('change', () => {
    const selected = fileInput.files && fileInput.files.length > 0 ? fileInput.files[0] : null;
    const shellState = renderShellState(
      selected
        ? {
            name: selected.name,
            size: selected.size,
            type: selected.type
          }
        : null
    );
    fileMeta.textContent = shellState.selectionLabel;
  });
}

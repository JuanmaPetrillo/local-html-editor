/** @typedef {{name: string, size: number}} OpenedFile */

/** @param {OpenedFile | null} file */
export function renderShellState(file) {
  return {
    safePreviewPlaceholder: true,
    selectionLabel: file
      ? `Selected file: ${file.name} (${file.size} bytes)`
      : 'No file selected.'
  };
}

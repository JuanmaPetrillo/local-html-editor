const SCHEMA_VERSION = 1;
const SAFE_IMAGE_PREFIXES = ['data:image/png;base64,', 'data:image/jpeg;base64,', 'data:image/jpg;base64,', 'data:image/gif;base64,', 'data:image/webp;base64,', 'data:image/avif;base64,'];

export function createSourceFileFingerprint(file) {
  return { name: file.name, size: file.size, lastModified: Number.isFinite(file.lastModified) ? file.lastModified : null };
}

export function validateSourceFileFingerprint(expected, actual) {
  if (!expected || !actual) return { ok: false, reason: 'missing-fingerprint' };
  if (expected.name !== actual.name) return { ok: false, reason: 'name-mismatch' };
  if (expected.size !== actual.size) return { ok: false, reason: 'size-mismatch' };
  if (expected.lastModified != null && actual.lastModified != null && expected.lastModified !== actual.lastModified) return { ok: false, reason: 'last-modified-mismatch' };
  return { ok: true, reason: 'match' };
}

export function createProjectFileName(sourceFileName) {
  const base = (sourceFileName || 'project').replace(/[^a-z0-9._-]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `${base || 'project'}.lheproj.json`;
}

function hasSafeImageDataUrl(url) {
  return typeof url === 'string' && SAFE_IMAGE_PREFIXES.some((prefix) => url.startsWith(prefix));
}

export function createProjectSavePayload(sourceFileFingerprint, textPatchCollection, visualMoveCollection, imagePatchCollection) {
  const hasImageData = Array.isArray(imagePatchCollection?.orderedObjectIds) && imagePatchCollection.orderedObjectIds.length > 0;
  return {
    schemaVersion: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    sourceFile: sourceFileFingerprint,
    patches: { textPatchCollection, visualMoveCollection, imagePatchCollection },
    warnings: hasImageData ? ['Project contains embedded image data.'] : []
  };
}

export function validateProjectSavePayload(payload) {
  if (!payload || typeof payload !== 'object') return { ok: false, reason: 'invalid-payload' };
  if (payload.schemaVersion !== SCHEMA_VERSION) return { ok: false, reason: 'invalid-schema-version' };
  if (!payload.sourceFile || typeof payload.sourceFile.name !== 'string' || !Number.isFinite(payload.sourceFile.size)) return { ok: false, reason: 'invalid-source-file' };
  if (!payload.patches || typeof payload.patches !== 'object') return { ok: false, reason: 'invalid-patches' };
  const forbidden = ['rawHtmlText', 'htmlText', 'rawBytes', 'binary', 'ArrayBuffer', 'Blob', 'workingHtml', 'previewDocument', 'srcdoc'];
  const serialized = JSON.stringify(payload);
  if (forbidden.some((x) => serialized.includes(x))) return { ok: false, reason: 'forbidden-field-present' };
  const imageCollection = payload.patches.imagePatchCollection;
  if (imageCollection && imageCollection.patchesByObjectId) {
    for (const patch of Object.values(imageCollection.patchesByObjectId)) {
      if (!hasSafeImageDataUrl(patch.replacementDataUrl)) return { ok: false, reason: 'unsafe-image-data-url' };
    }
  }
  return { ok: true, reason: 'valid' };
}

export function parseProjectSavePayload(projectText) {
  let parsed = null;
  try {
    parsed = JSON.parse(projectText);
  } catch {
    return { ok: false, reason: 'invalid-json', payload: null };
  }
  const validation = validateProjectSavePayload(parsed);
  if (!validation.ok) return { ok: false, reason: validation.reason, payload: null };
  return { ok: true, reason: 'valid', payload: parsed };
}

export function formatProjectPersistenceStatusText(status, detail = '') {
  if (status === 'saved') return 'Project saved locally.';
  if (status === 'loaded') return 'Project loaded. Select the original HTML file to continue.';
  if (status === 'mismatch') return 'Source file mismatch detected.';
  if (status === 'blocked') return `Project load blocked: ${detail || 'invalid project file'}.`;
  return 'Project persistence: ready. Project files may contain embedded replacement images and sensitive edit data.';
}

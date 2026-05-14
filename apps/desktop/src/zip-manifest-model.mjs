function hasControlChars(value) {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code === 0 || code < 32 || code === 127) return true;
  }
  return false;
}

export function normalizeZipEntryPath(entryName) {
  const raw = String(entryName || '');
  if (!raw) return { ok: false, reason: 'empty-path', normalizedPath: '' };
  if (hasControlChars(raw)) return { ok: false, reason: 'control-char', normalizedPath: '' };
  if (/^[a-zA-Z]:[\\/]/.test(raw)) return { ok: false, reason: 'windows-drive-path', normalizedPath: '' };
  if (raw.startsWith('/')) return { ok: false, reason: 'absolute-path', normalizedPath: '' };

  const slashPath = raw.replace(/\\/g, '/');
  const parts = slashPath.split('/');
  const normalized = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') return { ok: false, reason: 'path-traversal', normalizedPath: '' };
    normalized.push(part);
  }
  if (normalized.length === 0) return { ok: false, reason: 'empty-path', normalizedPath: '' };
  return { ok: true, reason: '', normalizedPath: normalized.join('/') };
}

export function createZipEntrySafetyManifest(entryNames) {
  const safeEntries = [];
  const blockedEntries = [];
  const htmlEntries = [];
  const seen = new Set();
  for (const entryName of Array.isArray(entryNames) ? entryNames : []) {
    const normalized = normalizeZipEntryPath(entryName);
    if (!normalized.ok) {
      blockedEntries.push({ entryName: String(entryName || ''), reason: normalized.reason });
      continue;
    }
    if (seen.has(normalized.normalizedPath)) {
      blockedEntries.push({ entryName: String(entryName || ''), reason: 'duplicate-normalized-path' });
      continue;
    }
    seen.add(normalized.normalizedPath);
    const entry = { entryName: String(entryName || ''), normalizedPath: normalized.normalizedPath };
    safeEntries.push(entry);
    if (/\.(html?)$/i.test(normalized.normalizedPath)) htmlEntries.push(entry);
  }
  const autoSelectedMainHtmlPath = htmlEntries.length === 1 ? htmlEntries[0].normalizedPath : '';
  return {
    safeEntries,
    blockedEntries,
    htmlEntries,
    autoSelectedMainHtmlPath,
    selectionRequired: htmlEntries.length > 1,
    hasHtml: htmlEntries.length > 0
  };
}

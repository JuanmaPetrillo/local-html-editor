/** @typedef {'html' | 'htm'} HtmlExtension */

/** @param {string} fileName */
export function detectHtmlExtension(fileName) {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
    return null;
  }

  const extension = fileName.slice(dotIndex + 1).toLowerCase();
  if (extension === 'html' || extension === 'htm') {
    return extension;
  }

  return null;
}

/** @param {string} fileName */
export function detectZipExtension(fileName) {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
    return null;
  }

  const extension = fileName.slice(dotIndex + 1).toLowerCase();
  return extension === 'zip' ? extension : null;
}

/** @param {string} htmlText */
export function scanHtmlRiskMarkers(htmlText) {
  const scriptTagCount = (htmlText.match(/<\s*script\b/gi) || []).length;
  const inlineEventHandlerCount = (htmlText.match(/\son[a-z0-9_-]+\s*=/gi) || []).length;
  const remoteUrlCount = (htmlText.match(/https?:\/\//gi) || []).length;
  const embeddedContentTagCount = (htmlText.match(/<\s*(iframe|object|embed)\b/gi) || []).length;

  return {
    scriptTagCount,
    inlineEventHandlerCount,
    remoteUrlCount,
    embeddedContentTagCount,
    hasRiskMarkers:
      scriptTagCount > 0 ||
      inlineEventHandlerCount > 0 ||
      remoteUrlCount > 0 ||
      embeddedContentTagCount > 0
  };
}

/** @param {Uint8Array} bytes */
export function hasZipSignature(bytes) {
  if (bytes.length < 4) {
    return null;
  }

  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    return null;
  }

  if (bytes[2] === 0x03 && bytes[3] === 0x04) return 'valid-pk0304';
  if (bytes[2] === 0x05 && bytes[3] === 0x06) return 'valid-pk0506';
  if (bytes[2] === 0x07 && bytes[3] === 0x08) return 'valid-pk0708';

  return null;
}

/** @param {{name: string, size: number, type: string, text: () => Promise<string>}} file */
export async function importHtmlFileScan(file) {
  const extension = detectHtmlExtension(file.name);

  if (!extension) {
    return {
      ok: false,
      reason: 'unsupported-extension',
      fileName: file.name,
      extension: null,
      size: file.size,
      type: file.type || 'unknown type',
      scan: null
    };
  }

  const htmlText = await file.text();
  const scan = scanHtmlRiskMarkers(htmlText);

  return {
    ok: true,
    reason: null,
    fileName: file.name,
    extension,
    size: file.size,
    type: file.type || 'unknown type',
    scan
  };
}

/**
 * @param {{name: string, size: number, type: string, slice: (start?: number, end?: number) => {arrayBuffer: () => Promise<ArrayBuffer>}}} file
 */
export async function importZipFilePreflight(file) {
  const extension = detectZipExtension(file.name);

  if (!extension) {
    return {
      ok: false,
      reason: 'unsupported-extension',
      fileName: file.name,
      fileSize: file.size,
      type: file.type || 'unknown type',
      extension: null,
      sourceKind: 'unknown',
      signatureStatus: 'skipped',
      warningLabels: ['unsupported-extension']
    };
  }

  const headerBuffer = await file.slice(0, 4).arrayBuffer();
  const signatureStatus = hasZipSignature(new Uint8Array(headerBuffer)) || 'invalid-or-unsupported';
  const signatureOk = signatureStatus !== 'invalid-or-unsupported';

  return {
    ok: signatureOk,
    reason: signatureOk ? null : 'invalid-zip-signature',
    fileName: file.name,
    fileSize: file.size,
    type: file.type || 'unknown type',
    extension,
    sourceKind: 'zip',
    signatureStatus,
    warningLabels: signatureOk ? [] : ['invalid-zip-signature']
  };
}

/** @param {Awaited<ReturnType<typeof importHtmlFileScan>>} scanResult */
export function createImportStatusFromHtmlScan(scanResult) {
  const warningLabels = [];
  if (scanResult.ok && scanResult.scan.hasRiskMarkers) {
    warningLabels.push('risk-markers-detected');
  }

  return {
    sourceKind: scanResult.ok ? 'html' : 'unknown',
    fileName: scanResult.fileName,
    fileSize: scanResult.size,
    type: scanResult.type,
    extension: scanResult.extension,
    ok: scanResult.ok,
    severity: scanResult.ok ? (warningLabels.length ? 'warning' : 'info') : 'error',
    statusLabel: scanResult.ok ? 'HTML intake scan complete.' : 'HTML intake scan skipped.',
    summaryLabel: scanResult.ok
      ? `HTML scan: scripts=${scanResult.scan.scriptTagCount}, inline-handlers=${scanResult.scan.inlineEventHandlerCount}, remote-urls=${scanResult.scan.remoteUrlCount}, embedded-tags=${scanResult.scan.embeddedContentTagCount}.`
      : 'HTML scan skipped: unsupported extension.',
    warningLabels,
    checks: scanResult.ok ? scanResult.scan : null
  };
}

/** @param {Awaited<ReturnType<typeof importZipFilePreflight>>} preflightResult */
export function createImportStatusFromZipPreflight(preflightResult) {
  return {
    sourceKind: preflightResult.sourceKind,
    fileName: preflightResult.fileName,
    fileSize: preflightResult.fileSize,
    type: preflightResult.type,
    extension: preflightResult.extension,
    ok: preflightResult.ok,
    severity: preflightResult.ok ? 'info' : 'error',
    statusLabel: preflightResult.ok ? 'ZIP preflight complete.' : 'ZIP preflight failed.',
    summaryLabel: `ZIP preflight: signature=${preflightResult.signatureStatus}, warnings=${preflightResult.warningLabels.length ? preflightResult.warningLabels.join('|') : 'none'}.`,
    warningLabels: preflightResult.warningLabels,
    checks: {
      signatureStatus: preflightResult.signatureStatus
    }
  };
}

/** @param {{summaryLabel: string, fileName: string, fileSize: number, type: string, extension: string | null, sourceKind: string, severity: string, warningLabels: string[]}} status */
export function formatImportStatusSummary(status) {
  return `Scan summary: ${status.summaryLabel} file=${status.fileName}, size=${status.fileSize} bytes, type=${status.type}, extension=.${status.extension || '(none)'}, source=${status.sourceKind}, severity=${status.severity}, warnings=${status.warningLabels.length ? status.warningLabels.join('|') : 'none'}.`;
}

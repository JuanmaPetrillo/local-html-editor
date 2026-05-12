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

/** @param {string} rawReference */
export function classifyReference(rawReference) {
  const value = String(rawReference || '').trim();
  if (!value) return 'unknown';
  if (value.startsWith('#')) return 'anchor';
  if (/^data:/i.test(value)) return 'data-uri';
  if (/^https?:\/\//i.test(value) || /^\/\//.test(value)) return 'remote';
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return 'unknown';
  return 'local-relative';
}

/** @param {string} htmlText */
export function scanHtmlReferences(htmlText) {
  const extracted = [];
  const attributePattern =
    /<(img|script|link|video|audio|source)\b[^>]*?\s(src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/gi;
  let attributeMatch = attributePattern.exec(htmlText);
  while (attributeMatch) {
    extracted.push(attributeMatch[3] || attributeMatch[4] || attributeMatch[5] || '');
    attributeMatch = attributePattern.exec(htmlText);
  }

  const cssUrlPattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'" \t\r\n]+))\s*\)/gi;
  let cssMatch = cssUrlPattern.exec(htmlText);
  while (cssMatch) {
    extracted.push(cssMatch[1] || cssMatch[2] || cssMatch[3] || '');
    cssMatch = cssUrlPattern.exec(htmlText);
  }

  const summary = createReferenceSummary(extracted);
  return {
    totalCount: extracted.length,
    byType: summary
  };
}

/** @param {string[]} references */
export function createReferenceSummary(references) {
  const summary = {
    'local-relative': 0,
    remote: 0,
    'data-uri': 0,
    anchor: 0,
    unknown: 0
  };

  for (const reference of references) {
    const kind = classifyReference(reference);
    summary[kind] += 1;
  }

  return summary;
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
  const referenceScan = scanHtmlReferences(htmlText);

  return {
    ok: true,
    reason: null,
    fileName: file.name,
    extension,
    size: file.size,
    type: file.type || 'unknown type',
    scan,
    referenceScan
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
    if (scanResult.scan.scriptTagCount > 0) warningLabels.push('script-tags-detected');
    if (scanResult.scan.inlineEventHandlerCount > 0) warningLabels.push('inline-handlers-detected');
    if (scanResult.scan.remoteUrlCount > 0) warningLabels.push('remote-urls-detected');
    if (scanResult.scan.embeddedContentTagCount > 0) warningLabels.push('embedded-content-detected');
  }
  if (scanResult.ok && scanResult.referenceScan.byType.remote > 0) {
    warningLabels.push('remote-references-detected');
  }
  if (scanResult.ok && scanResult.referenceScan.byType['local-relative'] > 0) {
    warningLabels.push('local-assets-detected');
  }
  if (scanResult.ok && scanResult.referenceScan.byType['data-uri'] > 0) {
    warningLabels.push('data-uris-detected');
  }

  if (!scanResult.ok) {
    warningLabels.push('unsupported-extension');
  }
  const computedSeverity = getHighestSeverityForWarningLabels(warningLabels);

  return {
    sourceKind: scanResult.ok ? 'html' : 'unknown',
    fileName: scanResult.fileName,
    fileSize: scanResult.size,
    type: scanResult.type,
    extension: scanResult.extension,
    ok: scanResult.ok,
    severity: scanResult.ok ? computedSeverity : 'error',
    statusLabel: scanResult.ok ? 'HTML intake scan complete.' : 'HTML intake scan skipped.',
    summaryLabel: scanResult.ok
      ? `HTML scan: scripts=${scanResult.scan.scriptTagCount}, inline-handlers=${scanResult.scan.inlineEventHandlerCount}, remote-urls=${scanResult.scan.remoteUrlCount}, embedded-tags=${scanResult.scan.embeddedContentTagCount}, refs-total=${scanResult.referenceScan.totalCount}, refs-local=${scanResult.referenceScan.byType['local-relative']}, refs-remote=${scanResult.referenceScan.byType.remote}, refs-data=${scanResult.referenceScan.byType['data-uri']}, refs-anchor=${scanResult.referenceScan.byType.anchor}, refs-unknown=${scanResult.referenceScan.byType.unknown}.`
      : 'HTML scan skipped: unsupported extension.',
    warningLabels,
    checks: scanResult.ok
      ? {
          ...scanResult.scan,
          referenceSummary: scanResult.referenceScan
        }
      : null
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

export function createImportWarning(code) {
  const taxonomy = {
    'risk-markers-detected': {
      severity: 'warning',
      title: 'Risk markers detected',
      message: 'Potentially risky content markers were found during local scan.',
      recommendedAction: 'Review the warnings below before continuing.'
    },
    'script-tags-detected': {
      severity: 'warning',
      title: 'Scripts detected',
      message: 'Script tags were detected in this file.',
      recommendedAction: 'Keep scripts disabled and continue in safe mode.'
    },
    'inline-handlers-detected': {
      severity: 'warning',
      title: 'Inline handlers detected',
      message: 'Inline event handlers like onclick were detected.',
      recommendedAction: 'Inspect interactive elements before trusting behavior.'
    },
    'remote-urls-detected': {
      severity: 'warning',
      title: 'Remote links detected',
      message: 'External web URLs were detected in the file.',
      recommendedAction: 'Replace external links with local assets where possible.'
    },
    'embedded-content-detected': {
      severity: 'warning',
      title: 'Embedded content detected',
      message: 'Embedded content tags (iframe/object/embed) were detected.',
      recommendedAction: 'Treat embedded content as untrusted and keep safe mode on.'
    },
    'remote-references-detected': {
      severity: 'warning',
      title: 'Remote references detected',
      message: 'References to external web locations were detected.',
      recommendedAction: 'Replace remote references with local assets for offline privacy.'
    },
    'local-assets-detected': {
      severity: 'info',
      title: 'Local asset references detected',
      message: 'Local relative asset references were detected.',
      recommendedAction: 'Keep referenced local files together with this presentation.'
    },
    'data-uris-detected': {
      severity: 'info',
      title: 'Data URIs detected',
      message: 'Inline data URI references were detected.',
      recommendedAction: 'Review inline assets to confirm they are expected.'
    },
    'invalid-zip-signature': {
      severity: 'error',
      title: 'ZIP signature could not be validated',
      message: 'The selected .zip file did not match expected ZIP signatures.',
      recommendedAction: 'Choose a valid local ZIP file and try again.'
    },
    'unsupported-extension': {
      severity: 'error',
      title: 'Unsupported file type',
      message: 'This file extension is not supported in the current import milestone.',
      recommendedAction: 'Select a .html, .htm, or .zip file.'
    }
  };

  const mapped = taxonomy[code];
  if (!mapped) return null;
  return { code, ...mapped };
}

/** @param {string[]} warningLabels */
export function mapWarningLabelsToWarnings(warningLabels) {
  return warningLabels.map((label) => createImportWarning(label)).filter(Boolean);
}

/** @param {string[]} warningLabels */
export function getHighestSeverityForWarningLabels(warningLabels) {
  const priority = { info: 1, warning: 2, error: 3 };
  let highest = 'info';

  for (const warning of mapWarningLabelsToWarnings(warningLabels)) {
    if (priority[warning.severity] > priority[highest]) {
      highest = warning.severity;
    }
  }

  return highest;
}

/** @param {{fileName:string, sourceKind:string, severity:string, warningLabels:string[]}} status */
export function createImportReportFromStatus(status) {
  const warnings = mapWarningLabelsToWarnings(status.warningLabels);
  const overallSeverity = status.severity;

  const safeToContinueLabel =
    overallSeverity === 'error'
      ? 'Not safe to continue until this file issue is fixed.'
      : overallSeverity === 'warning'
        ? 'Safe to continue in local safe mode with caution.'
        : 'Safe to continue. No obvious issues detected.';

  return {
    fileName: status.fileName,
    sourceKind: status.sourceKind,
    overallSeverity,
    headline:
      overallSeverity === 'error'
        ? 'Import needs attention'
        : overallSeverity === 'warning'
          ? 'Import completed with warnings'
          : 'Import completed',
    summary: 'This file was inspected locally only.',
    warnings,
    safeToContinueLabel
  };
}

/** @param {{fileName:string, sourceKind:string, overallSeverity:string, headline:string, summary:string, safeToContinueLabel:string, warnings:Array<{severity:string,title:string,message:string,recommendedAction:string}>}} report */
export function formatImportReportText(report) {
  const warningText = report.warnings.length
    ? report.warnings
        .map(
          (warning, index) =>
            `${index + 1}. [${warning.severity}] ${warning.title}: ${warning.message} Recommended action: ${warning.recommendedAction}`
        )
        .join('\n')
    : 'None.';

  return [
    `Import report for ${report.fileName}`,
    `Source: ${report.sourceKind}`,
    `Severity: ${report.overallSeverity}`,
    `Headline: ${report.headline}`,
    `Summary: ${report.summary}`,
    `Safe to continue: ${report.safeToContinueLabel}`,
    'Warnings:',
    warningText
  ].join('\n');
}

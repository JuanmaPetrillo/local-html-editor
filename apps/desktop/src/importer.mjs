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

/**
 * @param {{name: string, size: number, type: string, text: () => Promise<string>}} file
 */
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

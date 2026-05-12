const PREVIEW_CSP =
  "default-src 'none'; script-src 'none'; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; img-src data: blob:; style-src 'unsafe-inline'";

/** @param {string} htmlText */
export function stripScripts(htmlText) {
  return htmlText.replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
}

/** @param {string} htmlText */
export function stripInlineEventHandlers(htmlText) {
  return htmlText.replace(/\son[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

/** @param {string} htmlText */
export function neutralizeDangerousUrls(htmlText) {
  return htmlText
    .replace(
      /\s(href|src)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|\s*javascript:[^\s>]+)/gi,
      ' $1="#"'
    )
    .replace(
      /\s(href|src)\s*=\s*(?:"\s*(https?:)?\/\/[^"]*"|'\s*(https?:)?\/\/[^']*'|\s*(https?:)?\/\/[^\s>]+)/gi,
      ' $1="#"'
    );
}

/** @param {string} htmlText */
export function neutralizeEmbeddedContent(htmlText) {
  return htmlText
    .replace(/<\s*(iframe|object|embed)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(iframe|object|embed)\b[^>]*\/?\s*>/gi, '');
}

/** @param {string} htmlText */
export function stripMetaRefresh(htmlText) {
  return htmlText.replace(
    /<\s*meta\b[^>]*http-equiv\s*=\s*(?:"refresh"|'refresh'|refresh)[^>]*>/gi,
    ''
  );
}

function countMatches(text, pattern) {
  return (text.match(pattern) || []).length;
}

export function createPreviewStatus(summary) {
  const changed =
    summary.scriptsRemoved > 0 ||
    summary.inlineHandlersRemoved > 0 ||
    summary.dangerousUrlsNeutralized > 0 ||
    summary.embeddedContentRemoved > 0 ||
    summary.metaRefreshRemoved > 0 ||
    summary.remoteReferencesNeutralized > 0;

  return {
    ...summary,
    status: changed ? 'sanitized' : 'ready',
    safeModeLabel: 'Safe static preview',
    message: changed
      ? 'This preview is sanitized and may not look identical to the original.'
      : 'This preview is shown in safe static preview mode.'
  };
}

export function createUnavailablePreviewStatus(sourceKind, fileName) {
  return {
    status: 'unavailable',
    sourceKind,
    fileName,
    scriptsRemoved: 0,
    inlineHandlersRemoved: 0,
    dangerousUrlsNeutralized: 0,
    embeddedContentRemoved: 0,
    metaRefreshRemoved: 0,
    remoteReferencesNeutralized: 0,
    safeModeLabel: 'Safe static preview',
    message: sourceKind === 'zip'
      ? 'Preview unavailable for ZIP in this milestone.'
      : 'Preview unavailable for this file type in this milestone.'
  };
}

export function formatPreviewStatusText(status) {
  return [
    `${status.safeModeLabel}: ${status.status}.`,
    status.message,
    `Source: ${status.sourceKind} (${status.fileName || 'unknown file'}).`,
    `Scripts removed: ${status.scriptsRemoved}`,
    `Inline handlers removed: ${status.inlineHandlersRemoved}`,
    `Dangerous URLs neutralized: ${status.dangerousUrlsNeutralized}`,
    `Remote references neutralized: ${status.remoteReferencesNeutralized}`,
    `Embedded content removed: ${status.embeddedContentRemoved}`,
    `Meta refresh removed: ${status.metaRefreshRemoved}`
  ].join('\n');
}

/** @param {string} htmlText */
export function buildSafePreviewResult(htmlText) {
  const scriptsRemoved = countMatches(htmlText, /<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi);
  const inlineHandlersRemoved = countMatches(htmlText, /\son[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi);
  const dangerousJavascriptUrls = countMatches(
    htmlText,
    /\s(href|src)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|\s*javascript:[^\s>]+)/gi
  );
  const dangerousRemoteUrls = countMatches(
    htmlText,
    /\s(href|src)\s*=\s*(?:"\s*(https?:)?\/\/[^\"]*"|'\s*(https?:)?\/\/[^']*'|\s*(https?:)?\/\/[^\s>]+)/gi
  );
  const embeddedContentRemoved = countMatches(htmlText, /<\s*(iframe|object|embed)\b/gi);
  const metaRefreshRemoved = countMatches(
    htmlText,
    /<\s*meta\b[^>]*http-equiv\s*=\s*(?:"refresh"|'refresh'|refresh)[^>]*>/gi
  );

  const previewDocument = buildSafePreviewDocument(htmlText);
  const previewStatus = createPreviewStatus({
    sourceKind: 'html',
    fileName: '',
    scriptsRemoved,
    inlineHandlersRemoved,
    dangerousUrlsNeutralized: dangerousJavascriptUrls + dangerousRemoteUrls,
    embeddedContentRemoved,
    metaRefreshRemoved,
    remoteReferencesNeutralized: dangerousRemoteUrls
  });

  return { previewDocument, previewStatus };
}

/** @param {string} htmlText */
export function buildSafePreviewDocument(htmlText) {
  const noScripts = stripScripts(htmlText);
  const noHandlers = stripInlineEventHandlers(noScripts);
  const noDangerousUrls = neutralizeDangerousUrls(noHandlers);
  const noEmbedded = neutralizeEmbeddedContent(noDangerousUrls);
  const sanitized = stripMetaRefresh(noEmbedded);
  return `<!doctype html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}"><meta name="referrer" content="no-referrer"><title>Safe Preview</title></head><body>${sanitized}</body></html>`;
}

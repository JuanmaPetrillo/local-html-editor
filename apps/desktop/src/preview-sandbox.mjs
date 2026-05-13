const PREVIEW_CSP =
  "default-src 'none'; script-src 'none'; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; img-src data: blob:; style-src 'unsafe-inline'";

/** @param {string} htmlText */
export function stripScripts(htmlText) {
  const noClosedScripts = htmlText.replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
  return noClosedScripts.replace(/<\s*script\b[^>]*>[\s\S]*$/gi, '');
}

/** @param {string} htmlText */
export function stripInlineEventHandlers(htmlText) {
  return htmlText.replace(/\son[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

/** @param {string} htmlText */
export function neutralizeDangerousUrls(htmlText) {
  return htmlText.replace(
    /\s(href|src)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    (fullMatch, attrName, _rawValueWithQuotes, doubleQuotedValue, singleQuotedValue, unquotedValue) =>
      shouldAllowPreviewUrl(attrName, doubleQuotedValue ?? singleQuotedValue ?? unquotedValue ?? '')
        ? fullMatch
        : ` ${attrName}="#"`
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

function shouldAllowPreviewUrl(attrName, rawValue) {
  const trimmed = rawValue.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('#')) return true;
  if (trimmed.startsWith('//')) return false;
  if (trimmed.startsWith('/')) return true;
  if (trimmed.startsWith('./')) return true;
  if (trimmed.startsWith('../')) return true;
  if (!trimmed.includes(':') && !trimmed.startsWith('//')) return true;
  const normalized = trimmed.toLowerCase();
  if (attrName.toLowerCase() === 'src' && normalized.startsWith('data:image/')) {
    return (
      normalized.startsWith('data:image/png') ||
      normalized.startsWith('data:image/jpeg') ||
      normalized.startsWith('data:image/jpg') ||
      normalized.startsWith('data:image/gif') ||
      normalized.startsWith('data:image/webp') ||
      normalized.startsWith('data:image/avif')
    );
  }
  if (attrName.toLowerCase() === 'src' && normalized.startsWith('blob:')) return true;
  return false;
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
  const scriptsRemoved = countMatches(htmlText, /<\s*script\b/gi);
  const inlineHandlersRemoved = countMatches(htmlText, /\son[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi);
  const dangerousJavascriptUrls = Array.from(
    htmlText.matchAll(/\s(href|src)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi)
  ).filter((match) => !shouldAllowPreviewUrl(match[1], match[3] ?? match[4] ?? match[5] ?? '')).length;
  const dangerousRemoteUrls = countMatches(htmlText, /\s(href|src)\s*=\s*(?:"\s*(https?:)?\/\/[^\"]*"|'\s*(https?:)?\/\/[^']*'|\s*(https?:)?\/\/[^\s>]+)/gi);
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
    dangerousUrlsNeutralized: dangerousJavascriptUrls,
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
  const doctypeMatch = sanitized.match(/^\s*<!doctype[^>]*>/i);
  const doctype = doctypeMatch ? doctypeMatch[0] : '<!doctype html>';
  const withoutDoctype = doctypeMatch ? sanitized.slice(doctypeMatch[0].length) : sanitized;
  const htmlMatch = withoutDoctype.match(/<\s*html\b[^>]*>([\s\S]*?)<\s*\/\s*html\s*>/i);
  const docContent = htmlMatch ? htmlMatch[1] : withoutDoctype;
  const headMatch = docContent.match(/<\s*head\b[^>]*>([\s\S]*?)<\s*\/\s*head\s*>/i);
  const bodyMatch = docContent.match(/<\s*body\b[^>]*>([\s\S]*?)<\s*\/\s*body\s*>/i);
  const headContent = headMatch ? headMatch[1] : '';
  const bodyContent = bodyMatch ? bodyMatch[1] : docContent.replace(/<\s*head\b[^>]*>[\s\S]*?<\s*\/\s*head\s*>/gi, '');
  return `${doctype}<html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}"><meta name="referrer" content="no-referrer"><title>Safe Preview</title>${headContent}</head><body>${bodyContent}</body></html>`;
}

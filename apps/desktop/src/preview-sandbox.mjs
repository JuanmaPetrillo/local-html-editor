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

/** @param {string} htmlText */
export function buildSafePreviewDocument(htmlText) {
  const noScripts = stripScripts(htmlText);
  const noHandlers = stripInlineEventHandlers(noScripts);
  const noDangerousUrls = neutralizeDangerousUrls(noHandlers);
  const noEmbedded = neutralizeEmbeddedContent(noDangerousUrls);
  const sanitized = stripMetaRefresh(noEmbedded);
  return `<!doctype html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}"><meta name="referrer" content="no-referrer"><title>Safe Preview</title></head><body>${sanitized}</body></html>`;
}

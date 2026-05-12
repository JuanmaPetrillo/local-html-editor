const CANDIDATE_TEXT_TAGS = new Set([
  'h1','h2','h3','h4','h5','h6','p','button','a','li','label','figcaption','small','strong','em','span','div'
]);

const EXCLUDED_BLOCKS_PATTERN = /<\s*(script|style|noscript|template|iframe|object|embed|svg)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const TAG_PATTERN = /<\s*(\/?)([a-z0-9:-]+)\b[^>]*>/gi;
const ENTITY_MAP = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

/** @param {string} input */
function decodeSimpleEntities(input) {
  return input.replace(/&(amp|lt|gt|quot|#39);/gi, (m) => ENTITY_MAP[m.toLowerCase()] || m);
}

/** @param {string} input */
function normalizeText(input) {
  return decodeSimpleEntities(input.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

/** @param {string} text */
function previewText(text) {
  return text.length <= 80 ? text : `${text.slice(0, 80)}…`;
}

/** @param {string} tagName @param {string} rawInner */
function classifyCandidate(tagName, rawInner) {
  if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'p' || tagName === 'button') {
    return { confidence: 'high', reason: 'common editable text element' };
  }
  if (tagName === 'a' || tagName === 'li' || tagName === 'label' || tagName === 'figcaption') {
    return { confidence: 'medium', reason: 'likely user-visible text element' };
  }
  if (tagName === 'div' && /<[a-z]/i.test(rawInner)) {
    return { confidence: 'low', reason: 'div contains nested markup' };
  }
  return { confidence: 'low', reason: 'advisory candidate from text-bearing tag' };
}

/** @param {string} htmlText */
export function extractEditableTextCandidates(htmlText) {
  const sanitized = String(htmlText || '').replace(EXCLUDED_BLOCKS_PATTERN, ' ');
  const stack = [];
  const candidates = [];
  let match = TAG_PATTERN.exec(sanitized);

  while (match) {
    const isClosing = match[1] === '/';
    const tagName = match[2].toLowerCase();

    if (!isClosing) {
      stack.push({ tagName, start: TAG_PATTERN.lastIndex, openEnd: match.index + match[0].length });
    } else {
      let openIndex = stack.length - 1;
      while (openIndex >= 0 && stack[openIndex].tagName !== tagName) openIndex -= 1;
      if (openIndex >= 0) {
        const open = stack.splice(openIndex, 1)[0];
        if (CANDIDATE_TEXT_TAGS.has(tagName)) {
          const rawInner = sanitized.slice(open.start, match.index);
          const text = normalizeText(rawInner);
          if (text) {
            const meta = classifyCandidate(tagName, rawInner);
            candidates.push({
              candidateId: `text-${String(candidates.length + 1).padStart(3, '0')}`,
              tagName,
              textPreview: previewText(text),
              textLength: text.length,
              confidence: meta.confidence,
              reason: meta.reason,
              status: 'read-only'
            });
          }
        }
      }
    }

    match = TAG_PATTERN.exec(sanitized);
  }

  return candidates;
}

/** @param {string} htmlText */
export function createEditableTextInventory(htmlText) {
  return {
    inventoryStatus: 'read-only-discovery',
    editingEnabled: false,
    candidates: extractEditableTextCandidates(htmlText)
  };
}

/** @param {{inventoryStatus: string, editingEnabled: boolean, candidates: Array<{candidateId: string, tagName: string, textPreview: string, textLength: number, confidence: string, reason: string, status: string}>} | null} inventory */
export function formatEditableInventoryText(inventory) {
  if (!inventory) {
    return 'Editable text candidates: unavailable.';
  }

  const lines = [
    'Editable text candidates',
    'Read-only discovery',
    'Editing is not enabled yet'
  ];

  if (inventory.candidates.length === 0) {
    lines.push('No likely editable text candidates found.');
    return lines.join('\n');
  }

  lines.push(`Candidates: ${inventory.candidates.length}`);
  for (const c of inventory.candidates) {
    lines.push(`${c.candidateId} | <${c.tagName}> | ${c.confidence} | ${c.status} | ${c.reason}`);
    lines.push(`  preview: "${c.textPreview}" (${c.textLength} chars)`);
  }

  return lines.join('\n');
}

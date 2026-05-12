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
              sourceStart: open.start,
              sourceEnd: match.index,
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

/** @param {string} text */
export function escapeTextForHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** @param {string} htmlText @param {any} patchPlan @param {any} inventory */
export function applyPlannedTextPatchToWorkingHtml(htmlText, patchPlan, inventory) {
  const baseResult = {
    patchId: patchPlan && patchPlan.patchId ? patchPlan.patchId : '',
    candidateId: patchPlan && patchPlan.candidateId ? patchPlan.candidateId : '',
    applied: false,
    applyStatus: 'failed',
    message: 'Patch failed.',
    warnings: []
  };

  if (!patchPlan || patchPlan.applyStatus !== 'planned') {
    return { ...baseResult, applyStatus: 'blocked', message: 'Patch is not in planned state.', warnings: ['patch-not-planned'] };
  }
  const candidate = inventory && Array.isArray(inventory.candidates)
    ? inventory.candidates.find((item) => item.candidateId === patchPlan.candidateId)
    : null;
  if (!candidate) {
    return { ...baseResult, applyStatus: 'failed', message: 'Candidate not found in current inventory.', warnings: ['candidate-not-found'] };
  }
  if (!Number.isInteger(candidate.sourceStart) || !Number.isInteger(candidate.sourceEnd) || candidate.sourceEnd < candidate.sourceStart) {
    return { ...baseResult, applyStatus: 'failed', message: 'Candidate source span is missing or invalid.', warnings: ['invalid-source-span'] };
  }

  const source = String(htmlText || '');
  if (candidate.sourceEnd > source.length) {
    return { ...baseResult, applyStatus: 'failed', message: 'Candidate source span is out of bounds.', warnings: ['source-span-out-of-bounds'] };
  }

  const escapedReplacement = escapeTextForHtml(patchPlan.replacementText);
  const workingHtml = `${source.slice(0, candidate.sourceStart)}${escapedReplacement}${source.slice(candidate.sourceEnd)}`;
  return {
    ...baseResult,
    applied: true,
    applyStatus: 'applied-to-working-preview',
    message: 'Patch applied to in-memory working HTML for safe preview refresh.',
    warnings: [],
    workingHtml
  };
}


/** @param {{candidates: Array<{candidateId: string, textPreview: string}>} | null} inventory @param {string} candidateId */
export function selectEditableCandidate(inventory, candidateId) {
  if (!inventory || !Array.isArray(inventory.candidates)) return null;
  return inventory.candidates.find((candidate) => candidate.candidateId === candidateId) || null;
}

/** @param {{candidateId: string, textPreview: string} | null} candidate @param {string} replacementText */
export function createDraftEdit(candidate, replacementText) {
  if (!candidate) return null;
  const nextReplacement = String(replacementText || '');
  const trimmedLength = nextReplacement.trim().length;
  let validationStatus = 'valid';
  if (trimmedLength === 0) {
    validationStatus = 'warning-empty';
  } else if (nextReplacement.length > 500) {
    validationStatus = 'warning-long';
  }

  return {
    candidateId: candidate.candidateId,
    originalTextPreview: candidate.textPreview,
    replacementText: nextReplacement,
    replacementLength: nextReplacement.length,
    dirty: nextReplacement !== candidate.textPreview,
    validationStatus
  };
}

/** @param {{candidates: Array<{candidateId: string, textPreview: string}>} | null} inventory */
export function createDraftEditState(inventory) {
  return {
    selectedCandidateId: inventory && inventory.candidates.length > 0 ? inventory.candidates[0].candidateId : '',
    draftEdit: null
  };
}

/** @param {{draftEdit: {candidateId: string, originalTextPreview: string, replacementLength: number, dirty: boolean, validationStatus: string} | null} | null} state */
export function formatDraftEditText(state) {
  if (!state || !state.draftEdit) return 'Draft edit: unavailable.';
  const { draftEdit } = state;
  return [
    'Draft edit buffer',
    `candidate: ${draftEdit.candidateId}`,
    `original preview: "${draftEdit.originalTextPreview}"`,
    `replacement length: ${draftEdit.replacementLength}`,
    `dirty: ${draftEdit.dirty ? 'yes' : 'no'}`,
    `validation: ${draftEdit.validationStatus}`
  ].join('\n');
}

/** @param {string} candidateId */
function createPatchIdFromCandidateId(candidateId) {
  const suffix = String(candidateId || '').replace(/^text-/, '') || 'unknown';
  return `patch-text-${suffix}`;
}

/** @param {any} patchPlan */
export function validatePatchPlan(patchPlan) {
  if (!patchPlan) {
    return { validationStatus: 'warning-missing-candidate', applyStatus: 'blocked', warnings: ['warning-missing-candidate'] };
  }
  if (!patchPlan.candidateId) {
    return { validationStatus: 'warning-missing-candidate', applyStatus: 'blocked', warnings: ['warning-missing-candidate'] };
  }
  if (String(patchPlan.replacementText || '').trim().length === 0) {
    return { validationStatus: 'warning-empty', applyStatus: 'blocked', warnings: ['warning-empty'] };
  }
  if (Number(patchPlan.replacementLength || 0) > 500) {
    return { validationStatus: 'warning-long', applyStatus: 'blocked', warnings: ['warning-long'] };
  }
  return { validationStatus: 'valid', applyStatus: 'planned', warnings: [] };
}

/** @param {{candidateId: string, originalTextPreview: string, replacementText: string, replacementLength: number, validationStatus: string} | null} draftEdit */
export function createTextPatchPlan(draftEdit) {
  if (!draftEdit) return null;
  const basePlan = {
    patchId: createPatchIdFromCandidateId(draftEdit.candidateId),
    candidateId: draftEdit.candidateId || '',
    operation: 'replace-text',
    originalTextPreview: String(draftEdit.originalTextPreview || ''),
    replacementText: String(draftEdit.replacementText || ''),
    replacementLength: Number(draftEdit.replacementLength || 0),
    validationStatus: 'valid',
    applyStatus: 'planned',
    warnings: [],
    createdAt: new Date().toISOString()
  };
  const validated = validatePatchPlan(basePlan);
  return {
    ...basePlan,
    validationStatus: validated.validationStatus,
    applyStatus: validated.applyStatus,
    warnings: validated.warnings
  };
}

/** @param {{draftEdit: any} | null} draftState */
export function createPatchPlanState(draftState) {
  const patchPlan = draftState ? createTextPatchPlan(draftState.draftEdit) : null;
  return { patchPlan };
}

/** @param {{patchId: string, candidateId: string, operation: string, replacementLength: number, validationStatus: string, applyStatus: string, warnings: string[]} | null} patchPlan */
export function formatPatchPlanText(patchPlan) {
  if (!patchPlan) return 'Patch plan: unavailable.';
  return [
    'Patch plan',
    `patch: ${patchPlan.patchId}`,
    `candidate: ${patchPlan.candidateId}`,
    `operation: ${patchPlan.operation}`,
    `replacement length: ${patchPlan.replacementLength}`,
    `validation: ${patchPlan.validationStatus}`,
    `apply status: ${patchPlan.applyStatus}`,
    `warnings: ${patchPlan.warnings.length > 0 ? patchPlan.warnings.join(', ') : '(none)'}`
  ].join('\n');
}

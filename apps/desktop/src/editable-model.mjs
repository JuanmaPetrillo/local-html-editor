const CANDIDATE_TEXT_TAGS = new Set([
  'h1','h2','h3','h4','h5','h6','p','button','a','li','label','figcaption','small','strong','em','span','div'
]);

const EXCLUDED_BLOCKS_PATTERN = /<\s*(script|style|noscript|template|iframe|object|embed|svg)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
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
  const sanitized = String(htmlText || '').replace(EXCLUDED_BLOCKS_PATTERN, (match) => ' '.repeat(match.length));
  // Regex is defined locally so lastIndex resets on each call and exceptions mid-loop cannot corrupt shared state.
  const tagPattern = /<\s*(\/?)([a-z0-9:-]+)\b[^>]*>/gi;
  const stack = [];
  const candidates = [];
  let match = tagPattern.exec(sanitized);

  while (match) {
    const isClosing = match[1] === '/';
    const tagName = match[2].toLowerCase();

    if (!isClosing) {
      stack.push({ tagName, start: tagPattern.lastIndex, openEnd: match.index + match[0].length });
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

    match = tagPattern.exec(sanitized);
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
    'Text editing is available for the candidates below. Changes stay in memory until exported.'
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

export function createPatchCollectionState() {
  return { patchesByCandidateId: {}, orderedCandidateIds: [] };
}

/** @param {{patchesByCandidateId: Record<string, any>, orderedCandidateIds: string[]}} collection @param {any} patchPlan */
export function addOrUpdatePatchInCollection(collection, patchPlan) {
  const next = collection || createPatchCollectionState();
  const validated = validatePatchPlan(patchPlan);
  if (!patchPlan || validated.applyStatus !== 'planned') {
    return { collection: next, changed: false, status: 'blocked' };
  }
  const candidateId = patchPlan.candidateId;
  const nextOrdered = next.orderedCandidateIds.includes(candidateId)
    ? next.orderedCandidateIds.slice()
    : [...next.orderedCandidateIds, candidateId];
  return {
    collection: {
      patchesByCandidateId: { ...next.patchesByCandidateId, [candidateId]: { ...patchPlan } },
      orderedCandidateIds: nextOrdered
    },
    changed: true,
    status: next.orderedCandidateIds.includes(candidateId) ? 'updated' : 'added'
  };
}


/** @param {{patchesByCandidateId: Record<string, any>, orderedCandidateIds: string[]}} collection @param {any} inventory */
export function detectOverlappingPatchSpans(collection, inventory) {
  if (!collection || !Array.isArray(collection.orderedCandidateIds) || !inventory || !Array.isArray(inventory.candidates)) return [];
  const candidateById = new Map(inventory.candidates.map((candidate) => [candidate.candidateId, candidate]));
  const spans = collection.orderedCandidateIds
    .filter((candidateId) => collection.patchesByCandidateId[candidateId])
    .map((candidateId) => ({ candidateId, candidate: candidateById.get(candidateId) }))
    .filter((item) => item.candidate && Number.isInteger(item.candidate.sourceStart) && Number.isInteger(item.candidate.sourceEnd))
    .map((item) => ({ candidateId: item.candidateId, start: item.candidate.sourceStart, end: item.candidate.sourceEnd }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const overlaps = [];
  for (let i = 0; i < spans.length; i += 1) {
    for (let j = i + 1; j < spans.length; j += 1) {
      const a = spans[i];
      const b = spans[j];
      if (!(a.start < b.end && b.start < a.end)) continue;
      overlaps.push({ a: a.candidateId, b: b.candidateId });
    }
  }
  return overlaps;
}

export function resetWorkingPreviewState() {
  return { collection: createPatchCollectionState(), applyResults: [], applyStatus: 'reset-to-original' };
}

/** @param {string} htmlText @param {{patchesByCandidateId: Record<string, any>, orderedCandidateIds: string[]}} collection @param {any} inventory */
export function applyPatchCollectionToWorkingHtml(htmlText, collection, inventory) {
  const source = String(htmlText || '');
  const base = {
    appliedAny: false,
    applyStatus: 'no-patches',
    applyResults: [],
    collectionCount: 0
  };
  if (!collection || !Array.isArray(collection.orderedCandidateIds) || collection.orderedCandidateIds.length === 0) {
    return { ...base, workingHtml: source };
  }
  let workingHtml = source;
  const candidateById = new Map(
    inventory && Array.isArray(inventory.candidates)
      ? inventory.candidates.map((candidate) => [candidate.candidateId, candidate])
      : []
  );
  const orderedToApply = collection.orderedCandidateIds
    .filter((candidateId) => collection.patchesByCandidateId[candidateId])
    .sort((a, b) => {
      const candidateA = candidateById.get(a);
      const candidateB = candidateById.get(b);
      const startA = candidateA && Number.isInteger(candidateA.sourceStart) ? candidateA.sourceStart : -1;
      const startB = candidateB && Number.isInteger(candidateB.sourceStart) ? candidateB.sourceStart : -1;
      if (startA !== startB) return startB - startA;
      const endA = candidateA && Number.isInteger(candidateA.sourceEnd) ? candidateA.sourceEnd : -1;
      const endB = candidateB && Number.isInteger(candidateB.sourceEnd) ? candidateB.sourceEnd : -1;
      return endB - endA;
    });
  const overlaps = detectOverlappingPatchSpans(collection, inventory);
  if (overlaps.length > 0) {
    return {
      appliedAny: false,
      applyStatus: 'blocked-overlapping-patches',
      applyResults: [],
      collectionCount: orderedToApply.length,
      warnings: ['overlapping-patches']
    };
  }

  const applyResults = [];
  for (const candidateId of orderedToApply) {
    const result = applyPlannedTextPatchToWorkingHtml(workingHtml, collection.patchesByCandidateId[candidateId], inventory);
    applyResults.push({
      patchId: result.patchId,
      candidateId: result.candidateId,
      applied: result.applied,
      applyStatus: result.applyStatus,
      message: result.message,
      warnings: result.warnings
    });
    if (result.applied && result.workingHtml) workingHtml = result.workingHtml;
  }
  const appliedCount = applyResults.filter((r) => r.applied).length;
  return {
    workingHtml,
    appliedAny: appliedCount > 0,
    applyStatus: appliedCount === orderedToApply.length ? 'applied-to-working-preview' : 'partial-or-failed',
    applyResults,
    collectionCount: orderedToApply.length
  };
}

export function formatPatchCollectionText(collection) {
  if (!collection || collection.orderedCandidateIds.length === 0) return 'Patch collection: none applied (in-memory only).';
  const lines = ['Patch collection (in-memory only, unsaved)', `Patches: ${collection.orderedCandidateIds.length}`];
  for (const candidateId of collection.orderedCandidateIds) {
    const patch = collection.patchesByCandidateId[candidateId];
    if (!patch) continue;
    lines.push(`${patch.patchId} | ${patch.candidateId} | ${patch.applyStatus} | replacement=${patch.replacementLength}`);
  }
  return lines.join('\n');
}

export function formatWorkingPreviewStateText(state) {
  if (!state) return 'Working preview state: unavailable.';
  return [
    'Working preview state',
    `status: ${state.applyStatus || 'unknown'}`,
    `applied patches: ${Array.isArray(state.applyResults) ? state.applyResults.filter((r) => r.applied).length : 0}`,
    `total patches tracked: ${state.collectionCount || 0}`,
    'persistence: none (in-memory only)'
  ].join('\n');
}

export function createPatchCollectionApplyOperations(collection, inventory) {
  const ids = collection && Array.isArray(collection.orderedCandidateIds) ? collection.orderedCandidateIds : [];
  const candidates = inventory && Array.isArray(inventory.candidates) ? inventory.candidates : [];
  const ops = [];
  for (const candidateId of ids) {
    const patch = collection.patchesByCandidateId[candidateId];
    const candidate = candidates.find((item) => item.candidateId === candidateId);
    if (!patch || !candidate || !Number.isInteger(candidate.sourceStart) || !Number.isInteger(candidate.sourceEnd) || typeof patch.replacementText !== 'string') continue;
    ops.push({ operationId: patch.patchId || `patch-${candidateId}`, sourceStart: candidate.sourceStart, sourceEnd: candidate.sourceEnd, replacementText: patch.replacementText });
  }
  return ops;
}

export function applyCombinedPatchOperationsToHtml(htmlText, operations) {
  const rawOps = Array.isArray(operations) ? operations : [];
  const ops = rawOps.filter((op) => Number.isInteger(op.sourceStart) && Number.isInteger(op.sourceEnd) && op.sourceEnd >= op.sourceStart && typeof op.replacementText === 'string');
  if (rawOps.length > 0 && ops.length !== rawOps.length) {
    return { applyStatus: 'partial-or-failed', appliedAny: false, warnings: ['invalid-source-span', 'patch-application-failed'] };
  }
  const sorted = [...ops].sort((a, b) => (b.sourceStart - a.sourceStart) || (b.sourceEnd - a.sourceEnd));
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (curr.sourceEnd > prev.sourceStart) {
      return { applyStatus: 'blocked-overlapping-patches', appliedAny: false, warnings: ['overlapping-patches'] };
    }
  }
  let workingHtml = String(htmlText || '');
  for (const op of sorted) {
    workingHtml = `${workingHtml.slice(0, op.sourceStart)}${op.replacementText}${workingHtml.slice(op.sourceEnd)}`;
  }
  return { applyStatus: sorted.length ? 'applied-to-working-preview' : 'blocked-no-operations', appliedAny: sorted.length > 0, workingHtml, warnings: [] };
}

export function replaceFirstTextInTag(html, tagName, replacementText, escapeHtml) {
  const re = new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)<\/${tagName}>`, 'i');
  return String(html).replace(re, (_m, attrs) => `<${tagName}${attrs}>${escapeHtml(replacementText)}</${tagName}>`);
}

export function getSlideRegexById(slideId) {
  const safeId = slideId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    '<(section|div)\\b(?=[^>]*\\bclass\\s*=\\s*["\'][^"\']*slide[^"\']*["\'])(?=[^>]*\\bdata-slide-id\\s*=\\s*["\']' + safeId + '["\'])[^>]*>[\\s\\S]*?<\\/\\1>',
    'i'
  );
}

export function editHeadingTextInModel(modelInput, newText, deps) {
  const model = { ...modelInput };
  const next = replaceFirstTextInTag(model.sourceHtml, 'h1', newText, deps.escapeHtml);
  model.sourceHtml = next === model.sourceHtml ? String(model.sourceHtml).replace(/>([^<>]{1,200})</, '>' + deps.escapeHtml(newText) + '<') : next;
  return deps.mapHtmlToModel(model.sourceHtml);
}

export function addTextBlockToSlide(modelInput, text, deps) {
  const model = { ...modelInput };
  const slideId = model.selectedSlideId || model.slides[0]?.id;
  if (!slideId) return model;
  const target = String(model.sourceHtml).match(getSlideRegexById(slideId))?.[0];
  if (!target) return model;
  const updated = target.replace(/<\/(section|div)>\s*$/i, `<div class="lhe-added-text" style="position:absolute;left:80px;top:80px;width:280px;min-height:30px;">${deps.escapeHtml(text)}</div></$1>`);
  model.sourceHtml = String(model.sourceHtml).replace(getSlideRegexById(slideId), updated);
  return deps.mapHtmlToModel(model.sourceHtml);
}

export function deleteFirstTagInSlide(modelInput, tagName, deps) {
  const model = { ...modelInput };
  const slideId = model.selectedSlideId || model.slides[0]?.id;
  if (!slideId) return model;
  const target = String(model.sourceHtml).match(getSlideRegexById(slideId))?.[0];
  if (!target) return model;
  const updated = target.replace(new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?<\/${tagName}>`, 'i'), '');
  model.sourceHtml = String(model.sourceHtml).replace(getSlideRegexById(slideId), updated);
  return deps.mapHtmlToModel(model.sourceHtml);
}


export function addSlideToModel(modelInput, deps) {
  const model = { ...modelInput };
  const newId = `lhe-slide-${Date.now()}`;
  const newSlide = `<section class="slide" data-slide-id="${newId}" data-label="New Slide" style="position:relative;width:100%;min-height:100%;"><p style="position:absolute;left:80px;top:80px;font-size:24px;">New slide</p></section>`;
  const re = model.selectedSlideId ? getSlideRegexById(model.selectedSlideId) : null;
  const match = re ? String(model.sourceHtml).match(re) : null;
  const newSourceHtml = match
    ? String(model.sourceHtml).replace(re, `${match[0]}
${newSlide}`)
    : (/(<\/body>)/i.test(String(model.sourceHtml)) ? String(model.sourceHtml).replace(/<\/body>/i, `${newSlide}</body>`) : String(model.sourceHtml) + newSlide);
  const result = deps.mapHtmlToModel(newSourceHtml);
  result.selectedSlideId = newId;
  return result;
}

export function deleteSlideFromModel(modelInput, deps) {
  const model = { ...modelInput };
  if (model.slides.length <= 1) return model;
  const idx = model.slides.findIndex((slide) => slide.id === model.selectedSlideId);
  if (idx === -1) return model;
  const newSelectedId = model.slides[idx > 0 ? idx - 1 : 1].id;
  const re = getSlideRegexById(model.selectedSlideId);
  const result = deps.mapHtmlToModel(String(model.sourceHtml).replace(re, ''));
  result.selectedSlideId = newSelectedId;
  return result;
}

export function duplicateSlideInModel(modelInput, deps) {
  const model = { ...modelInput };
  const re = getSlideRegexById(model.selectedSlideId);
  const match = String(model.sourceHtml).match(re);
  if (!match) return model;
  const newId = `lhe-slide-${Date.now()}`;
  let dupe = match[0].replace(/data-slide-id\s*=\s*"[^"]*"/i, `data-slide-id="${newId}"`);
  dupe = dupe.replace(/data-slide-id\s*=\s*'[^']*'/i, `data-slide-id='${newId}'`);
  const hasLabel = /data-label\s*=\s*["']/i.test(dupe);
  if (hasLabel) {
    dupe = dupe.replace(/data-label\s*=\s*"([^"]*)"/i, (_m, label) => `data-label="${label} (Copy)"`);
    dupe = dupe.replace(/data-label\s*=\s*'([^']*)'/i, (_m, label) => `data-label='${label} (Copy)'`);
  } else {
    const existingLabel = model.slides.find((slide) => slide.id === model.selectedSlideId)?.label || 'Slide';
    dupe = dupe.replace(/(<(section|div)[^>]*class\s*=\s*["'][^"']*slide[^"']*["'][^>]*data-slide-id\s*=\s*["'][^"']*["'])([^>]*>)/i, `$1 data-label="${existingLabel} (Copy)"$3`);
  }
  const result = deps.mapHtmlToModel(String(model.sourceHtml).replace(re, `${match[0]}
${dupe}`));
  result.selectedSlideId = newId;
  return result;
}

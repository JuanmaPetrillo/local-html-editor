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

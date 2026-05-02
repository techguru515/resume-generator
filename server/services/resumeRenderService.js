/**
 * Single entry: CV → HTML for PDF and template preview.
 * Prefer DB Template `html` + `css` (handlebars). Falls back to legacy built-in string renderers.
 */
const { buildResumeViewModel, renderHandlebarsTemplate } = require('./templateRenderService');
const { renderBuiltInHtml } = require('./builtInResumeHtml');

function toPlainTemplate(t) {
  if (!t) return null;
  return t.toObject ? t.toObject() : t;
}

function renderResumeHtml(cvData, profile, templateDoc) {
  const tpl = toPlainTemplate(templateDoc);
  const prof = { ...(profile || {}) };

  if (tpl?.kind === 'handlebars' && String(tpl.html || '').trim()) {
    const vm = buildResumeViewModel(cvData, prof);
    return renderHandlebarsTemplate({ html: tpl.html, css: tpl.css }, vm);
  }

  if (tpl?.kind === 'built_in' && tpl.builtInKey) {
    prof.cvFormat = tpl.builtInKey;
  }

  return renderBuiltInHtml(cvData, prof);
}

module.exports = { renderResumeHtml, toPlainTemplate };

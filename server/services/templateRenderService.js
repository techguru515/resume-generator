const Handlebars = require('handlebars');
const { buildMetadata } = require('./resumeMetadata');

function htmlEscapeWithBold(value) {
  const s = String(value ?? '');
  const parts = s.split('**');
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    const escaped = Handlebars.escapeExpression(parts[i]);
    out += i % 2 === 1 ? `<strong>${escaped}</strong>` : escaped;
  }
  return new Handlebars.SafeString(out);
}

function normalizeUrl(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  return s.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
}

function formatDate(raw) {
  return String(raw ?? '').trim();
}

function registerHelpersOnce() {
  if (registerHelpersOnce._did) return;
  registerHelpersOnce._did = true;
  Handlebars.registerHelper('html_escape_with_bold', htmlEscapeWithBold);
  Handlebars.registerHelper('normalize_url', normalizeUrl);
  Handlebars.registerHelper('format_date', formatDate);
}

function buildResumeViewModel(cvData, profile) {
  const p = profile || {};
  const cv = cvData || {};
  const experiences = cv.experiences || {};

  const skillsMap = cv.skills instanceof Map ? cv.skills : new Map(Object.entries(cv.skills || {}));
  const skillsHighlighted = Array.from(
    new Set(
      Array.from(skillsMap.values())
        .flat()
        .map((x) => String(x).trim())
        .filter(Boolean)
    )
  ).slice(0, 28);

  const skills_categories = Array.from(skillsMap.entries()).map(([cat, items]) => ({
    label: String(cat)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    items_line: (Array.isArray(items) ? items : [])
      .map((x) => String(x).trim())
      .filter(Boolean)
      .join(', '),
  }));

  const work = Array.isArray(p.workExperiences) ? p.workExperiences : [];
  const exps =
    work.length > 0
      ? work.map((w, i) => ({
          title: w.role,
          company: w.company,
          location: '',
          start_date: w.startDate || '',
          end_date: w.current ? 'Present' : (w.endDate || ''),
          bullet_points: cv.experiences?.[`experience${i + 1}`] || [],
        }))
      : [1, 2, 3]
          .map((i) => ({
            title: cv.experiences?.[`role${i}`] || '',
            company: cv.experiences?.[`company${i}`] || '',
            location: '',
            start_date: (String(cv.experiences?.[`date${i}`] || '').split('–')[0] || '').trim(),
            end_date: (String(cv.experiences?.[`date${i}`] || '').split('–')[1] || '').trim(),
            bullet_points: cv.experiences?.[`experience${i}`] || [],
          }))
          .filter((e) => e.title);

  const classic_experiences =
    work.length > 0
      ? work.map((w, i) => ({
          role: w.role,
          company: w.company,
          date: w.current ? `${w.startDate} – Present` : [w.startDate, w.endDate].filter(Boolean).join(' – '),
          bullets: experiences[`experience${i + 1}`] || [],
        }))
      : [1, 2, 3]
          .map((i) => ({
            role: experiences[`role${i}`],
            company: experiences[`company${i}`],
            date: experiences[`date${i}`],
            bullets: experiences[`experience${i}`] || [],
          }))
          .filter((r) => r.role);

  const educations = (Array.isArray(p.education) ? p.education : []).map((e) => ({
    institution: e.institution,
    degree: e.degree,
    field_of_study: e.field || '',
    start_date: e.startYear || '',
    end_date: e.endYear || '',
  }));

  const educations_classic = (Array.isArray(p.education) ? p.education : []).map((edu) => ({
    institution: edu.institution,
    degree_line: [edu.degree, edu.field].filter(Boolean).join(', '),
    years: [edu.startYear, edu.endYear].filter(Boolean).join(' – '),
  }));

  const certifications = (Array.isArray(p.certifications) ? p.certifications : []).map((c) => ({
    name: c.name,
    issuer: c.issuer || '',
    year: c.year || '',
  }));

  const certifications_classic = (Array.isArray(p.certifications) ? p.certifications : []).map((c) => ({
    name: c.name,
    meta: [c.issuer, c.year].filter(Boolean).join(', '),
  }));

  const contact_line = [p.email, p.phone, p.location, p.linkedin, p.github, p.website]
    .filter(Boolean)
    .map((x) => String(x))
    .join('  |  ');

  const meta = buildMetadata(cv, p);

  return {
    name: p.name || '',
    professional_title: cv.developer_title || '',
    email: p.email || '',
    phone: p.phone || '',
    location: p.location || '',
    linkedin_url: p.linkedin || '',
    github_url: p.github || '',
    website_url: p.website || '',
    summary: cv.summary || '',
    experiences: exps,
    educations,
    skills_highlighted: skillsHighlighted,
    certifications,

    skills_categories,
    classic_experiences,
    educations_classic,
    certifications_classic,
    contact_line,

    document_title: meta.title,
    meta_author: meta.author,
    meta_subject: meta.subject,
    meta_keywords: meta.keywords,
    meta_description: meta.subject,
    ats_keywords: meta.keywords,
  };
}

/**
 * Compile handlebars HTML, then append Template.css inside <head>.
 * DB `css` is always applied so preview/PDF stay in sync with the Templates collection.
 */
function renderHandlebarsTemplate({ html, css }, viewModel) {
  registerHelpersOnce();
  const tpl = Handlebars.compile(String(html || ''), { noEscape: false });
  const body = tpl(viewModel);

  const extra =
    css && String(css).trim()
      ? `\n<style type="text/css">\n${String(css).trim()}\n</style>\n`
      : '';

  if (!extra) return body;

  if (/<\/head>/i.test(body)) return body.replace(/<\/head>/i, `${extra}</head>`);
  if (/<head[\s>]/i.test(body)) return body.replace(/<head([^>]*)>/i, `<head$1>${extra}`);

  if (/<html[\s>]/i.test(body)) {
    return body.replace(/<html([^>]*)>/i, `<html$1><head><meta charset="UTF-8"/>${extra}</head>`);
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>${extra}</head><body>${body}</body></html>`;
}

module.exports = {
  buildResumeViewModel,
  renderHandlebarsTemplate,
};

const Handlebars = require('handlebars');

function htmlEscapeWithBold(value) {
  // Convert **bold** to <strong> while escaping everything else.
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
  // Keep as-is (e.g. "Jan 2020", "2021", "Present")
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

  const skillsMap = cv.skills instanceof Map ? cv.skills : new Map(Object.entries(cv.skills || {}));
  const skillsHighlighted = Array.from(
    new Set(
      Array.from(skillsMap.values())
        .flat()
        .map((x) => String(x).trim())
        .filter(Boolean)
    )
  ).slice(0, 28);

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

  const educations = (Array.isArray(p.education) ? p.education : []).map((e) => ({
    institution: e.institution,
    degree: e.degree,
    field_of_study: e.field || '',
    start_date: e.startYear || '',
    end_date: e.endYear || '',
  }));

  const certifications = (Array.isArray(p.certifications) ? p.certifications : []).map((c) => ({
    name: c.name,
    issuer: c.issuer || '',
    year: c.year || '',
  }));

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
  };
}

function renderHandlebarsTemplate({ html, css }, viewModel) {
  registerHelpersOnce();
  const tpl = Handlebars.compile(String(html || ''), { noEscape: false });
  const body = tpl(viewModel);

  // If template already has <style>, we don't inject.
  const hasStyle = /<style[\s>]/i.test(body);
  if (!css || hasStyle) return body;

  // Try to inject CSS into <head> for full HTML docs.
  if (/<head[\s>]/i.test(body)) {
    return body.replace(/<\/head>/i, `<style>\n${css}\n</style>\n</head>`);
  }
  // Otherwise, prepend style.
  return `<style>\n${css}\n</style>\n${body}`;
}

module.exports = {
  buildResumeViewModel,
  renderHandlebarsTemplate,
};


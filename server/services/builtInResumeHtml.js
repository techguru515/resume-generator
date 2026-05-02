/**
 * Legacy PDF HTML (no DB template). Used when a Template has no handlebars body
 * or for backward compatibility with old `built_in` kinds.
 */
const { buildMetadata } = require('./resumeMetadata');

function htmlEscape(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlEscapeWithBold(s) {
  const src = String(s ?? '');
  const parts = src.split('**');
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    const escaped = htmlEscape(parts[i]);
    out += i % 2 === 1 ? `<strong>${escaped}</strong>` : escaped;
  }
  return out;
}

function normalizeUrl(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  return s.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
}

function formatDate(raw) {
  return String(raw ?? '').trim() || '';
}

function buildExecutiveHtml(cvData, profile) {
  const { developer_title, summary, skills, experiences } = cvData;
  const {
    name,
    email,
    phone,
    location,
    linkedin,
    github,
    website,
    education = [],
    certifications = [],
    workExperiences = [],
  } = profile;

  const meta = buildMetadata(cvData, profile);

  const contactParts = [];
  if (email) contactParts.push(`<span>${htmlEscape(email)}</span>`);
  if (phone) contactParts.push(`<span>${htmlEscape(phone)}</span>`);
  if (location) contactParts.push(`<span>${htmlEscape(location)}</span>`);
  if (linkedin) {
    const u = normalizeUrl(linkedin);
    if (u) contactParts.push(`<span><a href="https://${htmlEscape(u)}">LinkedIn</a></span>`);
  }
  if (github) {
    const u = normalizeUrl(github);
    if (u) contactParts.push(`<span><a href="https://${htmlEscape(u)}">GitHub</a></span>`);
  }
  if (website) {
    const u = normalizeUrl(website);
    if (u) contactParts.push(`<span><a href="https://${htmlEscape(u)}">Portfolio</a></span>`);
  }

  const workRows =
    workExperiences.length > 0
      ? workExperiences.map((w, i) => ({
          title: w.role,
          company: w.company,
          start_date: w.startDate,
          end_date: w.current ? 'Present' : w.endDate,
          location: '',
          bullet_points: experiences?.[`experience${i + 1}`] || [],
        }))
      : [1, 2, 3]
          .map((i) => ({
            title: experiences?.[`role${i}`],
            company: experiences?.[`company${i}`],
            start_date: (experiences?.[`date${i}`] || '').split('–')[0]?.trim() || '',
            end_date: (experiences?.[`date${i}`] || '').split('–')[1]?.trim() || '',
            location: '',
            bullet_points: experiences?.[`experience${i}`] || [],
          }))
          .filter((r) => r.title);

  const expHtml = workRows.length
    ? `
  <section>
    <h2>Professional Experience</h2>
    ${workRows
      .map(
        (exp) => `
    <div class="entry">
      <div class="entry-row">
        <h3>${htmlEscape(exp.title)}</h3>
        <span class="dates">${htmlEscape(formatDate(exp.start_date))} &ndash; ${htmlEscape(formatDate(exp.end_date))}</span>
      </div>
      <p class="company">${htmlEscape(exp.company)}${exp.location ? ` &bull; ${htmlEscape(exp.location)}` : ''}</p>
      ${
        Array.isArray(exp.bullet_points) && exp.bullet_points.length
          ? `
      <ul>
        ${exp.bullet_points.map((b) => `<li>${htmlEscapeWithBold(b)}</li>`).join('')}
      </ul>`
          : ''
      }
    </div>`
      )
      .join('')}
  </section>`
    : '';

  const eduHtml = education.length
    ? `
      <section>
        <h2>Education</h2>
        ${education
          .map(
            (edu) => `
        <div class="entry">
          <h3>${htmlEscape(edu.degree)}${edu.field ? ` &mdash; ${htmlEscape(edu.field)}` : ''}</h3>
          <p class="company">${htmlEscape(edu.institution)}</p>
          <span class="dates">${htmlEscape(formatDate(edu.startYear))} &ndash; ${htmlEscape(formatDate(edu.endYear))}</span>
        </div>`
          )
          .join('')}
      </section>`
    : '';

  const skillsMap = skills instanceof Map ? skills : new Map(Object.entries(skills || {}));
  const skillsHighlighted = Array.from(
    new Set(Array.from(skillsMap.values()).flat().map((x) => String(x).trim()).filter(Boolean))
  ).slice(0, 28);
  const skillsHtml = skillsHighlighted.length
    ? `
      <section>
        <h2>Core Competencies</h2>
        <div class="tags">
          ${skillsHighlighted.map((s) => `<span class="tag">${htmlEscape(s)}</span>`).join('')}
        </div>
      </section>`
    : '';

  const certHtml = certifications.length
    ? `
      <section>
        <h2>Certifications</h2>
        ${certifications
          .map(
            (c) => `
        <div class="cert"><strong>${htmlEscape(c.name)}</strong>${c.issuer ? ` &mdash; ${htmlEscape(c.issuer)}` : ''}</div>`
          )
          .join('')}
      </section>`
    : '';

  const titleHtml = htmlEscape(`${name} - Resume`);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titleHtml}</title>
<meta name="author" content="${htmlEscape(meta.author)}"/>
<meta name="subject" content="${htmlEscape(meta.subject)}"/>
<meta name="keywords" content="${htmlEscape(meta.keywords)}"/>
<meta name="description" content="${htmlEscape(meta.subject)}"/>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; color: #111827; }
  .resume { padding: 0; }
  header { text-align: left; margin-bottom: 14px; }
  h1 { margin: 0; font-size: 26pt; letter-spacing: 0.2px; }
  .title { margin: 6px 0 10px; font-size: 11.5pt; font-weight: 700; color: #111827; }
  .contact-row { display: flex; flex-wrap: wrap; gap: 10px 14px; font-size: 9.5pt; color: #374151; }
  .contact-row a { color: #111827; text-decoration: none; border-bottom: 1px solid #D1D5DB; }
  section { margin: 12px 0; }
  h2 { margin: 0 0 6px; font-size: 11pt; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid #E5E7EB; padding-bottom: 4px; }
  .summary { margin: 0; font-size: 10pt; line-height: 1.5; color: #111827; }
  .entry { padding: 8px 0; }
  .entry-row { display: flex; justify-content: space-between; align-items: baseline; gap: 14px; }
  .entry-row h3 { margin: 0; font-size: 10.5pt; font-weight: 700; color: #111827; }
  .dates { font-size: 9pt; color: #4B5563; white-space: nowrap; }
  .company { margin: 2px 0 0; font-size: 9.5pt; color: #374151; }
  ul { margin: 6px 0 0; padding-left: 18px; }
  li { margin: 0 0 3px; font-size: 9.5pt; line-height: 1.45; color: #111827; }
  .two-col-bottom { display: grid; grid-template-columns: 1.2fr 0.9fr; gap: 18px; margin-top: 8px; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .tag { border: 1px solid #E5E7EB; background: #F9FAFB; padding: 4px 8px; border-radius: 999px; font-size: 9pt; color: #111827; }
  .cert { font-size: 9.5pt; margin: 6px 0 0; color: #111827; }
  .ats { position:absolute; left:-9999px; width:1px; height:1px; overflow:hidden; font-size:1px; color:white; }
</style>
</head>
<body>
<div class="resume">
  <header>
    <h1>${htmlEscape(name)}</h1>
    ${developer_title ? `<p class="title">${htmlEscape(developer_title)}</p>` : ''}
    <div class="contact-row">
      ${contactParts.join('')}
    </div>
  </header>

  ${
    summary
      ? `
  <section>
    <h2>Executive Summary</h2>
    <p class="summary">${htmlEscapeWithBold(summary)}</p>
  </section>`
      : ''
  }

  ${expHtml}

  <div class="two-col-bottom">
    <div>
      ${eduHtml}
    </div>
    <div>
      ${skillsHtml}
      ${certHtml}
    </div>
  </div>

  <div class="ats">${htmlEscape(meta.keywords)}</div>
</div>
</body>
</html>`;
}

function renderBuiltInHtml(cvData, profile) {
  const formatRaw = String(profile?.cvFormat || '').toLowerCase();
  if (formatRaw === 'executive') return buildExecutiveHtml(cvData, profile);

  const { developer_title, summary, skills = {}, experiences = {} } = cvData;
  const { name, email, phone, location, linkedin, github, website, education = [], certifications = [], workExperiences = [] } = profile;

  const meta = buildMetadata(cvData, profile);
  const contactParts = [email, phone, location, linkedin, github, website].filter(Boolean);

  const skillsMap = skills instanceof Map ? skills : new Map(Object.entries(skills));
  const skillsHtml = Array.from(skillsMap.entries())
    .map(([cat, items]) => {
      const label = cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      return `<p class="skill-row"><span class="skill-label">${label}:</span> ${items.join(', ')}</p>`;
    })
    .join('');

  const workRows =
    workExperiences.length > 0
      ? workExperiences.map((w, i) => ({
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

  const expHtml = workRows
    .map(({ role, company, date, bullets }) => {
      const bulletsHtml = bullets.map((b) => `<li>${b}</li>`).join('');
      return `
      <div class="role-block">
        <div class="role-header">
          <div class="role-left">
            <span class="role-title">${role}</span>
            ${company ? `<span class="role-sep">|</span><span class="role-company">${company}</span>` : ''}
          </div>
          ${date ? `<span class="role-date">${date}</span>` : ''}
        </div>
        ${bulletsHtml ? `<ul>${bulletsHtml}</ul>` : ''}
      </div>`;
    })
    .join('');

  const educationHtml = education.length
    ? education
        .map((edu) => {
          const years = [edu.startYear, edu.endYear].filter(Boolean).join(' – ');
          return `
          <div class="edu-block">
            <div class="edu-header">
              <span class="edu-institution">${edu.institution}</span>
              ${years ? `<span class="edu-years">${years}</span>` : ''}
            </div>
            <div class="edu-degree">${[edu.degree, edu.field].filter(Boolean).join(', ')}</div>
          </div>`;
        })
        .join('')
    : '';

  const certHtml = certifications.length
    ? certifications
        .map((c) => {
          const certMeta = [c.issuer, c.year].filter(Boolean).join(', ');
          return `<p class="cert-row"><span class="cert-name">${c.name}</span>${
            certMeta ? ` <span class="cert-meta">— ${certMeta}</span>` : ''
          }</p>`;
        })
        .join('')
    : '';

  const format = formatRaw === 'minimal' ? 'minimal' : 'classic';
  const theme =
    format === 'minimal'
      ? { primary: '#111111', accent: '#111111', light: '#555555', rule: '#E5E7EB', showRule: false }
      : { primary: '#1a3a5c', accent: '#2e86c1', light: '#666666', rule: '#2e86c1', showRule: true };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${meta.title}</title>
<meta name="author" content="${meta.author}"/>
<meta name="subject" content="${meta.subject}"/>
<meta name="keywords" content="${meta.keywords}"/>
<meta name="description" content="${meta.subject}"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
    font-size: 10pt;
    color: #2c2c2c;
    background: #fff;
    padding: 0;
    line-height: 1.45;
  }
  .header { text-align: center; margin-bottom: 10px; }
  .header h1 { font-size: ${format === 'minimal' ? '24pt' : '26pt'}; color: ${theme.primary}; font-weight: bold; margin-bottom: 4px; }
  .header .dev-title { font-size: 12pt; color: ${theme.accent}; font-weight: bold; margin-bottom: 6px; }
  .header .contact { font-size: 9pt; color: ${theme.light}; }
  .section { margin-bottom: 12px; }
  .section-title {
    font-size: 11pt;
    font-weight: bold;
    color: ${theme.primary};
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: ${theme.showRule ? `2px solid ${theme.rule}` : '0'};
    padding-bottom: 2px;
    margin-bottom: 6px;
  }
  .summary-text { font-size: 10pt; line-height: 1.5; }
  .skill-row { font-size: 9.5pt; margin-bottom: 3px; }
  .skill-label { font-weight: bold; color: ${theme.primary}; }
  .role-block { margin-bottom: 10px; }
  .role-header { display: flex; justify-content: space-between; align-items: baseline; margin-top: 8px; margin-bottom: 4px; }
  .role-left { display: flex; align-items: baseline; gap: 5px; flex-wrap: wrap; }
  .role-title { font-size: 10.5pt; font-weight: bold; color: ${theme.primary}; }
  .role-sep { font-size: 9pt; color: #aaa; }
  .role-company { font-size: 9.5pt; color: ${theme.accent}; font-weight: 600; }
  .role-date { font-size: 9pt; color: ${theme.light}; white-space: nowrap; }
  ul { padding-left: 18px; }
  li { font-size: 9.5pt; margin-bottom: 2.5px; }
  .edu-block { margin-bottom: 8px; }
  .edu-header { display: flex; justify-content: space-between; align-items: baseline; }
  .edu-institution { font-weight: bold; color: ${theme.primary}; font-size: 10pt; }
  .edu-years { font-size: 9pt; color: ${theme.light}; }
  .edu-degree { font-size: 9.5pt; color: #2c2c2c; margin-top: 1px; }
  .cert-row { font-size: 9.5pt; margin-bottom: 4px; }
  .cert-name { font-weight: bold; color: ${theme.primary}; }
  .cert-meta { color: ${theme.light}; }
</style>
</head>
<body>
  <div class="header">
    <h1>${name}</h1>
    <div class="dev-title">${developer_title}</div>
    <div class="contact">${contactParts.join('  |  ')}</div>
  </div>
  <div class="section">
    <div class="section-title">Professional Summary</div>
    <p class="summary-text">${summary}</p>
  </div>

  <div class="section">
    <div class="section-title">Technical Skills</div>
    ${skillsHtml}
  </div>

  <div class="section">
    <div class="section-title">Professional Experience</div>
    ${expHtml}
  </div>

  ${
    educationHtml
      ? `
  <div class="section">
    <div class="section-title">Education</div>
    ${educationHtml}
  </div>`
      : ''
  }

  ${
    certHtml
      ? `
  <div class="section">
    <div class="section-title">Certifications</div>
    ${certHtml}
  </div>`
      : ''
  }

  <div style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;font-size:1px;color:white;">
    ${meta.keywords}
  </div>
</body>
</html>`;
}

module.exports = { renderBuiltInHtml };

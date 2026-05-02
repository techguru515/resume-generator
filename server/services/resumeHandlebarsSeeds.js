/**
 * Canonical Handlebars + CSS seeded into Template documents.
 * PDF and preview render through resumeRenderService using these bodies.
 */

/** Two-column executive layout — HTML only; styling comes from `EXECUTIVE_BASE_CSS` or themed overrides. */
const EXECUTIVE_HANDLEBARS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>{{document_title}}</title>
<meta name="author" content="{{meta_author}}"/>
<meta name="subject" content="{{meta_subject}}"/>
<meta name="keywords" content="{{meta_keywords}}"/>
<meta name="description" content="{{meta_description}}"/>
</head>
<body>
<div class="resume">
  <header>
    <h1>{{name}}</h1>
    {{#if professional_title}}<p class="title">{{professional_title}}</p>{{/if}}
    <div class="contact-row">
      {{#if email}}<span>{{email}}</span>{{/if}}
      {{#if phone}}<span>{{phone}}</span>{{/if}}
      {{#if location}}<span>{{location}}</span>{{/if}}
      {{#if linkedin_url}}<span><a href="https://{{normalize_url linkedin_url}}">LinkedIn</a></span>{{/if}}
      {{#if github_url}}<span><a href="https://{{normalize_url github_url}}">GitHub</a></span>{{/if}}
      {{#if website_url}}<span><a href="https://{{normalize_url website_url}}">Portfolio</a></span>{{/if}}
    </div>
  </header>

  {{#if summary}}
  <section>
    <h2>Executive Summary</h2>
    <p class="summary">{{html_escape_with_bold summary}}</p>
  </section>
  {{/if}}

  {{#if experiences}}
  <section>
    <h2>Professional Experience</h2>
    {{#each experiences}}
    <div class="entry">
      <div class="entry-row">
        <h3>{{title}}</h3>
        <span class="dates">{{format_date start_date}} &ndash; {{format_date end_date}}</span>
      </div>
      <p class="company">{{company}}{{#if location}} &bull; {{location}}{{/if}}</p>
      {{#if bullet_points}}
      <ul>
        {{#each bullet_points}}
        <li>{{html_escape_with_bold this}}</li>
        {{/each}}
      </ul>
      {{/if}}
    </div>
    {{/each}}
  </section>
  {{/if}}

  <div class="two-col-bottom">
    <div>
      {{#if educations}}
      <section>
        <h2>Education</h2>
        {{#each educations}}
        <div class="entry">
          <h3>{{degree}}{{#if field_of_study}} &mdash; {{field_of_study}}{{/if}}</h3>
          <p class="company">{{institution}}</p>
          <span class="dates">{{format_date start_date}} &ndash; {{format_date end_date}}</span>
        </div>
        {{/each}}
      </section>
      {{/if}}
    </div>
    <div>
      {{#if skills_highlighted}}
      <section>
        <h2>Core Competencies</h2>
        <div class="tags">
          {{#each skills_highlighted}}
          <span class="tag">{{this}}</span>
          {{/each}}
        </div>
      </section>
      {{/if}}

      {{#if certifications}}
      <section>
        <h2>Certifications</h2>
        {{#each certifications}}
        <div class="cert"><strong>{{name}}</strong>{{#if issuer}} &mdash; {{issuer}}{{/if}}</div>
        {{/each}}
      </section>
      {{/if}}
    </div>
  </div>

  {{#if ats_keywords}}
  <div class="ats">{{ats_keywords}}</div>
  {{/if}}
</div>
</body>
</html>`;

const EXECUTIVE_BASE_CSS = `
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
  .ats { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; font-size: 1px; color: white; }
`;

/** Centered “Classic” layout — HTML only. */
const CLASSIC_HANDLEBARS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>{{document_title}}</title>
<meta name="author" content="{{meta_author}}"/>
<meta name="subject" content="{{meta_subject}}"/>
<meta name="keywords" content="{{meta_keywords}}"/>
<meta name="description" content="{{meta_description}}"/>
</head>
<body>
  <div class="header">
    <h1>{{name}}</h1>
    {{#if professional_title}}<div class="dev-title">{{professional_title}}</div>{{/if}}
    <div class="contact">{{contact_line}}</div>
  </div>
  {{#if summary}}
  <div class="section">
    <div class="section-title">Professional Summary</div>
    <p class="summary-text">{{html_escape_with_bold summary}}</p>
  </div>
  {{/if}}

  {{#if skills_categories}}
  <div class="section">
    <div class="section-title">Technical Skills</div>
    {{#each skills_categories}}
    <p class="skill-row"><span class="skill-label">{{label}}:</span> {{items_line}}</p>
    {{/each}}
  </div>
  {{/if}}

  {{#if classic_experiences}}
  <div class="section">
    <div class="section-title">Professional Experience</div>
    {{#each classic_experiences}}
    <div class="role-block">
      <div class="role-header">
        <div class="role-left">
          <span class="role-title">{{role}}</span>
          {{#if company}}<span class="role-sep">|</span><span class="role-company">{{company}}</span>{{/if}}
        </div>
        {{#if date}}<span class="role-date">{{date}}</span>{{/if}}
      </div>
      {{#if bullets}}
      <ul>
        {{#each bullets}}
        <li>{{html_escape_with_bold this}}</li>
        {{/each}}
      </ul>
      {{/if}}
    </div>
    {{/each}}
  </div>
  {{/if}}

  {{#if educations_classic}}
  <div class="section">
    <div class="section-title">Education</div>
    {{#each educations_classic}}
    <div class="edu-block">
      <div class="edu-header">
        <span class="edu-institution">{{institution}}</span>
        {{#if years}}<span class="edu-years">{{years}}</span>{{/if}}
      </div>
      <div class="edu-degree">{{degree_line}}</div>
    </div>
    {{/each}}
  </div>
  {{/if}}

  {{#if certifications_classic}}
  <div class="section">
    <div class="section-title">Certifications</div>
    {{#each certifications_classic}}
    <p class="cert-row"><span class="cert-name">{{name}}</span>{{#if meta}} <span class="cert-meta">— {{meta}}</span>{{/if}}</p>
    {{/each}}
  </div>
  {{/if}}

  {{#if ats_keywords}}
  <div class="ats-inline">{{ats_keywords}}</div>
  {{/if}}
</body>
</html>`;

const CLASSIC_HANDLEBARS_CSS = `
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
  .header h1 { font-size: 26pt; color: #1a3a5c; font-weight: bold; margin-bottom: 4px; }
  .header .dev-title { font-size: 12pt; color: #2e86c1; font-weight: bold; margin-bottom: 6px; }
  .header .contact { font-size: 9pt; color: #666666; }
  .section { margin-bottom: 12px; }
  .section-title {
    font-size: 11pt;
    font-weight: bold;
    color: #1a3a5c;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 2px solid #2e86c1;
    padding-bottom: 2px;
    margin-bottom: 6px;
  }
  .summary-text { font-size: 10pt; line-height: 1.5; }
  .skill-row { font-size: 9.5pt; margin-bottom: 3px; }
  .skill-label { font-weight: bold; color: #1a3a5c; }
  .role-block { margin-bottom: 10px; }
  .role-header { display: flex; justify-content: space-between; align-items: baseline; margin-top: 8px; margin-bottom: 4px; }
  .role-left { display: flex; align-items: baseline; gap: 5px; flex-wrap: wrap; }
  .role-title { font-size: 10.5pt; font-weight: bold; color: #1a3a5c; }
  .role-sep { font-size: 9pt; color: #aaa; }
  .role-company { font-size: 9.5pt; color: #2e86c1; font-weight: 600; }
  .role-date { font-size: 9pt; color: #666666; white-space: nowrap; }
  ul { padding-left: 18px; }
  li { font-size: 9.5pt; margin-bottom: 2.5px; }
  .edu-block { margin-bottom: 8px; }
  .edu-header { display: flex; justify-content: space-between; align-items: baseline; }
  .edu-institution { font-weight: bold; color: #1a3a5c; font-size: 10pt; }
  .edu-years { font-size: 9pt; color: #666666; }
  .edu-degree { font-size: 9.5pt; color: #2c2c2c; margin-top: 1px; }
  .cert-row { font-size: 9.5pt; margin-bottom: 4px; }
  .cert-name { font-weight: bold; color: #1a3a5c; }
  .cert-meta { color: #666666; }
  .ats-inline { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; font-size: 1px; color: white; }
`;

const EXECUTIVE_COLOR_CSS_EXTRA = `
  :root {
    --primary: #1a3a5c;
    --accent: #2e86c1;
    --text: #2c2c2c;
    --muted: #666666;
    --rule: #2e86c1;
    --tagBg: #eef6ff;
    --tagBorder: #cfe7ff;
  }
  body { color: var(--text); }
  h1 { color: var(--primary); }
  .title { color: var(--accent); }
  .contact-row { color: var(--muted); }
  .contact-row a { color: var(--accent); text-decoration: none; border-bottom: 1px solid rgba(46, 134, 193, 0.35); }
  h2 { color: var(--primary); border-bottom: 2px solid var(--rule); }
  .summary { color: var(--text); }
  .entry-row h3 { color: var(--primary); }
  .dates { color: var(--muted); }
  .company { color: var(--accent); font-weight: 600; }
  li { color: var(--text); }
  .tag {
    border: 1px solid var(--tagBorder);
    background: var(--tagBg);
    color: var(--primary);
    font-weight: 700;
  }
  .cert { color: var(--text); }
`;

module.exports = {
  EXECUTIVE_HANDLEBARS_HTML,
  EXECUTIVE_BASE_CSS,
  CLASSIC_HANDLEBARS_HTML,
  CLASSIC_HANDLEBARS_CSS,
  EXECUTIVE_COLOR_CSS_EXTRA,
};

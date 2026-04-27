const Template = require('../models/Template');

const EXECUTIVE_HANDLEBARS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{name}} - Resume</title>
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
</div>
</body>
</html>`;

const EXECUTIVE_HANDLEBARS_CSS = `
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
`;

async function seedTemplates({ adminUserId = null } = {}) {
  const existing = await Template.find({}).select('_id kind builtInKey name');

  async function ensureBuiltIn(name, builtInKey) {
    const found = existing.find((t) => t.kind === 'built_in' && t.builtInKey === builtInKey);
    if (found) {
      // Keep names readable / consistent.
      if (found.name !== name) {
        await Template.updateOne({ _id: found._id }, { $set: { name, isPublic: true } });
      }
      return found;
    }
    return Template.create({
      name,
      kind: 'built_in',
      builtInKey,
      isPublic: true,
      createdBy: adminUserId,
    });
  }

  async function ensureExecutiveHb() {
    const found = existing.find((t) => t.kind === 'handlebars' && t.name === 'Executive (DB template)');
    if (found) {
      // Rename to readable name; keep the old lookup stable on first run.
      await Template.updateOne({ _id: found._id }, { $set: { name: 'Executive (Modern)', isPublic: true } });
      return found;
    }
    const alt = existing.find((t) => t.kind === 'handlebars' && t.name === 'Executive (Modern)');
    if (alt) return alt;
    return Template.create({
      name: 'Executive (Modern)',
      kind: 'handlebars',
      html: EXECUTIVE_HANDLEBARS_HTML,
      css: EXECUTIVE_HANDLEBARS_CSS,
      isPublic: true,
      createdBy: adminUserId,
    });
  }

  async function ensureExecutiveColorHb() {
    const found = existing.find((t) => t.kind === 'handlebars' && t.name === 'Executive (Color)');
    const css = `
  :root {
    --primary: #1a3a5c; /* Classic palette */
    --accent: #2e86c1;
    --text: #2c2c2c;
    --muted: #666666;
    --rule: #2e86c1;
    --tagBg: #eef6ff;
    --tagBorder: #cfe7ff;
  }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; color: var(--text); }
  .resume { padding: 0; }

  header { text-align: left; margin-bottom: 14px; }
  h1 { margin: 0; font-size: 26pt; letter-spacing: 0.2px; color: var(--primary); }
  .title { margin: 6px 0 10px; font-size: 11.5pt; font-weight: 700; color: var(--accent); }

  .contact-row { display: flex; flex-wrap: wrap; gap: 10px 14px; font-size: 9.5pt; color: var(--muted); }
  .contact-row a { color: var(--accent); text-decoration: none; border-bottom: 1px solid rgba(46, 134, 193, 0.35); }
  .contact-row a:hover { border-bottom-color: rgba(46, 134, 193, 0.8); }

  section { margin: 12px 0; }
  h2 {
    margin: 0 0 6px;
    font-size: 11pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--primary);
    border-bottom: 2px solid var(--rule);
    padding-bottom: 4px;
  }

  .summary { margin: 0; font-size: 10pt; line-height: 1.5; color: var(--text); }

  .entry { padding: 8px 0; }
  .entry-row { display: flex; justify-content: space-between; align-items: baseline; gap: 14px; }
  .entry-row h3 { margin: 0; font-size: 10.5pt; font-weight: 700; color: var(--primary); }
  .dates { font-size: 9pt; color: var(--muted); white-space: nowrap; }
  .company { margin: 2px 0 0; font-size: 9.5pt; color: var(--accent); font-weight: 600; }

  ul { margin: 6px 0 0; padding-left: 18px; }
  li { margin: 0 0 3px; font-size: 9.5pt; line-height: 1.45; color: var(--text); }

  .two-col-bottom { display: grid; grid-template-columns: 1.2fr 0.9fr; gap: 18px; margin-top: 8px; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .tag {
    border: 1px solid var(--tagBorder);
    background: var(--tagBg);
    padding: 4px 8px;
    border-radius: 999px;
    font-size: 9pt;
    color: var(--primary);
    font-weight: 700;
  }
  .cert { font-size: 9.5pt; margin: 6px 0 0; color: var(--text); }
`;

    if (found) {
      await Template.updateOne(
        { _id: found._id },
        { $set: { html: EXECUTIVE_HANDLEBARS_HTML, css, isPublic: true } }
      );
      return found;
    }

    return Template.create({
      name: 'Executive (Color)',
      kind: 'handlebars',
      html: EXECUTIVE_HANDLEBARS_HTML,
      css,
      isPublic: true,
      createdBy: adminUserId,
    });
  }

  // Keep built-ins but make names nicer. Minimal is deprecated/hidden.
  await ensureBuiltIn('Classic', 'classic');
  await ensureBuiltIn('Executive (Two-column)', 'executive');
  await ensureExecutiveColorHb();

  // Hide deprecated minimal templates so they don't show up in dropdowns.
  await Template.updateMany(
    { kind: 'built_in', builtInKey: 'minimal' },
    { $set: { isPublic: false, name: 'Minimal (deprecated)' } }
  );

  // Hide everything except the three allowed formats.
  await Template.updateMany(
    {
      $and: [
        { name: { $nin: ['Classic', 'Executive (Two-column)', 'Executive (Color)'] } },
        // Keep admin-created private templates private; only manage public ones here.
        { isPublic: true },
      ],
    },
    { $set: { isPublic: false } }
  );
}

module.exports = { seedTemplates };


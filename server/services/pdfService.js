const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');
const { buildMetadata } = require('./resumeMetadata');
const { renderResumeHtml } = require('./resumeRenderService');

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

async function generatePdf(cvData, profile, options = {}) {
  const prof = { ...(profile || {}) };
  if (options && options.format) prof.cvFormat = options.format;

  const tpl = options?.template || null;
  if (tpl && tpl.kind === 'built_in' && tpl.builtInKey) {
    prof.cvFormat = tpl.builtInKey;
  }

  const html = renderResumeHtml(cvData, prof, tpl);
  const meta = buildMetadata(cvData, prof);
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });
  } catch (e) {
    const msg = e?.message || String(e);
    throw new Error(`PDF engine failed to start (Puppeteer/Chromium). ${msg}`);
  }
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const puppeteerBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '36px', right: '48px', bottom: '36px', left: '48px' },
      displayHeaderFooter: false,
    });
    const pdfDoc = await PDFDocument.load(puppeteerBuffer);
    pdfDoc.setTitle(meta.title);
    pdfDoc.setAuthor(meta.author);
    pdfDoc.setSubject(meta.subject);
    pdfDoc.setKeywords(meta.keywords.split(', ').filter(Boolean));
    pdfDoc.setCreator(meta.author);
    pdfDoc.setProducer(meta.author);
    return Buffer.from(await pdfDoc.save());
  } finally {
    if (browser) await browser.close();
  }
}

function buildCoverLetterHtml(cvData, profile) {
  const { cover_letter, company_name, role_title } = cvData || {};
  const { name, email, phone, location } = profile || {};

  const body = String(cover_letter || '').trim();
  if (!body) throw new Error('No cover letter available for this CV.');

  const title = `${name || 'Cover Letter'} – ${role_title || 'Role'}`;

  const headerRight = [
    email ? htmlEscape(email) : '',
    phone ? htmlEscape(phone) : '',
    location ? htmlEscape(location) : '',
  ]
    .filter(Boolean)
    .join('<br/>');

  const greeting = company_name ? `Dear ${htmlEscape(company_name)} Hiring Team,` : 'Dear Hiring Manager,';
  const paras = body
    .split(/\n\s*\n/g)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${htmlEscapeWithBold(p).replace(/\n/g, '<br/>')}</p>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${htmlEscape(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; color: #111827; }
    .page { padding: 44px 52px; }
    .hdr { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; margin-bottom: 18px; }
    .name { font-size: 22pt; font-weight: 700; margin: 0; }
    .meta { font-size: 10pt; color: #374151; text-align: right; line-height: 1.35; white-space: pre-line; }
    .sub { font-size: 11pt; font-weight: 700; color: #111827; margin-top: 6px; }
    .rule { height: 1px; background: #E5E7EB; margin: 14px 0 18px; }
    p { margin: 0 0 10px; font-size: 11pt; line-height: 1.55; }
  </style>
</head>
<body>
  <div class="page">
    <div class="hdr">
      <div>
        <h1 class="name">${htmlEscape(name || '')}</h1>
        <div class="sub">${htmlEscape([role_title, company_name].filter(Boolean).join(' · '))}</div>
      </div>
      <div class="meta">${headerRight}</div>
    </div>
    <div class="rule"></div>
    <p>${greeting}</p>
    ${paras}
  </div>
</body>
</html>`;
}

async function generateCoverLetterPdf(cvData, profile) {
  const html = buildCoverLetterHtml(cvData, profile);
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });
  } catch (e) {
    const msg = e?.message || String(e);
    throw new Error(`PDF engine failed to start (Puppeteer/Chromium). ${msg}`);
  }
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const puppeteerBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '36px', right: '48px', bottom: '36px', left: '48px' },
      displayHeaderFooter: false,
    });
    return Buffer.from(puppeteerBuffer);
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { generatePdf, generateCoverLetterPdf };

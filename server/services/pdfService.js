const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');

function buildMetadata(cvData, profile) {
  const skillsMap = cvData.skills instanceof Map ? cvData.skills : new Map(Object.entries(cvData.skills || {}));
  const allSkills = Array.from(skillsMap.values()).flat();
  const roles = profile.workExperiences?.map((w) => w.role) || [];
  const companies = profile.workExperiences?.map((w) => w.company) || [];
  const certNames = profile.certifications?.map((c) => c.name) || [];

  return {
    title: `${profile.name} – ${cvData.role_title || cvData.developer_title}`,
    author: profile.name,
    subject: cvData.developer_title || cvData.role_title,
    keywords: [
      cvData.role_title,
      cvData.developer_title,
      cvData.remote_status,
      ...allSkills,
      ...roles,
      ...companies,
      ...certNames,
    ].filter(Boolean).join(', '),
  };
}

function buildHtml(cvData, profile) {
  const { developer_title, summary, skills, experiences } = cvData;

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

  const workRows = workExperiences.length > 0
    ? workExperiences.map((w, i) => ({
        role: w.role,
        company: w.company,
        date: w.current ? `${w.startDate} – Present` : [w.startDate, w.endDate].filter(Boolean).join(' – '),
        bullets: experiences[`experience${i + 1}`] || [],
      }))
    : [1, 2, 3].map((i) => ({
        role: experiences[`role${i}`],
        company: experiences[`company${i}`],
        date: experiences[`date${i}`],
        bullets: experiences[`experience${i}`] || [],
      })).filter((r) => r.role);

  const expHtml = workRows.map(({ role, company, date, bullets }) => {
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
  }).join('');

  const educationHtml = education.length
    ? education.map((edu) => {
        const years = [edu.startYear, edu.endYear].filter(Boolean).join(' – ');
        return `
          <div class="edu-block">
            <div class="edu-header">
              <span class="edu-institution">${edu.institution}</span>
              ${years ? `<span class="edu-years">${years}</span>` : ''}
            </div>
            <div class="edu-degree">${[edu.degree, edu.field].filter(Boolean).join(', ')}</div>
          </div>`;
      }).join('')
    : '';

  const certHtml = certifications.length
    ? certifications.map((c) => {
        const meta = [c.issuer, c.year].filter(Boolean).join(', ');
        return `<p class="cert-row"><span class="cert-name">${c.name}</span>${meta ? ` <span class="cert-meta">— ${meta}</span>` : ''}</p>`;
      }).join('')
    : '';

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
    padding: 36px 48px;
    line-height: 1.45;
  }
  .header { text-align: center; margin-bottom: 10px; }
  .header h1 { font-size: 26pt; color: #1a3a5c; font-weight: bold; margin-bottom: 4px; }
  .header .dev-title { font-size: 12pt; color: #2e86c1; font-weight: bold; margin-bottom: 6px; }
  .header .contact { font-size: 9pt; color: #666; }
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
  .role-date { font-size: 9pt; color: #666; white-space: nowrap; }
  ul { padding-left: 18px; }
  li { font-size: 9.5pt; margin-bottom: 2.5px; }
  .edu-block { margin-bottom: 8px; }
  .edu-header { display: flex; justify-content: space-between; align-items: baseline; }
  .edu-institution { font-weight: bold; color: #1a3a5c; font-size: 10pt; }
  .edu-years { font-size: 9pt; color: #666; }
  .edu-degree { font-size: 9.5pt; color: #2c2c2c; margin-top: 1px; }
  .cert-row { font-size: 9.5pt; margin-bottom: 4px; }
  .cert-name { font-weight: bold; color: #1a3a5c; }
  .cert-meta { color: #666; }
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

  ${educationHtml ? `
  <div class="section">
    <div class="section-title">Education</div>
    ${educationHtml}
  </div>` : ''}

  ${certHtml ? `
  <div class="section">
    <div class="section-title">Certifications</div>
    ${certHtml}
  </div>` : ''}

  <!-- ATS keyword block: hidden from human view, readable by parsers -->
  <div style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;font-size:1px;color:white;">
    ${meta.keywords}
  </div>
</body>
</html>`;
}

async function generatePdf(cvData, profile) {
  const html = buildHtml(cvData, profile);
  const meta = buildMetadata(cvData, profile);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const puppeteerBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
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
    await browser.close();
  }
}

module.exports = { generatePdf };

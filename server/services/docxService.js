const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  TabStopPosition,
  TabStopType,
  UnderlineType,
  ShadingType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  VerticalAlign,
} = require('docx');

const COLORS = {
  primary: '1A3A5C',
  accent: '2E86C1',
  text: '2C2C2C',
  light: '666666',
  divider: 'CCCCCC',
};

function sectionHeading(text) {
  return new Paragraph({
    spacing: { before: 200, after: 60 },
    border: {
      bottom: { color: COLORS.accent, size: 8, space: 4, style: BorderStyle.SINGLE },
    },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: 22,
        color: COLORS.primary,
        font: 'Calibri',
      }),
    ],
  });
}

function bullet(text) {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    indent: { left: 360 },
    bullet: { level: 0 },
    children: [
      new TextRun({
        text,
        size: 19,
        color: COLORS.text,
        font: 'Calibri',
      }),
    ],
  });
}

function skillRow(category, skills) {
  const label = category
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return new Paragraph({
    spacing: { before: 50, after: 50 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 19, color: COLORS.primary, font: 'Calibri' }),
      new TextRun({ text: skills.join(', '), size: 19, color: COLORS.text, font: 'Calibri' }),
    ],
  });
}

async function generateDocx(cvData, profile) {
  const {
    developer_title,
    role_title,
    company_name,
    job_type,
    salary_range,
    summary,
    skills,
    experiences,
  } = cvData;

  const { name, email, phone, location, linkedin, github, website, education = [], certifications = [], workExperiences = [] } = profile;

  // Build contact line
  const contactParts = [email, phone, location, linkedin, github, website].filter(Boolean);

  const headerParagraphs = [
    // Name
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({
          text: name,
          bold: true,
          size: 52,
          color: COLORS.primary,
          font: 'Calibri',
        }),
      ],
    }),
    // Developer title
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({
          text: developer_title,
          size: 24,
          color: COLORS.accent,
          font: 'Calibri',
          bold: true,
        }),
      ],
    }),
    // Contact info
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
      children: [
        new TextRun({
          text: contactParts.join('  |  '),
          size: 18,
          color: COLORS.light,
          font: 'Calibri',
        }),
      ],
    }),
  ];

  // Summary paragraphs
  const summarySection = [
    sectionHeading('Professional Summary'),
    new Paragraph({
      spacing: { before: 80, after: 80 },
      children: [
        new TextRun({
          text: summary,
          size: 19,
          color: COLORS.text,
          font: 'Calibri',
        }),
      ],
    }),
  ];

  // Skills section
  const skillsSection = [sectionHeading('Technical Skills')];
  const skillsMap = skills instanceof Map ? skills : new Map(Object.entries(skills));
  for (const [category, items] of skillsMap) {
    skillsSection.push(skillRow(category, items));
  }

  // Experience section — company/role/date from profile.workExperiences, bullets from cv JSON
  const expSection = [sectionHeading('Professional Experience')];

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

  for (const { role, company, date, bullets } of workRows) {
    expSection.push(
      new Paragraph({
        spacing: { before: 160, after: 60 },
        children: [
          new TextRun({ text: role, bold: true, size: 21, color: COLORS.primary, font: 'Calibri' }),
          ...(company ? [
            new TextRun({ text: '  |  ', size: 19, color: COLORS.light, font: 'Calibri' }),
            new TextRun({ text: company, bold: true, size: 19, color: COLORS.accent, font: 'Calibri' }),
          ] : []),
          ...(date ? [new TextRun({ text: `    ${date}`, size: 18, color: COLORS.light, font: 'Calibri' })] : []),
        ],
      })
    );
    for (const point of bullets) expSection.push(bullet(point));
  }

  // Education section
  const educationSection = [];
  if (education.length > 0) {
    educationSection.push(sectionHeading('Education'));
    for (const edu of education) {
      const years = [edu.startYear, edu.endYear].filter(Boolean).join(' – ');
      educationSection.push(
        new Paragraph({
          spacing: { before: 120, after: 30 },
          children: [
            new TextRun({ text: edu.institution, bold: true, size: 20, color: COLORS.primary, font: 'Calibri' }),
            ...(years ? [new TextRun({ text: `  (${years})`, size: 18, color: COLORS.light, font: 'Calibri' })] : []),
          ],
        }),
        new Paragraph({
          spacing: { before: 0, after: 60 },
          children: [
            new TextRun({ text: [edu.degree, edu.field].filter(Boolean).join(', '), size: 19, color: COLORS.text, font: 'Calibri' }),
          ],
        })
      );
    }
  }

  // Certifications section
  const certSection = [];
  if (certifications.length > 0) {
    certSection.push(sectionHeading('Certifications'));
    for (const cert of certifications) {
      const meta = [cert.issuer, cert.year].filter(Boolean).join(', ');
      certSection.push(
        new Paragraph({
          spacing: { before: 80, after: 40 },
          children: [
            new TextRun({ text: cert.name, bold: true, size: 19, color: COLORS.primary, font: 'Calibri' }),
            ...(meta ? [new TextRun({ text: `  — ${meta}`, size: 18, color: COLORS.light, font: 'Calibri' })] : []),
          ],
        })
      );
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 20, color: COLORS.text },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 900, right: 900 },
          },
        },
        children: [
          ...headerParagraphs,
          ...summarySection,
          ...skillsSection,
          ...expSection,
          ...educationSection,
          ...certSection,
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

module.exports = { generateDocx };

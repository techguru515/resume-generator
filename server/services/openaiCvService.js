const OpenAI = require('openai');

/** Stage 1: turn noisy / unstructured posting text into clean fields for the CV writer. */
const EXTRACT_SYSTEM_PROMPT = `You extract structured job information from unstructured input: pasted web pages, emails, bullet fragments, mixed formatting, or partial text.

Return exactly ONE JSON object (no markdown, no code fences) with this shape:
{
  "job_title": "string — primary role title to target; best concise title",
  "company_name": "string — hiring organization; use empty string only if truly absent from text and URL gives no reliable hint",
  "job_type_guess": "Permanent" | "Contract" | "Unknown",
  "location_or_remote": "string — e.g. Remote US, Hybrid London, or empty",
  "salary_range": "string — only if explicitly stated; else empty",
  "key_responsibilities": ["string — short lines, what they will do"],
  "required_skills": ["string — hard requirements, tools, stacks"],
  "preferred_skills": ["string — nice-to-haves"],
  "education_requirements": "string — degree/cert expectations or empty",
  "experience_level": "string — e.g. Senior, 3–5 years, staff, empty if unclear",
  "industry_or_domain": "string — sector/product context or empty",
  "keywords_for_ats": ["string — important nouns/phrases from the posting"],
  "role_summary": "string — 3-6 sentences: scope, team, tech, outcomes. Neutral, factual.",
  "seniority": "string — IC / lead / manager / unknown",
  "employment_notes": "string — contract length, agency, etc., or empty",
  "extraction_notes": "string — brief caveats, e.g. truncated paste, or empty"
}

Rules:
- Prefer quoting what the text supports; do not invent salary, equity, or company name.
- If the job URL hostname suggests a company (e.g. careers.company.com), you may use that company only when the posting body does not name another employer.
- Empty arrays are fine. Use "Unknown" for job_type_guess only when neither Permanent nor Contract is implied.`;

/** Stage 2: write the CV document JSON using structured extraction + profile. */
const CV_SYSTEM_PROMPT = `You are an expert resume writer. You are given STRUCTURED_JOB: fields extracted from a messy job posting — treat them as the primary source of truth for requirements, skills themes, role scope, and metadata (when non-empty). You also see the original posting text (secondary) and the candidate profile (facts only for bullets and history layout).

Return exactly ONE JSON object (no markdown, no code fences):
{
  "role_title": "string — align with STRUCTURED_JOB.job_title when sensible",
  "developer_title": "string — compelling headline under the candidate name for THIS role",
  "company_name": "string — prefer STRUCTURED_JOB.company_name; if empty, infer carefully from URL/posting or use 'Not specified'",
  "job_type": "Permanent" or "Contract",
  "salary_range": "string — prefer STRUCTURED_JOB.salary_range if set; else empty",
  "summary": "string — 2–4 sentences, ATS-aware, implied first person without using 'I'",
  "skills": { "category_snake_case": ["skill", "..."], "another_category": ["..."] },
  "experiences": { },
  "job_description": "string — concise cleaned summary of the role (can synthesize from STRUCTURED_JOB.role_summary and responsibilities); may be empty"
}

Rules for "job_type": map STRUCTURED_JOB.job_type_guess — Unknown defaults to Permanent unless posting clearly implies contract.

Rules for "experiences":
- If the profile lists workExperiences, do NOT invent employer names or titles for those rows — only achievement bullets, keyed experience1…experienceN in the same order as profile jobs.
- Each experienceN: array of 3–6 strong bullets (metrics where plausible), tailored to STRUCTURED_JOB keywords and responsibilities.
- If profile has ZERO workExperiences, use up to three synthetic blocks: role1, company1, date1, experience1, etc., aligned to the target role (still strings/arrays only).

"skills": at least two categories; values are arrays of strings.`;

function buildExtractUserMessage(jobDescription, jobLink) {
  const parts = ['Unstructured job posting text:', jobDescription.trim()];
  if (jobLink) parts.push('', 'Job URL (optional hints):', jobLink.trim());
  return parts.join('\n');
}

function buildCvUserMessage({ structuredJob, jobDescription, jobLink, profile }) {
  const profileJson = {
    label: profile.label,
    name: profile.name,
    workExperiences: profile.workExperiences || [],
    education: profile.education || [],
    certifications: profile.certifications || [],
  };
  const parts = [
    'STRUCTURED_JOB (primary facts and requirements — follow this when it conflicts with noisy text below):',
    JSON.stringify(structuredJob, null, 2),
    '',
    'Original posting text (secondary; may be redundant or messy):',
    jobDescription.trim(),
  ];
  if (jobLink) parts.push('', 'Job URL:', jobLink.trim());
  parts.push('', 'Candidate profile (JSON):', JSON.stringify(profileJson, null, 2));
  return parts.join('\n');
}

function coerceStringArray(val) {
  if (val == null) return [];
  if (Array.isArray(val)) return val.map((x) => String(x).trim()).filter(Boolean);
  const s = String(val).trim();
  return s ? [s] : [];
}

function normalizeStructuredJob(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Job extraction returned invalid data');
  }
  return {
    job_title: String(raw.job_title || '').trim(),
    company_name: String(raw.company_name || '').trim(),
    job_type_guess: ['Permanent', 'Contract', 'Unknown'].includes(raw.job_type_guess)
      ? raw.job_type_guess
      : 'Unknown',
    location_or_remote: String(raw.location_or_remote || '').trim(),
    salary_range: String(raw.salary_range || '').trim(),
    key_responsibilities: coerceStringArray(raw.key_responsibilities),
    required_skills: coerceStringArray(raw.required_skills),
    preferred_skills: coerceStringArray(raw.preferred_skills),
    education_requirements: String(raw.education_requirements || '').trim(),
    experience_level: String(raw.experience_level || '').trim(),
    industry_or_domain: String(raw.industry_or_domain || '').trim(),
    keywords_for_ats: coerceStringArray(raw.keywords_for_ats),
    role_summary: String(raw.role_summary || '').trim(),
    seniority: String(raw.seniority || '').trim(),
    employment_notes: String(raw.employment_notes || '').trim(),
    extraction_notes: String(raw.extraction_notes || '').trim(),
  };
}

function normalizeSkills(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    const key = String(k).trim().replace(/\s+/g, '_').toLowerCase() || 'general';
    out[key] = coerceStringArray(v);
  }
  return out;
}

function normalizeExperiences(raw, workCount) {
  const src = raw && typeof raw.experiences === 'object' && !Array.isArray(raw.experiences) ? raw.experiences : {};
  const experiences = { ...src };
  const n = workCount > 0 ? workCount : 3;
  if (workCount > 0) {
    for (let i = 1; i <= n; i++) {
      const key = `experience${i}`;
      if (!Array.isArray(experiences[key])) experiences[key] = [];
      else experiences[key] = coerceStringArray(experiences[key]);
    }
  } else {
    for (let i = 1; i <= 3; i++) {
      const bulletsKey = `experience${i}`;
      if (!Array.isArray(experiences[bulletsKey])) experiences[bulletsKey] = [];
      else experiences[bulletsKey] = coerceStringArray(experiences[bulletsKey]);
      ['role', 'company', 'date'].forEach((prefix) => {
        const k = `${prefix}${i}`;
        if (experiences[k] != null && !Array.isArray(experiences[k])) experiences[k] = String(experiences[k]).trim();
      });
    }
  }
  return experiences;
}

function normalizePayload(parsed, profile) {
  const workCount = (profile.workExperiences || []).length;
  const job_type = parsed.job_type === 'Contract' ? 'Contract' : 'Permanent';
  let skills = normalizeSkills(parsed.skills);
  if (Object.keys(skills).length === 0) {
    skills = { technical_skills: ['See summary and experience'] };
  }

  const role_title = String(parsed.role_title || '').trim();
  const developer_title = String(parsed.developer_title || '').trim();
  const company_name = String(parsed.company_name || '').trim();
  const summary = String(parsed.summary || '').trim();

  if (!role_title || !developer_title || !company_name || !summary) {
    throw new Error('AI response missing required fields (role_title, developer_title, company_name, summary).');
  }

  const experiences = normalizeExperiences(parsed, workCount);

  return {
    role_title,
    developer_title,
    company_name,
    job_type,
    salary_range: String(parsed.salary_range || '').trim(),
    summary,
    skills,
    experiences,
    job_description: String(parsed.job_description || '').trim(),
  };
}

function parseJsonContent(text, label) {
  if (!text) throw new Error(`Empty response from OpenAI (${label})`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`OpenAI returned invalid JSON (${label})`);
  }
}

async function chatJsonObject(client, { model, temperature, system, user, label }) {
  const completion = await client.chat.completions.create({
    model,
    temperature,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  const text = completion.choices[0]?.message?.content;
  return parseJsonContent(text, label);
}

async function generateCvJsonWithOpenAI({ jobDescription, jobLink, profile }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const extractModel = process.env.OPENAI_MODEL_EXTRACT || model;

  const trimmedDesc = jobDescription.trim();
  const trimmedLink = jobLink ? String(jobLink).trim() : '';

  const extractedRaw = await chatJsonObject(client, {
    model: extractModel,
    temperature: 0.15,
    system: EXTRACT_SYSTEM_PROMPT,
    user: buildExtractUserMessage(trimmedDesc, trimmedLink),
    label: 'job extraction',
  });

  const structuredJob = normalizeStructuredJob(extractedRaw);

  const cvRaw = await chatJsonObject(client, {
    model,
    temperature: 0.35,
    system: CV_SYSTEM_PROMPT,
    user: buildCvUserMessage({
      structuredJob,
      jobDescription: trimmedDesc,
      jobLink: trimmedLink,
      profile,
    }),
    label: 'CV generation',
  });

  return normalizePayload(cvRaw, profile);
}

module.exports = { generateCvJsonWithOpenAI };

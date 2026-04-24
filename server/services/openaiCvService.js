const OpenAI = require('openai');

/** CV document JSON from the user's pasted job description + profile (one OpenAI call). */
const CV_SYSTEM_PROMPT = `You are an expert resume writer. You are given a JOB_DESCRIPTION: the full job posting or role brief the user pasted — treat it as the source of truth for requirements, skills themes, role scope, company name when stated, location/remote hints, and salary only if explicitly mentioned. You also see an optional job URL and the candidate profile (facts only for bullets and history layout).

Return exactly ONE JSON object (no markdown, no code fences):
{
  "role_title": "string — align with the role in JOB_DESCRIPTION",
  "developer_title": "string — compelling headline under the candidate name for THIS role",
  "company_name": "string — from posting when clear; else infer carefully from URL or use 'Not specified'",
  "job_type": "Permanent" or "Contract",
  "remote_status": "Remote" | "Hybrid" | "On-site" | "Unspecified" — from posting: Remote / hybrid / on-site; use Unspecified only when unclear",
  "salary_range": "string — only if explicitly stated in JOB_DESCRIPTION; else empty",
  "summary": "string — 2–4 sentences, ATS-aware, implied first person without using 'I'",
  "skills": { "category_snake_case": ["skill", "..."], "another_category": ["..."] },
  "experiences": { },
  "job_description": "string — concise cleaned summary of the role from JOB_DESCRIPTION; may be empty"
}

Rules for "job_type": Permanent unless the posting clearly implies contract / fixed-term / day rate.

Rules for "remote_status": infer from JOB_DESCRIPTION. Hybrid if both office and remote appear. On-site for in-office only. Remote for fully remote / WFH. Otherwise Unspecified.

Rules for "experiences":
- If the profile lists workExperiences, do NOT invent employer names or titles for those rows — only achievement bullets, keyed experience1…experienceN in the same order as profile jobs.
- Each experienceN: array of 3–6 strong bullets (metrics where plausible), tailored to this role's keywords and responsibilities from JOB_DESCRIPTION.
- If profile has ZERO workExperiences, use up to three synthetic blocks: role1, company1, date1, experience1, etc., aligned to the target role (still strings/arrays only).

"skills": at least two categories; values are arrays of strings.

Do not invent salary, equity, or employer names that are not supported by JOB_DESCRIPTION or the profile.`;

function buildCvUserMessage({ jobDescription, jobLink, profile }) {
  const profileJson = {
    label: profile.label,
    name: profile.name,
    workExperiences: profile.workExperiences || [],
    education: profile.education || [],
    certifications: profile.certifications || [],
  };
  const parts = [
    'JOB_DESCRIPTION:',
    jobDescription.trim(),
  ];
  if (jobLink) parts.push('', 'Job URL (optional context):', jobLink.trim());
  parts.push('', 'Candidate profile (JSON):', JSON.stringify(profileJson, null, 2));
  return parts.join('\n');
}

function coerceStringArray(val) {
  if (val == null) return [];
  if (Array.isArray(val)) return val.map((x) => String(x).trim()).filter(Boolean);
  const s = String(val).trim();
  return s ? [s] : [];
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

const REMOTE_STATUS_ENUM = ['Remote', 'Hybrid', 'On-site', 'Unspecified'];

function normalizeRemoteStatus(parsed, jobDescriptionText) {
  const raw = String(parsed?.remote_status || '').trim();
  if (REMOTE_STATUS_ENUM.includes(raw)) return raw;

  const guess = String(raw || '').toLowerCase();
  if (guess.includes('hybrid')) return 'Hybrid';
  if (/\bremote\b/.test(guess) || guess.includes('wfh') || guess.includes('work from home') || guess.includes('work-from-home'))
    return 'Remote';
  if (guess.includes('on-site') || guess.includes('onsite') || guess.includes('in-office') || guess.includes('in office'))
    return 'On-site';

  const jd = String(jobDescriptionText || '').toLowerCase();
  if (/\bhybrid\b/.test(jd)) return 'Hybrid';
  if (/\bremote\b/.test(jd)) return 'Remote';
  if (/\b(on\s*[-]?\s*site|in\s*[-]?\s*office)\b/.test(jd)) return 'On-site';

  return 'Unspecified';
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

function normalizePayload(parsed, profile, jobDescriptionText) {
  const workCount = (profile.workExperiences || []).length;
  const job_type = parsed.job_type === 'Contract' ? 'Contract' : 'Permanent';
  const remote_status = normalizeRemoteStatus(parsed, jobDescriptionText);
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
    remote_status,
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

// Cache OpenAI model list so we don't hit the API per request.
let _modelsCache = { atMs: 0, ids: null };
const MODELS_CACHE_TTL_MS = 10 * 60 * 1000;

async function listModelIdsCached(client) {
  const now = Date.now();
  if (_modelsCache.ids && now - _modelsCache.atMs < MODELS_CACHE_TTL_MS) return _modelsCache.ids;

  try {
    const resp = await client.models.list();
    const ids = new Set((resp?.data || []).map((m) => m?.id).filter(Boolean));
    _modelsCache = { atMs: now, ids };
    return ids;
  } catch {
    // If listing models fails (permissions / transient), proceed with env/default.
    return null;
  }
}

function normalizeModelAlias(m) {
  const s = String(m || '').trim();
  if (!s) return '';
  const lower = s.toLowerCase();
  // Treat unknown/marketing-ish env strings as "auto".
  if (lower === 'latest' || lower === 'auto') return '';
  // "gpt-5.4" / "gpt-5" are not OpenAI API model IDs (in this project); treat as "auto".
  if (lower === 'gpt-5' || lower.startsWith('gpt-5.')) return '';
  return s;
}

function pickPreferredModel(availableIds) {
  // Ordered best→worst. We pick the first that exists.
  const preferred = [
    'gpt-4.1',
    'gpt-4o',
    'gpt-4o-mini',
  ];

  if (availableIds && availableIds.size) {
    for (const id of preferred) {
      if (availableIds.has(id)) return id;
    }
    // Fallback heuristic: any "gpt-4o" family, then any "gpt-4.1" family.
    const any = [...availableIds];
    const byPrefix = (p) => any.find((x) => String(x).startsWith(p));
    return byPrefix('gpt-4o') || byPrefix('gpt-4.1') || byPrefix('gpt-4') || 'gpt-4o-mini';
  }

  // If we can't list models, fall back to a safe default.
  return 'gpt-4o-mini';
}

async function generateCvJsonWithOpenAI({ jobDescription, jobLink, profile }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

  const client = new OpenAI({ apiKey });

  const available = await listModelIdsCached(client);
  const auto = pickPreferredModel(available);

  const requestedModel = normalizeModelAlias(process.env.OPENAI_MODEL);

  const model =
    (requestedModel && (!available || available.has(requestedModel)) ? requestedModel : '') || auto;

  const trimmedDesc = jobDescription.trim();
  const trimmedLink = jobLink ? String(jobLink).trim() : '';

  const cvRaw = await chatJsonObject(client, {
    model,
    temperature: 0.35,
    system: CV_SYSTEM_PROMPT,
    user: buildCvUserMessage({
      jobDescription: trimmedDesc,
      jobLink: trimmedLink,
      profile,
    }),
    label: 'CV generation',
  });

  return normalizePayload(cvRaw, profile, trimmedDesc);
}

module.exports = { generateCvJsonWithOpenAI };

const OpenAI = require('openai');

const MAX_CUSTOM_SYSTEM_PROMPT = 48000;

const DEFAULT_CV_GENERATION = {
  yearsExperienceMention: 11,
  summarySentencesMin: 3,
  summarySentencesMax: 4,
  skillsCategoriesMin: 4,
  skillsCategoriesMax: 6,
  skillsPerCategoryMin: 8,
  skillsPerCategoryMax: 10,
  skillsMinTotal: 30,
  experienceBulletRanges: ['12-15', '10-12', '6-8'],
  syntheticRoleCount: 3,
  preCheckEnabled: true,
  extraInstructions: '',
  customSystemPrompt: '',
};

/**
 * Always appended after a user-written system prompt so normalizePayload and save still work.
 * Placed last so it takes precedence over conflicting format instructions.
 */
const CV_JSON_CONTRACT_APPENDIX = `---
APPENDED BY SERVER (integration contract — must satisfy):

The assistant message must be a single JSON object only (no markdown, no code fences).

If you refuse or run a job pre-check that blocks generation, return exactly:
{"generation_blocked":true,"block_message":"short user-facing reason"}

Otherwise include these top-level keys with these types:
- role_title (string), developer_title (string), company_name (string)
- job_type (string): "Permanent" or "Contract"
- remote_status (string): "Remote", "Hybrid", "On-site", or "Unspecified"
- salary_range (string; use "" if not in the JD)
- summary (string)
- skills (object: keys are category names, values are arrays of strings)
- experiences (object): The user message includes candidate profile JSON with workExperiences.
  - If workExperiences has one or more entries: output experience1, experience2, … as arrays of bullet strings in the same order only; do not invent employer names or titles for those rows.
  - If workExperiences is empty: output synthetic role1, experience1, and optionally role2/experience2, role3/experience3 (up to three blocks), with optional companyN and dateN strings.
- job_description (string; short JD summary or "")
- cover_letter (string; a tailored cover letter body; no markdown; plain text; can include line breaks; 150–250 words)

Do not add keys outside this contract unless they are nested under experiences or skills as described.`;

function clampInt(n, min, max, fallback) {
  const x = Number.parseInt(String(n), 10);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, x));
}

/**
 * Resolved generation rules for a profile (defaults + stored cvGeneration).
 * Exported for tests or admin tooling.
 */
function mergeCvGeneration(profile) {
  const raw =
    profile && typeof profile.cvGeneration === 'object' && profile.cvGeneration !== null
      ? profile.cvGeneration
      : {};

  let summarySentencesMin = clampInt(
    raw.summarySentencesMin,
    1,
    10,
    DEFAULT_CV_GENERATION.summarySentencesMin
  );
  let summarySentencesMax = clampInt(
    raw.summarySentencesMax,
    1,
    10,
    DEFAULT_CV_GENERATION.summarySentencesMax
  );
  if (summarySentencesMin > summarySentencesMax) {
    const t = summarySentencesMin;
    summarySentencesMin = summarySentencesMax;
    summarySentencesMax = t;
  }

  let skillsCategoriesMin = clampInt(
    raw.skillsCategoriesMin,
    1,
    12,
    DEFAULT_CV_GENERATION.skillsCategoriesMin
  );
  let skillsCategoriesMax = clampInt(
    raw.skillsCategoriesMax,
    1,
    12,
    DEFAULT_CV_GENERATION.skillsCategoriesMax
  );
  if (skillsCategoriesMin > skillsCategoriesMax) {
    const t = skillsCategoriesMin;
    skillsCategoriesMin = skillsCategoriesMax;
    skillsCategoriesMax = t;
  }

  let skillsPerCategoryMin = clampInt(
    raw.skillsPerCategoryMin,
    1,
    20,
    DEFAULT_CV_GENERATION.skillsPerCategoryMin
  );
  let skillsPerCategoryMax = clampInt(
    raw.skillsPerCategoryMax,
    1,
    25,
    DEFAULT_CV_GENERATION.skillsPerCategoryMax
  );
  if (skillsPerCategoryMin > skillsPerCategoryMax) {
    const t = skillsPerCategoryMin;
    skillsPerCategoryMin = skillsPerCategoryMax;
    skillsPerCategoryMax = t;
  }
  const skillsMinTotal = clampInt(raw.skillsMinTotal, 5, 80, DEFAULT_CV_GENERATION.skillsMinTotal);

  const rangesRaw = Array.isArray(raw.experienceBulletRanges) ? raw.experienceBulletRanges : [];
  const experienceBulletRanges =
    rangesRaw.length > 0
      ? rangesRaw.map((x) => String(x).trim()).filter(Boolean)
      : [...DEFAULT_CV_GENERATION.experienceBulletRanges];

  const syntheticRoleCount = clampInt(raw.syntheticRoleCount, 1, 3, DEFAULT_CV_GENERATION.syntheticRoleCount);

  const yearsExperienceMention = clampInt(
    raw.yearsExperienceMention,
    0,
    45,
    DEFAULT_CV_GENERATION.yearsExperienceMention
  );

  const preCheckEnabled =
    raw.preCheckEnabled === undefined ? DEFAULT_CV_GENERATION.preCheckEnabled : Boolean(raw.preCheckEnabled);

  const extraInstructions = String(raw.extraInstructions || '').trim();

  const customSystemPrompt = String(raw.customSystemPrompt || '')
    .trim()
    .slice(0, MAX_CUSTOM_SYSTEM_PROMPT);

  return {
    yearsExperienceMention,
    summarySentencesMin,
    summarySentencesMax,
    skillsCategoriesMin,
    skillsCategoriesMax,
    skillsPerCategoryMin,
    skillsPerCategoryMax,
    skillsMinTotal,
    experienceBulletRanges,
    syntheticRoleCount,
    preCheckEnabled,
    extraInstructions,
    customSystemPrompt,
  };
}

function formatExperienceRules(cfg, workCount) {
  const ranges = cfg.experienceBulletRanges.length ? cfg.experienceBulletRanges : ['6-8'];
  if (workCount > 0) {
    const lines = [];
    for (let i = 1; i <= workCount; i++) {
      const r = ranges[Math.min(i - 1, ranges.length - 1)];
      lines.push(`- experience${i} → ${r} bullets (inclusive range or count as stated).`);
    }
    return [
      'If the profile has workExperiences (length > 0):',
      '- Do NOT invent employer names or job titles for those rows. Output ONLY bullet arrays experience1 … experienceN in the same order as profile jobs.',
      '- Bullet counts per slot:',
      ...lines,
      '- Each bullet: about 20–30 words when possible (natural flow), quantified wins where plausible, varied action verbs, mix hard and soft skills naturally. No buzzword dumping.',
    ].join('\n');
  }

  const k = cfg.syntheticRoleCount;
  const synLines = [];
  for (let i = 1; i <= k; i++) {
    const tier = i === 1 ? 'senior-style' : i === 2 ? 'mid-level' : 'junior-style';
    const r = ranges[Math.min(i - 1, ranges.length - 1)];
    synLines.push(
      `- role${i}: ${tier} title only (no employer name inside the role string); experience${i}: ${r} bullets.`
    );
  }
  return [
    'If the profile has ZERO workExperiences:',
    `- Use exactly ${k} synthetic role + bullet block(s) as above.`,
    ...synLines,
    '- You may add optional companyN, dateN strings for narrative consistency; do not contradict the JD.',
  ].join('\n');
}

function buildCvSystemPrompt(profile) {
  const cfg = mergeCvGeneration(profile);
  const workCount = (profile.workExperiences || []).length;

  const preCheckBlock = cfg.preCheckEnabled
    ? `PRE-CHECK (must run first on JOB_DESCRIPTION text):
If the posting clearly mentions ANY of: Onsite / On-site, Hybrid, E-Verify, or Security Clearance — do NOT produce a full CV. Instead return ONLY:
{ "generation_blocked": true, "block_message": "Resume not generated due to job requirements." }

Otherwise set "generation_blocked": false (or omit it) and return the full schema below.`
    : `PRE-CHECK: Disabled for this profile. Never return generation_blocked. Always produce the full CV JSON below.`;

  const summaryYears =
    cfg.yearsExperienceMention > 0
      ? `Mention approximately ${cfg.yearsExperienceMention} years in software development, with emphasis on web and mobile where relevant.`
      : `Do not claim a specific years-of-experience number unless clearly supported by the profile or JD. Emphasize web and mobile where relevant when it fits.`;

  const extra =
    cfg.extraInstructions.length > 0
      ? `\n\n--- PROFILE-SPECIFIC INSTRUCTIONS (highest priority where not contradictory) ---\n${cfg.extraInstructions}\n`
      : '';

  return `You are an expert ATS-optimized technical resume generator. You receive JOB_DESCRIPTION (full posting or brief), an optional job URL for context, and a candidate profile JSON (facts for layout and constraints).

Return exactly ONE JSON object (no markdown, no code fences, no commentary).

---

${preCheckBlock}

---

FULL SCHEMA (when not blocked):
{
  "role_title": "exact job title from the JD",
  "developer_title": "senior-level headline aligned with the JD (under the candidate name)",
  "company_name": "from JD when stated; else infer cautiously from URL; if unknown use Not specified",
  "job_type": "Contract" or "Permanent",
  "remote_status": "Remote" | "Hybrid" | "On-site" | "Unspecified",
  "salary_range": "from JD only; empty string \"\" if not stated",
  "summary": "${cfg.summarySentencesMin}–${cfg.summarySentencesMax} sentences, first person (I). Highlight JD strengths. ${summaryYears} ATS-friendly, clear, not keyword-stuffed.",
  "skills": { "category_snake_case": ["skill", "..."], "...": [] },
  "experiences": { },
  "job_description": "short cleaned summary of the role from the JD; may be empty string",
  "cover_letter": "plain text cover letter body tailored to the JD, candidate profile and experience bullets; no markdown"
}

job_type: use Permanent unless the posting clearly indicates contract / fixed-term / day rate.

remote_status: infer from JOB_DESCRIPTION (Remote / Hybrid / On-site); Unspecified only when unclear.

---

SKILLS:
- At least ${cfg.skillsMinTotal} relevant hard skills/tools total, in ${cfg.skillsCategoriesMin}–${cfg.skillsCategoriesMax} categories.
- Each category: ${cfg.skillsPerCategoryMin}–${cfg.skillsPerCategoryMax} keywords (languages, frameworks, tools, databases, platforms). No soft skills here. No bold markers.

---

EXPERIENCES — follow profile order (first workExperiences entry = experience1, etc.):

${formatExperienceRules(cfg, workCount)}

---

FORMATTING:
- role_title must match the JD title exactly when a single clear title exists.
- developer_title reflects the strongest senior alignment with the JD.
- Natural language; readable for humans and ATS.

Do not invent salary, equity, or employer names not supported by the JD or profile.${extra}`;
}

/**
 * Full system message for CV JSON generation: custom whole prompt, or built template.
 */
function resolveCvSystemPrompt(profile) {
  const cfg = mergeCvGeneration(profile);
  if (cfg.customSystemPrompt.length > 0) {
    return `${cfg.customSystemPrompt}\n\n${CV_JSON_CONTRACT_APPENDIX}`;
  }
  return buildCvSystemPrompt(profile);
}

function profileForPrompt(profile) {
  const o =
    profile && typeof profile.toObject === 'function'
      ? profile.toObject()
      : { ...(profile || {}) };
  delete o.cvGeneration;
  return o;
}

function buildCvUserMessage({ jobDescription, jobLink, profile }) {
  const base = profileForPrompt(profile);
  const profileJson = {
    label: base.label,
    name: base.name,
    workExperiences: base.workExperiences || [],
    education: base.education || [],
    certifications: base.certifications || [],
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

function normalizeExperiences(raw, workCount, syntheticRoleCount) {
  const src = raw && typeof raw.experiences === 'object' && !Array.isArray(raw.experiences) ? raw.experiences : {};
  const experiences = { ...src };
  const kSyn = Math.min(Math.max(Number(syntheticRoleCount) || 3, 1), 3);
  const n = workCount > 0 ? workCount : kSyn;
  if (workCount > 0) {
    for (let i = 1; i <= n; i++) {
      const key = `experience${i}`;
      if (!Array.isArray(experiences[key])) experiences[key] = [];
      else experiences[key] = coerceStringArray(experiences[key]);
    }
  } else {
    for (let i = 1; i <= kSyn; i++) {
      const bulletsKey = `experience${i}`;
      if (!Array.isArray(experiences[bulletsKey])) experiences[bulletsKey] = [];
      else experiences[bulletsKey] = coerceStringArray(experiences[bulletsKey]);
      ['role', 'company', 'date'].forEach((prefix) => {
        const key = `${prefix}${i}`;
        if (experiences[key] != null && !Array.isArray(experiences[key])) experiences[key] = String(experiences[key]).trim();
      });
    }
  }
  return experiences;
}

function normalizePayload(parsed, profile, jobDescriptionText) {
  const workCount = (profile.workExperiences || []).length;
  const gen = mergeCvGeneration(profile);
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

  const experiences = normalizeExperiences(parsed, workCount, gen.syntheticRoleCount);

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
    cover_letter: String(parsed.cover_letter || '').trim(),
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
    system: resolveCvSystemPrompt(profile),
    user: buildCvUserMessage({
      jobDescription: trimmedDesc,
      jobLink: trimmedLink,
      profile,
    }),
    label: 'CV generation',
  });

  if (cvRaw.generation_blocked === true) {
    const msg = String(cvRaw.block_message || '').trim() || 'Resume not generated due to job requirements.';
    throw new Error(msg);
  }

  return normalizePayload(cvRaw, profile, trimmedDesc);
}

module.exports = {
  generateCvJsonWithOpenAI,
  mergeCvGeneration,
  resolveCvSystemPrompt,
  buildCvSystemPrompt,
  CV_JSON_CONTRACT_APPENDIX,
};

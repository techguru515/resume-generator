const OpenAI = require('openai');

function normalizeModelAlias(m) {
  const s = String(m || '').trim();
  if (!s) return '';
  const lower = s.toLowerCase();
  if (lower === 'latest' || lower === 'auto') return '';
  if (lower === 'gpt-5' || lower.startsWith('gpt-5.')) return '';
  return s;
}

function pickPreferredModel(availableIds) {
  const preferred = ['gpt-4.1', 'gpt-4o', 'gpt-4o-mini'];
  if (availableIds && availableIds.size) {
    for (const id of preferred) {
      if (availableIds.has(id)) return id;
    }
    const any = [...availableIds];
    const byPrefix = (p) => any.find((x) => String(x).startsWith(p));
    return byPrefix('gpt-4o') || byPrefix('gpt-4.1') || byPrefix('gpt-4') || 'gpt-4o-mini';
  }
  return 'gpt-4o-mini';
}

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
    return null;
  }
}

function buildSystemPrompt() {
  return `You are a helpful CV + Job Description assistant.

You will receive:
- A saved CV JSON (already generated)
- The full job description text (may be long)
- The user's profile facts used for layout
- The user's question

Rules:
- Be concise and actionable.
- If user asks for edits, propose specific revised text blocks (summary, bullets, skills) that fit the existing CV structure.
- Do not invent employers or dates not present in the profile facts.
- If the job requires onsite/hybrid/security clearance/e-verify, warn the user but still answer the question.
`;
}

function buildUserPayload({ profile, cv, jobDescription, question, history }) {
  const p = profile || {};
  const payload = {
    profile: {
      label: p.label,
      name: p.name,
      email: p.email,
      phone: p.phone,
      location: p.location,
      linkedin: p.linkedin,
      github: p.github,
      website: p.website,
      workExperiences: p.workExperiences || [],
      education: p.education || [],
      certifications: p.certifications || [],
    },
    cv,
    job_description: String(jobDescription || ''),
    history: Array.isArray(history) ? history.slice(-12) : [],
    question: String(question || ''),
  };
  return JSON.stringify(payload, null, 2);
}

async function askCvAssistant({ profile, cv, jobDescription, question, history }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

  const client = new OpenAI({ apiKey });
  const available = await listModelIdsCached(client);
  const auto = pickPreferredModel(available);
  const requestedModel = normalizeModelAlias(process.env.OPENAI_MODEL_ASSISTANT);
  const model =
    (requestedModel && (!available || available.has(requestedModel)) ? requestedModel : '') || auto;

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.25,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      {
        role: 'user',
        content: buildUserPayload({ profile, cv, jobDescription, question, history }),
      },
    ],
  });

  const text = completion.choices?.[0]?.message?.content;
  return String(text || '').trim();
}

module.exports = { askCvAssistant };


import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  listProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  listTemplates,
  listCVs,
  apiPublicUrl,
} from '../api.js';
import { profileRefToIdString } from '../utils/profileRef.js';

const EMPTY_WORK = { company: '', role: '', startDate: '', endDate: '', current: false };
const EMPTY_EDU = { institution: '', degree: '', field: '', startYear: '', endYear: '' };
const EMPTY_CERT = { name: '', issuer: '', year: '' };

function defaultCvGeneration() {
  return {
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
}

const MAX_CUSTOM_SYSTEM_PROMPT = 48000;

function emptyFormState() {
  return {
    label: '', name: '', email: '', phone: '', location: '',
    linkedin: '', github: '', website: '',
    workExperiences: [],
    education: [],
    certifications: [],
    cvFormat: 'classic',
    templateId: '',
    cvSaveFolder: '',
    cvGeneration: defaultCvGeneration(),
  };
}

const CONTACT_FIELDS = [
  { key: 'label', label: 'Profile Label', required: true, placeholder: 'e.g. Backend CV, Full Stack Profile', span: true },
  { key: 'name', label: 'Full Name', required: true, placeholder: 'John Doe' },
  { key: 'email', label: 'Email', required: true, placeholder: 'john@example.com' },
  { key: 'phone', label: 'Phone', placeholder: '+1 555 000 0000' },
  { key: 'location', label: 'Location', placeholder: 'New York, USA' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/johndoe' },
  { key: 'github', label: 'GitHub', placeholder: 'github.com/johndoe' },
  { key: 'website', label: 'Website / Portfolio', placeholder: 'johndoe.dev' },
];

const INPUT_CLS = 'border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent w-full';

function formatWorkDates(w) {
  if (!w) return '';
  if (w.current) {
    const s = String(w.startDate || '').trim();
    return s ? `${s} – Present` : 'Present';
  }
  const s = String(w.startDate || '').trim();
  const e = String(w.endDate || '').trim();
  if (s && e) return `${s} – ${e}`;
  if (s) return s;
  if (e) return e;
  return '';
}

function formatEducationLine(edu) {
  if (!edu) return '';
  const parts = [
    edu.degree,
    edu.field ? `(${edu.field})` : '',
  ].filter(Boolean);
  const head = [edu.institution, parts.join(' ')].filter(Boolean).join(' · ');
  const y1 = String(edu.startYear || '').trim();
  const y2 = String(edu.endYear || '').trim();
  const years = y1 && y2 ? `${y1}–${y2}` : y1 || y2 || '';
  return years ? `${head} · ${years}` : head;
}

function ProfileCareerAndEducation({ profile }) {
  const works = Array.isArray(profile.workExperiences) ? profile.workExperiences : [];
  const edus = Array.isArray(profile.education) ? profile.education : [];
  const cvSave = profile.cvSaveFolder != null ? String(profile.cvSaveFolder).trim() : '';

  return (
    <>
      <div className="mt-3 grid grid-cols-1 gap-4 border-t border-gray-100 pt-3 md:grid-cols-2 md:gap-6">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Career path</p>
          {works.length === 0 ? (
            <p className="text-xs text-gray-400">No work experience yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {works.map((w, i) => (
                <li key={i} className="text-sm">
                  <p className="font-medium text-primary">{w.role || '—'}</p>
                  <p className="text-xs text-gray-600">{w.company || '—'}</p>
                  <p className="text-xs text-gray-400">{formatWorkDates(w) || '—'}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Education</p>
          {edus.length === 0 ? (
            <p className="text-xs text-gray-400">No education yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {edus.map((edu, i) => (
                <li key={i} className="text-sm text-gray-700">
                  <p className="leading-snug">{formatEducationLine(edu)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
        <span className="font-semibold text-gray-600">CV server copies:</span>{' '}
        {cvSave || 'Default (project cv/)'}
      </p>
    </>
  );
}

function InputField({ label, required, placeholder, value, onChange, span }) {
  return (
    <div className={span ? 'md:col-span-2' : ''}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input
        type="text" value={value} onChange={onChange} placeholder={placeholder} required={required}
        className={INPUT_CLS}
      />
    </div>
  );
}

export default function ProfilePage() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [expandedProfileIds, setExpandedProfileIds] = useState(() => new Set());
  const [editTab, setEditTab] = useState('profile'); // 'profile' | 'prompt'
  const [form, setForm] = useState(() => emptyFormState());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [templates, setTemplates] = useState([]);
  const [cvs, setCvs] = useState([]);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => { fetchProfiles(); }, []);
  useEffect(() => { setEditTab('profile'); }, [editing]);
  useEffect(() => {
    listTemplates()
      .then((d) => setTemplates(Array.isArray(d) ? d : []))
      .catch(() => setTemplates([]));
  }, []);

  // Default new profiles to "Classic" when templates load.
  useEffect(() => {
    if (editing !== 'new') return;
    if (form.templateId) return;
    const classic = (templates || []).find((t) => String(t?.name || '').toLowerCase() === 'classic');
    if (classic?._id) setForm((f) => ({ ...f, templateId: String(classic._id) }));
  }, [templates, editing, form.templateId]);
  useEffect(() => {
    listCVs().then((d) => setCvs(Array.isArray(d) ? d : [])).catch(() => setCvs([]));
  }, []);

  function mostRecentCvIdForProfile(profileId) {
    const pid = String(profileId || '');
    let best = null;
    for (const cv of cvs) {
      if (profileRefToIdString(cv?.profileId) !== pid) continue;
      const t = new Date(cv.updatedAt || cv.createdAt || 0).getTime();
      if (!best || t > best.t) best = { id: String(cv._id), t };
    }
    return best?.id || '';
  }

  async function previewSelectedTemplate() {
    const templateId = String(form.templateId || '');
    if (!templateId) {
      setError('Select a PDF template first.');
      return;
    }
    if (!editing || editing === 'new') {
      setError('Save the profile first to preview a template.');
      return;
    }
    const cvId = mostRecentCvIdForProfile(editing);
    if (!cvId) {
      setError('Create at least one CV with this profile first, then preview the template.');
      return;
    }
    setPreviewing(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(apiPublicUrl(`/template/${encodeURIComponent(templateId)}/preview`), {
        params: { cvId },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        responseType: 'text',
      });
      const html = String(res.data || '');
      const w = window.open('', '_blank', 'noopener,noreferrer');
      if (!w) throw new Error('Popup blocked. Allow popups to preview templates.');
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data || err.message || 'Template preview failed');
    } finally {
      setPreviewing(false);
    }
  }

  async function fetchProfiles() {
    setLoading(true);
    try { setProfiles(await listProfiles()); } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  function startNew() { setForm(emptyFormState()); setEditing('new'); setError(''); }

  function startEdit(profile) {
    const cg = profile.cvGeneration && typeof profile.cvGeneration === 'object' ? profile.cvGeneration : {};
    const baseGen = defaultCvGeneration();
    const ranges = Array.isArray(cg.experienceBulletRanges) && cg.experienceBulletRanges.length
      ? cg.experienceBulletRanges.map((x) => String(x).trim()).filter(Boolean)
      : baseGen.experienceBulletRanges;
    setForm({
      label: profile.label || '',
      name: profile.name || '',
      email: profile.email || '',
      phone: profile.phone || '',
      location: profile.location || '',
      linkedin: profile.linkedin || '',
      github: profile.github || '',
      website: profile.website || '',
      workExperiences: profile.workExperiences?.length ? profile.workExperiences : [],
      education: profile.education?.length ? profile.education : [],
      certifications: profile.certifications?.length ? profile.certifications : [],
      cvFormat: profile.cvFormat || 'classic',
      templateId: profile.templateId?._id ? String(profile.templateId._id) : (profile.templateId ? String(profile.templateId) : ''),
      cvSaveFolder: profile.cvSaveFolder != null ? String(profile.cvSaveFolder) : '',
      cvGeneration: {
        ...baseGen,
        ...cg,
        experienceBulletRanges: ranges.length ? ranges : baseGen.experienceBulletRanges,
      },
    });
    setEditing(profile._id);
    setError('');
  }

  function toggleExpanded(profileId) {
    const id = String(profileId || '');
    if (!id) return;
    setExpandedProfileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function cancelEdit() { setEditing(null); setForm(emptyFormState()); setError(''); }

  function updateCvGen(partial) {
    setForm((f) => ({
      ...f,
      cvGeneration: { ...f.cvGeneration, ...partial },
    }));
  }

  function updateBulletRange(index, value) {
    setForm((f) => {
      const list = [...(f.cvGeneration?.experienceBulletRanges || [])];
      list[index] = value;
      return { ...f, cvGeneration: { ...f.cvGeneration, experienceBulletRanges: list } };
    });
  }

  function addBulletRange() {
    setForm((f) => {
      const list = [...(f.cvGeneration?.experienceBulletRanges || []), '6-8'];
      return { ...f, cvGeneration: { ...f.cvGeneration, experienceBulletRanges: list } };
    });
  }

  function removeBulletRange(index) {
    setForm((f) => {
      const list = (f.cvGeneration?.experienceBulletRanges || []).filter((_, i) => i !== index);
      return {
        ...f,
        cvGeneration: {
          ...f.cvGeneration,
          experienceBulletRanges: list.length ? list : ['6-8'],
        },
      };
    });
  }

  // Work experience helpers
  function addWork() { setForm((f) => ({ ...f, workExperiences: [...f.workExperiences, { ...EMPTY_WORK }] })); }
  function removeWork(i) { setForm((f) => ({ ...f, workExperiences: f.workExperiences.filter((_, idx) => idx !== i) })); }
  function updateWork(i, key, val) {
    setForm((f) => {
      const list = [...f.workExperiences];
      list[i] = { ...list[i], [key]: val };
      return { ...f, workExperiences: list };
    });
  }

  // Education helpers
  function addEdu() { setForm((f) => ({ ...f, education: [...f.education, { ...EMPTY_EDU }] })); }
  function removeEdu(i) { setForm((f) => ({ ...f, education: f.education.filter((_, idx) => idx !== i) })); }
  function updateEdu(i, key, val) {
    setForm((f) => { const list = [...f.education]; list[i] = { ...list[i], [key]: val }; return { ...f, education: list }; });
  }

  // Certification helpers
  function addCert() { setForm((f) => ({ ...f, certifications: [...f.certifications, { ...EMPTY_CERT }] })); }
  function removeCert(i) { setForm((f) => ({ ...f, certifications: f.certifications.filter((_, idx) => idx !== i) })); }
  function updateCert(i, key, val) {
    setForm((f) => { const list = [...f.certifications]; list[i] = { ...list[i], [key]: val }; return { ...f, certifications: list }; });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setError('');
    const cg = form.cvGeneration || defaultCvGeneration();
    const ranges = (cg.experienceBulletRanges || []).map((x) => String(x).trim()).filter(Boolean);
    const payload = {
      ...form,
      cvSaveFolder: String(form.cvSaveFolder || '').trim(),
      cvGeneration: {
        ...cg,
        yearsExperienceMention: (() => {
          const y = Number(cg.yearsExperienceMention);
          return Number.isFinite(y) ? Math.max(0, Math.min(45, y)) : 11;
        })(),
        summarySentencesMin: Number(cg.summarySentencesMin),
        summarySentencesMax: Number(cg.summarySentencesMax),
        skillsCategoriesMin: Number(cg.skillsCategoriesMin),
        skillsCategoriesMax: Number(cg.skillsCategoriesMax),
        skillsPerCategoryMin: Number(cg.skillsPerCategoryMin),
        skillsPerCategoryMax: Number(cg.skillsPerCategoryMax),
        skillsMinTotal: Number(cg.skillsMinTotal),
        syntheticRoleCount: Number(cg.syntheticRoleCount),
        experienceBulletRanges: ranges.length ? ranges : defaultCvGeneration().experienceBulletRanges,
        preCheckEnabled: Boolean(cg.preCheckEnabled),
        extraInstructions: String(cg.extraInstructions || '').trim(),
        customSystemPrompt: String(cg.customSystemPrompt || '').trim().slice(0, MAX_CUSTOM_SYSTEM_PROMPT),
      },
    };
    try {
      if (editing === 'new') {
        const created = await createProfile(payload);
        setProfiles((prev) => [...prev, created]);
      } else {
        const updated = await updateProfile(editing, payload);
        setProfiles((prev) => prev.map((p) => (p._id === editing ? updated : p)));
      }
      cancelEdit();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this profile?')) return;
    try {
      await deleteProfile(id);
      setProfiles((prev) => prev.filter((p) => p._id !== id));
      if (editing === id) cancelEdit();
    } catch (err) { alert(err.response?.data?.error || err.message); }
  }

  if (loading) return <p className="text-gray-400">Loading…</p>;

  const renderEditForm = ({ variant }) => {
    if (!editing) return null;
    const wrapperClass = variant === 'inline'
      ? 'rounded-xl border border-gray-200 bg-gray-50/60 p-6 space-y-6'
      : 'bg-white rounded-xl shadow p-6 space-y-6';

    return (
      <div className={wrapperClass}>
        <h3 className="font-bold text-primary">{editing === 'new' ? 'New Profile' : 'Edit Profile'}</h3>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Profile form tabs">
          <button
            type="button"
            role="tab"
            aria-selected={editTab === 'profile'}
            onClick={() => setEditTab('profile')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              editTab === 'profile'
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Profile settings
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={editTab === 'prompt'}
            onClick={() => setEditTab('prompt')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              editTab === 'prompt'
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Prompt settings
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {editTab === 'profile' && (
            <div className="space-y-6" role="tabpanel">
              {/* Contact info */}
              <div>
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Contact Info</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {CONTACT_FIELDS.map(({ key, label, required, placeholder, span }) => (
                    <InputField key={key} label={label} required={required} placeholder={placeholder} span={span}
                      value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
                  ))}
                </div>
              </div>

              {/* Work Experience */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Work Experience</h4>
                  <button type="button" onClick={addWork} className="text-xs text-accent hover:underline">+ Add</button>
                </div>
                <div className="space-y-3">
                  {form.workExperiences.map((w, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input type="text" placeholder="Company *" required value={w.company}
                          onChange={(e) => updateWork(i, 'company', e.target.value)} className={INPUT_CLS} />
                        <input type="text" placeholder="Job Title / Role *" required value={w.role}
                          onChange={(e) => updateWork(i, 'role', e.target.value)} className={INPUT_CLS} />
                        <input type="text" placeholder="Start Date (e.g. Jan 2020)" value={w.startDate}
                          onChange={(e) => updateWork(i, 'startDate', e.target.value)} className={INPUT_CLS} />
                        <div className="flex items-center gap-2">
                          <input type="text" placeholder="End Date" value={w.current ? '' : w.endDate}
                            disabled={w.current}
                            onChange={(e) => updateWork(i, 'endDate', e.target.value)}
                            className={`${INPUT_CLS} ${w.current ? 'bg-gray-50 text-gray-400' : ''}`} />
                          <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap cursor-pointer">
                            <input type="checkbox" checked={w.current}
                              onChange={(e) => updateWork(i, 'current', e.target.checked)}
                              className="accent-accent" />
                            Current
                          </label>
                        </div>
                      </div>
                      <button type="button" onClick={() => removeWork(i)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                    </div>
                  ))}
                  {form.workExperiences.length === 0 && (
                    <p className="text-xs text-gray-400 italic">No work experience entries yet.</p>
                  )}
                </div>
              </div>

              {/* Education */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Education</h4>
                  <button type="button" onClick={addEdu} className="text-xs text-accent hover:underline">+ Add</button>
                </div>
                <div className="space-y-3">
                  {form.education.map((edu, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input type="text" placeholder="Institution *" required value={edu.institution}
                          onChange={(e) => updateEdu(i, 'institution', e.target.value)} className={INPUT_CLS} />
                        <input type="text" placeholder="Degree *" required value={edu.degree}
                          onChange={(e) => updateEdu(i, 'degree', e.target.value)} className={INPUT_CLS} />
                        <input type="text" placeholder="Field of Study" value={edu.field}
                          onChange={(e) => updateEdu(i, 'field', e.target.value)} className={INPUT_CLS} />
                        <div className="flex gap-2">
                          <input type="text" placeholder="Start Year" value={edu.startYear}
                            onChange={(e) => updateEdu(i, 'startYear', e.target.value)}
                            className="w-1/2 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
                          <input type="text" placeholder="End Year" value={edu.endYear}
                            onChange={(e) => updateEdu(i, 'endYear', e.target.value)}
                            className="w-1/2 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
                        </div>
                      </div>
                      <button type="button" onClick={() => removeEdu(i)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                    </div>
                  ))}
                  {form.education.length === 0 && <p className="text-xs text-gray-400 italic">No education entries yet.</p>}
                </div>
              </div>

              {/* Certifications */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Certifications</h4>
                  <button type="button" onClick={addCert} className="text-xs text-accent hover:underline">+ Add</button>
                </div>
                <div className="space-y-3">
                  {form.certifications.map((cert, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <input type="text" placeholder="Certification Name *" required value={cert.name}
                          onChange={(e) => updateCert(i, 'name', e.target.value)}
                          className="md:col-span-3 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
                        <input type="text" placeholder="Issuer (e.g. AWS, Google)" value={cert.issuer}
                          onChange={(e) => updateCert(i, 'issuer', e.target.value)}
                          className="md:col-span-2 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
                        <input type="text" placeholder="Year" value={cert.year}
                          onChange={(e) => updateCert(i, 'year', e.target.value)}
                          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
                      </div>
                      <button type="button" onClick={() => removeCert(i)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                    </div>
                  ))}
                  {form.certifications.length === 0 && <p className="text-xs text-gray-400 italic">No certifications yet.</p>}
                </div>
              </div>

              {/* Server-side CV copies (per profile) */}
              <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 space-y-2">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">CV copies on server</h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  When you download a CV (PDF or DOCX), the backend saves an extra copy on the machine running the API.
                  Leave this empty to use the default project <code className="rounded bg-white/90 px-1 text-[11px]">cv/</code> folder.
                  You can set an <strong>absolute</strong> folder (e.g. Windows:{' '}
                  <code className="rounded bg-white/90 px-1 text-[11px]">D:\Data\CVs\Backend</code>)
                  or a path <strong>relative to the project root</strong> (must not use <code className="text-[11px]">..</code> to leave the project).
                  Hosted environments (e.g. Railway) often have an ephemeral filesystem unless you attach persistent storage.
                </p>
                <label htmlFor="cvSaveFolder" className="block text-xs font-semibold text-gray-700">
                  Save folder path
                </label>
                <input
                  id="cvSaveFolder"
                  type="text"
                  value={form.cvSaveFolder ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, cvSaveFolder: e.target.value }))}
                  placeholder="Empty = default cv/ next to project root"
                  autoComplete="off"
                  spellCheck={false}
                  className={INPUT_CLS}
                />
              </div>
            </div>
          )}

          {editTab === 'prompt' && (
            <div className="space-y-6" role="tabpanel">
              {/* CV generation (per profile → OpenAI prompt) */}
              <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-4 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">CV generation</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Controls the OpenAI <strong>system</strong> message for <strong className="text-gray-700">Create CV</strong> and workspace bulk generate. The candidate profile (without these settings) is still sent in the user message.
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white/80 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Resume template</label>
                      <p className="text-[11px] text-gray-500">
                        Select one format for downloads (PDF/DOCX).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={previewSelectedTemplate}
                      disabled={previewing}
                      className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      title="Preview selected template (requires at least one CV created with this profile)"
                    >
                      {previewing ? 'Previewing…' : 'Preview'}
                    </button>
                  </div>
                  <select
                    value={form.templateId || ''}
                    onChange={(e) => setForm((f) => ({ ...f, templateId: e.target.value }))}
                    className={INPUT_CLS}
                  >
                    {templates.map((t) => (
                      <option key={t._id} value={String(t._id)}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white/90 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-gray-700">Custom system prompt (full replacement)</label>
                    <button
                      type="button"
                      onClick={() => updateCvGen({ customSystemPrompt: '' })}
                      className="text-xs text-gray-500 hover:text-gray-800 underline"
                    >
                      Clear — use built-in template
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Paste your entire instructions here (tone, ATS rules, pre-checks, section rules, etc.). When this field is not empty, it <strong>replaces</strong> the built-in template below. The server always appends a short &quot;JSON contract&quot; block so the app can parse and save the CV.
                  </p>
                  <textarea
                    rows={14}
                    maxLength={MAX_CUSTOM_SYSTEM_PROMPT}
                    value={form.cvGeneration?.customSystemPrompt ?? ''}
                    onChange={(e) => updateCvGen({ customSystemPrompt: e.target.value })}
                    placeholder="Paste your full system prompt (e.g. from instruction.txt). Leave empty to use the built-in template + numeric options."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-accent resize-y min-h-[200px]"
                  />
                  <p className="text-[11px] text-gray-400 text-right">
                    {(form.cvGeneration?.customSystemPrompt || '').length} / {MAX_CUSTOM_SYSTEM_PROMPT}
                  </p>
                  {(form.cvGeneration?.customSystemPrompt || '').trim().length > 0 && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5">
                      Custom prompt is active — the built-in template and numeric options are ignored until you clear the text above.
                    </p>
                  )}
                </div>

                <details className="rounded-lg border border-gray-200 bg-white/60 open:pb-3">
                  <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 rounded-lg">
                    Built-in template &amp; numeric options (only when custom prompt is empty)
                  </summary>
                  <div className="px-3 pt-2 space-y-4 border-t border-gray-100">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <label className="text-xs text-gray-600 col-span-2 md:col-span-1">
                    Years in summary (0 = omit)
                    <input
                      type="number" min={0} max={45}
                      value={form.cvGeneration?.yearsExperienceMention ?? 11}
                      onChange={(e) => updateCvGen({ yearsExperienceMention: Number(e.target.value) })}
                      className={`mt-1 ${INPUT_CLS}`}
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Summary sentences (min)
                    <input
                      type="number" min={1} max={10}
                      value={form.cvGeneration?.summarySentencesMin ?? 3}
                      onChange={(e) => updateCvGen({ summarySentencesMin: Number(e.target.value) })}
                      className={`mt-1 ${INPUT_CLS}`}
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Summary sentences (max)
                    <input
                      type="number" min={1} max={10}
                      value={form.cvGeneration?.summarySentencesMax ?? 4}
                      onChange={(e) => updateCvGen({ summarySentencesMax: Number(e.target.value) })}
                      className={`mt-1 ${INPUT_CLS}`}
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Skill categories (min–max)
                    <div className="mt-1 flex gap-2">
                      <input
                        type="number" min={1} max={12}
                        value={form.cvGeneration?.skillsCategoriesMin ?? 4}
                        onChange={(e) => updateCvGen({ skillsCategoriesMin: Number(e.target.value) })}
                        className={`w-1/2 ${INPUT_CLS}`}
                      />
                      <input
                        type="number" min={1} max={12}
                        value={form.cvGeneration?.skillsCategoriesMax ?? 6}
                        onChange={(e) => updateCvGen({ skillsCategoriesMax: Number(e.target.value) })}
                        className={`w-1/2 ${INPUT_CLS}`}
                      />
                    </div>
                  </label>
                  <label className="text-xs text-gray-600">
                    Skills / category (min–max)
                    <div className="mt-1 flex gap-2">
                      <input
                        type="number" min={1} max={25}
                        value={form.cvGeneration?.skillsPerCategoryMin ?? 8}
                        onChange={(e) => updateCvGen({ skillsPerCategoryMin: Number(e.target.value) })}
                        className={`w-1/2 ${INPUT_CLS}`}
                      />
                      <input
                        type="number" min={1} max={25}
                        value={form.cvGeneration?.skillsPerCategoryMax ?? 10}
                        onChange={(e) => updateCvGen({ skillsPerCategoryMax: Number(e.target.value) })}
                        className={`w-1/2 ${INPUT_CLS}`}
                      />
                    </div>
                  </label>
                  <label className="text-xs text-gray-600 col-span-2 md:col-span-1">
                    Min. skills total
                    <input
                      type="number" min={5} max={80}
                      value={form.cvGeneration?.skillsMinTotal ?? 30}
                      onChange={(e) => updateCvGen({ skillsMinTotal: Number(e.target.value) })}
                      className={`mt-1 ${INPUT_CLS}`}
                    />
                  </label>
                  <label className="text-xs text-gray-600 col-span-2 md:col-span-1">
                    Synthetic roles (no jobs on profile)
                    <select
                      value={form.cvGeneration?.syntheticRoleCount ?? 3}
                      onChange={(e) => updateCvGen({ syntheticRoleCount: Number(e.target.value) })}
                      className={`mt-1 ${INPUT_CLS}`}
                    >
                      <option value={1}>1 role block</option>
                      <option value={2}>2 role blocks</option>
                      <option value={3}>3 role blocks</option>
                    </select>
                  </label>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-600">Experience bullet ranges (job 1, job 2, …; last repeats)</span>
                    <button type="button" onClick={addBulletRange} className="text-xs text-accent hover:underline">+ Add row</button>
                  </div>
                  <div className="space-y-2">
                    {(form.cvGeneration?.experienceBulletRanges || []).map((r, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <span className="text-[11px] text-gray-400 w-16 shrink-0">Slot {i + 1}</span>
                        <input
                          type="text"
                          value={r}
                          onChange={(e) => updateBulletRange(i, e.target.value)}
                          placeholder="e.g. 12-15"
                          className={INPUT_CLS}
                        />
                        <button type="button" onClick={() => removeBulletRange(i)} className="text-xs text-red-400 shrink-0 px-2">Remove</button>
                      </div>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.cvGeneration?.preCheckEnabled !== false}
                    onChange={(e) => updateCvGen({ preCheckEnabled: e.target.checked })}
                    className="accent-accent rounded"
                  />
                  Enable JD pre-check (block when posting mentions on-site, hybrid, E-Verify, or security clearance)
                </label>

                <label className="block text-xs text-gray-600">
                  Extra instructions for the model (optional)
                  <textarea
                    rows={3}
                    value={form.cvGeneration?.extraInstructions || ''}
                    onChange={(e) => updateCvGen({ extraInstructions: e.target.value })}
                    placeholder="e.g. Prefer UK spelling; emphasize leadership; cap bullets at 8 per job…"
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-y"
                  />
                </label>
                  </div>
                </details>
              </div>
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="bg-accent text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition">
              {saving ? 'Saving…' : editing === 'new' ? 'Create Profile' : 'Save Changes'}
            </button>
            <button type="button" onClick={cancelEdit} className="text-gray-500 px-4 py-2 rounded-lg border hover:bg-gray-50 transition">
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-primary">My Profiles</h2>
        {!editing && (
          <button onClick={startNew} className="bg-accent text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium">
            + New Profile
          </button>
        )}
      </div>

      {!editing && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-gray-700">
          <p className="font-semibold text-primary mb-2">CV generation (Create CV) — how this profile is used</p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs leading-relaxed text-gray-600">
            <li>
              <span className="font-medium text-gray-700">Contact block</span> — name, email, phone, location, LinkedIn, GitHub, and website from this profile appear on the CV header.
            </li>
            <li>
              <span className="font-medium text-gray-700">Work experience</span> — each row supplies company, title, and dates. OpenAI fills <code className="rounded bg-white/80 px-1 text-[11px] text-primary">experience1</code>…<code className="rounded bg-white/80 px-1 text-[11px] text-primary">experienceN</code> in the same order. Bullet targets per slot are <span className="font-medium text-gray-700">configurable</span> under <em>Edit profile → CV generation</em> (defaults: 12–15, 10–12, 6–8, then the last range repeats).
            </li>
            <li>
              <span className="font-medium text-gray-700">No jobs on profile</span> — the model uses synthetic roles; how many (1–3) and bullet ranges follow your per-profile CV generation settings.
            </li>
            <li>
              <span className="font-medium text-gray-700">Education &amp; certifications</span> — copied from this profile into the CV as written (not rewritten by AI).
            </li>
            <li>
              <span className="font-medium text-gray-700">Generated JSON fields</span> — besides bullets, the model returns{' '}
              <code className="rounded bg-white/80 px-1 text-[11px]">role_title</code>,{' '}
              <code className="rounded bg-white/80 px-1 text-[11px]">developer_title</code>,{' '}
              <code className="rounded bg-white/80 px-1 text-[11px]">company_name</code>,{' '}
              <code className="rounded bg-white/80 px-1 text-[11px]">job_type</code>,{' '}
              <code className="rounded bg-white/80 px-1 text-[11px]">remote_status</code>,{' '}
              <code className="rounded bg-white/80 px-1 text-[11px]">salary_range</code>,{' '}
              <code className="rounded bg-white/80 px-1 text-[11px]">summary</code>,{' '}
              <code className="rounded bg-white/80 px-1 text-[11px]">skills</code> (category count and minimum totals are configurable per profile), and{' '}
              <code className="rounded bg-white/80 px-1 text-[11px]">job_description</code> (short JD summary).
            </li>
            <li>
              <span className="font-medium text-gray-700">Pre-check</span> — optional per profile: when enabled, postings that mention on-site, hybrid, E-Verify, or security clearance can block generation (see <code className="rounded bg-white/80 px-1 text-[11px]">instruction.txt</code>).
            </li>
            <li>
              <span className="font-medium text-gray-700">Full custom prompt</span> — under <em>Edit profile → CV generation</em> you can paste a complete OpenAI <strong>system</strong> message. When it is non-empty it replaces the built-in template; the server still appends a short JSON contract so saves and previews keep working.
            </li>
          </ul>
          <p className="mt-3 text-xs text-gray-500">
            Use <a className="text-accent underline font-medium" href="/create">Create CV</a> with a profile selected to run generation.
          </p>
        </div>
      )}

      {/* Profile list */}
      {profiles.length === 0 && !editing && (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
          <p className="mb-3">No profiles yet.</p>
          <button onClick={startNew} className="text-accent hover:underline text-sm">Create your first profile</button>
        </div>
      )}

      {profiles.length > 0 && (
        <div className="grid gap-3">
          {profiles.map((p) => (
            <div key={p._id} className={`rounded-xl bg-white p-4 shadow ${editing === p._id ? 'ring-2 ring-accent' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-primary">{p.label}</p>
                  <p className="text-sm text-gray-600">{p.name} · {p.email}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{[p.phone, p.location].filter(Boolean).join(' · ')}</p>
                  {p.certifications?.length > 0 && (
                    <p className="mt-0.5 text-xs text-gray-400">
                      {p.certifications.length} certification{p.certifications.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(p._id)}
                    className="rounded-lg border border-gray-200 px-3 py-1 text-xs text-gray-600 transition hover:bg-gray-50"
                    aria-expanded={expandedProfileIds.has(String(p._id))}
                    aria-controls={`profile-details-${p._id}`}
                  >
                    {expandedProfileIds.has(String(p._id)) ? 'Hide details' : 'Details'}
                  </button>
                  <button type="button" onClick={() => startEdit(p)} className="rounded-lg border border-accent px-3 py-1 text-xs text-accent transition hover:bg-blue-50">Edit</button>
                  <button type="button" onClick={() => handleDelete(p._id)} className="rounded-lg border border-red-200 px-3 py-1 text-xs text-red-400 transition hover:bg-red-50">Delete</button>
                </div>
              </div>
              {expandedProfileIds.has(String(p._id)) && (
                <div id={`profile-details-${p._id}`}>
                  <ProfileCareerAndEducation profile={p} />
                </div>
              )}
              {editing === p._id && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  {renderEditForm({ variant: 'inline' })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit form */}
      {editing === 'new' && renderEditForm({ variant: 'card' })}
    </div>
  );
}

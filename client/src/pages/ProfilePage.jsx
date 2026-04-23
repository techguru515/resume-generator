import { useState, useEffect } from 'react';
import { listProfiles, createProfile, updateProfile, deleteProfile } from '../api.js';

const EMPTY_WORK = { company: '', role: '', startDate: '', endDate: '', current: false };
const EMPTY_EDU = { institution: '', degree: '', field: '', startYear: '', endYear: '' };
const EMPTY_CERT = { name: '', issuer: '', year: '' };
const EMPTY_FORM = {
  label: '', name: '', email: '', phone: '', location: '',
  linkedin: '', github: '', website: '',
  workExperiences: [],
  education: [],
  certifications: [],
};

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
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchProfiles(); }, []);

  async function fetchProfiles() {
    setLoading(true);
    try { setProfiles(await listProfiles()); } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  function startNew() { setForm(EMPTY_FORM); setEditing('new'); setError(''); }

  function startEdit(profile) {
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
    });
    setEditing(profile._id);
    setError('');
  }

  function cancelEdit() { setEditing(null); setForm(EMPTY_FORM); setError(''); }

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
    try {
      if (editing === 'new') {
        const created = await createProfile(form);
        setProfiles((prev) => [...prev, created]);
      } else {
        const updated = await updateProfile(editing, form);
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

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-primary">My Profiles</h2>
        {!editing && (
          <button onClick={startNew} className="bg-accent text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium">
            + New Profile
          </button>
        )}
      </div>

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
            <div key={p._id} className={`bg-white rounded-xl shadow p-4 flex items-start justify-between gap-4 ${editing === p._id ? 'ring-2 ring-accent' : ''}`}>
              <div>
                <p className="font-semibold text-primary">{p.label}</p>
                <p className="text-sm text-gray-600">{p.name} · {p.email}</p>
                <p className="text-xs text-gray-400 mt-0.5">{[p.phone, p.location].filter(Boolean).join(' · ')}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {[
                    p.workExperiences?.length ? `${p.workExperiences.length} job(s)` : '',
                    p.education?.length ? `${p.education.length} education` : '',
                    p.certifications?.length ? `${p.certifications.length} cert(s)` : '',
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => startEdit(p)} className="text-xs text-accent border border-accent px-3 py-1 rounded-lg hover:bg-blue-50 transition">Edit</button>
                <button onClick={() => handleDelete(p._id)} className="text-xs text-red-400 border border-red-200 px-3 py-1 rounded-lg hover:bg-red-50 transition">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit form */}
      {editing && (
        <div className="bg-white rounded-xl shadow p-6 space-y-6">
          <h3 className="font-bold text-primary">{editing === 'new' ? 'New Profile' : 'Edit Profile'}</h3>
          <form onSubmit={handleSubmit} className="space-y-6">

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
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveCV, listCVs, deleteCV, updateCVStatus, listProfiles } from '../api.js';
import CVPreview from '../components/CVPreview.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const PLACEHOLDER = JSON.stringify(
  {
    role_title: 'Senior Backend Engineer',
    developer_title: 'Senior Backend Engineer (GenAI Platform)',
    company_name: 'OLX',
    job_type: 'Permanent',
    salary_range: '',
    summary: '...',
    skills: { programming_languages: ['Python', 'Go'] },
    experiences: {
      role1: 'Senior Backend Engineer', experience1: ['...'],
      role2: 'Backend Engineer', experience2: ['...'],
      role3: 'Junior Backend Developer', experience3: ['...'],
    },
  },
  null, 2
);

const STATUS_CONFIG = {
  saved:     { label: 'Saved',     color: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400' },
  applied:   { label: 'Applied',   color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
  interview: { label: 'Interview', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  offer:     { label: 'Offer',     color: 'bg-green-100 text-green-700',  dot: 'bg-green-500' },
  rejected:  { label: 'Rejected',  color: 'bg-red-100 text-red-500',      dot: 'bg-red-400' },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG);

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.saved;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// New CV form shown as a modal-like panel
function NewCVForm({ profiles, onSave, onCancel }) {
  const [jsonInput, setJsonInput] = useState('');
  const [jobLink, setJobLink] = useState('');
  const [parseError, setParseError] = useState('');
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState(profiles[0]?._id || '');
  const [selectedProfile, setSelectedProfile] = useState(profiles[0] || null);

  function handleParse(e) {
    e.preventDefault();
    setParseError('');
    try { setPreview(JSON.parse(jsonInput)); }
    catch (err) { setParseError('Invalid JSON: ' + err.message); }
  }

  async function handleSave() {
    if (!preview || !selectedProfileId) return;
    setSaving(true);
    try {
      await saveCV({ ...preview, profileId: selectedProfileId, job_link: jobLink });
      onSave();
    } catch (err) {
      setParseError(err.response?.data?.error || err.message);
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-primary">New CV</h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-sm">✕ Cancel</button>
      </div>

      {/* Job link */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Job Link <span className="text-gray-400 font-normal">(paste the job posting URL)</span>
        </label>
        <input
          type="url"
          value={jobLink}
          onChange={(e) => setJobLink(e.target.value)}
          placeholder="https://linkedin.com/jobs/..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      {/* Profile selector */}
      {profiles.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Use Profile</label>
          <select
            value={selectedProfileId}
            onChange={(e) => {
              setSelectedProfileId(e.target.value);
              setSelectedProfile(profiles.find((p) => p._id === e.target.value) || null);
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {profiles.map((p) => (
              <option key={p._id} value={p._id}>{p.label} — {p.name}</option>
            ))}
          </select>
        </div>
      )}
      {profiles.length === 0 && (
        <p className="text-yellow-600 text-sm">No profiles yet. <a href="/profile" className="underline">Create one</a> first.</p>
      )}

      {/* JSON input */}
      <form onSubmit={handleParse} className="space-y-3">
        <textarea
          value={jsonInput}
          onChange={(e) => { setJsonInput(e.target.value); setParseError(''); setPreview(null); }}
          placeholder={PLACEHOLDER}
          rows={10}
          spellCheck={false}
          className="w-full border border-gray-300 rounded-lg p-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-accent resize-y"
        />
        {parseError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{parseError}</div>
        )}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!jsonInput.trim()}
            className="bg-accent text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition text-sm"
          >
            Preview
          </button>
          {preview && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !selectedProfileId}
              className="bg-green-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition text-sm"
            >
              {saving ? 'Saving…' : 'Save CV'}
            </button>
          )}
        </div>
      </form>

      {/* Preview */}
      {preview && (
        <div className="border-t pt-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">Full Preview</p>
          <CVPreview cvData={preview} profile={selectedProfile} />
        </div>
      )}
    </div>
  );
}

// Profile card with its own CV list and stats
function ProfileCard({ profile, cvs, onStatusChange, onDelete, onNavigate }) {
  const [collapsed, setCollapsed] = useState(false);

  const counts = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = cvs.filter((c) => (c.application_status || 'saved') === s).length;
    return acc;
  }, {});

  const contactParts = [profile.phone, profile.location, profile.linkedin].filter(Boolean);

  return (
    <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
      {/* Profile header */}
      <div
        className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-gray-50 transition"
        onClick={() => setCollapsed((v) => !v)}
      >
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-primary">{profile.label}</h3>
            <span className="text-xs text-gray-400 border border-gray-200 rounded-full px-2 py-0.5">{cvs.length} CV{cvs.length !== 1 ? 's' : ''}</span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{profile.name} · {profile.email}</p>
          {contactParts.length > 0 && (
            <p className="text-xs text-gray-400">{contactParts.join(' · ')}</p>
          )}
        </div>
        {/* Mini stats */}
        <div className="flex items-center gap-3">
          {ALL_STATUSES.filter((s) => counts[s] > 0).map((s) => {
            const cfg = STATUS_CONFIG[s];
            return (
              <span key={s} className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                {counts[s]} {cfg.label}
              </span>
            );
          })}
          <span className="text-gray-300 text-sm ml-2">{collapsed ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* CV list */}
      {!collapsed && (
        <div className="border-t divide-y">
          {cvs.length === 0 ? (
            <p className="px-6 py-4 text-sm text-gray-400 italic">No CVs saved with this profile yet.</p>
          ) : cvs.map((cv) => (
            <div
              key={cv._id}
              onClick={() => onNavigate(cv._id)}
              className="flex items-center gap-4 px-6 py-3 cursor-pointer hover:bg-gray-50 transition"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-primary text-sm">{cv.role_title}</p>
                  <StatusBadge status={cv.application_status || 'saved'} />
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {cv.company_name} · {cv.job_type}
                  {cv.salary_range ? ` · ${cv.salary_range}` : ''}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-gray-400">
                    {new Date(cv.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                  {cv.job_link && (
                    <a
                      href={cv.job_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-accent hover:underline"
                    >
                      View Posting ↗
                    </a>
                  )}
                </div>
              </div>

              {/* Status dropdown */}
              <select
                value={cv.application_status || 'saved'}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => { e.stopPropagation(); onStatusChange(cv._id, e.target.value); }}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent shrink-0"
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                ))}
              </select>

              <button
                onClick={(e) => { e.stopPropagation(); onDelete(cv._id); }}
                className="text-xs text-red-400 hover:text-red-600 border border-red-200 px-2 py-1.5 rounded-lg transition shrink-0"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profiles, setProfiles] = useState([]);
  const [cvList, setCvList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (user?.isApproved || user?.role === 'admin') {
      Promise.all([listProfiles(), listCVs()])
        .then(([p, c]) => { setProfiles(p); setCvList(c); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  // Pending approval wall
  if (!user?.isApproved && user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-5xl mb-4">⏳</div>
        <h2 className="text-xl font-bold text-primary mb-2">Pending Approval</h2>
        <p className="text-gray-500 max-w-sm">
          Your account has been created. An admin needs to approve it before you can generate and download CVs.
        </p>
      </div>
    );
  }

  async function handleStatusChange(cvId, status) {
    try {
      const updated = await updateCVStatus(cvId, status);
      setCvList((prev) => prev.map((c) => c._id === cvId ? { ...c, application_status: updated.application_status } : c));
    } catch (err) { alert(err.response?.data?.error || err.message); }
  }

  async function handleDelete(cvId) {
    if (!confirm('Delete this CV?')) return;
    try {
      await deleteCV(cvId);
      setCvList((prev) => prev.filter((c) => c._id !== cvId));
    } catch (err) { alert(err.response?.data?.error || err.message); }
  }

  async function handleSaved() {
    setShowForm(false);
    const [p, c] = await Promise.all([listProfiles(), listCVs()]);
    setProfiles(p); setCvList(c);
  }

  // Overall stats
  const totalStats = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = cvList.filter((c) => (c.application_status || 'saved') === s).length;
    return acc;
  }, {});

  // Group CVs by profileId — also show unmatched under "No profile"
  const profileMap = Object.fromEntries(profiles.map((p) => [p._id, []]));
  const unmatched = [];
  cvList.forEach((cv) => {
    const pid = cv.profileId?.toString?.() || cv.profileId;
    if (pid && profileMap[pid]) profileMap[pid].push(cv);
    else unmatched.push(cv);
  });

  if (loading) return <p className="text-gray-400">Loading…</p>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Overall stats */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
        {ALL_STATUSES.map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <div key={s} className={`rounded-xl p-3 shadow-sm ${cfg.color}`}>
              <p className="text-2xl font-bold">{totalStats[s]}</p>
              <p className="text-xs font-medium mt-0.5">{cfg.label}</p>
            </div>
          );
        })}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-primary">My Dashboard</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-accent text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
        >
          {showForm ? '✕ Cancel' : '+ New CV'}
        </button>
      </div>

      {/* New CV form */}
      {showForm && (
        <NewCVForm
          profiles={profiles}
          onSave={handleSaved}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Profile cards */}
      {profiles.length === 0 && !showForm ? (
        <div className="bg-white rounded-2xl shadow p-10 text-center text-gray-400">
          <p className="mb-2 text-sm">No profiles yet.</p>
          <a href="/profile" className="text-accent hover:underline text-sm">Create your first profile →</a>
        </div>
      ) : (
        <div className="space-y-4">
          {profiles.map((p) => (
            <ProfileCard
              key={p._id}
              profile={p}
              cvs={profileMap[p._id] || []}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              onNavigate={(cvId) => navigate(`/cv/${cvId}`)}
            />
          ))}
          {/* CVs with no/deleted profile */}
          {unmatched.length > 0 && (
            <ProfileCard
              profile={{ _id: '__none', label: 'No Profile', name: '—', email: '—' }}
              cvs={unmatched}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              onNavigate={(cvId) => navigate(`/cv/${cvId}`)}
            />
          )}
        </div>
      )}
    </div>
  );
}

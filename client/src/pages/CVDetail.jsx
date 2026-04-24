import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getCV, deleteCV, getProfileById, updateCVStatus } from '../api.js';
import { profileRefToIdString } from '../utils/profileRef.js';
import CVPreview from '../components/CVPreview.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const STATUS_CONFIG = {
  saved:     { label: 'Saved',     bg: 'bg-gray-100',    text: 'text-gray-600',    dot: 'bg-gray-400',    border: 'border-gray-300' },
  applied:   { label: 'Applied',   bg: 'bg-blue-50',     text: 'text-blue-700',    dot: 'bg-blue-500',    border: 'border-blue-300' },
  interview: { label: 'Interview', bg: 'bg-yellow-50',   text: 'text-yellow-700',  dot: 'bg-yellow-500',  border: 'border-yellow-300' },
  offer:     { label: 'Offer',     bg: 'bg-green-50',    text: 'text-green-700',   dot: 'bg-green-500',   border: 'border-green-300' },
  rejected:  { label: 'Rejected',  bg: 'bg-red-50',      text: 'text-red-600',     dot: 'bg-red-400',     border: 'border-red-300' },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG);

const REMOTE_STATUS_LABELS = {
  Remote: 'Remote',
  Hybrid: 'Hybrid',
  'On-site': 'On-site',
  Unspecified: 'Not specified',
};

async function downloadFile(url, filename) {
  const token = localStorage.getItem('token');
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'blob',
  });
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

function InfoCard({ label, value, highlight }) {
  if (!value) return null;
  return (
    <div className="bg-gray-50 rounded-lg px-4 py-3">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? 'text-accent' : 'text-primary'}`}>{value}</p>
    </div>
  );
}

export default function CVDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [cv, setCv] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    getCV(id)
      .then((data) => {
        setCv(data);
        const pid = profileRefToIdString(data.profileId);
        if (pid) getProfileById(pid).then(setProfile).catch(() => {});
      })
      .catch((err) => setError(err.response?.data?.error || err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDownload(type) {
    setDownloading(type);
    try {
      const ext = type === 'docx' ? 'docx' : 'pdf';
      const filename = `CV_${cv.company_name}_${cv.role_title}.${ext}`.replace(/[^a-z0-9_.]/gi, '_');
      await downloadFile(`/api/cv/${id}/download/${type}`, filename);
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setDownloading('');
    }
  }

  async function handleStatusChange(status) {
    setUpdatingStatus(true);
    try {
      const updated = await updateCVStatus(id, status);
      setCv((prev) => ({ ...prev, application_status: updated.application_status }));
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this CV?')) return;
    try {
      await deleteCV(id);
      navigate(isAdmin ? '/admin' : '/');
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  }

  if (loading) return <p className="text-gray-400 p-4">Loading…</p>;
  if (error)   return <p className="text-red-500 p-4">{error}</p>;
  if (!cv)     return null;

  const status = cv.application_status || 'saved';
  const cfg = STATUS_CONFIG[status];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate(isAdmin ? '/admin/cvs' : '/')}
          className="text-sm text-gray-500 hover:text-primary flex items-center gap-1"
        >
          ← Back
        </button>
        <div className="flex flex-wrap gap-2">
          {!isAdmin && (
            <>
              <button
                onClick={() => handleDownload('docx')}
                disabled={!!downloading}
                className="bg-accent text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium"
              >
                {downloading === 'docx' ? 'Downloading…' : 'Download DOCX'}
              </button>
              <button
                onClick={() => handleDownload('pdf')}
                disabled={!!downloading}
                className="bg-primary text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-900 disabled:opacity-50 transition font-medium"
              >
                {downloading === 'pdf' ? 'Downloading…' : 'Download PDF'}
              </button>
              <button
                onClick={handleDelete}
                className="text-sm text-red-500 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 transition"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Job Info Dashboard Card */}
      <div className={`rounded-2xl shadow border ${cfg.border} ${cfg.bg} p-6 space-y-5`}>
        {/* Title row */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary leading-tight">{cv.role_title}</h1>
            <p className="text-sm text-gray-500 mt-1">{cv.developer_title}</p>
          </div>
          {/* Status badge + changer */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <InfoCard label="Company"      value={cv.company_name} />
          <InfoCard label="Job Type"     value={cv.job_type} />
          <InfoCard
            label="Work mode"
            value={REMOTE_STATUS_LABELS[cv.remote_status] || REMOTE_STATUS_LABELS.Unspecified}
          />
          <InfoCard label="Salary Range" value={cv.salary_range || 'Not specified'} />
          <InfoCard label="Applied On"   value={new Date(cv.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} />
        </div>

        {/* Profile used */}
        {profile && (
          <div className="bg-white rounded-lg px-4 py-3 border border-gray-100">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Profile Used</p>
            <p className="text-sm font-semibold text-primary">{profile.label}</p>
            <p className="text-xs text-gray-500">{profile.name} · {profile.email}{profile.phone ? ` · ${profile.phone}` : ''}</p>
          </div>
        )}

        {/* Job link */}
        {cv.job_link && (
          <div className="bg-white rounded-lg px-4 py-3 border border-gray-100">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Job Posting</p>
            <a
              href={cv.job_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-accent hover:underline break-all"
            >
              {cv.job_link} ↗
            </a>
          </div>
        )}

        {/* Status pipeline */}
        {!isAdmin && (
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Update Status</p>
            <div className="flex flex-wrap gap-2">
              {ALL_STATUSES.map((s) => {
                const c = STATUS_CONFIG[s];
                const active = status === s;
                return (
                  <button
                    key={s}
                    disabled={updatingStatus}
                    onClick={() => handleStatusChange(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                      active
                        ? `${c.bg} ${c.text} ${c.border} shadow-sm`
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                    } disabled:opacity-50`}
                  >
                    {active && <span className="mr-1">✓</span>}{c.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Full CV Preview */}
      <div className="bg-white rounded-2xl shadow p-8">
        <h2 className="text-base font-bold text-primary mb-6 border-b pb-3">CV Preview</h2>
        <CVPreview cvData={cv} profile={profile} />
      </div>

      {/* Job Description */}
      {cv.job_description && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="font-bold text-primary mb-3">Job Description</h2>
          <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">{cv.job_description}</pre>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listCVs, deleteCV, updateCVStatus, listProfiles } from '../api.js';
import { profileRefToIdString } from '../utils/profileRef.js';
import { useAuth } from '../context/AuthContext.jsx';

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
                  {[
                    cv.company_name,
                    cv.job_type,
                    cv.remote_status && cv.remote_status !== 'Unspecified' ? cv.remote_status : null,
                    cv.salary_range || null,
                  ].filter(Boolean).join(' · ')}
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
      const sid = String(cvId);
      setCvList((prev) =>
        prev.map((c) => (String(c._id) === sid ? { ...c, application_status: updated.application_status } : c))
      );
    } catch (err) { alert(err.response?.data?.error || err.message); }
  }

  async function handleDelete(cvId) {
    if (!confirm('Delete this CV?')) return;
    try {
      await deleteCV(cvId);
      setCvList((prev) => prev.filter((c) => c._id !== cvId));
    } catch (err) { alert(err.response?.data?.error || err.message); }
  }

  // Overall stats
  const totalStats = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = cvList.filter((c) => (c.application_status || 'saved') === s).length;
    return acc;
  }, {});

  // Group CVs by profileId — also show unmatched under "No profile"
  const profileMap = Object.fromEntries(profiles.map((p) => [String(p._id), []]));
  const unmatched = [];
  cvList.forEach((cv) => {
    const pid = profileRefToIdString(cv.profileId);
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
          type="button"
          onClick={() => navigate('/create')}
          className="bg-accent text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
        >
          + New CV
        </button>
      </div>

      {/* Profile cards */}
      {profiles.length === 0 ? (
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
              cvs={profileMap[String(p._id)] || []}
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

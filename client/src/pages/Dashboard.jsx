import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listCVs, deleteCV, updateCVStatus, listProfiles } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const STATUS_CONFIG = {
  saved:     { label: 'Saved',     color: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400' },
  applied:   { label: 'Applied',   color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
  interview: { label: 'Interview', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  offer:     { label: 'Offer',     color: 'bg-green-100 text-green-700',  dot: 'bg-green-500' },
  rejected:  { label: 'Rejected',  color: 'bg-red-100 text-red-500',      dot: 'bg-red-400' },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG);
const PAGE_SIZE = 5;

const CHART_COLORS = {
  saved: '#9ca3af', applied: '#3b82f6', interview: '#f59e0b', offer: '#22c55e', rejected: '#ef4444',
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.saved;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function Pagination({ page, total, pageSize, onChange }) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-1 pt-2">
      <button
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition"
      >
        ‹ Prev
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-2.5 py-1 text-xs rounded border transition ${
            p === page ? 'bg-accent text-white border-accent' : 'border-gray-200 hover:bg-gray-50'
          }`}
        >
          {p}
        </button>
      ))}
      <button
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition"
      >
        Next ›
      </button>
    </div>
  );
}

function ProfileCard({ profile, cvs, onStatusChange, onDelete, navigate }) {
  const [collapsed, setCollapsed] = useState(false);
  const [page, setPage] = useState(1);

  const counts = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = cvs.filter((c) => (c.application_status || 'saved') === s).length;
    return acc;
  }, {});

  const paginated = cvs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-start justify-between px-6 py-4 cursor-pointer hover:bg-gray-50 transition"
        onClick={() => setCollapsed((v) => !v)}
      >
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-primary">{profile.label}</h3>
            <span className="text-xs text-gray-400 border border-gray-200 rounded-full px-2 py-0.5">
              {cvs.length} CV{cvs.length !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{profile.name} · {profile.email}</p>
          {[profile.phone, profile.location].filter(Boolean).length > 0 && (
            <p className="text-xs text-gray-400">{[profile.phone, profile.location].filter(Boolean).join(' · ')}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {ALL_STATUSES.filter((s) => counts[s] > 0).map((s) => (
            <span key={s} className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[s].color}`}>
              {counts[s]} {STATUS_CONFIG[s].label}
            </span>
          ))}
          <span className="text-gray-300 ml-1">{collapsed ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* CV rows */}
      {!collapsed && (
        <div className="border-t">
          {cvs.length === 0 ? (
            <p className="px-6 py-4 text-sm text-gray-400 italic">No CVs saved with this profile yet.</p>
          ) : (
            <>
              <div className="divide-y">
                {paginated.map((cv) => (
                  <div
                    key={cv._id}
                    onClick={() => navigate(`/cv/${cv._id}`)}
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
              <div className="px-6 pb-3">
                <Pagination page={page} total={cvs.length} pageSize={PAGE_SIZE} onChange={setPage} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [cvList, setCvList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.isApproved && user?.role !== 'admin') { setLoading(false); return; }
    Promise.all([listProfiles(), listCVs()])
      .then(([p, c]) => { setProfiles(p); setCvList(c); })
      .finally(() => setLoading(false));
  }, [user]);

  if (!user?.isApproved && user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-5xl mb-4">⏳</div>
        <h2 className="text-xl font-bold text-primary mb-2">Pending Approval</h2>
        <p className="text-gray-500 max-w-sm">An admin needs to approve your account before you can use the dashboard.</p>
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

  // Overall stats
  const totalStats = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = cvList.filter((c) => (c.application_status || 'saved') === s).length;
    return acc;
  }, {});

  // Group CVs by profileId
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

      {/* Stats */}
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

      <h2 className="text-xl font-bold text-primary">My Dashboard</h2>

      {/* Status donut chart */}
      {cvList.length > 0 && (() => {
        const pieData = ALL_STATUSES
          .map((s) => ({ name: STATUS_CONFIG[s].label, value: totalStats[s], key: s }))
          .filter((d) => d.value > 0);

        return (
          <div className="bg-white rounded-2xl shadow p-5 flex flex-col sm:flex-row items-center gap-6">
            <div className="shrink-0">
              <p className="text-sm font-bold text-primary mb-0.5">Application Status</p>
              <p className="text-xs text-gray-400 mb-3">Your pipeline at a glance.</p>
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.key} fill={CHART_COLORS[entry.key]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    formatter={(value, name) => [`${value} CV${value !== 1 ? 's' : ''}`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend + stats */}
            <div className="flex-1 grid grid-cols-1 gap-2 w-full">
              {ALL_STATUSES.map((s) => {
                const count = totalStats[s];
                const pct = cvList.length > 0 ? Math.round((count / cvList.length) * 100) : 0;
                return (
                  <div key={s} className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[s] }} />
                    <span className="text-sm text-gray-600 w-20">{STATUS_CONFIG[s].label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: CHART_COLORS[s] }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-primary w-6 text-right">{count}</span>
                  </div>
                );
              })}
              <p className="text-xs text-gray-400 mt-1">{cvList.length} total application{cvList.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        );
      })()}

      {/* Profile cards */}
      {profiles.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-10 text-center text-gray-400">
          <p className="text-sm mb-2">No profiles yet.</p>
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
              navigate={navigate}
            />
          ))}
          {unmatched.length > 0 && (
            <ProfileCard
              profile={{ _id: '__none', label: 'No Profile', name: '—', email: '—' }}
              cvs={unmatched}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              navigate={navigate}
            />
          )}
        </div>
      )}
    </div>
  );
}

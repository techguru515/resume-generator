import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { adminStats, adminListCVs } from '../api.js';

const STATUS_CONFIG = {
  saved:     { label: 'Saved',     color: 'bg-gray-100 text-gray-600',     chart: '#9ca3af' },
  applied:   { label: 'Applied',   color: 'bg-blue-100 text-blue-700',     chart: '#3b82f6' },
  interview: { label: 'Interview', color: 'bg-yellow-100 text-yellow-700', chart: '#f59e0b' },
  offer:     { label: 'Offer',     color: 'bg-green-100 text-green-700',   chart: '#22c55e' },
  rejected:  { label: 'Rejected',  color: 'bg-red-100 text-red-500',       chart: '#ef4444' },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG);

function buildChartData(cvs) {
  const map = {};
  cvs.forEach((cv) => {
    const date = new Date(cv.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!map[date]) map[date] = { date, saved: 0, applied: 0, interview: 0, offer: 0, rejected: 0 };
    const s = cv.application_status || 'saved';
    map[date][s] = (map[date][s] || 0) + 1;
  });
  return Object.values(map).sort((a, b) => new Date(a.date) - new Date(b.date));
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [cvs, setCvs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([adminStats(), adminListCVs()])
      .then(([s, c]) => { setStats(s); setCvs(c); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-400">Loading…</p>;

  const chartData = buildChartData(cvs);

  // Status breakdown totals
  const statusTotals = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = cvs.filter((c) => (c.application_status || 'saved') === s).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-primary">Dashboard</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Clients', value: stats?.totalClients   ?? 0, color: 'bg-blue-50 text-blue-700' },
          { label: 'Approved',      value: stats?.approvedClients ?? 0, color: 'bg-green-50 text-green-700' },
          { label: 'Pending',       value: stats?.pendingClients  ?? 0, color: 'bg-yellow-50 text-yellow-700' },
          { label: 'Total CVs',     value: stats?.totalCVs        ?? 0, color: 'bg-purple-50 text-purple-700' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-xl p-4 shadow-sm ${color}`}>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm font-medium mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Application status breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {ALL_STATUSES.map((s) => (
          <div key={s} className={`rounded-xl p-4 shadow-sm ${STATUS_CONFIG[s].color}`}>
            <p className="text-2xl font-bold">{statusTotals[s]}</p>
            <p className="text-sm font-medium mt-1">{STATUS_CONFIG[s].label}</p>
          </div>
        ))}
      </div>

      {/* Activity chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-bold text-primary mb-1">Application Activity</h3>
          <p className="text-xs text-gray-400 mb-4">CV submission trends over time by status.</p>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                {ALL_STATUSES.map((s) => (
                  <linearGradient key={s} id={`grad-${s}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={STATUS_CONFIG[s].chart} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={STATUS_CONFIG[s].chart} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                cursor={{ stroke: '#e5e7eb' }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              {ALL_STATUSES.map((s) => (
                <Area
                  key={s}
                  type="monotone"
                  dataKey={s}
                  name={STATUS_CONFIG[s].label}
                  stroke={STATUS_CONFIG[s].chart}
                  strokeWidth={2}
                  fill={`url(#grad-${s})`}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {chartData.length === 0 && (
        <div className="bg-white rounded-xl shadow p-10 text-center text-gray-400">
          <p className="text-sm">No CV activity yet.</p>
        </div>
      )}
    </div>
  );
}

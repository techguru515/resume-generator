import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminListCVs } from '../api.js';
import Pagination from '../components/Pagination.jsx';

const STATUS_CONFIG = {
  saved:     { label: 'Saved',     color: 'bg-gray-100 text-gray-600' },
  applied:   { label: 'Applied',   color: 'bg-blue-100 text-blue-700' },
  interview: { label: 'Interview', color: 'bg-yellow-100 text-yellow-700' },
  offer:     { label: 'Offer',     color: 'bg-green-100 text-green-700' },
  rejected:  { label: 'Rejected',  color: 'bg-red-100 text-red-500' },
};

const PAGE_SIZE = 10;

export default function AdminCVs() {
  const [cvs, setCvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    adminListCVs().then(setCvs).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-400">Loading…</p>;

  const filtered = cvs.filter((cv) => {
    const q = search.toLowerCase();
    const matchSearch = !q || cv.role_title?.toLowerCase().includes(q) || cv.company_name?.toLowerCase().includes(q) || cv.userId?.name?.toLowerCase().includes(q);
    const matchStatus = !filterStatus || (cv.application_status || 'saved') === filterStatus;
    return matchSearch && matchStatus;
  });

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-primary">All CVs</h2>
        <span className="text-sm text-gray-400">{cvs.length} CV{cvs.length !== 1 ? 's' : ''} total</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search role, company, client…"
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent w-64"
        />
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow">
        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b text-xs uppercase tracking-wide">
                  <th className="pb-2 font-medium pr-4">Role</th>
                  <th className="pb-2 font-medium pr-4">Company</th>
                  <th className="pb-2 font-medium pr-4">Client</th>
                  <th className="pb-2 font-medium pr-4">Job Type</th>
                  <th className="pb-2 font-medium pr-4">App. Status</th>
                  <th className="pb-2 font-medium pr-4">Job Link</th>
                  <th className="pb-2 font-medium pr-4">Date</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paged.length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center text-gray-400">No CVs found.</td></tr>
                )}
                {paged.map((cv) => {
                  const appCfg = STATUS_CONFIG[cv.application_status || 'saved'];
                  return (
                    <tr key={cv._id} className="hover:bg-gray-50">
                      <td className="py-2.5 pr-4 font-medium text-primary max-w-[180px] truncate">{cv.role_title}</td>
                      <td className="py-2.5 pr-4 text-gray-600">{cv.company_name}</td>
                      <td className="py-2.5 pr-4 text-xs">
                        <p className="font-medium text-gray-700">{cv.userId?.name || '—'}</p>
                        <p className="text-gray-400">{cv.userId?.email}</p>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          cv.job_type === 'Permanent' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {cv.job_type}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${appCfg.color}`}>
                          {appCfg.label}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-xs">
                        {cv.job_link ? (
                          <a href={cv.job_link} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                            View ↗
                          </a>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(cv.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-2.5">
                        <button
                          onClick={() => navigate(`/cv/${cv._id}`)}
                          className="text-xs text-accent hover:underline font-medium"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} showSummary />
        </div>
      </div>
    </div>
  );
}

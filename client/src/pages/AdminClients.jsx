import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminListUsers, adminToggleApprove } from '../api.js';

const PAGE_SIZE = 10;

function Pagination({ page, total, pageSize, onChange }) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-3 border-t mt-2">
      <p className="text-xs text-gray-400">
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </p>
      <div className="flex items-center gap-1">
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
    </div>
  );
}

export default function AdminClients() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    adminListUsers().then(setUsers).finally(() => setLoading(false));
  }, []);

  async function handleToggle(userId) {
    const result = await adminToggleApprove(userId);
    setUsers((prev) => prev.map((u) => u._id === userId ? { ...u, isApproved: result.isApproved } : u));
  }

  if (loading) return <p className="text-gray-400">Loading…</p>;

  const paged = users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-primary">Clients</h2>
        <span className="text-sm text-gray-400">{users.length} client{users.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="bg-white rounded-xl shadow">
        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b text-xs uppercase tracking-wide">
                  <th className="pb-2 font-medium pr-4">Name</th>
                  <th className="pb-2 font-medium pr-4">Email</th>
                  <th className="pb-2 font-medium pr-4">CVs</th>
                  <th className="pb-2 font-medium pr-4">Joined</th>
                  <th className="pb-2 font-medium pr-4">Status</th>
                  <th className="pb-2 font-medium pr-4">Action</th>
                  <th className="pb-2 font-medium">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paged.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-gray-400">No clients yet.</td></tr>
                )}
                {paged.map((u) => (
                  <tr key={u._id} className="hover:bg-gray-50">
                    <td className="py-2.5 pr-4 font-medium text-primary">{u.name}</td>
                    <td className="py-2.5 pr-4 text-gray-600 text-xs">{u.email}</td>
                    <td className="py-2.5 pr-4 text-gray-600">{u.cvCount}</td>
                    <td className="py-2.5 pr-4 text-gray-500 text-xs">
                      {new Date(u.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.isApproved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {u.isApproved ? 'Approved' : 'Pending'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <button
                        onClick={() => handleToggle(u._id)}
                        className={`text-xs px-3 py-1 rounded-lg border transition font-medium ${
                          u.isApproved
                            ? 'border-red-200 text-red-500 hover:bg-red-50'
                            : 'border-green-200 text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {u.isApproved ? 'Revoke' : 'Approve'}
                      </button>
                    </td>
                    <td className="py-2.5">
                      <button
                        onClick={() => navigate(`/admin/progress?client=${u._id}`)}
                        className="text-xs text-accent hover:underline font-medium"
                      >
                        View Progress →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={users.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      </div>
    </div>
  );
}

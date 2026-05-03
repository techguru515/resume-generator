import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const CHART_COLORS = {
  saved: '#9ca3af',
  applied: '#3b82f6',
  interview: '#f59e0b',
  offer: '#22c55e',
  failed: '#f43f5e',
};

/**
 * Lazy-loaded so the main dashboard chunk does not include recharts.
 */
export default function DashboardStatusChart({ allStatuses, statusConfig, totalStats, cvListLength }) {
  const pieData = allStatuses
    .map((s) => ({ name: statusConfig[s].label, value: totalStats[s], key: s }))
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

      <div className="flex-1 grid grid-cols-1 gap-2 w-full">
        {allStatuses.map((s) => {
          const count = totalStats[s];
          const pct = cvListLength > 0 ? Math.round((count / cvListLength) * 100) : 0;
          return (
            <div key={s} className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[s] }} />
              <span className="text-sm text-gray-600 w-20">{statusConfig[s].label}</span>
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
        <p className="text-xs text-gray-400 mt-1">
          {cvListLength} total application{cvListLength !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}

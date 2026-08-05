import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';

// Reserved status colors (never used for anything but state) and the fixed
// categorical order -- see the dataviz skill's palette.md. Same hexes already
// used elsewhere in the app (RemindersPage, etc.) for consistency.
const COLOR = {
  good: '#0ca30c',
  warning: '#fab219',
  critical: '#d03b3b',
  muted: '#898781',
  info: '#2a78d6',
};

const CATEGORICAL = ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7', '#e34948', '#e87ba4', '#eb6834'];

const BUCKET_PILL = {
  overdue: 'bg-red-50 text-red-700',
  due: 'bg-orange-50 text-orange-700',
  '7_days': 'bg-amber-50 text-amber-700',
  '14_days': 'bg-yellow-50 text-yellow-700',
  '30_days': 'bg-blue-50 text-blue-700',
};

function StatTile({ label, value, accent }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-1">
        {accent && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accent }} />}
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function HeroStat({ label, value, accent, footnote }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 flex-1">
      <div className="text-xs text-slate-500 mb-2">{label}</div>
      <div className="text-3xl font-semibold" style={{ color: accent }}>
        {value}
      </div>
      {footnote && <div className="text-xs text-slate-500 mt-2">{footnote}</div>}
    </div>
  );
}

// Area chart over the real next-6-months calibration-due distribution
// (summary.monthlySchedule) -- not a fabricated trend line, the same numbers
// behind the "Due within 30 days" / "Overdue" stats, just bucketed by month.
function ScheduleChart({ data }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const width = 600;
  const height = 200;
  const padding = { top: 16, right: 8, bottom: 24, left: 26 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const maxCount = Math.max(0, ...data.map((d) => d.count));
  const yMax = Math.max(5, Math.ceil((maxCount || 1) / 5) * 5);
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    ...d,
    x: padding.left + i * stepX,
    y: padding.top + innerH - (d.count / yMax) * innerH,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const baseline = padding.top + innerH;
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${baseline} L ${points[0].x.toFixed(1)} ${baseline} Z`;

  const activeIdx = hoverIdx ?? 0;
  const active = points[activeIdx];
  const ticks = [0, yMax / 2, yMax];

  function handleMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(ratio * (data.length - 1));
    setHoverIdx(Math.min(data.length - 1, Math.max(0, idx)));
  }

  return (
    <div className="relative w-full" style={{ aspectRatio: '3 / 1' }} onMouseMove={handleMove} onMouseLeave={() => setHoverIdx(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        {ticks.map((t) => {
          const y = padding.top + innerH - (t / yMax) * innerH;
          return (
            <g key={t}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e1e0d9" strokeWidth="1" />
              <text x={padding.left - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#898781">
                {t}
              </text>
            </g>
          );
        })}
        <path d={areaPath} fill={COLOR.info} opacity="0.1" stroke="none" />
        <path d={linePath} fill="none" stroke={COLOR.info} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hoverIdx !== null && (
          <line x1={active.x} x2={active.x} y1={padding.top} y2={baseline} stroke="#c3c2b7" strokeWidth="1" strokeDasharray="3 3" />
        )}
        {points.map((p, i) => (
          <g key={p.month}>
            <circle cx={p.x} cy={p.y} r={i === activeIdx ? 5 : 3} fill={COLOR.info} stroke="#fff" strokeWidth="2" />
            <text x={p.x} y={height - 6} textAnchor="middle" fontSize="10" fill="#898781">
              {p.month}
            </text>
          </g>
        ))}
      </svg>
      {hoverIdx !== null && active && (
        <div
          className="absolute bg-slate-900 text-white text-xs rounded-md px-2.5 py-1.5 pointer-events-none shadow-lg whitespace-nowrap z-10"
          style={{
            left: `${(activeIdx / Math.max(1, data.length - 1)) * 100}%`,
            top: `${(active.y / height) * 100}%`,
            transform: 'translate(-50%, calc(-100% - 10px))',
          }}
        >
          <span className="font-semibold">{active.count}</span> due in {active.month}
        </div>
      )}
    </div>
  );
}

function CategoryCard({ category, count, total, color }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate text-slate-700" title={category}>
            {category}
          </span>
          <span className="text-slate-500 tabular-nums shrink-0">{count}</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      </div>
    </div>
  );
}

function QueueTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-slate-500 text-left">
          <tr>
            <th className="py-1 pr-2">Equipment</th>
            <th className="py-1 pr-2">Serial</th>
            <th className="py-1 pr-2">Next due</th>
            <th className="py-1 pr-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.equipment_id} className="border-t border-slate-100">
              <td className="py-1.5 pr-2">
                <Link to={`/equipment/${r.equipment_id}`} className="font-medium hover:underline">
                  {r.name}
                </Link>{' '}
                <span className="text-slate-400">— {r.model}</span>
              </td>
              <td className="py-1.5 pr-2 text-slate-600">{r.serial_number}</td>
              <td className="py-1.5 pr-2 text-slate-600">{String(r.next_calibration_date).slice(0, 10)}</td>
              <td className="py-1.5 pr-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${BUCKET_PILL[r.bucket] || ''}`}>
                  {r.days_until_due < 0
                    ? `${Math.abs(r.days_until_due)}d overdue`
                    : r.days_until_due === 0
                      ? 'Due today'
                      : `${r.days_until_due}d left`}
                </span>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-center text-slate-400">
                Nothing due within 30 days
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('soonest');

  useEffect(() => {
    client
      .get('/api/dashboard/summary')
      .then(({ data }) => setSummary(data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load dashboard'));
  }, []);

  if (error) return <div className="text-red-700">{error}</div>;
  if (!summary) return <div className="text-slate-400">Loading…</div>;

  const statusCount = (status) => summary.byStatus.find((s) => s.status === status)?.count || 0;

  const queue = [...summary.overdue, ...summary.dueSoon];
  const sortedQueue = [...queue].sort((a, b) =>
    sortBy === 'name' ? a.name.localeCompare(b.name) : a.days_until_due - b.days_until_due
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Equipment overview and calibration monitoring.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="flex flex-col gap-4">
          <HeroStat
            label="Total equipment"
            value={summary.totalEquipment}
            accent={COLOR.info}
            footnote={`${statusCount('active')} available now`}
          />
          <HeroStat
            label="Overdue"
            value={summary.overdueCount}
            accent={COLOR.critical}
            footnote={summary.overdue[0] ? `Oldest: ${Math.abs(summary.overdue[0].days_until_due)}d overdue` : 'Nothing overdue'}
          />
        </div>
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Calibration schedule</h2>
            <span className="text-xs text-slate-400">Next 6 months</span>
          </div>
          <ScheduleChart data={summary.monthlySchedule} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Available" value={statusCount('active')} accent={COLOR.good} />
        <StatTile label="Under maintenance" value={statusCount('under_maintenance')} accent={COLOR.warning} />
        <StatTile label="Sent for calibration" value={statusCount('sent_for_calibration')} accent={COLOR.info} />
        <StatTile label="Decommissioned" value={statusCount('decommissioned')} accent={COLOR.muted} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Calibration queue ({queue.length})</h2>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs border border-slate-200 rounded-md px-2 py-1 text-slate-600"
            >
              <option value="soonest">Sort: Soonest first</option>
              <option value="name">Sort: Name</option>
            </select>
          </div>
          <QueueTable rows={sortedQueue} />
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold mb-3">By category</h2>
          <div className="space-y-3">
            {summary.byCategory.map((c, i) => (
              <CategoryCard
                key={c.category}
                category={c.category}
                count={c.count}
                total={summary.totalEquipment}
                color={CATEGORICAL[i % CATEGORICAL.length]}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

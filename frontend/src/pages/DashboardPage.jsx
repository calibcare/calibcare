import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ArrowUpRightIcon,
  FilterIcon,
  AlertTriangleIcon,
  LayersIcon,
  CheckCircleIcon,
  SendIcon,
} from '../components/icons';

// Fallback row count for the Calibration Queue before it has been
// measured; after that, rows-per-page is fitted to the card's real height
// (see the ResizeObserver in DashboardPage) so the card is always full.
const PAGE_SIZE = 6;
const QUEUE_ROW_FALLBACK_PX = 47;
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function KpiCard({ label, value, Icon, iconColor, iconBg, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl p-[18px] flex flex-col gap-3"
      style={{ border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow, cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[9px] flex items-center justify-center" style={{ backgroundColor: iconBg, color: iconColor }}>
            <Icon color={iconColor} />
          </div>
          <span className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: '#7a8296' }}>
            {label}
          </span>
        </div>
        <ArrowUpRightIcon color="#c7cbd8" />
      </div>
      <div className="text-[27px] font-bold leading-none" style={{ color: theme.ink }}>
        {value}
      </div>
    </div>
  );
}

function Donut({ segments, total }) {
  // Real, mutually-exclusive breakdown so the ring's arcs actually sum to
  // 100% of `total` -- see the comment where these are computed below for
  // why "available" excludes overdue equipment rather than mirroring the
  // raw equipment.status column.
  let offset = 0;
  const r = 15.5;
  const circumference = 100; // pathLength=100 lets stroke-dasharray be a plain percentage
  return (
    <div className="relative w-[110px] h-[110px] shrink-0">
      <svg width="110" height="110" viewBox="0 0 36 36">
        <g transform="rotate(-90 18 18)">
          <circle cx="18" cy="18" r={r} fill="none" stroke="#e7e9f0" strokeWidth="5" />
          {segments.map((s) => {
            const pct = total ? (s.value / total) * circumference : 0;
            const el = (
              <circle
                key={s.key}
                cx="18"
                cy="18"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="5"
                pathLength={circumference}
                strokeDasharray={`${pct} ${circumference - pct}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
              />
            );
            offset += pct;
            return el;
          })}
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[19px] font-bold leading-none" style={{ color: theme.ink }}>
          {total}
        </span>
        <span className="text-[9.5px] mt-0.5" style={{ color: theme.textFaint }}>
          total
        </span>
      </div>
    </div>
  );
}

function DatePill({ dateStr }) {
  const d = new Date(dateStr);
  const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return (
    <span className="text-[11.5px] font-bold rounded-full px-2.5 py-1" style={{ color: theme.warning, backgroundColor: theme.warningBg }}>
      {label}
    </span>
  );
}

function StatusBadge({ bucket }) {
  const isOverdue = bucket === 'overdue';
  return (
    <span
      className="text-[11.5px] font-bold rounded-full px-[11px] py-1 inline-block"
      style={{
        color: isOverdue ? theme.criticalStrong : theme.warning,
        backgroundColor: isOverdue ? theme.criticalBgStrong : theme.warningBg,
      }}
    >
      {isOverdue ? 'Overdue' : 'Due Soon'}
    </span>
  );
}

function formatDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function CalendarCard({ dueDates }) {
  const { user } = useAuth();
  const canManage = Boolean(user?.can_edit);

  const [viewedMonth, setViewedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [notes, setNotes] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteError, setNoteError] = useState('');
  const [saving, setSaving] = useState(false);
  const today = new Date();
  const isCurrentMonth = viewedMonth.getFullYear() === today.getFullYear() && viewedMonth.getMonth() === today.getMonth();

  useEffect(() => {
    client
      .get('/api/calendar-notes')
      .then(({ data }) => {
        const map = {};
        for (const row of data) map[row.note_date] = row.note_text;
        setNotes(map);
      })
      .catch(() => {}); // non-critical widget data -- the calendar still works without notes
  }, []);

  // Marks any day that has a queue-eligible calibration date on record --
  // whether that date is still ahead (due soon) or already past (overdue),
  // both are real dates pulled from calibration_history, not estimates.
  const dueDaysInMonth = useMemo(() => {
    const set = new Set();
    for (const item of dueDates) {
      const d = new Date(item.next_calibration_date);
      if (d.getFullYear() === viewedMonth.getFullYear() && d.getMonth() === viewedMonth.getMonth()) {
        set.add(d.getDate());
      }
    }
    return set;
  }, [dueDates, viewedMonth]);

  const year = viewedMonth.getFullYear();
  const month = viewedMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const monthLabel = viewedMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  function shiftMonth(delta) {
    setViewedMonth(new Date(year, month + delta, 1));
  }

  function handleDayClick(day) {
    const dateKey = formatDateKey(year, month, day);
    const existing = notes[dateKey];
    if (!canManage && !existing) return; // nothing to show a read-only role for an empty day
    setSelectedDate(dateKey);
    setNoteDraft(existing || '');
    setNoteError('');
  }

  async function handleSaveNote() {
    setSaving(true);
    setNoteError('');
    try {
      await client.put(`/api/calendar-notes/${selectedDate}`, { note_text: noteDraft });
      setNotes((prev) => ({ ...prev, [selectedDate]: noteDraft.trim() }));
      setSelectedDate(null);
    } catch (err) {
      setNoteError(err.response?.data?.error || 'Failed to save note');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteNote() {
    setSaving(true);
    setNoteError('');
    try {
      await client.delete(`/api/calendar-notes/${selectedDate}`);
      setNotes((prev) => {
        const next = { ...prev };
        delete next[selectedDate];
        return next;
      });
      setSelectedDate(null);
    } catch (err) {
      setNoteError(err.response?.data?.error || 'Failed to delete note');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-[18px]" style={{ border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold" style={{ color: theme.ink }}>
          {monthLabel}
        </span>
        <div className="flex gap-1.5">
          <button
            onClick={() => shiftMonth(-1)}
            className="w-[22px] h-[22px] rounded-[7px] flex items-center justify-center"
            style={{ border: `1px solid ${theme.borderStrong}`, color: theme.textFaint }}
          >
            <ChevronLeftIcon color={theme.textFaint} />
          </button>
          <button
            onClick={() => shiftMonth(1)}
            className="w-[22px] h-[22px] rounded-[7px] flex items-center justify-center"
            style={{ border: `1px solid ${theme.borderStrong}`, color: theme.textFaint }}
          >
            <ChevronRightIcon color={theme.textFaint} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-[3px] mb-1.5">
        {WEEKDAY_LABELS.map((d, i) => (
          <span key={i} className="text-center text-[10.5px] font-bold" style={{ color: theme.textFainter }}>
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-[3px]" style={{ gridAutoRows: '24px' }}>
        {cells.map((day, i) => {
          if (day === null) return <span key={i} />;
          const isDue = dueDaysInMonth.has(day);
          const isToday = isCurrentMonth && day === today.getDate();
          const hasNote = Boolean(notes[formatDateKey(year, month, day)]);
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleDayClick(day)}
              className="relative flex items-center justify-center text-[11.5px] rounded-[7px]"
              style={{
                fontWeight: isDue || isToday ? 700 : 400,
                color: isDue ? theme.warning : isToday ? theme.brand : '#38415a',
                backgroundColor: isDue ? theme.warningBg : 'transparent',
                boxShadow: isToday ? `inset 0 0 0 1.5px ${theme.brand}` : 'none',
                border: 'none',
                padding: 0,
                fontFamily: 'inherit',
                cursor: canManage || hasNote ? 'pointer' : 'default',
              }}
            >
              {day}
              {hasNote && (
                <span
                  className="absolute bottom-[2px] w-[4px] h-[4px] rounded-full"
                  style={{ backgroundColor: theme.brand }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: `1px solid ${theme.divider}` }}>
        <span className="flex items-center gap-1.5 text-[11px]" style={{ color: '#7a8296' }}>
          <span className="w-[9px] h-[9px] rounded-[3px] inline-block" style={{ backgroundColor: theme.warningBg, border: `1px solid ${theme.warningBorderSoft}` }} />
          Calibration due
        </span>
        <span className="flex items-center gap-1.5 text-[11px]" style={{ color: '#7a8296' }}>
          <span className="w-[9px] h-[9px] rounded-[3px] inline-block" style={{ border: `1.5px solid ${theme.brand}` }} />
          Today
        </span>
        <span className="flex items-center gap-1.5 text-[11px]" style={{ color: '#7a8296' }}>
          <span className="w-[6px] h-[6px] rounded-full inline-block" style={{ backgroundColor: theme.brand }} />
          Has note
        </span>
      </div>

      {selectedDate && (
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${theme.divider}` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-bold" style={{ color: theme.ink }}>
              {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <button type="button" onClick={() => setSelectedDate(null)} className="text-[11px]" style={{ color: theme.textFaint, border: 'none', background: 'none' }}>
              Close
            </button>
          </div>
          {canManage ? (
            <>
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={2}
                placeholder="Add a note for this day…"
                className="w-full rounded-[8px] text-[12px] p-2 resize-none"
                style={{ border: `1px solid ${theme.borderStrong}`, color: theme.ink }}
              />
              {noteError && (
                <div className="text-[11px] mt-1" style={{ color: theme.critical }}>
                  {noteError}
                </div>
              )}
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={saving || !noteDraft.trim()}
                  className="text-[11.5px] font-bold rounded-[8px] px-3 py-1.5"
                  style={{ backgroundColor: theme.brand, color: '#fff', border: 'none', opacity: saving || !noteDraft.trim() ? 0.6 : 1 }}
                >
                  Save
                </button>
                {notes[selectedDate] && (
                  <button
                    type="button"
                    onClick={handleDeleteNote}
                    disabled={saving}
                    className="text-[11.5px] font-bold rounded-[8px] px-3 py-1.5"
                    style={{ backgroundColor: theme.criticalBg, color: theme.criticalStrong, border: 'none', opacity: saving ? 0.6 : 1 }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="text-[12px]" style={{ color: theme.textMuted }}>
              {notes[selectedDate]}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const queueRef = useRef(null);
  const queueBodyRef = useRef(null);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // The queue card is absolutely positioned inside its column, so its height
  // comes only from the left column (status / calendar / upcoming) and never
  // from its own rows. Measure the space left for rows and fit as many as
  // will fill it -- no empty band at the bottom, no internal scrollbar.
  useEffect(() => {
    const el = queueBodyRef.current;
    if (!el) return undefined;
    function fit() {
      const headH = el.querySelector('thead')?.offsetHeight || 30;
      const rowH = el.querySelector('tbody tr')?.offsetHeight || QUEUE_ROW_FALLBACK_PX;
      setPageSize(Math.max(3, Math.floor((el.clientHeight - headH) / rowH)));
    }
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [summary]);

  useEffect(() => {
    client
      .get('/api/dashboard/summary')
      .then(({ data }) => setSummary(data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load dashboard'));
  }, []);

  if (error) return <div className="text-red-700">{error}</div>;
  if (!summary) return <div style={{ color: theme.textMuted }}>Loading…</div>;

  const statusCount = (status) => summary.byStatus.find((s) => s.status === status)?.count || 0;

  // Mutually-exclusive breakdown for the donut + KPI row: "available" is
  // active equipment that is NOT currently overdue, so the four slices sum
  // exactly to totalEquipment instead of double-counting active-and-overdue
  // equipment under two different labels.
  const overdueCount = summary.overdueCount;
  const availableCount = Math.max(0, statusCount('active') - overdueCount);
  const sentCount = statusCount('sent_for_calibration');
  const unavailableCount = statusCount('decommissioned') + statusCount('under_maintenance');

  const donutSegments = [
    { key: 'available', value: availableCount, color: theme.good },
    { key: 'overdue', value: overdueCount, color: theme.critical },
    { key: 'sent', value: sentCount, color: theme.warning },
    { key: 'unavailable', value: unavailableCount, color: theme.neutralMuted },
  ];

  const fullQueue = [...summary.overdue, ...summary.dueSoon].map((r) => ({
    ...r,
    bucket: r.bucket === 'overdue' ? 'overdue' : 'due_soon',
  }));
  const filteredQueue = filter === 'all' ? fullQueue : fullQueue.filter((r) => r.bucket === filter);
  const pageCount = Math.max(1, Math.ceil(filteredQueue.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageItems = filteredQueue.slice(currentPage * pageSize, currentPage * pageSize + pageSize);
  const upcomingDueDates = summary.dueSoon.slice(0, 3);

  function handleFilterChange(e) {
    setFilter(e.target.value);
    setPage(0);
  }

  function handleViewOverdue() {
    setFilter('overdue');
    setPage(0);
    queueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-[23px] font-bold" style={{ color: '#151f38' }}>
        System Dashboard
      </h1>

      <div className="grid grid-cols-4 gap-[18px]">
        <KpiCard
          label="Total Equipment"
          value={summary.totalEquipment}
          Icon={LayersIcon}
          iconColor={theme.brand}
          iconBg="#eaf0ff"
          onClick={() => navigate('/equipment')}
        />
        <KpiCard
          label="Available"
          value={availableCount}
          Icon={CheckCircleIcon}
          iconColor={theme.good}
          iconBg={theme.goodBg}
          onClick={() => navigate('/equipment?status=active&view=available')}
        />
        <KpiCard label="Overdue" value={overdueCount} Icon={AlertTriangleIcon} iconColor={theme.critical} iconBg={theme.criticalBg} onClick={handleViewOverdue} />
        <KpiCard
          label="Sent for Calibration"
          value={sentCount}
          Icon={SendIcon}
          iconColor={theme.warning}
          iconBg={theme.warningBg}
          onClick={() => navigate('/equipment?status=sent_for_calibration')}
        />
      </div>

      {!alertDismissed && overdueCount > 0 && (
        <div className="rounded-[14px] px-5 py-3.5 flex items-center justify-between" style={{ backgroundColor: theme.alertBg, border: `1px solid ${theme.alertBorder}` }}>
          <div className="flex items-center gap-3">
            <div className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center shrink-0" style={{ backgroundColor: theme.criticalBgStrong, color: theme.critical }}>
              <AlertTriangleIcon color={theme.critical} />
            </div>
            <span className="text-[13.5px] font-semibold" style={{ color: '#7a271a' }}>
              {overdueCount} device{overdueCount === 1 ? ' is' : 's are'} overdue for calibration
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleViewOverdue}
              className="text-white rounded-[9px] px-4 py-2 text-[12.5px] font-semibold"
              style={{ backgroundColor: theme.critical }}
            >
              View overdue
            </button>
            <button onClick={() => setAlertDismissed(true)} className="text-lg leading-none" style={{ color: '#c98289' }} aria-label="Dismiss">
              &times;
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-5 items-stretch">
        <div className="flex flex-col gap-[18px]" style={{ flex: '0 0 388px' }}>
          <div className="bg-white rounded-2xl p-[18px]" style={{ border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
            <div className="text-sm font-bold mb-3.5" style={{ color: theme.ink }}>
              Equipment Status
            </div>
            <div className="flex items-center gap-5">
              <Donut segments={donutSegments} total={summary.totalEquipment} />
              <div className="flex flex-col gap-2.5 flex-1">
                {[
                  { label: 'Available', value: availableCount, color: theme.good },
                  { label: 'Overdue', value: overdueCount, color: theme.critical },
                  { label: 'Sent out', value: sentCount, color: theme.warning },
                  { label: 'Unavailable', value: unavailableCount, color: theme.neutralMuted },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-[12.5px]">
                    <span className="flex items-center gap-[7px]" style={{ color: '#4a5268' }}>
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: row.color }} />
                      {row.label}
                    </span>
                    <span className="font-bold" style={{ color: theme.ink }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <CalendarCard dueDates={fullQueue} />

          <div className="bg-white rounded-2xl p-[18px] flex-1 flex flex-col" style={{ border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
            <div className="text-sm font-bold mb-2.5" style={{ color: theme.ink }}>
              Upcoming Due Dates
            </div>
            <div className="flex flex-col flex-1">
              {upcomingDueDates.map((item, i) => (
                <div
                  key={item.equipment_id}
                  className="flex items-center justify-between py-2.5"
                  style={{ borderBottom: i < upcomingDueDates.length - 1 ? `1px solid ${theme.divider}` : 'none' }}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[12.5px] font-semibold" style={{ color: theme.inkAlt }}>
                      {item.name}
                    </span>
                    <span className="text-[11px]" style={{ color: theme.textFaint }}>
                      {item.model}
                    </span>
                  </div>
                  <DatePill dateStr={item.next_calibration_date} />
                </div>
              ))}
              {upcomingDueDates.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-sm py-4" style={{ color: theme.textFaint }}>
                  Nothing due soon
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Outer box takes the row's height (set by the left column); the card
            inside is absolute so its rows can't stretch the row taller. */}
        <div ref={queueRef} className="flex-1 min-w-0 relative" style={{ minHeight: 420 }}>
          <div className="absolute inset-0 bg-white rounded-2xl flex flex-col overflow-hidden" style={{ border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <span className="text-[15.5px] font-bold" style={{ color: theme.ink }}>
                Calibration Queue
              </span>
              <div className="relative">
                <select
                  value={filter}
                  onChange={handleFilterChange}
                  className="appearance-none rounded-[9px] pl-3 pr-8 py-[7px] text-[12.5px] font-semibold"
                  style={{ backgroundColor: theme.chipBg, border: `1px solid ${theme.borderStrong}`, color: '#38415a' }}
                >
                  <option value="all">All statuses</option>
                  <option value="overdue">Overdue</option>
                  <option value="due_soon">Due Soon</option>
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronDownIcon color="#38415a" />
                </span>
              </div>
            </div>

            <div ref={queueBodyRef} className="flex-1 min-h-0 overflow-hidden px-5">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['Equipment', 'Model', 'Serial Number', 'Next Due', 'Status'].map((h) => (
                      <th
                        key={h}
                        className="text-left text-[10.5px] font-bold uppercase tracking-wide pb-2.5"
                        style={{ color: theme.textFaint, borderBottom: `1px solid ${theme.border}` }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((r, i) => (
                    <tr key={`${r.equipment_id}-${r.bucket}`}>
                      <td className="py-[13px] text-[13px] font-semibold" style={{ color: theme.inkAlt, borderBottom: i < pageItems.length - 1 ? `1px solid ${theme.divider}` : 'none' }}>
                        <Link to={`/equipment/${r.equipment_id}`} className="hover:underline">
                          {r.name}
                        </Link>
                      </td>
                      <td className="py-[13px] text-[13px]" style={{ color: theme.textMuted, borderBottom: i < pageItems.length - 1 ? `1px solid ${theme.divider}` : 'none' }}>
                        {r.model || '—'}
                      </td>
                      <td className="py-[13px] text-[13px]" style={{ color: theme.textMuted, borderBottom: i < pageItems.length - 1 ? `1px solid ${theme.divider}` : 'none' }}>
                        {r.serial_number}
                      </td>
                      <td className="py-[13px] text-[13px]" style={{ color: theme.textMuted, borderBottom: i < pageItems.length - 1 ? `1px solid ${theme.divider}` : 'none' }}>
                        {String(r.next_calibration_date).slice(0, 10)}
                      </td>
                      <td className="py-[13px]" style={{ borderBottom: i < pageItems.length - 1 ? `1px solid ${theme.divider}` : 'none' }}>
                        <StatusBadge bucket={r.bucket} />
                      </td>
                    </tr>
                  ))}
                  {pageItems.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-sm" style={{ color: theme.textFaint }}>
                        Nothing due right now
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-5 py-3.5" style={{ borderTop: `1px solid ${theme.divider}` }}>
              <span className="text-[12.5px]" style={{ color: theme.textFaint }}>
                {filteredQueue.length === 0
                  ? 'Showing 0 of 0 items'
                  : `Showing ${currentPage * pageSize + 1}–${Math.min(filteredQueue.length, currentPage * pageSize + pageSize)} of ${filteredQueue.length} items`}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="text-[12.5px] font-semibold rounded-lg px-[15px] py-[7px] disabled:opacity-60"
                  style={{ border: `1px solid ${theme.border}`, color: currentPage === 0 ? '#c2c8d6' : '#38415a' }}
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={currentPage >= pageCount - 1}
                  className="text-[12.5px] font-semibold rounded-lg px-[15px] py-[7px] disabled:opacity-40"
                  style={{ border: `1px solid #d6ddf2`, color: theme.brand }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

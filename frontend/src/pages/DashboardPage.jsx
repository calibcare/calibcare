import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Section, Skeleton, SideDrawer } from '../components/ui';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowUpRightIcon,
  AlertTriangleIcon,
  LayersIcon,
  CheckCircleIcon,
  SendIcon,
  ClockIcon,
  WrenchIcon,
  ArchiveIcon,
} from '../components/icons';

// Fallback row count for the Calibration Queue before it has been
// measured; after that, rows-per-page is fitted to the card's real height
// (see the ResizeObserver in DashboardPage) so the card is always full.
const PAGE_SIZE = 6;
const QUEUE_ROW_FALLBACK_PX = 47;
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function KpiCard({ label, value, hint, Icon, iconColor, iconBg, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl p-4 flex flex-col gap-2.5 min-w-0"
      style={{ border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow, cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="flex items-center justify-between">
        <div className="w-8 h-8 rounded-[9px] flex items-center justify-center" style={{ backgroundColor: iconBg, color: iconColor }}>
          <Icon color={iconColor} />
        </div>
        <ArrowUpRightIcon color="#c7cbd8" />
      </div>
      <span className="text-[11px] font-bold uppercase tracking-wide leading-tight" style={{ color: '#7a8296' }}>
        {label}
      </span>
      <div className="text-[27px] font-bold leading-none" style={{ color: theme.ink }}>
        {value}
      </div>
      {hint && (
        <div className="text-[12px] leading-snug" style={{ color: theme.textFaint }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 md:gap-4">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} style={{ height: 150, borderRadius: 16 }} />
        ))}
      </div>
      <div className="flex flex-col lg:flex-row gap-5">
        <div className="flex flex-col gap-[18px] lg:w-[388px] lg:shrink-0">
          <Skeleton style={{ height: 180, borderRadius: 16 }} />
          <Skeleton style={{ height: 300, borderRadius: 16 }} />
        </div>
        <Skeleton className="lg:flex-1" style={{ height: 498, borderRadius: 16 }} />
      </div>
    </div>
  );
}

const STATUS_LABELS = {
  active: 'Active',
  under_maintenance: 'Under Maintenance',
  decommissioned: 'Decommissioned',
  sent_for_calibration: 'Sent for Calibration',
};

function dueText(days) {
  if (days == null) return '';
  if (days < 0) return `${-days} day${days === -1 ? '' : 's'} overdue`;
  if (days === 0) return 'Due today';
  return `Due in ${days} day${days === 1 ? '' : 's'}`;
}

// Quick look at one device from a dashboard list: its details load into a
// side drawer, so the user keeps their place on the dashboard; the full
// page (history, certificates, editing) is one click away.
function DeviceDrawer({ item, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    client
      .get(`/api/equipment/${item.equipment_id}`)
      .then(({ data }) => setDetail(data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load this device'));
  }, [item.equipment_id]);

  const overdue = item.days_until_due < 0;
  const latest = detail?.latest_calibration;
  const fields = detail && [
    ['Serial number', detail.serial_number],
    ['Model', detail.model],
    ['Category', detail.category],
    ['Site', detail.location_category],
    ['Location', detail.location],
    ['Status', STATUS_LABELS[detail.status] || detail.status],
    ['Last calibrated', latest?.calibration_date ? String(latest.calibration_date).slice(0, 10) : null],
    ['Next due', String(item.next_calibration_date).slice(0, 10)],
    ['Calibrated by', latest?.responsible_person],
  ];

  return (
    <SideDrawer
      label="Device details"
      title={item.name}
      description={
        <span
          className="inline-block text-[12px] font-bold rounded-full px-2.5 py-1"
          style={{ color: overdue ? theme.criticalStrong : theme.warning, backgroundColor: overdue ? theme.criticalBgStrong : theme.warningBg }}
        >
          {dueText(item.days_until_due)}
        </span>
      }
      onClose={onClose}
      footer={
        <Link
          to={`/equipment/${item.equipment_id}`}
          className="flex-1 text-center rounded-[10px] px-4 py-2.5 text-[13px] font-semibold text-white"
          style={{ backgroundColor: theme.brand }}
        >
          Open full page →
        </Link>
      }
    >
      {error && (
        <div className="rounded-[10px] px-4 py-2.5 text-sm" style={{ backgroundColor: theme.criticalBg, color: theme.criticalStrong }}>
          {error}
        </div>
      )}
      {!detail && !error && (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} style={{ height: 14, width: `${90 - i * 7}%` }} />
          ))}
        </div>
      )}
      {detail && (
        <>
          <dl className="grid gap-x-3 gap-y-2.5 text-[13px]" style={{ gridTemplateColumns: '120px 1fr' }}>
            {fields.map(([label, value]) => (
              <div key={label} className="contents">
                <dt style={{ color: theme.textMuted }}>{label}</dt>
                <dd style={{ color: theme.ink }}>{value || '—'}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6">
            <div className="text-[13px] font-bold mb-2" style={{ color: theme.ink }}>
              What it measures
            </div>
            {detail.capabilities.length === 0 ? (
              <p className="text-[13px]" style={{ color: theme.textFaint }}>
                No measurement capabilities recorded.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-[13px]" style={{ color: theme.textMuted }}>
                {detail.capabilities.map((c) => (
                  <li key={c.capability_id}>
                    <span className="font-semibold" style={{ color: theme.inkAlt }}>
                      {c.measurement_purpose}
                    </span>
                    {c.measurement_range ? ` · ${c.measurement_range}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </SideDrawer>
  );
}

// Drill-down drawer for a KPI: the devices behind the number, without
// leaving the dashboard; the full, filterable list is one click away.
function DeviceListDrawer({ title, description, items, to, onClose }) {
  const navigate = useNavigate();
  return (
    <SideDrawer
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={() => navigate(to)}
          className="flex-1 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold text-white"
          style={{ backgroundColor: theme.brand, border: 'none' }}
        >
          Open in the Equipment list →
        </button>
      }
    >
      {items.length === 0 ? (
        <p className="text-[13px] py-6 text-center" style={{ color: theme.textFaint }}>
          Nothing here right now.
        </p>
      ) : (
        <div className="flex flex-col">
          {items.map((r, i) => (
            <Link
              key={r.equipment_id}
              to={`/equipment/${r.equipment_id}`}
              className="flex items-center justify-between gap-3 py-3 hover:bg-[#f9fafc] -mx-2 px-2 rounded-lg"
              style={{ borderBottom: i < items.length - 1 ? `1px solid ${theme.divider}` : 'none' }}
            >
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold truncate" style={{ color: theme.inkAlt }}>
                  {r.name}
                </span>
                <span className="block text-[11.5px] truncate" style={{ color: theme.textFaint }}>
                  {r.model || '—'} · S/N {r.serial_number}
                </span>
              </span>
              <span className="text-[12px] font-semibold whitespace-nowrap" style={{ color: r.days_until_due < 0 ? theme.criticalStrong : theme.warning }}>
                {r.days_until_due < 0 ? `${-r.days_until_due} days overdue` : r.days_until_due === 0 ? 'Due today' : `In ${r.days_until_due} days`}
              </span>
            </Link>
          ))}
        </div>
      )}
    </SideDrawer>
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

// How long until (or since) the due date, coloured by urgency, so the
// queue reads as a to-do list: what to send now, what to get ready.
function TimeLeftBadge({ days }) {
  const overdue = days < 0;
  const urgent = !overdue && days <= 7;
  return (
    <span
      className="text-[11.5px] font-bold rounded-full px-[11px] py-1 inline-block whitespace-nowrap"
      style={{
        color: overdue ? theme.criticalStrong : urgent ? '#9a3412' : theme.warning,
        backgroundColor: overdue ? theme.criticalBgStrong : urgent ? '#ffedd5' : theme.warningBg,
      }}
    >
      {dueText(days)}
    </span>
  );
}

function formatDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const THAI_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' });

// What a device due on a calendar day means right now: overdue / coming up
// for active devices, otherwise its status (already sent out, in repair).
function dayItemState(item) {
  if (item.status === 'sent_for_calibration') return { label: 'Sent for calibration', color: '#1d4ed8', bg: '#e8edfd' };
  if (item.status === 'under_maintenance') return { label: 'Under maintenance', color: theme.textMuted, bg: theme.chipBg };
  if (item.days_until_due < 0) return { label: dueText(item.days_until_due), color: theme.criticalStrong, bg: theme.criticalBgStrong, overdue: true };
  return { label: dueText(item.days_until_due), color: theme.warning, bg: theme.warningBg };
}

function CalendarCard({ onOpenDevice }) {
  const { user } = useAuth();
  const canManage = Boolean(user?.can_edit);

  const [viewedMonth, setViewedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [notes, setNotes] = useState({});
  const [devices, setDevices] = useState([]);
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
    // Every device's next due date (not only the 30-day queue), so any month
    // can be browsed. Decommissioned devices are never calibrated again.
    client
      .get('/api/equipment', { params: { limit: 200 } })
      .then(({ data }) => setDevices(data.equipment.filter((e) => e.next_calibration_date && e.status !== 'decommissioned')))
      .catch(() => {});
  }, []);

  // dateKey -> devices due that day, each with days_until_due from the Thai date.
  const dueByDate = useMemo(() => {
    const todayMs = Date.parse(THAI_DATE.format(new Date()));
    const map = {};
    for (const e of devices) {
      const key = String(e.next_calibration_date).slice(0, 10);
      const item = { ...e, days_until_due: Math.round((Date.parse(key) - todayMs) / 86400000) };
      (map[key] ||= []).push(item);
    }
    for (const list of Object.values(map)) list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [devices]);

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
    if (dateKey === selectedDate) {
      setSelectedDate(null);
      return;
    }
    setSelectedDate(dateKey);
    setNoteDraft(notes[dateKey] || '');
    setNoteError('');
  }

  async function handleSaveNote() {
    setSaving(true);
    setNoteError('');
    try {
      await client.put(`/api/calendar-notes/${selectedDate}`, { note_text: noteDraft });
      setNotes((prev) => ({ ...prev, [selectedDate]: noteDraft.trim() }));
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
      setNoteDraft('');
    } catch (err) {
      setNoteError(err.response?.data?.error || 'Failed to delete note');
    } finally {
      setSaving(false);
    }
  }

  const selectedItems = selectedDate ? dueByDate[selectedDate] || [] : [];
  const noteChanged = noteDraft.trim() !== (notes[selectedDate] || '');

  return (
    <div className="bg-white rounded-2xl p-[18px]" style={{ border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold" style={{ color: theme.ink }}>
          {monthLabel}
        </span>
        <div className="flex gap-1.5">
          <button
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="w-[22px] h-[22px] rounded-[7px] flex items-center justify-center"
            style={{ border: `1px solid ${theme.borderStrong}`, color: theme.textFaint }}
          >
            <ChevronLeftIcon color={theme.textFaint} />
          </button>
          <button
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
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
          const dateKey = formatDateKey(year, month, day);
          const due = dueByDate[dateKey] || [];
          const isOverdue = due.some((item) => dayItemState(item).overdue);
          const isToday = isCurrentMonth && day === today.getDate();
          const isSelected = dateKey === selectedDate;
          const hasNote = Boolean(notes[dateKey]);
          const hint = [due.length && `${due.length} device${due.length === 1 ? '' : 's'} due`, hasNote && 'note'].filter(Boolean).join(' · ');
          let color = '#38415a';
          let bg = 'transparent';
          if (due.length) {
            color = isOverdue ? theme.criticalStrong : theme.warning;
            bg = isOverdue ? theme.criticalBgStrong : theme.warningBg;
          }
          if (isSelected) {
            color = '#fff';
            bg = theme.brand;
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleDayClick(day)}
              title={hint || undefined}
              aria-pressed={isSelected}
              className="relative flex items-center justify-center text-[11.5px] rounded-[7px] hover:brightness-95"
              style={{
                fontWeight: due.length || isToday || isSelected ? 700 : 400,
                color: !due.length && !isSelected && isToday ? theme.brand : color,
                backgroundColor: bg,
                boxShadow: isToday && !isSelected ? `inset 0 0 0 1.5px ${theme.brand}` : 'none',
                border: 'none',
                padding: 0,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              {day}
              {hasNote && (
                <span
                  className="absolute bottom-[2px] w-[4px] h-[4px] rounded-full"
                  style={{ backgroundColor: isSelected ? '#fff' : theme.brand }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 pt-3" style={{ borderTop: `1px solid ${theme.divider}` }}>
        <span className="flex items-center gap-1.5 text-[11px]" style={{ color: '#7a8296' }}>
          <span className="w-[9px] h-[9px] rounded-[3px] inline-block" style={{ backgroundColor: theme.warningBg, border: `1px solid ${theme.warningBorderSoft}` }} />
          Calibration due
        </span>
        <span className="flex items-center gap-1.5 text-[11px]" style={{ color: '#7a8296' }}>
          <span className="w-[9px] h-[9px] rounded-[3px] inline-block" style={{ backgroundColor: theme.criticalBgStrong, border: `1px solid ${theme.criticalStrong}` }} />
          Overdue
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
      {!selectedDate && (
        <p className="text-[11px] mt-2" style={{ color: theme.textFaint }}>
          Click a date to see what is due and its note.
        </p>
      )}

      {selectedDate && (
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${theme.divider}` }}>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[13px] font-bold" style={{ color: theme.ink }}>
              {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <button type="button" onClick={() => setSelectedDate(null)} className="text-[11px]" style={{ color: theme.textFaint, border: 'none', background: 'none' }}>
              Close
            </button>
          </div>

          <div className="text-[11.5px] font-bold mb-1.5" style={{ color: theme.textMuted }}>
            Calibration due ({selectedItems.length})
          </div>
          {selectedItems.length === 0 ? (
            <p className="text-[12px] mb-3" style={{ color: theme.textFaint }}>
              No calibrations due on this day.
            </p>
          ) : (
            <ul className="flex flex-col mb-3">
              {selectedItems.map((item) => {
                const state = dayItemState(item);
                return (
                  <li key={item.equipment_id} className="flex items-center justify-between gap-2 py-1.5" style={{ borderTop: `1px solid ${theme.divider}` }}>
                    <button
                      type="button"
                      onClick={() => onOpenDevice(item)}
                      title="Show details"
                      className="min-w-0 text-left"
                      style={{ border: 'none', background: 'none', padding: 0 }}
                    >
                      <span className="block text-[12.5px] font-semibold truncate hover:underline" style={{ color: theme.inkAlt }}>
                        {item.name}
                      </span>
                      <span className="block text-[11px] truncate" style={{ color: theme.textFaint }}>
                        {[item.model, item.serial_number && `S/N ${item.serial_number}`, item.location_category].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                    <span className="shrink-0 text-[11px] font-bold rounded-full px-2 py-0.5" style={{ color: state.color, backgroundColor: state.bg }}>
                      {state.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="text-[11.5px] font-bold mb-1.5" style={{ color: theme.textMuted }}>
            Note
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
                  disabled={saving || !noteDraft.trim() || !noteChanged}
                  className="text-[11.5px] font-bold rounded-[8px] px-3 py-1.5"
                  style={{ backgroundColor: theme.brand, color: '#fff', border: 'none', opacity: saving || !noteDraft.trim() || !noteChanged ? 0.6 : 1 }}
                >
                  {notes[selectedDate] && !noteChanged ? 'Saved' : 'Save'}
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
            <p className="text-[12px] whitespace-pre-wrap" style={{ color: notes[selectedDate] ? theme.ink : theme.textFaint }}>
              {notes[selectedDate] || 'No note for this day.'}
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
  const { user } = useAuth();
  const canSend = Boolean(user?.can_edit);
  // The queue opens on the devices to get ready next (due within 30 days).
  const [filter, setFilter] = useState('due_soon');
  const [sendingId, setSendingId] = useState(null);
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(0);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const [device, setDevice] = useState(null);
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

  function loadSummary() {
    return client
      .get('/api/dashboard/summary')
      .then(({ data }) => setSummary(data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load dashboard'));
  }

  useEffect(() => {
    loadSummary();
  }, []);

  async function sendForCalibration(item) {
    if (!confirm(`Mark ${item.name} (S/N ${item.serial_number}) as sent for calibration?`)) return;
    setSendingId(item.equipment_id);
    setNotice('');
    try {
      await client.put(`/api/equipment/${item.equipment_id}`, { status: 'sent_for_calibration' });
      setNotice(`${item.name} (S/N ${item.serial_number}) is now marked as sent for calibration.`);
      await loadSummary();
    } catch (err) {
      setNotice(err.response?.data?.error || 'Could not update the status');
    } finally {
      setSendingId(null);
    }
  }

  const header = <PageHeader title="Dashboard" />;

  if (error)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-[10px] px-4 py-2.5 text-sm" style={{ backgroundColor: theme.criticalBg, color: theme.criticalStrong }}>
          {error}
        </div>
      </div>
    );
  if (!summary)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <DashboardSkeleton />
      </div>
    );

  const statusCount = (status) => summary.byStatus.find((s) => s.status === status)?.count || 0;

  // Six mutually-exclusive groups, so every instrument is counted exactly
  // once and the groups add up to the total: an active instrument is either
  // overdue, due within 30 days, or simply available; the other statuses
  // are their own groups. The KPI cards and the donut both use this one list.
  const overdueCount = summary.overdueCount;
  const categories = [
    {
      key: 'available',
      label: 'Available',
      value: Math.max(0, statusCount('active') - overdueCount - summary.dueSoonCount),
      hint: 'In service, not due soon',
      color: theme.good,
      Icon: CheckCircleIcon,
      iconBg: theme.goodBg,
      onClick: () => navigate('/equipment?status=active'),
    },
    { key: 'due_soon', label: 'Due soon', value: summary.dueSoonCount, hint: 'Within the next 30 days', color: theme.warning, Icon: ClockIcon, iconBg: theme.warningBg, onClick: () => setDrawer('due_soon') },
    { key: 'overdue', label: 'Overdue', value: overdueCount, hint: 'Past the due date', color: theme.critical, Icon: AlertTriangleIcon, iconBg: theme.criticalBg, onClick: () => setDrawer('overdue') },
    {
      key: 'sent',
      label: 'Sent out',
      value: statusCount('sent_for_calibration'),
      hint: 'At the calibration lab',
      color: '#1d4ed8',
      Icon: SendIcon,
      iconBg: '#e8edfd',
      onClick: () => navigate('/equipment?status=sent_for_calibration'),
    },
    {
      key: 'maintenance',
      label: 'Maintenance',
      value: statusCount('under_maintenance'),
      hint: 'Damaged or being repaired',
      color: '#7c3aed',
      Icon: WrenchIcon,
      iconBg: '#f3e8ff',
      onClick: () => navigate('/equipment?status=under_maintenance'),
    },
    {
      key: 'decommissioned',
      label: 'Decommissioned',
      value: statusCount('decommissioned'),
      hint: 'No longer in use',
      color: theme.neutralMuted,
      Icon: ArchiveIcon,
      iconBg: theme.chipBg,
      onClick: () => navigate('/equipment?status=decommissioned'),
    },
  ];
  const donutSegments = categories.map(({ key, value, color }) => ({ key, value, color }));

  const fullQueue = [...summary.overdue, ...summary.dueSoon].map((r) => ({
    ...r,
    bucket: r.bucket === 'overdue' ? 'overdue' : 'due_soon',
  }));
  const filteredQueue = filter === 'all' ? fullQueue : fullQueue.filter((r) => r.bucket === filter);
  const pageCount = Math.max(1, Math.ceil(filteredQueue.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageItems = filteredQueue.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  function showQueue(key) {
    setFilter(key);
    setPage(0);
  }
  const queueTabs = [
    { key: 'due_soon', label: 'Due soon · prepare to send', count: summary.dueSoon.length },
    { key: 'overdue', label: 'Overdue · send now', count: summary.overdue.length },
    { key: 'all', label: 'All', count: fullQueue.length },
  ];

  function handleViewOverdue() {
    setDrawer('overdue');
  }

  const drawers = {
    overdue: {
      title: `${overdueCount} overdue`,
      description: 'Past their calibration due date. Calibrate these before using them.',
      items: summary.overdue,
      to: '/equipment?status=overdue',
    },
    due_soon: {
      title: `${summary.dueSoonCount} due within 30 days`,
      description: 'Schedule calibration for these before the due date.',
      items: summary.dueSoon,
      to: '/equipment?status=soon',
    },
  };

  return (
    <div className="flex flex-col gap-6">
      {header}

      <Section title="Overview" hint="Every instrument, counted once" to="/equipment" actionLabel="View all equipment">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 md:gap-4">
          <KpiCard label="Total" value={summary.totalEquipment} hint="All instruments" Icon={LayersIcon} iconColor={theme.brand} iconBg="#eaf0ff" onClick={() => navigate('/equipment')} />
          {categories.map((c) => (
            <KpiCard key={c.key} label={c.label} value={c.value} hint={c.hint} Icon={c.Icon} iconColor={c.color} iconBg={c.iconBg} onClick={c.onClick} />
          ))}
        </div>
      </Section>

      {!alertDismissed && overdueCount > 0 && (
        <div className="rounded-[14px] px-4 md:px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap" style={{ backgroundColor: theme.alertBg, border: `1px solid ${theme.alertBorder}` }}>
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

      <div className="flex flex-col lg:flex-row gap-5 lg:items-stretch">
        <div className="flex flex-col gap-[18px] lg:w-[388px] lg:shrink-0">
          <Section title="Status and schedule" />
          <div className="bg-white rounded-2xl p-[18px]" style={{ border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
            <div className="text-sm font-bold mb-3.5" style={{ color: theme.ink }}>
              Equipment Status
            </div>
            <div className="flex items-center gap-5">
              <Donut segments={donutSegments} total={summary.totalEquipment} />
              <div className="flex flex-col gap-2.5 flex-1">
                {categories.map((row) => (
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

          <CalendarCard onOpenDevice={setDevice} />
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-[18px]">
          <Section title="Needs attention" hint="Overdue, or due within 30 days" to="/equipment?status=overdue" />
          {/* Outer box takes the row's height (set by the left column); the card
              inside is absolute so its rows can't stretch the row taller. */}
          <div ref={queueRef} className="flex-1 min-w-0 relative" style={{ minHeight: 420 }}>
            <div className="absolute inset-0 bg-white rounded-2xl flex flex-col overflow-hidden" style={{ border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
              <div className="px-5 pt-5 pb-2 flex flex-col gap-3">
                <span className="text-[15.5px] font-bold" style={{ color: theme.ink }}>
                  Calibration queue
                </span>
                <div role="tablist" aria-label="Calibration queue" className="flex gap-1.5 flex-wrap">
                  {queueTabs.map((t) => {
                    const active = filter === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => showQueue(t.key)}
                        className="flex items-center gap-2 rounded-[9px] px-3 py-[7px] text-[12.5px] font-semibold"
                        style={{
                          backgroundColor: active ? theme.brand : theme.chipBg,
                          color: active ? '#fff' : '#38415a',
                          border: `1px solid ${active ? theme.brand : theme.borderStrong}`,
                        }}
                      >
                        {t.label}
                        <span
                          className="rounded-full px-[7px] text-[11px] font-bold"
                          style={{ backgroundColor: active ? 'rgba(255,255,255,.22)' : '#fff', color: active ? '#fff' : theme.textMuted }}
                        >
                          {t.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {notice && (
                  <div className="rounded-[9px] px-3 py-2 text-[12.5px]" style={{ backgroundColor: theme.goodBg, color: '#0a7a45' }}>
                    {notice}
                  </div>
                )}
              </div>

              <div ref={queueBodyRef} className="flex-1 min-h-0 overflow-hidden px-5">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {['Equipment', 'Next due', 'Time left', ...(canSend ? [''] : [])].map((h) => (
                        <th
                          key={h}
                          className={`text-left text-[10.5px] font-bold uppercase tracking-wide pb-2.5 pr-2 ${h === 'Next due' ? 'hidden sm:table-cell' : ''}`}
                          style={{ color: theme.textFaint, borderBottom: `1px solid ${theme.border}` }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((r, i) => {
                      const line = { borderBottom: i < pageItems.length - 1 ? `1px solid ${theme.divider}` : 'none' };
                      return (
                        <tr key={`${r.equipment_id}-${r.bucket}`}>
                          <td className="py-[7px] pr-2" style={line}>
                            <button
                              type="button"
                              onClick={() => setDevice(r)}
                              title="Show details"
                              className="block text-left text-[13px] font-semibold hover:underline"
                              style={{ color: theme.inkAlt, border: 'none', background: 'none', padding: 0 }}
                            >
                              {r.name}
                            </button>
                            <span className="block text-[11.5px]" style={{ color: theme.textFaint }}>
                              {r.model ? `${r.model} · ` : ''}S/N {r.serial_number}
                            </span>
                          </td>
                          <td className="hidden sm:table-cell py-[7px] pr-2 text-[13px] whitespace-nowrap" style={{ ...line, color: theme.textMuted }}>
                            {String(r.next_calibration_date).slice(0, 10)}
                          </td>
                          <td className="py-[7px] pr-2" style={line}>
                            <TimeLeftBadge days={r.days_until_due} />
                          </td>
                          {canSend && (
                            <td className="py-[7px] text-right" style={line}>
                              <button
                                type="button"
                                onClick={() => sendForCalibration(r)}
                                disabled={sendingId === r.equipment_id}
                                className="rounded-lg px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap disabled:opacity-50 hover:bg-[#eaf0ff]"
                                style={{ color: theme.brand, border: '1px solid #cddaf9', backgroundColor: '#fff' }}
                              >
                                {sendingId === r.equipment_id ? 'Sending…' : 'Send for calibration'}
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {pageItems.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-sm" style={{ color: theme.textFaint }}>
                          {filter === 'due_soon' ? 'Nothing due in the next 30 days' : filter === 'overdue' ? 'Nothing overdue' : 'Nothing due right now'}
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

      {drawer && <DeviceListDrawer {...drawers[drawer]} onClose={() => setDrawer(null)} />}
      {device && <DeviceDrawer item={device} onClose={() => setDevice(null)} />}
    </div>
  );
}


import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { LOCATION_SITES } from '../locations';
import { SearchIcon, ChevronDownIcon } from '../components/icons';
import { PageHeader, HeaderButton, FilterFeedback, Skeleton, SideDrawer } from '../components/ui';

const EDITABLE_STATUSES = ['active', 'under_maintenance', 'decommissioned', 'sent_for_calibration'];
const DUE_SOON_DAYS = 30;

// Display statuses, in table sort order. `overdue` and `soon` are derived
// (see classify()) -- they're active equipment whose next calibration date
// has passed / falls within DUE_SOON_DAYS -- the rest are the raw
// `equipment.status` column.
const STATUS_ORDER = ['overdue', 'soon', 'sent_for_calibration', 'under_maintenance', 'active', 'decommissioned'];
const STATUS_META = {
  overdue: { label: 'Overdue', mark: '▲ ', color: theme.criticalStrong, bg: theme.criticalBgStrong },
  soon: { label: 'Due soon', mark: '◔ ', color: theme.brand, bg: '#eaf0ff', dashed: true },
  sent_for_calibration: { label: 'Sent for Calibration', color: '#1d4ed8', bg: '#e8edfd' },
  under_maintenance: { label: 'Under Maintenance', color: theme.warning, bg: theme.warningBg },
  active: { label: 'Active', color: theme.good, bg: theme.goodBg },
  decommissioned: { label: 'Decommissioned', color: theme.textMuted, bg: theme.chipBg },
};

const DUE_OPTIONS = { '': 'Any time', overdue: 'Overdue', 7: 'Next 7 days', 30: 'Next 30 days', 90: 'Next 90 days' };

const SAVED_VIEWS = [
  { label: 'Overdue now', filters: { status: ['overdue'] } },
  { label: 'Due in the next 30 days', filters: { due: '30' } },
  { label: 'Currently sent out', filters: { status: ['sent_for_calibration'] } },
  { label: 'Available to use', filters: { status: ['active', 'soon'] } },
];

const emptyForm = { name: '', model: '', serial_number: '', location_category: '', location_detail: '', status: 'active' };
const emptyFilters = () => ({ status: new Set(), type: new Set(), loc: new Set(), due: '' });

// Local calendar date, not toISOString() (UTC) -- in Thailand (UTC+7) the
// UTC date is still "yesterday" until 7am, which would shift every
// days-until-due count by one.
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysFrom(todayStr, dateStr) {
  return Math.round((Date.parse(dateStr) - Date.parse(todayStr)) / 86400000);
}

function classify(item) {
  if (item.status === 'active' && item.days_until_due != null) {
    if (item.days_until_due < 0) return 'overdue';
    if (item.days_until_due <= DUE_SOON_DAYS) return 'soon';
  }
  return item.status;
}

// Initial filters from the URL -- the Dashboard KPI cards and the top-bar
// search link here with ?status=, ?view=available and ?q=.
function filtersFromParams(searchParams) {
  const f = emptyFilters();
  const status = searchParams.get('status');
  if (searchParams.get('view') === 'available') {
    f.status = new Set(['active', 'soon']);
  } else if (status && STATUS_META[status]) {
    f.status.add(status);
  }
  return f;
}

function matches(item, filters, q, skip) {
  if (q) {
    const hay = `${item.name} ${item.model || ''} ${item.serial_number} ${item.location || ''}`.toLowerCase();
    if (!hay.includes(q.toLowerCase())) return false;
  }
  if (skip !== 'status' && filters.status.size && !filters.status.has(item.displayStatus)) return false;
  if (skip !== 'type' && filters.type.size && !filters.type.has(item.name)) return false;
  if (skip !== 'loc' && filters.loc.size && !filters.loc.has(item.location_category)) return false;
  if (skip !== 'due' && filters.due) {
    if (item.days_until_due == null || item.status === 'decommissioned') return false;
    if (filters.due === 'overdue') return item.days_until_due < 0;
    return item.days_until_due >= 0 && item.days_until_due <= Number(filters.due);
  }
  return true;
}

function Badge({ statusKey }) {
  const meta = STATUS_META[statusKey] || { label: statusKey, color: theme.textMuted, bg: theme.chipBg };
  return (
    <span
      className="inline-flex items-center rounded-full px-[9px] py-[2px] text-[11.5px] font-bold whitespace-nowrap"
      style={{ color: meta.color, backgroundColor: meta.bg, border: meta.dashed ? `1px dashed ${meta.color}` : '1px solid transparent' }}
    >
      {meta.mark || ''}
      {meta.label}
    </span>
  );
}

function DueText({ item }) {
  if (!item.next_calibration_date) return <span style={{ color: theme.textFaint }}>—</span>;
  if (item.status === 'decommissioned' || item.days_until_due == null) return item.next_calibration_date;
  const d = item.days_until_due;
  return (
    <>
      {item.next_calibration_date}
      <span style={{ color: theme.textFaint }}> · </span>
      {d < 0 ? (
        <b style={{ color: theme.criticalStrong }}>{-d} days overdue</b>
      ) : (
        <span style={{ color: theme.textFaint }}>{d === 0 ? 'due today' : `in ${d} day${d === 1 ? '' : 's'}`}</span>
      )}
    </>
  );
}

// Closes `onClose` on any mousedown outside `ref`, and on Escape.
function useDismiss(ref, active, onClose) {
  useEffect(() => {
    if (!active) return undefined;
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, active, onClose]);
}

const THAI_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' });

// "↓ Download Excel": the register as an Excel file in the FP-ENG-05-01
// layout, built by the server from the live data, so it always has the
// latest calibrations. A small box lets the user rename the file first.
function DownloadExcelButton({ onDone, onError }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [downloading, setDownloading] = useState(false);
  const boxRef = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(boxRef, open, close);

  const defaultName = `FP-ENG-05-01_CalibCare_${THAI_DAY.format(new Date())}`;

  function toggle() {
    if (!open) setName(defaultName);
    setOpen((v) => !v);
  }

  async function download(e) {
    e.preventDefault();
    // Characters Windows and macOS don't allow in file names become "-".
    const base = name.trim().replace(/\.xlsx$/i, '').replace(/[\\/:*?"<>|]+/g, '-').trim() || defaultName;
    const filename = `${base}.xlsx`;
    setDownloading(true);
    onError('');
    try {
      const { data } = await client.get('/api/equipment/register.xlsx', { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setOpen(false);
      onDone(`Downloaded ${filename}`);
    } catch {
      onError('Could not download the Excel file');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <HeaderButton onClick={toggle} aria-expanded={open} title="The register in the FP-ENG-05-01 layout, with today's data">
        ↓ Download Excel
      </HeaderButton>
      {open && (
        <form
          onSubmit={download}
          className="absolute z-30 mt-2 left-0 md:left-auto md:right-0 w-[340px] max-w-[calc(100vw-32px)] bg-white rounded-xl p-4 flex flex-col gap-3"
          style={{ border: `1px solid ${theme.border}`, boxShadow: '0 12px 32px rgba(16,24,40,.18)' }}
        >
          <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold" style={{ color: theme.textMuted }}>
            File name
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="input flex-1 min-w-0"
                aria-label="File name"
              />
              <span className="text-[13px] font-normal" style={{ color: theme.textFaint }}>.xlsx</span>
            </div>
          </label>
          <p className="text-[11.5px]" style={{ color: theme.textFaint }}>
            Register layout (FP-ENG-05-01) with today&apos;s data.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={downloading}
              className="rounded-[9px] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: theme.brand, border: 'none' }}
            >
              {downloading ? 'Preparing…' : 'Download'}
            </button>
            <button type="button" onClick={close} className="text-[13px] font-semibold" style={{ color: theme.textFaint, border: 'none', background: 'none' }}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

const chipBase = 'flex items-center gap-1.5 rounded-[10px] px-[13px] py-[8px] text-[13px] font-semibold whitespace-nowrap';
function chipStyle(active) {
  return active
    ? { border: '1px solid #cddaf9', backgroundColor: '#eaf0ff', color: '#1d3a8f' }
    : { border: `1px solid ${theme.borderStrong}`, backgroundColor: '#fff', color: '#38415a' };
}
const menuBox = 'absolute left-0 top-[calc(100%+6px)] z-30 bg-white rounded-xl p-2 min-w-[230px]';
const menuStyle = { border: `1px solid ${theme.borderStrong}`, boxShadow: '0 10px 30px rgba(16,24,40,.16)' };

// Multi-select checkbox menu. Edits a draft copy and only commits on Apply
// (or clicking away), so the table doesn't re-filter on every tick.
// `counts` is how many rows each option would show given the *other* active
// filters -- the same facet-count behavior as the mockup.
function MultiFilter({ label, options, selected, counts, renderOption = (v) => v, onApply }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(selected);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  const close = useCallback(() => {
    setOpen(false);
    onApply(draft);
  }, [draft, onApply]);
  useDismiss(ref, open, close);

  function toggleOpen() {
    if (open) return close();
    setDraft(new Set(selected));
    setSearch('');
    setOpen(true);
  }

  const shown = options.filter((v) => String(renderOption(v)).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={toggleOpen} className={chipBase} style={chipStyle(selected.size > 0)} aria-expanded={open}>
        {label}
        {selected.size > 0 && ` (${selected.size})`}
        <ChevronDownIcon size={11} />
      </button>
      {open && (
        <div className={menuBox} style={menuStyle}>
          {options.length > 5 && (
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              className="w-full rounded-lg px-2.5 py-1.5 mb-1.5 text-[13px] outline-none"
              style={{ border: `1px solid ${theme.borderStrong}`, backgroundColor: theme.pageBg }}
            />
          )}
          <div className="max-h-[280px] overflow-y-auto">
            {shown.map((v) => (
              <label key={v} className="flex items-center gap-2 px-1.5 py-[5px] rounded-md cursor-pointer text-[13px] hover:bg-[#f6f7fb]" style={{ color: theme.ink }}>
                <input
                  type="checkbox"
                  checked={draft.has(v)}
                  onChange={(e) => {
                    const next = new Set(draft);
                    if (e.target.checked) next.add(v);
                    else next.delete(v);
                    setDraft(next);
                  }}
                />
                {renderOption(v)}
                <span className="ml-auto pl-3" style={{ color: theme.textFaint }}>
                  {counts.get(v) || 0}
                </span>
              </label>
            ))}
            {shown.length === 0 && (
              <p className="text-[12.5px] px-1.5 py-2" style={{ color: theme.textFaint }}>
                No matches
              </p>
            )}
          </div>
          <div className="flex items-center justify-between mt-1.5 pt-2" style={{ borderTop: `1px solid ${theme.divider}` }}>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onApply(new Set());
              }}
              className="text-[13px] font-semibold"
              style={{ color: theme.brand, border: 'none', background: 'none' }}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={close}
              className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-white"
              style={{ backgroundColor: theme.brand, border: 'none' }}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple click-to-open popover used for the single-choice menus (next due,
// saved views, row ⋯ actions).
function Popover({ button, children, align = 'left' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  return (
    <div className="relative" ref={ref}>
      {button({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div className={`${menuBox} ${align === 'right' ? 'left-auto right-0' : ''}`} style={menuStyle} onClick={(e) => e.stopPropagation()}>
          {children(close)}
        </div>
      )}
    </div>
  );
}

function MenuItem({ onClick, children, danger, to }) {
  const cls = 'block w-full text-left px-2.5 py-[7px] rounded-md text-[13px] hover:bg-[#f6f7fb]';
  const style = { color: danger ? theme.criticalStrong : theme.ink, border: 'none', background: 'none' };
  if (to) {
    return (
      <Link to={to} className={cls} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} style={style}>
      {children}
    </button>
  );
}

function toCsv(rows) {
  const cols = [
    ['equipment_no', 'No.'],
    ['name', 'Name'],
    ['model', 'Model'],
    ['serial_number', 'Serial'],
    ['location', 'Location'],
    ['location_category', 'Site'],
    ['next_calibration_date', 'Next due'],
    ['statusLabel', 'Status'],
  ];
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.map((c) => c[1]).join(','), ...rows.map((r) => cols.map(([k]) => esc(r[k])).join(','))].join('\n');
}

function downloadCsv(rows) {
  const withLabels = rows.map((r) => ({ ...r, statusLabel: STATUS_META[r.displayStatus]?.label || r.status }));
  // Leading BOM so Excel opens Thai text in the location field as UTF-8.
  const blob = new Blob(['﻿' + toCsv(withLabels)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `calibcare-equipment-${localToday()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const COLUMNS = [
  { label: 'Name', sortKey: 'name' },
  { label: 'Model', sortKey: 'model' },
  { label: 'Serial', sortKey: 'serial_number' },
  { label: 'Location', sortKey: 'location_category' },
  { label: 'Next due', sortKey: 'days_until_due' },
  { label: 'Status', sortKey: 'displayStatus' },
  { label: '' },
];

function SortIcon({ dir }) {
  const up = dir === 1 ? theme.brand : theme.textFainter;
  const down = dir === -1 ? theme.brand : theme.textFainter;
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 20V4M4 8l4-4 4 4" stroke={up} />
      <path d="M16 4v16M12 16l4 4 4-4" stroke={down} />
    </svg>
  );
}

export function EquipmentPage() {
  const { user } = useAuth();
  const canManage = Boolean(user?.can_edit);
  const [searchParams] = useSearchParams();

  const [rawItems, setRawItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [filters, setFilters] = useState(() => filtersFromParams(searchParams));
  const [grouped, setGrouped] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [drawerId, setDrawerId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const todayStr = localToday();

  // The whole register (163 rows) is loaded once and filtered client-side,
  // so the facet counts in every filter menu can be computed instantly.
  // The API caps a page at 200 -- fine at today's size, but if the register
  // ever grows past that this needs real paging or a higher cap.
  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await client.get('/api/equipment', { params: { limit: 200 } });
      setRawItems(data.equipment);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load equipment');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The top-bar search navigates here with ?q= -- keep the box in sync when
  // that happens while this page is already open.
  const urlQ = searchParams.get('q');
  useEffect(() => {
    if (urlQ != null) setQ(urlQ);
  }, [urlQ]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const items = useMemo(
    () =>
      rawItems.map((item) => {
        const days_until_due = item.next_calibration_date ? daysFrom(todayStr, item.next_calibration_date) : null;
        const withDays = { ...item, days_until_due };
        return { ...withDays, displayStatus: classify(withDays) };
      }),
    [rawItems, todayStr]
  );

  const typeOptions = useMemo(() => [...new Set(items.map((i) => i.name))].sort(), [items]);
  const locOptions = useMemo(() => [...new Set(items.map((i) => i.location_category).filter(Boolean))].sort(), [items]);

  function facetCounts(key, field) {
    const counts = new Map();
    for (const item of items) {
      if (!matches(item, filters, q, key)) continue;
      counts.set(item[field], (counts.get(item[field]) || 0) + 1);
    }
    return counts;
  }

  // Default order is urgency; clicking a column header sorts by it instead,
  // toggling asc -> desc -> back to urgency.
  const [sort, setSort] = useState({ key: null, dir: 1 });
  function cycleSort(key) {
    setSort((s) => (s.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : { key: null, dir: 1 }));
  }

  const rows = useMemo(() => {
    const urgency = (a, b) =>
      STATUS_ORDER.indexOf(a.displayStatus) - STATUS_ORDER.indexOf(b.displayStatus) ||
      (a.days_until_due ?? Infinity) - (b.days_until_due ?? Infinity) ||
      a.equipment_no - b.equipment_no;
    const byColumn = (a, b) => {
      const { key, dir } = sort;
      if (key === 'displayStatus') return dir * (STATUS_ORDER.indexOf(a.displayStatus) - STATUS_ORDER.indexOf(b.displayStatus)) || urgency(a, b);
      const av = a[key];
      const bv = b[key];
      // Blanks always sort last, whichever direction.
      if (av == null || av === '') return bv == null || bv === '' ? urgency(a, b) : 1;
      if (bv == null || bv === '') return -1;
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return dir * cmp || urgency(a, b);
    };
    return items.filter((item) => matches(item, filters, q)).sort(sort.key ? byColumn : urgency);
  }, [items, filters, q, sort]);

  const groups = useMemo(() => {
    if (!grouped) return null;
    const map = new Map();
    for (const row of rows) {
      if (!map.has(row.name)) map.set(row.name, []);
      map.get(row.name).push(row);
    }
    return [...map.entries()];
  }, [rows, grouped]);

  const pills = [
    ...[...filters.status].map((v) => ({ key: 'status', value: v, label: `Status: ${STATUS_META[v]?.label || v}` })),
    ...[...filters.type].map((v) => ({ key: 'type', value: v, label: `Type: ${v}` })),
    ...[...filters.loc].map((v) => ({ key: 'loc', value: v, label: `Location: ${v}` })),
    ...(filters.due ? [{ key: 'due', value: filters.due, label: `Due: ${DUE_OPTIONS[filters.due]}` }] : []),
    ...(q ? [{ key: 'q', value: q, label: `Search: ${q}` }] : []),
  ];

  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  // One-status shortcuts (header numbers and the tabs above the table).
  const onlyStatus = filters.status.size === 1 ? [...filters.status][0] : null;
  function showOnly(status) {
    setFilter('status', status ? new Set([status]) : new Set());
  }
  const statusTotals = useMemo(() => {
    const totals = {};
    for (const item of items) totals[item.displayStatus] = (totals[item.displayStatus] || 0) + 1;
    return totals;
  }, [items]);
  const tabCounts = facetCounts('status', 'displayStatus');
  const tabs = [
    { key: null, label: 'All', count: [...tabCounts.values()].reduce((a, b) => a + b, 0) },
    ...STATUS_ORDER.map((k) => ({ key: k, label: STATUS_META[k].label, count: tabCounts.get(k) || 0 })).filter((t) => t.count > 0 || t.key === onlyStatus),
  ];

  function removePill({ key, value }) {
    if (key === 'q') return setQ('');
    if (key === 'due') return setFilter('due', '');
    setFilters((f) => {
      const next = new Set(f[key]);
      next.delete(value);
      return { ...f, [key]: next };
    });
  }

  function clearAll() {
    setQ('');
    setFilters(emptyFilters());
  }

  function applyView(view) {
    setQ('');
    setFilters({
      ...emptyFilters(),
      status: new Set(view.filters.status || []),
      due: view.filters.due || '',
    });
    setToast(`Loaded view: ${view.label}`);
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allVisibleSelected = rows.length > 0 && rows.every((r) => selected.has(r.equipment_id));
  function toggleSelectAll() {
    setSelected(allVisibleSelected ? new Set() : new Set(rows.map((r) => r.equipment_id)));
  }

  async function updateStatus(ids, status, message) {
    setError('');
    try {
      await Promise.all(ids.map((id) => client.put(`/api/equipment/${id}`, { status })));
      setToast(message);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update status');
      load();
    }
  }

  async function sendForCalibration(ids) {
    const eligible = ids.filter((id) => {
      const item = items.find((i) => i.equipment_id === id);
      return item && item.status !== 'sent_for_calibration' && item.status !== 'decommissioned';
    });
    if (eligible.length === 0) {
      setToast('Nothing to send — already sent out or decommissioned');
      return;
    }
    await updateStatus(eligible, 'sent_for_calibration', `${eligible.length} marked as sent for calibration`);
    setSelected(new Set());
  }

  async function decommission(item) {
    if (!confirm(`Mark ${item.name} (${item.serial_number}) as decommissioned?`)) return;
    await updateStatus([item.equipment_id], 'decommissioned', 'Marked as decommissioned');
  }

  async function handleDelete(item) {
    if (!confirm(`Delete ${item.name} (${item.serial_number})? This also removes its capabilities and calibration history.`)) return;
    try {
      await client.delete(`/api/equipment/${item.equipment_id}`);
      if (drawerId === item.equipment_id) setDrawerId(null);
      setToast('Equipment deleted');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete equipment');
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      // Stored like the register's own entries: the site, plus the detail
      // in brackets when one is given -- e.g. "Head office (Woravit)".
      const { location_detail, ...rest } = form;
      const detail = location_detail.trim();
      await client.post('/api/equipment', { ...rest, location: detail ? `${form.location_category} (${detail})` : form.location_category });
      setShowForm(false);
      setForm(emptyForm);
      setToast('Equipment added');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create equipment');
    } finally {
      setSaving(false);
    }
  }

  const drawerItem = drawerId != null ? items.find((i) => i.equipment_id === drawerId) : null;
  const selectedRows = items.filter((i) => selected.has(i.equipment_id));

  const renderRow = (item) => (
    <EquipmentRow
      key={item.equipment_id}
      item={item}
      canManage={canManage}
      checked={selected.has(item.equipment_id)}
      onCheck={() => toggleSelect(item.equipment_id)}
      onOpen={() => setDrawerId(item.equipment_id)}
      onSend={() => sendForCalibration([item.equipment_id])}
      onDecommission={() => decommission(item)}
      onDelete={() => handleDelete(item)}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Equipment"
        stats={[
          { label: 'Overdue', value: statusTotals.overdue || 0, onClick: () => showOnly('overdue'), active: onlyStatus === 'overdue' },
          { label: 'Due within 30 days', value: statusTotals.soon || 0, onClick: () => showOnly('soon'), active: onlyStatus === 'soon' },
          {
            label: 'Sent for calibration',
            value: statusTotals.sent_for_calibration || 0,
            onClick: () => showOnly('sent_for_calibration'),
            active: onlyStatus === 'sent_for_calibration',
          },
        ]}
        actions={
          <div className="flex gap-2 flex-wrap">
            <DownloadExcelButton onDone={setToast} onError={setError} />
            {canManage && <HeaderButton onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : '+ Add equipment'}</HeaderButton>}
          </div>
        }
      >
        {pills.length > 0 && <FilterFeedback pills={pills} onRemove={removePill} onClear={clearAll} summary={`Showing ${rows.length} of ${items.length} devices`} />}
      </PageHeader>

      {error && (
        <div className="rounded-[10px] px-4 py-2.5 text-sm" style={{ backgroundColor: theme.criticalBg, color: theme.criticalStrong }}>
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="grid grid-cols-1 md:grid-cols-2 items-start gap-3 p-[18px] rounded-2xl bg-white"
          style={{ border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}
        >
          <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
          <input
            required
            placeholder="Serial number"
            value={form.serial_number}
            onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
            className="input"
          />
          <input placeholder="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="input" />
          <div className="flex flex-col gap-2">
            <select
              required
              value={form.location_category}
              onChange={(e) => setForm({ ...form, location_category: e.target.value })}
              className="input"
              style={{ color: form.location_category ? undefined : theme.textFaint }}
              aria-label="Location"
            >
              <option value="" disabled>
                Location (select a site)
              </option>
              {LOCATION_SITES.map((site) => (
                <option key={site} value={site} style={{ color: theme.ink }}>
                  {site}
                </option>
              ))}
            </select>
            <input
              placeholder="Location detail, e.g. person's name (optional)"
              value={form.location_detail}
              onChange={(e) => setForm({ ...form, location_detail: e.target.value })}
              className="input"
            />
          </div>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input">
            {EDITABLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
          <div className="md:col-span-2">
            <button
              disabled={saving}
              className="rounded-[10px] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: theme.brand, border: 'none' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div
          className="flex items-center gap-2 rounded-[10px] px-3.5 py-[9px] bg-white"
          style={{ border: `1px solid ${theme.borderStrong}`, flex: '1 1 240px', maxWidth: 'min(340px, 100%)' }}
        >
          <SearchIcon size={15} color={theme.textFaint} />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, model or serial"
            className="text-[13px] flex-1 outline-none min-w-0"
            style={{ color: theme.ink, border: 'none' }}
          />
        </div>

        <MultiFilter
          label="Status"
          options={STATUS_ORDER}
          selected={filters.status}
          counts={facetCounts('status', 'displayStatus')}
          renderOption={(v) => STATUS_META[v].label}
          onApply={(v) => setFilter('status', v)}
        />
        <MultiFilter label="Type" options={typeOptions} selected={filters.type} counts={facetCounts('type', 'name')} onApply={(v) => setFilter('type', v)} />
        <MultiFilter
          label="Location"
          options={locOptions}
          selected={filters.loc}
          counts={facetCounts('loc', 'location_category')}
          onApply={(v) => setFilter('loc', v)}
        />

        <Popover
          button={({ toggle }) => (
            <button type="button" onClick={toggle} className={chipBase} style={chipStyle(Boolean(filters.due))}>
              Next due{filters.due ? `: ${DUE_OPTIONS[filters.due]}` : ''}
              <ChevronDownIcon size={11} />
            </button>
          )}
        >
          {(close) =>
            Object.entries(DUE_OPTIONS).map(([k, v]) => (
              <label key={k} className="flex items-center gap-2 px-1.5 py-[5px] rounded-md cursor-pointer text-[13px] hover:bg-[#f6f7fb]">
                <input
                  type="radio"
                  name="due"
                  checked={filters.due === k}
                  onChange={() => {
                    setFilter('due', k);
                    close();
                  }}
                />
                {v}
              </label>
            ))
          }
        </Popover>

        <div className="w-px h-[22px] mx-0.5" style={{ backgroundColor: theme.borderStrong }} />

        <label className={`${chipBase} cursor-pointer`} style={chipStyle(grouped)}>
          <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />
          Group by type
        </label>

        <Popover
          button={({ toggle }) => (
            <button type="button" onClick={toggle} className={chipBase} style={chipStyle(false)}>
              ★ Saved views
              <ChevronDownIcon size={11} />
            </button>
          )}
        >
          {(close) =>
            SAVED_VIEWS.map((view) => (
              <MenuItem
                key={view.label}
                onClick={() => {
                  applyView(view);
                  close();
                }}
              >
                {view.label}
              </MenuItem>
            ))
          }
        </Popover>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2.5 rounded-[10px] px-3.5 py-2 text-[13px]" style={{ backgroundColor: theme.ink, color: '#fff' }}>
          <b>{selected.size} selected</b>
          {canManage && (
            <button
              type="button"
              onClick={() => sendForCalibration([...selected])}
              className="rounded-lg px-3 py-1 font-semibold"
              style={{ backgroundColor: '#fff', color: theme.ink, border: 'none' }}
            >
              Send for calibration
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              downloadCsv(selectedRows);
              setToast(`Exported ${selectedRows.length} rows`);
            }}
            className="rounded-lg px-3 py-1 font-semibold"
            style={{ backgroundColor: 'rgba(255,255,255,.12)', color: '#fff', border: '1px solid rgba(255,255,255,.25)' }}
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto font-semibold"
            style={{ color: '#fff', border: 'none', background: 'none' }}
          >
            Deselect
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
        <div role="tablist" aria-label="Filter by status" className="flex items-center gap-1 px-4 pt-3 overflow-x-auto" style={{ borderBottom: `1px solid ${theme.border}` }}>
          {tabs.map((t) => {
            const active = t.key === onlyStatus && (t.key !== null || filters.status.size === 0);
            return (
              <button
                key={t.label}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => showOnly(t.key)}
                className="flex items-center gap-2 px-3 pb-3 pt-1.5 text-[13px] whitespace-nowrap"
                style={{
                  color: active ? theme.ink : theme.textMuted,
                  fontWeight: active ? 700 : 500,
                  border: 'none',
                  background: 'none',
                  boxShadow: active ? `inset 0 -2.5px 0 ${theme.brand}` : 'none',
                }}
              >
                {t.label}
                <span
                  className="rounded-full px-[7px] py-px text-[11px] font-bold"
                  style={{ backgroundColor: active ? theme.brand : theme.chipBg, color: active ? '#fff' : theme.textMuted }}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ backgroundColor: '#fafbfd' }}>
                <th className="w-10 pl-4" style={{ borderBottom: `1px solid ${theme.border}` }}>
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} aria-label="Select all shown" />
                </th>
                {COLUMNS.map((col, i) => (
                  <th
                    key={i}
                    className="text-left text-[10.5px] font-bold tracking-wide uppercase px-3 py-3"
                    style={{ color: theme.textFaint, borderBottom: `1px solid ${theme.border}` }}
                  >
                    {col.sortKey ? (
                      <button
                        type="button"
                        onClick={() => cycleSort(col.sortKey)}
                        className="flex items-center gap-1.5 uppercase tracking-wide font-bold"
                        style={{ color: sort.key === col.sortKey ? theme.brand : theme.textFaint, background: 'none', border: 'none', padding: 0 }}
                        title={`Sort by ${col.label.toLowerCase()}`}
                      >
                        {col.label}
                        <SortIcon dir={sort.key === col.sortKey ? sort.dir : 0} />
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading &&
                [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <tr key={`sk-${i}`} style={{ borderBottom: `1px solid ${theme.divider}` }}>
                    <td className="pl-4 py-[14px]">
                      <Skeleton style={{ width: 14, height: 14, borderRadius: 4 }} />
                    </td>
                    {[150, 90, 110, 100, 130, 80, 40].map((w, j) => (
                      <td key={j} className="px-3 py-[14px]">
                        <Skeleton style={{ width: w, height: 12 }} />
                      </td>
                    ))}
                  </tr>
                ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-[13px]" style={{ color: theme.textMuted }}>
                    No devices match these filters.{' '}
                    <button type="button" onClick={clearAll} className="font-semibold" style={{ color: theme.brand, border: 'none', background: 'none' }}>
                      Clear all filters
                    </button>
                  </td>
                </tr>
              )}
              {groups
                ? groups.map(([name, groupRows]) => [
                    <tr key={`g-${name}`} style={{ backgroundColor: theme.pageBg }}>
                      <td colSpan={8} className="px-4 py-2 text-[12.5px] font-bold" style={{ color: theme.ink, borderBottom: `1px solid ${theme.divider}` }}>
                        {name} <span style={{ color: theme.textFaint, fontWeight: 600 }}>· {groupRows.length}</span>
                      </td>
                    </tr>,
                    ...groupRows.map(renderRow),
                  ])
                : rows.map(renderRow)}
            </tbody>
          </table>
        </div>
      </div>

      {drawerItem && (
        <Drawer
          item={drawerItem}
          canManage={canManage}
          onClose={() => setDrawerId(null)}
          onSend={() => sendForCalibration([drawerItem.equipment_id])}
        />
      )}

      <div
        role="status"
        className="fixed left-1/2 bottom-5 -translate-x-1/2 rounded-[10px] px-4 py-2 text-[13px] z-50 pointer-events-none"
        style={{ backgroundColor: theme.ink, color: '#fff', opacity: toast ? 1 : 0, transition: 'opacity .2s' }}
      >
        {toast}
      </div>
    </div>
  );
}

function EquipmentRow({ item, canManage, checked, onCheck, onOpen, onSend, onDecommission, onDelete }) {
  const dim = item.status === 'decommissioned';
  const cell = 'px-3 py-[10px] text-[13px]';
  return (
    <tr onClick={onOpen} className="cursor-pointer hover:bg-[#f9fafc]" style={{ borderBottom: `1px solid ${theme.divider}`, opacity: dim ? 0.55 : 1 }}>
      <td className="pl-4 py-[10px]" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={checked} onChange={onCheck} aria-label={`Select ${item.name} ${item.serial_number}`} />
      </td>
      <td className={cell}>
        <span className="font-semibold" style={{ color: theme.brand }}>
          {item.name}
        </span>
      </td>
      <td className={cell} style={{ color: theme.textMuted }}>
        {item.model || '—'}
      </td>
      <td className={cell} style={{ color: theme.textMuted }}>
        {item.serial_number}
      </td>
      <td className={`${cell} whitespace-nowrap`} style={{ color: theme.textMuted }}>
        {item.location_category || item.location || '—'}
      </td>
      <td className={`${cell} whitespace-nowrap`} style={{ color: theme.textMuted }}>
        <DueText item={item} />
      </td>
      <td className={cell}>
        <Badge statusKey={item.displayStatus} />
      </td>
      <td className="pr-4 py-[10px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={onOpen}
            className="rounded-lg px-3 py-1 text-[12px] font-semibold hover:bg-[#eaf0ff]"
            style={{ color: theme.brand, border: `1px solid #cddaf9`, background: '#fff' }}
          >
            View
          </button>
          <Popover
            align="right"
            button={({ toggle }) => (
              <button
                type="button"
                onClick={toggle}
                aria-label="More actions"
                className="w-7 h-7 rounded-[7px] text-[16px] font-bold leading-none hover:bg-[#f3f5fa]"
                style={{ color: theme.textMuted, border: 'none', background: 'none' }}
              >
                ⋯
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuItem to={`/equipment/${item.equipment_id}`}>Open full page & history</MenuItem>
                {canManage && (
                  <>
                    <MenuItem to={`/equipment/${item.equipment_id}`}>Edit</MenuItem>
                    {item.status !== 'sent_for_calibration' && !dim && (
                      <MenuItem
                        onClick={() => {
                          close();
                          onSend();
                        }}
                      >
                        Send for calibration
                      </MenuItem>
                    )}
                    {!dim && (
                      <MenuItem
                        onClick={() => {
                          close();
                          onDecommission();
                        }}
                      >
                        Decommission
                      </MenuItem>
                    )}
                    <MenuItem
                      danger
                      onClick={() => {
                        close();
                        onDelete();
                      }}
                    >
                      Delete
                    </MenuItem>
                  </>
                )}
              </>
            )}
          </Popover>
        </div>
      </td>
    </tr>
  );
}

// Thai headings copied from the FP-ENG-05-01 register, same as the
// capabilities table on the equipment page.
const CAPABILITY_FIELDS = [
  ['measurement_range', 'ช่วงในการวัดของเครื่องมือวัด'],
  ['instrument_accuracy', 'ค่าผิดพลาดของเครื่องมือวัด'],
  ['product_operating_range', 'ช่วงในการใช้งานของผลิตภัณฑ์'],
  ['acceptance_criteria', 'เกณฑ์การยอมรับของผลิตภัณฑ์'],
];

function DrawerHeading({ children }) {
  return (
    <div className="text-[13px] font-bold mt-6 mb-2" style={{ color: theme.ink }}>
      {children}
    </div>
  );
}

function Drawer({ item, canManage, onClose, onSend }) {
  const canSend = canManage && item.status !== 'sent_for_calibration' && item.status !== 'decommissioned';
  const id = item.equipment_id;
  // Capabilities and history aren't in the list rows, so the drawer fetches
  // them itself -- everything is readable here without opening the page.
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setDetail(null);
    setError('');
    Promise.all([client.get(`/api/equipment/${id}`), client.get(`/api/equipment/${id}/calibrations`)])
      .then(([{ data: equipment }, { data: calibrations }]) => setDetail({ capabilities: equipment.capabilities, calibrations }))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load this device'));
  }, [id]);

  async function downloadCertificate(c) {
    try {
      const { data } = await client.get(`/api/equipment/${id}/calibrations/${c.calibration_id}/certificate`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = c.certificate_filename || 'certificate.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download certificate');
    }
  }

  const latest = detail?.calibrations[0];
  const fields = [
    ['Serial', item.serial_number],
    ['Model', item.model],
    ['Category', item.category],
    ['Site', item.location_category],
    ['Location', item.location],
    ['Last calibrated', latest?.calibration_date],
    ['Calibrated by', latest?.responsible_person],
    ['Next due', <DueText key="due" item={item} />],
    ['Note', item.status_note],
  ];

  return (
    <SideDrawer
      label="Equipment details"
      title={item.name}
      description={<Badge statusKey={item.displayStatus} />}
      onClose={onClose}
      width={480}
      footer={
        <>
          {canSend && (
            <button
              type="button"
              onClick={onSend}
              className="rounded-[10px] px-4 py-2 text-[13px] font-semibold text-white"
              style={{ backgroundColor: theme.brand, border: 'none' }}
            >
              Send for calibration
            </button>
          )}
          <Link
            to={`/equipment/${item.equipment_id}`}
            className="rounded-[10px] px-4 py-2 text-[13px] font-semibold"
            style={{ border: `1px solid ${theme.borderStrong}`, color: theme.ink }}
          >
            {canManage ? 'Open & edit →' : 'Open full page →'}
          </Link>
        </>
      }
    >
      <dl className="grid gap-x-3 gap-y-2.5 text-[13px]" style={{ gridTemplateColumns: '110px 1fr' }}>
        {fields.map(([label, value]) => (
          <div key={label} className="contents">
            <dt style={{ color: theme.textMuted }}>{label}</dt>
            <dd style={{ color: theme.ink }}>{value || '—'}</dd>
          </div>
        ))}
      </dl>

      {error && (
        <div className="rounded-[10px] px-4 py-2.5 text-sm mt-5" style={{ backgroundColor: theme.criticalBg, color: theme.criticalStrong }}>
          {error}
        </div>
      )}
      {!detail && !error && (
        <div className="flex flex-col gap-3 mt-6">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} style={{ height: 14, width: `${90 - i * 9}%` }} />
          ))}
        </div>
      )}
      {detail && (
        <>
          <DrawerHeading>Capabilities ({detail.capabilities.length})</DrawerHeading>
          {detail.capabilities.length === 0 ? (
            <p className="text-[13px]" style={{ color: theme.textFaint }}>No measurement capabilities recorded.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {detail.capabilities.map((c) => (
                <div key={c.capability_id} className="rounded-[10px] px-3.5 py-3" style={{ border: `1px solid ${theme.divider}` }}>
                  <div className="text-[13.5px] font-semibold mb-1.5" style={{ color: theme.inkAlt }}>
                    {c.measurement_purpose}
                  </div>
                  <dl className="grid gap-x-3 gap-y-1 text-[12.5px]" style={{ gridTemplateColumns: '170px 1fr' }}>
                    {CAPABILITY_FIELDS.map(([key, label]) => (
                      <div key={key} className="contents">
                        <dt style={{ color: theme.textMuted }}>{label}</dt>
                        <dd style={{ color: theme.ink }}>{c[key] || '—'}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          )}

          <DrawerHeading>Calibration history ({detail.calibrations.length})</DrawerHeading>
          {detail.calibrations.length === 0 ? (
            <p className="text-[13px]" style={{ color: theme.textFaint }}>No calibrations recorded yet.</p>
          ) : (
            <ul className="flex flex-col">
              {detail.calibrations.map((c) => (
                <li key={c.calibration_id} className="flex items-start justify-between gap-3 py-2.5" style={{ borderTop: `1px solid ${theme.divider}` }}>
                  <div className="text-[13px]">
                    <div className="font-semibold" style={{ color: theme.ink }}>{c.calibration_date}</div>
                    <div className="text-[12.5px]" style={{ color: theme.textMuted }}>
                      Next due {c.next_calibration_date || '—'}
                      {c.responsible_person ? ` · ${c.responsible_person}` : ''}
                    </div>
                    {c.notes && <div className="text-[12.5px]" style={{ color: theme.textMuted }}>{c.notes}</div>}
                  </div>
                  {c.certificate_filename ? (
                    <button
                      type="button"
                      onClick={() => downloadCertificate(c)}
                      className="shrink-0 rounded-lg px-2.5 py-1 text-[12px] font-semibold"
                      style={{ border: `1px solid ${theme.borderStrong}`, color: theme.brand, background: '#fff' }}
                    >
                      PDF ↓
                    </button>
                  ) : (
                    <span className="shrink-0 text-[12px]" style={{ color: theme.textFaint }}>No certificate</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </SideDrawer>
  );
}

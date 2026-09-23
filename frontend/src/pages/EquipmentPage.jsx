import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { SearchIcon, ChevronDownIcon, ChevronRightIcon, EyeIcon, PencilIcon, TrashIcon } from '../components/icons';

const PAGE_SIZE = 15;
const STATUS_OPTIONS = ['active', 'under_maintenance', 'decommissioned', 'sent_for_calibration'];

// Every status a piece of equipment can carry, plus the derived "overdue"
// state (active equipment whose next calibration date has passed) used for
// row/group status pills and due-date coloring.
const STATUS_META = {
  active: { label: 'Active', color: theme.good, bg: theme.goodBg },
  under_maintenance: { label: 'Under Maintenance', color: theme.warning, bg: theme.warningBg },
  decommissioned: { label: 'Decommissioned', color: theme.textMuted, bg: theme.chipBg },
  sent_for_calibration: { label: 'Sent for Calibration', color: '#1d4ed8', bg: '#e8edfd' },
  overdue: { label: 'Overdue', color: theme.criticalStrong, bg: theme.criticalBgStrong },
};

const emptyForm = { name: '', model: '', serial_number: '', location: '', status: 'active' };

// A unit counts as overdue when it's still active but its most recent
// calibration's next-due date has already passed -- distinct from its raw
// `status` column, same "derived overdue" concept the Dashboard page uses.
function classify(item, todayStr) {
  if (item.status === 'active' && item.next_calibration_date && item.next_calibration_date < todayStr) return 'overdue';
  return item.status;
}

function Pill({ statusKey, count, small }) {
  const meta = STATUS_META[statusKey] || { label: statusKey, color: theme.textMuted, bg: theme.chipBg };
  return (
    <span
      className={`font-bold rounded-full inline-block ${small ? 'text-[10.5px] px-[9px] py-[3px]' : 'text-[11px] px-[11px] py-1'}`}
      style={{ color: meta.color, backgroundColor: meta.bg }}
    >
      {count != null ? `${count} ${meta.label}` : meta.label}
    </span>
  );
}

function StatusPills({ items, todayStr }) {
  const counts = new Map();
  for (const item of items) {
    const key = classify(item, todayStr);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return (
    <div className="flex flex-wrap gap-[5px]">
      {entries.map(([key, count]) => (
        <Pill key={key} statusKey={key} count={count} small />
      ))}
    </div>
  );
}

function RowActions({ id, canManage, onDelete, size = 15 }) {
  const iconBtn = 'w-7 h-7 rounded-[7px] flex items-center justify-center';
  return (
    <div className="inline-flex gap-0.5">
      <Link to={`/equipment/${id}`} className={iconBtn} style={{ color: theme.textFaint }}>
        <EyeIcon size={size} />
      </Link>
      {canManage && (
        <Link to={`/equipment/${id}`} className={iconBtn} style={{ color: theme.textFaint }}>
          <PencilIcon size={size} />
        </Link>
      )}
      {canManage && (
        <button type="button" onClick={() => onDelete(id)} className={iconBtn} style={{ color: theme.textFaint, border: 'none', background: 'none' }}>
          <TrashIcon size={size} />
        </button>
      )}
    </div>
  );
}

function FilterSelect({ value, onChange, children }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className="appearance-none rounded-[10px] pl-[13px] pr-8 py-[9px] text-[13px] font-semibold"
        style={{ border: `1px solid ${theme.borderStrong}`, color: '#38415a', backgroundColor: '#fff' }}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: '#38415a' }}>
        <ChevronDownIcon size={11} />
      </span>
    </div>
  );
}

export function EquipmentPage() {
  const { user } = useAuth();
  const canManage = Boolean(user?.can_edit);

  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  // Filters by the clean 7-site grouping (location_category), not the raw
  // `location` free text (46 distinct values) -- see
  // database/add_location_category.sql. `location` itself is unaffected;
  // the table/detail pages keep showing it exactly as sourced.
  const [locationCategory, setLocationCategory] = useState('');
  // Dashboard's "Available" KPI card links here with ?view=available --
  // "available" isn't a real status value (it's active equipment that
  // ISN'T overdue), so on top of the status=active filter this also
  // excludes overdue equipment client-side, same derivation classify()
  // already does per-row.
  const [excludeOverdue] = useState(searchParams.get('view') === 'available');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [groupBy, setGroupBy] = useState(true);
  const [expanded, setExpanded] = useState(new Set());
  const [page, setPage] = useState(0);

  const todayStr = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { limit: 200 };
      if (q) params.q = q;
      if (status) params.status = status;
      if (locationCategory) params.location_category = locationCategory;
      const { data } = await client.get('/api/equipment', { params });
      setItems(data.equipment);
      setTotal(data.total);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load equipment');
    } finally {
      setLoading(false);
    }
  }, [q, status, locationCategory]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(0);
  }, [q, status, locationCategory, groupBy]);

  const visibleItems = useMemo(
    () => (excludeOverdue ? items.filter((item) => classify(item, todayStr) !== 'overdue') : items),
    [items, excludeOverdue, todayStr]
  );

  const locationCategoryOptions = useMemo(
    () => [...new Set(visibleItems.map((i) => i.location_category).filter(Boolean))].sort(),
    [visibleItems]
  );

  // Top-level display rows: a "singleton" row per equipment when it's the
  // only unit sharing its name+model, or when grouping is off; a "group"
  // row for two or more units sharing name+model, expandable to reveal
  // each unit. Insertion order follows the API's equipment_no ordering.
  const topLevelRows = useMemo(() => {
    if (!groupBy) return visibleItems.map((item) => ({ type: 'singleton', item }));
    const groups = new Map();
    for (const item of visibleItems) {
      const key = `${item.name}|${item.model || ''}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    return [...groups.entries()].map(([key, groupItems]) =>
      groupItems.length === 1 ? { type: 'singleton', item: groupItems[0] } : { type: 'group', key, items: groupItems }
    );
  }, [visibleItems, groupBy]);

  const pageCount = Math.max(1, Math.ceil(topLevelRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = topLevelRows.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);
  const unitsShown = pageRows.reduce((sum, row) => sum + (row.type === 'group' ? row.items.length : 1), 0);
  // The API's `total` counts every status=active row, including overdue
  // ones the available-view then filters out client-side -- use the
  // post-filter count here so the header/footer numbers actually match
  // what's on screen.
  const displayTotal = excludeOverdue ? visibleItems.length : total;

  function toggleExpand(key) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await client.post('/api/equipment', form);
      setShowForm(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create equipment');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this equipment? This also removes its capabilities and calibration history.')) return;
    try {
      await client.delete(`/api/equipment/${id}`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete equipment');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h1 className="text-[23px] font-bold" style={{ color: theme.ink }}>
            Equipment
          </h1>
          <span className="text-[15px] font-medium" style={{ color: theme.textFaint }}>
            {displayTotal} total
          </span>
        </div>
        {canManage && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-2 text-white rounded-[10px] px-[18px] py-2.5 text-[13.5px] font-semibold"
            style={{ backgroundColor: '#182448', border: 'none' }}
          >
            {showForm ? 'Cancel' : '+ Add Equipment'}
          </button>
        )}
      </div>

      {excludeOverdue && (
        <div className="rounded-[10px] px-4 py-2.5 text-[13px]" style={{ backgroundColor: theme.goodBg, color: '#0a7a45' }}>
          Showing available equipment — active and not overdue for calibration.
        </div>
      )}

      {error && (
        <div className="rounded-[10px] px-4 py-2.5 text-sm" style={{ backgroundColor: theme.criticalBg, color: theme.criticalStrong }}>
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="grid grid-cols-2 gap-3 p-[18px] rounded-2xl bg-white"
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
          <input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="input" />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input">
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
          <div className="col-span-2">
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

      <div className="flex items-center gap-2.5 flex-wrap">
        <div
          className="flex items-center gap-2 rounded-[10px] px-3.5 py-2.5"
          style={{ border: `1px solid ${theme.borderStrong}`, backgroundColor: '#fff', flex: '0 1 300px' }}
        >
          <SearchIcon size={15} color={theme.textFaint} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, model, or serial…"
            className="text-[13px] flex-1 outline-none"
            style={{ color: theme.ink, border: 'none' }}
          />
        </div>

        <FilterSelect value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect value={locationCategory} onChange={(e) => setLocationCategory(e.target.value)}>
          <option value="">All locations</option>
          {locationCategoryOptions.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </FilterSelect>

        <div className="w-px h-[22px]" style={{ backgroundColor: theme.borderStrong }} />

        <button
          type="button"
          onClick={() => setGroupBy((g) => !g)}
          className="flex items-center gap-2 rounded-[10px] px-[13px] py-2"
          style={{
            border: `1px solid ${groupBy ? '#cddaf9' : theme.borderStrong}`,
            backgroundColor: groupBy ? '#eaf0ff' : '#fff',
          }}
        >
          <span className="text-[13px] font-semibold" style={{ color: groupBy ? '#1d3a8f' : '#38415a' }}>
            Group by: Equipment type
          </span>
          <span
            className="inline-flex items-center rounded-full relative"
            style={{ width: 30, height: 17, backgroundColor: groupBy ? theme.brand : '#d5d8e2' }}
          >
            <span
              className="rounded-full bg-white absolute"
              style={{ width: 13, height: 13, top: 2, left: groupBy ? 15 : 2, transition: 'left 0.15s' }}
            />
          </span>
        </button>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden flex flex-col" style={{ border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ backgroundColor: '#fafbfd' }}>
                <th className="w-11" style={{ borderBottom: `1px solid ${theme.border}` }} />
                {['Name', 'Serial', 'Location', 'Next Due', 'Status'].map((h) => (
                  <th
                    key={h}
                    className="text-left text-[10.5px] font-bold tracking-wide uppercase px-3 py-3"
                    style={{ color: theme.textFaint, borderBottom: `1px solid ${theme.border}` }}
                  >
                    {h}
                  </th>
                ))}
                <th
                  className="text-right text-[10.5px] font-bold tracking-wide uppercase px-3 py-3 pr-5"
                  style={{ color: theme.textFaint, borderBottom: `1px solid ${theme.border}` }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-6" style={{ color: theme.textFaint }}>
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && pageRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-6" style={{ color: theme.textFaint }}>
                    No equipment found
                  </td>
                </tr>
              )}
              {pageRows.map((row) =>
                row.type === 'singleton' ? (
                  <SingletonRow key={row.item.equipment_id} item={row.item} todayStr={todayStr} canManage={canManage} onDelete={handleDelete} />
                ) : (
                  <GroupRows
                    key={row.key}
                    groupKey={row.key}
                    items={row.items}
                    todayStr={todayStr}
                    canManage={canManage}
                    onDelete={handleDelete}
                    isExpanded={expanded.has(row.key)}
                    onToggle={() => toggleExpand(row.key)}
                  />
                )
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderTop: `1px solid ${theme.divider}` }}>
          <span className="text-[12.5px]" style={{ color: theme.textFaint }}>
            {pageRows.length} row{pageRows.length === 1 ? '' : 's'} shown · {unitsShown} physical unit{unitsShown === 1 ? '' : 's'} · {displayTotal} total
            {excludeOverdue ? ' available' : ' in inventory'}
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
  );
}

function SingletonRow({ item, todayStr, canManage, onDelete }) {
  const statusKey = classify(item, todayStr);
  const isOverdue = statusKey === 'overdue';
  return (
    <tr style={{ borderBottom: `1px solid ${theme.divider}` }}>
      <td className="pl-5 py-[11px]" style={{ color: '#d5d8e2' }}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="3" />
        </svg>
      </td>
      <td className="px-3 py-[11px]">
        <Link to={`/equipment/${item.equipment_id}`} className="text-[13px] font-semibold" style={{ color: theme.brand }}>
          {item.name}
        </Link>
      </td>
      <td className="px-3 py-[11px] text-[13px]" style={{ color: theme.textMuted }}>
        {item.serial_number}
      </td>
      <td className="px-3 py-[11px] text-[13px]" style={{ color: theme.textMuted }}>
        {item.location || '—'}
      </td>
      <td className="px-3 py-[11px] text-[13px]" style={{ color: isOverdue ? theme.criticalStrong : theme.textMuted, fontWeight: isOverdue ? 700 : 400 }}>
        {item.next_calibration_date || '—'}
      </td>
      <td className="px-3 py-[11px]">
        <Pill statusKey={statusKey} />
      </td>
      <td className="pr-5 py-[11px] text-right">
        <RowActions id={item.equipment_id} canManage={canManage} onDelete={onDelete} />
      </td>
    </tr>
  );
}

function GroupRows({ groupKey, items, todayStr, canManage, onDelete, isExpanded, onToggle }) {
  const locations = new Set(items.map((i) => i.location).filter(Boolean));
  const locationLabel = locations.size === 0 ? '—' : locations.size === 1 ? [...locations][0] : `${locations.size} locations`;
  const dueDates = items.map((i) => i.next_calibration_date).filter(Boolean);
  const earliestDue = dueDates.length ? dueDates.reduce((a, b) => (a < b ? a : b)) : null;
  const isOverdue = earliestDue && earliestDue < todayStr;

  return (
    <>
      <tr style={{ backgroundColor: '#fafbfd', borderBottom: `1px solid ${theme.divider}` }}>
        <td className="pl-5 py-[11px]" style={{ color: '#7a8296' }}>
          {isExpanded ? <ChevronDownIcon size={13} color={theme.brand} /> : <ChevronRightIcon size={13} color="#7a8296" />}
        </td>
        <td className="px-3 py-[11px] text-[13px] font-bold" style={{ color: theme.ink }}>
          {groupKey.split('|')[0]}
        </td>
        <td className="px-3 py-[11px] text-[12.5px] font-semibold" style={{ color: '#7a8296' }}>
          {items.length} units
        </td>
        <td className="px-3 py-[11px] text-[12.5px]" style={{ color: '#7a8296' }}>
          {locationLabel}
        </td>
        <td className="px-3 py-[11px] text-[12.5px]" style={{ color: isOverdue ? theme.criticalStrong : '#7a8296', fontWeight: isOverdue ? 700 : 400 }}>
          {earliestDue || '—'}
        </td>
        <td className="px-3 py-[11px]">
          <StatusPills items={items} todayStr={todayStr} />
        </td>
        <td className="pr-5 py-[11px] text-right">
          <button type="button" onClick={onToggle} className="text-[12px] font-semibold" style={{ color: isExpanded ? '#7a8296' : theme.brand, border: 'none', background: 'none' }}>
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
        </td>
      </tr>
      {isExpanded &&
        items.map((item) => {
          const statusKey = classify(item, todayStr);
          const isChildOverdue = statusKey === 'overdue';
          return (
            <tr key={item.equipment_id} style={{ backgroundColor: '#fafbfd', borderBottom: `1px solid ${theme.divider}` }}>
              <td className="pl-5 py-[9px]">
                <div className="ml-[6px] w-[1.5px] h-full" style={{ backgroundColor: theme.borderStrong }} />
              </td>
              <td className="pl-[22px] pr-3 py-[9px] text-[12.5px]" style={{ color: theme.textMuted, borderLeft: `2px solid ${theme.borderStrong}` }}>
                {item.serial_number}
              </td>
              <td className="px-3 py-[9px]" />
              <td className="px-3 py-[9px] text-[12.5px]" style={{ color: theme.textMuted }}>
                {item.location || '—'}
              </td>
              <td
                className="px-3 py-[9px] text-[12.5px]"
                style={{ color: isChildOverdue ? theme.criticalStrong : theme.textMuted, fontWeight: isChildOverdue ? 700 : 400 }}
              >
                {item.next_calibration_date || '—'}
              </td>
              <td className="px-3 py-[9px]">
                <Pill statusKey={statusKey} small />
              </td>
              <td className="pr-5 py-[9px] text-right">
                <RowActions id={item.equipment_id} canManage={canManage} onDelete={onDelete} size={14} />
              </td>
            </tr>
          );
        })}
    </>
  );
}

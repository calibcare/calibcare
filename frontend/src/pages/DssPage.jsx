import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { theme } from '../theme';
import { PlusIcon, ChevronDownIcon, CheckCircleIcon, AlertTriangleIcon } from '../components/icons';

const emptyRequirement = () => ({ measurement_purpose: '', min: '', max: '', unit: '' });
const GROUP_PAGE_SIZE = 4;

function FieldLabel({ children }) {
  return (
    <label className="block text-[12px] font-semibold mb-[7px]" style={{ color: theme.textMuted }}>
      {children}
    </label>
  );
}

const fieldStyle = { border: `1px solid ${theme.borderStrong}`, borderRadius: 9, padding: '10px 13px', fontSize: 14, color: theme.ink, width: '100%', boxSizing: 'border-box', height: 41 };
// Native <select> chrome (the OS-drawn dropdown arrow/padding) renders at a
// different intrinsic size than a plain <input> even with identical CSS
// width -- appearance:none strips that so the purpose/unit selects end up
// pixel-identical in size to the min/max number inputs.
const selectStyle = { ...fieldStyle, appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none' };

export function DssPage() {
  const [purposes, setPurposes] = useState([]);
  const [unitsCache, setUnitsCache] = useState({});
  const [requirements, setRequirements] = useState([emptyRequirement()]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    client
      .get('/api/dss/purposes')
      .then(({ data }) => setPurposes(data))
      .catch(() => {});
  }, []);

  // Auto-select a row's unit when its purpose only has one valid unit --
  // matches the mockup's "AC Current -> amp only" example without making
  // the user pick from a one-item dropdown.
  useEffect(() => {
    setRequirements((rows) =>
      rows.map((r) => {
        const units = unitsCache[r.measurement_purpose];
        if (r.measurement_purpose && units && units.length === 1 && !r.unit) {
          return { ...r, unit: units[0].value };
        }
        return r;
      })
    );
  }, [unitsCache]);

  async function ensureUnitsLoaded(purpose) {
    if (!purpose || unitsCache[purpose]) return;
    try {
      const { data } = await client.get('/api/dss/units', { params: { purpose } });
      setUnitsCache((prev) => ({ ...prev, [purpose]: data }));
    } catch {
      setUnitsCache((prev) => ({ ...prev, [purpose]: [] }));
    }
  }

  function handlePurposeChange(i, purpose) {
    setRequirements((rows) => rows.map((r, idx) => (idx === i ? { ...r, measurement_purpose: purpose, unit: '' } : r)));
    ensureUnitsLoaded(purpose);
  }

  function updateRequirement(i, field, value) {
    setRequirements((rows) => rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    setRequirements((rows) => [...rows, emptyRequirement()]);
  }

  function removeRow(i) {
    setRequirements((rows) => rows.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const payload = {
        requirements: requirements.map((r) => ({
          measurement_purpose: r.measurement_purpose,
          min: Number(r.min),
          max: Number(r.max),
          unit: r.unit,
        })),
      };
      const { data } = await client.post('/api/dss/match', payload);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to run match');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[23px] font-bold mb-1.5" style={{ color: theme.ink }}>
          Decision Support System
        </h1>
        <p className="text-sm" style={{ color: '#7a8296' }}>
          Enter the calibration requirements for this job and find suitable equipment.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-[22px_24px] flex flex-col gap-2" style={{ border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
        {requirements.map((r, i) => {
          const units = unitsCache[r.measurement_purpose] || [];
          return (
            <div key={i} className="grid gap-4 items-end" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr auto' }}>
              <div className="relative">
                <FieldLabel>Measurement purpose</FieldLabel>
                <select required value={r.measurement_purpose} onChange={(e) => handlePurposeChange(i, e.target.value)} style={selectStyle}>
                  <option value="" disabled>
                    Select purpose…
                  </option>
                  {purposes.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3" style={{ top: 34 }}>
                  <ChevronDownIcon size={11} color={theme.textFaint} />
                </span>
              </div>
              <div>
                <FieldLabel>Min</FieldLabel>
                <input required type="number" step="any" value={r.min} onChange={(e) => updateRequirement(i, 'min', e.target.value)} style={fieldStyle} />
              </div>
              <div>
                <FieldLabel>Max</FieldLabel>
                <input required type="number" step="any" value={r.max} onChange={(e) => updateRequirement(i, 'max', e.target.value)} style={fieldStyle} />
              </div>
              <div className="relative">
                <FieldLabel>Unit</FieldLabel>
                <select
                  required
                  value={r.unit}
                  onChange={(e) => updateRequirement(i, 'unit', e.target.value)}
                  disabled={!r.measurement_purpose || units.length === 0}
                  style={{ ...selectStyle, backgroundColor: r.measurement_purpose ? '#fff' : '#fafbfd' }}
                >
                  <option value="" disabled>
                    {r.measurement_purpose ? 'Select unit…' : 'Select purpose first'}
                  </option>
                  {units.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3" style={{ top: 34 }}>
                  <ChevronDownIcon size={11} color={theme.textFaint} />
                </span>
              </div>
              <div className="pb-2.5">
                {requirements.length > 1 && (
                  <button type="button" onClick={() => removeRow(i)} className="text-[12px] font-semibold" style={{ color: theme.criticalStrong, border: 'none', background: 'none' }}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <div className="flex items-center gap-1.5" style={{ color: theme.textFaint }}>
          <AlertTriangleIcon size={13} color={theme.textFaint} />
          <span className="text-[12px]">
            Unit options are limited to what's valid for the selected purpose — no more free-typed units, so a typo can't silently break the match.
          </span>
        </div>

        <div className="flex gap-2.5 mt-1.5">
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-[7px] rounded-[9px] px-4 py-2.5 text-[13px] font-semibold"
            style={{ backgroundColor: '#fff', border: `1px solid ${theme.borderStrong}`, color: '#38415a' }}
          >
            <PlusIcon size={14} />
            Add requirement
          </button>
          <button
            disabled={loading}
            className="rounded-[9px] px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: '#182448', border: 'none' }}
          >
            {loading ? 'Matching…' : 'Find suitable equipment'}
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-[10px] px-4 py-2.5 text-sm" style={{ backgroundColor: theme.criticalBg, color: theme.criticalStrong }}>
          {error}
        </div>
      )}

      {result && (
        <div className="flex gap-5 items-start">
          <div className="rounded-2xl p-5 bg-white" style={{ flex: '0 0 388px', border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
            <div className="flex items-center gap-2 mb-3.5">
              <CheckCircleIcon color={theme.good} size={16} />
              <span className="text-[14.5px] font-bold" style={{ color: theme.ink }}>
                Suitable equipment ({result.suitable.length})
              </span>
            </div>
            {result.suitable.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {result.suitable.map((item) => (
                  <SuitableCard key={item.equipment.equipment_id} item={item} />
                ))}
              </div>
            ) : (
              <EmptySuitablePanel requirements={requirements} closestMatch={result.closestMatch} />
            )}
          </div>

          <div className="rounded-2xl p-5 bg-white flex-1" style={{ border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
            <div className="flex items-center gap-2 mb-3.5">
              <AlertTriangleIcon color={theme.critical} size={16} />
              <span className="text-[14.5px] font-bold" style={{ color: theme.ink }}>
                Not suitable ({result.notSuitable.length})
              </span>
            </div>
            {result.notSuitableGrouped.length > 0 ? (
              <div className="flex flex-col gap-3">
                {result.notSuitableGrouped.map((group, gi) => (
                  <NotSuitableGroup key={gi} group={group} />
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: theme.textFaint }}>
                Nothing to show.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SuitableCard({ item }) {
  return (
    <div className="rounded-xl p-3" style={{ border: `1px solid ${theme.borderStrong}` }}>
      <p className="text-[13px] font-semibold" style={{ color: theme.ink }}>
        <Link to={`/equipment/${item.equipment.equipment_id}`} style={{ color: theme.brand }}>
          {item.equipment.name}
        </Link>
        <span className="font-normal" style={{ color: theme.textFaint }}>
          {' '}
          · {item.equipment.model}
        </span>
      </p>
      <p className="text-[11.5px] mb-2" style={{ color: theme.textFaint }}>
        S/N {item.equipment.serial_number} · {item.equipment.location || '—'}
      </p>
      <ul className="flex flex-col gap-[3px]">
        {item.results.map((r, i) => (
          <li key={i} className="text-[12.5px]" style={{ color: theme.textMuted }}>
            {r.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}

function requirementSentence(r) {
  return `${r.min}–${r.max} ${r.unit || ''} for ${r.measurement_purpose}`.trim();
}

function EmptySuitablePanel({ requirements, closestMatch }) {
  const noneCover =
    requirements.length === 1
      ? `No equipment currently covers ${requirementSentence(requirements[0])}.`
      : `No equipment currently covers all of: ${requirements.map(requirementSentence).join(', ')}.`;

  return (
    <div className="rounded-xl p-4 flex flex-col gap-2.5" style={{ backgroundColor: '#fafbfd', border: `1px solid ${theme.border}` }}>
      <span className="text-[13px]" style={{ color: theme.textMuted, lineHeight: 1.5 }}>
        {noneCover}
      </span>

      {closestMatch && (
        <div className="rounded-[10px] p-3 bg-white" style={{ border: `1px solid ${theme.border}` }}>
          <div className="text-[11px] font-bold tracking-wide uppercase mb-1.5" style={{ color: theme.textFaint }}>
            Closest match
          </div>
          <div className="text-[13px] font-semibold" style={{ color: theme.inkAlt }}>
            {closestMatch.equipment.name} <span className="font-medium" style={{ color: theme.textFaint }}>· {closestMatch.equipment.model}</span>
          </div>
          <div className="text-[12.5px] mt-[3px]" style={{ color: theme.textMuted }}>
            {closestMatch.summary}
          </div>
        </div>
      )}

      <span className="text-[12px]" style={{ color: '#7a8296', lineHeight: 1.5 }}>
        Try adjusting the required range, or check with procurement about equipment covering a wider range.
      </span>
    </div>
  );
}

function NotSuitableGroup({ group }) {
  const [expanded, setExpanded] = useState(true);
  const [shownCount, setShownCount] = useState(GROUP_PAGE_SIZE);
  const visible = group.equipment.slice(0, shownCount);
  const remaining = group.equipment.length - visible.length;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${theme.alertBorder}` }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: theme.alertBg }}>
        <div className="flex items-center gap-2.5">
          <span style={{ color: theme.criticalStrong, display: 'inline-flex', transform: expanded ? 'none' : 'rotate(-90deg)' }}>
            <ChevronDownIcon size={13} color={theme.criticalStrong} />
          </span>
          <span className="text-[13.5px] font-bold" style={{ color: '#7a271a' }}>
            {group.label}
          </span>
          <span className="text-[11px] font-bold rounded-full px-[10px] py-[3px]" style={{ color: theme.criticalStrong, backgroundColor: theme.criticalBgStrong }}>
            {group.equipment.length} equipment
          </span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-[12px] font-semibold"
          style={{ color: '#7a8296', border: 'none', background: 'none' }}
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col">
          {visible.map((item) => {
            const failure = item.results.find((r) => !r.pass);
            return (
              <div key={item.equipment.equipment_id} className="flex items-center justify-between px-4 py-[11px]" style={{ borderTop: `1px solid ${theme.divider}` }}>
                <div>
                  <Link to={`/equipment/${item.equipment.equipment_id}`} className="text-[13px] font-semibold" style={{ color: theme.brand }}>
                    {item.equipment.name}
                  </Link>
                  <span className="text-[12px]" style={{ color: theme.textFaint }}>
                    {' '}
                    · {item.equipment.model} · S/N {item.equipment.serial_number}
                  </span>
                </div>
                <span className="text-[12px]" style={{ color: theme.criticalStrong }}>
                  {failure?.reason}
                </span>
              </div>
            );
          })}
          {remaining > 0 && (
            <button
              type="button"
              onClick={() => setShownCount((c) => c + 10)}
              className="text-[12.5px] font-semibold text-center py-[11px]"
              style={{ color: theme.brand, border: 'none', borderTop: `1px solid ${theme.divider}`, background: 'none' }}
            >
              Show {remaining} more
            </button>
          )}
        </div>
      )}
    </div>
  );
}

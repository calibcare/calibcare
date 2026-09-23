import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import client from '../api/client';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { PlusIcon, TrashIcon, ChevronDownIcon, AlertTriangleIcon } from '../components/icons';

const STATUS_OPTIONS = ['active', 'under_maintenance', 'decommissioned', 'sent_for_calibration'];
// The 7 real sites -- see database/add_location_category.sql.
const LOCATION_CATEGORY_OPTIONS = ['Head office', 'Central', 'Chiang Mai Branch', 'Hat Yai Branch', 'KhonKaen Branch', 'QA Team', 'Workshop room'];
const STATUS_META = {
  active: { label: 'Active', color: theme.good, bg: theme.goodBg },
  under_maintenance: { label: 'Under Maintenance', color: theme.warning, bg: theme.warningBg },
  decommissioned: { label: 'Decommissioned', color: theme.textMuted, bg: theme.chipBg },
  sent_for_calibration: { label: 'Sent for Calibration', color: '#1d4ed8', bg: '#e8edfd' },
};
const emptyCapForm = {
  measurement_purpose: '',
  measurement_range: '',
  instrument_accuracy: '',
  product_operating_range: '',
  acceptance_criteria: '',
};
const emptyCalForm = {
  calibration_date: '',
  next_calibration_date: '',
  responsible_person: '',
  calibration_frequency: '',
  notes: '',
};
const MAX_CERT_BYTES = 10 * 1024 * 1024;

const fieldStyle = { border: `1px solid ${theme.borderStrong}`, borderRadius: 9, padding: '10px 13px', fontSize: 14, color: theme.ink, width: '100%', boxSizing: 'border-box' };
const smallFieldStyle = { ...fieldStyle, padding: '9px 11px', fontSize: 13 };

function Card({ children }) {
  return (
    <div className="bg-white rounded-2xl p-6" style={{ border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
      {children}
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <label className="block text-[12.5px] font-semibold mb-[7px]" style={{ color: theme.textMuted }}>
      {children}
    </label>
  );
}

function StatusPill({ status }) {
  const meta = STATUS_META[status] || { label: status, color: theme.textMuted, bg: theme.chipBg };
  return (
    <span className="text-[12px] font-bold rounded-full px-3 py-1 inline-block" style={{ color: meta.color, backgroundColor: meta.bg }}>
      {meta.label}
    </span>
  );
}

function classify(equipment, latestCalibration, todayStr) {
  if (equipment.status === 'active' && latestCalibration?.next_calibration_date && latestCalibration.next_calibration_date < todayStr) {
    return 'overdue';
  }
  return equipment.status;
}

export function EquipmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = Boolean(user?.can_edit);

  const [equipment, setEquipment] = useState(null);
  const [calibrations, setCalibrations] = useState([]);
  const [error, setError] = useState('');
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const [showCapForm, setShowCapForm] = useState(false);
  const [capForm, setCapForm] = useState(emptyCapForm);
  const [savingCap, setSavingCap] = useState(false);

  const [showCalForm, setShowCalForm] = useState(false);
  const [calForm, setCalForm] = useState(emptyCalForm);
  const [certFile, setCertFile] = useState(null);
  const [savingCal, setSavingCal] = useState(false);
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const [{ data: equipmentData }, { data: calibrationData }] = await Promise.all([
        client.get(`/api/equipment/${id}`),
        client.get(`/api/equipment/${id}/calibrations`),
      ]);
      setEquipment(equipmentData);
      setCalibrations(calibrationData);
      setEditForm({
        name: equipmentData.name,
        model: equipmentData.model || '',
        manufacturer: equipmentData.manufacturer || '',
        category: equipmentData.category || '',
        // Only show the detail box pre-filled when it would say something the
        // category dropdown doesn't already -- most equipment's raw location
        // is literally identical to its category (e.g. both just "Head
        // office"), and showing that same text twice looked like a bug.
        location: equipmentData.location === equipmentData.location_category ? '' : equipmentData.location || '',
        location_category: equipmentData.location_category || '',
        status: equipmentData.status,
        remarks: equipmentData.remarks || '',
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load equipment');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      // An empty detail box means "nothing extra to say," not "clear the
      // location" -- fall back to the category so a blank box can never
      // wipe out real location data.
      const payload = { ...editForm, location: editForm.location || editForm.location_category };
      await client.put(`/api/equipment/${id}`, payload);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCapability(e) {
    e.preventDefault();
    setSavingCap(true);
    setError('');
    try {
      await client.post(`/api/equipment/${id}/capabilities`, capForm);
      setCapForm(emptyCapForm);
      setShowCapForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add capability');
    } finally {
      setSavingCap(false);
    }
  }

  async function handleDeleteCapability(capId) {
    if (!confirm('Remove this capability?')) return;
    try {
      await client.delete(`/api/equipment/${id}/capabilities/${capId}`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove capability');
    }
  }

  function handleCertChange(e) {
    const file = e.target.files[0];
    if (file && file.size > MAX_CERT_BYTES) {
      setError('Certificate must be 10MB or smaller');
      e.target.value = '';
      setCertFile(null);
      return;
    }
    setError('');
    setCertFile(file || null);
  }

  async function handleAddCalibration(e) {
    e.preventDefault();
    setSavingCal(true);
    setError('');
    try {
      const formData = new FormData();
      for (const [key, value] of Object.entries(calForm)) {
        if (value) formData.append(key, value);
      }
      if (certFile) formData.append('certificate', certFile);

      await client.post(`/api/equipment/${id}/calibrations`, formData);
      setCalForm(emptyCalForm);
      setCertFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setShowCalForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record calibration');
    } finally {
      setSavingCal(false);
    }
  }

  async function handleDeleteCalibration(calibrationId) {
    if (!confirm('Remove this calibration record?')) return;
    try {
      await client.delete(`/api/equipment/${id}/calibrations/${calibrationId}`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove calibration record');
    }
  }

  async function handleDeleteEquipment() {
    if (!confirm('Delete this equipment entirely? This also removes its capabilities and calibration history.')) return;
    try {
      await client.delete(`/api/equipment/${id}`);
      navigate('/equipment');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete equipment');
    }
  }

  async function handleDownloadCertificate(calibrationId, filename) {
    try {
      const { data } = await client.get(`/api/equipment/${id}/calibrations/${calibrationId}/certificate`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'certificate.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download certificate');
    }
  }

  if (error && !equipment) {
    return (
      <div className="rounded-[10px] px-4 py-2.5 text-sm" style={{ backgroundColor: theme.criticalBg, color: theme.criticalStrong }}>
        {error}
      </div>
    );
  }
  if (!equipment) return <div style={{ color: theme.textFaint }}>Loading…</div>;

  const todayStr = new Date().toISOString().slice(0, 10);
  const statusKey = classify(equipment, equipment.latest_calibration, todayStr);
  const isOverdue = statusKey === 'overdue';
  const overdueDays = isOverdue
    ? Math.round((new Date(todayStr) - new Date(equipment.latest_calibration.next_calibration_date)) / 86400000)
    : 0;

  return (
    <div className="flex flex-col gap-5">
      <Link to="/equipment" className="flex items-center gap-1.5 text-[13.5px] font-semibold w-fit" style={{ color: theme.textMuted }}>
        ← Back to equipment
      </Link>

      {error && (
        <div className="rounded-[10px] px-4 py-2.5 text-sm" style={{ backgroundColor: theme.criticalBg, color: theme.criticalStrong }}>
          {error}
        </div>
      )}

      <Card>
        <div className="mb-5">
          <h1 className="text-[22px] font-bold mb-1.5" style={{ color: theme.ink }}>
            {equipment.name} <span className="font-medium" style={{ color: theme.textFaint }}>— {equipment.model}</span>
          </h1>
          <p className="text-[13.5px]" style={{ color: theme.textFaint }}>
            S/N {equipment.serial_number} · No. {equipment.equipment_no}
          </p>
        </div>

        {canManage && editForm && (
          <form onSubmit={handleSave} className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <FieldLabel>Name</FieldLabel>
              <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} style={fieldStyle} />
            </div>
            <div>
              <FieldLabel>Model</FieldLabel>
              <input value={editForm.model} onChange={(e) => setEditForm({ ...editForm, model: e.target.value })} style={fieldStyle} />
            </div>
            <div>
              <FieldLabel>Location</FieldLabel>
              <div className="relative mb-2">
                <select
                  value={editForm.location_category}
                  onChange={(e) => setEditForm({ ...editForm, location_category: e.target.value })}
                  className="appearance-none"
                  style={{ ...fieldStyle, paddingRight: 32 }}
                >
                  <option value="">Select a site…</option>
                  {LOCATION_CATEGORY_OPTIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                  <ChevronDownIcon size={11} color={theme.textFaint} />
                </span>
              </div>
              <input
                value={editForm.location}
                onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                placeholder="Detail (e.g. person or date, optional)"
                style={smallFieldStyle}
              />
            </div>
            <div>
              <FieldLabel>Status</FieldLabel>
              <div className="relative">
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="appearance-none"
                  style={{ ...fieldStyle, paddingRight: 32 }}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_META[s].label}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                  <ChevronDownIcon size={11} color={theme.textFaint} />
                </span>
              </div>
            </div>
            <div className="col-span-2">
              <FieldLabel>Remarks</FieldLabel>
              <input value={editForm.remarks} onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} style={fieldStyle} />
            </div>
            <div className="col-span-2 flex items-center justify-between mt-1">
              <button
                disabled={saving}
                className="rounded-[9px] px-5 py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: '#182448', border: 'none' }}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button type="button" onClick={handleDeleteEquipment} className="text-[13px] font-semibold" style={{ color: theme.criticalStrong, border: 'none', background: 'none' }}>
                Delete equipment
              </button>
            </div>
          </form>
        )}

        {!canManage && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13.5px]">
            <div>
              <span className="block text-[12px] font-semibold mb-1" style={{ color: theme.textMuted }}>Location</span>
              <span style={{ color: theme.ink }}>{equipment.location || '—'}</span>
            </div>
            <div>
              <span className="block text-[12px] font-semibold mb-1" style={{ color: theme.textMuted }}>Status</span>
              <StatusPill status={equipment.status} />
            </div>
          </div>
        )}

        {equipment.latest_calibration ? (
          <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${theme.divider}` }}>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[13px]" style={{ color: theme.textFaint }}>
                Last calibrated {equipment.latest_calibration.calibration_date} · Next due {equipment.latest_calibration.next_calibration_date}
              </span>
              {isOverdue && (
                <span className="text-[11px] font-bold rounded-full px-[10px] py-[3px]" style={{ color: theme.criticalStrong, backgroundColor: theme.criticalBgStrong }}>
                  Overdue · {overdueDays} day{overdueDays === 1 ? '' : 's'}
                </span>
              )}
            </div>
            {isOverdue && (
              <div className="flex items-start gap-1.5 mt-2">
                <span className="mt-[1px] shrink-0">
                  <AlertTriangleIcon size={12} color={theme.textFaint} />
                </span>
                <span className="text-[11.5px]" style={{ color: theme.textFaint, lineHeight: 1.5 }}>
                  Overdue is computed from today's date vs. next due date, not from the Status field above — so this stays accurate even if Status is never updated by hand.
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-5 pt-4 text-[13px]" style={{ color: theme.textFaint, borderTop: `1px solid ${theme.divider}` }}>
            No calibration history recorded yet.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="text-[16px] font-bold mb-4" style={{ color: theme.ink }}>
          Capabilities
        </h2>

        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${theme.border}` }}>
          <div className="flex items-center px-4 py-2.5" style={{ backgroundColor: '#fafbfd' }}>
            <span className="flex-[1.3] text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.textFaint }}>Purpose</span>
            <span className="flex-[1.6] text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.textFaint }}>Measurement range</span>
            <span className="flex-[1.3] text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.textFaint }}>Accuracy</span>
            <span className="flex-[1.6] text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.textFaint }}>Product operating range</span>
            <span className="flex-[1.3] text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.textFaint }}>Acceptance criteria</span>
            <span className="flex-[0.6]" />
          </div>

          {equipment.capabilities.length === 0 && (
            <div className="px-4 py-5 text-center text-[13px]" style={{ color: theme.textFaint, borderTop: `1px solid ${theme.divider}` }}>
              No capabilities recorded yet.
            </div>
          )}

          {equipment.capabilities.map((c) => (
            <div key={c.capability_id} className="flex items-center px-4 py-3" style={{ borderTop: `1px solid ${theme.divider}` }}>
              <span className="flex-[1.3] text-[13.5px] font-semibold" style={{ color: theme.inkAlt }}>{c.measurement_purpose}</span>
              <span className="flex-[1.6] text-[13px]" style={{ color: '#38415a' }}>{c.measurement_range || '—'}</span>
              <span className="flex-[1.3] text-[13px]" style={{ color: '#38415a' }}>{c.instrument_accuracy || '—'}</span>
              <span className="flex-[1.6] text-[13px]" style={{ color: '#38415a' }}>{c.product_operating_range || '—'}</span>
              <span className="flex-[1.3] text-[13px]" style={{ color: '#38415a' }}>{c.acceptance_criteria || '—'}</span>
              <div className="flex-[0.6] text-right">
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleDeleteCapability(c.capability_id)}
                    className="w-7 h-7 rounded-[7px] inline-flex items-center justify-center"
                    style={{ color: theme.textFaint, border: 'none', background: 'none' }}
                  >
                    <TrashIcon size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {canManage && (
          <div className="mt-4">
            {!showCapForm ? (
              <button
                type="button"
                onClick={() => setShowCapForm(true)}
                className="flex items-center gap-2 rounded-[9px] px-4 py-2.5 text-[13px] font-semibold"
                style={{ backgroundColor: '#fff', border: `1px solid ${theme.borderStrong}`, color: '#38415a' }}
              >
                <PlusIcon size={13} />
                Add capability
              </button>
            ) : (
              <form onSubmit={handleAddCapability} className="border rounded-xl p-4 flex flex-col gap-3" style={{ borderColor: theme.borderStrong, borderStyle: 'dashed' }}>
                <div className="grid grid-cols-5 gap-3">
                  <div>
                    <FieldLabel>Purpose</FieldLabel>
                    <input required value={capForm.measurement_purpose} onChange={(e) => setCapForm({ ...capForm, measurement_purpose: e.target.value })} style={smallFieldStyle} />
                  </div>
                  <div>
                    <FieldLabel>Measurement range</FieldLabel>
                    <input value={capForm.measurement_range} onChange={(e) => setCapForm({ ...capForm, measurement_range: e.target.value })} style={smallFieldStyle} />
                  </div>
                  <div>
                    <FieldLabel>Accuracy</FieldLabel>
                    <input value={capForm.instrument_accuracy} onChange={(e) => setCapForm({ ...capForm, instrument_accuracy: e.target.value })} style={smallFieldStyle} />
                  </div>
                  <div>
                    <FieldLabel>Product op. range</FieldLabel>
                    <input value={capForm.product_operating_range} onChange={(e) => setCapForm({ ...capForm, product_operating_range: e.target.value })} style={smallFieldStyle} />
                  </div>
                  <div>
                    <FieldLabel>Acceptance criteria</FieldLabel>
                    <input value={capForm.acceptance_criteria} onChange={(e) => setCapForm({ ...capForm, acceptance_criteria: e.target.value })} style={smallFieldStyle} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    disabled={savingCap}
                    className="rounded-[9px] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: theme.good, border: 'none' }}
                  >
                    {savingCap ? 'Adding…' : '+ Add capability'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCapForm(false);
                      setCapForm(emptyCapForm);
                    }}
                    className="text-[13px] font-semibold"
                    style={{ color: theme.textFaint, border: 'none', background: 'none' }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-[16px] font-bold mb-4" style={{ color: theme.ink }}>
          Calibration history
        </h2>

        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${theme.border}` }}>
          <div className="flex items-center px-4 py-2.5" style={{ backgroundColor: '#fafbfd' }}>
            <span className="flex-[1.2] text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.textFaint }}>Calibration date</span>
            <span className="flex-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.textFaint }}>Next due</span>
            <span className="flex-[0.9] text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.textFaint }}>Frequency</span>
            <span className="flex-[1.1] text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.textFaint }}>Responsible</span>
            <span className="flex-[0.9] text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.textFaint }}>Certificate</span>
            <span className="flex-[0.9] text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.textFaint }}>Notes</span>
            <span className="flex-[0.6]" />
          </div>

          {calibrations.length === 0 && (
            <div className="px-4 py-5 text-center text-[13px]" style={{ color: theme.textFaint, borderTop: `1px solid ${theme.divider}` }}>
              No calibration events recorded yet.
            </div>
          )}

          {calibrations.map((c) => (
            <div key={c.calibration_id} className="flex items-center px-4 py-3" style={{ borderTop: `1px solid ${theme.divider}` }}>
              <span className="flex-[1.2] text-[13.5px] font-semibold" style={{ color: theme.inkAlt }}>{c.calibration_date}</span>
              <span className="flex-1 text-[13px]" style={{ color: '#38415a' }}>{c.next_calibration_date || '—'}</span>
              <span className="flex-[0.9] text-[13px]" style={{ color: '#38415a' }}>{c.calibration_frequency || '—'}</span>
              <span className="flex-[1.1] text-[13px]" style={{ color: '#38415a' }}>{c.responsible_person || '—'}</span>
              <div className="flex-[0.9]">
                {c.certificate_filename ? (
                  <button
                    type="button"
                    onClick={() => handleDownloadCertificate(c.calibration_id, c.certificate_filename)}
                    className="text-[12.5px] font-semibold text-left"
                    style={{ color: theme.brand, border: 'none', background: 'none' }}
                  >
                    Download
                  </button>
                ) : (
                  <span className="text-[13px]" style={{ color: theme.textFaint }}>—</span>
                )}
              </div>
              <span className="flex-[0.9] text-[13px]" style={{ color: '#38415a' }}>{c.notes || '—'}</span>
              <div className="flex-[0.6] text-right">
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleDeleteCalibration(c.calibration_id)}
                    className="w-7 h-7 rounded-[7px] inline-flex items-center justify-center"
                    style={{ color: theme.textFaint, border: 'none', background: 'none' }}
                  >
                    <TrashIcon size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {canManage && (
          <div className="mt-4">
            {!showCalForm ? (
              <button
                type="button"
                onClick={() => setShowCalForm(true)}
                className="flex items-center gap-2 rounded-[9px] px-4 py-2.5 text-[13px] font-semibold"
                style={{ backgroundColor: '#fff', border: `1px solid ${theme.borderStrong}`, color: '#38415a' }}
              >
                <PlusIcon size={13} />
                Record calibration
              </button>
            ) : (
              <form onSubmit={handleAddCalibration} className="border rounded-xl p-4 flex flex-col gap-3" style={{ borderColor: theme.borderStrong, borderStyle: 'dashed' }}>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <FieldLabel>Calibration date</FieldLabel>
                    <input required type="date" value={calForm.calibration_date} onChange={(e) => setCalForm({ ...calForm, calibration_date: e.target.value })} style={smallFieldStyle} />
                  </div>
                  <div>
                    <FieldLabel>Next due date</FieldLabel>
                    <input type="date" value={calForm.next_calibration_date} onChange={(e) => setCalForm({ ...calForm, next_calibration_date: e.target.value })} style={smallFieldStyle} />
                  </div>
                  <div>
                    <FieldLabel>Frequency</FieldLabel>
                    <input placeholder="e.g. 1 ปี" value={calForm.calibration_frequency} onChange={(e) => setCalForm({ ...calForm, calibration_frequency: e.target.value })} style={smallFieldStyle} />
                  </div>
                  <div>
                    <FieldLabel>Responsible person</FieldLabel>
                    <input value={calForm.responsible_person} onChange={(e) => setCalForm({ ...calForm, responsible_person: e.target.value })} style={smallFieldStyle} />
                  </div>
                  <div>
                    <FieldLabel>Certificate (PDF, max 10MB)</FieldLabel>
                    <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleCertChange} style={{ ...smallFieldStyle, padding: '7px 8px' }} />
                  </div>
                  <div>
                    <FieldLabel>Notes</FieldLabel>
                    <input value={calForm.notes} onChange={(e) => setCalForm({ ...calForm, notes: e.target.value })} style={smallFieldStyle} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    disabled={savingCal}
                    className="rounded-[9px] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: theme.good, border: 'none' }}
                  >
                    {savingCal ? 'Recording…' : '+ Record calibration'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCalForm(false);
                      setCalForm(emptyCalForm);
                      setCertFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-[13px] font-semibold"
                    style={{ color: theme.textFaint, border: 'none', background: 'none' }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

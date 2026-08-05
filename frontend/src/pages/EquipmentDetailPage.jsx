import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const STATUS_OPTIONS = ['active', 'under_maintenance', 'decommissioned', 'sent_for_calibration'];
const CATEGORY_SUGGESTIONS = [
  'Electrical Safety',
  'Pressure & Flow',
  'Patient Simulators & Analyzers',
  'Temperature',
  'Radiography & Photometry',
  'Mass / Weight Standards',
];
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
  certificate_path: '',
  notes: '',
};

function Field({ label, children }) {
  return (
    <label className="text-xs text-slate-500 flex flex-col gap-1">
      {label}
      {children}
    </label>
  );
}

export function EquipmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'engineer';

  const [equipment, setEquipment] = useState(null);
  const [calibrations, setCalibrations] = useState([]);
  const [error, setError] = useState('');
  const [editForm, setEditForm] = useState(null);
  const [capForm, setCapForm] = useState(emptyCapForm);
  const [savingCap, setSavingCap] = useState(false);
  const [calForm, setCalForm] = useState(emptyCalForm);
  const [savingCal, setSavingCal] = useState(false);

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
        location: equipmentData.location || '',
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
    try {
      await client.put(`/api/equipment/${id}`, editForm);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    }
  }

  async function handleAddCapability(e) {
    e.preventDefault();
    setSavingCap(true);
    try {
      await client.post(`/api/equipment/${id}/capabilities`, capForm);
      setCapForm(emptyCapForm);
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

  async function handleAddCalibration(e) {
    e.preventDefault();
    setSavingCal(true);
    try {
      await client.post(`/api/equipment/${id}/calibrations`, calForm);
      setCalForm(emptyCalForm);
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

  if (error && !equipment) return <div className="text-red-700">{error}</div>;
  if (!equipment) return <div className="text-slate-400">Loading…</div>;

  return (
    <div className="space-y-6">
      <Link to="/equipment" className="text-sm text-slate-500 hover:underline">
        &larr; Back to equipment
      </Link>

      {error && <div className="rounded-md bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h1 className="text-lg font-semibold mb-1">
          {equipment.name} <span className="text-slate-400 font-normal">— {equipment.model}</span>
        </h1>
        <p className="text-sm text-slate-500 mb-4">
          S/N {equipment.serial_number} · No. {equipment.equipment_no}
        </p>

        {canManage && editForm && (
          <form onSubmit={handleSave} className="grid grid-cols-2 gap-3">
            <Field label="Name">
              <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="input" />
            </Field>
            <Field label="Model">
              <input value={editForm.model} onChange={(e) => setEditForm({ ...editForm, model: e.target.value })} className="input" />
            </Field>
            <Field label="Manufacturer">
              <input
                value={editForm.manufacturer}
                onChange={(e) => setEditForm({ ...editForm, manufacturer: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Location">
              <input value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} className="input" />
            </Field>
            <Field label="Category">
              <input
                list="category-suggestions"
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                className="input"
              />
              <datalist id="category-suggestions">
                {CATEGORY_SUGGESTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Status">
              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="input">
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Remarks">
              <input value={editForm.remarks} onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} className="input" />
            </Field>
            <div className="col-span-2 flex justify-between items-center">
              <button className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-sm hover:bg-slate-800">Save changes</button>
              <button type="button" onClick={handleDeleteEquipment} className="text-red-600 text-sm hover:underline">
                Delete equipment
              </button>
            </div>
          </form>
        )}

        {equipment.latest_calibration ? (
          <p className="mt-4 text-sm text-slate-500">
            Last calibrated {equipment.latest_calibration.calibration_date}, next due {equipment.latest_calibration.next_calibration_date}.
          </p>
        ) : (
          <p className="mt-4 text-sm text-slate-400">No calibration history recorded yet.</p>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="font-semibold mb-3">Capabilities</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm mb-4">
            <thead className="text-slate-500 text-left">
              <tr>
                <th className="py-1 pr-2">Purpose</th>
                <th className="py-1 pr-2">Measurement range</th>
                <th className="py-1 pr-2">Accuracy</th>
                <th className="py-1 pr-2">Product operating range</th>
                <th className="py-1 pr-2">Acceptance criteria</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {equipment.capabilities.map((c) => (
                <tr key={c.capability_id} className="border-t border-slate-100">
                  <td className="py-1 pr-2 font-medium">{c.measurement_purpose}</td>
                  <td className="py-1 pr-2 text-slate-600">{c.measurement_range}</td>
                  <td className="py-1 pr-2 text-slate-600">{c.instrument_accuracy}</td>
                  <td className="py-1 pr-2 text-slate-600">{c.product_operating_range}</td>
                  <td className="py-1 pr-2 text-slate-600">{c.acceptance_criteria}</td>
                  <td className="py-1 text-right">
                    {canManage && (
                      <button onClick={() => handleDeleteCapability(c.capability_id)} className="text-red-600 hover:underline text-xs">
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {equipment.capabilities.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-2 text-slate-400">
                    No capabilities recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {canManage && (
          <form onSubmit={handleAddCapability} className="grid grid-cols-5 gap-2 items-end">
            <Field label="Purpose">
              <input
                required
                value={capForm.measurement_purpose}
                onChange={(e) => setCapForm({ ...capForm, measurement_purpose: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Measurement range">
              <input
                value={capForm.measurement_range}
                onChange={(e) => setCapForm({ ...capForm, measurement_range: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Accuracy">
              <input
                value={capForm.instrument_accuracy}
                onChange={(e) => setCapForm({ ...capForm, instrument_accuracy: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Product op. range">
              <input
                value={capForm.product_operating_range}
                onChange={(e) => setCapForm({ ...capForm, product_operating_range: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Acceptance criteria">
              <input
                value={capForm.acceptance_criteria}
                onChange={(e) => setCapForm({ ...capForm, acceptance_criteria: e.target.value })}
                className="input"
              />
            </Field>
            <div className="col-span-5">
              <button disabled={savingCap} className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50">
                {savingCap ? 'Adding…' : '+ Add capability'}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="font-semibold mb-3">Calibration history</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm mb-4">
            <thead className="text-slate-500 text-left">
              <tr>
                <th className="py-1 pr-2">Calibration date</th>
                <th className="py-1 pr-2">Next due</th>
                <th className="py-1 pr-2">Frequency</th>
                <th className="py-1 pr-2">Responsible</th>
                <th className="py-1 pr-2">Certificate</th>
                <th className="py-1 pr-2">Notes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {calibrations.map((c) => (
                <tr key={c.calibration_id} className="border-t border-slate-100">
                  <td className="py-1 pr-2 font-medium">{c.calibration_date}</td>
                  <td className="py-1 pr-2 text-slate-600">{c.next_calibration_date || '—'}</td>
                  <td className="py-1 pr-2 text-slate-600">{c.calibration_frequency || '—'}</td>
                  <td className="py-1 pr-2 text-slate-600">{c.responsible_person || '—'}</td>
                  <td className="py-1 pr-2 text-slate-600">{c.certificate_path || '—'}</td>
                  <td className="py-1 pr-2 text-slate-600">{c.notes || '—'}</td>
                  <td className="py-1 text-right">
                    {canManage && (
                      <button onClick={() => handleDeleteCalibration(c.calibration_id)} className="text-red-600 hover:underline text-xs">
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {calibrations.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-2 text-slate-400">
                    No calibration events recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {canManage && (
          <form onSubmit={handleAddCalibration} className="grid grid-cols-3 gap-2 items-end">
            <Field label="Calibration date">
              <input
                required
                type="date"
                value={calForm.calibration_date}
                onChange={(e) => setCalForm({ ...calForm, calibration_date: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Next due date">
              <input
                type="date"
                value={calForm.next_calibration_date}
                onChange={(e) => setCalForm({ ...calForm, next_calibration_date: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Frequency">
              <input
                placeholder="e.g. 1 ปี"
                value={calForm.calibration_frequency}
                onChange={(e) => setCalForm({ ...calForm, calibration_frequency: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Responsible person">
              <input
                value={calForm.responsible_person}
                onChange={(e) => setCalForm({ ...calForm, responsible_person: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Certificate reference">
              <input
                placeholder="file name, path, or link"
                value={calForm.certificate_path}
                onChange={(e) => setCalForm({ ...calForm, certificate_path: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Notes">
              <input value={calForm.notes} onChange={(e) => setCalForm({ ...calForm, notes: e.target.value })} className="input" />
            </Field>
            <div className="col-span-3">
              <button disabled={savingCal} className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50">
                {savingCal ? 'Recording…' : '+ Record calibration'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

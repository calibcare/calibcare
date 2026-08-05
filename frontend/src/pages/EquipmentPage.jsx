import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
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

const STATUS_STYLES = {
  active: 'bg-emerald-50 text-emerald-700',
  under_maintenance: 'bg-amber-50 text-amber-700',
  decommissioned: 'bg-slate-100 text-slate-500',
  sent_for_calibration: 'bg-blue-50 text-blue-700',
};

function StatusBadge({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status] || ''}`}>{status}</span>
  );
}

const emptyForm = { name: '', model: '', manufacturer: '', serial_number: '', category: '', location: '', status: 'active' };

export function EquipmentPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'engineer';

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (q) params.q = q;
      if (status) params.status = status;
      const { data } = await client.get('/api/equipment', { params });
      setItems(data.equipment);
      setTotal(data.total);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load equipment');
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => {
    load();
  }, [load]);

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
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-slate-900">Equipment ({total})</h1>
        {canManage && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-sm hover:bg-slate-800"
          >
            {showForm ? 'Cancel' : '+ Add Equipment'}
          </button>
        )}
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 grid grid-cols-2 gap-3 bg-white p-4 rounded-lg border border-slate-200">
          <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
          <input
            required
            placeholder="Serial number"
            value={form.serial_number}
            onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
            className="input"
          />
          <input placeholder="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="input" />
          <input
            placeholder="Manufacturer"
            value={form.manufacturer}
            onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
            className="input"
          />
          <input
            placeholder="Location"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="input"
          />
          <input
            list="category-suggestions"
            placeholder="Category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="input"
          />
          <datalist id="category-suggestions">
            {CATEGORY_SUGGESTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input">
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div className="col-span-2">
            <button disabled={saving} className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}

      <div className="flex gap-2 mb-4">
        <input
          placeholder="Search name, model, serial, location…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="input flex-1"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-56">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-3 py-2">No.</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Model</th>
              <th className="px-3 py-2">Serial</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-slate-400">
                  No equipment found
                </td>
              </tr>
            )}
            {items.map((eq) => (
              <tr key={eq.equipment_id} className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-400">{eq.equipment_no}</td>
                <td className="px-3 py-2">
                  <Link to={`/equipment/${eq.equipment_id}`} className="text-slate-900 font-medium hover:underline">
                    {eq.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-slate-600">{eq.model || '—'}</td>
                <td className="px-3 py-2 text-slate-600">{eq.serial_number}</td>
                <td className="px-3 py-2 text-slate-600">{eq.location || '—'}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={eq.status} />
                </td>
                <td className="px-3 py-2 text-right">
                  {canManage && (
                    <button onClick={() => handleDelete(eq.equipment_id)} className="text-red-600 hover:underline text-xs">
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

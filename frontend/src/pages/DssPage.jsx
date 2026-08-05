import { useState, useEffect } from 'react';
import client from '../api/client';

const emptyRequirement = () => ({ measurement_purpose: '', min: '', max: '', unit: '' });

export function DssPage() {
  const [purposes, setPurposes] = useState([]);
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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Decision Support System</h1>
        <p className="text-sm text-slate-500">Enter the calibration requirements for this job and find suitable equipment.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
        {requirements.map((r, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-4">
              <label className="text-xs text-slate-500">Measurement purpose</label>
              <input
                required
                list="purposes"
                value={r.measurement_purpose}
                onChange={(e) => updateRequirement(i, 'measurement_purpose', e.target.value)}
                className="input"
                placeholder="Flow"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-500">Min</label>
              <input required type="number" step="any" value={r.min} onChange={(e) => updateRequirement(i, 'min', e.target.value)} className="input" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-500">Max</label>
              <input required type="number" step="any" value={r.max} onChange={(e) => updateRequirement(i, 'max', e.target.value)} className="input" />
            </div>
            <div className="col-span-3">
              <label className="text-xs text-slate-500">Unit</label>
              <input required value={r.unit} onChange={(e) => updateRequirement(i, 'unit', e.target.value)} className="input" placeholder="slpm" />
            </div>
            <div className="col-span-1">
              {requirements.length > 1 && (
                <button type="button" onClick={() => removeRow(i)} className="text-red-600 text-xs hover:underline">
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
        <datalist id="purposes">
          {purposes.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>

        <div className="flex items-center gap-3">
          <button type="button" onClick={addRow} className="px-3 py-1.5 rounded-md border border-slate-300 text-sm hover:bg-slate-50">
            + Add requirement
          </button>
          <button disabled={loading} className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-sm hover:bg-slate-800 disabled:opacity-50">
            {loading ? 'Matching…' : 'Find suitable equipment'}
          </button>
        </div>
      </form>

      {error && <div className="rounded-md bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

      {result && (
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h2 className="font-semibold text-emerald-700 mb-2">✔ Suitable equipment ({result.suitable.length})</h2>
            <div className="space-y-3">
              {result.suitable.map((item, idx) => (
                <div key={idx} className="bg-white border border-emerald-200 rounded-lg p-3">
                  <p className="font-medium">
                    {item.equipment.name} <span className="text-slate-400 font-normal">— {item.equipment.model}</span>
                  </p>
                  <p className="text-xs text-slate-500 mb-2">
                    S/N {item.equipment.serial_number} · {item.equipment.location}
                  </p>
                  <ul className="text-sm text-slate-600 space-y-1">
                    {item.results.map((r, i) => (
                      <li key={i}>✓ {r.reason}</li>
                    ))}
                  </ul>
                </div>
              ))}
              {result.suitable.length === 0 && <p className="text-sm text-slate-400">No suitable equipment found.</p>}
            </div>
          </div>

          <div>
            <h2 className="font-semibold text-red-700 mb-2">✘ Not suitable ({result.notSuitable.length})</h2>
            <div className="space-y-3">
              {result.notSuitable.map((item, idx) => (
                <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3">
                  <p className="font-medium">
                    {item.equipment.name} <span className="text-slate-400 font-normal">— {item.equipment.model}</span>
                  </p>
                  <p className="text-xs text-slate-500 mb-2">S/N {item.equipment.serial_number}</p>
                  <ul className="text-sm text-slate-600 space-y-1">
                    {item.results
                      .filter((r) => !r.pass)
                      .map((r, i) => (
                        <li key={i} className="text-red-700">
                          ✗ {r.reason}
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
              {result.notSuitable.length === 0 && <p className="text-sm text-slate-400">Nothing to show.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

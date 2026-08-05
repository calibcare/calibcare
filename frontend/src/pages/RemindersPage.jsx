import { useState } from 'react';
import client from '../api/client';

const BUCKET_STYLES = {
  overdue: 'bg-red-50 text-red-700',
  due: 'bg-orange-50 text-orange-700',
  '7_days': 'bg-amber-50 text-amber-700',
  '14_days': 'bg-yellow-50 text-yellow-700',
  '30_days': 'bg-blue-50 text-blue-700',
};

function BucketBadge({ bucket }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${BUCKET_STYLES[bucket] || ''}`}>
      {bucket.replace('_', ' ')}
    </span>
  );
}

function ConnectLine() {
  const [link, setLink] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function getCode() {
    setLoading(true);
    setError('');
    try {
      const { data } = await client.post('/api/line/link-code');
      setLink(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to get a linking code');
    } finally {
      setLoading(false);
    }
  }

  const minutesLeft = link ? Math.max(0, Math.round((link.expiresAt - Date.now()) / 60000)) : null;

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <h2 className="font-semibold mb-1">Connect your LINE account</h2>
      <p className="text-sm text-slate-500 mb-3">
        Link your LINE account so you personally receive calibration reminders here in CalibCare.
      </p>

      {!link && (
        <button
          onClick={getCode}
          disabled={loading}
          className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-sm hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Get linking code'}
        </button>
      )}

      {error && <div className="mt-3 rounded-md bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

      {link && (
        <div className="space-y-3">
          <ol className="text-sm text-slate-600 list-decimal list-inside space-y-1">
            <li>
              {link.addFriendUrl ? (
                <>
                  <a href={link.addFriendUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                    Add the CalibCare LINE Official Account as a friend
                  </a>
                  , or search for it in the LINE app.
                </>
              ) : (
                'Add the CalibCare LINE Official Account as a friend in the LINE app.'
              )}
            </li>
            <li>Send it the code below as a message.</li>
          </ol>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-semibold tracking-widest bg-slate-50 border border-slate-200 rounded-md px-4 py-2">
              {link.code}
            </span>
            <span className="text-xs text-slate-400">
              {minutesLeft > 0 ? `Expires in ${minutesLeft} min` : 'Expired — request a new one'}
            </span>
          </div>
          <button onClick={getCode} disabled={loading} className="text-sm text-blue-600 hover:underline disabled:opacity-50">
            {loading ? 'Generating…' : 'Get a new code'}
          </button>
        </div>
      )}
    </div>
  );
}

export function RemindersPage() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function runCheck() {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const { data } = await client.post('/api/reminders/run');
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to run reminder check');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Calibration Reminders</h1>
        <p className="text-sm text-slate-500">LINE notifications for upcoming and overdue calibrations.</p>
      </div>

      <ConnectLine />

      <div className="flex items-center justify-between pt-2">
        <h2 className="font-semibold text-slate-900">Due-date check</h2>
        <button
          onClick={runCheck}
          disabled={loading}
          className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-sm hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? 'Running…' : 'Run check now'}
        </button>
      </div>
      <p className="text-sm text-slate-500 -mt-3">Manually run the daily due-date check (normally runs automatically at 8am).</p>

      {error && <div className="rounded-md bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

      {result && (
        <div>
          {result.dryRun && (
            <div className="mb-3 rounded-md bg-amber-50 text-amber-800 text-sm px-3 py-2">
              Dry-run mode: no LINE_CHANNEL_ACCESS_TOKEN configured, so nothing was actually sent. This shows what would be sent.
            </div>
          )}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-3 py-2">Equipment</th>
                  <th className="px-3 py-2">Serial</th>
                  <th className="px-3 py-2">Bucket</th>
                  <th className="px-3 py-2">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-2">{r.equipment}</td>
                    <td className="px-3 py-2 text-slate-600">{r.serial_number}</td>
                    <td className="px-3 py-2">
                      <BucketBadge bucket={r.bucket} />
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {r.skipped ? `skipped — ${r.skipped}` : `${r.status}${r.notified ? ` to ${r.notified} recipient(s)` : ''}`}
                    </td>
                  </tr>
                ))}
                {result.results.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-slate-400">
                      Nothing due right now
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

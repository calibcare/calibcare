import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';
import { PageHeader } from '../components/ui';

const MIN_LENGTH = 8;
const fieldStyle = { border: `1px solid ${theme.borderStrong}`, borderRadius: 6, padding: '10px 13px', fontSize: 14, color: theme.ink, width: '100%', boxSizing: 'border-box' };

// Reached two ways: forced by ProtectedRoute after logging in with a
// temporary password from the Admin page, or from Settings.
export function ChangePasswordPage() {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const forced = Boolean(user?.must_change_password);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (next.length < MIN_LENGTH) return setError(`New password must be at least ${MIN_LENGTH} characters.`);
    if (next !== confirm) return setError('The two new passwords do not match.');
    setSaving(true);
    try {
      await changePassword(current, next);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not change password');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Change password" description={`Choose a new password for ${user?.email || 'your account'}.`} />
      <div className="max-w-md">
        {forced && (
          <div className="rounded-[10px] px-4 py-3 mb-5 text-[13.5px]" style={{ backgroundColor: theme.warningBg, color: theme.warning, border: `1px solid ${theme.warningBorderSoft}` }}>
            You signed in with a temporary password. Choose your own password to continue.
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 flex flex-col gap-4" style={{ border: `1px solid ${theme.borderStrong}` }}>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold" style={{ color: theme.ink }}>
            {forced ? 'Temporary password' : 'Current password'}
            <input type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} style={fieldStyle} />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold" style={{ color: theme.ink }}>
            New password (at least {MIN_LENGTH} characters)
            <input type="password" required minLength={MIN_LENGTH} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} style={fieldStyle} />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold" style={{ color: theme.ink }}>
            Confirm new password
            <input type="password" required minLength={MIN_LENGTH} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={fieldStyle} />
          </label>

          {error && (
            <div className="rounded-[10px] px-3 py-2 text-[13px]" style={{ backgroundColor: theme.criticalBg, color: theme.criticalStrong }}>
              {error}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button disabled={saving} className="rounded-[9px] px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#182448', border: 'none' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            {forced ? (
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="text-[13px] font-semibold"
                style={{ color: theme.textFaint, border: 'none', background: 'none' }}
              >
                Log out
              </button>
            ) : (
              <button type="button" onClick={() => navigate(-1)} className="text-[13px] font-semibold" style={{ color: theme.textFaint, border: 'none', background: 'none' }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

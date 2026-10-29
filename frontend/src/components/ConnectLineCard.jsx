import { useState, useEffect } from 'react';
import client from '../api/client';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { CheckCircleIcon } from './icons';

const POLL_MS = 4000;

// Links the logged-in user's own LINE account, so they personally receive
// calibration reminders on LINE. Shown on My profile (every position) and
// on the Reminders page. `summary` (Reminders page only) adds how many
// accounts receive LINE alerts.
export function ConnectLineCard({ summary, style }) {
  const { user, refreshUser } = useAuth();
  const [link, setLink] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const isConnected = Boolean(user?.line_user_id);
  const waiting = Boolean(link) && !isConnected && link.expiresAt > now;

  // While a code is waiting to be sent in LINE, check every few seconds
  // whether the link went through, so the card turns "Connected" by itself.
  useEffect(() => {
    if (!waiting) return undefined;
    const id = setInterval(() => {
      setNow(Date.now());
      refreshUser().catch(() => {});
    }, POLL_MS);
    return () => clearInterval(id);
  }, [waiting, refreshUser]);

  async function getCode() {
    setLoading(true);
    setError('');
    try {
      const { data } = await client.post('/api/line/link-code');
      setLink(data);
      setNow(Date.now());
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to get a linking code');
    } finally {
      setLoading(false);
    }
  }

  const minutesLeft = link ? Math.max(0, Math.ceil((link.expiresAt - now) / 60000)) : null;
  const basicId = link?.addFriendUrl ? decodeURIComponent(link.addFriendUrl.split('/').pop()) : null;

  return (
    <div
      className="bg-white rounded-2xl p-[22px_24px] flex flex-col gap-3.5"
      style={{ border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow, ...style }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0"
            style={{ backgroundColor: isConnected ? theme.goodBg : theme.chipBg }}
          >
            <CheckCircleIcon size={17} color={isConnected ? theme.good : theme.textFaint} />
          </div>
          <span className="text-[15px] font-bold" style={{ color: theme.ink }}>
            LINE notifications
          </span>
        </div>
        <span
          className="text-[11.5px] font-bold rounded-full px-3 py-1 whitespace-nowrap"
          style={{ color: isConnected ? theme.good : theme.textMuted, backgroundColor: isConnected ? theme.goodBg : theme.chipBg }}
        >
          {isConnected ? 'Connected' : 'Not connected'}
        </span>
      </div>

      {isConnected ? (
        <div className="rounded-xl p-3.5" style={{ backgroundColor: '#fafbfd', border: `1px solid ${theme.border}` }}>
          <div className="text-[13.5px] font-semibold" style={{ color: theme.inkAlt }}>
            Your account is linked
          </div>
          <div className="text-[12px] mt-[2px]" style={{ color: theme.textFaint }}>
            {summary
              ? `${summary.lineRecipientCount} account${summary.lineRecipientCount === 1 ? '' : 's'} currently receiving LINE alerts`
              : 'You receive calibration reminders on LINE 30, 7 and 1 day before a due date.'}
          </div>
        </div>
      ) : (
        <div className="rounded-xl p-3.5 flex flex-col gap-2.5" style={{ backgroundColor: '#fafbfd', border: `1px solid ${theme.border}` }}>
          {!link ? (
            <>
              <p className="text-[13px]" style={{ color: theme.textMuted, lineHeight: 1.5 }}>
                Link your LINE account so you personally receive calibration reminders on LINE. Email reminders keep coming either way.
              </p>
              <button
                type="button"
                onClick={getCode}
                disabled={loading}
                className="self-start rounded-[9px] px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: '#182448', border: 'none' }}
              >
                {loading ? 'Generating…' : 'Get linking code'}
              </button>
            </>
          ) : (
            <>
              <ol className="text-[12.5px] list-decimal list-inside flex flex-col gap-1" style={{ color: theme.textMuted, lineHeight: 1.5 }}>
                <li>
                  {link.addFriendUrl ? (
                    <a href={link.addFriendUrl} target="_blank" rel="noreferrer" style={{ color: theme.brand }}>
                      Add the CalibCare LINE Official Account as a friend
                    </a>
                  ) : (
                    'Add the CalibCare LINE Official Account as a friend in the LINE app'
                  )}
                  {basicId ? <>, or search for <b>{basicId}</b> in LINE.</> : ', or search for it directly.'}
                </li>
                <li>Send it the code below as a message.</li>
              </ol>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[22px] font-bold tracking-widest rounded-[10px] px-4 py-2" style={{ backgroundColor: '#fff', border: `1px solid ${theme.border}`, color: theme.ink }}>
                  {link.code}
                </span>
                <span className="text-[11.5px]" style={{ color: theme.textFaint }}>
                  {minutesLeft > 0 ? `Expires in ${minutesLeft} min · this card updates by itself once linked` : 'Expired — request a new one'}
                </span>
              </div>
              <button type="button" onClick={getCode} disabled={loading} className="self-start text-[12.5px] font-semibold" style={{ color: theme.brand, border: 'none', background: 'none' }}>
                {loading ? 'Generating…' : 'Get a new code'}
              </button>
            </>
          )}
        </div>
      )}

      {error && <div className="text-[12.5px]" style={{ color: theme.criticalStrong }}>{error}</div>}
    </div>
  );
}

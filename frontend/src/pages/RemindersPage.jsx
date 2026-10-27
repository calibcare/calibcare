import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import client from '../api/client';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { CheckCircleIcon, AlertTriangleIcon, ClockIcon, ChevronDownIcon } from '../components/icons';

const CHANNEL_META = {
  LINE: { label: 'LINE', color: theme.brand, bg: '#eef1f8' },
  EMAIL: { label: 'Email', color: theme.textMuted, bg: theme.chipBg },
};

const HISTORY_PAGE_SIZE = 10;

function Card({ children, style, ...rest }) {
  return (
    <div
      className="bg-white rounded-2xl p-[22px_24px] flex flex-col gap-3.5"
      style={{ border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}

function CardHeader({ icon, iconBg, title }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-[34px] h-[34px] rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: iconBg }}>
        {icon}
      </div>
      <span className="text-[15px] font-bold" style={{ color: theme.ink }}>
        {title}
      </span>
    </div>
  );
}

function Hint({ children }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="mt-[1px] shrink-0">
        <AlertTriangleIcon size={13} color={theme.textFaint} />
      </span>
      <span className="text-[12px]" style={{ color: theme.textFaint, lineHeight: 1.5 }}>
        {children}
      </span>
    </div>
  );
}

function ChannelChip({ channel }) {
  const meta = CHANNEL_META[channel] || { label: channel, color: theme.textMuted, bg: theme.chipBg };
  return (
    <span className="text-[11px] font-semibold rounded-[6px] px-[9px] py-[3px] inline-block" style={{ color: meta.color, backgroundColor: meta.bg }}>
      {meta.label}
    </span>
  );
}

function StatusPill({ status }) {
  const isSent = status === 'sent';
  return (
    <span
      className="text-[11px] font-bold rounded-full px-[10px] py-[3px] inline-block"
      style={{ color: isSent ? theme.good : theme.criticalStrong, backgroundColor: isSent ? theme.goodBg : theme.criticalBgStrong }}
    >
      {isSent ? 'Sent' : 'Failed'}
    </span>
  );
}

function Toggle({ on, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center rounded-full relative shrink-0"
      style={{ width: 38, height: 22, backgroundColor: on ? theme.brand : '#d7dbe8', border: 'none', cursor: disabled ? 'default' : 'pointer' }}
    >
      <span className="rounded-full bg-white absolute" style={{ width: 18, height: 18, top: 2, left: on ? 18 : 2, transition: 'left 0.15s' }} />
    </button>
  );
}

function FilterSelect({ value, onChange, children }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className="appearance-none rounded-md pl-3 pr-8 py-2 text-[12.5px] font-medium"
        style={{ border: `1px solid ${theme.borderStrong}`, color: '#5b6478', backgroundColor: '#fff' }}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: theme.textFaint }}>
        <ChevronDownIcon size={11} />
      </span>
    </div>
  );
}

function formatDateTime(value) {
  if (!value) return 'Never';
  return new Date(value.replace(' ', 'T')).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function ConnectLineCard({ user, summary }) {
  const [link, setLink] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isConnected = Boolean(user?.line_user_id);

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
    <Card style={{ flex: 1 }}>
      <div className="flex items-center justify-between">
        <CardHeader
          icon={<CheckCircleIcon size={17} color={isConnected ? theme.good : theme.textFaint} />}
          iconBg={isConnected ? theme.goodBg : theme.chipBg}
          title="LINE notifications"
        />
        <span
          className="text-[11.5px] font-bold rounded-full px-3 py-1"
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
            {summary ? `${summary.lineRecipientCount} account${summary.lineRecipientCount === 1 ? '' : 's'} currently receiving LINE alerts` : '…'}
          </div>
        </div>
      ) : (
        <div className="rounded-xl p-3.5 flex flex-col gap-2.5" style={{ backgroundColor: '#fafbfd', border: `1px solid ${theme.border}` }}>
          {!link ? (
            <>
              <p className="text-[13px]" style={{ color: theme.textMuted, lineHeight: 1.5 }}>
                Link your LINE account so you personally receive calibration reminders here in CalibCare.
              </p>
              <button
                type="button"
                onClick={getCode}
                disabled={loading}
                className="self-start rounded-md px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: '#182448', border: 'none' }}
              >
                {loading ? 'Generating…' : 'Get linking code'}
              </button>
            </>
          ) : (
            <>
              <ol className="text-[12.5px] list-decimal list-inside flex flex-col gap-1" style={{ color: theme.textMuted }}>
                <li>
                  {link.addFriendUrl ? (
                    <a href={link.addFriendUrl} target="_blank" rel="noreferrer" style={{ color: theme.brand }}>
                      Add the CalibCare LINE Official Account as a friend
                    </a>
                  ) : (
                    'Add the CalibCare LINE Official Account as a friend in the LINE app'
                  )}
                  , or search for it directly.
                </li>
                <li>Send it the code below as a message.</li>
              </ol>
              <div className="flex items-center gap-3">
                <span className="text-[22px] font-bold tracking-widest rounded-md px-4 py-2" style={{ backgroundColor: '#fff', border: `1px solid ${theme.border}`, color: theme.ink }}>
                  {link.code}
                </span>
                <span className="text-[11.5px]" style={{ color: theme.textFaint }}>
                  {minutesLeft > 0 ? `Expires in ${minutesLeft} min` : 'Expired — request a new one'}
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
    </Card>
  );
}

function DueDateCheckCard({ user, summary, onRun }) {
  const canRun = Boolean(user?.can_run_reminders);
  const [running, setRunning] = useState(false);
  const [runSummary, setRunSummary] = useState(null);
  const [error, setError] = useState('');

  async function handleRun() {
    setRunning(true);
    setError('');
    setRunSummary(null);
    try {
      const { data } = await client.post('/api/reminders/run');
      const outcomes = data.results.flatMap((r) => r.channels || []);
      const sent = outcomes.filter((c) => c.status === 'sent').length;
      const failed = outcomes.filter((c) => c.status === 'failed').length;
      const skipped = data.results.filter((r) => r.skipped).length + outcomes.filter((c) => c.skipped).length;
      setRunSummary({ sent, failed, skipped, dryRun: data.lineDryRun || data.emailDryRun });
      onRun();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to run reminder check');
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card style={{ flex: 1 }}>
      <CardHeader icon={<ClockIcon size={17} color={theme.brand} />} iconBg="#eef1f8" title="Due-date check" />

      <div className="flex gap-2.5">
        <div className="flex-1 rounded-xl p-3" style={{ backgroundColor: '#fafbfd', border: `1px solid ${theme.border}` }}>
          <div className="text-[11px] font-bold tracking-wide uppercase mb-1" style={{ color: theme.textFaint }}>
            Last sent
          </div>
          <div className="text-[13.5px] font-semibold" style={{ color: theme.inkAlt }}>
            {summary ? formatDateTime(summary.lastSentAt) : '…'}
          </div>
          <div className="text-[12px] mt-[2px]" style={{ color: theme.textFaint }}>
            {summary ? `${summary.sentLast24h} sent in the last 24h` : ''}
          </div>
        </div>
      </div>

      {runSummary && (
        <div className="rounded-xl p-3 text-[12.5px]" style={{ backgroundColor: theme.goodBg, color: '#0a7a45' }}>
          {runSummary.sent} sent · {runSummary.skipped} skipped · {runSummary.failed} failed
          {runSummary.dryRun ? ' (dry-run — a channel has no real credentials configured)' : ''}
        </div>
      )}
      {error && <div className="text-[12.5px]" style={{ color: theme.criticalStrong }}>{error}</div>}

      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px]" style={{ color: theme.textFaint }}>
          Need it sooner? Run the check now instead of waiting for the scheduled run.
        </span>
        <button
          type="button"
          onClick={handleRun}
          disabled={!canRun || running}
          className="rounded-md px-[18px] py-2.5 text-[13px] font-semibold shrink-0 disabled:cursor-not-allowed"
          style={{
            backgroundColor: canRun ? '#182448' : '#e9ebf1',
            color: canRun ? '#fff' : theme.textFaint,
            border: 'none',
            opacity: running ? 0.7 : 1,
          }}
        >
          {running ? 'Running…' : 'Run now'}
        </button>
      </div>
      {!canRun && <Hint>Only a Deputy Manager can trigger a manual check — button stays visible but disabled for other roles.</Hint>}
    </Card>
  );
}

function RulesCard({ rules, canAssign, onToggle }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-bold" style={{ color: theme.ink }}>
          Reminder rules
        </span>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${theme.border}` }}>
        <div className="flex items-center px-4 py-2.5" style={{ backgroundColor: '#fafbfd' }}>
          <span className="flex-[2.2] text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.textFaint }}>
            Trigger
          </span>
          <span className="flex-[1.6] text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.textFaint }}>
            Channels
          </span>
          <span className="flex-[0.8] text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.textFaint }}>
            Active
          </span>
        </div>

        {rules.map((rule) => (
          <div key={rule.bucket} className="flex items-center px-4 py-3" style={{ borderTop: `1px solid ${theme.divider}` }}>
            <div className="flex-[2.2]">
              <span className="text-[13.5px] font-semibold" style={{ color: theme.inkAlt }}>
                {rule.label}
              </span>
            </div>
            <div className="flex-[1.6] flex gap-1.5">
              {canAssign ? (
                <>
                  <button
                    type="button"
                    onClick={() => onToggle(rule.bucket, { send_line: !rule.send_line })}
                    className="text-[11px] font-semibold rounded-[6px] px-[9px] py-[3px]"
                    style={{
                      color: rule.send_line ? theme.brand : theme.textFaint,
                      backgroundColor: rule.send_line ? '#eef1f8' : theme.chipBg,
                      border: 'none',
                    }}
                  >
                    LINE
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggle(rule.bucket, { send_email: !rule.send_email })}
                    className="text-[11px] font-semibold rounded-[6px] px-[9px] py-[3px]"
                    style={{
                      color: rule.send_email ? theme.textMuted : theme.textFainter,
                      backgroundColor: rule.send_email ? theme.chipBg : '#fff',
                      border: rule.send_email ? 'none' : `1px dashed ${theme.borderStrong}`,
                    }}
                  >
                    Email
                  </button>
                </>
              ) : (
                <>
                  {rule.send_line && <ChannelChip channel="LINE" />}
                  {rule.send_email && <ChannelChip channel="EMAIL" />}
                </>
              )}
            </div>
            <div className="flex-[0.8]">
              <Toggle on={rule.enabled} disabled={!canAssign} onClick={() => onToggle(rule.bucket, { enabled: !rule.enabled })} />
            </div>
          </div>
        ))}
      </div>

      {!canAssign && <Hint>Only a Deputy Manager can change reminder rules — everyone else sees them read-only.</Hint>}
    </Card>
  );
}

function HistoryCard() {
  const [days, setDays] = useState(7);
  const [history, setHistory] = useState([]);
  const [total, setTotal] = useState(0);
  const [shown, setShown] = useState(HISTORY_PAGE_SIZE);
  const [error, setError] = useState('');

  const load = useCallback(async (daysValue, limit) => {
    try {
      const { data } = await client.get('/api/reminders/history', { params: { days: daysValue, limit } });
      setHistory(data.history);
      setTotal(data.total);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load reminder history');
    }
  }, []);

  useEffect(() => {
    setShown(HISTORY_PAGE_SIZE);
    load(days, HISTORY_PAGE_SIZE);
  }, [days, load]);

  function handleShowMore() {
    const next = shown + HISTORY_PAGE_SIZE;
    setShown(next);
    load(days, next);
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-bold" style={{ color: theme.ink }}>
          Reminder history
        </span>
        <FilterSelect value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </FilterSelect>
      </div>

      {error && <div className="text-[12.5px]" style={{ color: theme.criticalStrong }}>{error}</div>}

      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${theme.border}` }}>
        <div className="flex items-center px-4 py-2.5" style={{ backgroundColor: '#fafbfd' }}>
          <span className="flex-[1.3] text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.textFaint }}>
            Sent
          </span>
          <span className="flex-[2.4] text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.textFaint }}>
            Equipment
          </span>
          <span className="flex-[1.6] text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.textFaint }}>
            Rule
          </span>
          <span className="flex-[1.2] text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.textFaint }}>
            Channel
          </span>
          <span className="flex-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.textFaint }}>
            Status
          </span>
        </div>

        {history.length === 0 && (
          <div className="px-4 py-6 text-center text-[13px]" style={{ color: theme.textFaint }}>
            No reminders sent in this window
          </div>
        )}

        {history.map((h) => (
          <div key={h.notification_id} className="flex items-center px-4 py-3" style={{ borderTop: `1px solid ${theme.divider}` }}>
            <span className="flex-[1.3] text-[13px]" style={{ color: theme.textMuted }}>
              {formatDateTime(h.sent_at)}
            </span>
            <div className="flex-[2.4]">
              <span className="text-[13px] font-semibold" style={{ color: theme.brand }}>
                {h.name}
              </span>
              <span className="text-[12px]" style={{ color: theme.textFaint }}>
                {' '}
                · S/N {h.serial_number}
              </span>
            </div>
            <span className="flex-[1.6] text-[12.5px]" style={{ color: '#38415a' }}>
              {h.label}
            </span>
            <div className="flex-[1.2]">
              <ChannelChip channel={h.channel} />
            </div>
            <div className="flex-1">
              <StatusPill status={h.status} />
            </div>
          </div>
        ))}

        {shown < total && (
          <button
            type="button"
            onClick={handleShowMore}
            className="w-full text-[12.5px] font-semibold text-center py-[11px]"
            style={{ color: theme.brand, border: 'none', borderTop: `1px solid ${theme.divider}`, background: 'none' }}
          >
            Show {Math.min(HISTORY_PAGE_SIZE, total - shown)} more
          </button>
        )}
      </div>
    </Card>
  );
}

export function RemindersPage() {
  const { user } = useAuth();
  const canAssign = Boolean(user?.can_run_reminders);

  const [summary, setSummary] = useState(null);
  const [rules, setRules] = useState([]);
  const [error, setError] = useState('');

  const loadSummary = useCallback(() => {
    client
      .get('/api/reminders/summary')
      .then(({ data }) => setSummary(data))
      .catch(() => {});
  }, []);

  const loadRules = useCallback(() => {
    client
      .get('/api/reminders/rules')
      .then(({ data }) => setRules(data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load reminder rules'));
  }, []);

  useEffect(() => {
    if (!canAssign) return;
    loadSummary();
    loadRules();
  }, [canAssign, loadSummary, loadRules]);

  async function handleToggle(bucket, patch) {
    setError('');
    try {
      const { data } = await client.patch(`/api/reminders/rules/${bucket}`, patch);
      setRules((prev) => prev.map((r) => (r.bucket === bucket ? data : r)));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update reminder rule');
    }
  }

  // Reminders (rules, history, manual run, LINE connection detail) is
  // Deputy Manager tooling -- the nav link and top-bar bell are already
  // hidden for everyone else; this guards against navigating here directly
  // by URL. Placed after every hook above, not before, so this early
  // return never changes the number of hooks called on a given render.
  if (user && !canAssign) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm" style={{ color: '#7a8296' }}>
        Connect LINE, set reminder rules, and review what's been sent.
      </p>

      {error && (
        <div className="rounded-md px-4 py-2.5 text-sm" style={{ backgroundColor: theme.criticalBg, color: theme.criticalStrong }}>
          {error}
        </div>
      )}

      <div className="flex gap-5 items-stretch">
        <ConnectLineCard user={user} summary={summary} />
        <DueDateCheckCard user={user} summary={summary} onRun={loadSummary} />
      </div>

      <RulesCard rules={rules} canAssign={canAssign} onToggle={handleToggle} />

      <HistoryCard />
    </div>
  );
}

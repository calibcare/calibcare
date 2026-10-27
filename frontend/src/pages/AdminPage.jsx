import { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import client from '../api/client';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui';
import { SearchIcon } from '../components/icons';

// Admin page (Deputy Manager + Senior Specialist): help colleagues who are
// locked out, and download a full backup of the database. Passwords are
// stored scrambled, so nobody -- admins included -- can see one; locked-out
// users get a one-time temporary password they must replace at next login.

function Badge({ ok, yes, no }) {
  return (
    <span
      className="inline-flex rounded-full px-[9px] py-[2px] text-[11.5px] font-bold whitespace-nowrap"
      style={ok ? { color: theme.good, backgroundColor: theme.goodBg } : { color: theme.warning, backgroundColor: theme.warningBg }}
    >
      {ok ? yes : no}
    </span>
  );
}

function Modal({ children, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15,20,40,.35)' }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-2xl p-6 w-full max-w-[440px]"
        style={{ boxShadow: '0 20px 50px rgba(16,24,40,.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

const primaryBtn = 'rounded-[9px] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50';
const linkBtn = 'text-[12.5px] font-semibold whitespace-nowrap disabled:opacity-50';

export function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [q, setQ] = useState('');
  const [confirmUser, setConfirmUser] = useState(null);
  const [issued, setIssued] = useState(null); // { user, temporaryPassword }
  const [busyId, setBusyId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await client.get('/api/admin/users');
      setUsers(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.can_edit) load();
  }, [load, user?.can_edit]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? users.filter((u) => `${u.full_name} ${u.email}`.toLowerCase().includes(needle)) : users;
  }, [users, q]);

  const counts = {
    total: users.length,
    unverified: users.filter((u) => !u.email_verified).length,
    noLine: users.filter((u) => !u.line_linked).length,
    pending: users.filter((u) => u.must_change_password).length,
  };

  async function issueTemporaryPassword(target) {
    setBusyId(target.user_id);
    setError('');
    try {
      const { data } = await client.post(`/api/admin/users/${target.user_id}/temporary-password`);
      setConfirmUser(null);
      setCopied(false);
      setIssued({ user: target, temporaryPassword: data.temporaryPassword });
      load();
    } catch (err) {
      setConfirmUser(null);
      setError(err.response?.data?.error || 'Could not set a temporary password');
    } finally {
      setBusyId(null);
    }
  }

  async function resendVerification(target) {
    setBusyId(target.user_id);
    setError('');
    setNotice('');
    try {
      const { data } = await client.post(`/api/admin/users/${target.user_id}/resend-verification`);
      setNotice(data.emailDryRun ? `Email sending is switched off on this server, so no code was sent to ${target.email}.` : `A new verification code was emailed to ${target.email}.`);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not resend the verification email');
    } finally {
      setBusyId(null);
    }
  }

  async function downloadBackup() {
    setDownloading(true);
    setError('');
    try {
      const { data, headers } = await client.get('/api/admin/backup.xlsx', { responseType: 'blob' });
      // The API is on another origin, so the browser hides Content-Disposition
      // unless it's exposed -- fall back to the same dated name client-side.
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const name = /filename="([^"]+)"/.exec(headers['content-disposition'] || '')?.[1] || `calibcare-backup-${today}.xlsx`;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      setNotice(`Backup downloaded: ${name}`);
    } catch {
      setError('Could not download the backup');
    } finally {
      setDownloading(false);
    }
  }

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(issued.temporaryPassword);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  // The server refuses non-editors anyway (requireCapability); this just
  // avoids showing them an empty, erroring page if they type /admin.
  if (!user?.can_edit) return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Admin" />

      {error && (
        <div className="rounded-[10px] px-4 py-2.5 text-sm" style={{ backgroundColor: theme.criticalBg, color: theme.criticalStrong }}>
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-[10px] px-4 py-2.5 text-sm" style={{ backgroundColor: theme.goodBg, color: '#0a7a45' }}>
          {notice}
        </div>
      )}

      {/* Backup */}
      <div className="bg-white rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap" style={{ border: `1px solid ${theme.borderStrong}` }}>
        <div className="max-w-[640px]">
          <div className="text-[15px] font-bold mb-1" style={{ color: theme.ink }}>
            Database backup
          </div>
          <p className="text-[13px]" style={{ color: theme.textMuted }}>
            Download everything as one Excel file: equipment, capabilities, calibration history, users, reminder rules, sent reminders and calendar notes, one
            sheet each. Passwords and certificate PDFs are not included. Keep the file somewhere safe; it contains staff names and emails.
          </p>
        </div>
        <button type="button" onClick={downloadBackup} disabled={downloading} className={primaryBtn} style={{ backgroundColor: '#182448', border: 'none' }}>
          {downloading ? 'Preparing…' : 'Download backup (Excel)'}
        </button>
      </div>

      {/* Accounts */}
      <div className="bg-white rounded-2xl" style={{ border: `1px solid ${theme.borderStrong}` }}>
        <div className="flex items-center justify-between gap-4 flex-wrap px-5 pt-5 pb-3">
          <div>
            <div className="text-[15px] font-bold" style={{ color: theme.ink }}>
              Accounts
            </div>
            <div className="text-[12.5px] mt-0.5" style={{ color: theme.textMuted }}>
              {counts.total} accounts · {counts.unverified} email not verified · {counts.noLine} without LINE · {counts.pending} waiting to change a temporary password
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-[9px] px-3 py-[7px] bg-white" style={{ border: `1px solid ${theme.borderStrong}`, width: 260, maxWidth: '100%' }}>
            <SearchIcon size={14} color={theme.textFaint} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" className="text-[13px] flex-1 outline-none min-w-0" style={{ border: 'none' }} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Name', 'Position', 'Email', 'LINE', 'Joined', ''].map((h, i) => (
                  <th key={i} className="text-left text-[12.5px] font-bold px-4 py-2.5 whitespace-nowrap" style={{ color: theme.ink, borderBottom: `2px solid ${theme.borderStrong}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[13px]" style={{ color: theme.textFaint }}>
                    Loading…
                  </td>
                </tr>
              )}
              {shown.map((u) => {
                const isMe = u.user_id === user?.user_id;
                return (
                  <tr key={u.user_id} style={{ borderBottom: `1px solid ${theme.divider}` }}>
                    <td className="px-4 py-3">
                      <div className="text-[13px] font-semibold" style={{ color: theme.ink }}>
                        {u.full_name}
                        {isMe && <span style={{ color: theme.textFaint, fontWeight: 500 }}> (you)</span>}
                      </div>
                      <div className="text-[12px]" style={{ color: theme.textMuted }}>
                        {u.email}
                      </div>
                      {u.must_change_password && (
                        <div className="text-[11.5px] font-semibold mt-0.5" style={{ color: theme.warning }}>
                          Temporary password issued, not changed yet
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[13px] whitespace-nowrap" style={{ color: theme.textMuted }}>
                      {u.position_label}
                    </td>
                    <td className="px-4 py-3">
                      <Badge ok={u.email_verified} yes="Verified" no="Not verified" />
                    </td>
                    <td className="px-4 py-3">
                      <Badge ok={u.line_linked} yes="Linked" no="Not linked" />
                    </td>
                    <td className="px-4 py-3 text-[13px] whitespace-nowrap" style={{ color: theme.textMuted }}>
                      {String(u.created_at || '').slice(0, 10) || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.can_manage ? (
                        <div className="flex flex-col items-end gap-1">
                          <button type="button" onClick={() => setConfirmUser(u)} disabled={busyId === u.user_id} className={linkBtn} style={{ color: theme.brand, border: 'none', background: 'none' }}>
                            Set temporary password
                          </button>
                          {!u.email_verified && (
                            <button type="button" onClick={() => resendVerification(u)} disabled={busyId === u.user_id} className={linkBtn} style={{ color: theme.brand, border: 'none', background: 'none' }}>
                              Resend verification email
                            </button>
                          )}
                        </div>
                      ) : (
                        <span
                          className="text-[12px]"
                          style={{ color: theme.textFaint }}
                          title={isMe ? 'Change your own password from Profile' : 'Only a more senior position can manage this account'}
                        >
                          {isMe ? 'Use Profile' : 'Senior account'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && shown.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[13px]" style={{ color: theme.textFaint }}>
                    No accounts match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {confirmUser && (
        <Modal onClose={() => setConfirmUser(null)}>
          <div className="text-[16px] font-bold mb-2" style={{ color: theme.ink }}>
            Set a temporary password?
          </div>
          <p className="text-[13.5px] mb-5" style={{ color: theme.textMuted }}>
            {confirmUser.full_name}'s current password will stop working. You'll see a temporary password once; give it to them, and they'll choose their own
            when they log in.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => issueTemporaryPassword(confirmUser)}
              disabled={busyId === confirmUser.user_id}
              className={primaryBtn}
              style={{ backgroundColor: '#182448', border: 'none' }}
            >
              {busyId === confirmUser.user_id ? 'Setting…' : 'Set temporary password'}
            </button>
            <button type="button" onClick={() => setConfirmUser(null)} className="text-[13px] font-semibold" style={{ color: theme.textFaint, border: 'none', background: 'none' }}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {issued && (
        <Modal onClose={() => setIssued(null)}>
          <div className="text-[16px] font-bold mb-2" style={{ color: theme.ink }}>
            Temporary password for {issued.user.full_name}
          </div>
          <div
            className="flex items-center justify-between gap-3 rounded-[10px] px-4 py-3 my-3"
            style={{ backgroundColor: theme.chipBg, border: `1px solid ${theme.borderStrong}` }}
          >
            <code className="text-[20px] font-bold tracking-wider" style={{ color: theme.ink }}>
              {issued.temporaryPassword}
            </code>
            <button type="button" onClick={copyPassword} className="text-[12.5px] font-semibold" style={{ color: theme.brand, border: 'none', background: 'none' }}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <ol className="text-[13px] list-decimal pl-5 flex flex-col gap-1 mb-5" style={{ color: theme.textMuted }}>
            <li>Give it to {issued.user.full_name} in person or by private message.</li>
            <li>They log in with {issued.user.email} and this password.</li>
            <li>CalibCare makes them choose their own password straight away.</li>
          </ol>
          <p className="text-[12.5px] mb-4 font-semibold" style={{ color: theme.warning }}>
            This password won't be shown again.
          </p>
          <button type="button" onClick={() => setIssued(null)} className={primaryBtn} style={{ backgroundColor: '#182448', border: 'none' }}>
            Done
          </button>
        </Modal>
      )}
    </div>
  );
}

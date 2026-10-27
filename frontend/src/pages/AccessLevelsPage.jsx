import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import client from '../api/client';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui';

export function AccessLevelsPage() {
  const { user } = useAuth();
  const canAssign = Boolean(user?.can_run_reminders);

  const [positions, setPositions] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    if (!canAssign) return;
    Promise.all([client.get('/api/users/positions'), client.get('/api/users')])
      .then(([p, u]) => {
        setPositions(p.data);
        setUsers(u.data);
      })
      .catch((err) => setError(err.response?.data?.error || 'Failed to load team list'));
  }, [canAssign]);

  // Team/position assignment is Deputy Manager tooling -- anyone else who
  // navigates here directly (the nav link is already hidden for them) gets
  // sent to their own Settings page instead of a list of everyone's position.
  if (user && !canAssign) {
    return <Navigate to="/settings" replace />;
  }

  // Only the System Owner may give or change the Owner position (the
  // backend enforces this; here it just hides what would be refused).
  const ownerKeys = positions.filter((p) => p.canManageOwner).map((p) => p.key);
  const canManageOwner = Boolean(user?.can_manage_owner);
  const choices = canManageOwner ? positions : positions.filter((p) => !p.canManageOwner);

  async function handlePositionChange(userId, position) {
    setSavingId(userId);
    setError('');
    try {
      const { data } = await client.patch(`/api/users/${userId}/position`, { position });
      setUsers((prev) =>
        prev
          .map((u) => (u.user_id === userId ? data : u))
          .sort((a, b) => a.position_rank - b.position_rank || a.full_name.localeCompare(b.full_name))
      );
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change position');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Team"
        description="Everyone with access, and their position. The position decides what each person can view and change."
        stats={users.length ? [{ label: 'People', value: users.length }] : undefined}
      />

      {error && (
        <div className="rounded-[10px] px-4 py-2.5 text-sm" style={{ backgroundColor: theme.criticalBg, color: theme.criticalStrong }}>
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl p-5" style={{ maxWidth: 520, border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
        <div className="flex flex-col">
          {users.map((u) => {
            const isSelf = u.user_id === user?.user_id;
            return (
              <div key={u.user_id} className="flex items-center justify-between gap-3 py-3" style={{ borderBottom: `1px solid ${theme.divider}` }}>
                <span className="text-[13.5px] font-semibold truncate" style={{ color: theme.ink }}>
                  {u.full_name}
                  {isSelf && (
                    <span className="font-medium" style={{ color: theme.textFaint }}>
                      {' '}
                      · you
                    </span>
                  )}
                </span>

                {canAssign && !isSelf && (canManageOwner || !ownerKeys.includes(u.role)) ? (
                  <select
                    value={u.role}
                    disabled={savingId === u.user_id}
                    onChange={(e) => handlePositionChange(u.user_id, e.target.value)}
                    className="text-[12px] rounded-[8px] px-2 py-1.5 shrink-0"
                    style={{ border: `1px solid ${theme.borderStrong}`, color: theme.ink, backgroundColor: '#fff' }}
                  >
                    {choices.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[12.5px] text-right shrink-0" style={{ color: theme.textMuted }}>
                    {u.position_label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

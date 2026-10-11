import { useAuth } from '../context/AuthContext';

const INK = '#0F172A';
const MUTED = '#64748B';
const BORDER = '#E2E8F0';

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
      <span className="text-sm font-medium" style={{ color: MUTED }}>
        {label}
      </span>
      <span className="text-sm font-semibold" style={{ color: INK }}>
        {value}
      </span>
    </div>
  );
}

export function SettingsPage() {
  const { user } = useAuth();

  return (
    <div>
      <p className="text-sm mb-6" style={{ color: MUTED }}>
        Your account details.
      </p>

      <div className="bg-white rounded-2xl p-5 max-w-md" style={{ border: `1.5px solid ${BORDER}` }}>
        <Row label="Name" value={user?.full_name} />
        <Row label="Email" value={user?.email} />
        <Row label="Position" value={user?.position_label} />
        <Row label="Access level" value={user?.position_rank ? `${user.position_rank} of 5` : '—'} />
        <Row label="Can edit records" value={user?.can_edit ? 'Yes' : 'No — view only'} />
      </div>
    </div>
  );
}

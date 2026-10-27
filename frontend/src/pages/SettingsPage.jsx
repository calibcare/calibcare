import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui';

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
    <div className="flex flex-col gap-6">
      <PageHeader title="Profile" />

      <div className="bg-white rounded-2xl p-5 max-w-md" style={{ border: `1.5px solid ${BORDER}` }}>
        <Row label="Name" value={user?.full_name} />
        <Row label="Email" value={user?.email} />
        <Row label="Position" value={user?.position_label} />
        <Row label="Access level" value={user?.position_rank ? user.position_count ? `${user.position_rank} of ${user.position_count}` : String(user.position_rank) : '—'} />
        <Row label="Can edit records" value={user?.can_edit ? 'Yes' : 'No — view only'} />
        <div className="pt-4">
          <Link
            to="/change-password"
            className="inline-block rounded-[9px] px-4 py-2 text-[13px] font-semibold text-white"
            style={{ backgroundColor: '#182448' }}
          >
            Change password
          </Link>
        </div>
      </div>
    </div>
  );
}

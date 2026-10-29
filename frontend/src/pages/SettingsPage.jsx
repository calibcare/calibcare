import { Link } from 'react-router-dom';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui';
import { ConnectLineCard } from '../components/ConnectLineCard';
import { KeyIcon, MailIcon } from '../components/icons';

// Every account that can log in has a verified email, and the daily job
// emails every verified account -- so email reminders are always on.
function EmailCard({ email }) {
  return (
    <div
      className="bg-white rounded-2xl p-[22px_24px] flex flex-col gap-3.5"
      style={{ border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0" style={{ backgroundColor: theme.goodBg }}>
            <MailIcon size={17} color={theme.good} />
          </div>
          <span className="text-[15px] font-bold" style={{ color: theme.ink }}>
            Email notifications
          </span>
        </div>
        <span className="text-[11.5px] font-bold rounded-full px-3 py-1 whitespace-nowrap" style={{ color: theme.good, backgroundColor: theme.goodBg }}>
          On
        </span>
      </div>
      <div className="rounded-xl p-3.5" style={{ backgroundColor: '#fafbfd', border: `1px solid ${theme.border}` }}>
        <div className="text-[13.5px] font-semibold break-all" style={{ color: theme.inkAlt }}>
          {email}
        </div>
        <div className="text-[12px] mt-[2px]" style={{ color: theme.textFaint }}>
          You receive calibration reminders by email 30, 7 and 1 day before a due date.
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { user } = useAuth();
  const initial = (user?.full_name || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Profile" />

      <div className="max-w-[960px] w-full flex flex-col gap-5">
        <div
          className="bg-white rounded-2xl p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-5"
          style={{ border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}
        >
          <div className="flex items-center gap-4 md:gap-5 flex-1 min-w-0">
            <span
              className="w-16 h-16 md:w-[72px] md:h-[72px] rounded-full flex items-center justify-center text-[26px] md:text-[28px] font-bold text-white shrink-0"
              style={{ backgroundColor: theme.brandDark }}
            >
              {initial}
            </span>
            <div className="min-w-0 flex flex-col gap-1.5">
              <h2 className="text-[20px] md:text-[22px] font-bold leading-tight truncate" style={{ color: theme.ink }}>
                {user?.full_name}
              </h2>
              <span
                className="self-start text-[12px] font-bold rounded-full px-3 py-1"
                style={{ color: theme.brand, backgroundColor: '#eaf0ff' }}
              >
                {user?.position_label}
              </span>
              <span className="text-[13.5px] break-all" style={{ color: theme.textMuted }}>
                {user?.email}
              </span>
            </div>
          </div>
          <Link
            to="/change-password"
            className="self-start md:self-center flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap hover:bg-[#f6f7fb]"
            style={{ border: `1px solid ${theme.borderStrong}`, color: theme.ink }}
          >
            <KeyIcon size={16} color={theme.inkAlt} />
            Change password
          </Link>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-[14px] font-bold" style={{ color: theme.ink }}>
            Where your reminders go
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
            <EmailCard email={user?.email} />
            <ConnectLineCard />
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';
import { HomeIcon, PackageIcon, BellIcon, SettingsIcon, LogOutIcon, SearchIcon, UsersIcon } from './icons';

const BASE_NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', Icon: HomeIcon },
  { to: '/equipment', label: 'Equipment', Icon: PackageIcon },
];
// Reminders (rules, history, manual run, and every account's own LINE
// connection) and Team (assigning positions) are both Deputy Manager
// tooling -- confirmed with the user everyone else should see only
// Dashboard/Equipment.
const REMINDERS_NAV_ITEM = { to: '/reminders', label: 'Reminders', Icon: BellIcon };
const TEAM_NAV_ITEM = { to: '/access-levels', label: 'Team', Icon: UsersIcon };

function SidebarLink({ to, label, Icon }) {
  return (
    <NavLink
      to={to}
      className="flex items-center gap-[11px] w-full rounded-[10px] text-sm px-3.5 py-2.5"
      style={({ isActive }) => ({
        backgroundColor: isActive ? '#ffffff' : 'transparent',
        boxShadow: isActive ? '0 1px 2px rgba(16,24,40,.06)' : 'none',
        color: isActive ? theme.brand : theme.textMuted,
        fontWeight: isActive ? 600 : 500,
      })}
    >
      {({ isActive }) => (
        <>
          <Icon color={isActive ? theme.brand : theme.textMuted} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

function LogoMark() {
  return (
    <div className="w-9 h-9 rounded-[11px] flex items-center justify-center shrink-0" style={{ background: theme.brandGradient }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12h4l2.5-7 4 14L15 9l2 3h5" />
      </svg>
    </div>
  );
}

function Sidebar() {
  const { user } = useAuth();
  const navItems = user?.can_run_reminders ? [...BASE_NAV_ITEMS, REMINDERS_NAV_ITEM, TEAM_NAV_ITEM] : BASE_NAV_ITEMS;

  return (
    <aside
      className="w-[240px] shrink-0 h-screen sticky top-0 flex flex-col px-4 py-6"
      style={{ backgroundColor: theme.sidebarBg, borderRight: `1px solid ${theme.borderStrong}` }}
    >
      <div className="flex flex-col gap-7">
        <div className="flex items-center gap-2.5 px-2 pb-1">
          <LogoMark />
          <span className="text-[19px] font-bold tracking-tight" style={{ color: '#182448' }}>
            Calibcare
          </span>
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <SidebarLink key={item.to} {...item} />
          ))}
        </nav>
      </div>
    </aside>
  );
}

function ProfileMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function goTo(path) {
    setOpen(false);
    navigate(path);
  }

  function handleLogout() {
    setOpen(false);
    logout();
    navigate('/login');
  }

  const initial = (user?.full_name || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white"
        style={{ backgroundColor: theme.brandDark, border: 'none' }}
        title={`${user?.full_name || ''} (${user?.position_label || ''})`}
      >
        {initial}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 rounded-[12px] bg-white overflow-hidden"
          style={{ width: 220, border: `1px solid ${theme.border}`, boxShadow: '0 8px 24px rgba(16,24,40,.12)', zIndex: 20 }}
        >
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${theme.divider}` }}>
            <div className="text-[13px] font-semibold truncate" style={{ color: theme.ink }}>
              {user?.full_name}
            </div>
            <div className="text-[11.5px] truncate" style={{ color: theme.textFaint }}>
              {user?.position_label}
            </div>
          </div>
          <button
            type="button"
            onClick={() => goTo('/settings')}
            className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-[13px] font-medium"
            style={{ color: theme.textMuted, border: 'none', background: 'none' }}
          >
            <SettingsIcon color={theme.textMuted} />
            Profile
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-[13px] font-medium"
            style={{ color: theme.criticalStrong, border: 'none', background: 'none' }}
          >
            <LogOutIcon color={theme.criticalStrong} />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

function TopBar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  function handleSearchSubmit(e) {
    e.preventDefault();
    if (search.trim()) navigate(`/equipment?q=${encodeURIComponent(search.trim())}`);
  }

  return (
    <div className="h-[72px] shrink-0 bg-white flex items-center justify-end gap-4 px-8" style={{ borderBottom: `1px solid ${theme.border}` }}>
      <form onSubmit={handleSearchSubmit} className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
          <SearchIcon color={theme.textFaint} />
        </span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search equipment..."
          className="h-9 w-[320px] pl-9 pr-3 rounded-[10px] text-[13.5px] outline-none"
          style={{ backgroundColor: theme.chipBg, color: theme.ink }}
        />
      </form>
      {user?.can_run_reminders && (
        <NavLink
          to="/reminders"
          title="Reminders"
          className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
          style={{ backgroundColor: theme.chipBg }}
        >
          <BellIcon color={theme.textMuted} />
        </NavLink>
      )}
      <ProfileMenu />
    </div>
  );
}

export function Layout() {
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: theme.pageBg }}>
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <div className="flex-1 px-8 py-7">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

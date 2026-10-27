import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';
import { HomeIcon, PackageIcon, BellIcon, LogOutIcon, SearchIcon, UsersIcon, ShieldIcon, SettingsIcon, KeyIcon, ChevronDownIcon } from './icons';

// Navigation, grouped like with like: everyday pages first, management
// pages (only for the positions that can use them) under their own label.
const MAIN_NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', Icon: HomeIcon },
  { to: '/equipment', label: 'Equipment', Icon: PackageIcon },
];
// Reminders (rules, history, manual run, and every account's own LINE
// connection) and Team (assigning positions) are both Deputy Manager
// tooling -- confirmed with the user everyone else should see only
// Dashboard/Equipment.
const REMINDERS_NAV_ITEM = { to: '/reminders', label: 'Reminders', Icon: BellIcon };
const TEAM_NAV_ITEM = { to: '/access-levels', label: 'Team', Icon: UsersIcon };
// Admin (account help + database backup) is for both editing positions.
const ADMIN_NAV_ITEM = { to: '/admin', label: 'Admin', Icon: ShieldIcon };

// The selected item is a solid brand-colour pill so "where am I" is obvious
// at a glance; unselected items only tint on hover.
function SidebarLink({ to, label, Icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `flex items-center gap-[11px] w-full rounded-[10px] text-sm px-3.5 py-2.5 ${isActive ? '' : 'hover:bg-[#e2e7f3]'}`}
      style={({ isActive }) => ({
        backgroundColor: isActive ? theme.navActiveBg : 'transparent',
        boxShadow: isActive ? '0 4px 12px rgba(41,82,204,.25)' : 'none',
        color: isActive ? '#fff' : theme.textMuted,
        fontWeight: isActive ? 600 : 500,
      })}
    >
      {({ isActive }) => (
        <>
          <Icon color={isActive ? '#fff' : theme.textMuted} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

function NavGroup({ label, items }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <div className="px-3.5 pb-1 text-[10.5px] font-bold uppercase tracking-wider" style={{ color: theme.textFaint }}>
        {label}
      </div>
      {items.map((item) => (
        <SidebarLink key={item.to} {...item} />
      ))}
    </div>
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

// Who is signed in, top right: avatar, name and position; the menu holds
// the profile, password change and sign out.
function ProfileMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const initial = (user?.full_name || '?').trim().charAt(0).toUpperCase();

  useEffect(() => {
    if (!open) return undefined;
    function onMouseDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
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

  const itemClass = 'flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-[13px] font-medium hover:bg-[#f6f7fb]';

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2.5 rounded-[12px] pl-1.5 pr-3 py-1.5 hover:bg-[#f3f5fa]"
        style={{ border: `1px solid ${open ? theme.borderStrong : 'transparent'}`, backgroundColor: open ? theme.chipBg : 'transparent' }}
      >
        <span className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white shrink-0" style={{ backgroundColor: theme.brandDark }}>
          {initial}
        </span>
        <span className="text-left max-w-[180px]">
          <span className="block text-[13px] font-semibold truncate" style={{ color: theme.ink }}>
            {user?.full_name}
          </span>
          <span className="block text-[11.5px] truncate" style={{ color: theme.textFaint }}>
            {user?.position_label}
          </span>
        </span>
        <ChevronDownIcon color={theme.textMuted} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 rounded-[12px] bg-white overflow-hidden z-30"
          style={{ width: 240, border: `1px solid ${theme.border}`, boxShadow: '0 10px 30px rgba(16,24,40,.16)' }}
        >
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${theme.divider}` }}>
            <div className="text-[13px] font-semibold truncate" style={{ color: theme.ink }}>
              {user?.full_name}
            </div>
            <div className="text-[11.5px] truncate" style={{ color: theme.textFaint }}>
              {user?.email}
            </div>
          </div>
          <button type="button" role="menuitem" onClick={() => goTo('/settings')} className={itemClass} style={{ color: theme.textMuted, border: 'none', background: 'none' }}>
            <SettingsIcon color={theme.textMuted} />
            My profile
          </button>
          <button type="button" role="menuitem" onClick={() => goTo('/change-password')} className={itemClass} style={{ color: theme.textMuted, border: 'none', background: 'none' }}>
            <KeyIcon color={theme.textMuted} />
            Change password
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className={`${itemClass} hover:bg-[#fdeceb]`}
            style={{ color: theme.criticalStrong, border: 'none', background: 'none', borderTop: `1px solid ${theme.divider}` }}
          >
            <LogOutIcon color={theme.criticalStrong} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function Sidebar() {
  const { user } = useAuth();
  const manageItems = [...(user?.can_run_reminders ? [REMINDERS_NAV_ITEM, TEAM_NAV_ITEM] : []), ...(user?.can_edit ? [ADMIN_NAV_ITEM] : [])];

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
        <nav className="flex flex-col gap-6">
          <NavGroup label="Overview" items={MAIN_NAV_ITEMS} />
          <NavGroup label="Manage" items={manageItems} />
        </nav>
      </div>
    </aside>
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
    <div className="h-[64px] shrink-0 bg-white flex items-center justify-end gap-3 px-8" style={{ borderBottom: `1px solid ${theme.border}` }}>
      <form onSubmit={handleSearchSubmit} className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
          <SearchIcon color={theme.textFaint} />
        </span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search equipment by name, model or serial…"
          className="h-9 w-[360px] pl-9 pr-3 rounded-[10px] text-[13.5px] outline-none"
          style={{ backgroundColor: theme.chipBg, color: theme.ink }}
        />
      </form>
      {user?.can_run_reminders && (
        <NavLink to="/reminders" title="Reminders" className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ backgroundColor: theme.chipBg }}>
          <BellIcon color={theme.textMuted} />
        </NavLink>
      )}
      <div className="w-px h-8 mx-1" style={{ backgroundColor: theme.border }} />
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

import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';
import { HomeIcon, PackageIcon, BellIcon, SettingsIcon, LogOutIcon, SearchIcon, UsersIcon, ChevronDownIcon, ShieldIcon, KeyIcon } from './icons';

// SPARKS-style shell (2026-10-12): a solid blue sidebar with upper-case
// labels that collapses to icons via the ☰ button, and a white header row
// carrying the logo, the current page's title (upper-case, with its icon),
// and the signed-in user. The pre-restyle version is kept at the git tag
// `old-design-2026-10-12`.

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
// Admin (account help + database backup) is for both editing positions.
const ADMIN_NAV_ITEM = { to: '/admin', label: 'Admin', Icon: ShieldIcon };

// Header title per route -- the pages themselves no longer draw their own
// big title, the header does it once, like SPARKS.
const PAGE_TITLES = [
  { match: /^\/dashboard/, title: 'Dashboard', Icon: HomeIcon },
  { match: /^\/equipment\/[^/]+/, title: 'Equipment Details', Icon: PackageIcon },
  { match: /^\/equipment/, title: 'Equipment', Icon: PackageIcon },
  { match: /^\/reminders/, title: 'Reminders', Icon: BellIcon },
  { match: /^\/access-levels/, title: 'Team', Icon: UsersIcon },
  { match: /^\/settings/, title: 'Profile', Icon: SettingsIcon },
  { match: /^\/admin/, title: 'Admin', Icon: ShieldIcon },
  { match: /^\/change-password/, title: 'Change Password', Icon: KeyIcon },
];

const COLLAPSE_KEY = 'calibcare_sidebar_collapsed';

function SidebarLink({ to, label, Icon, collapsed }) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-3 w-full text-[12.5px] font-semibold uppercase tracking-wide py-3 ${collapsed ? 'justify-center px-0' : 'px-5'}`}
      style={({ isActive }) => ({
        backgroundColor: isActive ? theme.sidebarBlueActive : 'transparent',
        boxShadow: isActive ? 'inset 4px 0 0 #ffffff' : 'none',
        color: '#ffffff',
        opacity: isActive ? 1 : 0.92,
      })}
    >
      <Icon color="#ffffff" />
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
}

function LogoMark() {
  return (
    <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: theme.sidebarBlue }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12h4l2.5-7 4 14L15 9l2 3h5" />
      </svg>
    </div>
  );
}

function Sidebar({ collapsed }) {
  const { user } = useAuth();
  const navItems = [
    ...BASE_NAV_ITEMS,
    ...(user?.can_run_reminders ? [REMINDERS_NAV_ITEM, TEAM_NAV_ITEM] : []),
    ...(user?.can_edit ? [ADMIN_NAV_ITEM] : []),
  ];

  return (
    <aside
      className="shrink-0 sticky top-[56px] self-start overflow-y-auto"
      style={{ width: collapsed ? 64 : 230, height: 'calc(100vh - 56px)', backgroundColor: theme.sidebarBlue, transition: 'width .15s' }}
    >
      <nav className="flex flex-col py-2">
        {navItems.map((item) => (
          <SidebarLink key={item.to} {...item} collapsed={collapsed} />
        ))}
      </nav>
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

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-[12px] max-w-[360px]"
        style={{ color: theme.textMuted, border: 'none', background: 'none' }}
      >
        <span className="truncate">
          <span className="font-semibold uppercase" style={{ color: theme.ink }}>
            {user?.full_name}
          </span>
          {user?.position_label ? `, ${user.position_label}` : ''}
        </span>
        <ChevronDownIcon size={11} />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 rounded-md bg-white overflow-hidden"
          style={{ width: 200, border: `1px solid ${theme.borderStrong}`, boxShadow: '0 8px 24px rgba(16,24,40,.12)', zIndex: 40 }}
        >
          <button
            type="button"
            onClick={() => goTo('/settings')}
            className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-[13px] font-medium hover:bg-[#f6f7fb]"
            style={{ color: theme.textMuted, border: 'none', background: 'none' }}
          >
            <SettingsIcon color={theme.textMuted} />
            Profile
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-[13px] font-medium hover:bg-[#f6f7fb]"
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

function Header({ collapsed, onToggle }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [search, setSearch] = useState('');
  const page = PAGE_TITLES.find((p) => p.match.test(pathname));

  function handleSearchSubmit(e) {
    e.preventDefault();
    if (search.trim()) navigate(`/equipment?q=${encodeURIComponent(search.trim())}`);
  }

  return (
    <header
      className="h-[56px] sticky top-0 z-30 bg-white flex items-center gap-4 pr-6"
      style={{ borderBottom: `1px solid ${theme.borderStrong}` }}
    >
      <div className="flex items-center gap-2 shrink-0 pl-4" style={{ width: collapsed ? 64 : 230, transition: 'width .15s' }}>
        <LogoMark />
        {!collapsed && (
          <span className="text-[18px] font-extrabold tracking-tight" style={{ color: theme.sidebarBlue }}>
            CALIBCARE
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
        className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-[#f3f5fa] shrink-0"
        style={{ border: 'none', background: 'none', color: theme.textMuted }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      {page && (
        <h1 className="flex items-center gap-2.5 text-[18px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: theme.ink }}>
          <page.Icon color={theme.ink} />
          {page.title}
        </h1>
      )}

      <div className="ml-auto flex items-center gap-4 min-w-0">
        <form onSubmit={handleSearchSubmit} className="relative hidden lg:block">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <SearchIcon size={14} color={theme.textFaint} />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search equipment..."
            className="h-8 w-[220px] pl-8 pr-3 rounded-md text-[13px] outline-none"
            style={{ backgroundColor: theme.chipBg, color: theme.ink, border: `1px solid ${theme.borderStrong}` }}
          />
        </form>
        {user?.can_run_reminders && (
          <NavLink to="/reminders" title="Reminders" className="w-8 h-8 flex items-center justify-center shrink-0">
            <BellIcon color={theme.textMuted} />
          </NavLink>
        )}
        <ProfileMenu />
      </div>
    </header>
  );
}

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

export function Layout() {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  function toggle() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        // storage blocked -- the toggle still works for this visit
      }
      return !c;
    });
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: theme.shellBg }}>
      <Header collapsed={collapsed} onToggle={toggle} />
      <div className="flex flex-1 min-h-0">
        <Sidebar collapsed={collapsed} />
        <main className="flex-1 min-w-0 px-7 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

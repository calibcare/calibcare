import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItemClass = ({ isActive }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`;

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-slate-900 mr-4">CalibCare</span>
            <NavLink to="/dashboard" className={navItemClass}>
              Dashboard
            </NavLink>
            <NavLink to="/equipment" className={navItemClass}>
              Equipment
            </NavLink>
            <NavLink to="/dss" className={navItemClass}>
              Decision Support
            </NavLink>
            <NavLink to="/reminders" className={navItemClass}>
              Reminders
            </NavLink>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">
              {user?.full_name} <span className="text-slate-400">({user?.role})</span>
            </span>
            <button onClick={logout} className="px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-100">
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

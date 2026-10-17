import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (!user) return <Navigate to="/login" replace />;
  // Someone logging in with a temporary password from the Admin page must
  // choose their own before using anything else. (The server doesn't block
  // the other routes -- this is the UX step; the temporary password is
  // still only known to the admin who issued it and the user.)
  if (user.must_change_password && pathname !== '/change-password') return <Navigate to="/change-password" replace />;
  return <Outlet />;
}

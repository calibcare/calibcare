import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('mcems_user');
    return raw ? JSON.parse(raw) : null;
  });

  // Re-reads the logged-in user from the server (position, LINE link).
  const refreshUser = useCallback(async () => {
    const { data } = await client.get('/api/users/me');
    localStorage.setItem('mcems_user', JSON.stringify(data));
    setUser(data);
    return data;
  }, []);

  // Refresh the cached user on load: a Deputy Manager can change someone's
  // position at any time, and the copy in localStorage was written when
  // that person last logged in -- which with 30-day tokens can be weeks ago.
  useEffect(() => {
    if (!localStorage.getItem('mcems_token')) return;
    refreshUser().catch(() => {}); // stale/invalid token is handled by ProtectedRoute on the next request
  }, [refreshUser]);

  const persist = (data) => {
    localStorage.setItem('mcems_token', data.token);
    localStorage.setItem('mcems_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const login = useCallback(async (email, password) => {
    const { data } = await client.post('/api/auth/login', { email, password });
    return persist(data);
  }, []);

  // Registration no longer logs the user in directly -- it creates an
  // unverified account and emails an OTP; the caller (RegisterPage) sends
  // the user to /verify-code next.
  const register = useCallback(async (payload) => {
    const { data } = await client.post('/api/auth/register', payload);
    return data; // { message, email, emailDryRun }
  }, []);

  const verifyEmail = useCallback(async (email, code) => {
    const { data } = await client.post('/api/auth/verify-email', { email, code });
    return persist(data);
  }, []);

  const resendOtp = useCallback(async (email, purpose) => {
    const { data } = await client.post('/api/auth/resend-otp', { email, purpose });
    return data;
  }, []);

  const forgotPassword = useCallback(async (email) => {
    const { data } = await client.post('/api/auth/forgot-password', { email });
    return data;
  }, []);

  const resetPassword = useCallback(async (email, code, newPassword) => {
    const { data } = await client.post('/api/auth/reset-password', { email, code, newPassword });
    return persist(data);
  }, []);

  // Used after the Admin page issues a temporary password (the user is
  // forced here by ProtectedRoute) and from Settings. Keeps the same token.
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const { data } = await client.post('/api/auth/change-password', { currentPassword, newPassword });
    localStorage.setItem('mcems_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('mcems_token');
    localStorage.removeItem('mcems_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, refreshUser, login, register, verifyEmail, resendOtp, forgotPassword, resetPassword, changePassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

import { createContext, useContext, useState, useCallback } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('mcems_user');
    return raw ? JSON.parse(raw) : null;
  });

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

  const register = useCallback(async (payload) => {
    const { data } = await client.post('/api/auth/register', payload);
    return persist(data);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('mcems_token');
    localStorage.removeItem('mcems_user');
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

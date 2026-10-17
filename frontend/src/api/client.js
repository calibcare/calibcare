import axios from 'axios';

// In production (Vercel), VITE_API_URL points at the deployed backend
// (e.g. the Railway URL). Left unset for local dev, requests fall back to
// relative paths ('') and go through the Vite dev server's own proxy
// (see vite.config.js) instead -- no separate env var needed locally.
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('mcems_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default client;

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // server.* only applies to `vite dev` (local dev / ngrok), never to the
  // static `npm run build` output Vercel actually serves -- safe to leave
  // in place. In production the frontend talks to the backend directly via
  // VITE_API_URL instead of this proxy (see src/api/client.js).
  server: {
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})

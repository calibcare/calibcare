import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// Self-hosted (bundled at build time, served from our own origin) instead
// of Google Fonts' CDN -- ad blockers and privacy extensions commonly
// block fonts.googleapis.com/fonts.gstatic.com by name, which silently
// fell back to a plain system font for some users. Sarabun (2026-10-28,
// the user's choice; the open redesign of the Thai government font
// TH Sarabun New) covers both Thai and Latin, so Thai data (locations,
// status notes, "1 ปี") matches the English text. Weights = the ones the
// UI uses (normal/medium/semibold/bold; font-extrabold falls back to 700).
import '@fontsource/sarabun/400.css';
import '@fontsource/sarabun/500.css';
import '@fontsource/sarabun/600.css';
import '@fontsource/sarabun/700.css';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

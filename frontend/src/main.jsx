import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// Self-hosted (bundled at build time, served from our own origin) instead
// of Google Fonts' CDN -- ad blockers and privacy extensions commonly
// block fonts.googleapis.com/fonts.gstatic.com by name, which silently
// fell back to a plain system font for some users. IBM Plex Sans Thai
// (2026-10-19) covers both Thai and Latin, so Thai data (locations, status
// notes, "1 ปี") matches the English text instead of using whatever Thai
// font the viewer's computer has. Weights = the ones the UI uses
// (normal/medium/semibold/bold; font-extrabold falls back to 700).
import '@fontsource/ibm-plex-sans-thai/400.css';
import '@fontsource/ibm-plex-sans-thai/500.css';
import '@fontsource/ibm-plex-sans-thai/600.css';
import '@fontsource/ibm-plex-sans-thai/700.css';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

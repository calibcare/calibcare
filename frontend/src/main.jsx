import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// Self-hosted (bundled at build time, served from our own origin) instead
// of Google Fonts' CDN -- ad blockers and privacy extensions commonly
// block fonts.googleapis.com/fonts.gstatic.com by name, which silently
// fell back to a plain system font for some users.
import '@fontsource-variable/inter';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

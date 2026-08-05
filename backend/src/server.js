import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { dssRouter } from './routes/dss.js';
import { authRouter } from './routes/auth.js';
import { remindersRouter } from './routes/reminders.js';
import { equipmentRouter } from './routes/equipment.js';
import { dashboardRouter } from './routes/dashboard.js';
import { lineWebhookRouter } from './routes/lineWebhook.js';
import { lineRouter } from './routes/line.js';
import { requireAuth } from './middleware/auth.js';

const app = express();
// Restrict cross-origin requests to the deployed frontend's own origin --
// process.env.FRONTEND_URL is required in production (e.g. the Netlify
// site URL); left unset, cors() falls back to allowing any origin, which is
// fine for local dev but must be set once this is actually deployed.
app.use(cors({ origin: process.env.FRONTEND_URL || true }));
// Capture the raw request body alongside the parsed one -- LINE webhook
// signature verification is an HMAC over the exact raw bytes, which
// express.json() normally discards after parsing.
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRouter);
app.use('/api/line/webhook', lineWebhookRouter); // public: authenticated by LINE signature, not JWT
app.use('/api/dss', requireAuth, dssRouter);
app.use('/api/reminders', requireAuth, remindersRouter);
app.use('/api/equipment', requireAuth, equipmentRouter);
app.use('/api/dashboard', requireAuth, dashboardRouter);
app.use('/api/line', requireAuth, lineRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`CalibCare backend listening on :${port}`));

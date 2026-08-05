import { Router } from 'express';
import 'dotenv/config';
import { pool } from '../db.js';
import { createLineClient } from '../services/lineClient.js';
import { consumeLinkCode } from '../services/linkCodeStore.js';
import { verifySignature, handleWebhookEvents } from '../services/lineWebhookService.js';

export const lineWebhookRouter = Router();

// POST /api/line/webhook -- called by LINE's servers, not our frontend.
// Authenticated by signature (x-line-signature), not a JWT -- this route is
// intentionally NOT behind requireAuth.
lineWebhookRouter.post('/', async (req, res) => {
  const signature = req.headers['x-line-signature'];
  const channelSecret = process.env.LINE_CHANNEL_SECRET;

  if (!verifySignature(req.rawBody, signature, channelSecret)) {
    return res.status(401).json({ error: 'invalid signature' });
  }

  // Ack immediately -- LINE expects a fast 200 and will retry on timeout.
  res.status(200).end();

  try {
    const lineClient = createLineClient(process.env.LINE_CHANNEL_ACCESS_TOKEN);
    await handleWebhookEvents(req.body.events || [], { db: pool, lineClient, consumeLinkCode });
  } catch (err) {
    console.error('[line webhook] failed to process events:', err);
  }
});

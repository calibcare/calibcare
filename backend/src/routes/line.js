import { Router } from 'express';
import 'dotenv/config';
import { createLinkCode } from '../services/linkCodeStore.js';

export const lineRouter = Router();

// POST /api/line/link-code -- the logged-in user requests a code to send to
// the LINE Official Account, linking their LINE user id to their CalibCare account.
lineRouter.post('/link-code', (req, res) => {
  const { code, expiresAt } = createLinkCode(req.user.user_id);
  const basicId = process.env.LINE_OA_BASIC_ID;
  res.json({
    code,
    expiresAt,
    addFriendUrl: basicId ? `https://line.me/R/ti/p/${basicId}` : null,
  });
});

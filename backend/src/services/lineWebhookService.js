import crypto from 'node:crypto';

/**
 * Verifies that a webhook request really came from LINE. LINE signs every
 * webhook body with your channel secret (HMAC-SHA256, base64-encoded) and
 * sends it in the x-line-signature header -- without this check, anyone
 * who finds the URL could POST fake events (e.g. fake account-link codes).
 */
export function verifySignature(rawBody, signatureHeader, channelSecret) {
  if (!rawBody || !signatureHeader || !channelSecret) return false;
  const expected = crypto.createHmac('SHA256', channelSecret).update(rawBody).digest('base64');
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

const LINK_HINT =
  'To link your LINE account: log into CalibCare, open Reminders, click "Get linking code," and send that 6-digit code here within 10 minutes.';
const WELCOME =
  `Thanks for adding CalibCare Calibration Alerts! ${LINK_HINT}`;
const LINK_SUCCESS = "Your LINE account is now linked to CalibCare. You'll receive calibration reminders here.";

/**
 * Processes a batch of LINE webhook events.
 * deps: { db (query-capable), lineClient (multicast/reply), consumeLinkCode (code -> userId|null) }
 */
export async function handleWebhookEvents(events, { db, lineClient, consumeLinkCode }) {
  const results = [];

  for (const event of events) {
    if (event.type === 'follow') {
      await lineClient.reply(event.replyToken, WELCOME);
      results.push({ type: 'follow', userId: event.source?.userId });
      continue;
    }

    if (event.type === 'message' && event.message?.type === 'text') {
      const userId = event.source?.userId;
      const linkedUserId = consumeLinkCode(event.message.text);

      if (linkedUserId) {
        await db.query('UPDATE users SET line_user_id = ? WHERE user_id = ?', [userId, linkedUserId]);
        await lineClient.reply(event.replyToken, LINK_SUCCESS);
        results.push({ type: 'link', userId, linkedUserId, matched: true });
      } else {
        await lineClient.reply(event.replyToken, LINK_HINT);
        results.push({ type: 'link', userId, matched: false });
      }
      continue;
    }

    results.push({ type: event.type, skipped: true });
  }

  return results;
}

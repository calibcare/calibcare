const LINE_MULTICAST_URL = 'https://api.line.me/v2/bot/message/multicast';
const LINE_REPLY_URL = 'https://api.line.me/v2/bot/message/reply';

async function postToLine(url, accessToken, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    return { ok: false, status: response.status, body: errBody };
  }
  return { ok: true };
}

/**
 * Creates a client for sending LINE push/reply messages. If no access token
 * is configured, returns a "dry run" client that logs what would have been
 * sent instead of calling the LINE API -- so the reminder scheduler and the
 * webhook are fully testable before a real LINE OA is set up.
 */
export function createLineClient(accessToken) {
  if (!accessToken) {
    return {
      dryRun: true,
      async multicast(userIds, text) {
        console.log(`[LINE dry-run] would notify ${userIds.length} user(s): "${text}"`);
        return { ok: true, dryRun: true };
      },
      async reply(replyToken, text) {
        console.log(`[LINE dry-run] would reply to token ${replyToken}: "${text}"`);
        return { ok: true, dryRun: true };
      },
    };
  }

  return {
    dryRun: false,
    async multicast(userIds, text) {
      return postToLine(LINE_MULTICAST_URL, accessToken, {
        to: userIds,
        messages: [{ type: 'text', text }],
      });
    },
    async reply(replyToken, text) {
      return postToLine(LINE_REPLY_URL, accessToken, {
        replyToken,
        messages: [{ type: 'text', text }],
      });
    },
  };
}

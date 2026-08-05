import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifySignature, handleWebhookEvents } from '../src/services/lineWebhookService.js';

function sign(body, secret) {
  return crypto.createHmac('SHA256', secret).update(body).digest('base64');
}

test('verifySignature accepts a correctly signed body', () => {
  const secret = 'test-channel-secret';
  const body = Buffer.from(JSON.stringify({ events: [] }));
  assert.equal(verifySignature(body, sign(body, secret), secret), true);
});

test('verifySignature rejects a tampered body', () => {
  const secret = 'test-channel-secret';
  const body = Buffer.from(JSON.stringify({ events: [] }));
  const signature = sign(body, secret);
  const tampered = Buffer.from(JSON.stringify({ events: [{ injected: true }] }));
  assert.equal(verifySignature(tampered, signature, secret), false);
});

test('verifySignature rejects the wrong secret', () => {
  const body = Buffer.from(JSON.stringify({ events: [] }));
  const signature = sign(body, 'real-secret');
  assert.equal(verifySignature(body, signature, 'wrong-secret'), false);
});

test('verifySignature rejects missing body/signature/secret', () => {
  assert.equal(verifySignature(null, 'sig', 'secret'), false);
  assert.equal(verifySignature(Buffer.from('x'), null, 'secret'), false);
  assert.equal(verifySignature(Buffer.from('x'), 'sig', null), false);
});

function fakeDb() {
  const updates = [];
  return {
    updates,
    async query(sql, params) {
      updates.push({ sql, params });
      return [{ affectedRows: 1 }];
    },
  };
}

function fakeLineClient() {
  const replies = [];
  return {
    replies,
    async reply(replyToken, text) {
      replies.push({ replyToken, text });
      return { ok: true };
    },
  };
}

test('a message matching a pending link code updates the user and confirms via reply', async () => {
  const db = fakeDb();
  const lineClient = fakeLineClient();
  const consumeLinkCode = (code) => (code === '123456' ? 42 : null);

  const events = [
    { type: 'message', replyToken: 'rt1', source: { userId: 'Uabc' }, message: { type: 'text', text: '123456' } },
  ];

  const results = await handleWebhookEvents(events, { db, lineClient, consumeLinkCode });

  assert.equal(results[0].matched, true);
  assert.equal(db.updates.length, 1);
  assert.deepEqual(db.updates[0].params, ['Uabc', 42]);
  assert.equal(lineClient.replies.length, 1);
  assert.match(lineClient.replies[0].text, /linked to CalibCare/);
});

test('a message with an invalid code gets a helpful hint, no DB write', async () => {
  const db = fakeDb();
  const lineClient = fakeLineClient();
  const consumeLinkCode = () => null;

  const events = [
    { type: 'message', replyToken: 'rt2', source: { userId: 'Uxyz' }, message: { type: 'text', text: 'hello' } },
  ];

  const results = await handleWebhookEvents(events, { db, lineClient, consumeLinkCode });

  assert.equal(results[0].matched, false);
  assert.equal(db.updates.length, 0);
  assert.match(lineClient.replies[0].text, /linking code/);
});

test('a follow event gets a welcome reply and no DB write', async () => {
  const db = fakeDb();
  const lineClient = fakeLineClient();
  const consumeLinkCode = () => null;

  const events = [{ type: 'follow', replyToken: 'rt3', source: { userId: 'Unew' } }];

  const results = await handleWebhookEvents(events, { db, lineClient, consumeLinkCode });

  assert.equal(results[0].type, 'follow');
  assert.equal(db.updates.length, 0);
  assert.match(lineClient.replies[0].text, /Thanks for adding CalibCare/);
});

test('unsupported event types are skipped without error', async () => {
  const db = fakeDb();
  const lineClient = fakeLineClient();
  const consumeLinkCode = () => null;

  const events = [{ type: 'unfollow', source: { userId: 'Ugone' } }];
  const results = await handleWebhookEvents(events, { db, lineClient, consumeLinkCode });

  assert.equal(results[0].skipped, true);
  assert.equal(lineClient.replies.length, 0);
});

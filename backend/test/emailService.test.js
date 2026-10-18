import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSender } from '../src/services/emailService.js';

function fakeFetch(status, body = {}) {
  const calls = [];
  const impl = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return { impl, calls };
}

test('Brevo is chosen over SMTP when BREVO_API_KEY is set', () => {
  const s = createSender({ BREVO_API_KEY: 'k', SMTP_USER: 'a@gmail.com', SMTP_PASSWORD: 'p' }, fakeFetch(201).impl);
  assert.equal(s.provider, 'brevo');
});

test('SMTP is used without a Brevo key, and nothing configured means dry-run (null)', () => {
  assert.equal(createSender({ SMTP_USER: 'a@gmail.com', SMTP_PASSWORD: 'p' }).provider, 'smtp');
  assert.equal(createSender({}), null);
});

test('Brevo request: endpoint, api-key header, sender from EMAIL_FROM else SMTP_USER', async () => {
  const f = fakeFetch(201, { messageId: 'x' });
  await createSender({ BREVO_API_KEY: 'secret', SMTP_USER: 'calibcare@gmail.com' }, f.impl).send({ to: 'u@idsmed.com', subject: 'Hi', text: 'Body' });
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(f.calls[0].opts.headers['api-key'], 'secret');
  const body = JSON.parse(f.calls[0].opts.body);
  assert.deepEqual(body.sender, { name: 'CalibCare', email: 'calibcare@gmail.com' });
  assert.deepEqual(body.to, [{ email: 'u@idsmed.com' }]);
  assert.equal(body.subject, 'Hi');
  assert.equal(body.textContent, 'Body');

  const g = fakeFetch(201);
  await createSender({ BREVO_API_KEY: 'k', EMAIL_FROM: 'other@gmail.com', SMTP_USER: 'calibcare@gmail.com' }, g.impl).send({ to: 'u@x', subject: 's', text: 't' });
  assert.equal(JSON.parse(g.calls[0].opts.body).sender.email, 'other@gmail.com');
});

test('Brevo errors surface the API message', async () => {
  const s = createSender({ BREVO_API_KEY: 'k', SMTP_USER: 'c@gmail.com' }, fakeFetch(401, { code: 'unauthorized', message: 'Key not found' }).impl);
  await assert.rejects(() => s.send({ to: 'u@x', subject: 's', text: 't' }), /Brevo API 401: Key not found/);
});

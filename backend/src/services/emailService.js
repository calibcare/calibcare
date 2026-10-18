import nodemailer from 'nodemailer';
import 'dotenv/config';

/**
 * Outgoing email. Three providers, picked once at startup from env:
 *
 *  1. Brevo HTTPS API (BREVO_API_KEY) -- used in production. Railway blocks
 *     outbound SMTP (ports 25/465/587) on Free/Trial/Hobby plans, so the
 *     Gmail SMTP path silently fails there; Brevo's API is a plain HTTPS call
 *     on port 443, which Railway never blocks.
 *  2. SMTP (SMTP_USER + SMTP_PASSWORD, Gmail App Password by default) --
 *     still works for local dev on a normal network.
 *  3. Neither configured -> dry-run: log what would be sent and report
 *     success, mirroring lineClient.js, so flows stay testable.
 *
 * The From address is EMAIL_FROM, else SMTP_USER. With Brevo it must be a
 * sender verified in the Brevo account.
 */
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const FROM_NAME = 'CalibCare';

export function createSender(env = process.env, fetchImpl = globalThis.fetch) {
  const fromEmail = env.EMAIL_FROM || env.SMTP_USER;

  if (env.BREVO_API_KEY) {
    return {
      provider: 'brevo',
      async send({ to, subject, text }) {
        if (!fromEmail) throw new Error('EMAIL_FROM (a Brevo-verified sender) is not set');
        const res = await fetchImpl(BREVO_URL, {
          method: 'POST',
          headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ sender: { name: FROM_NAME, email: fromEmail }, to: [{ email: to }], subject, textContent: text }),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          let detail = '';
          try {
            const body = await res.json();
            detail = body.message || body.code || '';
          } catch {
            // non-JSON error body -- status alone is enough
          }
          throw new Error(`Brevo API ${res.status}${detail ? `: ${detail}` : ''}`);
        }
      },
    };
  }

  if (env.SMTP_USER && env.SMTP_PASSWORD) {
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(env.SMTP_PORT) || 587,
      secure: false, // STARTTLS on port 587
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    });
    return {
      provider: 'smtp',
      async send({ to, subject, text }) {
        await transporter.sendMail({ from: `"${FROM_NAME}" <${fromEmail}>`, to, subject, text });
      },
    };
  }

  return null;
}

const sender = createSender();
export const emailDryRun = !sender;
export const emailProvider = sender ? sender.provider : 'dry-run';
console.log(`[emailService] provider: ${emailProvider}`);

/**
 * Generic send, reused by both the OTP flow below and reminderService.js's
 * email channel. Never throws: failures are logged and returned as
 * { ok: false, error }.
 */
export async function sendEmail({ to, subject, text }) {
  if (emailDryRun) {
    console.log(`[email dry-run] would send to ${to}: "${subject}"`);
    return { ok: true, dryRun: true };
  }

  try {
    await sender.send({ to, subject, text });
    return { ok: true, dryRun: false };
  } catch (err) {
    console.error(`[emailService] ${emailProvider} failed to send to ${to}:`, err.message);
    return { ok: false, dryRun: false, error: err.message };
  }
}

const SUBJECTS = {
  register: 'Verify your CalibCare account',
  reset: 'Reset your CalibCare password',
};

const INTROS = {
  register: 'Use this code to verify your CalibCare account:',
  reset: 'Use this code to reset your CalibCare password:',
};

export async function sendOtpEmail(to, code, purpose) {
  const subject = SUBJECTS[purpose] || SUBJECTS.register;
  const intro = INTROS[purpose] || INTROS.register;
  const text = `${intro}\n\n${code}\n\nThis code expires in 10 minutes. If you didn't request this, you can safely ignore this email.`;
  return sendEmail({ to, subject, text });
}

/**
 * A lineClient.js-shaped wrapper around sendEmail(), for reminderService.js
 * -- same `{ dryRun, send() }` shape createLineClient() exposes as
 * `{ dryRun, multicast() }`, so checkAndSendReminders() can treat both
 * channels uniformly and tests can inject a fake in the same way.
 */
export function createEmailClient() {
  return {
    dryRun: emailDryRun,
    async send(to, subject, text) {
      return sendEmail({ to, subject, text });
    },
  };
}

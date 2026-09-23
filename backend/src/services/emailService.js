import nodemailer from 'nodemailer';
import 'dotenv/config';

/**
 * Sends OTP emails via SMTP (Gmail App Password by default). Mirrors
 * lineClient.js's dry-run pattern: if no SMTP credentials are configured,
 * returns a client that only logs what it would send, so registration and
 * password-reset are fully testable before real email credentials exist.
 */
function createTransport() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false, // STARTTLS on port 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
}

const transporter = createTransport();
export const emailDryRun = !transporter;

/**
 * Generic send, reused by both the OTP flow below and reminderService.js's
 * email channel. Same dry-run behavior either way: no SMTP credentials
 * configured means log-and-succeed rather than fail, exactly like
 * lineClient.js's dry-run client for LINE.
 */
export async function sendEmail({ to, subject, text }) {
  if (emailDryRun) {
    console.log(`[email dry-run] would send to ${to}: "${subject}"`);
    return { ok: true, dryRun: true };
  }

  try {
    await transporter.sendMail({
      from: `"CalibCare" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
    });
    return { ok: true, dryRun: false };
  } catch (err) {
    console.error('[emailService] failed to send:', err);
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

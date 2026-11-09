/**
 * Whether an email address belongs to the company's domain
 * (ALLOWED_EMAIL_DOMAIN). Shared by registration and the reminder
 * email-only recipient list, so both apply the same rule. Unset means no
 * restriction.
 */
export function isAllowedDomain(email, domain = process.env.ALLOWED_EMAIL_DOMAIN) {
  if (!domain) return true;
  return String(email).trim().toLowerCase().endsWith(`@${domain.toLowerCase()}`);
}

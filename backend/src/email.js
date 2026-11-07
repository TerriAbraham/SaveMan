// Sends SaveMan's emails: 6-digit codes for logging in and for resetting a password.

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * A mailer that sends through Brevo when `apiKey` and `from` are set. Without them, emails are
 * written to the server log instead (`configured` is false) so the app still works in development.
 */
export function createMailer({ apiKey, from, fromName = 'SaveMan' } = {}) {
  if (!apiKey || !from) {
    return {
      configured: false,
      async send({ to, subject, text }) {
        console.log(`[email not set up, not sent] To ${to}: ${subject}\n${text}`);
      },
    };
  }
  return {
    configured: true,
    async send({ to, name, subject, text, html }) {
      const res = await fetch(BREVO_URL, {
        method: 'POST',
        headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ sender: { name: fromName, email: from }, to: [{ email: to, ...(name && { name }) }], subject, textContent: text, htmlContent: html }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`Brevo refused the email (${res.status}): ${(await res.text()).slice(0, 300)}`);
    },
  };
}

const purposes = {
  login: { subject: 'Your SaveMan login code', line: 'Use this code to finish logging in to SaveMan.', ignore: 'If you didn’t just log in, someone may know your password. Change it in the app under Security.' },
  reset: { subject: 'Reset your SaveMan password', line: 'Use this code to choose a new SaveMan password.', ignore: 'If you didn’t ask to reset your password, you can ignore this email. Your password hasn’t changed.' },
  enable: { subject: 'Confirm your SaveMan email', line: 'Use this code to turn on emailed login codes for SaveMan.', ignore: 'If you didn’t ask for this, you can ignore this email.' },
};

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The email carrying a 6-digit `code`, for 'login', 'reset' or 'enable'. */
export function codeEmail(code, purpose, name, ttlMinutes) {
  const p = purposes[purpose];
  const greeting = `Hello ${name},`;
  const expiry = `The code expires in ${ttlMinutes} minutes and works once.`;
  return {
    subject: `${p.subject}: ${code}`,
    text: `${greeting}\n\n${p.line}\n\n${code}\n\n${expiry}\n\n${p.ignore}\n\nSaveMan`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;color:#1d1d1f">
  <p>${escapeHtml(greeting)}</p>
  <p>${p.line}</p>
  <p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:24px 0">${code}</p>
  <p>${expiry}</p>
  <p style="color:#6b6b6b">${p.ignore}</p>
  <p>SaveMan</p>
</div>`,
  };
}

// Transactional email. Provider order: SendGrid (SENDGRID_API_KEY) → Resend
// (RESEND_API_KEY) → dev fallback (logs the message to the server console so auth
// is fully testable with no provider account). Never throws — a send failure must
// not break the auth flow.

export const emailConfigured = (): boolean =>
  Boolean(process.env.SENDGRID_API_KEY || process.env.RESEND_API_KEY);

const FROM = process.env.EMAIL_FROM || "Verdyn <login@verdyn.com>";

// Accepts "Name <email@x.com>" or a bare "email@x.com".
function parseFrom(v: string): { email: string; name?: string } {
  const m = v.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1] || undefined, email: m[2].trim() };
  return { email: v.trim() };
}

interface SendResult {
  sent: boolean;
  /** Present only in dev (no provider configured) so callers can surface it. */
  devFallback?: boolean;
}

async function sendViaSendGrid(
  apiKey: string, to: string, subject: string, html: string, text: string,
): Promise<SendResult> {
  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: parseFrom(FROM),
        subject,
        content: [
          { type: "text/plain", value: text },
          { type: "text/html", value: html },
        ],
      }),
      signal: AbortSignal.timeout(10000),
    });
    // SendGrid returns 202 Accepted on success.
    if (!res.ok) {
      console.warn(`[verdyn] SendGrid HTTP ${res.status}`);
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    console.warn("[verdyn] SendGrid send failed:", (err as Error).message);
    return { sent: false };
  }
}

async function sendViaResend(
  apiKey: string, to: string, subject: string, html: string, text: string,
): Promise<SendResult> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html, text }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.warn(`[verdyn] Resend HTTP ${res.status}`);
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    console.warn("[verdyn] email send failed:", (err as Error).message);
    return { sent: false };
  }
}

async function send(to: string, subject: string, html: string, text: string): Promise<SendResult> {
  const sg = process.env.SENDGRID_API_KEY;
  if (sg) return sendViaSendGrid(sg, to, subject, html, text);
  const resend = process.env.RESEND_API_KEY;
  if (resend) return sendViaResend(resend, to, subject, html, text);
  console.log(`[verdyn][email:dev] to=${to} subject=${JSON.stringify(subject)}\n${text}`);
  return { sent: false, devFallback: true };
}

export async function sendMagicLink(to: string, url: string): Promise<SendResult> {
  const subject = "Your Verdyn sign-in link";
  const text =
    `Tap to sign in to Verdyn:\n\n${url}\n\n` +
    `This link expires in 15 minutes and can be used once. ` +
    `If you didn't request it, you can ignore this email.`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#08231B">Sign in to Verdyn</h2>
      <p style="color:#334">Tap the button below to sign in. This link expires in 15 minutes and works once.</p>
      <p style="margin:28px 0">
        <a href="${url}" style="background:#0E7C5A;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">Sign in to Verdyn</a>
      </p>
      <p style="color:#889;font-size:13px">If you didn't request this, you can safely ignore it.</p>
    </div>`;
  return send(to, subject, html, text);
}

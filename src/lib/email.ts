/**
 * Sends alert email through Resend. When no key is configured the caller is
 * told the mail was not sent, rather than the failure passing silently.
 */
export async function sendEmail(subject: string, text: string): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL_TO;
  const from = process.env.ALERT_EMAIL_FROM ?? 'PSX Books <onboarding@resend.dev>';
  if (!key) return { sent: false, reason: 'RESEND_API_KEY is not set.' };
  if (!to) return { sent: false, reason: 'ALERT_EMAIL_TO is not set.' };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  if (!res.ok) return { sent: false, reason: `Resend returned ${res.status}: ${await res.text()}` };
  return { sent: true };
}

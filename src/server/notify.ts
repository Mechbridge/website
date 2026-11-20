// Optional email alert for new leads. Active only when SMTP_HOST is set; leads are stored either way.
import nodemailer, { type Transporter } from 'nodemailer';

let transport: Transporter | null = null;

export async function notifyLead(l: { id: number; type: string; label: string; name: string; email: string; phone: string; country: string; subject: string; ref_title: string; message: string; cv_name: string }) {
  if (!process.env.SMTP_HOST) return;
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  const site = process.env.PUBLIC_SITE_URL || 'https://mechbridgegroup.com';
  const opt = (label: string, v: string) => (v ? [`${label}: ${v}`] : []);
  const lines = [
    `${l.label} #${l.id}`,
    `Name: ${l.name}`, `Email: ${l.email}`,
    ...opt('Phone', l.phone), ...opt('Based in', l.country), ...opt('For', l.ref_title), ...opt('Subject', l.subject), ...opt('CV attached', l.cv_name),
    '', l.message, '', `Open it in the admin portal: ${site}/admin`,
  ];
  // Each lead type alerts its own inbox.
  const to: Record<string, string | undefined> = {
    support: process.env.SUPPORT_NOTIFY_TO || 'support@mechbridgegroup.com',
    job: process.env.CAREERS_NOTIFY_TO || 'careers@mechbridgegroup.com',
    internship: process.env.INTERN_NOTIFY_TO || 'intern@mechbridgegroup.com',
  };
  await transport.sendMail({
    from: process.env.SMTP_FROM || `Mechbridge website <no-reply@mechbridgegroup.com>`,
    to: to[l.type] || process.env.LEAD_NOTIFY_TO || 'connect@mechbridgegroup.com',
    replyTo: l.email,
    subject: `[Website] ${l.label}: ${l.name}`,
    text: lines.join('\n'),
  });
}

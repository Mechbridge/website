// Email alert for new leads, in the Mechbridge brand. Active only when SMTP_HOST is set; leads are stored either way.
// The HTML uses tables and inline styles because email clients (Outlook, Gmail) ignore stylesheets.
import nodemailer, { type Transporter } from 'nodemailer';

let transport: Transporter | null = null;

export interface LeadAlert {
  id: number; type: string; label: string; name: string; email: string; phone: string; country: string;
  subject: string; ref_title: string; message: string; cv_name: string;
}

const C = { navy: '#1A2841', navyDeep: '#0D1523', cream: '#F0E1CE', paper: '#FBF8F3', red: '#B11722', ink: '#0C1018', muted: '#5B6A86', line: '#E4CDB0' };
const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const nl2br = (s: string) => esc(s).replace(/\r?\n/g, '<br>');

export function leadEmailHtml(l: LeadAlert, site: string) {
  const portal = `${site}/admin/#/leads?open=${l.id}`;
  const replySubject = encodeURIComponent(`Re: your enquiry to Mechbridge International`);
  const rows: [string, string][] = [
    ['Name', esc(l.name)],
    ['Email', `<a href="mailto:${esc(l.email)}" style="color:${C.red};text-decoration:none;">${esc(l.email)}</a>`],
    ...(l.phone ? [['Phone', `<a href="tel:${esc(l.phone.replace(/[^\d+]/g, ''))}" style="color:${C.red};text-decoration:none;">${esc(l.phone)}</a>`] as [string, string]] : []),
    ...(l.country ? [['Based in', esc(l.country)] as [string, string]] : []),
    ...(l.ref_title ? [['For', esc(l.ref_title)] as [string, string]] : []),
    ...(l.subject ? [['Service', esc(l.subject)] as [string, string]] : []),
    ...(l.cv_name ? [['CV', `${esc(l.cv_name)} <span style="color:${C.muted};">(download it in the staff portal)</span>`] as [string, string]] : []),
  ];
  const rowHtml = rows.map(([k, v]) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${C.line};width:110px;vertical-align:top;font:600 12px/1.4 Arial,Helvetica,sans-serif;color:${C.muted};text-transform:uppercase;letter-spacing:.06em;">${k}</td>
      <td style="padding:10px 0;border-bottom:1px solid ${C.line};vertical-align:top;font:15px/1.5 Arial,Helvetica,sans-serif;color:${C.ink};">${v}</td>
    </tr>`).join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(l.label)}: ${esc(l.name)}</title></head>
<body style="margin:0;padding:0;background:${C.navyDeep};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(l.label)} from ${esc(l.name)}${l.country ? `, ${esc(l.country)}` : ''}: ${esc(l.message.slice(0, 120))}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.navyDeep};">
    <tr><td align="center" style="padding:28px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">
        <tr><td style="background:${C.navy};padding:22px 28px;border-radius:12px 12px 0 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td><img src="${site}/logo/mechbridge-email.png" width="96" height="59" alt="Mechbridge International" style="display:block;border:0;"></td>
            <td align="right" style="font:600 11px/1.3 Arial,Helvetica,sans-serif;color:${C.cream};letter-spacing:.18em;text-transform:uppercase;">Website lead<br><span style="color:#9BA7BE;letter-spacing:.06em;">#${l.id}</span></td>
          </tr></table>
        </td></tr>
        <tr><td style="background:${C.red};height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
        <tr><td style="background:${C.paper};padding:28px 28px 8px;">
          <p style="margin:0 0 6px;font:700 12px/1.3 Arial,Helvetica,sans-serif;color:${C.red};text-transform:uppercase;letter-spacing:.12em;">${esc(l.label)}</p>
          <h1 style="margin:0 0 18px;font:800 26px/1.15 'Arial Narrow',Arial,Helvetica,sans-serif;color:${C.navy};">${esc(l.name)}</h1>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.line};">${rowHtml}
          </table>
          <p style="margin:22px 0 8px;font:600 12px/1.4 Arial,Helvetica,sans-serif;color:${C.muted};text-transform:uppercase;letter-spacing:.06em;">Message</p>
          <div style="background:#FFFFFF;border:1px solid ${C.line};border-radius:8px;padding:16px 18px;font:15px/1.6 Arial,Helvetica,sans-serif;color:${C.ink};">${nl2br(l.message)}</div>
        </td></tr>
        <tr><td style="background:${C.paper};padding:22px 28px 30px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="background:${C.red};border-radius:6px;"><a href="${portal}" style="display:inline-block;padding:13px 22px;font:700 14px/1 Arial,Helvetica,sans-serif;color:${C.cream};text-decoration:none;">Open in staff portal</a></td>
            <td style="width:10px;"></td>
            <td style="border:1px solid ${C.navy};border-radius:6px;"><a href="mailto:${esc(l.email)}?subject=${replySubject}" style="display:inline-block;padding:12px 20px;font:700 14px/1 Arial,Helvetica,sans-serif;color:${C.navy};text-decoration:none;">Reply to ${esc(l.name.split(' ')[0] || 'them')}</a></td>
          </tr></table>
        </td></tr>
        <tr><td style="background:${C.navy};padding:16px 28px;border-radius:0 0 12px 12px;font:12px/1.5 Arial,Helvetica,sans-serif;color:#9BA7BE;">
          Sent by the website contact forms at <a href="${site}" style="color:${C.cream};text-decoration:none;">mechbridgegroup.com</a>. Replying to this email replies to ${esc(l.name)}.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function leadEmailText(l: LeadAlert, site: string) {
  const opt = (label: string, v: string) => (v ? [`${label}: ${v}`] : []);
  return [
    `${l.label} #${l.id}`, '',
    `Name: ${l.name}`, `Email: ${l.email}`,
    ...opt('Phone', l.phone), ...opt('Based in', l.country), ...opt('For', l.ref_title), ...opt('Service', l.subject), ...opt('CV attached', l.cv_name),
    '', l.message, '', `Open it in the staff portal: ${site}/admin/#/leads?open=${l.id}`,
  ].join('\n');
}

export async function notifyLead(l: LeadAlert) {
  if (!process.env.SMTP_HOST) return;
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    // Local Postfix on 127.0.0.1 uses the public certificate, whose name won't match "127.0.0.1".
    tls: { servername: process.env.SMTP_TLS_NAME || undefined, rejectUnauthorized: process.env.SMTP_HOST !== '127.0.0.1' },
  });
  const site = process.env.PUBLIC_SITE_URL || 'https://mechbridgegroup.com';
  // Each lead type alerts its own inbox.
  const to: Record<string, string | undefined> = {
    support: process.env.SUPPORT_NOTIFY_TO || 'support@mechbridgegroup.com',
    job: process.env.CAREERS_NOTIFY_TO || 'careers@mechbridgegroup.com',
    internship: process.env.INTERN_NOTIFY_TO || 'intern@mechbridgegroup.com',
  };
  await transport.sendMail({
    from: process.env.SMTP_FROM || `Mechbridge website <no-reply@mechbridgegroup.com>`,
    to: to[l.type] || process.env.LEAD_NOTIFY_TO || 'connect@mechbridgegroup.com',
    replyTo: `${l.name.replace(/[<>"]/g, '')} <${l.email}>`,
    subject: `${l.label}: ${l.name}${l.country ? ` (${l.country})` : ''}`,
    text: leadEmailText(l, site),
    html: leadEmailHtml(l, site),
  });
}

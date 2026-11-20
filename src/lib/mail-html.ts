// Company-styled email HTML, shared by the Mail drafter and the webmail signature preview in the staff portal.
// Email clients ignore stylesheets, so everything is tables and inline styles. All input text is escaped first.
import { MAIL_DOMAIN } from './roles';

export const MAIL_COLORS = { navy: '#1A2841', navyDeep: '#0D1523', cream: '#F0E1CE', creamLight: '#F7EEE2', paper: '#FBF8F3', red: '#B11722', ink: '#1A2841', muted: '#5B6A86', line: '#E4CDB0' };
const C = MAIL_COLORS;
const FONT = 'Arial,Helvetica,sans-serif';
const SITE = `https://${MAIL_DOMAIN}`;
export const MAIL_LOGO_CREAM = `${SITE}/logo/mechbridge-email.png`; // for navy backgrounds
export const MAIL_LOGO_NAVY = `${SITE}/logo/mechbridge-email-navy.png`; // for light backgrounds

export const escHtml = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const linkStyle = `color:${C.red};text-decoration:none;font-weight:600;`;
// Escapes a line, then applies **bold**, _italic_ and turns web and email addresses into links.
export function inlineHtml(line: string) {
  let s = escHtml(line);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(])_([^_\s][^_]*?)_(?=$|[\s).,!?:;])/g, '$1<em>$2</em>');
  s = s.replace(/\b((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)'"])/g, (m) => `<a href="${m.startsWith('www.') ? 'https://' + m : m}" style="${linkStyle}">${m}</a>`);
  s = s.replace(/(^|[\s(;:])([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})(?=$|[\s).,!?:;])/g, (_m, pre, mail) => `${pre}<a href="mailto:${mail}" style="${linkStyle}">${mail}</a>`);
  return s;
}

type Block =
  | { t: 'p'; lines: string[] }
  | { t: 'h'; text: string }
  | { t: 'ul' | 'ol'; items: string[]; title?: string }
  | { t: 'note'; lines: string[] }
  | { t: 'hr' };

const BULLET = /^\s*[-*•]\s+/;
const NUMBER = /^\s*\d{1,2}[.)]\s+/;
const QUOTE = /^\s*>\s?/;

// Plain text → blocks. Blank lines separate blocks.
export function parseDraft(text: string): Block[] {
  const out: Block[] = [];
  for (const raw of text.replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    const lines = raw.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim());
    if (!lines.length) continue;
    const first = lines[0].trim();
    if (lines.length === 1 && /^(-{3,}|_{3,}|\*{3,})$/.test(first)) { out.push({ t: 'hr' }); continue; }
    if (lines.length === 1 && /^#{1,3}\s+/.test(first)) { out.push({ t: 'h', text: first.replace(/^#{1,3}\s+/, '') }); continue; }
    if (lines.length === 1 && first.length <= 60 && /[A-Z]/.test(first) && first === first.toUpperCase() && !/[.!?]$/.test(first)) { out.push({ t: 'h', text: first }); continue; }
    if (lines.every((l) => QUOTE.test(l))) { out.push({ t: 'note', lines: lines.map((l) => l.replace(QUOTE, '')) }); continue; }
    out.push(listBlock(lines) ?? { t: 'p', lines: lines.map((l) => l.trim()) });
  }
  return out;
}
// A block that is all bullets (or numbers), optionally with one heading line above them.
function listBlock(lines: string[]): Block | null {
  for (const [re, t] of [[BULLET, 'ul'], [NUMBER, 'ol']] as const) {
    if (lines.every((l) => re.test(l))) return { t, items: lines.map((l) => l.replace(re, '')) };
    if (lines.length > 1 && lines.slice(1).every((l) => re.test(l))) return { t, title: lines[0].trim(), items: lines.slice(1).map((l) => l.replace(re, '')) };
  }
  return null;
}

const pStyle = `margin:0 0 14px;font:15px/1.6 ${FONT};color:${C.ink};`;
function blockHtml(b: Block) {
  switch (b.t) {
    case 'hr': return `<hr style="border:0;border-top:1px solid ${C.line};margin:20px 0;">`;
    case 'h': return `<p style="margin:22px 0 10px;padding-left:10px;border-left:3px solid ${C.red};font:700 17px/1.3 ${FONT};color:${C.navy};">${inlineHtml(b.text)}</p>`;
    case 'note': return `<div style="margin:0 0 14px;padding:12px 16px;background:${C.creamLight};border-left:3px solid ${C.red};border-radius:6px;font:15px/1.6 ${FONT};color:${C.ink};">${b.lines.map(inlineHtml).join('<br>')}</div>`;
    case 'ul': case 'ol': {
      const title = b.title ? `<p style="margin:0 0 6px;font:700 15px/1.5 ${FONT};color:${C.navy};">${inlineHtml(b.title)}</p>` : '';
      return `${title}<${b.t} style="margin:0 0 14px;padding-left:22px;font:15px/1.6 ${FONT};color:${C.ink};">${b.items.map((i) => `<li style="margin:0 0 6px;">${inlineHtml(i)}</li>`).join('')}</${b.t}>`;
    }
    default: return `<p style="${pStyle}">${b.lines.map(inlineHtml).join('<br>')}</p>`;
  }
}

export interface Signature { name: string; title: string; company: string; phone: string; email: string; web: string }

// Signature block for light backgrounds: navy logo, red rule, name and contact lines.
export function signatureHtml(s: Signature) {
  const bits = [
    s.phone && `<a href="tel:${escHtml(s.phone.replace(/[^\d+]/g, ''))}" style="color:${C.ink};text-decoration:none;">${escHtml(s.phone)}</a>`,
    s.email && `<a href="mailto:${escHtml(s.email)}" style="color:${C.red};text-decoration:none;">${escHtml(s.email)}</a>`,
    s.web && `<a href="https://${escHtml(s.web.replace(/^https?:\/\//, ''))}" style="color:${C.red};text-decoration:none;">${escHtml(s.web.replace(/^https?:\/\//, ''))}</a>`,
  ].filter(Boolean).join(`<span style="color:${C.line};">&nbsp;&nbsp;|&nbsp;&nbsp;</span>`);
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:22px;border-collapse:collapse;">
  <tr>
    <td style="padding:2px 16px 2px 0;border-right:2px solid ${C.red};vertical-align:middle;"><img src="${MAIL_LOGO_NAVY}" width="78" height="48" alt="Mechbridge International" style="display:block;border:0;"></td>
    <td style="padding:2px 0 2px 16px;vertical-align:middle;font:13px/1.5 ${FONT};color:${C.muted};">
      ${s.name ? `<div style="font:700 15px/1.3 ${FONT};color:${C.navy};">${escHtml(s.name)}</div>` : ''}
      ${s.title ? `<div>${escHtml(s.title)}</div>` : ''}
      ${s.company ? `<div style="color:${C.navy};">${escHtml(s.company)}</div>` : ''}
      ${bits ? `<div style="margin-top:4px;">${bits}</div>` : ''}
    </td>
  </tr>
</table>`;
}

export interface DraftOptions { letterhead: boolean; signature: Signature | null }

// The drafted email as an HTML fragment, ready to paste into a mail editor.
export function draftEmailHtml(text: string, o: DraftOptions) {
  const body = parseDraft(text).map(blockHtml).join('\n') + (o.signature ? '\n' + signatureHtml(o.signature) : '');
  if (!o.letterhead) return `<div style="font:15px/1.6 ${FONT};color:${C.ink};max-width:640px;">\n${body}\n</div>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;border-collapse:collapse;font:15px/1.6 ${FONT};color:${C.ink};">
  <tr><td style="background:${C.navy};padding:18px 26px;border-radius:10px 10px 0 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><img src="${MAIL_LOGO_CREAM}" width="86" height="53" alt="Mechbridge International" style="display:block;border:0;"></td>
      <td align="right" style="font:600 11px/1.4 ${FONT};color:${C.cream};letter-spacing:.14em;text-transform:uppercase;">MEP Consultants</td>
    </tr></table>
  </td></tr>
  <tr><td style="background:${C.red};height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
  <tr><td style="background:${C.paper};padding:26px 26px 18px;">
${body}
  </td></tr>
  <tr><td style="background:${C.navy};padding:14px 26px;border-radius:0 0 10px 10px;font:12px/1.5 ${FONT};color:#9BA7BE;">
    Mechbridge International MEP Consultants &middot; Dubai and India &middot; <a href="${SITE}" style="color:${C.cream};text-decoration:none;">${MAIL_DOMAIN}</a>
  </td></tr>
</table>`;
}

// Plain-text version for the clipboard (mail apps that don't take HTML).
export function draftEmailText(text: string, sig: Signature | null) {
  const lines = parseDraft(text).map((b) => {
    if (b.t === 'hr') return '----';
    if (b.t === 'h') return b.text.toUpperCase();
    if (b.t === 'note') return b.lines.map((l) => `> ${l}`).join('\n');
    if (b.t === 'p') return b.lines.join('\n');
    const bullet = b.t === 'ul';
    return [b.title, ...b.items.map((i, n) => (bullet ? `- ${i}` : `${n + 1}. ${i}`))].filter(Boolean).join('\n');
  });
  const plain = lines.join('\n\n').replace(/\*\*(.+?)\*\*/g, '$1');
  if (!sig) return plain;
  return `${plain}\n\n--\n${[sig.name, sig.title, sig.company, [sig.phone, sig.email, sig.web].filter(Boolean).join(' | ')].filter(Boolean).join('\n')}`;
}

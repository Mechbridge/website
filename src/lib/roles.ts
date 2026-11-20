import type { Role, LeadType, PostingKind, Perm, User, WebmailSettings } from './api/types';

// Who can do what. Used by the server (enforcement) and the admin UI (what to show).
export const ROLE_LABELS: Record<Role, string> = {
  superadmin: 'Superadmin',
  hr: 'HR',
  training: 'Training',
  sales: 'Sales',
  documentation: 'Documentation',
};

export const ROLE_NOTES: Record<Role, string> = {
  superadmin: 'Everything, including staff accounts',
  hr: 'Jobs, internships and their applications',
  training: 'Training batches',
  sales: 'Proposal, training, contact and support leads',
  documentation: 'Certificates: issue, edit, print and revoke',
};

const LEAD_TYPES: Record<Role, LeadType[]> = {
  superadmin: ['consultancy', 'contact', 'training', 'internship', 'job', 'support'],
  hr: ['job', 'internship'],
  training: [],
  sales: ['consultancy', 'contact', 'training', 'support'],
  documentation: [],
};

const POSTING_KINDS: Record<Role, PostingKind[]> = {
  superadmin: ['job', 'internship', 'training'],
  hr: ['job', 'internship'],
  training: ['training'],
  sales: [],
  documentation: [],
};

export const leadTypesFor = (role: Role) => LEAD_TYPES[role];
export const postingKindsFor = (role: Role) => POSTING_KINDS[role];
export const canManageCertificates = (role: Role) => role === 'superadmin' || role === 'documentation';

// Extra permissions, granted per person in Staff accounts. Superadmins have all of them.
export const PERMS: { key: Perm; label: string; note: string }[] = [
  { key: 'drafter', label: 'Mail drafter', note: 'Turn plain text into a Mechbridge-styled email' },
];
export const hasPerm = (u: Pick<User, 'role' | 'perms'>, p: Perm) => u.role === 'superadmin' || (u.perms ?? []).includes(p);
export const cleanPerms = (v: unknown): Perm[] => [...new Set((Array.isArray(v) ? v : String(v ?? '').split(',')).map(String))].filter((p): p is Perm => PERMS.some((x) => x.key === p));
export const canManageUsers = (role: Role) => role === 'superadmin';
export const canSeeLeads = (role: Role) => LEAD_TYPES[role].length > 0;

export const LEAD_TYPE_LABELS: Record<LeadType, string> = {
  consultancy: 'Proposal request',
  contact: 'General contact',
  training: 'Training enquiry',
  internship: 'Internship application',
  job: 'Job application',
  support: 'Support request',
};

export const POSTING_LABELS: Record<PostingKind, { one: string; many: string }> = {
  job: { one: 'Job', many: 'Jobs' },
  internship: { one: 'Internship intake', many: 'Internships' },
  training: { one: 'Training batch', many: 'Training batches' },
};
export const POSTING_STATUSES = ['draft', 'open', 'closed', 'archived'] as const;
export const POSTING_STATUS_LABELS: Record<(typeof POSTING_STATUSES)[number], { label: string; note: string }> = {
  draft: { label: 'Draft', note: 'Hidden while you write it' },
  open: { label: 'Open', note: 'Published and taking applications' },
  closed: { label: 'Closed', note: 'Still listed, marked no longer available' },
  archived: { label: 'Archived', note: 'Hidden from the website' },
};

// Certificate codes: MBI-YYYY-XXXXXX without look-alike characters (0/O, 1/I/L).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newCertificateCode(year = new Date().getFullYear(), rand: (n: number) => number = (n) => Math.floor(Math.random() * n)) {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHABET[rand(ALPHABET.length)];
  return `MBI-${year}-${s}`;
}
export const normaliseCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, '');

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 80) || 'item';

export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'distributed', 'converted', 'closed'] as const;
export const LEAD_STATUS_LABELS: Record<(typeof LEAD_STATUSES)[number], string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  distributed: 'Distributed',
  converted: 'Converted',
  closed: 'Closed',
};
export const LEAD_STATUS_NOTES: Record<(typeof LEAD_STATUSES)[number], string> = {
  new: 'Not handled yet',
  contacted: 'We replied or called',
  qualified: 'A real opportunity',
  distributed: 'Handed to a team or partner',
  converted: 'Became a project, enrolment or hire',
  closed: 'No further action',
};

// Mail server
export const MAIL_DOMAIN = 'mechbridgegroup.com';
export const CORE_MAILBOXES = ['connect', 'support', 'careers', 'intern']; // the website sends lead alerts to these
export const canManageMailboxes = (role: Role) => role === 'superadmin';
// Shared checks (server, demo store and the portal form). Return an error message, or '' when fine.
export const mailAddress = (input: string) => { const r = String(input ?? '').trim().toLowerCase(); return r.includes('@') ? r : `${r}@${MAIL_DOMAIN}`; };
export function mailAddressError(address: string) {
  const local = address.split('@')[0];
  return address.endsWith(`@${MAIL_DOMAIN}`) && /^[a-z0-9]([a-z0-9._-]{0,62}[a-z0-9])?$/.test(local) && !local.includes('..') ? ''
    : `Use letters, numbers, dots, dashes or underscores before @${MAIL_DOMAIN}, with no dot at the start or end.`;
}
export function mailPasswordError(pw: string) {
  if (pw.length < 12) return 'Use a password of at least 12 characters.';
  if (pw.length > 128) return 'Use a password of 128 characters or fewer.';
  if (/[:\n\r]/.test(pw)) return "The password can't contain a colon or a line break.";
  return '';
}

// Webmail defaults (also used when the settings file doesn't exist yet).
export const WEBMAIL_DEFAULTS: WebmailSettings = {
  language: 'en_GB', timezone: 'Asia/Dubai', compose_html: true, show_images: 1, reply_above: true, autosave_minutes: 2, page_size: 50,
  layout: 'widescreen', lock: false, signature: 'empty', signature_title: 'Mechbridge International MEP Consultants',
  signature_phone: '', signature_web: 'mechbridgegroup.com', login_note: 'Staff email for Mechbridge International. Sign in with your full email address.',
};
export const WEBMAIL_LANGUAGES: [string, string][] = [['en_GB', 'English (UK)'], ['en_US', 'English (US)'], ['ar', 'Arabic'], ['hi_IN', 'Hindi']];
export const WEBMAIL_TIMEZONES: [string, string][] = [['Asia/Dubai', 'Dubai (GST)'], ['Asia/Riyadh', 'Riyadh, Kuwait, Doha, Bahrain'], ['Asia/Muscat', 'Muscat'], ['Asia/Kolkata', 'India (IST)'], ['UTC', 'UTC']];
// Validates and fills in a settings object from any input (server, demo and the helper's file).
export function cleanWebmailSettings(v: unknown): WebmailSettings {
  const x = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const d = WEBMAIL_DEFAULTS;
  const text = (k: keyof WebmailSettings, max: number) => (typeof x[k] === 'string' ? String(x[k]).replace(/[\r\n\t<>]/g, ' ').trim().slice(0, max) : String(d[k]));
  const pick = <T extends string>(k: keyof WebmailSettings, ok: readonly T[]) => (ok.includes(x[k] as T) ? (x[k] as T) : (d[k] as T));
  const num = (k: keyof WebmailSettings, lo: number, hi: number) => { const n = Math.round(Number(x[k])); return x[k] !== undefined && x[k] !== '' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : (d[k] as number); };
  const bool = (k: keyof WebmailSettings) => (typeof x[k] === 'boolean' ? (x[k] as boolean) : (d[k] as boolean));
  return {
    language: pick('language', WEBMAIL_LANGUAGES.map((l) => l[0])), timezone: pick('timezone', WEBMAIL_TIMEZONES.map((t) => t[0])),
    compose_html: bool('compose_html'), show_images: [0, 1, 3].includes(Number(x.show_images)) && x.show_images !== undefined ? (Number(x.show_images) as 0 | 1 | 3) : d.show_images,
    reply_above: bool('reply_above'), autosave_minutes: num('autosave_minutes', 0, 30), page_size: num('page_size', 10, 200),
    layout: pick('layout', ['widescreen', 'desktop', 'list'] as const), lock: bool('lock'),
    signature: pick('signature', ['off', 'empty', 'always'] as const),
    signature_title: text('signature_title', 120), signature_phone: text('signature_phone', 40), signature_web: text('signature_web', 80), login_note: text('login_note', 200),
  };
}
// Sender name shown in webmail. Return an error message, or '' when fine.
export function mailNameError(name: string) {
  if (name.length > 80) return 'Keep the name to 80 characters.';
  if (/[\t\r\n<>"]/.test(name)) return 'The name can’t contain tabs, line breaks, quotes or angle brackets.';
  return '';
}

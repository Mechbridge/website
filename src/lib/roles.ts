import type { Role, LeadType, PostingKind } from './api/types';

// Who can do what. Used by the server (enforcement) and the admin UI (what to show).
export const ROLE_LABELS: Record<Role, string> = {
  superadmin: 'Superadmin',
  hr: 'HR',
  training: 'Training',
  sales: 'Sales',
};

export const ROLE_NOTES: Record<Role, string> = {
  superadmin: 'Everything, including staff accounts',
  hr: 'Jobs, internships and their applications',
  training: 'Training batches, certificates and training enquiries',
  sales: 'Consultancy, contact and support leads',
};

const LEAD_TYPES: Record<Role, LeadType[]> = {
  superadmin: ['consultancy', 'contact', 'training', 'internship', 'job', 'support'],
  hr: ['job', 'internship'],
  training: ['training'],
  sales: ['consultancy', 'contact', 'support'],
};

const POSTING_KINDS: Record<Role, PostingKind[]> = {
  superadmin: ['job', 'internship', 'training'],
  hr: ['job', 'internship'],
  training: ['training'],
  sales: [],
};

export const leadTypesFor = (role: Role) => LEAD_TYPES[role];
export const postingKindsFor = (role: Role) => POSTING_KINDS[role];
export const canManageCertificates = (role: Role) => role === 'superadmin' || role === 'training';
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

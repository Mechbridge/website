// Shared data shapes for the production API (src/server) and the GitHub demo store (src/lib/api/demo.ts).

export type Role = 'superadmin' | 'hr' | 'training' | 'sales' | 'documentation';
// Extra permissions a superadmin can grant to any staff account, on top of the role.
export type Perm = 'drafter';
export type PostingKind = 'job' | 'internship' | 'training';
// closed = still listed on the website as no longer available; archived = hidden everywhere public.
export type PostingStatus = 'draft' | 'open' | 'closed' | 'archived';
export type LeadType = 'consultancy' | 'contact' | 'training' | 'internship' | 'job' | 'support';
// Pipeline: new → contacted → qualified → distributed (handed to a team or partner) → converted, or closed at any point.
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'distributed' | 'converted' | 'closed';
export type CertStatus = 'valid' | 'revoked';
export type Programme = 'training' | 'internship';

export interface User { id: number; email: string; name: string; role: Role; perms: Perm[]; active: boolean; created_at: string; last_login_at?: string }
export interface StaffRef { id: number; name: string; role: Role }

export interface Posting {
  id: number;
  kind: PostingKind;
  title: string;
  slug: string;
  location: string;
  mode: string;
  start_date: string; // ISO date or ''
  summary: string;
  body: string; // plain text, blank-line separated paragraphs; lines starting with "- " become bullets
  status: PostingStatus;
  created_at: string;
  updated_at: string;
  applicants?: number; // admin lists only: leads that reference this posting
}

export interface Lead {
  id: number;
  type: LeadType;
  name: string;
  email: string;
  phone: string;
  country: string;
  subject: string;
  message: string;
  ref_id: number | null;
  ref_title: string;
  cv_name: string;
  has_cv: boolean;
  status: LeadStatus;
  notes: string;
  assigned_to: number | null; // staff user id
  assigned_name: string;
  distributed_to: string; // who the lead was handed to (team, partner, branch)
  distributed_at: string;
  created_at: string;
  updated_at: string;
}

export interface LeadEvent { id: number; lead_id: number; at: string; by: string; action: string; detail: string }

export interface Certificate {
  id: number;
  code: string;
  holder_name: string;
  programme: Programme;
  title: string;
  batch: string;
  issue_date: string;
  status: CertStatus;
  revoked_reason: string;
  issued_by: string;
  created_at: string;
  // Optional details printed on the certificate when filled in.
  period_from: string; // YYYY-MM-DD or ''
  period_to: string;
  hours: string; // free text, e.g. "120 hours"
  mode: string; // e.g. "Live, instructor-led sessions"
  grade: string; // result or grade
  modules: string; // one per line
  remarks: string; // one line under the title
  signatory_name: string;
  signatory_title: string;
}

export interface VerifyResult {
  found: boolean;
  code?: string;
  holder_name?: string;
  programme?: Programme;
  title?: string;
  issue_date?: string;
  period_from?: string;
  period_to?: string;
  status?: CertStatus;
}

export type PostingInput = Pick<Posting, 'kind' | 'title' | 'location' | 'mode' | 'start_date' | 'summary' | 'body' | 'status'> & { slug?: string };
export const CERT_DETAIL_FIELDS = ['period_from', 'period_to', 'hours', 'mode', 'grade', 'modules', 'remarks', 'signatory_name', 'signatory_title'] as const;
export type CertificateInput = Pick<Certificate, 'holder_name' | 'programme' | 'title' | 'batch' | 'issue_date' | (typeof CERT_DETAIL_FIELDS)[number]>;

export interface LeadFilter extends PageQuery {
  type?: LeadType | '';
  status?: LeadStatus | 'open' | ''; // 'open' = anything not converted or closed
  q?: string;
  from?: string; // YYYY-MM-DD, received on or after
  to?: string; // YYYY-MM-DD, received on or before
  country?: string;
  cv?: '' | '1' | '0';
  ref?: string; // posting id
  assigned?: '' | 'me' | 'none' | string; // user id
  ids?: number[]; // export only the selected rows
}
export interface LeadUpdate { status?: LeadStatus; notes?: string; assigned_to?: number | null; distributed_to?: string }
export type LeadBulkAction =
  | { action: 'status'; value: LeadStatus }
  | { action: 'assign'; value: number | null }
  | { action: 'distribute'; value: string }
  | { action: 'delete' };

export type PostingBulkAction = { action: 'status'; value: PostingStatus } | { action: 'delete' };
export type CertBulkAction = { action: 'revoke'; reason: string } | { action: 'restore' };

// Server-side pagination: lists return one page plus the total that matches the filters.
export interface Paged<T> { rows: T[]; total: number; page: number; pageSize: number }
export interface PageQuery { page?: number; pageSize?: number; sort?: string }
export type LeadSort = 'newest' | 'oldest' | 'updated' | 'name';
export interface LeadPage extends Paged<Lead> { counts: Record<LeadStatus | 'all', number> } // counts ignore the status filter, for the tabs

export interface PostingFilter extends PageQuery { kind?: PostingKind; status?: PostingStatus | ''; q?: string; from?: string; to?: string }
export interface PostingPage extends Paged<Posting> { counts: Record<PostingStatus | 'all', number> }
export interface CertFilter extends PageQuery { q?: string; programme?: Programme | ''; status?: CertStatus | ''; from?: string; to?: string; ids?: number[] }
export interface CertPage extends Paged<Certificate> { counts: Record<CertStatus | 'all', number> }
export const PAGE_SIZES = [25, 50, 100] as const;

// Mailboxes on the mail server (staff portal, superadmin only).
export interface Mailbox { address: string; name: string; size_bytes: number; created: string; core: boolean } // name = sender name in webmail; core = used by the website forms
export interface MailAlias { from: string; to: string }
export interface MailboxList { available: boolean; mode: 'server' | 'mock' | 'off' | 'demo'; domain: string; webmail: string; mailboxes: Mailbox[]; aliases: MailAlias[]; settings: WebmailSettings }
// Webmail (Roundcube) settings applied to every mailbox by the mechbridge Roundcube plugin (deploy/roundcube).
export interface WebmailSettings {
  language: string; // e.g. en_GB
  timezone: string; // e.g. Asia/Dubai
  compose_html: boolean; // write new mail in HTML
  show_images: 0 | 1 | 3; // remote images: never, from known senders, always
  reply_above: boolean; // reply above the quoted message
  autosave_minutes: number; // 0 = off
  page_size: number; // messages per page
  layout: 'widescreen' | 'desktop' | 'list';
  lock: boolean; // stop people changing these in webmail
  signature: 'off' | 'empty' | 'always'; // company signature: off, only where there is none, or always replace
  signature_title: string; // line under the name, e.g. company name
  signature_phone: string;
  signature_web: string;
  login_note: string; // short line on the webmail sign-in screen
}

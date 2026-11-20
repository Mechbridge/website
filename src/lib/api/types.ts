// Shared data shapes for the production API (src/server) and the GitHub demo store (src/lib/api/demo.ts).

export type Role = 'superadmin' | 'hr' | 'training' | 'sales';
export type PostingKind = 'job' | 'internship' | 'training';
export type PostingStatus = 'draft' | 'open' | 'closed';
export type LeadType = 'consultancy' | 'contact' | 'training' | 'internship' | 'job' | 'support';
// Pipeline: new → contacted → qualified → distributed (handed to a team or partner) → converted, or closed at any point.
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'distributed' | 'converted' | 'closed';
export type CertStatus = 'valid' | 'revoked';
export type Programme = 'training' | 'internship';

export interface User { id: number; email: string; name: string; role: Role; active: boolean; created_at: string; last_login_at?: string }
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
}

export interface VerifyResult {
  found: boolean;
  code?: string;
  holder_name?: string;
  programme?: Programme;
  title?: string;
  issue_date?: string;
  status?: CertStatus;
}

export type PostingInput = Pick<Posting, 'kind' | 'title' | 'location' | 'mode' | 'start_date' | 'summary' | 'body' | 'status'> & { slug?: string };
export type CertificateInput = Pick<Certificate, 'holder_name' | 'programme' | 'title' | 'batch' | 'issue_date'>;

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

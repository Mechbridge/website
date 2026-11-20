// One client API for the public pages and the admin portal.
// Production (VPS) talks to /api; the GitHub demo build keeps everything in localStorage.
import type {
  CertBulkAction, CertFilter, CertPage, Certificate, CertificateInput, Lead, LeadBulkAction, LeadEvent, LeadFilter, LeadPage, LeadUpdate,
  Posting, PostingBulkAction, PostingFilter, PostingInput, PostingKind, PostingPage, Role, StaffRef, User, VerifyResult,
} from './types';
import { httpApi } from './http';
import { demoApi } from './demo';

export interface Api {
  demo: boolean;
  // public
  listPostings(kind: PostingKind): Promise<Posting[]>;
  getPosting(kind: PostingKind, slug: string): Promise<Posting | null>;
  submitLead(form: FormData): Promise<void>;
  verify(code: string): Promise<VerifyResult>;
  // auth
  login(email: string, password: string): Promise<User>;
  logout(): Promise<void>;
  me(): Promise<User | null>;
  changePassword(current: string, next: string): Promise<void>;
  // staff
  staff(): Promise<StaffRef[]>;
  // leads (paged on the server)
  leads(f: LeadFilter): Promise<LeadPage>;
  lead(id: number): Promise<Lead>;
  leadEvents(id: number): Promise<LeadEvent[]>;
  leadCountries(): Promise<string[]>;
  updateLead(id: number, u: LeadUpdate): Promise<Lead>;
  bulkLeads(ids: number[], a: LeadBulkAction): Promise<number>;
  deleteLead(id: number): Promise<void>;
  leadsCsvUrl(f: LeadFilter): Promise<string>; // URL or object URL
  cvUrl(id: number): string | null;
  // postings (paged)
  postings(f: PostingFilter): Promise<PostingPage>;
  savePosting(p: PostingInput, id?: number): Promise<Posting>;
  duplicatePosting(id: number): Promise<Posting>;
  bulkPostings(ids: number[], a: PostingBulkAction): Promise<number>;
  deletePosting(id: number): Promise<void>;
  // certificates (paged)
  certificates(f: CertFilter): Promise<CertPage>;
  certificate(id: number): Promise<Certificate>;
  certificatesCsvUrl(f: CertFilter): Promise<string>;
  issueCertificate(c: CertificateInput): Promise<Certificate>;
  updateCertificate(id: number, c: CertificateInput): Promise<Certificate>;
  revokeCertificate(id: number, reason: string): Promise<Certificate>;
  restoreCertificate(id: number): Promise<Certificate>;
  bulkCertificates(ids: number[], a: CertBulkAction): Promise<number>;
  // users
  users(): Promise<User[]>;
  createUser(u: { email: string; name: string; role: Role; password: string }): Promise<User>;
  updateUser(id: number, u: { name?: string; role?: Role; active?: boolean; password?: string }): Promise<User>;
}

export const isDemo = import.meta.env.PUBLIC_DEMO === '1';
export const api: Api = isDemo ? demoApi : httpApi;

export { ApiError } from './errors';

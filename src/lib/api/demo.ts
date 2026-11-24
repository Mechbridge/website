// GitHub Pages demo: the same API shape as production, stored in this browser's localStorage.
// Nothing leaves the visitor's machine. Sample content is labelled as such.
import type { Api } from './client';
import { ApiError } from './errors';
import type {
  CertFilter, Certificate, Lead, LeadEvent, LeadFilter, LeadPage, LeadStatus, LeadType, LeadUpdate,
  MailboxList, Posting, PostingFilter, PostingKind, PostingPage, Role, User,
} from './types';
import { DOCUMENTS, readDetails } from '../lead-fields';
import { CORE_MAILBOXES, MAIL_DOMAIN, mailAddress, mailAddressError, mailPasswordError, mailNameError, canManageMailboxes, cleanPerms, cleanWebmailSettings } from '../roles';
import { LEAD_STATUSES, canManageCertificates, canManageUsers, leadTypesFor, newCertificateCode, normaliseCode, postingKindsFor, slugify } from '../roles';

const KEY = 'mb-demo-v7';
export const DEMO_PASSWORD = 'demo1234';
export const DEMO_ACCOUNTS: { email: string; name: string; role: Role }[] = [
  { email: 'admin@demo.mechbridge', name: 'Demo Superadmin', role: 'superadmin' },
  { email: 'hr@demo.mechbridge', name: 'Demo HR', role: 'hr' },
  { email: 'training@demo.mechbridge', name: 'Demo Training', role: 'training' },
  { email: 'sales@demo.mechbridge', name: 'Demo Sales', role: 'sales' },
  { email: 'docs@demo.mechbridge', name: 'Demo Documentation', role: 'documentation' },
];

interface State { seq: number; users: User[]; postings: Posting[]; leads: (Lead & { cv?: boolean })[]; events: LeadEvent[]; certificates: Certificate[]; session: number | null }

const stamp = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 19);
const now = () => stamp(new Date());
const day = (offset: number) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);
const ago = (days: number, hours = 0) => stamp(new Date(Date.now() - days * 864e5 - hours * 36e5));

function seed(): State {
  let id = 1;
  const t = now();
  const users: User[] = DEMO_ACCOUNTS.map((a) => ({ id: id++, ...a, perms: a.role === 'sales' ? ['drafter'] : [], active: true, created_at: t, last_login_at: '' }));
  const P = (kind: PostingKind, title: string, location: string, mode: string, start: string, summary: string, body: string, status: Posting['status'] = 'open'): Posting =>
    ({ id: id++, kind, title, slug: slugify(title), location, mode, start_date: start, summary, body, status, created_at: t, updated_at: t });
  const postings = [
    P('job', 'MEP Design Engineer (HVAC)', 'Dubai, UAE', 'On-site', '', 'Sample posting: HVAC design for residential and commercial towers.',
      'Sample posting for the demo. Replace it from the admin portal.\n\nWhat you will do\n- Heat load calculations and equipment selection\n- Duct and chilled water layouts\n- Coordinate with firefighting and plumbing\n\nWhat you need\n- Degree in mechanical engineering\n- Experience with GCC codes\n- AutoCAD; Revit MEP is a plus'),
    P('job', 'Firefighting Design Engineer', 'Riyadh, Saudi Arabia', 'On-site', '', 'Sample posting: sprinkler and hydrant design to SBC 801 and NFPA.',
      'Sample posting for the demo.\n\n- Sprinkler, hydrant and hose reel design\n- Hydraulic calculations\n- Civil Defence submissions'),
    P('job', 'MEP Quantity Surveyor', 'India', 'Hybrid', '', 'Sample posting: takeoffs, BOQs and cost estimates for GCC projects.',
      'Sample posting for the demo.\n\n- HVAC, firefighting and plumbing takeoffs\n- BOQ preparation and rate analysis\n- Vendor quotation comparison'),
    P('job', 'Plumbing Draughtsperson', 'Doha, Qatar', 'On-site', '', 'Sample posting: plumbing shop drawings and risers.', 'Sample posting for the demo.', 'draft'),
    P('job', 'Senior HVAC Engineer', 'Kuwait City, Kuwait', 'On-site', '', 'Sample posting: this role has been filled.', 'Sample posting for the demo.', 'closed'),
    P('job', 'Electrical Coordinator', 'Muscat, Oman', 'On-site', '', 'Sample posting: archived, hidden from the website.', 'Sample posting for the demo.', 'archived'),
    P('internship', 'GCC-Ready Internship: next intake', 'India and GCC', 'Supervised project work', day(45), 'Sample intake: the full course plus supervised project work.',
      'Sample intake for the demo. Dates and fee are confirmed by the training team.'),
    P('training', 'Professional MEP Engineering Training: next batch', 'Live sessions', 'Instructor-led', day(21), 'Sample batch: live sessions scheduled around a working week.', 'Sample batch for the demo.'),
    P('training', 'Professional MEP Engineering Training: following batch', 'Live sessions', 'Instructor-led', day(60), 'Sample batch: the same engineers and project sets.', 'Sample batch for the demo.'),
  ];

  // ~70 sample leads spread over 90 days, with every type, status and GCC country, so paging and filters have something to show.
  const countries = ['United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'India'];
  const types: LeadType[] = ['consultancy', 'consultancy', 'training', 'internship', 'job', 'support', 'contact'];
  const msgs: Record<LeadType, string> = {
    consultancy: 'Sample lead: HVAC and firefighting design for a G+12 residential tower.',
    training: 'Sample lead: interested in the next training batch.',
    internship: 'Sample lead: final-year mechanical student looking for the internship package.',
    job: 'Sample lead: applying with five years of MEP design experience.',
    support: 'Sample lead: please resend the revised plumbing shop drawings.',
    contact: 'Sample lead: general question about your services.',
  };
  let r = 7;
  const rnd = (n: number) => { r = (r * 9301 + 49297) % 233280; return Math.floor((r / 233280) * n); };
  const leads: State['leads'] = [];
  const events: LeadEvent[] = [];
  for (let i = 0; i < 72; i++) {
    const type = types[rnd(types.length)];
    const created = ago(rnd(90), rnd(24));
    const status = (i < 14 ? 'new' : LEAD_STATUSES[rnd(LEAD_STATUSES.length)]) as LeadStatus;
    const ref = type === 'job' ? postings[rnd(3)] : type === 'internship' ? postings[6] : type === 'training' ? postings[7 + rnd(2)] : null;
    const assigned = rnd(3) === 0 ? users[rnd(users.length)] : null;
    const lead = {
      id: id++, type, name: `Sample Lead ${String(i + 1).padStart(2, '0')}`, email: `lead${i + 1}@example.com`, phone: '', country: countries[rnd(countries.length)],
      subject: '', message: msgs[type], ref_id: ref?.id ?? null, ref_title: ref?.title ?? '', cv_name: type === 'job' || (type === 'internship' && rnd(2)) ? 'sample-cv.pdf' : '',
      has_cv: false, id_doc_name: type === 'internship' ? 'sample-college-id.pdf' : '', has_id_doc: false, details: {},
      status, notes: '', assigned_to: assigned?.id ?? null, assigned_name: assigned?.name ?? '',
      distributed_to: status === 'distributed' ? ['Dubai design team', 'KSA delivery partner', 'India estimation team'][rnd(3)] : '',
      distributed_at: status === 'distributed' ? created : '', created_at: created, updated_at: created,
    };
    leads.push(lead);
    events.push({ id: id++, lead_id: lead.id, at: created, by: 'website', action: 'received', detail: 'Submitted on the website' });
  }
  leads.sort((a, b) => b.created_at.localeCompare(a.created_at));

  const C = (code: string, holder: string, programme: Certificate['programme'], title: string, status: Certificate['status'], issued: number, reason = ''): Certificate =>
    ({ id: id++, code, holder_name: holder, programme, title, batch: 'Sample batch', issue_date: day(-issued), status, revoked_reason: reason, issued_by: 'Demo Documentation', created_at: t,
      period_from: '', period_to: '', hours: '', mode: '', grade: '', modules: '', remarks: '', signatory_name: '', signatory_title: '' });
  const certificates = [
    C('MBI-2026-DEMO01', 'Sample Trainee', 'training', 'Professional MEP Engineering Training', 'valid', 30),
    C('MBI-2026-DEMO02', 'Sample Intern', 'internship', 'GCC-Ready Internship Package', 'revoked', 60, 'Issued in error (sample)'),
    ...Array.from({ length: 28 }, (_, i) => C(newCertificateCode(2026), `Sample Graduate ${i + 1}`, i % 4 ? 'training' : 'internship',
      i % 4 ? 'Professional MEP Engineering Training' : 'GCC-Ready Internship Package', 'valid', 5 + i * 6)),
  ];
  return { seq: id, users, postings, leads, events, certificates, session: null };
}

const load = (): State => {
  try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch { /* private mode */ }
  return seed();
};
const save = (s: State) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } };
const tick = () => new Promise((r) => setTimeout(r, 120)); // feels like a network call
const fail = (status: number, msg: string): never => { throw new ApiError(status, msg); };
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

function current(s: State): User {
  const u = s.users.find((x) => x.id === s.session && x.active);
  if (!u) fail(401, 'Your session has ended. Log in again.');
  return u!;
}
const need = (ok: boolean) => { if (!ok) fail(403, "Your role doesn't allow this."); };
export const resetDemo = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } };

/* ---------- shared list helpers (mirror the SQL in src/server/db.ts) ---------- */
function paginate<T>(rows: T[], f: { page?: number; pageSize?: number }) {
  const pageSize = Math.min(100, Math.max(1, Number(f.pageSize) || 25));
  const page = Math.max(1, Number(f.page) || 1);
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
}
const inRange = (date: string, from?: string, to?: string) => {
  const d = date.slice(0, 10);
  return (!from || d >= from) && (!to || d <= to);
};
function leadMatches(l: Lead, types: LeadType[], f: LeadFilter, me: number, withStatus = true) {
  if (!types.includes(l.type) || (f.type && l.type !== f.type)) return false;
  if (withStatus && f.status === 'open' && ['converted', 'closed'].includes(l.status)) return false;
  if (withStatus && f.status && f.status !== 'open' && l.status !== f.status) return false;
  if (f.q && ![l.name, l.email, l.phone, l.message, l.ref_title, l.subject, l.distributed_to].join(' ').toLowerCase().includes(f.q.toLowerCase())) return false;
  if (f.country && l.country !== f.country) return false;
  if (f.cv === '1' && !l.cv_name) return false;
  if (f.cv === '0' && l.cv_name) return false;
  if (f.ref && l.ref_id !== Number(f.ref)) return false;
  if (f.assigned === 'me' && l.assigned_to !== me) return false;
  if (f.assigned === 'none' && l.assigned_to !== null) return false;
  if (f.assigned && !['me', 'none'].includes(f.assigned) && l.assigned_to !== Number(f.assigned)) return false;
  if (f.ids?.length && !f.ids.includes(l.id)) return false;
  return inRange(l.created_at, f.from, f.to);
}
const leadSort = (sort = '') => (a: Lead, b: Lead) =>
  sort === 'oldest' ? a.created_at.localeCompare(b.created_at)
  : sort === 'updated' ? b.updated_at.localeCompare(a.updated_at)
  : sort === 'name' ? a.name.localeCompare(b.name)
  : b.created_at.localeCompare(a.created_at);

function applyLeadUpdate(s: State, l: State['leads'][number], u: LeadUpdate, by: string) {
  const log = (action: string, detail: string) => s.events.unshift({ id: s.seq++, lead_id: l.id, at: now(), by, action, detail });
  if (u.status && u.status !== l.status) { log('status', `${l.status} → ${u.status}`); l.status = u.status; l.updated_at = now(); }
  if (u.distributed_to !== undefined && u.distributed_to !== l.distributed_to) {
    log('distributed', u.distributed_to ? `Handed to ${u.distributed_to}` : 'Distribution cleared');
    l.distributed_to = u.distributed_to; l.distributed_at = u.distributed_to ? now() : ''; l.updated_at = now();
  }
  if (u.assigned_to !== undefined && u.assigned_to !== l.assigned_to) {
    const who = s.users.find((x) => x.id === u.assigned_to);
    log('assigned', `Assigned to ${who?.name ?? 'nobody'}`);
    l.assigned_to = u.assigned_to; l.assigned_name = who?.name ?? ''; l.updated_at = now();
  }
  if (u.notes !== undefined && u.notes !== l.notes) { log('notes', 'Internal notes updated'); l.notes = u.notes; l.updated_at = now(); }
}

function certMatches(c: Certificate, f: CertFilter, withStatus = true) {
  if (f.q && ![c.code, c.holder_name, c.batch, c.title].join(' ').toLowerCase().includes(f.q.toLowerCase())) return false;
  if (f.programme && c.programme !== f.programme) return false;
  if (withStatus && f.status && c.status !== f.status) return false;
  if (f.ids?.length && !f.ids.includes(c.id)) return false;
  return inRange(c.issue_date, f.from, f.to);
}
const csvUrl = <T extends object>(cols: string[], rows: T[]) => {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...rows.map((r) => cols.map((k) => esc((r as Record<string, unknown>)[k])).join(','))].join('\r\n');
  return URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
};

export const demoApi: Api = {
  demo: true,

  async listPostings(kind) {
    await tick(); const all = load().postings.filter((p) => p.kind === kind);
    return clone([...all.filter((p) => p.status === 'open'), ...all.filter((p) => p.status === 'closed').sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 6)]);
  },
  async getPosting(kind, slug) { await tick(); return clone(load().postings.find((p) => p.kind === kind && p.slug === slug && ['open', 'closed'].includes(p.status)) ?? null); },
  async submitLead(form) {
    await tick();
    const s = load();
    const g = (k: string) => String(form.get(k) ?? '').trim();
    if (g('botcheck')) return;
    const refId = Number(g('ref_id')) || null;
    const ref = s.postings.find((p) => p.id === refId);
    const cv = form.get('cv');
    const idDoc = form.get('id_doc');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g('email'))) fail(400, 'Enter an email address we can reply to.');
    const digits = g('phone').replace(/\D/g, '');
    if (!/^[+\d\s().-]+$/.test(g('phone')) || digits.length < 7 || digits.length > 15) fail(400, 'Add a mobile or WhatsApp number with the country code, like +971 50 123 4567.');
    const docs = DOCUMENTS[g('type') as LeadType] ?? {};
    if (docs.idDoc && !(idDoc instanceof File && idDoc.size)) fail(400, 'Attach your degree certificate or college ID.');
    if (docs.cv === 'required' && !(cv instanceof File && cv.size)) fail(400, 'Attach your CV.');
    const lead: State['leads'][number] = {
      id: s.seq++, type: g('type') as LeadType, name: g('name'), email: g('email'), phone: g('phone'), country: g('country'),
      subject: g('subject'), message: g('message'), ref_id: ref?.id ?? null, ref_title: ref?.title ?? '',
      cv_name: docs.cv && cv instanceof File && cv.size ? cv.name : '', has_cv: false,
      id_doc_name: docs.idDoc && idDoc instanceof File && idDoc.size ? idDoc.name : '', has_id_doc: false,
      details: readDetails(g('type') as LeadType, (k) => form.get(k)), status: 'new', notes: '',
      assigned_to: null, assigned_name: '', distributed_to: '', distributed_at: '', created_at: now(), updated_at: now(),
    };
    s.leads.unshift(lead);
    s.events.unshift({ id: s.seq++, lead_id: lead.id, at: now(), by: 'website', action: 'received', detail: 'Submitted on the website' });
    save(s);
  },
  async verify(code) {
    await tick();
    const c = load().certificates.find((x) => x.code === normaliseCode(code));
    return c ? { found: true, code: c.code, holder_name: c.holder_name, programme: c.programme, title: c.title, issue_date: c.issue_date, period_from: c.period_from, period_to: c.period_to, status: c.status } : { found: false };
  },

  async login(email, password) {
    await tick();
    const s = load();
    const u = s.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase() && x.active);
    if (!u || password !== DEMO_PASSWORD) fail(401, 'That email and password don’t match an active account.');
    u!.last_login_at = now();
    s.session = u!.id; save(s); return clone(u!);
  },
  async logout() { const s = load(); s.session = null; save(s); },
  async me() { const s = load(); return clone(s.users.find((x) => x.id === s.session && x.active) ?? null); },
  async changePassword() { await tick(); fail(400, 'Passwords can’t be changed in the demo.'); },

  async staff() { const s = load(); current(s); return s.users.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name, role: u.role })); },

  async leads(f) {
    await tick();
    const s = load(); const u = current(s); const types = leadTypesFor(u.role); need(types.length > 0);
    const counts = Object.fromEntries([['all', 0], ...LEAD_STATUSES.map((x) => [x, 0])]) as LeadPage['counts'];
    for (const l of s.leads) if (leadMatches(l, types, f, u.id, false)) { counts[l.status]++; counts.all++; }
    const rows = s.leads.filter((l) => leadMatches(l, types, f, u.id)).sort(leadSort(f.sort));
    return { ...clone(paginate(rows, f)), counts };
  },
  async lead(id) {
    const s = load(); const u = current(s);
    const l = s.leads.find((x) => x.id === id && leadTypesFor(u.role).includes(x.type));
    if (!l) fail(404, 'Lead not found.');
    return clone(l!);
  },
  async leadEvents(id) { await tick(); const s = load(); current(s); return clone(s.events.filter((e) => e.lead_id === id)); },
  async leadCountries() {
    const s = load(); const types = leadTypesFor(current(s).role);
    return [...new Set(s.leads.filter((l) => types.includes(l.type) && l.country).map((l) => l.country))].sort();
  },
  async updateLead(id, x) {
    await tick();
    const s = load(); const u = current(s);
    const l = s.leads.find((y) => y.id === id && leadTypesFor(u.role).includes(y.type));
    if (!l) fail(404, 'Lead not found.');
    applyLeadUpdate(s, l!, x, u.name);
    save(s); return clone(l!);
  },
  async bulkLeads(ids, a) {
    await tick();
    const s = load(); const u = current(s); const types = leadTypesFor(u.role);
    const targets = s.leads.filter((l) => ids.includes(l.id) && types.includes(l.type));
    if (a.action === 'delete') {
      need(u.role === 'superadmin');
      s.leads = s.leads.filter((l) => !targets.includes(l));
      save(s); return targets.length;
    }
    if (a.action === 'distribute' && !a.value.trim()) fail(400, 'Say who the leads were handed to.');
    const upd: LeadUpdate = a.action === 'status' ? { status: a.value }
      : a.action === 'assign' ? { assigned_to: a.value }
      : { distributed_to: a.value.trim(), status: 'distributed' };
    for (const l of targets) applyLeadUpdate(s, l, upd, u.name);
    save(s); return targets.length;
  },
  async deleteLead(id) { const s = load(); need(current(s).role === 'superadmin'); s.leads = s.leads.filter((l) => l.id !== id); save(s); },
  async leadsCsvUrl(f) {
    const s = load(); const u = current(s); const types = leadTypesFor(u.role);
    const rows = s.leads.filter((l) => leadMatches(l, types, f, u.id)).sort(leadSort(f.sort));
    return csvUrl(['id', 'created_at', 'updated_at', 'type', 'status', 'name', 'email', 'phone', 'country', 'subject', 'ref_title', 'assigned_name', 'distributed_to', 'distributed_at', 'message', 'notes', 'cv_name'], rows);
  },
  cvUrl: () => null,
  idDocUrl: () => null,

  async postings(f: PostingFilter): Promise<PostingPage> {
    await tick();
    const s = load(); const kinds = postingKindsFor(current(s).role); need(kinds.length > 0);
    const base = s.postings.filter((p) => kinds.includes(p.kind) && (!f.kind || p.kind === f.kind)
      && (!f.q || [p.title, p.location, p.summary].join(' ').toLowerCase().includes(f.q.toLowerCase()))
      && ((!f.from && !f.to) || (p.start_date && inRange(p.start_date, f.from, f.to))));
    const counts = { all: base.length, draft: 0, open: 0, closed: 0, archived: 0 };
    base.forEach((p) => counts[p.status]++);
    const rows = base.filter((p) => !f.status || p.status === f.status)
      .map((p) => ({ ...p, applicants: s.leads.filter((l) => l.ref_id === p.id).length }))
      .sort((a, b) => f.sort === 'title' ? a.title.localeCompare(b.title) : f.sort === 'start' ? (a.start_date || '9').localeCompare(b.start_date || '9') : b.updated_at.localeCompare(a.updated_at));
    return { ...clone(paginate(rows, f)), counts };
  },
  async savePosting(p, id) {
    await tick(); const s = load(); const kinds = postingKindsFor(current(s).role);
    if (!p.title.trim()) fail(400, 'Add a title.');
    const existing = id ? s.postings.find((x) => x.id === id) : undefined;
    const kind = existing?.kind ?? p.kind; need(kinds.includes(kind));
    let slug = slugify(p.slug || p.title), n = 2;
    while (s.postings.some((x) => x.kind === kind && x.slug === slug && x.id !== id)) slug = `${slugify(p.slug || p.title)}-${n++}`;
    const rec: Posting = { ...(existing ?? { id: s.seq++, created_at: now() }), ...p, kind, slug, updated_at: now() } as Posting;
    s.postings = existing ? s.postings.map((x) => (x.id === id ? rec : x)) : [rec, ...s.postings];
    save(s); return clone(rec);
  },
  async duplicatePosting(id) {
    const s = load(); const p = s.postings.find((x) => x.id === id);
    if (!p) fail(404, 'Posting not found.');
    return demoApi.savePosting({ ...p!, title: `${p!.title} (copy)`, slug: '', status: 'draft' });
  },
  async bulkPostings(ids, a) {
    await tick(); const s = load(); const kinds = postingKindsFor(current(s).role);
    const hit = s.postings.filter((p) => ids.includes(p.id) && kinds.includes(p.kind));
    if (a.action === 'delete') s.postings = s.postings.filter((p) => !hit.includes(p));
    else hit.forEach((p) => { p.status = a.value; p.updated_at = now(); });
    save(s); return hit.length;
  },
  async deletePosting(id) {
    const s = load(); const kinds = postingKindsFor(current(s).role);
    s.postings = s.postings.filter((p) => !(p.id === id && kinds.includes(p.kind))); save(s);
  },

  async certificates(f) {
    await tick(); const s = load(); need(canManageCertificates(current(s).role));
    const counts = { all: 0, valid: 0, revoked: 0 };
    s.certificates.forEach((c) => { if (certMatches(c, f, false)) { counts[c.status]++; counts.all++; } });
    const rows = s.certificates.filter((c) => certMatches(c, f)).sort((a, b) =>
      f.sort === 'oldest' ? a.issue_date.localeCompare(b.issue_date) : f.sort === 'name' ? a.holder_name.localeCompare(b.holder_name) : f.sort === 'code' ? a.code.localeCompare(b.code) : b.issue_date.localeCompare(a.issue_date));
    return { ...clone(paginate(rows, f)), counts };
  },
  async certificate(id) { const s = load(); need(canManageCertificates(current(s).role)); const c = s.certificates.find((x) => x.id === id); if (!c) fail(404, 'Certificate not found.'); return clone(c!); },
  async certificatesCsvUrl(f) {
    const s = load(); need(canManageCertificates(current(s).role));
    return csvUrl(['code', 'holder_name', 'programme', 'title', 'batch', 'issue_date', 'period_from', 'period_to', 'hours', 'mode', 'grade', 'modules', 'remarks', 'signatory_name', 'signatory_title', 'status', 'revoked_reason', 'issued_by', 'created_at'], s.certificates.filter((c) => certMatches(c, f)));
  },
  async issueCertificate(c) {
    await tick(); const s = load(); const u = current(s); need(canManageCertificates(u.role));
    if (!c.holder_name.trim() || !c.title.trim() || !c.issue_date) fail(400, 'Add the holder name, title and issue date.');
    let code = newCertificateCode(); while (s.certificates.some((x) => x.code === code)) code = newCertificateCode();
    const rec: Certificate = { id: s.seq++, code, ...c, status: 'valid', revoked_reason: '', issued_by: u.name, created_at: now() };
    s.certificates.unshift(rec); save(s); return clone(rec);
  },
  async updateCertificate(id, c) {
    const s = load(); need(canManageCertificates(current(s).role));
    const r = s.certificates.find((x) => x.id === id); if (!r) fail(404, 'Certificate not found.');
    Object.assign(r!, c); save(s); return clone(r!);
  },
  async revokeCertificate(id, reason) {
    const s = load(); need(canManageCertificates(current(s).role));
    if (!reason.trim()) fail(400, 'Give a reason. It stays in the record, not on the public check.');
    const r = s.certificates.find((x) => x.id === id); if (!r) fail(404, 'Certificate not found.');
    r!.status = 'revoked'; r!.revoked_reason = reason; save(s); return clone(r!);
  },
  async restoreCertificate(id) {
    const s = load(); need(canManageCertificates(current(s).role));
    const r = s.certificates.find((x) => x.id === id); if (!r) fail(404, 'Certificate not found.');
    r!.status = 'valid'; r!.revoked_reason = ''; save(s); return clone(r!);
  },
  async bulkCertificates(ids, a) {
    await tick(); const s = load(); need(canManageCertificates(current(s).role));
    if (a.action === 'revoke' && !a.reason.trim()) fail(400, 'Give a reason. It stays in the record, not on the public check.');
    const hit = s.certificates.filter((c) => ids.includes(c.id));
    hit.forEach((c) => { c.status = a.action === 'revoke' ? 'revoked' : 'valid'; c.revoked_reason = a.action === 'revoke' ? a.reason : ''; });
    save(s); return hit.length;
  },

  async users() { await tick(); const s = load(); need(canManageUsers(current(s).role)); return clone(s.users); },
  async createUser(x) {
    await tick(); const s = load(); need(canManageUsers(current(s).role));
    if (s.users.some((u) => u.email.toLowerCase() === x.email.toLowerCase())) fail(409, 'An account with that email already exists.');
    const rec: User = { id: s.seq++, email: x.email, name: x.name, role: x.role, perms: cleanPerms(x.perms), active: true, created_at: now(), last_login_at: '' };
    s.users.push(rec); save(s); return clone(rec);
  },
  async updateUser(id, x) {
    await tick(); const s = load(); need(canManageUsers(current(s).role));
    const r = s.users.find((u) => u.id === id); if (!r) fail(404, 'User not found.');
    const supers = s.users.filter((u) => u.role === 'superadmin' && u.active).length;
    if (r!.role === 'superadmin' && r!.active && ((x.role && x.role !== 'superadmin') || x.active === false) && supers <= 1) fail(400, 'Keep at least one active superadmin.');
    if (x.name !== undefined) r!.name = x.name; if (x.role) r!.role = x.role; if (x.active !== undefined) r!.active = x.active;
    if (x.perms !== undefined) r!.perms = cleanPerms(x.perms);
    save(s); return clone(r!);
  },

  // Mailboxes: kept in their own key so the main demo store doesn't need a version bump.
  async mailboxes() {
    await tick(); need(canManageMailboxes(current(load()).role));
    return clone(mailLoad());
  },
  async createMailbox(local, password, name = '') {
    await tick(); need(canManageMailboxes(current(load()).role));
    const address = mailAddress(local), m = mailLoad();
    const e = mailAddressError(address) || mailPasswordError(password) || mailNameError(name.trim()); if (e) fail(400, e);
    if (m.mailboxes.some((x) => x.address === address)) fail(409, `${address} already exists.`);
    if (m.aliases.some((x) => x.from === address)) fail(409, `${address} is already an alias.`);
    m.mailboxes.push({ address, name: name.trim(), size_bytes: 0, created: new Date().toISOString(), core: false });
    m.mailboxes.sort((a, b) => a.address.localeCompare(b.address)); mailSave(m); return address;
  },
  async setMailboxPassword(address, password) {
    await tick(); need(canManageMailboxes(current(load()).role));
    const e = mailPasswordError(password); if (e) fail(400, e);
    if (!mailLoad().mailboxes.some((x) => x.address === address)) fail(404, `${address} doesn't exist.`);
  },
  async setMailboxName(address, name) {
    await tick(); need(canManageMailboxes(current(load()).role));
    const e = mailNameError(name.trim()); if (e) fail(400, e);
    const m = mailLoad(); const box = m.mailboxes.find((x) => x.address === address);
    if (!box) fail(404, `${address} doesn't exist.`);
    box!.name = name.trim(); mailSave(m);
  },
  async saveWebmailSettings(x) {
    await tick(); need(canManageMailboxes(current(load()).role));
    const m = mailLoad(); m.settings = cleanWebmailSettings(x); mailSave(m); return clone(m.settings);
  },
  async deleteMailbox(address) {
    await tick(); need(canManageMailboxes(current(load()).role));
    const m = mailLoad();
    if (!m.mailboxes.some((x) => x.address === address)) fail(404, `${address} doesn't exist.`);
    m.mailboxes = m.mailboxes.filter((x) => x.address !== address); mailSave(m);
  },
};

const MAIL_KEY = 'mb-demo-mail-v2';
function mailLoad(): MailboxList {
  try { const raw = localStorage.getItem(MAIL_KEY); if (raw) return JSON.parse(raw); } catch { /* storage blocked: fall back to the seed */ }
  const t = ago(120);
  const sizes: Record<string, number> = { connect: 48_200_000, support: 6_900_000, careers: 21_400_000, intern: 13_100_000 };
  return {
    available: true, mode: 'demo', domain: MAIL_DOMAIN, webmail: `https://mail.${MAIL_DOMAIN}`,
    mailboxes: CORE_MAILBOXES.map((l) => ({ address: `${l}@${MAIL_DOMAIN}`, name: `Mechbridge ${l[0].toUpperCase()}${l.slice(1)}`, size_bytes: sizes[l] ?? 0, created: t.replace(' ', 'T') + 'Z', core: true })),
    settings: cleanWebmailSettings({}),
    aliases: ['postmaster', 'abuse', 'info'].map((l) => ({ from: `${l}@${MAIL_DOMAIN}`, to: `connect@${MAIL_DOMAIN}` })),
  };
}
const mailSave = (m: MailboxList) => { try { localStorage.setItem(MAIL_KEY, JSON.stringify(m)); } catch { /* ignore */ } };

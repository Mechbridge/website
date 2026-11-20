// Server-only data access. Never import this from client code.
import { openDb, hashPassword, verifyPassword } from './core.mjs';
import { createHash, randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type {
  CertFilter, CertPage, Certificate, CertificateInput, Lead, LeadEvent, LeadFilter, LeadPage, LeadStatus, LeadType, LeadUpdate,
  Perm, Posting, PostingFilter, PostingInput, PostingKind, PostingPage, PostingStatus, Role, StaffRef, User,
} from '../lib/api/types';
import { CERT_DETAIL_FIELDS } from '../lib/api/types';
import { LEAD_STATUSES, cleanPerms, newCertificateCode, normaliseCode, slugify } from '../lib/roles';

let _db: DatabaseSync | null = null;
export const db = () => (_db ??= openDb());

type Row = Record<string, unknown>;
const all = (sql: string, ...p: unknown[]) => db().prepare(sql).all(...(p as never[])) as Row[];
const get = (sql: string, ...p: unknown[]) => db().prepare(sql).get(...(p as never[])) as Row | undefined;
const run = (sql: string, ...p: unknown[]) => db().prepare(sql).run(...(p as never[]));
const qs = (n: number) => Array(n).fill('?').join(',');

/* ---------------- paging helpers ---------------- */
export const MAX_PAGE = 100;
function paging(f: { page?: number; pageSize?: number }) {
  const pageSize = Math.min(MAX_PAGE, Math.max(1, Number(f.pageSize) || 25));
  const page = Math.max(1, Number(f.page) || 1);
  return { page, pageSize, offset: (page - 1) * pageSize };
}
// Inclusive date range on a 'YYYY-MM-DD HH:MM:SS' or 'YYYY-MM-DD' column.
function dateRange(col: string, from?: string, to?: string) {
  const where: string[] = [], params: unknown[] = [];
  const ok = (d?: string) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (ok(from)) { where.push(`substr(${col}, 1, 10) >= ?`); params.push(from); }
  if (ok(to)) { where.push(`substr(${col}, 1, 10) <= ?`); params.push(to); }
  return { where, params };
}

/* ---------------- users & sessions ---------------- */
const toUser = (r: Row): User => ({
  id: Number(r.id), email: String(r.email), name: String(r.name), role: r.role as Role, perms: cleanPerms(r.perms ?? ''), active: !!r.active,
  created_at: String(r.created_at), last_login_at: String(r.last_login_at ?? ''),
});

export const SESSION_DAYS = 7;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

export function login(email: string, password: string): { token: string; user: User } | null {
  const r = get('SELECT * FROM users WHERE email = ? AND active = 1', email.trim());
  if (!r || !verifyPassword(password, String(r.pw_hash))) return null;
  const token = randomBytes(32).toString('base64url');
  const exp = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  run('DELETE FROM sessions WHERE expires_at < ?', new Date().toISOString());
  run('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', sha(token), r.id, exp);
  run(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`, r.id);
  return { token, user: toUser(get('SELECT * FROM users WHERE id = ?', r.id)!) };
}
export function sessionUser(token: string | undefined): User | null {
  if (!token) return null;
  const r = get(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`,
    sha(token), new Date().toISOString(),
  );
  return r ? toUser(r) : null;
}
export const logout = (token: string) => run('DELETE FROM sessions WHERE token_hash = ?', sha(token));

export const listUsers = () => all('SELECT * FROM users ORDER BY active DESC, name').map(toUser);
export const listStaff = (): StaffRef[] => all('SELECT id, name, role FROM users WHERE active = 1 ORDER BY name').map((r) => ({ id: Number(r.id), name: String(r.name), role: r.role as Role }));
export function createUser(u: { email: string; name: string; role: Role; password: string; perms?: Perm[] }) {
  const r = run('INSERT INTO users (email, name, role, pw_hash, perms) VALUES (?, ?, ?, ?, ?)', u.email.trim(), u.name.trim(), u.role, hashPassword(u.password), (u.perms ?? []).join(','));
  return toUser(get('SELECT * FROM users WHERE id = ?', r.lastInsertRowid)!);
}
export function updateUser(id: number, u: { name?: string; role?: Role; active?: boolean; password?: string; perms?: Perm[] }) {
  if (u.name !== undefined) run('UPDATE users SET name = ? WHERE id = ?', u.name.trim(), id);
  if (u.perms !== undefined) run('UPDATE users SET perms = ? WHERE id = ?', u.perms.join(','), id);
  if (u.role !== undefined) run('UPDATE users SET role = ? WHERE id = ?', u.role, id);
  if (u.active !== undefined) {
    run('UPDATE users SET active = ? WHERE id = ?', u.active ? 1 : 0, id);
    if (!u.active) run('DELETE FROM sessions WHERE user_id = ?', id);
  }
  if (u.password) {
    run('UPDATE users SET pw_hash = ? WHERE id = ?', hashPassword(u.password), id);
    run('DELETE FROM sessions WHERE user_id = ?', id);
  }
  const r = get('SELECT * FROM users WHERE id = ?', id);
  return r ? toUser(r) : null;
}
export const checkPassword = (id: number, pw: string) => {
  const r = get('SELECT pw_hash FROM users WHERE id = ?', id);
  return !!r && verifyPassword(pw, String(r.pw_hash));
};
export const activeSuperadmins = () => Number(get(`SELECT COUNT(*) n FROM users WHERE role = 'superadmin' AND active = 1`)?.n ?? 0);

/* ---------------- postings ---------------- */
const toPosting = (r: Row): Posting => ({
  id: Number(r.id), kind: r.kind as PostingKind, title: String(r.title), slug: String(r.slug), location: String(r.location),
  mode: String(r.mode), start_date: String(r.start_date), summary: String(r.summary), body: String(r.body),
  status: r.status as PostingStatus, created_at: String(r.created_at), updated_at: String(r.updated_at),
  ...(r.applicants !== undefined ? { applicants: Number(r.applicants) } : {}),
});
// Public listing: every open posting, then the most recent closed ones (shown as no longer available).
export const PUBLIC_CLOSED_LIMIT = 6;
export const listOpenPostings = (kind: PostingKind) => [
  ...all(`SELECT * FROM postings WHERE kind = ? AND status = 'open' ORDER BY (start_date = ''), start_date, created_at DESC`, kind),
  ...all(`SELECT * FROM postings WHERE kind = ? AND status = 'closed' ORDER BY updated_at DESC LIMIT ?`, kind, PUBLIC_CLOSED_LIMIT),
].map(toPosting);
export const getOpenPosting = (kind: PostingKind, slug: string) => {
  const r = get(`SELECT * FROM postings WHERE kind = ? AND slug = ? AND status IN ('open','closed')`, kind, slug);
  return r ? toPosting(r) : null;
};
export const getPosting = (id: number) => { const r = get('SELECT * FROM postings WHERE id = ?', id); return r ? toPosting(r) : null; };

export function pagePostings(kinds: PostingKind[], f: PostingFilter): PostingPage {
  const { page, pageSize, offset } = paging(f);
  const allowed = f.kind ? kinds.filter((k) => k === f.kind) : kinds;
  const empty = { rows: [], total: 0, page, pageSize, counts: { all: 0, draft: 0, open: 0, closed: 0, archived: 0 } };
  if (!allowed.length) return empty;
  const where = [`p.kind IN (${qs(allowed.length)})`];
  const params: unknown[] = [...allowed];
  if (f.q) { where.push('(p.title LIKE ? OR p.location LIKE ? OR p.summary LIKE ?)'); const q = `%${f.q}%`; params.push(q, q, q); }
  const dr = dateRange('p.start_date', f.from, f.to);
  where.push(...dr.where); params.push(...dr.params);
  const base = where.join(' AND ');
  const counts = { ...empty.counts };
  for (const r of all(`SELECT p.status s, COUNT(*) n FROM postings p WHERE ${base} GROUP BY p.status`, ...params)) {
    counts[r.s as PostingStatus] = Number(r.n); counts.all += Number(r.n);
  }
  const statusSql = f.status ? ' AND p.status = ?' : '';
  const sp = f.status ? [...params, f.status] : params;
  const order = { start: `(p.start_date = ''), p.start_date`, title: 'p.title COLLATE NOCASE', created: 'p.created_at DESC' }[f.sort ?? ''] ?? 'p.updated_at DESC';
  const total = Number(get(`SELECT COUNT(*) n FROM postings p WHERE ${base}${statusSql}`, ...sp)?.n ?? 0);
  const rows = all(
    `SELECT p.*, (SELECT COUNT(*) FROM leads l WHERE l.ref_id = p.id) applicants FROM postings p WHERE ${base}${statusSql} ORDER BY ${order} LIMIT ? OFFSET ?`,
    ...sp, pageSize, offset,
  ).map(toPosting);
  return { rows, total, page, pageSize, counts };
}

function uniqueSlug(kind: PostingKind, base: string, exceptId?: number) {
  let slug = slugify(base), n = 2;
  while (get('SELECT id FROM postings WHERE kind = ? AND slug = ? AND id IS NOT ?', kind, slug, exceptId ?? null)) slug = `${slugify(base)}-${n++}`;
  return slug;
}
export function savePosting(p: PostingInput, id?: number) {
  const slug = uniqueSlug(p.kind, p.slug || p.title, id);
  if (id) {
    run(`UPDATE postings SET title=?, slug=?, location=?, mode=?, start_date=?, summary=?, body=?, status=?, updated_at=datetime('now') WHERE id=?`,
      p.title, slug, p.location, p.mode, p.start_date, p.summary, p.body, p.status, id);
    return getPosting(id)!;
  }
  const r = run(`INSERT INTO postings (kind, title, slug, location, mode, start_date, summary, body, status) VALUES (?,?,?,?,?,?,?,?,?)`,
    p.kind, p.title, slug, p.location, p.mode, p.start_date, p.summary, p.body, p.status);
  return getPosting(Number(r.lastInsertRowid))!;
}
export function duplicatePosting(id: number) {
  const p = getPosting(id);
  if (!p) return null;
  return savePosting({ ...p, title: `${p.title} (copy)`, slug: '', status: 'draft' });
}
export const deletePosting = (id: number) => run('DELETE FROM postings WHERE id = ?', id);
export function bulkPostings(ids: number[], kinds: PostingKind[], action: 'status' | 'delete', value?: PostingStatus) {
  if (!ids.length || !kinds.length) return 0;
  const scope = `id IN (${qs(ids.length)}) AND kind IN (${qs(kinds.length)})`;
  const r = action === 'delete'
    ? run(`DELETE FROM postings WHERE ${scope}`, ...ids, ...kinds)
    : run(`UPDATE postings SET status = ?, updated_at = datetime('now') WHERE ${scope}`, value, ...ids, ...kinds);
  return Number(r.changes);
}

/* ---------------- leads ---------------- */
const LEAD_SELECT = `SELECT l.*, COALESCE(u.name, '') assigned_name FROM leads l LEFT JOIN users u ON u.id = l.assigned_to`;
const toLead = (r: Row): Lead => ({
  id: Number(r.id), type: r.type as LeadType, name: String(r.name), email: String(r.email), phone: String(r.phone),
  country: String(r.country), subject: String(r.subject), message: String(r.message), ref_id: r.ref_id == null ? null : Number(r.ref_id),
  ref_title: String(r.ref_title), cv_name: String(r.cv_name), has_cv: !!r.cv_path, status: r.status as LeadStatus,
  notes: String(r.notes), assigned_to: r.assigned_to == null ? null : Number(r.assigned_to), assigned_name: String(r.assigned_name ?? ''),
  distributed_to: String(r.distributed_to ?? ''), distributed_at: String(r.distributed_at ?? ''),
  created_at: String(r.created_at), updated_at: String(r.updated_at ?? r.created_at),
});

export function createLead(l: Omit<Lead, 'id' | 'has_cv' | 'status' | 'notes' | 'created_at' | 'updated_at' | 'assigned_to' | 'assigned_name' | 'distributed_to' | 'distributed_at'> & { cv_path?: string }) {
  const r = run(`INSERT INTO leads (type, name, email, phone, country, subject, message, ref_id, ref_title, cv_name, cv_path) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    l.type, l.name, l.email, l.phone, l.country, l.subject, l.message, l.ref_id, l.ref_title, l.cv_name, l.cv_path ?? '');
  const id = Number(r.lastInsertRowid);
  logLead(id, 'website', 'received', 'Submitted on the website');
  return id;
}

// WHERE clause for a lead filter. `withStatus` false is used for the status tab counts.
function leadWhere(types: LeadType[], f: LeadFilter, me: number, withStatus = true) {
  const allowed = f.type ? types.filter((t) => t === f.type) : types;
  const where = [`l.type IN (${qs(Math.max(allowed.length, 1))})`];
  const params: unknown[] = allowed.length ? [...allowed] : ['__none__'];
  if (withStatus && f.status === 'open') where.push(`l.status NOT IN ('converted','closed')`);
  else if (withStatus && f.status) { where.push('l.status = ?'); params.push(f.status); }
  if (f.q) { where.push('(l.name LIKE ? OR l.email LIKE ? OR l.phone LIKE ? OR l.message LIKE ? OR l.ref_title LIKE ? OR l.subject LIKE ? OR l.distributed_to LIKE ?)'); const q = `%${f.q}%`; params.push(q, q, q, q, q, q, q); }
  if (f.country) { where.push('l.country = ?'); params.push(f.country); }
  if (f.cv === '1') where.push(`l.cv_path <> ''`);
  if (f.cv === '0') where.push(`l.cv_path = ''`);
  if (f.ref) { where.push('l.ref_id = ?'); params.push(Number(f.ref)); }
  if (f.assigned === 'me') { where.push('l.assigned_to = ?'); params.push(me); }
  else if (f.assigned === 'none') where.push('l.assigned_to IS NULL');
  else if (f.assigned) { where.push('l.assigned_to = ?'); params.push(Number(f.assigned)); }
  if (f.ids?.length) { where.push(`l.id IN (${qs(f.ids.length)})`); params.push(...f.ids); }
  const dr = dateRange('l.created_at', f.from, f.to);
  where.push(...dr.where); params.push(...dr.params);
  return { sql: where.join(' AND '), params };
}
const LEAD_ORDER: Record<string, string> = { oldest: 'l.created_at ASC', updated: 'l.updated_at DESC', name: 'l.name COLLATE NOCASE' };

export function pageLeads(types: LeadType[], f: LeadFilter, me: number): LeadPage {
  const { page, pageSize, offset } = paging(f);
  const counts = Object.fromEntries([['all', 0], ...LEAD_STATUSES.map((s) => [s, 0])]) as LeadPage['counts'];
  const c = leadWhere(types, f, me, false);
  for (const r of all(`SELECT l.status s, COUNT(*) n FROM leads l WHERE ${c.sql} GROUP BY l.status`, ...c.params)) {
    counts[r.s as LeadStatus] = Number(r.n); counts.all += Number(r.n);
  }
  const w = leadWhere(types, f, me);
  const total = Number(get(`SELECT COUNT(*) n FROM leads l WHERE ${w.sql}`, ...w.params)?.n ?? 0);
  const rows = all(`${LEAD_SELECT} WHERE ${w.sql} ORDER BY ${LEAD_ORDER[f.sort ?? ''] ?? 'l.created_at DESC'} LIMIT ? OFFSET ?`, ...w.params, pageSize, offset).map(toLead);
  return { rows, total, page, pageSize, counts };
}
// CSV export: every matching row (or just the selected ids), capped for safety.
export function exportLeads(types: LeadType[], f: LeadFilter, me: number) {
  const w = leadWhere(types, f, me);
  return all(`${LEAD_SELECT} WHERE ${w.sql} ORDER BY l.created_at DESC LIMIT 20000`, ...w.params).map(toLead);
}
export const leadCountries = (types: LeadType[]) =>
  types.length ? all(`SELECT DISTINCT country FROM leads WHERE type IN (${qs(types.length)}) AND country <> '' ORDER BY country`, ...types).map((r) => String(r.country)) : [];

export function getLeadRow(id: number) { return get('SELECT * FROM leads WHERE id = ?', id); }
export function getLead(id: number) { const r = get(`${LEAD_SELECT} WHERE l.id = ?`, id); return r ? toLead(r) : null; }

export function logLead(id: number, by: string, action: string, detail = '') {
  run('INSERT INTO lead_events (lead_id, by, action, detail) VALUES (?, ?, ?, ?)', id, by, action, detail);
}
export const leadEvents = (id: number): LeadEvent[] =>
  all('SELECT * FROM lead_events WHERE lead_id = ? ORDER BY id DESC LIMIT 200', id).map((r) => ({
    id: Number(r.id), lead_id: Number(r.lead_id), at: String(r.at), by: String(r.by), action: String(r.action), detail: String(r.detail),
  }));

const staffName = (id: number | null) => (id == null ? 'nobody' : String(get('SELECT name FROM users WHERE id = ?', id)?.name ?? `user ${id}`));

export function updateLead(id: number, u: LeadUpdate, by: string) {
  const before = getLead(id);
  if (!before) return null;
  if (u.status && u.status !== before.status) {
    run(`UPDATE leads SET status = ?, updated_at = datetime('now') WHERE id = ?`, u.status, id);
    logLead(id, by, 'status', `${before.status} → ${u.status}`);
  }
  if (u.distributed_to !== undefined && u.distributed_to !== before.distributed_to) {
    run(`UPDATE leads SET distributed_to = ?, distributed_at = CASE WHEN ? = '' THEN '' ELSE datetime('now') END, updated_at = datetime('now') WHERE id = ?`, u.distributed_to, u.distributed_to, id);
    logLead(id, by, 'distributed', u.distributed_to ? `Handed to ${u.distributed_to}` : 'Distribution cleared');
  }
  if (u.assigned_to !== undefined && u.assigned_to !== before.assigned_to) {
    run(`UPDATE leads SET assigned_to = ?, updated_at = datetime('now') WHERE id = ?`, u.assigned_to, id);
    logLead(id, by, 'assigned', `Assigned to ${staffName(u.assigned_to)}`);
  }
  if (u.notes !== undefined && u.notes !== before.notes) {
    run(`UPDATE leads SET notes = ?, updated_at = datetime('now') WHERE id = ?`, u.notes, id);
    logLead(id, by, 'notes', 'Internal notes updated');
  }
  return getLead(id);
}
// Applies one update to many leads, each logged in its own history. Returns how many changed.
export function bulkUpdateLeads(ids: number[], types: LeadType[], u: LeadUpdate, by: string) {
  let n = 0;
  const d = db();
  d.exec('BEGIN');
  try {
    for (const id of ids) {
      const row = getLeadRow(id);
      if (!row || !types.includes(row.type as LeadType)) continue;
      updateLead(id, u, by);
      n++;
    }
    d.exec('COMMIT');
  } catch (e) { d.exec('ROLLBACK'); throw e; }
  return n;
}
export const deleteLead = (id: number) => run('DELETE FROM leads WHERE id = ?', id);

/* ---------------- certificates ---------------- */
const toCert = (r: Row): Certificate => ({
  id: Number(r.id), code: String(r.code), holder_name: String(r.holder_name), programme: r.programme as Certificate['programme'],
  title: String(r.title), batch: String(r.batch), issue_date: String(r.issue_date), status: r.status as Certificate['status'],
  revoked_reason: String(r.revoked_reason), issued_by: String(r.issued_by), created_at: String(r.created_at),
  ...(Object.fromEntries(CERT_DETAIL_FIELDS.map((k) => [k, String(r[k] ?? '')])) as Pick<Certificate, (typeof CERT_DETAIL_FIELDS)[number]>),
});
function certWhere(f: CertFilter, withStatus = true) {
  const where = ['1=1'], params: unknown[] = [];
  if (f.q) { where.push('(code LIKE ? OR holder_name LIKE ? OR batch LIKE ? OR title LIKE ?)'); const q = `%${f.q}%`; params.push(q, q, q, q); }
  if (f.programme) { where.push('programme = ?'); params.push(f.programme); }
  if (withStatus && f.status) { where.push('status = ?'); params.push(f.status); }
  if (f.ids?.length) { where.push(`id IN (${qs(f.ids.length)})`); params.push(...f.ids); }
  const dr = dateRange('issue_date', f.from, f.to);
  where.push(...dr.where); params.push(...dr.params);
  return { sql: where.join(' AND '), params };
}
export function pageCertificates(f: CertFilter): CertPage {
  const { page, pageSize, offset } = paging(f);
  const counts = { all: 0, valid: 0, revoked: 0 };
  const c = certWhere(f, false);
  for (const r of all(`SELECT status s, COUNT(*) n FROM certificates WHERE ${c.sql} GROUP BY status`, ...c.params)) {
    counts[r.s as 'valid'] = Number(r.n); counts.all += Number(r.n);
  }
  const w = certWhere(f);
  const order = { oldest: 'issue_date ASC, id ASC', name: 'holder_name COLLATE NOCASE', code: 'code' }[f.sort ?? ''] ?? 'issue_date DESC, id DESC';
  const total = Number(get(`SELECT COUNT(*) n FROM certificates WHERE ${w.sql}`, ...w.params)?.n ?? 0);
  const rows = all(`SELECT * FROM certificates WHERE ${w.sql} ORDER BY ${order} LIMIT ? OFFSET ?`, ...w.params, pageSize, offset).map(toCert);
  return { rows, total, page, pageSize, counts };
}
export const exportCertificates = (f: CertFilter) => { const w = certWhere(f); return all(`SELECT * FROM certificates WHERE ${w.sql} ORDER BY issue_date DESC LIMIT 20000`, ...w.params).map(toCert); };
export const getCertificate = (id: number) => { const r = get('SELECT * FROM certificates WHERE id = ?', id); return r ? toCert(r) : null; };
export function issueCertificate(c: CertificateInput, issuedBy: string) {
  let code = newCertificateCode();
  while (get('SELECT id FROM certificates WHERE code = ?', code)) code = newCertificateCode();
  const r = run(`INSERT INTO certificates (code, holder_name, programme, title, batch, issue_date, issued_by, ${CERT_DETAIL_FIELDS.join(', ')}) VALUES (?,?,?,?,?,?,?,${qs(CERT_DETAIL_FIELDS.length)})`,
    code, c.holder_name, c.programme, c.title, c.batch, c.issue_date, issuedBy, ...CERT_DETAIL_FIELDS.map((k) => c[k] ?? ''));
  return getCertificate(Number(r.lastInsertRowid))!;
}
export function updateCertificate(id: number, c: CertificateInput) {
  run(`UPDATE certificates SET holder_name=?, programme=?, title=?, batch=?, issue_date=?, ${CERT_DETAIL_FIELDS.map((k) => `${k}=?`).join(', ')} WHERE id=?`,
    c.holder_name, c.programme, c.title, c.batch, c.issue_date, ...CERT_DETAIL_FIELDS.map((k) => c[k] ?? ''), id);
  return getCertificate(id);
}
export function setCertificateStatus(id: number, status: 'valid' | 'revoked', reason = '') {
  run('UPDATE certificates SET status = ?, revoked_reason = ? WHERE id = ?', status, status === 'revoked' ? reason : '', id);
  return getCertificate(id);
}
export function bulkCertificates(ids: number[], status: 'valid' | 'revoked', reason = '') {
  if (!ids.length) return 0;
  return Number(run(`UPDATE certificates SET status = ?, revoked_reason = ? WHERE id IN (${qs(ids.length)})`, status, status === 'revoked' ? reason : '', ...ids).changes);
}
export function verifyCertificate(code: string) {
  const r = get('SELECT * FROM certificates WHERE code = ?', normaliseCode(code));
  if (!r) return { found: false };
  const c = toCert(r);
  return { found: true, code: c.code, holder_name: c.holder_name, programme: c.programme, title: c.title, issue_date: c.issue_date, period_from: c.period_from, period_to: c.period_to, status: c.status };
}

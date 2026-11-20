// Production API (VPS only). Injected at /api/[...path] by astro.config.mjs when DEMO is not set.
import type { APIContext, APIRoute } from 'astro';
import { writeFile, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { dataDir, MIN_PASSWORD } from './core.mjs';
import * as D from './db';
import { notifyLead } from './notify';
import type { LeadType, LeadFilter, LeadStatus, LeadUpdate, PostingKind, Role, User, PostingInput, CertificateInput } from '../lib/api/types';
import { canManageCertificates, canManageUsers, leadTypesFor, postingKindsFor, LEAD_TYPE_LABELS, LEAD_STATUSES } from '../lib/roles';

export const prerender = false;

const COOKIE = 'mb_session';
const LEAD_TYPES: LeadType[] = ['consultancy', 'contact', 'training', 'internship', 'job', 'support'];
const KINDS: PostingKind[] = ['job', 'internship', 'training'];
const ROLES: Role[] = ['superadmin', 'hr', 'training', 'sales'];
const CV_EXT = ['.pdf', '.doc', '.docx'];
const CV_MAX = 5 * 1024 * 1024;

class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const fail = (status: number, msg: string): never => { throw new HttpError(status, msg); };

/* ---------- small helpers ---------- */
const str = (v: unknown, max = 5000) => String(v ?? '').trim().slice(0, max);
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const isDate = (s: string) => s === '' || /^\d{4}-\d{2}-\d{2}$/.test(s);
const ip = (ctx: APIContext) => ctx.request.headers.get('x-forwarded-for')?.split(',')[0].trim() || ctx.clientAddress || 'unknown';

const buckets = new Map<string, { n: number; reset: number }>();
function limit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) { buckets.set(key, { n: 1, reset: now + windowMs }); return; }
  if (++b.n > max) fail(429, 'Too many attempts. Wait a few minutes and try again.');
}

function sameOrigin(ctx: APIContext) {
  const origin = ctx.request.headers.get('origin');
  if (!origin) return true; // non-browser clients (curl) carry no cookies by default
  const host = ctx.request.headers.get('x-forwarded-host') || ctx.request.headers.get('host');
  try { return new URL(origin).host === host; } catch { return false; }
}

function requireUser(ctx: APIContext): User {
  const user = D.sessionUser(ctx.cookies.get(COOKIE)?.value);
  if (!user) fail(401, 'Your session has ended. Log in again.');
  return user!;
}
const need = (ok: boolean) => { if (!ok) fail(403, "Your role doesn't allow this."); };
const body = async (ctx: APIContext) => { try { return (await ctx.request.json()) as Record<string, unknown>; } catch { return fail(400, 'Send a JSON body.'); } };

function postingInput(b: Record<string, unknown>): PostingInput {
  const kind = str(b.kind) as PostingKind;
  if (!KINDS.includes(kind)) fail(400, 'Unknown posting type.');
  const p: PostingInput = {
    kind, title: str(b.title, 160), slug: str(b.slug, 80), location: str(b.location, 120), mode: str(b.mode, 60),
    start_date: str(b.start_date, 10), summary: str(b.summary, 400), body: str(b.body, 20000),
    status: (['draft', 'open', 'closed'].includes(str(b.status)) ? str(b.status) : 'draft') as PostingInput['status'],
  };
  if (!p.title) fail(400, 'Add a title.');
  if (!isDate(p.start_date)) fail(400, 'Use a date like 2027-01-15, or leave it empty.');
  return p;
}
function certInput(b: Record<string, unknown>): CertificateInput {
  const c: CertificateInput = {
    holder_name: str(b.holder_name, 120), programme: (str(b.programme) === 'internship' ? 'internship' : 'training'),
    title: str(b.title, 160), batch: str(b.batch, 80), issue_date: str(b.issue_date, 10),
  };
  if (!c.holder_name) fail(400, "Add the holder's full name as it should appear on the certificate.");
  if (!c.title) fail(400, 'Add the course or internship title.');
  if (!c.issue_date || !isDate(c.issue_date)) fail(400, 'Add the issue date, like 2027-01-15.');
  return c;
}


const today = () => new Date().toISOString().slice(0, 10);
const idList = (v: unknown) => (Array.isArray(v) ? v : []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 1000);
const leadStatus = (v: unknown): LeadStatus => {
  const s = str(v);
  if (!(LEAD_STATUSES as readonly string[]).includes(s)) fail(400, 'Unknown lead status.');
  return s as LeadStatus;
};
const assignee = (v: unknown): number | null => {
  if (v === null || v === '' || v === undefined) return null;
  const n = Number(v);
  if (!D.listStaff().some((s) => s.id === n)) fail(400, 'Choose an active staff member.');
  return n;
};
function leadFilter(sp: URLSearchParams): LeadFilter {
  const g = (k: string) => sp.get(k) ?? '';
  return {
    type: g('type') as LeadType, status: g('status') as LeadStatus, q: g('q'), from: g('from'), to: g('to'), country: g('country'),
    cv: g('cv') as '', ref: g('ref'), assigned: g('assigned'), sort: g('sort'),
    ids: g('ids') ? idList(g('ids').split(',')) : undefined, page: Number(g('page')), pageSize: Number(g('pageSize')),
  };
}
function csv<T extends object>(file: string, cols: readonly string[], rows: T[]) {
  const esc = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const out = [cols.join(','), ...rows.map((r) => cols.map((k) => esc((r as Record<string, unknown>)[k])).join(','))].join('\r\n');
  return new Response('\ufeff' + out, {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="' + file + '"', 'cache-control': 'no-store' },
  });
}

/* ---------- handlers ---------- */
async function handle(ctx: APIContext, parts: string[], method: string): Promise<Response> {
  const [a, b, c, d] = parts;
  if (method !== 'GET' && !sameOrigin(ctx)) fail(403, 'Cross-site request refused.');

  /* public */
  if (a === 'postings' && method === 'GET') {
    if (!b) {
      const kind = ctx.url.searchParams.get('kind') as PostingKind;
      if (!KINDS.includes(kind)) fail(400, 'Unknown posting type.');
      return json(D.listOpenPostings(kind));
    }
    const p = D.getOpenPosting(b as PostingKind, c ?? '');
    return p ? json(p) : fail(404, 'This posting is closed or no longer exists.');
  }

  if (a === 'verify' && method === 'GET') {
    limit(`verify:${ip(ctx)}`, 60, 60_000);
    const code = ctx.url.searchParams.get('code') ?? '';
    return json(code ? D.verifyCertificate(code) : { found: false });
  }

  if (a === 'leads' && method === 'POST') {
    limit(`lead:${ip(ctx)}`, 20, 3_600_000);
    const fd = await ctx.request.formData().catch(() => fail(400, 'Send the form as multipart/form-data.'));
    if (str(fd.get('botcheck'))) return json({ ok: true }); // honeypot
    const type = str(fd.get('type')) as LeadType;
    if (!LEAD_TYPES.includes(type)) fail(400, 'Choose what your message is about.');
    const lead = {
      type, name: str(fd.get('name'), 120), email: str(fd.get('email'), 160), phone: str(fd.get('phone'), 40),
      country: str(fd.get('country'), 80), subject: str(fd.get('subject'), 200), message: str(fd.get('message'), 5000),
      ref_id: null as number | null, ref_title: '', cv_name: '', cv_path: '',
    };
    if (!lead.name) fail(400, 'Add your name.');
    if (!isEmail(lead.email)) fail(400, 'Enter an email address we can reply to.');
    if (lead.message.length < 10) fail(400, 'Tell us a little more, at least a sentence.');
    const refId = Number(fd.get('ref_id'));
    if (refId) { const p = D.getPosting(refId); if (p) { lead.ref_id = p.id; lead.ref_title = p.title; } }
    const cv = fd.get('cv');
    if (cv instanceof File && cv.size > 0) {
      const ext = path.extname(cv.name).toLowerCase();
      if (!CV_EXT.includes(ext)) fail(400, 'Attach your CV as a PDF or Word file.');
      if (cv.size > CV_MAX) fail(400, 'Your CV is over 5 MB. Attach a smaller file.');
      const file = `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`;
      await writeFile(path.join(dataDir(), 'uploads', file), Buffer.from(await cv.arrayBuffer()));
      lead.cv_name = cv.name.slice(0, 160);
      lead.cv_path = file;
    }
    const id = D.createLead(lead);
    notifyLead({ ...lead, id, label: LEAD_TYPE_LABELS[type] }).catch((e) => console.error('[notify]', e.message));
    return json({ ok: true, id }, 201);
  }

  /* auth */
  if (a === 'auth') {
    if (b === 'login' && method === 'POST') {
      const x = await body(ctx);
      const email = str(x.email, 160).toLowerCase();
      limit(`login:${ip(ctx)}:${email}`, 8, 15 * 60_000);
      const res = D.login(email, String(x.password ?? ''));
      if (!res) fail(401, 'That email and password don’t match an active account.');
      const secure = ctx.url.protocol === 'https:' || ctx.request.headers.get('x-forwarded-proto') === 'https';
      ctx.cookies.set(COOKIE, res!.token, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: D.SESSION_DAYS * 86400 });
      return json(res!.user);
    }
    if (b === 'logout' && method === 'POST') {
      const t = ctx.cookies.get(COOKIE)?.value;
      if (t) D.logout(t);
      ctx.cookies.delete(COOKIE, { path: '/' });
      return json({ ok: true });
    }
    if (b === 'me' && method === 'GET') return json(requireUser(ctx));
    if (b === 'password' && method === 'POST') {
      const u = requireUser(ctx);
      const x = await body(ctx);
      if (!D.checkPassword(u.id, String(x.current ?? ''))) fail(400, 'Your current password is wrong.');
      if (String(x.next ?? '').length < MIN_PASSWORD) fail(400, `Use at least ${MIN_PASSWORD} characters.`);
      D.updateUser(u.id, { password: String(x.next) });
      ctx.cookies.delete(COOKIE, { path: '/' });
      return json({ ok: true });
    }
  }

  /* admin */
  if (a === 'admin') {
    const u = requireUser(ctx);
    const sp = ctx.url.searchParams;

    // Active staff for the "assign to" pickers.
    if (b === 'staff' && method === 'GET') return json(D.listStaff());

    if (b === 'leads') {
      const types = leadTypesFor(u.role);
      need(types.length > 0);
      if (!c && method === 'GET') return json(D.pageLeads(types, leadFilter(sp), u.id));
      if (c === 'countries' && method === 'GET') return json(D.leadCountries(types));
      if (c === 'export.csv' && method === 'GET') {
        const rows = D.exportLeads(types, leadFilter(sp), u.id);
        const cols = ['id', 'created_at', 'updated_at', 'type', 'status', 'name', 'email', 'phone', 'country', 'subject', 'ref_title', 'assigned_name', 'distributed_to', 'distributed_at', 'message', 'notes', 'cv_name'];
        return csv(`mechbridge-leads-${today()}.csv`, cols, rows);
      }
      if (c === 'bulk' && method === 'POST') {
        const x = await body(ctx);
        const ids = idList(x.ids);
        const action = str(x.action);
        if (action === 'delete') {
          need(u.role === 'superadmin');
          let n = 0;
          for (const id of ids) {
            const row = D.getLeadRow(id);
            if (!row || !types.includes(row.type as LeadType)) continue;
            if (row.cv_path) await unlink(path.join(dataDir(), 'uploads', path.basename(String(row.cv_path)))).catch(() => {});
            D.deleteLead(id); n++;
          }
          return json({ changed: n });
        }
        const upd: LeadUpdate = {};
        if (action === 'status') upd.status = leadStatus(x.value);
        else if (action === 'assign') upd.assigned_to = assignee(x.value);
        else if (action === 'distribute') {
          const to = str(x.value, 160);
          if (!to) fail(400, 'Say who the leads were handed to.');
          upd.distributed_to = to; upd.status = 'distributed';
        } else fail(400, 'Unknown bulk action.');
        return json({ changed: D.bulkUpdateLeads(ids, types, upd, u.name) });
      }
      const id = Number(c);
      const row = D.getLeadRow(id);
      if (!row || !types.includes(row.type as LeadType)) fail(404, 'Lead not found.');
      if (d === 'cv' && method === 'GET') {
        if (!row!.cv_path) fail(404, 'No CV attached.');
        const buf = await readFile(path.join(dataDir(), 'uploads', path.basename(String(row!.cv_path))));
        const name = String(row!.cv_name).replace(/[^\w.\- ]/g, '_');
        return new Response(buf, { headers: { 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' } });
      }
      if (d === 'events' && method === 'GET') return json(D.leadEvents(id));
      if (!d && method === 'GET') return json(D.getLead(id));
      if (!d && method === 'PATCH') {
        const x = await body(ctx);
        const upd: LeadUpdate = {};
        if (x.status !== undefined) upd.status = leadStatus(x.status);
        if (x.notes !== undefined) upd.notes = str(x.notes, 5000);
        if (x.assigned_to !== undefined) upd.assigned_to = assignee(x.assigned_to);
        if (x.distributed_to !== undefined) upd.distributed_to = str(x.distributed_to, 160);
        return json(D.updateLead(id, upd, u.name));
      }
      if (!d && method === 'DELETE') {
        need(u.role === 'superadmin');
        if (row!.cv_path) await unlink(path.join(dataDir(), 'uploads', path.basename(String(row!.cv_path)))).catch(() => {});
        D.deleteLead(id);
        return json({ ok: true });
      }
    }

    if (b === 'postings') {
      const kinds = postingKindsFor(u.role);
      need(kinds.length > 0);
      if (!c && method === 'GET') {
        return json(D.pagePostings(kinds, {
          kind: (sp.get('kind') || undefined) as PostingKind | undefined, status: (sp.get('status') ?? '') as '', q: sp.get('q') ?? '',
          from: sp.get('from') ?? '', to: sp.get('to') ?? '', sort: sp.get('sort') ?? '', page: Number(sp.get('page')), pageSize: Number(sp.get('pageSize')),
        }));
      }
      if (!c && method === 'POST') {
        const p = postingInput(await body(ctx));
        need(kinds.includes(p.kind));
        return json(D.savePosting(p), 201);
      }
      if (c === 'bulk' && method === 'POST') {
        const x = await body(ctx);
        const action = str(x.action);
        if (action === 'delete') return json({ changed: D.bulkPostings(idList(x.ids), kinds, 'delete') });
        if (action === 'status') {
          const v = str(x.value);
          if (!['draft', 'open', 'closed'].includes(v)) fail(400, 'Choose draft, open or closed.');
          return json({ changed: D.bulkPostings(idList(x.ids), kinds, 'status', v as 'open') });
        }
        fail(400, 'Unknown bulk action.');
      }
      const existing = D.getPosting(Number(c));
      if (!existing || !kinds.includes(existing.kind)) fail(404, 'Posting not found.');
      if (d === 'duplicate' && method === 'POST') return json(D.duplicatePosting(existing!.id), 201);
      if (!d && method === 'PUT') {
        const p = postingInput({ ...(await body(ctx)), kind: existing!.kind });
        return json(D.savePosting(p, existing!.id));
      }
      if (!d && method === 'DELETE') { D.deletePosting(existing!.id); return json({ ok: true }); }
    }

    if (b === 'certificates') {
      need(canManageCertificates(u.role));
      const cf = () => ({
        q: sp.get('q') ?? '', programme: (sp.get('programme') ?? '') as '', status: (sp.get('status') ?? '') as '',
        from: sp.get('from') ?? '', to: sp.get('to') ?? '', sort: sp.get('sort') ?? '', ids: idList((sp.get('ids') ?? '').split(',')),
        page: Number(sp.get('page')), pageSize: Number(sp.get('pageSize')),
      });
      if (!c && method === 'GET') return json(D.pageCertificates(cf()));
      if (c === 'export.csv' && method === 'GET') {
        const cols = ['code', 'holder_name', 'programme', 'title', 'batch', 'issue_date', 'status', 'revoked_reason', 'issued_by', 'created_at'];
        return csv(`mechbridge-certificates-${today()}.csv`, cols, D.exportCertificates(cf()));
      }
      if (!c && method === 'POST') return json(D.issueCertificate(certInput(await body(ctx)), u.name), 201);
      if (c === 'bulk' && method === 'POST') {
        const x = await body(ctx);
        const action = str(x.action);
        if (action === 'revoke') {
          const reason = str(x.reason, 300);
          if (!reason) fail(400, 'Give a reason. It stays in the record, not on the public check.');
          return json({ changed: D.bulkCertificates(idList(x.ids), 'revoked', reason) });
        }
        if (action === 'restore') return json({ changed: D.bulkCertificates(idList(x.ids), 'valid') });
        fail(400, 'Unknown bulk action.');
      }
      const cert = D.getCertificate(Number(c));
      if (!cert) fail(404, 'Certificate not found.');
      if (!d && method === 'GET') return json(cert);
      if (!d && method === 'PUT') return json(D.updateCertificate(cert!.id, certInput(await body(ctx))));
      if (d === 'revoke' && method === 'POST') {
        const reason = str((await body(ctx)).reason, 300);
        if (!reason) fail(400, 'Give a reason. It stays in the record, not on the public check.');
        return json(D.setCertificateStatus(cert!.id, 'revoked', reason));
      }
      if (d === 'restore' && method === 'POST') return json(D.setCertificateStatus(cert!.id, 'valid'));
    }

    if (b === 'users') {
      need(canManageUsers(u.role));
      if (!c && method === 'GET') return json(D.listUsers());
      if (!c && method === 'POST') {
        const x = await body(ctx);
        const email = str(x.email, 160).toLowerCase(), name = str(x.name, 120), role = str(x.role) as Role, pw = String(x.password ?? '');
        if (!isEmail(email)) fail(400, 'Enter a valid email.');
        if (!name) fail(400, 'Add a name.');
        if (!ROLES.includes(role)) fail(400, 'Choose a role.');
        if (pw.length < MIN_PASSWORD) fail(400, `Use a temporary password of at least ${MIN_PASSWORD} characters.`);
        try { return json(D.createUser({ email, name, role, password: pw }), 201); } catch { return fail(409, 'An account with that email already exists.'); }
      }
      const id = Number(c);
      if (method === 'PUT') {
        const x = await body(ctx);
        const role = x.role === undefined ? undefined : (str(x.role) as Role);
        if (role && !ROLES.includes(role)) fail(400, 'Choose a role.');
        const active = x.active === undefined ? undefined : !!x.active;
        const target = D.listUsers().find((t) => t.id === id);
        if (!target) fail(404, 'User not found.');
        const losingSuper = target!.role === 'superadmin' && target!.active && ((role && role !== 'superadmin') || active === false);
        if (losingSuper && D.activeSuperadmins() <= 1) fail(400, 'Keep at least one active superadmin.');
        const pw = x.password ? String(x.password) : undefined;
        if (pw && pw.length < MIN_PASSWORD) fail(400, `Use at least ${MIN_PASSWORD} characters.`);
        return json(D.updateUser(id, { name: x.name === undefined ? undefined : str(x.name, 120), role, active, password: pw }));
      }
    }
  }

  return fail(404, 'Not found.');
}

export const ALL: APIRoute = async (ctx) => {
  const parts = String(ctx.params.path ?? '').split('/').filter(Boolean);
  try {
    return await handle(ctx, parts, ctx.request.method);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error('[api]', e);
    return json({ error: 'Something went wrong on our side. Try again in a minute.' }, 500);
  }
};

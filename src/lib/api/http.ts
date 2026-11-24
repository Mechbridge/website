import type { Api } from './client';
import { ApiError } from './errors';
import { u } from '../url';

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(u(`/api${path}`), {
    credentials: 'same-origin',
    ...init,
    headers: init.body && !(init.body instanceof FormData) ? { 'content-type': 'application/json', ...init.headers } : init.headers,
  });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) throw new ApiError(res.status, data?.error || `Request failed (${res.status}).`);
  return data as T;
}
const send = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });
// Query string from a filter object: skips empty values, joins arrays with commas.
const qs = (f: object) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
    p.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
};
const changed = async (path: string, body: unknown) => (await req<{ changed: number }>(path, send('POST', body))).changed;

export const httpApi: Api = {
  demo: false,
  listPostings: (kind) => req(`/postings?kind=${kind}`),
  getPosting: (kind, slug) => req(`/postings/${kind}/${encodeURIComponent(slug)}`).catch((e) => (e.status === 404 ? null : Promise.reject(e))) as never,
  submitLead: async (form) => { await req('/leads', { method: 'POST', body: form }); },
  verify: (code) => req(`/verify?code=${encodeURIComponent(code)}`),

  login: (email, password) => req('/auth/login', send('POST', { email, password })),
  logout: async () => { await req('/auth/logout', { method: 'POST' }); },
  me: () => req('/auth/me').catch((e) => (e.status === 401 ? null : Promise.reject(e))) as never,
  changePassword: async (current, next) => { await req('/auth/password', send('POST', { current, next })); },

  staff: () => req('/admin/staff'),

  leads: (f) => req(`/admin/leads${qs(f)}`),
  lead: (id) => req(`/admin/leads/${id}`),
  leadEvents: (id) => req(`/admin/leads/${id}/events`),
  leadCountries: () => req('/admin/leads/countries'),
  updateLead: (id, x) => req(`/admin/leads/${id}`, send('PATCH', x)),
  bulkLeads: (ids, a) => changed('/admin/leads/bulk', { ids, ...a }),
  deleteLead: async (id) => { await req(`/admin/leads/${id}`, { method: 'DELETE' }); },
  leadsCsvUrl: async (f) => u(`/api/admin/leads/export.csv${qs({ ...f, page: undefined, pageSize: undefined })}`),
  cvUrl: (id) => u(`/api/admin/leads/${id}/cv`),
  idDocUrl: (id) => u(`/api/admin/leads/${id}/id-doc`),

  postings: (f) => req(`/admin/postings${qs(f)}`),
  savePosting: (p, id) => req(id ? `/admin/postings/${id}` : '/admin/postings', send(id ? 'PUT' : 'POST', p)),
  duplicatePosting: (id) => req(`/admin/postings/${id}/duplicate`, send('POST', {})),
  bulkPostings: (ids, a) => changed('/admin/postings/bulk', { ids, ...a }),
  deletePosting: async (id) => { await req(`/admin/postings/${id}`, { method: 'DELETE' }); },

  certificates: (f) => req(`/admin/certificates${qs(f)}`),
  certificate: (id) => req(`/admin/certificates/${id}`),
  certificatesCsvUrl: async (f) => u(`/api/admin/certificates/export.csv${qs({ ...f, page: undefined, pageSize: undefined })}`),
  issueCertificate: (c) => req('/admin/certificates', send('POST', c)),
  updateCertificate: (id, c) => req(`/admin/certificates/${id}`, send('PUT', c)),
  revokeCertificate: (id, reason) => req(`/admin/certificates/${id}/revoke`, send('POST', { reason })),
  restoreCertificate: (id) => req(`/admin/certificates/${id}/restore`, send('POST', {})),
  bulkCertificates: (ids, a) => changed('/admin/certificates/bulk', { ids, ...a }),

  users: () => req('/admin/users'),
  createUser: (x) => req('/admin/users', send('POST', x)),
  updateUser: (id, x) => req(`/admin/users/${id}`, send('PUT', x)),
  mailboxes: () => req('/admin/mailboxes'),
  createMailbox: async (local, password, name = '') => (await req<{ address: string }>('/admin/mailboxes', send('POST', { local, password, name }))).address,
  setMailboxName: async (address, name) => { await req(`/admin/mailboxes/${encodeURIComponent(address)}/name`, send('PUT', { name })); },
  saveWebmailSettings: (s) => req('/admin/mailboxes/settings', send('PUT', s)),
  setMailboxPassword: async (address, password) => { await req(`/admin/mailboxes/${encodeURIComponent(address)}/password`, send('POST', { password })); },
  deleteMailbox: async (address) => { await req(`/admin/mailboxes/${encodeURIComponent(address)}`, send('DELETE')); },
};

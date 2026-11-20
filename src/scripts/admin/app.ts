// Mechbridge staff portal. Hash routes: #/ #/leads #/job #/internship #/training #/certificates #/users #/account
// Filters live in the hash query (#/leads?status=new&page=2) so views survive a refresh and can be shared.
// Lists are paged on the server. Text from the database is only ever set with textContent.
import { api, ApiError } from '../../lib/api/client';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, resetDemo } from '../../lib/api/demo';
import type {
  Certificate, Lead, LeadFilter, LeadStatus, LeadType, Posting, PostingKind, PostingStatus, StaffRef, User,
} from '../../lib/api/types';
import { PAGE_SIZES } from '../../lib/api/types';
import {
  ROLE_LABELS, ROLE_NOTES, LEAD_TYPE_LABELS, POSTING_LABELS, LEAD_STATUSES, LEAD_STATUS_LABELS, LEAD_STATUS_NOTES,
  leadTypesFor, postingKindsFor, canManageCertificates, canManageUsers, canSeeLeads,
} from '../../lib/roles';
import { u } from '../../lib/url';

/* ================= tiny DOM helper ================= */
type Child = Node | string | null | undefined | false;
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, unknown> = {}, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = String(v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'value' && 'value' in e) (e as HTMLInputElement).value = String(v);
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, String(v));
  }
  for (const kid of kids) if (kid !== null && kid !== undefined && kid !== false) e.append(kid);
  return e;
}
const parseDate = (s: string) => new Date(s.includes(' ') || s.includes('T') ? s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z') : s + 'T00:00:00');
const fmt = (s: string) => { if (!s) return ''; const d = parseDate(s); return isNaN(+d) ? s : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
const fmtTime = (s: string) => { if (!s) return ''; const d = parseDate(s); return isNaN(+d) ? s : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
const ago = (s: string) => {
  if (!s) return 'never';
  const m = Math.round((Date.now() - +parseDate(s)) / 60000);
  if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`;
  const hr = Math.round(m / 60); if (hr < 24) return `${hr} h ago`;
  const dd = Math.round(hr / 24); return dd < 30 ? `${dd} d ago` : fmt(s);
};
const toast = (msg: string, err = false) => {
  const t = h('div', { class: `adm-toast ${err ? 'adm-toast--err' : ''}`, role: 'status' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 3200);
};
const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');
const pill = (v: string, label = v) => h('span', { class: `pill pill--${v}` }, label[0].toUpperCase() + label.slice(1));
const field = (label: string, input: HTMLElement, hint?: string) => h('div', { class: 'field' }, h('label', { for: input.id }, label), input, hint ? h('p', { class: 'adm-hint' }, hint) : null);
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
let uid = 0;
const id = () => `f${++uid}`;
const isoDay = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const download = (url: string, name: string) => { const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove(); };

/* ================= side sheet ================= */
function sheet(title: string, body: Node[], foot: Node[]) {
  const dlg = h('dialog', { class: 'adm-sheet', 'aria-label': title });
  const close = () => { dlg.close(); };
  dlg.append(h('div', { class: 'adm-sheet__in' },
    h('div', { class: 'adm-sheet__head' }, h('h2', {}, title), h('button', { class: 'adm-x', type: 'button', 'aria-label': 'Close', onclick: close }, '×')),
    h('div', { class: 'adm-sheet__body' }, ...body),
    h('div', { class: 'adm-sheet__foot' }, ...foot),
  ));
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  document.body.append(dlg);
  dlg.showModal();
  return { dlg, close };
}
// Small prompt in a sheet: resolves with the entered text, or null if cancelled.
function ask(title: string, label: string, opts: { hint?: string; placeholder?: string; suggestions?: string[]; confirm?: string; danger?: boolean } = {}) {
  return new Promise<string | null>((resolve) => {
    const listId = id();
    const input = h('input', { id: id(), placeholder: opts.placeholder ?? '', list: opts.suggestions?.length ? listId : undefined, autocomplete: 'off' });
    const dl = opts.suggestions?.length ? h('datalist', { id: listId }, ...opts.suggestions.map((s) => h('option', { value: s }))) : null;
    const err = h('p', { class: 'adm-error', role: 'alert' });
    let done = false;
    const ok = h('button', { class: `btn btn--sm ${opts.danger ? 'btn--danger' : ''}`, type: 'button' }, opts.confirm ?? 'Confirm');
    const s = sheet(title, [field(label, input, opts.hint), dl, err].filter(Boolean) as Node[], [h('button', { class: 'btn btn--quiet btn--sm', type: 'button', onclick: () => s.close() }, 'Cancel'), ok]);
    const submit = () => { if (!input.value.trim()) { err.textContent = 'This can’t be empty.'; input.focus(); return; } done = true; resolve(input.value.trim()); s.close(); };
    ok.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    s.dlg.addEventListener('close', () => { if (!done) resolve(null); });
    input.focus();
  });
}

/* ================= routing + URL state ================= */
const root = document.getElementById('admin')!;
const markSvg = (document.getElementById('admin-mark') as HTMLTemplateElement).content;
let me: User | null = null;
let staffCache: StaffRef[] | null = null;
const staff = async () => (staffCache ??= await api.staff().catch(() => []));

const route = () => location.hash.replace(/^#\/?/, '').split('?')[0] || '';
const readQuery = () => Object.fromEntries(new URLSearchParams(location.hash.split('?')[1] ?? '')) as Record<string, string>;
function writeQuery(q: Record<string, unknown>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '' && !(k === 'page' && Number(v) === 1)) p.set(k, String(v));
  const s = p.toString();
  history.replaceState(null, '', `#/${route()}${s ? `?${s}` : ''}`);
}

async function boot() {
  try { me = await api.me(); } catch { me = null; }
  me ? renderShell() : renderLogin();
}
let lastRoute = '';
window.addEventListener('hashchange', () => {
  // Panels belong to the view they were opened from.
  document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach((d) => d.close());
  if (me) renderShell();
});

/* ================= login ================= */
function renderLogin(message = '') {
  const email = h('input', { id: id(), type: 'email', autocomplete: 'username', required: true });
  const pw = h('input', { id: id(), type: 'password', autocomplete: 'current-password', required: true });
  const err = h('p', { class: 'adm-error', role: 'alert' }, message);
  const btn = h('button', { class: 'btn', type: 'submit' }, 'Log in');
  const form = h('form', { class: 'form', novalidate: true }, field('Email', email), field('Password', pw), err, btn);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    btn.setAttribute('aria-busy', 'true');
    try { me = await api.login(email.value, pw.value); staffCache = null; if (!route()) location.hash = '#/'; renderShell(); }
    catch (x) { err.textContent = errMsg(x); pw.select(); }
    finally { btn.removeAttribute('aria-busy'); }
  });
  const demo = api.demo ? h('div', { class: 'adm-demo' },
    h('p', {}, `Demo portal. Pick a role to fill in its login (password ${DEMO_PASSWORD}). Data stays in this browser.`),
    h('div', { class: 'adm-demo__list' }, ...DEMO_ACCOUNTS.map((a) => h('button', { class: 'btn btn--quiet btn--xs', type: 'button', onclick: () => { email.value = a.email; pw.value = DEMO_PASSWORD; btn.focus(); } }, ROLE_LABELS[a.role]))),
  ) : null;
  root.replaceChildren(h('main', { class: 'adm-login' }, h('div', { class: 'adm-login__card' },
    h('a', { class: 'adm-login__brand', href: u('/') }, markSvg.cloneNode(true), h('span', {}, 'Mechbridge International')),
    h('h1', {}, 'Staff portal'),
    demo, form,
    h('a', { class: 'link', href: u('/') }, 'Back to the website'),
  )));
  email.focus();
}

/* ================= shell ================= */
interface NavEntry { hash: string; label: string; show: boolean }
function navFor(user: User): NavEntry[] {
  const kinds = postingKindsFor(user.role);
  return [
    { hash: '', label: 'Overview', show: true },
    { hash: 'leads', label: 'Leads', show: canSeeLeads(user.role) },
    { hash: 'job', label: 'Jobs', show: kinds.includes('job') },
    { hash: 'internship', label: 'Internships', show: kinds.includes('internship') },
    { hash: 'training', label: 'Training batches', show: kinds.includes('training') },
    { hash: 'certificates', label: 'Certificates', show: canManageCertificates(user.role) },
    { hash: 'users', label: 'Staff accounts', show: canManageUsers(user.role) },
    { hash: 'account', label: 'My account', show: true },
  ].filter((n) => n.show);
}

function renderShell() {
  const user = me!;
  const nav = navFor(user);
  let r = route();
  if (!nav.some((n) => n.hash === r)) r = '';
  if (r !== lastRoute) lastRoute = r;
  const main = h('main', { class: 'adm-main', id: 'adm-main', tabindex: '-1' });
  const shell = h('div', { class: 'adm' });
  const side = h('aside', { class: 'adm-side' },
    h('a', { class: 'adm-side__brand', href: u('/') }, markSvg.cloneNode(true), h('span', {}, h('b', {}, 'Mechbridge'), h('small', {}, 'Staff portal'))),
    h('nav', { class: 'adm-nav', 'aria-label': 'Portal' }, ...nav.map((n) => h('a', { href: `#/${n.hash}`, 'aria-current': n.hash === r ? 'page' : undefined, onclick: () => shell.classList.remove('nav-open') }, n.label))),
    h('div', { class: 'adm-side__foot' },
      h('div', { class: 'adm-side__who' }, h('b', {}, user.name), h('span', {}, `${ROLE_LABELS[user.role]} · ${user.email}`)),
      h('button', { class: 'btn btn--quiet btn--xs', type: 'button', onclick: async () => { await api.logout(); me = null; renderLogin('You are logged out.'); } }, 'Log out'),
    ),
  );
  shell.append(side, main);
  root.replaceChildren(shell);
  main.append(h('button', { class: 'btn btn--quiet btn--xs adm-burger', type: 'button', onclick: () => shell.classList.toggle('nav-open') }, 'Menu'));
  if (api.demo) main.append(h('div', { class: 'adm-banner' }, 'Demo portal: everything you do here is saved only in this browser.', h('button', { type: 'button', onclick: () => { if (confirm('Reset the demo data to its starting state?')) { resetDemo(); location.reload(); } } }, 'Reset demo data')));
  const view = h('div', {});
  main.append(view);
  const views: Record<string, (el: HTMLElement) => Promise<void> | void> = {
    '': overview, leads, job: (el) => postings(el, 'job'), internship: (el) => postings(el, 'internship'), training: (el) => postings(el, 'training'),
    certificates, users, account,
  };
  Promise.resolve(views[r](view)).catch(handleErr(view));
}
const handleErr = (view: HTMLElement) => (e: unknown) => {
  if (e instanceof ApiError && e.status === 401) { me = null; renderLogin(e.message); return; }
  view.replaceChildren(h('p', { class: 'adm-error' }, errMsg(e)));
};

const head = (title: string, sub: string, ...actions: (Node | null)[]) =>
  h('div', { class: 'adm-head' }, h('div', {}, h('h1', {}, title), h('p', {}, sub)), h('div', { class: 'btn-row' }, ...(actions.filter(Boolean) as Node[])));

/* ================= shared list building blocks ================= */

// Status tabs with live counts.
function tabs(items: { value: string; label: string; count?: number }[], current: string, onPick: (v: string) => void) {
  return h('div', { class: 'adm-tabs', role: 'tablist' }, ...items.map((t) =>
    h('button', { class: 'adm-tab', type: 'button', role: 'tab', 'aria-selected': String(t.value === current), onclick: () => onPick(t.value) },
      t.label, t.count !== undefined ? h('span', { class: 'adm-tab__n' }, t.count.toLocaleString()) : null)));
}

// Date range: presets plus custom from/to.
const PRESETS: [string, string][] = [['', 'Any time'], ['today', 'Today'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['month', 'This month'], ['lastmonth', 'Last month'], ['custom', 'Custom range']];
function presetRange(p: string): { from: string; to: string } {
  const t = new Date();
  if (p === 'today') return { from: isoDay(t), to: isoDay(t) };
  if (['7', '30', '90'].includes(p)) return { from: isoDay(new Date(Date.now() - (Number(p) - 1) * 864e5)), to: isoDay(t) };
  if (p === 'month') return { from: isoDay(new Date(t.getFullYear(), t.getMonth(), 1)), to: isoDay(t) };
  if (p === 'lastmonth') return { from: isoDay(new Date(t.getFullYear(), t.getMonth() - 1, 1)), to: isoDay(new Date(t.getFullYear(), t.getMonth(), 0)) };
  return { from: '', to: '' };
}
function dateRange(label: string, state: { range?: string; from?: string; to?: string }, onChange: () => void) {
  const preset = h('select', { id: id() }, ...PRESETS.map(([v, l]) => h('option', { value: v, selected: (state.range ?? '') === v }, l)));
  const from = h('input', { id: id(), type: 'date', value: state.from ?? '', 'aria-label': `${label} from` });
  const to = h('input', { id: id(), type: 'date', value: state.to ?? '', 'aria-label': `${label} to` });
  const custom = h('div', { class: 'adm-range__custom', hidden: state.range !== 'custom' }, from, h('span', { 'aria-hidden': 'true' }, '–'), to);
  preset.addEventListener('change', () => {
    state.range = preset.value;
    custom.hidden = preset.value !== 'custom';
    if (preset.value !== 'custom') Object.assign(state, presetRange(preset.value));
    else { state.from = from.value; state.to = to.value; }
    onChange();
  });
  [from, to].forEach((x) => x.addEventListener('change', () => { state.from = from.value; state.to = to.value; onChange(); }));
  return h('div', { class: 'field adm-range' }, h('label', { for: preset.id }, label), h('div', { class: 'adm-range__row' }, preset, custom));
}
// Keeps a preset range current (e.g. "Last 7 days" moves with the date) when restoring from the URL.
const resolveRange = (s: { range?: string; from?: string; to?: string }) => { if (s.range && s.range !== 'custom') Object.assign(s, presetRange(s.range)); };

// Pager: "26–50 of 312", page size, prev/next, jump to page.
function pager(total: number, page: number, pageSize: number, onChange: (page: number, pageSize: number) => void) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total ? (page - 1) * pageSize + 1 : 0, last = Math.min(total, page * pageSize);
  const size = h('select', { 'aria-label': 'Rows per page' }, ...PAGE_SIZES.map((n) => h('option', { value: n, selected: n === pageSize }, `${n} per page`)));
  size.addEventListener('change', () => onChange(1, Number(size.value)));
  const jump = h('select', { 'aria-label': 'Go to page' }, ...Array.from({ length: Math.min(pages, 500) }, (_, i) => h('option', { value: i + 1, selected: i + 1 === page }, `Page ${i + 1} of ${pages}`)));
  jump.addEventListener('change', () => onChange(Number(jump.value), pageSize));
  return h('div', { class: 'adm-pager' },
    h('p', { class: 'adm-pager__info' }, total ? `${first.toLocaleString()}–${last.toLocaleString()} of ${total.toLocaleString()}` : 'No results'),
    h('div', { class: 'adm-pager__ctl' }, size,
      h('button', { class: 'btn btn--quiet btn--xs', type: 'button', disabled: page <= 1, onclick: () => onChange(page - 1, pageSize), 'aria-label': 'Previous page' }, '← Prev'),
      jump,
      h('button', { class: 'btn btn--quiet btn--xs', type: 'button', disabled: page >= pages, onclick: () => onChange(page + 1, pageSize), 'aria-label': 'Next page' }, 'Next →')));
}

// Row selection that persists across pages. Shift-click selects a range on the current page.
class Selection {
  ids = new Set<number>();
  private last = -1;
  constructor(private onChange: () => void) {}
  box(rowIds: number[], index: number, label: string) {
    const cb = h('input', { type: 'checkbox', 'aria-label': `Select ${label}`, checked: this.ids.has(rowIds[index]) });
    cb.addEventListener('click', (e) => {
      const on = cb.checked;
      if ((e as MouseEvent).shiftKey && this.last >= 0) {
        const [a, b] = [Math.min(this.last, index), Math.max(this.last, index)];
        for (let i = a; i <= b; i++) on ? this.ids.add(rowIds[i]) : this.ids.delete(rowIds[i]);
      } else on ? this.ids.add(rowIds[index]) : this.ids.delete(rowIds[index]);
      this.last = index;
      this.onChange();
    });
    return cb;
  }
  all(rowIds: number[]) {
    const allOn = rowIds.length > 0 && rowIds.every((i) => this.ids.has(i));
    const cb = h('input', { type: 'checkbox', 'aria-label': 'Select all on this page', checked: allOn });
    if (!allOn && rowIds.some((i) => this.ids.has(i))) cb.indeterminate = true;
    cb.addEventListener('click', () => { rowIds.forEach((i) => (cb.checked ? this.ids.add(i) : this.ids.delete(i))); this.last = -1; this.onChange(); });
    return cb;
  }
  clear() { this.ids.clear(); this.last = -1; this.onChange(); }
  list() { return [...this.ids]; }
}
// Bulk action bar shown while rows are selected.
function bulkBar(sel: Selection, ...actions: Node[]) {
  if (!sel.ids.size) return h('div', { class: 'adm-bulk', hidden: true });
  return h('div', { class: 'adm-bulk', role: 'region', 'aria-label': 'Bulk actions' },
    h('b', {}, `${sel.ids.size} selected`),
    ...actions,
    h('button', { class: 'adm-bulk__clear', type: 'button', onclick: () => sel.clear() }, 'Clear selection'));
}
const bulkSelect = (label: string, options: [string, string][], onPick: (v: string) => void) => {
  const s = h('select', { 'aria-label': label }, h('option', { value: '' }, label), ...options.map(([v, l]) => h('option', { value: v }, l)));
  s.addEventListener('change', () => { const v = s.value; s.value = ''; if (v) onPick(v); });
  return s;
};
// Keeps row highlights and every checkbox (including the header one) in step with the selection.
function syncRows(wrap: HTMLElement, rowIds: number[], sel: Selection) {
  wrap.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((tr, i) => {
    const on = rowIds[i] !== undefined && sel.ids.has(rowIds[i]);
    tr.classList.toggle('is-selected', on);
    const cb = tr.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (cb) cb.checked = on;
  });
  const head = wrap.querySelector<HTMLInputElement>('thead input[type="checkbox"]');
  if (head) {
    const n = rowIds.filter((i) => sel.ids.has(i)).length;
    head.checked = n > 0 && n === rowIds.length;
    head.indeterminate = n > 0 && n < rowIds.length;
  }
}
const tableEl = (cols: (string | Node)[], body: HTMLTableSectionElement) =>
  h('table', { class: 'adm-table' }, h('thead', {}, h('tr', {}, ...cols.map((c) => h('th', { scope: 'col' }, c)))), body);

/* ================= overview ================= */
async function overview(el: HTMLElement) {
  const user = me!;
  el.append(head(`Hello, ${user.name.split(' ')[0]}.`, `${ROLE_LABELS[user.role]}: ${ROLE_NOTES[user.role]}.`));
  const card = (n: number | string, label: string, hash: string) => h('a', { class: 'adm-card', href: `#/${hash}` }, h('b', {}, String(n)), h('span', {}, label));
  if (canSeeLeads(user.role)) {
    const [all, mine, week] = await Promise.all([
      api.leads({ pageSize: 1 }),
      api.leads({ pageSize: 1, assigned: 'me', status: 'open' }),
      api.leads({ pageSize: 1, ...presetRange('7') }),
    ]);
    el.append(h('h2', { class: 'adm-sub' }, 'Leads'), h('div', { class: 'adm-cards' },
      card(all.counts.new, 'New, not handled yet', 'leads?status=new'),
      card(mine.total, 'Open and assigned to you', 'leads?assigned=me&status=open'),
      card(week.total, 'Received in the last 7 days', 'leads?range=7'),
      card(all.counts.distributed, 'Distributed', 'leads?status=distributed'),
      card(all.counts.converted, 'Converted', 'leads?status=converted'),
    ));
  }
  const kinds = postingKindsFor(user.role);
  if (kinds.length) {
    const cards = h('div', { class: 'adm-cards' });
    el.append(h('h2', { class: 'adm-sub' }, 'Postings'), cards);
    for (const k of kinds) {
      const p = await api.postings({ kind: k, pageSize: 1 });
      cards.append(card(p.counts.open, `Open ${POSTING_LABELS[k].many.toLowerCase()}`, `${k}?status=open`));
      if (p.counts.draft) cards.append(card(p.counts.draft, `${POSTING_LABELS[k].many} in draft`, `${k}?status=draft`));
    }
  }
  if (canManageCertificates(user.role)) {
    const c = await api.certificates({ pageSize: 1 });
    const recent = await api.certificates({ pageSize: 1, ...presetRange('30') });
    el.append(h('h2', { class: 'adm-sub' }, 'Certificates'), h('div', { class: 'adm-cards' },
      card(c.counts.valid, 'Valid certificates', 'certificates?status=valid'),
      card(recent.total, 'Issued in the last 30 days', 'certificates?range=30'),
      card(c.counts.revoked, 'Revoked', 'certificates?status=revoked'),
    ));
  }
  el.append(h('p', { class: 'adm-hint' }, 'Public pages: ', h('a', { class: 'link', href: u('/careers') }, 'Careers'), ' · ', h('a', { class: 'link', href: u('/internships') }, 'Internships'), ' · ', h('a', { class: 'link', href: u('/training') }, 'Training'), ' · ', h('a', { class: 'link', href: u('/verify') }, 'Verify')));
}

/* ================= leads ================= */
interface LeadState extends LeadFilter { range?: string; refLabel?: string }

async function leads(el: HTMLElement) {
  const types = leadTypesFor(me!.role);
  const q = readQuery();
  const st: LeadState = {
    type: (q.type ?? '') as LeadType, status: (q.status ?? '') as LeadStatus, q: q.q ?? '', country: q.country ?? '', cv: (q.cv ?? '') as '',
    assigned: q.assigned ?? '', ref: q.ref ?? '', sort: q.sort ?? 'newest', range: q.range ?? '', from: q.from ?? '', to: q.to ?? '',
    page: Number(q.page) || 1, pageSize: Number(q.pageSize) || 25,
  };
  resolveRange(st);
  const [countries, people] = await Promise.all([api.leadCountries(), staff()]);

  const exportBtn = h('button', { class: 'btn btn--quiet btn--sm', type: 'button' }, 'Export CSV');
  el.append(head('Leads', 'Every form submitted on the website that your role can see.', exportBtn));
  const tabsBox = h('div', {});
  const filters = h('div', { class: 'adm-filters' });
  const chips = h('div', { class: 'adm-chips' });
  const bulkBox = h('div', {});
  const wrap = h('div', { class: 'adm-table-wrap' });
  const pagerBox = h('div', {});
  el.append(tabsBox, filters, chips, bulkBox, wrap, pagerBox);

  const sel = new Selection(() => renderBulk());
  let current: Lead[] = [];

  // Filter controls
  const fQ = h('input', { id: id(), type: 'search', placeholder: 'Name, email, phone, message…', value: st.q });
  const fType = h('select', { id: id() }, h('option', { value: '' }, 'All types'), ...types.map((t) => h('option', { value: t, selected: st.type === t }, LEAD_TYPE_LABELS[t])));
  const fCountry = h('select', { id: id() }, h('option', { value: '' }, 'All countries'), ...countries.map((c) => h('option', { value: c, selected: st.country === c }, c)));
  const fAssigned = h('select', { id: id() },
    h('option', { value: '' }, 'Anyone'), h('option', { value: 'me', selected: st.assigned === 'me' }, 'Assigned to me'), h('option', { value: 'none', selected: st.assigned === 'none' }, 'Unassigned'),
    ...people.map((p) => h('option', { value: p.id, selected: st.assigned === String(p.id) }, p.name)));
  const fCv = h('select', { id: id() }, h('option', { value: '' }, 'Any'), h('option', { value: '1', selected: st.cv === '1' }, 'With CV'), h('option', { value: '0', selected: st.cv === '0' }, 'Without CV'));
  const fSort = h('select', { id: id() }, ...([['newest', 'Newest first'], ['oldest', 'Oldest first'], ['updated', 'Recently updated'], ['name', 'Name A–Z']] as const).map(([v, l]) => h('option', { value: v, selected: st.sort === v }, l)));
  const reset = h('button', { class: 'btn btn--quiet btn--xs', type: 'button', onclick: () => { location.hash = '#/leads'; renderShell(); } }, 'Reset filters');
  filters.append(...([
    h('div', { class: 'adm-filters__q' }, field('Search', fQ)), field('Type', fType), field('Country', fCountry),
    dateRange('Received', st, () => go(1)), field('Assigned', fAssigned), types.some((t) => t === 'job' || t === 'internship') ? field('CV', fCv) : null,
    field('Sort', fSort), h('div', { class: 'adm-filters__end' }, reset),
  ].filter(Boolean) as Node[]));
  const bind = (elx: HTMLSelectElement, key: keyof LeadState) => elx.addEventListener('change', () => { (st as Record<string, unknown>)[key] = elx.value; go(1); });
  bind(fType, 'type'); bind(fCountry, 'country'); bind(fAssigned, 'assigned'); bind(fCv, 'cv'); bind(fSort, 'sort');
  let t: number | undefined;
  fQ.addEventListener('input', () => { clearTimeout(t); t = window.setTimeout(() => { st.q = fQ.value.trim(); go(1); }, 300); });

  exportBtn.addEventListener('click', async () => {
    const f = sel.ids.size ? { ids: sel.list() } : filterOf();
    download(await api.leadsCsvUrl(f), `mechbridge-leads-${isoDay(new Date())}.csv`);
    toast(sel.ids.size ? `Exported ${plural(sel.ids.size, 'selected lead')}` : 'Exported every lead matching the filters');
  });

  const filterOf = (): LeadFilter => ({ type: st.type, status: st.status, q: st.q, country: st.country, cv: st.cv, assigned: st.assigned, ref: st.ref, sort: st.sort, from: st.from, to: st.to, page: st.page, pageSize: st.pageSize });
  async function go(page = st.page ?? 1, pageSize = st.pageSize ?? 25) {
    st.page = page; st.pageSize = pageSize;
    writeQuery({ type: st.type, status: st.status, q: st.q, country: st.country, cv: st.cv, assigned: st.assigned, ref: st.ref, sort: st.sort === 'newest' ? '' : st.sort, range: st.range, from: st.range === 'custom' ? st.from : '', to: st.range === 'custom' ? st.to : '', page, pageSize: pageSize === 25 ? '' : pageSize });
    wrap.setAttribute('aria-busy', 'true');
    const res = await api.leads(filterOf()).catch((e) => { handleErr(el)(e); throw e; });
    wrap.removeAttribute('aria-busy');
    current = res.rows;
    tabsBox.replaceChildren(tabs([
      { value: '', label: 'All', count: res.counts.all },
      { value: 'open', label: 'Open', count: res.counts.all - res.counts.converted - res.counts.closed },
      ...LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s], count: res.counts[s] })),
    ], st.status ?? '', (v) => { st.status = v as LeadStatus; go(1); }));
    chips.replaceChildren(...(st.ref ? [h('span', { class: 'adm-chip' }, `Applications for posting #${st.ref}`, h('button', { type: 'button', 'aria-label': 'Remove posting filter', onclick: () => { st.ref = ''; go(1); } }, '×'))] : []));
    renderRows();
    pagerBox.replaceChildren(pager(res.total, res.page, res.pageSize, (p, s) => go(p, s)));
  }

  function renderRows() {
    if (!current.length) { wrap.replaceChildren(h('p', { class: 'adm-empty' }, 'No leads match these filters.')); renderBulk(); return; }
    const ids = current.map((l) => l.id);
    const tbody = h('tbody', {});
    current.forEach((l, i) => {
      const status = h('select', { 'aria-label': `Status for ${l.name}`, class: `adm-status adm-status--${l.status}` }, ...LEAD_STATUSES.map((s) => h('option', { value: s, selected: l.status === s }, LEAD_STATUS_LABELS[s])));
      status.addEventListener('change', async () => {
        const v = status.value as LeadStatus;
        if (v === 'distributed' && !l.distributed_to) {
          const to = await ask('Mark as distributed', 'Handed to', { hint: 'A team, partner or branch. It appears in the lead history.', suggestions: distributedSuggestions(), confirm: 'Mark distributed' });
          if (!to) { status.value = l.status; return; }
          await act(() => api.updateLead(l.id, { status: 'distributed', distributed_to: to }), 'Marked as distributed');
        } else await act(() => api.updateLead(l.id, { status: v }), `Status set to ${LEAD_STATUS_LABELS[v]}`);
      });
      tbody.append(h('tr', { class: sel.ids.has(l.id) ? 'is-selected' : '' },
        h('td', { class: 'sel' }, sel.box(ids, i, l.name)),
        h('td', { class: 'muted nowrap', title: fmtTime(l.created_at) }, fmt(l.created_at)),
        h('td', {}, LEAD_TYPE_LABELS[l.type]),
        h('td', {}, h('button', { class: 'adm-row-link', type: 'button', onclick: () => leadSheet(l.id, () => go()) }, l.name), h('div', { class: 'muted' }, l.email), l.country ? h('div', { class: 'muted' }, l.country) : null),
        h('td', { class: 'muted' }, l.ref_title || l.subject || '—'),
        h('td', {}, status),
        h('td', { class: 'muted' }, l.assigned_name || '—', l.distributed_to ? h('div', { class: 'adm-dist' }, `→ ${l.distributed_to}`) : null),
        h('td', { class: 'actions' }, l.cv_name ? h('span', { class: 'pill' }, 'CV') : null, h('button', { class: 'btn btn--quiet btn--xs', type: 'button', onclick: () => leadSheet(l.id, () => go()) }, 'Open')),
      ));
    });
    wrap.replaceChildren(tableEl([sel.all(ids), 'Received', 'Type', 'From', 'About', 'Status', 'Owner', ''], tbody));
    renderBulk();
  }

  const distributedSuggestions = () => [...new Set(current.map((l) => l.distributed_to).filter(Boolean))];
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast(ok); await go(); } catch (e) { toast(errMsg(e), true); }
  };

  function renderBulk() {
    // Re-render selection state in rows without refetching
    syncRows(wrap, current.map((x) => x.id), sel);
    const ids = sel.list();
    bulkBox.replaceChildren(bulkBar(sel,
      bulkSelect('Set status…', LEAD_STATUSES.filter((s) => s !== 'distributed').map((s) => [s, LEAD_STATUS_LABELS[s]]), (v) =>
        act(async () => toast(`${plural(await api.bulkLeads(ids, { action: 'status', value: v as LeadStatus }), 'lead')} updated`), 'Done').then(() => sel.clear())),
      h('button', { class: 'btn btn--sm', type: 'button', onclick: async () => {
        const to = await ask(`Mark ${plural(ids.length, 'lead')} as distributed`, 'Handed to', { hint: 'A team, partner or branch. Each lead’s history records it.', suggestions: distributedSuggestions(), confirm: 'Mark distributed' });
        if (!to) return;
        await act(async () => toast(`${plural(await api.bulkLeads(ids, { action: 'distribute', value: to }), 'lead')} distributed to ${to}`), 'Done');
        sel.clear();
      } }, 'Mark as distributed'),
      bulkSelect('Assign to…', [['none', 'Nobody'], ...people.map((p): [string, string] => [String(p.id), p.name])], (v) =>
        act(async () => toast(`${plural(await api.bulkLeads(ids, { action: 'assign', value: v === 'none' ? null : Number(v) }), 'lead')} assigned`), 'Done').then(() => sel.clear())),
      h('button', { class: 'btn btn--quiet btn--sm', type: 'button', onclick: async () => download(await api.leadsCsvUrl({ ids }), `mechbridge-leads-selected-${isoDay(new Date())}.csv`) }, 'Export selected'),
      me!.role === 'superadmin' ? h('button', { class: 'btn btn--danger btn--sm', type: 'button', onclick: async () => {
        if (!confirm(`Delete ${plural(ids.length, 'lead')} and any attached CVs? This can't be undone.`)) return;
        await act(async () => toast(`${plural(await api.bulkLeads(ids, { action: 'delete' }), 'lead')} deleted`), 'Done');
        sel.clear();
      } }, 'Delete') : h('span', {}),
    ));
  }

  await go();
}

async function leadSheet(leadId: number, reload: () => Promise<void> | void) {
  const [l, people] = await Promise.all([api.lead(leadId), staff()]);
  const status = h('select', { id: id() }, ...LEAD_STATUSES.map((s) => h('option', { value: s, selected: l.status === s }, `${LEAD_STATUS_LABELS[s]}: ${LEAD_STATUS_NOTES[s]}`)));
  const assign = h('select', { id: id() }, h('option', { value: '' }, 'Nobody'), ...people.map((p) => h('option', { value: p.id, selected: l.assigned_to === p.id }, `${p.name} (${ROLE_LABELS[p.role]})`)));
  const dist = h('input', { id: id(), value: l.distributed_to, placeholder: 'Team, partner or branch' });
  const notes = h('textarea', { id: id(), rows: '4' }, l.notes);
  const cv = l.cv_name ? (api.cvUrl(l.id) ? h('a', { class: 'link', href: api.cvUrl(l.id)!, download: l.cv_name }, `Download ${l.cv_name}`) : h('span', { class: 'adm-hint' }, `${l.cv_name} (files are not stored in the demo)`)) : null;
  const dl = h('dl', { class: 'adm-dl' });
  const row = (k: string, v: Node | string) => dl.append(h('dt', {}, k), h('dd', {}, v));
  row('Type', LEAD_TYPE_LABELS[l.type]);
  row('Received', fmtTime(l.created_at));
  row('Email', h('a', { class: 'link', href: `mailto:${l.email}` }, l.email));
  if (l.phone) row('Phone', h('a', { class: 'link', href: `tel:${l.phone.replace(/[^\d+]/g, '')}` }, l.phone));
  if (l.country) row('Based in', l.country);
  if (l.ref_title) row('For', l.ref_title);
  if (l.subject) row('Subject', l.subject);
  if (cv) row('CV', cv);
  if (l.distributed_at) row('Distributed', `${l.distributed_to}, ${fmtTime(l.distributed_at)}`);

  const history = h('ol', { class: 'adm-history', 'aria-label': 'Lead history' }, h('li', { class: 'adm-hint' }, 'Loading history…'));
  api.leadEvents(l.id).then((ev) => {
    history.replaceChildren(...(ev.length ? ev.map((e) => h('li', {}, h('span', { class: 'adm-history__t' }, fmtTime(e.at)), h('span', {}, h('b', {}, e.by || 'system'), ` ${e.detail || e.action}`))) : [h('li', { class: 'adm-hint' }, 'No history yet.')]));
  }).catch(() => history.replaceChildren(h('li', { class: 'adm-hint' }, 'History is unavailable.')));

  const save = h('button', { class: 'btn btn--sm', type: 'button' }, 'Save changes');
  const markDist = h('button', { class: 'btn btn--quiet btn--xs', type: 'button' }, 'Mark distributed now');
  const del = me!.role === 'superadmin' ? h('button', { class: 'btn btn--danger btn--sm', type: 'button' }, 'Delete') : null;
  const s = sheet(l.name, [
    dl,
    h('div', { class: 'adm-msg' }, l.message),
    h('div', { class: 'form__row' }, field('Status', status), field('Owner', assign, 'Who on the team is handling it.')),
    h('div', { class: 'adm-distfield' }, field('Distributed to', dist, 'Set when you hand the lead to a team, partner or branch.'), markDist),
    field('Internal notes', notes, 'Only staff see these.'),
    h('h3', { class: 'adm-sheet__sub' }, 'History'),
    history,
  ], [del, h('a', { class: 'btn btn--quiet btn--sm', href: `mailto:${l.email}?subject=${encodeURIComponent('Re: your enquiry to Mechbridge International')}` }, 'Reply by email'), save].filter(Boolean) as Node[]);

  markDist.addEventListener('click', () => {
    if (!dist.value.trim()) { dist.focus(); toast('Say who it was handed to first.', true); return; }
    status.value = 'distributed';
    save.click();
  });
  save.addEventListener('click', async () => {
    save.setAttribute('aria-busy', 'true');
    try {
      await api.updateLead(l.id, {
        status: status.value as LeadStatus, notes: notes.value, distributed_to: dist.value.trim(),
        assigned_to: assign.value ? Number(assign.value) : null,
      });
      toast('Lead updated'); s.close(); await reload();
    } catch (e) { toast(errMsg(e), true); } finally { save.removeAttribute('aria-busy'); }
  });
  del?.addEventListener('click', async () => {
    if (!confirm(`Delete the lead from ${l.name}? This can't be undone.`)) return;
    try { await api.deleteLead(l.id); toast('Lead deleted'); s.close(); await reload(); } catch (e) { toast(errMsg(e), true); }
  });
}

/* ================= postings (jobs, internships, training batches) ================= */
const PUBLIC_PAGE: Record<PostingKind, string> = { job: '/careers', internship: '/internships', training: '/training' };

async function postings(el: HTMLElement, kind: PostingKind) {
  const L = POSTING_LABELS[kind];
  const q = readQuery();
  const st = { status: (q.status ?? '') as PostingStatus | '', q: q.q ?? '', sort: q.sort ?? '', range: q.range ?? '', from: q.from ?? '', to: q.to ?? '', page: Number(q.page) || 1, pageSize: Number(q.pageSize) || 25 };
  resolveRange(st);
  const add = h('button', { class: 'btn btn--sm', type: 'button', onclick: () => postingSheet(kind, null, () => go()) }, `New ${L.one.toLowerCase()}`);
  el.append(head(L.many, `Open items appear on the ${PUBLIC_PAGE[kind].slice(1)} page straight away. Drafts and closed items stay hidden.`, add));
  const tabsBox = h('div', {}), filters = h('div', { class: 'adm-filters' }), bulkBox = h('div', {}), wrap = h('div', { class: 'adm-table-wrap' }), pagerBox = h('div', {});
  el.append(tabsBox, filters, bulkBox, wrap, pagerBox);
  const sel = new Selection(() => renderBulk());
  let current: Posting[] = [];

  const fQ = h('input', { id: id(), type: 'search', placeholder: 'Title, location, summary…', value: st.q });
  const fSort = h('select', { id: id() }, ...([['', 'Recently updated'], ['start', 'Start date'], ['title', 'Title A–Z'], ['created', 'Newest created']] as const).map(([v, l]) => h('option', { value: v, selected: st.sort === v }, l)));
  filters.append(h('div', { class: 'adm-filters__q' }, field('Search', fQ)), dateRange('Start date', st, () => go(1)), field('Sort', fSort),
    h('div', { class: 'adm-filters__end' }, h('button', { class: 'btn btn--quiet btn--xs', type: 'button', onclick: () => { location.hash = `#/${kind}`; renderShell(); } }, 'Reset filters')));
  fSort.addEventListener('change', () => { st.sort = fSort.value; go(1); });
  let t: number | undefined;
  fQ.addEventListener('input', () => { clearTimeout(t); t = window.setTimeout(() => { st.q = fQ.value.trim(); go(1); }, 300); });

  async function go(page = st.page, pageSize = st.pageSize) {
    st.page = page; st.pageSize = pageSize;
    writeQuery({ status: st.status, q: st.q, sort: st.sort, range: st.range, from: st.range === 'custom' ? st.from : '', to: st.range === 'custom' ? st.to : '', page, pageSize: pageSize === 25 ? '' : pageSize });
    const res = await api.postings({ kind, status: st.status, q: st.q, sort: st.sort, from: st.from, to: st.to, page, pageSize });
    current = res.rows;
    tabsBox.replaceChildren(tabs([
      { value: '', label: 'All', count: res.counts.all }, { value: 'open', label: 'Open', count: res.counts.open },
      { value: 'draft', label: 'Draft', count: res.counts.draft }, { value: 'closed', label: 'Closed', count: res.counts.closed },
    ], st.status, (v) => { st.status = v as PostingStatus; go(1); }));
    renderRows();
    pagerBox.replaceChildren(pager(res.total, res.page, res.pageSize, (p, s) => go(p, s)));
  }
  function renderRows() {
    if (!current.length) { wrap.replaceChildren(h('p', { class: 'adm-empty' }, `No ${L.many.toLowerCase()} match these filters.`)); renderBulk(); return; }
    const ids = current.map((p) => p.id);
    const tbody = h('tbody', {});
    current.forEach((p, i) => tbody.append(h('tr', { class: sel.ids.has(p.id) ? 'is-selected' : '' },
      h('td', { class: 'sel' }, sel.box(ids, i, p.title)),
      h('td', {}, h('button', { class: 'adm-row-link', type: 'button', onclick: () => postingSheet(kind, p, () => go()) }, p.title), h('div', { class: 'muted' }, p.summary)),
      h('td', { class: 'muted' }, [p.location, p.mode].filter(Boolean).join(' · ') || '—'),
      h('td', { class: 'muted nowrap' }, p.start_date ? fmt(p.start_date) : '—'),
      h('td', {}, pill(p.status)),
      h('td', {}, p.applicants ? h('a', { class: 'link', href: `#/leads?ref=${p.id}` }, plural(p.applicants, kind === 'training' ? 'enquiry' : 'application', kind === 'training' ? 'enquiries' : 'applications')) : h('span', { class: 'muted' }, '0')),
      h('td', { class: 'muted nowrap', title: fmtTime(p.updated_at) }, ago(p.updated_at)),
      h('td', { class: 'actions' },
        p.status === 'open' ? h('a', { class: 'btn btn--quiet btn--xs', href: u(`${PUBLIC_PAGE[kind]}#${kind}-${p.slug}`), target: '_blank', rel: 'noopener' }, 'View') : null,
        h('button', { class: 'btn btn--quiet btn--xs', type: 'button', onclick: async () => { try { await api.duplicatePosting(p.id); toast('Duplicated as a draft'); go(); } catch (e) { toast(errMsg(e), true); } } }, 'Duplicate'),
        h('button', { class: 'btn btn--quiet btn--xs', type: 'button', onclick: () => postingSheet(kind, p, () => go()) }, 'Edit')),
    )));
    wrap.replaceChildren(tableEl([sel.all(ids), 'Title', 'Where', 'Starts', 'Status', kind === 'training' ? 'Enquiries' : 'Applications', 'Updated', ''], tbody));
    renderBulk();
  }
  function renderBulk() {
    syncRows(wrap, current.map((x) => x.id), sel);
    const ids = sel.list();
    const run = async (a: Parameters<typeof api.bulkPostings>[1], label: string) => {
      try { toast(`${plural(await api.bulkPostings(ids, a), 'item')} ${label}`); sel.clear(); await go(); } catch (e) { toast(errMsg(e), true); }
    };
    bulkBox.replaceChildren(bulkBar(sel,
      h('button', { class: 'btn btn--sm', type: 'button', onclick: () => run({ action: 'status', value: 'open' }, 'published') }, 'Publish'),
      h('button', { class: 'btn btn--quiet btn--sm', type: 'button', onclick: () => run({ action: 'status', value: 'closed' }, 'closed') }, 'Close'),
      h('button', { class: 'btn btn--quiet btn--sm', type: 'button', onclick: () => run({ action: 'status', value: 'draft' }, 'moved to draft') }, 'Move to draft'),
      h('button', { class: 'btn btn--danger btn--sm', type: 'button', onclick: () => { if (confirm(`Delete ${plural(ids.length, 'item')}? Applications already received stay in Leads.`)) run({ action: 'delete' }, 'deleted'); } }, 'Delete'),
    ));
  }
  await go();
}

function postingSheet(kind: PostingKind, p: Posting | null, reload: () => Promise<void> | void) {
  const L = POSTING_LABELS[kind];
  const title = h('input', { id: id(), required: true, value: p?.title ?? '' });
  const location = h('input', { id: id(), value: p?.location ?? '', placeholder: kind === 'training' ? 'Live sessions' : kind === 'internship' ? 'India and GCC' : 'Dubai, UAE' });
  const mode = h('input', { id: id(), value: p?.mode ?? '', placeholder: kind === 'job' ? 'On-site / Hybrid / Remote' : kind === 'training' ? 'Instructor-led' : 'Supervised project work' });
  const start = h('input', { id: id(), type: 'date', value: p?.start_date ?? '' });
  const summary = h('input', { id: id(), value: p?.summary ?? '', maxlength: '400' });
  const body = h('textarea', { id: id(), rows: '10' }, p?.body ?? '');
  const status = h('select', { id: id() }, ...(['draft', 'open', 'closed'] as const).map((s) => h('option', { value: s, selected: (p?.status ?? 'draft') === s }, { draft: 'Draft (hidden)', open: 'Open (published)', closed: 'Closed (hidden)' }[s])));
  const err = h('p', { class: 'adm-error', role: 'alert' });
  const save = h('button', { class: 'btn btn--sm', type: 'button' }, p ? 'Save changes' : `Create ${L.one.toLowerCase()}`);
  const del = p ? h('button', { class: 'btn btn--danger btn--sm', type: 'button' }, 'Delete') : null;
  const s = sheet(p ? `Edit ${L.one.toLowerCase()}` : `New ${L.one.toLowerCase()}`, [
    field('Title', title),
    h('div', { class: 'form__row' }, field('Location', location), field('Format', mode)),
    h('div', { class: 'form__row' }, field(kind === 'job' ? 'Start date (optional)' : 'Start date', start), field('Status', status)),
    field('One-line summary', summary, 'Shown on the listing card.'),
    field('Full description', body, 'Leave a blank line between paragraphs. Start lines with "- " for a bulleted list; a line just above bullets becomes their heading.'),
    err,
  ], [del, save].filter(Boolean) as Node[]);
  save.addEventListener('click', async () => {
    err.textContent = '';
    if (!title.value.trim()) { err.textContent = 'Add a title.'; title.focus(); return; }
    save.setAttribute('aria-busy', 'true');
    try {
      await api.savePosting({ kind, title: title.value.trim(), location: location.value.trim(), mode: mode.value.trim(), start_date: start.value, summary: summary.value.trim(), body: body.value, status: status.value as Posting['status'] }, p?.id);
      toast(p ? 'Saved' : 'Created'); s.close(); await reload();
    } catch (e) { err.textContent = errMsg(e); } finally { save.removeAttribute('aria-busy'); }
  });
  del?.addEventListener('click', async () => {
    if (!confirm(`Delete "${p!.title}"? Applications already received stay in Leads.`)) return;
    try { await api.deletePosting(p!.id); toast('Deleted'); s.close(); await reload(); } catch (e) { toast(errMsg(e), true); }
  });
  title.focus();
}

/* ================= certificates ================= */
async function certificates(el: HTMLElement) {
  const q = readQuery();
  const st = { status: (q.status ?? '') as '' | 'valid' | 'revoked', q: q.q ?? '', programme: (q.programme ?? '') as '' | 'training' | 'internship', sort: q.sort ?? '', range: q.range ?? '', from: q.from ?? '', to: q.to ?? '', page: Number(q.page) || 1, pageSize: Number(q.pageSize) || 25 };
  resolveRange(st);
  const add = h('button', { class: 'btn btn--sm', type: 'button', onclick: () => certSheet(null, () => go()) }, 'Issue a certificate');
  const exportBtn = h('button', { class: 'btn btn--quiet btn--sm', type: 'button' }, 'Export CSV');
  el.append(head('Certificates', 'Anyone can check a certificate at /verify. Revoked ones show as revoked.', exportBtn, add));
  const tabsBox = h('div', {}), filters = h('div', { class: 'adm-filters' }), bulkBox = h('div', {}), wrap = h('div', { class: 'adm-table-wrap' }), pagerBox = h('div', {});
  el.append(tabsBox, filters, bulkBox, wrap, pagerBox);
  const sel = new Selection(() => renderBulk());
  let current: Certificate[] = [];

  const fQ = h('input', { id: id(), type: 'search', placeholder: 'Code, name, batch…', value: st.q });
  const fProg = h('select', { id: id() }, h('option', { value: '' }, 'All programmes'), h('option', { value: 'training', selected: st.programme === 'training' }, 'Professional training'), h('option', { value: 'internship', selected: st.programme === 'internship' }, 'Internship'));
  const fSort = h('select', { id: id() }, ...([['', 'Newest issued'], ['oldest', 'Oldest issued'], ['name', 'Holder A–Z'], ['code', 'Code']] as const).map(([v, l]) => h('option', { value: v, selected: st.sort === v }, l)));
  filters.append(h('div', { class: 'adm-filters__q' }, field('Search', fQ)), field('Programme', fProg), dateRange('Issued', st, () => go(1)), field('Sort', fSort),
    h('div', { class: 'adm-filters__end' }, h('button', { class: 'btn btn--quiet btn--xs', type: 'button', onclick: () => { location.hash = '#/certificates'; renderShell(); } }, 'Reset filters')));
  fProg.addEventListener('change', () => { st.programme = fProg.value as ''; go(1); });
  fSort.addEventListener('change', () => { st.sort = fSort.value; go(1); });
  let t: number | undefined;
  fQ.addEventListener('input', () => { clearTimeout(t); t = window.setTimeout(() => { st.q = fQ.value.trim(); go(1); }, 300); });
  const filterOf = () => ({ status: st.status, q: st.q, programme: st.programme, sort: st.sort, from: st.from, to: st.to });
  exportBtn.addEventListener('click', async () => download(await api.certificatesCsvUrl(sel.ids.size ? { ids: sel.list() } : filterOf()), `mechbridge-certificates-${isoDay(new Date())}.csv`));

  async function go(page = st.page, pageSize = st.pageSize) {
    st.page = page; st.pageSize = pageSize;
    writeQuery({ ...filterOf(), range: st.range, from: st.range === 'custom' ? st.from : '', to: st.range === 'custom' ? st.to : '', page, pageSize: pageSize === 25 ? '' : pageSize });
    const res = await api.certificates({ ...filterOf(), page, pageSize });
    current = res.rows;
    tabsBox.replaceChildren(tabs([
      { value: '', label: 'All', count: res.counts.all }, { value: 'valid', label: 'Valid', count: res.counts.valid }, { value: 'revoked', label: 'Revoked', count: res.counts.revoked },
    ], st.status, (v) => { st.status = v as ''; go(1); }));
    renderRows();
    pagerBox.replaceChildren(pager(res.total, res.page, res.pageSize, (p, s) => go(p, s)));
  }
  function renderRows() {
    if (!current.length) { wrap.replaceChildren(h('p', { class: 'adm-empty' }, 'No certificates match these filters.')); renderBulk(); return; }
    const ids = current.map((c) => c.id);
    const tbody = h('tbody', {});
    current.forEach((c, i) => {
      const verifyUrl = `${location.origin}${u('/verify')}?code=${c.code}`;
      tbody.append(h('tr', { class: sel.ids.has(c.id) ? 'is-selected' : '' },
        h('td', { class: 'sel' }, sel.box(ids, i, c.code)),
        h('td', { class: 'mono nowrap' }, c.code),
        h('td', {}, h('button', { class: 'adm-row-link', type: 'button', onclick: () => certSheet(c, () => go()) }, c.holder_name), h('div', { class: 'muted' }, c.batch)),
        h('td', { class: 'muted' }, c.programme === 'internship' ? 'Internship' : 'Training'),
        h('td', { class: 'muted nowrap' }, fmt(c.issue_date)),
        h('td', {}, pill(c.status), c.status === 'revoked' && c.revoked_reason ? h('div', { class: 'muted' }, c.revoked_reason) : null),
        h('td', { class: 'actions' },
          h('a', { class: 'btn btn--quiet btn--xs', href: u(`/admin/certificate?id=${c.id}`), target: '_blank', rel: 'noopener' }, 'Print'),
          h('button', { class: 'btn btn--quiet btn--xs', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(verifyUrl); toast('Verification link copied'); } catch { prompt('Copy this link', verifyUrl); } } }, 'Copy link'),
          h('button', { class: 'btn btn--quiet btn--xs', type: 'button', onclick: () => certSheet(c, () => go()) }, 'Edit')),
      ));
    });
    wrap.replaceChildren(tableEl([sel.all(ids), 'Code', 'Holder', 'Programme', 'Issued', 'Status', ''], tbody));
    renderBulk();
  }
  function renderBulk() {
    syncRows(wrap, current.map((x) => x.id), sel);
    const ids = sel.list();
    const run = async (a: Parameters<typeof api.bulkCertificates>[1], label: string) => {
      try { toast(`${plural(await api.bulkCertificates(ids, a), 'certificate')} ${label}`); sel.clear(); await go(); } catch (e) { toast(errMsg(e), true); }
    };
    bulkBox.replaceChildren(bulkBar(sel,
      h('button', { class: 'btn btn--danger btn--sm', type: 'button', onclick: async () => {
        const reason = await ask(`Revoke ${plural(ids.length, 'certificate')}`, 'Reason', { hint: 'Kept in the record. The public check only shows "revoked".', confirm: 'Revoke', danger: true });
        if (reason) run({ action: 'revoke', reason }, 'revoked');
      } }, 'Revoke'),
      h('button', { class: 'btn btn--quiet btn--sm', type: 'button', onclick: () => run({ action: 'restore' }, 'restored') }, 'Restore'),
      h('button', { class: 'btn btn--quiet btn--sm', type: 'button', onclick: async () => download(await api.certificatesCsvUrl({ ids }), `mechbridge-certificates-selected-${isoDay(new Date())}.csv`) }, 'Export selected'),
    ));
  }
  await go();
}

function certSheet(c: Certificate | null, reload: () => Promise<void> | void) {
  const holder = h('input', { id: id(), value: c?.holder_name ?? '', required: true });
  const programme = h('select', { id: id() }, h('option', { value: 'training', selected: c?.programme !== 'internship' }, 'Professional training'), h('option', { value: 'internship', selected: c?.programme === 'internship' }, 'Internship'));
  const title = h('input', { id: id(), value: c?.title ?? 'Professional MEP Engineering Training' });
  programme.addEventListener('change', () => {
    if (!c && ['Professional MEP Engineering Training', 'GCC-Ready Internship Package'].includes(title.value)) title.value = programme.value === 'internship' ? 'GCC-Ready Internship Package' : 'Professional MEP Engineering Training';
  });
  const batch = h('input', { id: id(), value: c?.batch ?? '', placeholder: 'e.g. January 2027 batch' });
  const date = h('input', { id: id(), type: 'date', value: c?.issue_date ?? isoDay(new Date()) });
  const err = h('p', { class: 'adm-error', role: 'alert' });
  const save = h('button', { class: 'btn btn--sm', type: 'button' }, c ? 'Save changes' : 'Issue certificate');
  const extra: Node[] = [];
  if (c) {
    const dl = h('dl', { class: 'adm-dl' }, h('dt', {}, 'Code'), h('dd', { class: 'mono' }, c.code), h('dt', {}, 'Status'), h('dd', {}, pill(c.status)), h('dt', {}, 'Issued by'), h('dd', {}, c.issued_by || '—'));
    if (c.status === 'revoked') dl.append(h('dt', {}, 'Reason'), h('dd', {}, c.revoked_reason));
    extra.push(dl);
  }
  const foot: Node[] = [];
  if (c) {
    foot.push(c.status === 'valid'
      ? h('button', { class: 'btn btn--danger btn--sm', type: 'button', onclick: async () => {
          const reason = await ask('Revoke certificate', 'Reason', { hint: 'Kept in the record. The public check only shows "revoked".', confirm: 'Revoke', danger: true });
          if (!reason) return;
          try { await api.revokeCertificate(c.id, reason); toast('Certificate revoked'); s.close(); await reload(); } catch (e) { toast(errMsg(e), true); }
        } }, 'Revoke')
      : h('button', { class: 'btn btn--quiet btn--sm', type: 'button', onclick: async () => {
          try { await api.restoreCertificate(c.id); toast('Certificate restored'); s.close(); await reload(); } catch (e) { toast(errMsg(e), true); }
        } }, 'Restore'));
    foot.push(h('a', { class: 'btn btn--quiet btn--sm', href: u(`/admin/certificate?id=${c.id}`), target: '_blank', rel: 'noopener' }, 'Print'));
  }
  foot.push(save);
  const s = sheet(c ? 'Certificate' : 'Issue a certificate', [
    ...extra,
    field('Holder’s full name', holder, 'Exactly as it should appear on the certificate.'),
    h('div', { class: 'form__row' }, field('Programme', programme), field('Issue date', date)),
    field('Title', title),
    field('Batch (optional)', batch),
    err,
  ], foot);
  save.addEventListener('click', async () => {
    err.textContent = '';
    const data = { holder_name: holder.value.trim(), programme: programme.value as Certificate['programme'], title: title.value.trim(), batch: batch.value.trim(), issue_date: date.value };
    if (!data.holder_name) { err.textContent = "Add the holder's name."; holder.focus(); return; }
    save.setAttribute('aria-busy', 'true');
    try {
      const saved = c ? await api.updateCertificate(c.id, data) : await api.issueCertificate(data);
      toast(c ? 'Saved' : `Issued ${saved.code}`); s.close(); await reload();
      if (!c) window.open(u(`/admin/certificate?id=${saved.id}`), '_blank', 'noopener');
    } catch (e) { err.textContent = errMsg(e); } finally { save.removeAttribute('aria-busy'); }
  });
  holder.focus();
}

/* ================= users ================= */
async function users(el: HTMLElement) {
  const q = readQuery();
  const st = { role: q.role ?? '', active: q.active ?? '', q: q.q ?? '' };
  const add = h('button', { class: 'btn btn--sm', type: 'button', onclick: () => userSheet(() => load()) }, 'Add a staff account');
  el.append(head('Staff accounts', 'Who can log in, and what each role can do.', add));
  const tabsBox = h('div', {}), filters = h('div', { class: 'adm-filters' }), wrap = h('div', { class: 'adm-table-wrap' });
  el.append(tabsBox, filters, wrap,
    h('div', { class: 'adm-cards', style: 'margin-top:20px' }, ...(Object.keys(ROLE_LABELS) as (keyof typeof ROLE_LABELS)[]).map((r) => h('div', { class: 'adm-card' }, h('span', {}, ROLE_LABELS[r]), h('p', {}, ROLE_NOTES[r])))));
  const fQ = h('input', { id: id(), type: 'search', placeholder: 'Name or email…', value: st.q });
  const fActive = h('select', { id: id() }, h('option', { value: '' }, 'Active and inactive'), h('option', { value: '1', selected: st.active === '1' }, 'Active only'), h('option', { value: '0', selected: st.active === '0' }, 'Inactive only'));
  filters.append(h('div', { class: 'adm-filters__q' }, field('Search', fQ)), field('Status', fActive));
  fQ.addEventListener('input', () => { st.q = fQ.value.trim(); draw(); });
  fActive.addEventListener('change', () => { st.active = fActive.value; draw(); });
  let rows: User[] = [];
  async function load() { rows = await api.users(); staffCache = null; draw(); }
  function draw() {
    writeQuery(st);
    const count = (r: string) => rows.filter((x) => !r || x.role === r).length;
    tabsBox.replaceChildren(tabs([{ value: '', label: 'All', count: rows.length }, ...(Object.keys(ROLE_LABELS) as User['role'][]).map((r) => ({ value: r, label: ROLE_LABELS[r], count: count(r) }))], st.role, (v) => { st.role = v; draw(); }));
    const list = rows.filter((x) => (!st.role || x.role === st.role) && (!st.active || String(Number(x.active)) === st.active) && (!st.q || `${x.name} ${x.email}`.toLowerCase().includes(st.q.toLowerCase())));
    if (!list.length) { wrap.replaceChildren(h('p', { class: 'adm-empty' }, 'No staff accounts match.')); return; }
    const tbody = h('tbody', {});
    for (const x of list) {
      const role = h('select', { 'aria-label': `Role for ${x.name}` }, ...(Object.keys(ROLE_LABELS) as User['role'][]).map((r) => h('option', { value: r, selected: x.role === r }, ROLE_LABELS[r])));
      role.addEventListener('change', async () => {
        try { await api.updateUser(x.id, { role: role.value as User['role'] }); toast('Role updated'); load(); } catch (e) { toast(errMsg(e), true); role.value = x.role; }
      });
      const toggle = h('button', { class: `btn btn--xs ${x.active ? 'btn--quiet' : ''}`, type: 'button' }, x.active ? 'Deactivate' : 'Reactivate');
      toggle.addEventListener('click', async () => {
        try { await api.updateUser(x.id, { active: !x.active }); toast(x.active ? 'Account deactivated' : 'Account reactivated'); load(); } catch (e) { toast(errMsg(e), true); }
      });
      const reset = api.demo ? null : h('button', { class: 'btn btn--quiet btn--xs', type: 'button', onclick: async () => {
        const pw = await ask(`New password for ${x.name}`, 'Temporary password', { hint: 'At least 10 characters. Share it privately; their sessions are signed out.', confirm: 'Set password' });
        if (!pw) return;
        try { await api.updateUser(x.id, { password: pw }); toast('Password reset; their sessions were signed out'); } catch (e) { toast(errMsg(e), true); }
      } }, 'Reset password');
      tbody.append(h('tr', {},
        h('td', {}, h('b', {}, x.name), h('div', { class: 'muted' }, x.email)),
        h('td', {}, x.id === me!.id ? h('span', {}, ROLE_LABELS[x.role], h('span', { class: 'muted' }, ' (you)')) : role),
        h('td', {}, pill(x.active ? 'open' : 'closed', x.active ? 'active' : 'inactive')),
        h('td', { class: 'muted nowrap', title: fmtTime(x.last_login_at ?? '') }, ago(x.last_login_at ?? '')),
        h('td', { class: 'muted nowrap' }, fmt(x.created_at)),
        h('td', { class: 'actions' }, reset, x.id === me!.id ? null : toggle),
      ));
    }
    wrap.replaceChildren(tableEl(['Name', 'Role', 'Status', 'Last login', 'Added', ''], tbody));
  }
  await load();
}

function userSheet(reload: () => Promise<void> | void) {
  const name = h('input', { id: id(), required: true });
  const email = h('input', { id: id(), type: 'email', required: true });
  const role = h('select', { id: id() }, ...(Object.keys(ROLE_LABELS) as User['role'][]).map((r) => h('option', { value: r, selected: r === 'sales' }, `${ROLE_LABELS[r]}: ${ROLE_NOTES[r]}`)));
  const pw = h('input', { id: id(), type: 'text', autocomplete: 'new-password', placeholder: api.demo ? 'Not used in the demo' : 'At least 10 characters' });
  const err = h('p', { class: 'adm-error', role: 'alert' });
  const save = h('button', { class: 'btn btn--sm', type: 'button' }, 'Create account');
  const s = sheet('Add a staff account', [
    field('Full name', name), field('Work email', email), field('Role', role),
    field('Temporary password', pw, api.demo ? `Demo accounts all use ${DEMO_PASSWORD}.` : 'Share it privately. They can change it under My account.'),
    err,
  ], [save]);
  save.addEventListener('click', async () => {
    err.textContent = '';
    save.setAttribute('aria-busy', 'true');
    try { await api.createUser({ name: name.value.trim(), email: email.value.trim(), role: role.value as User['role'], password: pw.value }); toast('Account created'); s.close(); await reload(); }
    catch (e) { err.textContent = errMsg(e); } finally { save.removeAttribute('aria-busy'); }
  });
  name.focus();
}

/* ================= account ================= */
function account(el: HTMLElement) {
  const cur = h('input', { id: id(), type: 'password', autocomplete: 'current-password' });
  const next = h('input', { id: id(), type: 'password', autocomplete: 'new-password' });
  const err = h('p', { class: 'adm-error', role: 'alert' });
  const btn = h('button', { class: 'btn btn--sm', type: 'submit' }, 'Change password');
  const form = h('form', { class: 'form', style: 'max-width:420px' }, field('Current password', cur), field('New password', next, 'At least 10 characters. You will be logged out everywhere.'), err, btn);
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = '';
    try { await api.changePassword(cur.value, next.value); me = null; renderLogin('Password changed. Log in with your new password.'); }
    catch (x) { err.textContent = errMsg(x); }
  });
  el.append(head('My account', `${me!.name} · ${me!.email} · ${ROLE_LABELS[me!.role]}`), form);
}

boot();

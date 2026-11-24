// Mechbridge staff portal. Hash routes: #/ #/leads #/job #/internship #/training #/certificates #/drafter #/mailboxes #/users #/account
// Filters live in the hash query (#/leads?status=new&page=2) so views survive a refresh and can be shared.
// Lists are paged on the server. Text from the database is only ever set with textContent.
import { api, ApiError } from '../../lib/api/client';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, resetDemo } from '../../lib/api/demo';
import type {
  Certificate, Lead, LeadFilter, LeadStatus, LeadType, MailboxList, Perm, Posting, WebmailSettings, PostingKind, PostingStatus, StaffRef, User,
} from '../../lib/api/types';
import { PAGE_SIZES } from '../../lib/api/types';
import {
  ROLE_LABELS, ROLE_NOTES, LEAD_TYPE_LABELS, POSTING_LABELS, LEAD_STATUSES, LEAD_STATUS_LABELS, LEAD_STATUS_NOTES,
  leadTypesFor, postingKindsFor, canManageCertificates, canManageUsers, canSeeLeads, canManageMailboxes,
  MAIL_DOMAIN, mailAddress, mailAddressError, mailPasswordError, mailNameError, PERMS, hasPerm, POSTING_STATUSES, POSTING_STATUS_LABELS,
  WEBMAIL_LANGUAGES, WEBMAIL_TIMEZONES,
} from '../../lib/roles';
import { draftEmailHtml, draftEmailText, signatureHtml, type Signature } from '../../lib/mail-html';
import { detailLabel } from '../../lib/lead-fields';
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
function ask(title: string, label: string, opts: { hint?: string; placeholder?: string; suggestions?: string[]; confirm?: string; danger?: boolean; value?: string; allowEmpty?: boolean } = {}) {
  return new Promise<string | null>((resolve) => {
    const listId = id();
    const input = h('input', { id: id(), placeholder: opts.placeholder ?? '', list: opts.suggestions?.length ? listId : undefined, autocomplete: 'off', value: opts.value ?? '' });
    const dl = opts.suggestions?.length ? h('datalist', { id: listId }, ...opts.suggestions.map((s) => h('option', { value: s }))) : null;
    const err = h('p', { class: 'adm-error', role: 'alert' });
    let done = false;
    const ok = h('button', { class: `btn btn--sm ${opts.danger ? 'btn--danger' : ''}`, type: 'button' }, opts.confirm ?? 'Confirm');
    const s = sheet(title, [field(label, input, opts.hint), dl, err].filter(Boolean) as Node[], [h('button', { class: 'btn btn--quiet btn--sm', type: 'button', onclick: () => s.close() }, 'Cancel'), ok]);
    const submit = () => { if (!opts.allowEmpty && !input.value.trim()) { err.textContent = 'This can’t be empty.'; input.focus(); return; } done = true; resolve(input.value.trim()); s.close(); };
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
    { hash: 'drafter', label: 'Mail drafter', show: hasPerm(user, 'drafter') },
    { hash: 'mailboxes', label: 'Mailboxes', show: canManageMailboxes(user.role) },
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
  const side = h('aside', { class: 'adm-side', id: 'adm-side' },
    h('a', { class: 'adm-side__brand', href: u('/') }, markSvg.cloneNode(true), h('span', {}, h('b', {}, 'Mechbridge'), h('small', {}, 'Staff portal'))),
    h('nav', { class: 'adm-nav', 'aria-label': 'Portal' }, ...nav.map((n) => h('a', { href: `#/${n.hash}`, 'aria-current': n.hash === r ? 'page' : undefined, onclick: () => shell.classList.remove('nav-open') }, n.label))),
    h('div', { class: 'adm-side__foot' },
      h('div', { class: 'adm-side__who' }, h('b', {}, user.name), h('span', {}, `${ROLE_LABELS[user.role]} · ${user.email}`)),
      h('button', { class: 'btn btn--quiet btn--xs', type: 'button', onclick: async () => { await api.logout(); me = null; renderLogin('You are logged out.'); } }, 'Log out'),
    ),
  );
  shell.append(side, main);
  root.replaceChildren(shell);
  // Phones and tablets: a top bar with the menu button and the current page; the sidebar slides in over a scrim.
  const burger = h('button', { class: 'adm-top__menu', type: 'button', 'aria-label': 'Open menu', 'aria-expanded': 'false', 'aria-controls': 'adm-side' },
    h('span', { 'aria-hidden': 'true' }), h('span', { 'aria-hidden': 'true' }), h('span', { 'aria-hidden': 'true' }));
  const setNav = (on: boolean) => {
    shell.classList.toggle('nav-open', on);
    burger.setAttribute('aria-expanded', String(on));
    burger.setAttribute('aria-label', on ? 'Close menu' : 'Open menu');
    if (on) side.querySelector<HTMLElement>('[aria-current="page"], a')?.focus();
  };
  burger.addEventListener('click', () => setNav(!shell.classList.contains('nav-open')));
  shell.addEventListener('keydown', (e) => { if (e.key === 'Escape' && shell.classList.contains('nav-open')) { setNav(false); burger.focus(); } });
  shell.append(h('button', { class: 'adm-scrim', type: 'button', tabindex: '-1', 'aria-hidden': 'true', onclick: () => setNav(false) }));
  main.append(h('div', { class: 'adm-top' }, burger,
    h('a', { class: 'adm-top__brand', href: '#/', 'aria-label': 'Overview' }, markSvg.cloneNode(true)),
    h('span', { class: 'adm-top__title' }, nav.find((n) => n.hash === r)?.label ?? 'Overview')));
  if (api.demo) main.append(h('div', { class: 'adm-banner' }, 'Demo portal: everything you do here is saved only in this browser.', h('button', { type: 'button', onclick: () => { if (confirm('Reset the demo data to its starting state?')) { resetDemo(); location.reload(); } } }, 'Reset demo data')));
  const view = h('div', {});
  main.append(view);
  const views: Record<string, (el: HTMLElement) => Promise<void> | void> = {
    '': overview, leads, job: (el) => postings(el, 'job'), internship: (el) => postings(el, 'internship'), training: (el) => postings(el, 'training'),
    certificates, drafter, mailboxes, users, account,
  };
  Promise.resolve(views[r](view)).then(() => view.querySelectorAll<HTMLElement>('.adm-filters').forEach(foldFilters)).catch(handleErr(view));
}
// On phones the filter fields (apart from search) hide behind a "Filters" button that shows how many are on.
function foldFilters(f: HTMLElement) {
  const fields = Array.from(f.children).filter((c) => !c.classList.contains('adm-filters__q'));
  if (fields.length < 2 || f.querySelector('.adm-filters__toggle')) return;
  const btn = h('button', { class: 'btn btn--quiet btn--sm adm-filters__toggle', type: 'button', 'aria-expanded': 'false' });
  const count = () => Array.from(f.querySelectorAll('select')).filter((x) => x.selectedIndex > 0 && !x.closest('.adm-filters__end')).length;
  const label = () => { const n = count(); btn.textContent = `${f.classList.contains('is-open') ? 'Hide filters' : 'Filters'}${n ? ` · ${n} on` : ''}`; };
  btn.addEventListener('click', () => { f.classList.toggle('is-open'); btn.setAttribute('aria-expanded', String(f.classList.contains('is-open'))); label(); });
  f.addEventListener('change', label);
  const q = f.querySelector('.adm-filters__q');
  q ? q.after(btn) : f.prepend(btn);
  label();
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
    return h('label', { class: 'adm-hit' }, cb);
  }
  all(rowIds: number[]) {
    const allOn = rowIds.length > 0 && rowIds.every((i) => this.ids.has(i));
    const cb = h('input', { type: 'checkbox', 'aria-label': 'Select all on this page', checked: allOn });
    if (!allOn && rowIds.some((i) => this.ids.has(i))) cb.indeterminate = true;
    cb.addEventListener('click', () => { rowIds.forEach((i) => (cb.checked ? this.ids.add(i) : this.ids.delete(i))); this.last = -1; this.onChange(); });
    return h('label', { class: 'adm-hit adm-hit--all' }, cb, h('span', { class: 'adm-hit__txt' }, 'Select all on this page'));
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
const tableEl = (cols: (string | Node)[], body: HTMLTableSectionElement) => {
  body.querySelectorAll('tr').forEach((tr) => Array.from(tr.children).forEach((td, i) => {
    if (!td.hasAttribute('data-label')) td.setAttribute('data-label', typeof cols[i] === 'string' ? (cols[i] as string) : '');
    // One wrapper per cell keeps multi-line content together in the phone card layout.
    if (!td.classList.contains('actions') && !td.classList.contains('sel') && td.childNodes.length > 1) td.replaceChildren(h('div', { class: 'adm-cell' }, ...Array.from(td.childNodes)));
  }));
  return h('table', { class: 'adm-table' }, h('thead', {}, h('tr', {}, ...cols.map((c) => h('th', { scope: 'col' }, c)))), body);
};

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
  // Deep link from the alert email: #/leads?open=<id> opens that lead.
  if (Number(q.open)) leadSheet(Number(q.open), () => go()).catch((e) => toast(errMsg(e), true));
}

async function leadSheet(leadId: number, reload: () => Promise<void> | void) {
  const [l, people] = await Promise.all([api.lead(leadId), staff()]);
  const status = h('select', { id: id() }, ...LEAD_STATUSES.map((s) => h('option', { value: s, selected: l.status === s }, `${LEAD_STATUS_LABELS[s]}: ${LEAD_STATUS_NOTES[s]}`)));
  const assign = h('select', { id: id() }, h('option', { value: '' }, 'Nobody'), ...people.map((p) => h('option', { value: p.id, selected: l.assigned_to === p.id }, `${p.name} (${ROLE_LABELS[p.role]})`)));
  const dist = h('input', { id: id(), value: l.distributed_to, placeholder: 'Team, partner or branch' });
  const notes = h('textarea', { id: id(), rows: '4' }, l.notes);
  const cv = l.cv_name ? (api.cvUrl(l.id) ? h('a', { class: 'link', href: api.cvUrl(l.id)!, download: l.cv_name }, `Download ${l.cv_name}`) : h('span', { class: 'adm-hint' }, `${l.cv_name} (files are not stored in the demo)`)) : null;
  const idDoc = l.id_doc_name ? (api.idDocUrl(l.id) ? h('a', { class: 'link', href: api.idDocUrl(l.id)!, download: l.id_doc_name }, `Download ${l.id_doc_name}`) : h('span', { class: 'adm-hint' }, `${l.id_doc_name} (files are not stored in the demo)`)) : null;
  const dl = h('dl', { class: 'adm-dl' });
  const row = (k: string, v: Node | string) => dl.append(h('dt', {}, k), h('dd', {}, v));
  row('Type', LEAD_TYPE_LABELS[l.type]);
  row('Received', fmtTime(l.created_at));
  row('Email', h('a', { class: 'link', href: `mailto:${l.email}` }, l.email));
  if (l.phone) row('Phone', h('a', { class: 'link', href: `tel:${l.phone.replace(/[^\d+]/g, '')}` }, l.phone));
  if (l.country) row('Based in', l.country);
  if (l.ref_title) row('For', l.ref_title);
  if (l.subject) row('Subject', l.subject);
  for (const [k, v] of Object.entries(l.details ?? {})) row(detailLabel(l.type, k), v);
  if (cv) row('CV', cv);
  if (idDoc) row('Degree or ID', idDoc);
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
  el.append(head(L.many, `Open items appear on the ${PUBLIC_PAGE[kind].slice(1)} page straight away. Closed ones stay listed there as no longer available. Drafts and archived items are hidden.`, add));
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
      { value: 'archived', label: 'Archived', count: res.counts.archived },
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
        p.status === 'open' || p.status === 'closed' ? h('a', { class: 'btn btn--quiet btn--xs', href: u(`${PUBLIC_PAGE[kind]}#${kind}-${p.slug}`), target: '_blank', rel: 'noopener' }, 'View') : null,
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
      h('button', { class: 'btn btn--quiet btn--sm', type: 'button', title: 'Still listed on the website, marked no longer available', onclick: () => run({ action: 'status', value: 'closed' }, 'closed') }, 'Close'),
      h('button', { class: 'btn btn--quiet btn--sm', type: 'button', title: 'Hidden from the website', onclick: () => run({ action: 'status', value: 'archived' }, 'archived') }, 'Archive'),
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
  const status = h('select', { id: id() }, ...POSTING_STATUSES.map((s) => h('option', { value: s, selected: (p?.status ?? 'draft') === s }, `${POSTING_STATUS_LABELS[s].label}: ${POSTING_STATUS_LABELS[s].note.toLowerCase()}`)));
  const err = h('p', { class: 'adm-error', role: 'alert' });
  const save = h('button', { class: 'btn btn--sm', type: 'button' }, p ? 'Save changes' : `Create ${L.one.toLowerCase()}`);
  const del = p ? h('button', { class: 'btn btn--danger btn--sm', type: 'button' }, 'Delete') : null;
  const s = sheet(p ? `Edit ${L.one.toLowerCase()}` : `New ${L.one.toLowerCase()}`, [
    field('Title', title),
    h('div', { class: 'form__row' }, field('Location', location), field('Format', mode)),
    h('div', { class: 'form__row' }, field(kind === 'job' ? 'Start date (optional)' : 'Start date', start), field('Status', status)),
    h('p', { class: 'adm-hint' }, `Closed ${L.many.toLowerCase()} show on the website with a Closed label, the line "${kind === 'job' ? 'This job is no longer available.' : kind === 'internship' ? 'This intake is no longer open.' : 'This batch is no longer open.'}" and a disabled button. Choose Archived to hide one completely.`),
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
  const pFrom = h('input', { id: id(), type: 'date', value: c?.period_from ?? '' });
  const pTo = h('input', { id: id(), type: 'date', value: c?.period_to ?? '' });
  const hours = h('input', { id: id(), value: c?.hours ?? '', placeholder: 'e.g. 120 hours', maxlength: '60' });
  const cmode = h('input', { id: id(), value: c?.mode ?? '', placeholder: 'e.g. Live, instructor-led sessions', maxlength: '80' });
  const grade = h('input', { id: id(), value: c?.grade ?? '', placeholder: 'e.g. Distinction', maxlength: '60' });
  const modules = h('textarea', { id: id(), rows: '4', placeholder: 'One per line, up to 12. For example:\nHVAC design\nFirefighting systems\nPlumbing design' }, c?.modules ?? '');
  const remarks = h('input', { id: id(), value: c?.remarks ?? '', placeholder: 'e.g. Capstone project: MEP design of a G+12 residential tower', maxlength: '200' });
  const signName = h('input', { id: id(), value: c?.signatory_name ?? '', maxlength: '80' });
  const signTitle = h('input', { id: id(), value: c?.signatory_title ?? '', placeholder: 'e.g. Head of Training', maxlength: '80' });
  const anyDetail = !!c && [c.period_from, c.period_to, c.hours, c.mode, c.grade, c.modules, c.remarks, c.signatory_name, c.signatory_title].some(Boolean);
  const more = h('details', { class: 'adm-more', open: anyDetail },
    h('summary', {}, 'More details on the certificate (optional)'),
    h('div', { class: 'adm-more__body' },
      h('p', { class: 'adm-hint' }, 'Filled-in details are printed on the certificate. Leave any of them empty to keep it off.'),
      h('div', { class: 'form__row' }, field('Period from', pFrom), field('Period to', pTo)),
      h('div', { class: 'form__row' }, field('Duration', hours), field('Format', cmode)),
      h('div', { class: 'form__row' }, field('Result or grade', grade), field('Signatory title', signTitle, 'Printed under the signature line.')),
      field('Signatory name (optional)', signName, 'Leave empty to print "Authorised signatory" only.'),
      field('Highlight line', remarks, 'One line under the title.'),
      field('Modules covered', modules),
    ));
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
    more,
    err,
  ], foot);
  save.addEventListener('click', async () => {
    err.textContent = '';
    const data = {
      holder_name: holder.value.trim(), programme: programme.value as Certificate['programme'], title: title.value.trim(), batch: batch.value.trim(), issue_date: date.value,
      period_from: pFrom.value, period_to: pTo.value, hours: hours.value.trim(), mode: cmode.value.trim(), grade: grade.value.trim(),
      modules: modules.value.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 12).join('\n'), remarks: remarks.value.trim(),
      signatory_name: signName.value.trim(), signatory_title: signTitle.value.trim(),
    };
    if (data.period_from && data.period_to && data.period_from > data.period_to) { err.textContent = 'The period ends before it starts.'; more.open = true; pTo.focus(); return; }
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
        h('td', { class: 'adm-primary' }, h('b', {}, x.name), h('div', { class: 'muted' }, x.email)),
        h('td', {}, x.id === me!.id ? h('span', {}, ROLE_LABELS[x.role], h('span', { class: 'muted' }, ' (you)')) : role),
        h('td', {}, x.role === 'superadmin' ? h('span', { class: 'muted' }, 'Everything') : h('div', { class: 'adm-perms' }, ...PERMS.map((p) => {
          const cb = h('input', { type: 'checkbox', checked: x.perms.includes(p.key) });
          cb.addEventListener('change', async () => {
            const next = cb.checked ? [...x.perms, p.key] : x.perms.filter((k) => k !== p.key);
            try { await api.updateUser(x.id, { perms: next }); toast(`${p.label} ${cb.checked ? 'turned on' : 'turned off'} for ${x.name}`); load(); } catch (e) { toast(errMsg(e), true); cb.checked = !cb.checked; }
          });
          return h('label', { class: 'adm-check', title: p.note }, cb, p.label);
        }))),
        h('td', {}, pill(x.active ? 'open' : 'closed', x.active ? 'active' : 'inactive')),
        h('td', { class: 'muted nowrap', title: fmtTime(x.last_login_at ?? '') }, ago(x.last_login_at ?? '')),
        h('td', { class: 'muted nowrap' }, fmt(x.created_at)),
        h('td', { class: 'actions' }, reset, x.id === me!.id ? null : toggle),
      ));
    }
    wrap.replaceChildren(tableEl(['Name', 'Role', 'Extra access', 'Status', 'Last login', 'Added', ''], tbody));
  }
  await load();
}

function userSheet(reload: () => Promise<void> | void) {
  const name = h('input', { id: id(), required: true });
  const email = h('input', { id: id(), type: 'email', required: true });
  const role = h('select', { id: id() }, ...(Object.keys(ROLE_LABELS) as User['role'][]).map((r) => h('option', { value: r, selected: r === 'sales' }, `${ROLE_LABELS[r]}: ${ROLE_NOTES[r]}`)));
  const pw = h('input', { id: id(), type: 'text', autocomplete: 'new-password', placeholder: api.demo ? 'Not used in the demo' : 'At least 10 characters' });
  const permBoxes = PERMS.map((p) => ({ key: p.key, box: h('input', { type: 'checkbox' }), p }));
  const perms = h('fieldset', { class: 'adm-fieldset' }, h('legend', {}, 'Extra access'),
    ...permBoxes.map(({ box, p }) => h('label', { class: 'adm-check' }, box, h('span', {}, h('b', {}, p.label), h('span', { class: 'muted' }, ` · ${p.note}`)))),
    h('p', { class: 'adm-hint' }, 'On top of what the role allows. Superadmins always have it.'));
  const err = h('p', { class: 'adm-error', role: 'alert' });
  const save = h('button', { class: 'btn btn--sm', type: 'button' }, 'Create account');
  const s = sheet('Add a staff account', [
    field('Full name', name), field('Work email', email), field('Role', role),
    field('Temporary password', pw, api.demo ? `Demo accounts all use ${DEMO_PASSWORD}.` : 'Share it privately. They can change it under My account.'),
    perms,
    err,
  ], [save]);
  save.addEventListener('click', async () => {
    err.textContent = '';
    save.setAttribute('aria-busy', 'true');
    try { await api.createUser({ name: name.value.trim(), email: email.value.trim(), role: role.value as User['role'], password: pw.value, perms: permBoxes.filter((x) => x.box.checked).map((x) => x.key as Perm) }); toast('Account created'); s.close(); await reload(); }
    catch (e) { err.textContent = errMsg(e); } finally { save.removeAttribute('aria-busy'); }
  });
  name.focus();
}

/* ================= mailboxes (superadmin) ================= */
const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(0)} KB` : n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${(n / 1024 ** 3).toFixed(2)} GB`);
// 16 random characters in groups of four, without look-alikes (0/O, 1/l/I) or a colon.
function newMailPassword() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const r = crypto.getRandomValues(new Uint32Array(16));
  return Array.from(r, (n, i) => (i && i % 4 === 0 ? '-' : '') + abc[n % abc.length]).join('');
}
async function copyText(text: string, what = 'Copied') {
  try { await navigator.clipboard.writeText(text); toast(what); }
  catch { toast('Copy failed. Select the text and copy it by hand.', true); }
}
// Password input with show, generate and copy. Starts with a generated password.
function passwordField(label: string) {
  const input = h('input', { id: id(), type: 'text', autocomplete: 'new-password', spellcheck: 'false', class: 'mono', value: newMailPassword() });
  const show = h('button', { class: 'btn btn--quiet btn--xs', type: 'button' }, 'Hide');
  show.addEventListener('click', () => { const hidden = input.type === 'password'; input.type = hidden ? 'text' : 'password'; show.textContent = hidden ? 'Hide' : 'Show'; });
  const gen = h('button', { class: 'btn btn--quiet btn--xs', type: 'button', onclick: () => { input.value = newMailPassword(); input.type = 'text'; show.textContent = 'Hide'; } }, 'New password');
  const copy = h('button', { class: 'btn btn--quiet btn--xs', type: 'button', onclick: () => copyText(input.value, 'Password copied') }, 'Copy');
  const tools = h('div', { class: 'adm-pw__tools' }, gen, show, copy);
  const el = h('div', { class: 'field' }, h('label', { for: input.id }, label), input, tools,
    h('p', { class: 'adm-hint' }, '12 to 128 characters, no colon. The generated one is strong, so keep it unless you need your own.'));
  // Once saved, the handover box takes over: lock the field.
  const lock = () => { input.disabled = true; tools.remove(); el.querySelector('.adm-hint')?.remove(); };
  return { el, input, lock };
}
// After a create or reset: the details to hand over. The portal never shows the password again.
function handover(box: HTMLElement, address: string, password: string, webmail: string, domain: string) {
  const text = `Mechbridge email\nAddress: ${address}\nPassword: ${password}\nWebmail: ${webmail}\nIncoming (IMAP): mail.${domain}, port 993, SSL/TLS\nOutgoing (SMTP): mail.${domain}, port 587, STARTTLS\nUsername: ${address}`;
  box.replaceChildren(h('div', { class: 'adm-handover' },
    h('p', {}, h('b', {}, 'Share these details privately.'), ' This is the only time the portal shows this password. If it gets lost, reset it here.'),
    h('dl', { class: 'adm-dl' }, h('dt', {}, 'Address'), h('dd', { class: 'mono' }, address), h('dt', {}, 'Password'), h('dd', { class: 'mono' }, password), h('dt', {}, 'Webmail'), h('dd', {}, webmail)),
    h('div', {}, h('button', { class: 'btn btn--sm', type: 'button', onclick: () => copyText(text, 'Login details copied') }, 'Copy login details')),
  ));
}

async function mailboxes(el: HTMLElement) {
  const q = readQuery();
  const st = { q: q.q ?? '' };
  const add = h('button', { class: 'btn btn--sm', type: 'button' }, 'Create a mailbox');
  const webmailLink = h('a', { class: 'btn btn--quiet btn--sm', href: '#', target: '_blank', rel: 'noopener' }, 'Open webmail');
  el.append(head('Mailboxes', 'Email accounts on @mechbridgegroup.com. Create them, reset passwords and remove them here.', webmailLink, add));
  const note = h('div', {}), filters = h('div', { class: 'adm-filters' }), wrap = h('div', { class: 'adm-table-wrap' }), aliasBox = h('div', {}), settings = h('div', {}), webmailBox = h('div', {});
  el.append(note, filters, wrap, webmailBox, aliasBox, settings);
  const fQ = h('input', { id: id(), type: 'search', placeholder: 'Address…', value: st.q });
  filters.append(h('div', { class: 'adm-filters__q' }, field('Search', fQ)));
  fQ.addEventListener('input', () => { st.q = fQ.value.trim().toLowerCase(); draw(); });

  let data: MailboxList;
  async function load() { data = await api.mailboxes(); draw(); }
  add.addEventListener('click', () => mailboxSheet(data, load));

  function draw() {
    writeQuery(st);
    webmailLink.setAttribute('href', data.webmail);
    const notice = (warn: boolean, title: string, text: string) => h('div', { class: `adm-notice ${warn ? 'adm-notice--warn' : ''}` }, h('b', {}, title), h('p', {}, text));
    note.replaceChildren(...[
      !data.available ? notice(true, 'Mail management isn’t connected on this server yet.', 'Install the mailbox tool and its sudo rule (GO-LIVE.md, step 7.1), then reload this page.')
        : data.mode === 'mock' ? notice(false, 'Local test mode.', 'This computer has no mail server, so changes go to a test file only. On the live server they change real mailboxes.')
        : data.mode === 'demo' ? notice(false, 'Demo.', 'These mailboxes are samples saved in this browser. Nothing reaches a mail server.') : null,
    ].filter(Boolean) as Node[]);
    add.toggleAttribute('disabled', !data.available);
    const list = data.mailboxes.filter((m) => !st.q || m.address.includes(st.q));
    if (!data.available) wrap.replaceChildren(h('p', { class: 'adm-empty' }, 'The mailbox list appears once the mail server is connected.'));
    else if (!list.length) wrap.replaceChildren(h('p', { class: 'adm-empty' }, st.q ? 'No mailboxes match.' : 'No mailboxes yet. Create the first one.'));
    else {
      const tbody = h('tbody', {});
      for (const m of list) {
        tbody.append(h('tr', {},
          h('td', { class: 'adm-primary' }, h('b', { class: 'mono' }, m.address), h('div', { class: m.name ? '' : 'muted' }, m.name || 'No sender name set'), m.core ? h('div', { class: 'muted' }, 'Website alerts arrive here') : null),
          h('td', { class: 'muted nowrap' }, fmtBytes(m.size_bytes)),
          h('td', { class: 'muted nowrap', title: fmtTime(m.created) }, m.created ? fmt(m.created) : 'Before the portal'),
          h('td', { class: 'actions' },
            h('button', { class: 'btn btn--quiet btn--xs', type: 'button', onclick: async () => {
              const name = await ask(`Sender name for ${m.address}`, 'Sender name', { value: m.name, allowEmpty: true, placeholder: 'e.g. Ali Khan or Mechbridge Careers', hint: 'Shown as the From name on mail sent from webmail. Leave empty to clear it. It applies the next time they sign in.', confirm: 'Save name' });
              if (name === null) return;
              const problem = mailNameError(name); if (problem) { toast(problem, true); return; }
              try { await api.setMailboxName(m.address, name); toast(name ? 'Sender name saved' : 'Sender name cleared'); load(); } catch (e) { toast(errMsg(e), true); }
            } }, 'Sender name'),
            h('button', { class: 'btn btn--quiet btn--xs', type: 'button', onclick: () => passwordSheet(data, m.address) }, 'Reset password'),
            h('button', { class: 'btn btn--danger btn--xs', type: 'button', onclick: () => deleteMailboxSheet(m.address, m.core, load) }, 'Delete'),
          ),
        ));
      }
      const total = data.mailboxes.reduce((n, m) => n + m.size_bytes, 0);
      wrap.replaceChildren(tableEl(['Mailbox', 'Storage', 'Created', ''], tbody), h('p', { class: 'adm-table-foot' }, `${plural(data.mailboxes.length, 'mailbox', 'mailboxes')} · ${fmtBytes(total)} stored`));
    }
    aliasBox.replaceChildren(...(data.aliases.length ? [
      h('h2', { class: 'adm-sub' }, 'Forwarding addresses'),
      h('p', { class: 'adm-hint', style: 'margin-bottom:10px' }, 'These addresses have no mailbox of their own. Their mail is delivered to another address. They are set on the server in /etc/postfix/virtual.'),
      h('div', { class: 'adm-table-wrap' }, tableEl(['Address', 'Delivered to'], h('tbody', {}, ...data.aliases.map((a) => h('tr', {}, h('td', { class: 'mono' }, a.from), h('td', { class: 'mono muted' }, a.to)))))),
    ] : []));
    const card = (label: string, value: Node | string, hint: string) => h('div', { class: 'adm-card' }, h('span', {}, label), typeof value === 'string' ? h('p', { class: 'mono' }, value) : value, h('p', { class: 'adm-hint' }, hint));
    const w = data.settings;
    const lang = WEBMAIL_LANGUAGES.find((l) => l[0] === w.language)?.[1] ?? w.language;
    const tz = WEBMAIL_TIMEZONES.find((t) => t[0] === w.timezone)?.[1] ?? w.timezone;
    webmailBox.replaceChildren(...(data.available ? [
      h('div', { class: 'adm-subhead' }, h('h2', { class: 'adm-sub' }, 'Webmail settings for everyone'),
        h('button', { class: 'btn btn--quiet btn--sm', type: 'button', onclick: () => webmailSheet(data, load) }, 'Edit webmail settings')),
      h('div', { class: 'adm-cards adm-mailset' },
        card('Language and time', `${lang}`, tz),
        card('Writing', w.compose_html ? 'HTML' : 'Plain text', `${w.reply_above ? 'Reply above the quote' : 'Reply below the quote'} · drafts saved ${w.autosave_minutes ? `every ${w.autosave_minutes} min` : 'manually'}`),
        card('Company signature', { off: 'Off', empty: 'Where none is set', always: 'Always' }[w.signature], w.signature === 'off' ? 'People write their own.' : 'Built from each sender name.'),
        card('Changes in webmail', w.lock ? 'Locked' : 'Allowed', w.lock ? 'People can’t change these settings.' : 'These are the defaults; people can change them.'),
      ),
    ] : []));
    settings.replaceChildren(
      h('h2', { class: 'adm-sub' }, 'Settings for mail apps'),
      h('div', { class: 'adm-cards adm-mailset' },
        card('Webmail', h('a', { class: 'link mono', href: data.webmail, target: '_blank', rel: 'noopener' }, data.webmail.replace('https://', '')), 'Log in with the full address and its password.'),
        card('Incoming (IMAP)', `mail.${data.domain}`, 'Port 993, SSL/TLS'),
        card('Outgoing (SMTP)', `mail.${data.domain}`, 'Port 587, STARTTLS, with login'),
        card('Username', 'The full address', 'On phones, choose IMAP, not POP or Exchange.'),
      ),
    );
  }
  await load();
}

function mailboxSheet(data: MailboxList, reload: () => Promise<void>) {
  const local = h('input', { id: id(), autocomplete: 'off', spellcheck: 'false', placeholder: 'firstname.lastname', class: 'mono' });
  const pw = passwordField('Password');
  const sender = h('input', { id: id(), autocomplete: 'off', placeholder: 'e.g. Ali Khan or Mechbridge Careers', maxlength: '80' });
  const err = h('p', { class: 'adm-error', role: 'alert' });
  const out = h('div', {});
  const save = h('button', { class: 'btn btn--sm', type: 'button' }, 'Create mailbox');
  const cancel = h('button', { class: 'btn btn--quiet btn--sm', type: 'button', onclick: () => s.close() }, 'Cancel');
  const s = sheet('Create a mailbox', [
    h('div', { class: 'field' }, h('label', { for: local.id }, 'Address'),
      h('div', { class: 'adm-addr' }, local, h('span', { class: 'adm-addr__at mono' }, `@${data.domain}`)),
      h('p', { class: 'adm-hint' }, 'Lowercase letters, numbers, dots, dashes or underscores. Works for a person (firstname@) or a role (accounts@).')),
    field('Sender name (optional)', sender, 'Shown as the From name on mail sent from webmail.'),
    pw.el, err, out,
  ], [cancel, save]);
  local.addEventListener('input', () => { local.value = local.value.toLowerCase().replace(/@.*$/, '').replace(/\s/g, ''); err.textContent = ''; });
  local.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save.click(); } });
  save.addEventListener('click', async () => {
    err.textContent = '';
    const address = mailAddress(local.value), password = pw.input.value;
    const problem = (!local.value ? 'Type the part before the @.' : mailAddressError(address)) || mailNameError(sender.value.trim()) || mailPasswordError(password);
    if (problem) { err.textContent = problem; return; }
    save.setAttribute('aria-busy', 'true');
    try {
      const made = await api.createMailbox(local.value, password, sender.value.trim());
      toast(`${made} created`);
      handover(out, made, password, data.webmail, data.domain);
      local.disabled = true; sender.disabled = true; pw.lock(); save.remove(); cancel.textContent = 'Done';
      await reload();
    } catch (e) { err.textContent = errMsg(e); } finally { save.removeAttribute('aria-busy'); }
  });
  local.focus();
}

function passwordSheet(data: MailboxList, address: string) {
  const pw = passwordField('New password');
  const err = h('p', { class: 'adm-error', role: 'alert' });
  const out = h('div', {});
  const save = h('button', { class: 'btn btn--sm', type: 'button' }, 'Set new password');
  const cancel = h('button', { class: 'btn btn--quiet btn--sm', type: 'button', onclick: () => s.close() }, 'Cancel');
  const s = sheet('Reset password', [
    h('p', {}, 'For ', h('b', { class: 'mono' }, address), '. The old password stops working straight away. Phones and mail apps using it will ask for the new one.'),
    pw.el, err, out,
  ], [cancel, save]);
  save.addEventListener('click', async () => {
    err.textContent = '';
    const password = pw.input.value, problem = mailPasswordError(password);
    if (problem) { err.textContent = problem; return; }
    save.setAttribute('aria-busy', 'true');
    try {
      await api.setMailboxPassword(address, password);
      toast('Password changed');
      handover(out, address, password, data.webmail, data.domain);
      pw.lock(); save.remove(); cancel.textContent = 'Done';
    } catch (e) { err.textContent = errMsg(e); } finally { save.removeAttribute('aria-busy'); }
  });
}

function deleteMailboxSheet(address: string, core: boolean, reload: () => Promise<void>) {
  const confirmIn = h('input', { id: id(), autocomplete: 'off', spellcheck: 'false', class: 'mono', placeholder: address });
  const err = h('p', { class: 'adm-error', role: 'alert' });
  const del = h('button', { class: 'btn btn--danger btn--sm', type: 'button', disabled: true }, 'Delete mailbox');
  const s = sheet('Delete a mailbox', [
    h('p', {}, 'Deleting ', h('b', { class: 'mono' }, address), ' signs it out everywhere. Mail sent to it afterwards bounces back to the sender.'),
    core ? h('div', { class: 'adm-notice adm-notice--warn' }, h('b', {}, 'The website sends lead alerts to this address.'), h('p', {}, 'Alerts will fail until you recreate it or point the website at another address in /etc/mechbridge.env. Leads are still saved in the portal.')) : null,
    h('p', { class: 'adm-hint' }, 'Stored mail is moved to /var/mail/deleted on the server, not erased, so the server administrator can recover it.'),
    field(`Type ${address} to confirm`, confirmIn),
    err,
  ].filter(Boolean) as Node[], [h('button', { class: 'btn btn--quiet btn--sm', type: 'button', onclick: () => s.close() }, 'Cancel'), del]);
  confirmIn.addEventListener('input', () => { del.toggleAttribute('disabled', confirmIn.value.trim().toLowerCase() !== address); });
  del.addEventListener('click', async () => {
    err.textContent = '';
    del.setAttribute('aria-busy', 'true');
    try { await api.deleteMailbox(address); toast(`${address} deleted`); s.close(); await reload(); }
    catch (e) { err.textContent = errMsg(e); } finally { del.removeAttribute('aria-busy'); }
  });
  confirmIn.focus();
}

// Preview frame for email HTML: sandboxed (no scripts) so the portal's styles don't leak in or out.
function mailFrame(title: string) {
  const frame = h('iframe', { class: 'adm-mailframe', title, sandbox: 'allow-same-origin' }) as HTMLIFrameElement;
  const set = (html: string) => {
    // Logos come from this site in the preview, so they show before a deploy; copied mail keeps the live address.
    const local = html.split(`https://${MAIL_DOMAIN}/logo/`).join(`${location.origin}${u('/logo/')}`);
    frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"></head><body style="margin:0;padding:20px;background:#ffffff;">${local}</body></html>`;
  };
  // Grows with its content (images and fonts can arrive after load).
  let ro: ResizeObserver | null = null;
  frame.addEventListener('load', () => {
    const doc = frame.contentDocument;
    if (!doc) return;
    const fit = () => { frame.style.height = `${Math.max(160, doc.documentElement.scrollHeight + 2)}px`; };
    fit();
    ro?.disconnect();
    ro = new ResizeObserver(fit);
    ro.observe(doc.body);
  });
  return { frame, set };
}

function webmailSheet(data: MailboxList, reload: () => Promise<void>) {
  const w = data.settings;
  const sel = (opts: [string, string][], v: string) => h('select', { id: id() }, ...opts.map(([k, l]) => h('option', { value: k, selected: k === v }, l)));
  const check = (label: string, on: boolean, note?: string) => {
    const box = h('input', { type: 'checkbox', checked: on });
    return { box, el: h('label', { class: 'adm-check' }, box, h('span', {}, label, note ? h('span', { class: 'muted' }, ` · ${note}`) : null)) };
  };
  const language = sel(WEBMAIL_LANGUAGES, w.language);
  const timezone = sel(WEBMAIL_TIMEZONES, w.timezone);
  const layout = sel([['widescreen', 'Three columns'], ['desktop', 'Preview under the list'], ['list', 'List only']], w.layout);
  const pageSize = sel([['25', '25'], ['50', '50'], ['100', '100'], ['200', '200']], String(w.page_size));
  const images = sel([['1', 'From people in their contacts'], ['0', 'Never, ask first'], ['3', 'Always']], String(w.show_images));
  const autosave = sel([['0', 'Off'], ['1', 'Every minute'], ['2', 'Every 2 minutes'], ['5', 'Every 5 minutes'], ['10', 'Every 10 minutes']], String(w.autosave_minutes));
  const html = check('Write new mail in HTML', w.compose_html, 'needed for the company signature');
  const above = check('Reply above the quoted message', w.reply_above);
  const lock = check('Apply to everyone and lock', w.lock, 'people can’t change these in webmail');
  const signature = sel([['empty', 'Add it where a mailbox has no signature'], ['always', 'Always use the company signature'], ['off', 'Off, people write their own']], w.signature);
  const sTitle = h('input', { id: id(), value: w.signature_title, maxlength: '120' });
  const sPhone = h('input', { id: id(), value: w.signature_phone, placeholder: 'e.g. +971 4 000 0000', maxlength: '40' });
  const sWeb = h('input', { id: id(), value: w.signature_web, maxlength: '80' });
  const note = h('input', { id: id(), value: w.login_note, maxlength: '200' });
  const preview = mailFrame('Company signature preview');
  const sample: Signature = { name: 'Sender name', title: '', company: '', phone: '', email: `name@${data.domain}`, web: '' };
  const draw = () => preview.set(signature.value === 'off'
    ? `<p style="font:14px Arial,sans-serif;color:#5B6A86;">No company signature. People set their own in webmail.</p>`
    : signatureHtml({ ...sample, company: sTitle.value.trim(), phone: sPhone.value.trim(), web: sWeb.value.trim() }));
  [sTitle, sPhone, sWeb].forEach((x) => x.addEventListener('input', draw));
  signature.addEventListener('change', draw);
  draw();
  const err = h('p', { class: 'adm-error', role: 'alert' });
  const save = h('button', { class: 'btn btn--sm', type: 'button' }, 'Save for everyone');
  const s = sheet('Webmail settings for everyone', [
    h('p', { class: 'adm-hint' }, `These apply to every mailbox at ${data.webmail.replace('https://', '')}. People see them the next time they sign in.`),
    h('div', { class: 'form__row' }, field('Language', language), field('Time zone', timezone)),
    h('div', { class: 'form__row' }, field('Layout', layout), field('Messages per page', pageSize)),
    h('div', { class: 'form__row' }, field('Show pictures in mail', images), field('Save drafts', autosave)),
    h('fieldset', { class: 'adm-fieldset' }, h('legend', {}, 'Writing'), html.el, above.el),
    h('fieldset', { class: 'adm-fieldset' }, h('legend', {}, 'Company signature'),
      field('Signature', signature),
      field('Line under the name', sTitle),
      h('div', { class: 'form__row' }, field('Phone (optional)', sPhone), field('Website', sWeb)),
      h('p', { class: 'adm-hint' }, 'Each person’s sender name and address fill in the top lines.'),
      preview.frame),
    field('Note on the webmail sign-in screen', note),
    h('fieldset', { class: 'adm-fieldset' }, h('legend', {}, 'Who can change them'), lock.el),
    err,
  ], [h('button', { class: 'btn btn--quiet btn--sm', type: 'button', onclick: () => s.close() }, 'Cancel'), save]);
  save.addEventListener('click', async () => {
    err.textContent = '';
    save.setAttribute('aria-busy', 'true');
    const next: WebmailSettings = {
      language: language.value, timezone: timezone.value, layout: layout.value as WebmailSettings['layout'], page_size: Number(pageSize.value),
      show_images: Number(images.value) as WebmailSettings['show_images'], autosave_minutes: Number(autosave.value), compose_html: html.box.checked,
      reply_above: above.box.checked, lock: lock.box.checked, signature: signature.value as WebmailSettings['signature'],
      signature_title: sTitle.value.trim(), signature_phone: sPhone.value.trim(), signature_web: sWeb.value.trim(), login_note: note.value.trim(),
    };
    try { await api.saveWebmailSettings(next); toast('Webmail settings saved for everyone'); s.close(); await reload(); }
    catch (e) { err.textContent = errMsg(e); } finally { save.removeAttribute('aria-busy'); }
  });
}

/* ================= mail drafter (per-person access) ================= */
const DRAFT_KEY = 'mb-drafter-v1';
interface DraftState { text: string; letterhead: boolean; sign: boolean; sig: Signature }
const DRAFT_SAMPLE = `Dear Omar,

Thank you for your enquiry about the HVAC and firefighting design for your G+12 residential tower in Dubai Marina.

Our proposal covers:
- Heat load calculations and equipment selection
- Chilled water and ventilation design to IFC stage
- Sprinkler, hydrant and pump room design to UAE Fire Code

Next steps
1. Share the architectural drawings in CAD
2. We confirm the scope and programme within three working days

> We can start as soon as the drawings arrive.

Kind regards,`;

function drafter(el: HTMLElement) {
  let saved: Partial<DraftState> = {};
  try { saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}'); } catch { /* storage blocked */ }
  const st: DraftState = {
    text: saved.text ?? '', letterhead: saved.letterhead ?? false, sign: saved.sign ?? true,
    sig: { name: me!.name, title: '', company: 'Mechbridge International MEP Consultants', phone: '', email: me!.email, web: 'mechbridgegroup.com', ...(saved.sig ?? {}) },
  };
  const text = h('textarea', { id: id(), class: 'adm-drafter__text', rows: '16', placeholder: DRAFT_SAMPLE, spellcheck: 'true' }, st.text);
  const letter = h('input', { type: 'checkbox', checked: st.letterhead });
  const sign = h('input', { type: 'checkbox', checked: st.sign });
  const sigInputs = (['name', 'title', 'company', 'phone', 'email', 'web'] as const).map((k) => [k, h('input', { id: id(), value: st.sig[k], maxlength: '120' })] as const);
  const sigLabels = { name: 'Name', title: 'Job title', company: 'Company', phone: 'Phone', email: 'Email', web: 'Website' };
  const preview = mailFrame('Email preview');
  const copyBtn = h('button', { class: 'btn btn--sm', type: 'button' }, 'Copy for email');
  const codeBtn = h('button', { class: 'btn btn--quiet btn--sm', type: 'button' }, 'Copy HTML code');
  const sampleBtn = h('button', { class: 'btn btn--quiet btn--sm', type: 'button' }, 'Try a sample');
  const clearBtn = h('button', { class: 'btn btn--quiet btn--sm', type: 'button' }, 'Clear');

  const current = () => {
    st.text = text.value; st.letterhead = letter.checked; st.sign = sign.checked;
    sigInputs.forEach(([k, i]) => { st.sig[k] = i.value.trim(); });
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(st)); } catch { /* storage blocked: still works for this visit */ }
    const sig = st.sign ? st.sig : null;
    const source = st.text.trim() ? st.text : DRAFT_SAMPLE;
    return { html: draftEmailHtml(source, { letterhead: st.letterhead, signature: sig }), plain: draftEmailText(source, sig), empty: !st.text.trim() };
  };
  let t: number | undefined;
  const draw = () => { const c = current(); preview.set(c.html); copyBtn.toggleAttribute('disabled', c.empty); codeBtn.toggleAttribute('disabled', c.empty); };
  const later = () => { clearTimeout(t); t = window.setTimeout(draw, 150); };
  [text, ...sigInputs.map(([, i]) => i)].forEach((x) => x.addEventListener('input', later));
  [letter, sign].forEach((x) => x.addEventListener('change', draw));

  copyBtn.addEventListener('click', async () => {
    const { html, plain } = current();
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([plain], { type: 'text/plain' }) })]);
      toast('Copied. Paste it into the body of your email.');
    } catch {
      // Older browsers: copy the rendered preview as a selection instead.
      const box = h('div', { contenteditable: 'true', style: 'position:fixed;left:-9999px;top:0;' });
      box.innerHTML = html; // built from escaped text only (src/lib/mail-html.ts)
      document.body.append(box);
      const range = document.createRange(); range.selectNodeContents(box);
      const selection = getSelection()!; selection.removeAllRanges(); selection.addRange(range);
      const ok = document.execCommand('copy');
      selection.removeAllRanges(); box.remove();
      toast(ok ? 'Copied. Paste it into the body of your email.' : 'Copy failed. Select the preview and copy it by hand.', !ok);
    }
  });
  codeBtn.addEventListener('click', () => copyText(current().html, 'HTML code copied'));
  sampleBtn.addEventListener('click', () => { text.value = DRAFT_SAMPLE; draw(); text.focus(); });
  clearBtn.addEventListener('click', () => { text.value = ''; draw(); text.focus(); });

  el.append(
    head('Mail drafter', 'Write in plain text. Copy the result and paste it into webmail, Outlook or Gmail in the Mechbridge style.'),
    h('div', { class: 'adm-drafter' },
      h('div', { class: 'adm-drafter__in' },
        field('Your text', text),
        h('details', { class: 'adm-more' }, h('summary', {}, 'How to format'),
          h('ul', { class: 'adm-help' },
            h('li', {}, 'Leave a blank line between paragraphs.'),
            h('li', {}, 'Start lines with "- " for bullets, or "1. " for numbered steps. A line just above them becomes their heading.'),
            h('li', {}, 'A short line in CAPITALS, or starting with "# ", becomes a heading.'),
            h('li', {}, 'Start lines with "> " for a highlighted note.'),
            h('li', {}, 'Wrap words in **double stars** for bold, or _underscores_ for italics.'),
            h('li', {}, 'Web and email addresses become links. A line of "---" adds a divider.'))),
        h('div', { class: 'adm-drafter__opts' },
          h('label', { class: 'adm-check' }, letter, h('span', {}, 'Letterhead', h('span', { class: 'muted' }, ' · navy header and footer'))),
          h('label', { class: 'adm-check' }, sign, h('span', {}, 'Signature'))),
        h('details', { class: 'adm-more' }, h('summary', {}, 'Your signature'),
          h('div', { class: 'adm-more__body' },
            h('p', { class: 'adm-hint' }, 'Saved in this browser only. Leave a line empty to keep it off.'),
            h('div', { class: 'form__row' }, ...sigInputs.slice(0, 2).map(([k, i]) => field(sigLabels[k], i))),
            field(sigLabels.company, sigInputs[2][1]),
            h('div', { class: 'form__row' }, ...sigInputs.slice(3, 5).map(([k, i]) => field(sigLabels[k], i))),
            field(sigLabels.web, sigInputs[5][1]))),
        h('div', { class: 'btn-row' }, sampleBtn, clearBtn)),
      h('div', { class: 'adm-drafter__out' },
        h('div', { class: 'adm-subhead' }, h('h2', { class: 'adm-sub' }, 'Preview'), h('div', { class: 'btn-row' }, codeBtn, copyBtn)),
        preview.frame,
        h('p', { class: 'adm-hint' }, 'The preview shows a sample until you type. "Copy for email" keeps the formatting when you paste into the message body. Pictures load from mechbridgegroup.com.'))),
  );
  draw();
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

// Renders open postings (jobs, internship intakes, training batches) from the client API.
// All text is set with textContent, never innerHTML, because postings are staff-entered.
import { api } from '../lib/api/client';
import type { Posting, PostingKind } from '../lib/api/types';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

export const fmtDate = (iso: string) =>
  iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

// Plain text → paragraphs and "- " bullet lists.
export function renderBody(text: string) {
  const frag = document.createDocumentFragment();
  for (const block of text.split(/\n\s*\n/)) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    if (lines.every((l) => l.startsWith('- '))) {
      const ul = el('ul', 'post__list');
      lines.forEach((l) => ul.append(el('li', '', l.slice(2))));
      frag.append(ul);
    } else if (lines.length > 1 && lines.slice(1).every((l) => l.startsWith('- '))) {
      frag.append(el('h4', 'post__sub', lines[0]));
      const ul = el('ul', 'post__list');
      lines.slice(1).forEach((l) => ul.append(el('li', '', l.slice(2))));
      frag.append(ul);
    } else {
      frag.append(el('p', 'body', lines.join(' ')));
    }
  }
  return frag;
}

interface Opts {
  kind: PostingKind;
  root: HTMLElement; // container; gets cards appended
  empty: string; // message when nothing is open
  action: string; // button label
  onPick: (p: Posting) => void; // apply / enquire about this posting
  details?: boolean; // show the full body in an expandable panel
}

export async function mountPostings({ kind, root, empty, action, onPick, details = false }: Opts) {
  root.setAttribute('aria-busy', 'true');
  root.replaceChildren(el('p', 'post__state body', 'Loading…'));
  try {
    const list = await api.listPostings(kind);
    root.replaceChildren();
    if (!list.length) { root.append(el('p', 'post__state body', empty)); return list; }
    for (const p of list) {
      const card = el('article', 'post');
      card.id = `${kind}-${p.slug}`;
      const meta = el('p', 'post__meta mono');
      meta.textContent = [p.location, p.mode, p.start_date && `Starts ${fmtDate(p.start_date)}`].filter(Boolean).join(' · ');
      card.append(el('h3', 'post__t', p.title), meta);
      if (p.summary) card.append(el('p', 'post__s body', p.summary));
      if (details && p.body) {
        const d = el('details', 'post__more');
        d.append(el('summary', '', 'Read the full description'));
        const b = el('div', 'post__body');
        b.append(renderBody(p.body));
        d.append(b);
        card.append(d);
      }
      const btn = el('button', 'btn btn--sm post__go', action);
      btn.type = 'button';
      btn.addEventListener('click', () => onPick(p));
      card.append(btn);
      root.append(card);
    }
    // Deep link: #job-<slug> opens that card.
    const target = location.hash && root.querySelector<HTMLElement>(location.hash);
    if (target) { target.querySelector('details')?.setAttribute('open', ''); target.scrollIntoView({ block: 'center' }); }
    return list;
  } catch {
    root.replaceChildren(el('p', 'post__state body', 'Listings could not load right now. You can still send the form below.'));
    return [];
  } finally {
    root.removeAttribute('aria-busy');
  }
}

// Point the page's enquiry form at a posting and scroll to it.
export function pickInForm(formId: string, p: Posting, note: HTMLElement | null) {
  const form = document.getElementById(formId) as HTMLFormElement | null;
  if (!form) return;
  (form.querySelector('[data-ref]') as HTMLInputElement).value = String(p.id);
  if (note) { note.hidden = false; note.querySelector('[data-ref-title]')!.textContent = p.title; }
  const smoother = (window as any).__smoother;
  const section = form.closest('section') ?? form;
  smoother ? smoother.scrollTo(section, true, 'top 90px') : section.scrollIntoView({ behavior: 'smooth' });
  setTimeout(() => (form.querySelector('input[name="name"]') as HTMLInputElement)?.focus({ preventScroll: true }), 700);
}

export function clearPick(formId: string, note: HTMLElement | null) {
  const form = document.getElementById(formId) as HTMLFormElement | null;
  if (form) (form.querySelector('[data-ref]') as HTMLInputElement).value = '';
  if (note) note.hidden = true;
}

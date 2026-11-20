// Themed dropdowns for every <select> on the site and in the staff portal.
// The real <select> stays in place (forms, labels, validation and select.value keep working) and shows the
// chosen value; only the browser's native option popup is replaced by a rounded list that copies the colours
// of the field it opens from. Opt out with <select data-native>. Multiple / size>1 selects are left alone.

let uid = 0;
let open: { sel: HTMLSelectElement; pop: HTMLElement; wrap: HTMLElement; active: number; raf: number; typed: string; typedAt: number } | null = null;

const enabledIndexes = (sel: HTMLSelectElement) => Array.from(sel.options).map((o, i) => (o.disabled || (o.parentElement as HTMLOptGroupElement | null)?.disabled ? -1 : i)).filter((i) => i >= 0);

// First ancestor (or the element) with a visible background colour.
function opaqueBg(el: Element | null): string {
  for (let e = el; e; e = e.parentElement) {
    const c = getComputedStyle(e).backgroundColor;
    if (c && c !== 'transparent' && !/rgba?\(.*,\s*0\)$/.test(c)) return c;
  }
  return 'rgb(255, 255, 255)';
}
function isDark(rgb: string) {
  const [r, g, b] = (rgb.match(/[\d.]+/g) ?? ['255', '255', '255']).map(Number);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
}

function enhance(sel: HTMLSelectElement) {
  if (sel.multiple || sel.size > 1 || sel.hasAttribute('data-native') || sel.parentElement?.classList.contains('msel')) return;
  const wrap = document.createElement('span');
  wrap.className = 'msel';
  sel.parentNode!.insertBefore(wrap, sel);
  wrap.append(sel);
  sel.classList.add('msel__el');
  wrap.addEventListener('click', (e) => {
    if (sel.disabled) return;
    e.preventDefault();
    sel.focus({ preventScroll: true });
    open?.sel === sel ? close() : show(sel);
  });
  sel.addEventListener('keydown', (e) => onKey(sel, e));
  sel.addEventListener('blur', () => { if (open?.sel === sel) setTimeout(() => { if (open?.sel === sel && document.activeElement !== sel) close(); }, 0); });
}

function show(sel: HTMLSelectElement) {
  close();
  const wrap = sel.parentElement as HTMLElement;
  const pop = document.createElement('div');
  pop.className = 'msel-pop';
  pop.id = `msel-${++uid}`;
  pop.setAttribute('role', 'listbox');
  const label = sel.labels?.[0]?.textContent?.trim() || sel.getAttribute('aria-label') || '';
  if (label) pop.setAttribute('aria-label', label);
  // Colours follow the field: its background (or the nearest one behind it), text and border.
  const cs = getComputedStyle(sel);
  const bg = opaqueBg(sel);
  pop.style.setProperty('--msel-bg', bg);
  pop.style.setProperty('--msel-fg', cs.color);
  pop.style.setProperty('--msel-line', cs.borderTopColor);
  pop.style.setProperty('--msel-accent', isDark(bg) ? 'var(--red-300, #e8868d)' : 'var(--red-500, #b11722)');
  pop.style.fontFamily = cs.fontFamily;

  let group: HTMLOptGroupElement | null = null;
  Array.from(sel.options).forEach((o, i) => {
    const g = o.parentElement instanceof HTMLOptGroupElement ? o.parentElement : null;
    if (g && g !== group) {
      const head = document.createElement('div');
      head.className = 'msel-group';
      head.setAttribute('role', 'presentation');
      head.textContent = g.label;
      pop.append(head);
    }
    group = g;
    const item = document.createElement('div');
    item.className = 'msel-opt';
    item.id = `${pop.id}-${i}`;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', String(i === sel.selectedIndex));
    if (o.disabled || g?.disabled) item.setAttribute('aria-disabled', 'true');
    item.dataset.i = String(i);
    item.textContent = o.textContent;
    pop.append(item);
  });
  pop.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus on the select
  pop.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.msel-opt');
    if (!item || item.getAttribute('aria-disabled') === 'true') return;
    choose(Number(item.dataset.i));
  });
  pop.addEventListener('mousemove', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.msel-opt');
    if (item && item.getAttribute('aria-disabled') !== 'true') setActive(Number(item.dataset.i), false);
  });

  (sel.closest('dialog[open]') ?? document.body).append(pop);
  wrap.classList.add('is-open');
  sel.setAttribute('aria-expanded', 'true');
  sel.setAttribute('aria-controls', pop.id);
  open = { sel, pop, wrap, active: -1, raf: 0, typed: '', typedAt: 0 };
  setActive(sel.selectedIndex >= 0 ? sel.selectedIndex : enabledIndexes(sel)[0] ?? -1, true);
  place();
  document.addEventListener('pointerdown', outside, true);
  window.addEventListener('resize', close);
}

// Keeps the list attached to its field while the page scrolls (also under GSAP ScrollSmoother).
function place() {
  if (!open) return;
  const { sel, pop } = open;
  if (!sel.isConnected) { close(); return; }
  const r = sel.getBoundingClientRect();
  const vw = document.documentElement.clientWidth, vh = window.innerHeight, gap = 6, margin = 8;
  if (r.bottom < 0 || r.top > vh) { close(); return; }
  const width = Math.min(Math.max(r.width, 180), vw - margin * 2);
  const below = vh - r.bottom - gap - margin, above = r.top - gap - margin;
  const natural = Math.min(pop.scrollHeight + 2, 320);
  const up = below < Math.min(natural, 200) && above > below;
  const maxH = Math.max(120, Math.min(320, up ? above : below));
  pop.style.width = `${width}px`;
  pop.style.maxHeight = `${maxH}px`;
  pop.style.left = `${Math.min(Math.max(margin, r.left), vw - width - margin)}px`;
  pop.style.top = up ? `${Math.max(margin, r.top - gap - Math.min(natural, maxH))}px` : `${r.bottom + gap}px`;
  pop.toggleAttribute('data-up', up);
  open.raf = requestAnimationFrame(place);
}

function setActive(i: number, scroll: boolean) {
  if (!open) return;
  open.active = i;
  open.pop.querySelectorAll('.msel-opt.is-active').forEach((x) => x.classList.remove('is-active'));
  const item = open.pop.querySelector<HTMLElement>(`[data-i="${i}"]`);
  if (!item) { open.sel.removeAttribute('aria-activedescendant'); return; }
  item.classList.add('is-active');
  open.sel.setAttribute('aria-activedescendant', item.id);
  if (scroll) item.scrollIntoView({ block: 'nearest' });
}

function choose(i: number) {
  if (!open) return;
  const { sel } = open;
  close();
  if (i >= 0 && i !== sel.selectedIndex) {
    sel.selectedIndex = i;
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }
  sel.focus({ preventScroll: true });
}

function close() {
  if (!open) return;
  cancelAnimationFrame(open.raf);
  open.pop.remove();
  open.wrap.classList.remove('is-open');
  open.sel.setAttribute('aria-expanded', 'false');
  open.sel.removeAttribute('aria-activedescendant');
  open.sel.removeAttribute('aria-controls');
  open = null;
  document.removeEventListener('pointerdown', outside, true);
  window.removeEventListener('resize', close);
}
function outside(e: Event) {
  if (!open) return;
  const t = e.target as Node;
  if (!open.pop.contains(t) && !open.wrap.contains(t)) close();
}

function onKey(sel: HTMLSelectElement, e: KeyboardEvent) {
  const isOpen = open?.sel === sel;
  if (!isOpen) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' ', 'F4'].includes(e.key)) { e.preventDefault(); if (!sel.disabled) show(sel); }
    return; // letters keep the native type-to-select behaviour
  }
  const list = enabledIndexes(sel);
  const pos = list.indexOf(open!.active);
  const move = (to: number) => { e.preventDefault(); setActive(list[Math.max(0, Math.min(list.length - 1, to))], true); };
  switch (e.key) {
    case 'ArrowDown': return move(pos + 1);
    case 'ArrowUp': return move(pos < 0 ? 0 : pos - 1);
    case 'PageDown': return move(pos + 8);
    case 'PageUp': return move(pos - 8);
    case 'Home': return move(0);
    case 'End': return move(list.length - 1);
    case 'Enter': case ' ': e.preventDefault(); return choose(open!.active);
    case 'Escape': e.preventDefault(); e.stopPropagation(); close(); return; // don't also close a surrounding dialog
    case 'Tab': close(); return;
  }
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    const now = Date.now();
    open!.typed = (now - open!.typedAt > 700 ? '' : open!.typed) + e.key.toLowerCase();
    open!.typedAt = now;
    const hit = list.find((i) => (sel.options[i].textContent ?? '').trim().toLowerCase().startsWith(open!.typed));
    if (hit !== undefined) setActive(hit, true);
  }
}

function scan(root: ParentNode) {
  if (root instanceof HTMLSelectElement) enhance(root);
  else root.querySelectorAll?.('select').forEach((s) => enhance(s as HTMLSelectElement));
}

export function initSelects() {
  if ((window as unknown as { __msel?: boolean }).__msel) return;
  (window as unknown as { __msel?: boolean }).__msel = true;
  // Pages that don't load this script keep native selects with the custom chevron (see .msel in global.css).
  document.documentElement.classList.add('msel-on');
  scan(document);
  new MutationObserver((records) => {
    for (const r of records) r.addedNodes.forEach((n) => { if (n.nodeType === 1) scan(n as Element); });
  }).observe(document.documentElement, { childList: true, subtree: true });
}

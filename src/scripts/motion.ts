import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText);

const ease = 'expo.out';

export function initMotion() {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nav = document.querySelector<HTMLElement>('[data-nav]');

  // Smooth scroll on desktop pointers only; phones keep native scrolling.
  const fine = matchMedia('(pointer: fine) and (min-width: 1024px)').matches;
  if (!reduced && fine) {
    (window as any).__smoother = ScrollSmoother.create({
      wrapper: '#smooth-wrapper',
      content: '#smooth-content',
      smooth: 1.05,
      effects: true,
      normalizeScroll: false,
    });
    // In-page anchors go through the smoother.
    document.querySelectorAll<HTMLAnchorElement>('a[href^="#"], a[href*="#"]').forEach((a) => {
      const url = new URL(a.href, location.href);
      if (url.pathname !== location.pathname || !url.hash) return;
      a.addEventListener('click', (e) => {
        const target = document.querySelector(url.hash);
        if (!target) return;
        e.preventDefault();
        (window as any).__smoother.scrollTo(target, true, 'top 90px');
        history.replaceState(null, '', url.hash);
      });
    });
    if (location.hash) {
      const t = document.querySelector(location.hash);
      if (t) requestAnimationFrame(() => (window as any).__smoother.scrollTo(t, false, 'top 90px'));
    }
  }

  // Nav compacts once the page moves.
  ScrollTrigger.create({
    start: 40,
    end: 'max',
    onToggle: (self) => nav?.classList.toggle('is-scrolled', self.isActive),
  });

  if (reduced) {
    root.classList.add('motion-ready');
    return;
  }

  document.fonts.ready.then(() => {
    // Hero entrance: headline lines rise out of a mask, the rest follows once.
    document.querySelectorAll<HTMLElement>('[data-enter]').forEach((hero) => {
      const tl = gsap.timeline({ defaults: { ease, duration: 1.3 } });
      const h1 = hero.querySelector<HTMLElement>('h1');
      const photo = hero.querySelector<HTMLElement>('[data-hero-photo]');
      if (photo) tl.from(photo, { scale: 1.12, duration: 2.4, ease: 'power3.out' }, 0);
      if (h1) {
        const split = SplitText.create(h1, { type: 'lines', mask: 'lines', linesClass: 'line' });
        tl.from(split.lines, { yPercent: 110, stagger: 0.09 }, 0.15);
      }
      hero.querySelectorAll<HTMLElement>('[data-enter-item]').forEach((el, i) => {
        tl.from(el, { y: 28, opacity: 0, filter: 'blur(8px)', duration: 1.1 }, 0.45 + i * 0.1);
      });
    });
    root.classList.add('motion-ready');

    // Section headings: lines rise out of their mask as they arrive.
    document.querySelectorAll<HTMLElement>('[data-split]').forEach((el) => {
      const split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'line' });
      gsap.from(split.lines, {
        yPercent: 110, duration: 1.2, ease, stagger: 0.08,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
    });

    // Photos open from a narrow band.
    document.querySelectorAll<HTMLElement>('[data-reveal-img]').forEach((el) => {
      if (el.closest('[data-enter]')) return;
      gsap.fromTo(el, { clipPath: 'inset(14% 6% 14% 6% round 6px)' }, {
        clipPath: 'inset(0% 0% 0% 0% round 6px)', duration: 1.4, ease,
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      });
    });

    // Big numerals count once (only real numbers, e.g. 15+).
    document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
      const end = Number(el.dataset.count);
      const obj = { v: 0 };
      gsap.to(obj, {
        v: end, duration: 1.6, ease: 'power3.out',
        onUpdate: () => { el.textContent = String(Math.round(obj.v)); },
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      });
    });

    ScrollTrigger.refresh();
  });
}

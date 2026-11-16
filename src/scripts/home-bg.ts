import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Mounts the clay scroll scene behind the home page's ten sections.
// Sections keep their natural heights; the scene gets the real boundaries ("bands")
// so each clay piece and ground colour stays with its own section at every width.
export function initClay() {
  const clay = document.getElementById('clay');
  const canvas = document.getElementById('clay-stage') as HTMLCanvasElement | null;
  const ground = document.getElementById('clay-ground');
  if (!clay || !canvas || !ground) return;
  const sections = Array.from(clay.querySelectorAll<HTMLElement>(':scope > .cs'));
  const parse = (s?: string) => { try { return s ? JSON.parse(s) : undefined; } catch { return undefined; } };

  const props: Record<string, unknown> = {
    motion: 'Scroll',
    stopMotion: false,
    colorShift: true,
    paintTarget: ground,
    layout: parse(clay.dataset.layout),
    mobileLayout: parse(clay.dataset.layoutMobile),
  };

  const measure = () => {
    const H = clay.offsetHeight;
    if (!H || sections.length !== 10) return;
    const bands = sections.map((s) => +(s.offsetTop / H).toFixed(5));
    bands.push(1);
    props.bands = bands;
  };

  measure();
  document.fonts.ready.then(() => { measure(); ScrollTrigger.refresh(); });
  new ResizeObserver(() => measure()).observe(clay);

  const mount = () => {
    const bg = (window as any).MechBridgeBackground;
    if (!bg) return false;
    bg.mount(clay, canvas, props);
    return true;
  };
  if (!mount()) window.addEventListener('load', () => mount(), { once: true });
}

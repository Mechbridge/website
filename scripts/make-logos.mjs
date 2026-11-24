// Builds the Mechbridge logo kit in logo-kit/: every lockup in every colour, as SVG and transparent PNG.
//   node scripts/make-logos.mjs
// Source artwork: src/data/logo-inner.svg (skyscraper "M" monogram + MECHBRIDGE wordmark).
// The extra lines are set in the site's own typefaces and converted to outlines, so the SVGs need no fonts:
//   INTERNATIONAL    Geist, weight 600, tracked to the wordmark's width
//   MEP CONSULTANTS  Geist Mono, weight 500, tracked to the wordmark's width
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import sharp from 'sharp';
import { create } from 'fontkitten';

const OUT = 'logo-kit';
const PNG_LONG_SIDE = 2000; // px

const COLORS = {
  navy: { mark: '#1A2841', text: '#1A2841', rule: '#1A2841', bg: '#F0E1CE', note: 'Midnight Navy, for light backgrounds' },
  cream: { mark: '#F0E1CE', text: '#F0E1CE', rule: '#F0E1CE', bg: '#1A2841', note: 'Old Cream, for navy and dark backgrounds' },
  white: { mark: '#FFFFFF', text: '#FFFFFF', rule: '#FFFFFF', bg: '#0D1523', note: 'White, for photos and dark backgrounds' },
  black: { mark: '#000000', text: '#000000', rule: '#000000', bg: '#FFFFFF', note: 'Black, for one-colour print' },
  red: { mark: '#B11722', text: '#B11722', rule: '#B11722', bg: '#FBF8F3', note: 'Vintage Red, for light backgrounds' },
  duo: { mark: '#B11722', text: '#1A2841', rule: '#B11722', bg: '#FBF8F3', note: 'Red monogram with navy lettering, for light backgrounds' },
};

/* ---------- source artwork: monogram and wordmark ---------- */
const inner = readFileSync('src/data/logo-inner.svg', 'utf8');
const paths = inner.match(/<path\b[\s\S]*?\/>/g) ?? [];
const clean = (p) => p.replace(/\sfill="[^"]*"/g, '');
const isWord = (p) => { const m = p.match(/translate\(\s*[-\d.]+[ ,]+([-\d.]+)\)/); return !!m && Number(m[1]) > 746; };
const markPaths = paths.filter((p) => !isWord(p)).map(clean).join('');
const wordPaths = paths.filter(isWord).map(clean).join('');
if (!markPaths || !wordPaths) throw new Error('Could not split the logo artwork.');

// Exact ink box of a group, measured by rendering at 4x and trimming.
async function inkBox(body) {
  const S = 4, W = 1700, H = 1100;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * S}" height="${H * S}"><rect width="${W}" height="${H}" fill="#fff"/><g fill="#000">${body}</g></svg>`;
  const { info } = await sharp(Buffer.from(svg)).trim({ background: '#ffffff', threshold: 10 }).toBuffer({ resolveWithObject: true });
  return { x: -info.trimOffsetLeft / S, y: -info.trimOffsetTop / S, w: info.width / S, h: info.height / S };
}
const markBox = await inkBox(markPaths);
const wordBox = await inkBox(wordPaths);

/* ---------- outlined type ---------- */
// Static weights (dev dependencies @fontsource/geist-sans and @fontsource/geist-mono): the font library can't
// pick a weight from the site's variable WOFF2 files, so the logo uses the fixed-weight versions of the same typefaces.
const fontFile = (pkg, file) => readFileSync(`node_modules/@fontsource/${pkg}/files/${file}`);
const geist = create(fontFile('geist-sans', 'geist-sans-latin-600-normal.woff'));
const mono = create(fontFile('geist-mono', 'geist-mono-latin-500-normal.woff'));

// Text as one SVG path with cap height `cap`. Spacing: { width } stretches the ink to exactly that width;
// { trackEm } adds that much letter-spacing (in ems of the cap height). Origin = ink top-left.
function outline(font, text, cap, { width, trackEm = 0 }) {
  const s = cap / font.capHeight;
  const glyphs = font.glyphsForString(text);
  const inkOf = (g) => (g.path.commands.length ? g.bbox : null);
  // Natural ink width with no extra spacing.
  let pen = 0, minX = Infinity, maxX = -Infinity;
  glyphs.forEach((g) => { const b = inkOf(g); if (b) { minX = Math.min(minX, pen + b.minX * s); maxX = Math.max(maxX, pen + b.maxX * s); } pen += g.advanceWidth * s; });
  const track = width !== undefined ? (width - (maxX - minX)) / (glyphs.length - 1) : trackEm * cap;
  const inkW = maxX - minX + track * (glyphs.length - 1);
  const f = (n) => +n.toFixed(2);
  let d = '';
  pen = -minX;
  for (const g of glyphs) {
    const X = (x) => f(pen + x * s), Y = (y) => f(cap - y * s);
    for (const c of g.path.commands) {
      const a = c.args;
      if (c.command === 'moveTo') d += `M${X(a[0])} ${Y(a[1])}`;
      else if (c.command === 'lineTo') d += `L${X(a[0])} ${Y(a[1])}`;
      else if (c.command === 'quadraticCurveTo') d += `Q${X(a[0])} ${Y(a[1])} ${X(a[2])} ${Y(a[3])}`;
      else if (c.command === 'bezierCurveTo') d += `C${X(a[0])} ${Y(a[1])} ${X(a[2])} ${Y(a[3])} ${X(a[4])} ${Y(a[5])}`;
      else if (c.command === 'closePath') d += 'Z';
    }
    pen += g.advanceWidth * s + track;
  }
  return { d, w: inkW, h: cap };
}

/* ---------- layout pieces (all in source units) ---------- */
const WH = wordBox.h; // wordmark cap height
const piece = {
  mark: (x, y, h) => { const k = h / markBox.h; return { svg: `<g data-part="mark" transform="translate(${x - markBox.x * k} ${y - markBox.y * k}) scale(${k})">${markPaths}</g>`, w: markBox.w * k, h }; },
  word: (x, y, w) => { const k = w / wordBox.w; return { svg: `<g data-part="text" transform="translate(${x - wordBox.x * k} ${y - wordBox.y * k}) scale(${k})">${wordPaths}</g>`, w, h: wordBox.h * k }; },
};
// Text block: MECHBRIDGE; INTERNATIONAL spaced to the same width; MEP CONSULTANTS centred at its natural
// spacing, with fine rules either side out to the same width.
function textBlock(x, y, w, lines) {
  const k = w / wordBox.w, parts = [];
  let cy = y;
  const word = piece.word(x, cy, w); parts.push(word.svg); cy += word.h;
  if (lines >= 2) {
    cy += WH * 0.34 * k;
    const t = outline(geist, 'INTERNATIONAL', WH * 0.6 * k, { width: w });
    parts.push(`<path data-part="text" transform="translate(${x} ${cy})" d="${t.d}"/>`); cy += t.h;
  }
  if (lines >= 3) {
    cy += WH * 0.4 * k;
    const cap = WH * 0.34 * k;
    const t = outline(mono, 'MEP CONSULTANTS', cap, { trackEm: 0.28 });
    const tx = x + (w - t.w) / 2, gap = cap * 1.1, ruleH = Math.max(1, cap * 0.09), ry = cy + cap / 2 - ruleH / 2;
    parts.push(`<rect data-part="rule" x="${x}" y="${ry}" width="${tx - gap - x}" height="${ruleH}"/>`);
    parts.push(`<path data-part="text" transform="translate(${tx} ${cy})" d="${t.d}"/>`);
    parts.push(`<rect data-part="rule" x="${tx + t.w + gap}" y="${ry}" width="${x + w - (tx + t.w + gap)}" height="${ruleH}"/>`);
    cy += t.h;
  }
  return { svg: parts.join(''), w, h: cy - y };
}

/* ---------- lockups ---------- */
const BASE_W = wordBox.w; // text width used everywhere
const LOCKUPS = {
  // Stacked: monogram centred above the lettering.
  'stacked': { note: 'Monogram over MECHBRIDGE (the current logo)', lines: 1, layout: 'stacked' },
  'stacked-name': { note: 'Monogram over MECHBRIDGE INTERNATIONAL', lines: 2, layout: 'stacked' },
  'stacked-full': { note: 'Monogram over MECHBRIDGE INTERNATIONAL MEP CONSULTANTS', lines: 3, layout: 'stacked' },
  // Horizontal: monogram on the left, a thin rule, lettering on the right.
  'horizontal': { note: 'Monogram beside MECHBRIDGE', lines: 1, layout: 'horizontal' },
  'horizontal-name': { note: 'Monogram beside MECHBRIDGE INTERNATIONAL', lines: 2, layout: 'horizontal' },
  'horizontal-full': { note: 'Monogram beside MECHBRIDGE INTERNATIONAL MEP CONSULTANTS', lines: 3, layout: 'horizontal' },
  // Lettering only.
  'wordmark': { note: 'MECHBRIDGE lettering only', lines: 1, layout: 'text' },
  'wordmark-name': { note: 'MECHBRIDGE INTERNATIONAL lettering only', lines: 2, layout: 'text' },
  'wordmark-full': { note: 'MECHBRIDGE INTERNATIONAL MEP CONSULTANTS lettering only', lines: 3, layout: 'text' },
  // Monogram only.
  'mark': { note: 'Monogram only (icons, favicons, social avatars)', lines: 0, layout: 'mark' },
};

function build(lockup) {
  const { lines, layout } = LOCKUPS[lockup];
  let body = '', W = 0, H = 0;
  if (layout === 'mark') {
    const m = piece.mark(0, 0, markBox.h); body = m.svg; W = m.w; H = m.h;
  } else if (layout === 'text') {
    const t = textBlock(0, 0, BASE_W, lines); body = t.svg; W = t.w; H = t.h;
  } else if (layout === 'stacked') {
    // Monogram keeps its size relative to the wordmark from the original artwork.
    const t0 = textBlock(0, 0, BASE_W, lines);
    const mH = markBox.h, mW = markBox.w;
    const gap = wordBox.y - (markBox.y + markBox.h); // original spacing
    W = Math.max(mW, BASE_W);
    const m = piece.mark((W - mW) / 2, 0, mH);
    const t = textBlock((W - BASE_W) / 2, mH + gap, BASE_W, lines);
    body = m.svg + t.svg; H = mH + gap + t0.h;
  } else {
    const t0 = textBlock(0, 0, BASE_W, lines);
    const mH = lines === 1 ? t0.h * 2.4 : t0.h * 1.15; // a one-line wordmark needs a taller monogram beside it
    const m0 = piece.mark(0, 0, mH);
    const gap = mH * 0.16, ruleW = Math.max(2, mH * 0.012);
    const m = piece.mark(0, 0, mH);
    const ruleX = m0.w + gap;
    const tx = ruleX + ruleW + gap;
    const t = textBlock(tx, (mH - t0.h) / 2, BASE_W, lines);
    body = m.svg + `<rect data-part="rule" x="${ruleX}" y="${mH * 0.08}" width="${ruleW}" height="${mH * 0.84}"/>` + t.svg;
    W = tx + BASE_W; H = mH;
  }
  return { body, W, H };
}

function svgFor(lockup, color, px) {
  const { body, W, H } = build(lockup);
  const pad = Math.min(W, H) * 0.04;
  const vw = W + pad * 2, vh = H + pad * 2;
  const c = COLORS[color];
  const painted = body
    .replace(/data-part="mark"/g, `fill="${c.mark}"`)
    .replace(/data-part="text"/g, `fill="${c.text}"`)
    .replace(/data-part="rule"/g, `fill="${c.rule}"`);
  const size = px ? (vw >= vh ? `width="${px}" height="${Math.round((px * vh) / vw)}"` : `width="${Math.round((px * vw) / vh)}" height="${px}"`) : `width="${Math.round(vw)}" height="${Math.round(vh)}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${(-pad).toFixed(2)} ${(-pad).toFixed(2)} ${vw.toFixed(2)} ${vh.toFixed(2)}" ${size} role="img" aria-label="Mechbridge International MEP Consultants"><title>Mechbridge International MEP Consultants</title>${painted}</svg>\n`;
}

/* ---------- write the kit ---------- */
// Clear only what this script makes, so logo-kit/README.md stays.
for (const d of ['svg', 'png']) rmSync(`${OUT}/${d}`, { recursive: true, force: true });
const made = [];
for (const lockup of Object.keys(LOCKUPS)) {
  mkdirSync(`${OUT}/svg/${lockup}`, { recursive: true });
  mkdirSync(`${OUT}/png/${lockup}`, { recursive: true });
  for (const color of Object.keys(COLORS)) {
    if (lockup === 'mark' && color === 'duo') continue; // the monogram is one colour
    const name = `mechbridge-${lockup}-${color}`;
    writeFileSync(`${OUT}/svg/${lockup}/${name}.svg`, svgFor(lockup, color));
    await sharp(Buffer.from(svgFor(lockup, color, PNG_LONG_SIDE))).png({ compressionLevel: 9 }).toFile(`${OUT}/png/${lockup}/${name}.png`);
    made.push({ lockup, color, name });
  }
}

/* ---------- preview sheet (HTML) and contact sheet (PNG) ---------- */
const cell = (m) => `<figure style="background:${COLORS[m.color].bg}"><img src="svg/${m.lockup}/${m.name}.svg" alt="${m.lockup}, ${m.color}"><figcaption>${m.name}</figcaption></figure>`;
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mechbridge logo kit</title>
<style>body{margin:0;padding:32px;font:14px/1.5 Arial,sans-serif;background:#eee;color:#1A2841}h1{margin:0 0 4px}h2{margin:40px 0 4px;text-transform:capitalize}p{margin:0 0 12px;color:#5B6A86}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}figure{margin:0;border-radius:12px;padding:28px 24px 12px;display:grid;gap:14px;align-content:space-between;min-height:200px}
figure img{width:100%;max-height:170px;object-fit:contain}figcaption{font:12px/1.3 monospace;color:#3D4A63;background:#fff;border-radius:6px;padding:4px 8px;justify-self:start}</style>
<h1>Mechbridge logo kit</h1><p>Every lockup in every colour. SVG in svg/, transparent PNG (${PNG_LONG_SIDE}px on the long side) in png/. Each tile shows the background it is made for.</p>
${Object.entries(LOCKUPS).map(([k, v]) => `<h2>${k.replace(/-/g, ' ')}</h2><p>${v.note}</p><div class="g">${made.filter((m) => m.lockup === k).map(cell).join('')}</div>`).join('\n')}
`;
writeFileSync(`${OUT}/index.html`, html);

// Contact sheet: one row per lockup, one column per colour, on each colour's background.
const colW = 420, rowH = 300, padC = 36, cols = Object.keys(COLORS);
const rows = Object.keys(LOCKUPS);
const tiles = [];
for (const [ri, lockup] of rows.entries()) {
  for (const [ci, color] of cols.entries()) {
    const m = made.find((x) => x.lockup === lockup && x.color === color);
    const bg = await sharp({ create: { width: colW, height: rowH, channels: 4, background: COLORS[color].bg } }).png().toBuffer();
    tiles.push({ input: bg, left: ci * colW, top: ri * rowH });
    if (!m) continue;
    const logo = await sharp(`${OUT}/png/${lockup}/${m.name}.png`).resize({ width: colW - padC * 2, height: rowH - padC * 2, fit: 'inside' }).toBuffer({ resolveWithObject: true });
    tiles.push({ input: logo.data, left: ci * colW + Math.round((colW - logo.info.width) / 2), top: ri * rowH + Math.round((rowH - logo.info.height) / 2) });
  }
}
await sharp({ create: { width: colW * cols.length, height: rowH * rows.length, channels: 4, background: '#ffffff' } })
  .composite(tiles).jpeg({ quality: 85 }).toFile(`${OUT}/contact-sheet.jpg`);

console.log(`logo kit: ${made.length} SVG + ${made.length} PNG in ${OUT}/`, { markBox, wordBox });

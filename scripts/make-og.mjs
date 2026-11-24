// Builds the 1200×630 share cards in public/og/ from the site photos.
//   node scripts/make-og.mjs
// Re-run after changing a page title or its photo. Output is committed, so builds don't need it.
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';

const W = 1200, H = 630;
const cards = [
  ['home', 'hero-home', 'The MEP consultants behind the walls you trust, from Middle East to the world', 'HVAC · Firefighting · Plumbing · MEP Design · Estimation'],
  ['services', 'services-hero', 'MEP engineering, from load calculations to as-built', 'From the Middle East to the world'],
  ['hvac-engineering', 'svc-hvac-wide', 'HVAC Engineering', 'Air conditioning · Ventilation · Cooling and heating systems'],
  ['firefighting-engineering', 'svc-fire-wide', 'Firefighting Engineering', 'Fire protection · Suppression · Hydraulic design'],
  ['plumbing-engineering', 'svc-plumbing-wide', 'Plumbing Engineering', 'Water supply · Drainage · Public health systems'],
  ['mep-design', 'svc-design-wide', 'MEP Design', 'CAD drafting · Coordination · Shop drawings'],
  ['mep-estimation-project-management', 'svc-estimation-wide', 'MEP Estimation and Project Management', 'BOQ · Cost estimation · Tendering · Project execution'],
  ['training', 'training-hero', 'Professional MEP Engineering Training', 'HVAC · Firefighting · Plumbing · 3,000+ students trained'],
  ['internships', 'training-cohort', 'GCC-Ready Internship Package', 'For engineering students and fresh graduates'],
  ['careers', 'careers-hero', 'Careers in MEP engineering', 'UAE · Saudi Arabia · Qatar · Kuwait · Bahrain · Oman · India'],
  ['about', 'about-hero', 'An MEP consultancy, fifteen years in the making', 'Headquartered in Dubai, operating from Dubai and India'],
  ['contact', 'office-dubai-wide', 'Talk to an engineer', 'connect@mechbridgegroup.com'],
  ['verify', 'hero-home', 'Verify a Mechbridge certificate', 'Check any training or internship certificate code'],
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
// Greedy wrap for the title at roughly `max` characters per line.
function wrap(text, max) {
  const words = text.split(' '), lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > max && line) { lines.push(line); line = w; } else line = (line + ' ' + w).trim();
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

mkdirSync('public/og', { recursive: true });
const logoSvg = readFileSync('public/logo/mechbridge-cream.svg');
const logo = await sharp(logoSvg, { density: 300 }).resize({ height: 96 }).png().toBuffer();

for (const [slug, img, title, sub] of cards) {
  const lines = wrap(title, title.length > 40 ? 26 : 22);
  const size = lines.length > 2 ? 58 : 66;
  const top = H - 150 - lines.length * size * 1.02;
  const titleSvg = lines.map((l, i) => `<text x="64" y="${top + i * size * 1.02}" font-family="Arial Narrow, Arial, Helvetica, sans-serif" font-weight="700" font-size="${size}" fill="#F0E1CE" letter-spacing="-1">${esc(l)}</text>`).join('');
  const overlay = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="v" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#05070b" stop-opacity=".92"/><stop offset=".55" stop-color="#05070b" stop-opacity=".55"/><stop offset="1" stop-color="#05070b" stop-opacity=".1"/></linearGradient>
      <linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#05070b" stop-opacity="0"/><stop offset="1" stop-color="#05070b" stop-opacity=".85"/></linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#v)"/><rect width="${W}" height="${H}" fill="url(#b)"/>
    <rect x="64" y="${H - 118}" width="64" height="4" fill="#B11722"/>
    ${titleSvg}
    <text x="64" y="${H - 78}" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#C9D0DD">${esc(sub)}</text>
    <text x="${W - 64}" y="${H - 48}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#E27178" letter-spacing="2">MECHBRIDGEGROUP.COM</text>
  </svg>`);
  await sharp(`public/images/${img}.webp`)
    .resize(W, H, { fit: 'cover', position: 'centre' })
    .composite([{ input: overlay }, { input: logo, left: 64, top: 52 }])
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(`public/og/${slug}.jpg`);
  console.log('og', slug);
}

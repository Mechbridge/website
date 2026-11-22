// Image sitemap: the photos on each public page, so they can appear in image search.
import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import { services } from '../data/services';

export const prerender = true;

const SITE = 'https://mechbridgegroup.com';
const pages: Record<string, { id: string; title: string }[]> = {
  '/': [{ id: 'hero-home', title: 'Mechbridge International MEP Consultants' }, { id: 'home-codes', title: 'Authority-marked MEP drawing set' }, { id: 'home-fire', title: 'Sprinkler valve set in a plant room' }, { id: 'svc-mep', title: 'Coordinated MEP services in a ceiling void' }],
  '/services': [{ id: 'services-hero', title: 'Plant room with chillers, pumps and fire mains' }, ...services.map((s) => ({ id: s.img, title: s.title }))],
  ...Object.fromEntries(services.map((s) => [`/services/${s.slug}`, [{ id: `${s.img}-wide`, title: s.title }, { id: `${s.img}-detail`, title: `${s.title} drawings` }]])),
  '/training': [{ id: 'training-hero', title: 'Professional MEP Engineering Training' }, { id: 'training-site', title: 'MEP site inspection' }, { id: 'work-model', title: 'Pump room model review' }],
  '/internships': [{ id: 'training-cohort', title: 'GCC-Ready Internship Package' }, { id: 'work-site', title: 'Site visit, exposed ductwork' }],
  '/careers': [{ id: 'careers-hero', title: 'MEP drawing review' }],
  '/about': [{ id: 'about-hero', title: 'Dubai skyline' }, { id: 'about-story-2', title: 'Rooftop plant deck' }],
  '/contact': [{ id: 'office-dubai-contact', title: 'Dubai' }, { id: 'office-india-contact', title: 'India' }],
};
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const file = (id: string) => ['webp', 'jpg', 'png'].map((e) => `${id}.${e}`).find((f) => fs.existsSync(path.join(process.cwd(), 'public', 'images', f)));

export const GET: APIRoute = () => {
  const urls = Object.entries(pages).map(([p, imgs]) => {
    const list = imgs.map((i) => ({ ...i, f: file(i.id) })).filter((i) => i.f);
    if (!list.length) return '';
    return `  <url>\n    <loc>${SITE}${p === '/' ? '/' : p}</loc>\n${list.map((i) => `    <image:image><image:loc>${SITE}/images/${i.f}</image:loc><image:title>${esc(i.title)}</image:title></image:image>`).join('\n')}\n  </url>`;
  }).filter(Boolean);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};

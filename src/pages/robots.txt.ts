// robots.txt, generated at build. The GitHub demo is a preview copy, so it blocks everything.
import type { APIRoute } from 'astro';

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  const demo = import.meta.env.PUBLIC_DEMO === '1';
  const origin = (site ?? new URL('https://mechbridgegroup.com')).origin;
  const body = demo
    ? 'User-agent: *\nDisallow: /\n'
    : [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        'Disallow: /api/',
        '',
        `Sitemap: ${origin}/sitemap-index.xml`,
        `Sitemap: ${origin}/sitemap-images.xml`,
        '',
      ].join('\n');
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};

// Prefix site-root paths with Astro's base, so the site works at mechbridgegroup.com/
// and at a sub-path preview such as mechbridge.github.io/website/.
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export const u = (path: string) => (path.startsWith('/') ? `${base}${path}` : path);

// The current page path without the base, e.g. "/training".
export const stripBase = (pathname: string) => (base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname) || '/';

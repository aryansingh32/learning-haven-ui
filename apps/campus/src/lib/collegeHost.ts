/**
 * Each college's portal is served at <slug>.<VITE_CAMPUS_BASE_DOMAIN> (vit.forge.com;
 * vit-demo.localhost in development). On the bare portal address there is no college.
 */
export const CAMPUS_BASE_DOMAIN = (import.meta.env.VITE_CAMPUS_BASE_DOMAIN ?? 'localhost').toLowerCase();

// Our own names under the base domain; never a college.
const NOT_A_COLLEGE = new Set(['www', 'app', 'api', 'admin', 'campus']);

export function collegeSlugFromHost(hostname: string, base = CAMPUS_BASE_DOMAIN): string | null {
  const host = hostname.toLowerCase();
  if (!host.endsWith(`.${base}`)) return null;
  const label = host.slice(0, -(base.length + 1));
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label) || NOT_A_COLLEGE.has(label)) return null;
  return label;
}

/** The college this portal address belongs to, if any. */
export const hostCollegeSlug = typeof window === 'undefined' ? null : collegeSlugFromHost(window.location.hostname);

/** A college's portal address, e.g. https://vit.forge.com. */
export function collegePortalUrl(slug: string): string {
  const { protocol, port } = window.location;
  return `${protocol}//${slug}.${CAMPUS_BASE_DOMAIN}${port ? `:${port}` : ''}`;
}

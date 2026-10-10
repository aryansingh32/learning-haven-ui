import { env } from '../config/env';

/** A college's Campus portal, https://<slug>.<CAMPUS_BASE_DOMAIN> (one DNS label, no nesting). */
export function isCollegePortalOrigin(origin: string, base = env.CAMPUS_BASE_DOMAIN): boolean {
  if (!base) return false;
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^https://[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.${escaped}$`).test(origin);
}

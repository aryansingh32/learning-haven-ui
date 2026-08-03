import logger from '../config/logger';

/** Path prefixes allowed after GitHub OAuth (no open redirects). */
const ALLOWED_PATH_PREFIXES = [
  '/projects',
  '/dashboard',
  '/apprenticeship/dashboard',
  '/apprenticeship/enrollments',
  '/apprenticeship/projects',
  '/jobs/apprenticeships',
] as const;

const GITHUB_OAUTH_CALLBACK_PATH = '/api/v1/apprenticeship/auth/github/callback';

/** Public URL GitHub redirects to after authorization. */
export function getGitHubOAuthCallbackUrl(): string {
  const explicit = process.env.GITHUB_OAUTH_CALLBACK_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }
  const base = (
    process.env.WEBHOOK_BASE_URL ||
    process.env.API_URL ||
    'https://api.learninghaven.com'
  ).replace(/\/$/, '');
  return `${base}${GITHUB_OAUTH_CALLBACK_PATH}`;
}

const BLOCKED_PATH_PREFIXES = ['/admin', '/api', '/signin', '/signup', '/login'] as const;

const DEFAULT_RETURN_PATH = '/projects';

/**
 * Validates and normalizes a post-OAuth return path (pathname + search only).
 * Rejects external URLs, admin routes, and protocol-relative paths.
 */
export function validateGitHubReturnPath(
  returnTo: string | undefined,
  frontendBaseUrl: string
): string | null {
  if (!returnTo || typeof returnTo !== 'string') {
    return null;
  }

  const trimmed = returnTo.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('//') || trimmed.includes('\\')) {
    logger.warn('GitHub OAuth: rejected absolute or protocol-relative return_to', { returnTo: trimmed });
    return null;
  }

  let pathname: string;
  let search = '';

  try {
    const base = frontendBaseUrl.replace(/\/$/, '');
    const parsed = new URL(trimmed.startsWith('/') ? trimmed : `/${trimmed}`, `${base}/`);
    const expectedOrigin = new URL(base).origin;

    if (parsed.origin !== expectedOrigin) {
      logger.warn('GitHub OAuth: rejected cross-origin return_to', { returnTo: trimmed });
      return null;
    }

    pathname = parsed.pathname;
    search = parsed.search;
  } catch {
    logger.warn('GitHub OAuth: malformed return_to', { returnTo: trimmed });
    return null;
  }

  if (BLOCKED_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    logger.warn('GitHub OAuth: blocked return_to path', { pathname });
    return null;
  }

  const allowed = ALLOWED_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (!allowed) {
    logger.warn('GitHub OAuth: return_to not on allowlist', { pathname });
    return null;
  }

  return `${pathname}${search}`;
}

export function resolveGitHubOAuthRedirect(
  storedPath: string | null | undefined,
  frontendBaseUrl: string,
  success: boolean
): string {
  try {
    const base = (frontendBaseUrl && frontendBaseUrl.startsWith('http')) ? frontendBaseUrl.replace(/\/$/, '') : 'http://localhost:5173';
    const safePath = validateGitHubReturnPath(storedPath || undefined, base) || DEFAULT_RETURN_PATH;
    const url = new URL(safePath, `${base}/`);
    url.searchParams.set('github_connected', success ? 'true' : 'false');
    if (!success) {
      url.searchParams.set('error', 'auth_failed');
    }
    return url.toString();
  } catch (error) {
    logger.error('Failed to resolve GitHub OAuth redirect URL:', error);
    // Absolute fallback to ensure we redirect *somewhere* safe on the frontend
    const fallbackBase = process.env.FRONTEND_URL || 'http://localhost:5173';
    return `${fallbackBase}${DEFAULT_RETURN_PATH}?github_connected=${success ? 'true' : 'false'}${!success ? '&error=auth_failed' : ''}`;
  }
}

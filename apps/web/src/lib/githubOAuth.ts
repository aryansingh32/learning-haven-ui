import { toast } from 'sonner';

/** Current app path + query (for post-OAuth return). */
export function buildGitHubReturnPath(pathname: string, search = ''): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${path}${search || ''}`;
}

/** Handle ?github_connected= after OAuth redirect. */
export function handleGitHubOAuthReturn(
  search: string,
  onConnected?: () => void
): void {
  const params = new URLSearchParams(search);
  const connected = params.get('github_connected');
  if (!connected) return;

  if (connected === 'true') {
    toast.success('GitHub connected successfully');
    onConnected?.();
  } else {
    const err = params.get('error');
    toast.error(err === 'auth_failed' ? 'GitHub connection failed. Please try again.' : 'GitHub connection was cancelled');
  }
}

/** Strip github_connected params from URL after handling. */
export function stripGitHubOAuthParams(search: string): string {
  const params = new URLSearchParams(search);
  params.delete('github_connected');
  params.delete('error');
  const next = params.toString();
  return next ? `?${next}` : '';
}

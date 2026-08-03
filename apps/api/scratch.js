const { URL } = require('url');

const DEFAULT_RETURN_PATH = '/projects';

function validateGitHubReturnPath(returnTo, frontendBaseUrl) {
  if (!returnTo) return null;
  const trimmed = returnTo.trim();
  const base = frontendBaseUrl.replace(/\/$/, '');
  const parsed = new URL(trimmed.startsWith('/') ? trimmed : `/${trimmed}`, `${base}/`);
  return `${parsed.pathname}${parsed.search}`;
}

function resolveGitHubOAuthRedirect(storedPath, frontendBaseUrl, success) {
  const base = frontendBaseUrl.replace(/\/$/, '');
  const safePath = validateGitHubReturnPath(storedPath || undefined, base) || DEFAULT_RETURN_PATH;
  const url = new URL(safePath, `${base}/`);
  url.searchParams.set('github_connected', success ? 'true' : 'false');
  return url.toString();
}

console.log(resolveGitHubOAuthRedirect('/projects', 'https://pliantly-unconsummative-laurena.ngrok-free.dev', true));
console.log(resolveGitHubOAuthRedirect('/projects', 'http://localhost:5173', true));

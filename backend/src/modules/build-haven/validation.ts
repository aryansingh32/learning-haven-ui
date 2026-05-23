import { parseGitHubRepoRef } from '../github/github.service';

const LANGUAGE_KEY_RE = /^[a-z][a-z0-9_-]{0,31}$/;

export function validateBuildLanguageKey(language: string): string | null {
  const key = String(language || '').trim().toLowerCase();
  if (!key) return 'Language key is required';
  if (key.includes(',') || key.includes(' ')) {
    return 'Use one language per row (e.g. "python", not "python,nodejs"). Add separate language entries instead.';
  }
  if (!LANGUAGE_KEY_RE.test(key)) {
    return 'Language key must be lowercase alphanumeric (hyphens/underscores allowed), max 32 characters';
  }
  return null;
}

export function validateStarterRepoUrl(url: string): string | null {
  try {
    parseGitHubRepoRef(url);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Invalid starter repository URL';
  }
}

export function validateBuildLanguageConfig(input: {
  language: string;
  starter_repo_url: string;
  docker_test_image?: string | null;
}): string | null {
  const langErr = validateBuildLanguageKey(input.language);
  if (langErr) return langErr;

  const repoErr = validateStarterRepoUrl(input.starter_repo_url);
  if (repoErr) return repoErr;

  return null;
}

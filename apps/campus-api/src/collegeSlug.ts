import { z } from 'zod';

/**
 * A college's slug is also its portal address (<slug>.forge.com), so it must be a valid
 * DNS label and must not take a name we use ourselves.
 */
export const RESERVED_SLUGS = new Set([
  'www', 'app', 'api', 'admin', 'campus', 'mail', 'email', 'smtp', 'ftp', 'cdn', 'static', 'assets',
  'docs', 'help', 'support', 'status', 'blog', 'dev', 'staging', 'test', 'forge', 'auth', 'login',
]);

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])$/;

export const collegeSlug = z.string().trim().toLowerCase()
  .regex(SLUG_RE, 'Use 2–63 lowercase letters, numbers and hyphens, starting and ending with a letter or number.')
  .refine((s) => !RESERVED_SLUGS.has(s), 'That address is reserved. Pick another.');

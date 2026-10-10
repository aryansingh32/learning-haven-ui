import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { userOf } from './auth';
import { asSystem, asUser } from './db';
import { forbidden, notFound } from './errors';

/**
 * A college Forge has suspended or archived is closed to its own staff. The
 * database already hides its data (campus.org_is_active in every access rule);
 * this turns the empty pages into a clear answer. Forge staff still get through.
 */
export async function requireActiveCollege(req: Request, _res: Response, next: NextFunction) {
  const parsed = z.string().uuid().safeParse(req.params.orgId);
  if (!parsed.success) return next(notFound('College not found.'));
  const status = await asSystem(async (db) => (await db.query<{ status: string }>(
    `select status from campus.organizations where id = $1`, [parsed.data])).rows[0]?.status);
  if (!status || status === 'active') return next();
  const isForge = await asUser(userOf(req), async (db) => (await db.query<{ ok: boolean }>(`select campus.is_platform_admin() as ok`)).rows[0].ok);
  if (isForge) return next();
  return next(forbidden(status === 'suspended'
    ? 'This college is suspended. Contact Forge to restore access.'
    : 'This college is archived.'));
}

import { Router } from 'express';
import { asSystem } from '../db';
import { notFound } from '../errors';
import { SLUG_RE } from '../collegeSlug';

/** No sign-in needed: only what a college's sign-in page shows anyway. */
export const publicRouter = Router();

publicRouter.get('/colleges/:slug', async (req, res) => {
  const slug = String(req.params.slug).toLowerCase();
  if (!SLUG_RE.test(slug)) throw notFound('No college at this address.');
  const college = await asSystem(async (db) => (await db.query(
    `select id, name, slug, logo_url as "logoUrl", brand_color as "brandColor"
       from campus.organizations where slug = $1 and status = 'active' and type = 'college'`, [slug])).rows[0]);
  if (!college) throw notFound('No college at this address.');
  res.set('Cache-Control', 'public, max-age=300').json(college);
});

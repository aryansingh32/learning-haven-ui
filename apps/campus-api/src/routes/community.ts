import { Router, type Request } from 'express';
import { z } from 'zod';
import { userOf } from '../auth';
import { asSystem, asUser, type Db } from '../db';
import { badRequest, forbidden, HttpError, notFound } from '../errors';
import { notify } from '../services/notify';

/**
 * One college's community: doubts and discussions, the people directory, and teams
 * building projects. Every read and write goes through RLS as the signed-in person
 * (active member of an active college; team threads for the team only). System access
 * is used only to put names on rows RLS already returned, and to send notifications.
 */
export const communityRouter = Router({ mergeParams: true });
const uuid = z.string().uuid();

const orgOf = (req: Request) => uuid.parse(req.params.orgId);

/** Members only; others get the same answer as for a college that doesn't exist. */
communityRouter.use(async (req, _res, next) => {
  const parsed = uuid.safeParse(req.params.orgId);
  if (!parsed.success) return next(notFound('College not found.'));
  const ok = await asUser(userOf(req), async (db) =>
    (await db.query<{ ok: boolean }>(`select campus.is_org_member($1) as ok`, [parsed.data])).rows[0].ok);
  return next(ok ? undefined : notFound('College not found.'));
});

async function canModerate(db: Db, orgId: string) {
  return (await db.query<{ ok: boolean }>(`select campus.has_org_permission($1, 'community.moderate') as ok`, [orgId])).rows[0].ok;
}

export interface Person { id: string; name: string; avatarUrl: string | null }

/** Names and avatars for people whose rows RLS already showed (explicit ids only). */
async function people(ids: Array<string | null | undefined>): Promise<Map<string, Person>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (unique.length === 0) return new Map();
  const rows = await asSystem(async (db) => (await db.query<Person>(
    `select id, coalesce(nullif(trim(full_name), ''), split_part(email, '@', 1)) as name, avatar_url as "avatarUrl"
       from public.users where id = any($1::uuid[])`, [unique])).rows);
  return new Map(rows.map((p) => [p.id, p]));
}
const nobody: Person = { id: '', name: 'Former member', avatarUrl: null };

/** Simple flood control: at most `max` rows by this person in `table` in the last hour. */
async function underLimit(db: Db, table: 'community_threads' | 'community_posts' | 'community_teams', column: string, userId: string, max: number, what: string) {
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from campus.${table} where ${column} = $1 and created_at > now() - interval '1 hour'`, [userId]);
  if (rows[0].n >= max) throw new HttpError(429, `You've posted a lot of ${what} in the last hour. Try again a little later.`);
}

const tags = z.array(z.string().trim().toLowerCase().min(1).max(30)).max(10).default([]);
const skills = z.array(z.string().trim().min(1).max(40)).max(20).default([]);
const httpsUrl = z.string().trim().url().max(300).refine((u) => u.startsWith('https://'), 'Use an https:// link.');

// ── Threads ────────────────────────────────────────────────────────────────────

const listQuery = z.object({
  kind: z.enum(['doubt', 'discussion']).optional(),
  problemId: uuid.optional(),
  courseId: uuid.optional(),
  teamId: uuid.optional(),
  q: z.string().trim().max(100).optional(),
  mine: z.enum(['1']).optional(),
  unanswered: z.enum(['1']).optional(),
  before: z.string().datetime({ offset: true }).optional(),
});

communityRouter.get('/threads', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgOf(req);
  const f = listQuery.parse(req.query);
  const rows = await asUser(userId, async (db) => (await db.query(
    `select t.id, t.kind, t.title, left(t.body, 280) as excerpt, t.tags, t.team_id as "teamId", t.problem_id as "problemId",
            t.course_id as "courseId", t.author_id as "authorId", t.is_pinned as "pinned", t.is_hidden as "hidden",
            t.solved_post_id is not null as solved, t.created_at as "createdAt", t.last_activity_at as "lastActivityAt",
            (select count(*)::int from campus.community_posts p where p.thread_id = t.id) as replies,
            pr.title as "problemTitle", pr.slug as "problemSlug", c.title as "courseTitle"
       from campus.community_threads t
       left join public.problems pr on pr.id = t.problem_id
       left join public.courses c on c.id = t.course_id
      where t.org_id = $1
        and (case when $2::uuid is null then t.team_id is null else t.team_id = $2 end)
        and ($3::text is null or t.kind = $3)
        and ($4::uuid is null or t.problem_id = $4)
        and ($5::uuid is null or t.course_id = $5)
        and ($6::text is null or t.title ilike '%' || $6 || '%' or t.body ilike '%' || $6 || '%' or $6 = any(t.tags))
        and (not $7 or t.author_id = $9)
        and (not $8 or (t.kind = 'doubt' and t.solved_post_id is null))
        and ($10::timestamptz is null or t.last_activity_at < $10)
      order by (t.is_pinned and $10::timestamptz is null) desc, t.last_activity_at desc
      limit 30`,
    [orgId, f.teamId ?? null, f.kind ?? null, f.problemId ?? null, f.courseId ?? null,
     f.q ? f.q.replace(/[%_\\]/g, '') : null, f.mine === '1', f.unanswered === '1', userId, f.before ?? null])).rows);
  const names = await people(rows.map((r) => r.authorId));
  res.json(rows.map(({ authorId, ...r }) => ({ ...r, author: authorId ? names.get(authorId) ?? nobody : nobody, mine: authorId === userId })));
});

const threadBody = z.object({
  kind: z.enum(['doubt', 'discussion']).default('doubt'),
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(1).max(20_000),
  problemId: uuid.nullable().optional(),
  courseId: uuid.nullable().optional(),
  teamId: uuid.nullable().optional(),
  tags,
});

communityRouter.post('/threads', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgOf(req);
  const b = threadBody.parse(req.body);
  const created = await asUser(userId, async (db) => {
    await underLimit(db, 'community_threads', 'author_id', userId, 10, 'threads');
    return (await db.query<{ id: string }>(
      `insert into campus.community_threads (org_id, team_id, author_id, kind, title, body, problem_id, course_id, tags)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
      [orgId, b.teamId ?? null, userId, b.kind, b.title, b.body, b.problemId ?? null, b.courseId ?? null, b.tags])).rows[0];
  });
  res.status(201).json(created);
});

communityRouter.get('/threads/:id', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgOf(req);
  const id = uuid.parse(req.params.id);
  const out = await asUser(userId, async (db) => {
    const thread = (await db.query(
      `select t.id, t.kind, t.title, t.body, t.tags, t.team_id as "teamId", t.problem_id as "problemId", t.course_id as "courseId",
              t.author_id as "authorId", t.solved_post_id as "solvedPostId", t.is_pinned as "pinned", t.is_hidden as "hidden",
              t.created_at as "createdAt", t.edited_at as "editedAt",
              pr.title as "problemTitle", pr.slug as "problemSlug", c.title as "courseTitle", tm.name as "teamName"
         from campus.community_threads t
         left join public.problems pr on pr.id = t.problem_id
         left join public.courses c on c.id = t.course_id
         left join campus.community_teams tm on tm.id = t.team_id
        where t.id = $1 and t.org_id = $2`, [id, orgId])).rows[0];
    if (!thread) throw notFound('This thread is not available.');
    const posts = (await db.query(
      `select id, body, author_id as "authorId", is_hidden as "hidden", created_at as "createdAt", edited_at as "editedAt"
         from campus.community_posts where thread_id = $1 order by created_at`, [id])).rows;
    return { thread, posts, canModerate: await canModerate(db, orgId) };
  });
  const names = await people([out.thread.authorId, ...out.posts.map((p) => p.authorId)]);
  const who = (id: string | null) => (id ? names.get(id) ?? nobody : nobody);
  const { authorId, ...thread } = out.thread;
  res.json({
    ...thread, author: who(authorId), mine: authorId === userId, canModerate: out.canModerate,
    posts: out.posts.map(({ authorId: a, ...p }) => ({ ...p, author: who(a), mine: a === userId })),
  });
});

const threadPatch = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  body: z.string().trim().min(1).max(20_000).optional(),
  tags: tags.optional(),
  solvedPostId: uuid.nullable().optional(),
});

/** The author edits and marks the answer. */
communityRouter.patch('/threads/:id', async (req, res) => {
  const userId = userOf(req);
  const id = uuid.parse(req.params.id);
  const b = threadPatch.parse(req.body);
  const n = await asUser(userId, async (db) => (await db.query(
    `update campus.community_threads set
        title = coalesce($3, title), body = coalesce($4, body), tags = coalesce($5, tags),
        solved_post_id = case when $6 then $7::uuid else solved_post_id end
      where id = $1 and org_id = $2 and author_id = auth.uid()`,
    [id, orgOf(req), b.title ?? null, b.body ?? null, b.tags ?? null, b.solvedPostId !== undefined, b.solvedPostId ?? null])).rowCount);
  if (!n) throw forbidden('Only the author can change this thread.');
  res.json({ ok: true });
});

/** Moderators hide and pin. */
communityRouter.post('/threads/:id/moderate', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgOf(req);
  const id = uuid.parse(req.params.id);
  const b = z.object({ hidden: z.boolean().optional(), pinned: z.boolean().optional() }).parse(req.body);
  const n = await asUser(userId, async (db) => {
    if (!(await canModerate(db, orgId))) throw forbidden('Only moderators can do that.');
    const r = await db.query(
      `update campus.community_threads set is_hidden = coalesce($3, is_hidden), is_pinned = coalesce($4, is_pinned)
        where id = $1 and org_id = $2`, [id, orgId, b.hidden ?? null, b.pinned ?? null]);
    if (b.hidden) await db.query(`update campus.community_reports set resolved_at = now(), resolved_by = auth.uid() where thread_id = $1 and resolved_at is null`, [id]);
    return r.rowCount;
  });
  if (!n) throw notFound('This thread is not available.');
  res.json({ ok: true });
});

communityRouter.delete('/threads/:id', async (req, res) => {
  const userId = userOf(req);
  const n = await asUser(userId, async (db) => (await db.query(
    `delete from campus.community_threads where id = $1 and org_id = $2`, [uuid.parse(req.params.id), orgOf(req)])).rowCount);
  if (!n) throw forbidden('Only the author or a moderator can delete this thread.');
  res.status(204).end();
});

// ── Replies ────────────────────────────────────────────────────────────────────

communityRouter.post('/threads/:id/posts', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgOf(req);
  const threadId = uuid.parse(req.params.id);
  const { body } = z.object({ body: z.string().trim().min(1).max(20_000) }).parse(req.body);
  const { post, thread } = await asUser(userId, async (db) => {
    const thread = (await db.query<{ author_id: string | null; title: string; team_id: string | null }>(
      `select author_id, title, team_id from campus.community_threads where id = $1 and org_id = $2`, [threadId, orgId])).rows[0];
    if (!thread) throw notFound('This thread is not available.');
    await underLimit(db, 'community_posts', 'author_id', userId, 60, 'replies');
    const post = (await db.query<{ id: string }>(
      `insert into campus.community_posts (thread_id, org_id, author_id, body) values ($1, $2, $3, $4) returning id`,
      [threadId, orgId, userId, body])).rows[0];
    return { post, thread };
  });
  // The author hears about replies (once per thread per hour, not per reply).
  if (thread.author_id && thread.author_id !== userId) {
    const hour = new Date().toISOString().slice(0, 13);
    await notify([thread.author_id], {
      orgId, kind: 'community_reply', title: `New reply to "${thread.title}"`,
      body: body.slice(0, 160), link: `/community/${orgId}/threads/${threadId}`, dedupeKey: `community_reply:${threadId}:${hour}`,
    });
  }
  res.status(201).json(post);
});

communityRouter.patch('/posts/:id', async (req, res) => {
  const userId = userOf(req);
  const { body } = z.object({ body: z.string().trim().min(1).max(20_000) }).parse(req.body);
  const n = await asUser(userId, async (db) => (await db.query(
    `update campus.community_posts set body = $3 where id = $1 and org_id = $2 and author_id = auth.uid()`,
    [uuid.parse(req.params.id), orgOf(req), body])).rowCount);
  if (!n) throw forbidden('Only the author can edit this reply.');
  res.json({ ok: true });
});

communityRouter.post('/posts/:id/moderate', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgOf(req);
  const id = uuid.parse(req.params.id);
  const { hidden } = z.object({ hidden: z.boolean() }).parse(req.body);
  const n = await asUser(userId, async (db) => {
    if (!(await canModerate(db, orgId))) throw forbidden('Only moderators can do that.');
    const r = await db.query(`update campus.community_posts set is_hidden = $3 where id = $1 and org_id = $2`, [id, orgId, hidden]);
    if (hidden) await db.query(`update campus.community_reports set resolved_at = now(), resolved_by = auth.uid() where post_id = $1 and resolved_at is null`, [id]);
    return r.rowCount;
  });
  if (!n) throw notFound('This reply is not available.');
  res.json({ ok: true });
});

communityRouter.delete('/posts/:id', async (req, res) => {
  const userId = userOf(req);
  const n = await asUser(userId, async (db) => (await db.query(
    `delete from campus.community_posts where id = $1 and org_id = $2`, [uuid.parse(req.params.id), orgOf(req)])).rowCount);
  if (!n) throw forbidden('Only the author or a moderator can delete this reply.');
  res.status(204).end();
});

// ── Reports ────────────────────────────────────────────────────────────────────

communityRouter.post('/reports', async (req, res) => {
  const userId = userOf(req);
  const b = z.object({ threadId: uuid.optional(), postId: uuid.optional(), reason: z.string().trim().min(3).max(500) })
    .refine((x) => Boolean(x.threadId) !== Boolean(x.postId), 'Report a thread or a reply.').parse(req.body);
  await asUser(userId, async (db) => db.query(
    `insert into campus.community_reports (org_id, thread_id, post_id, reporter_id, reason) values ($1, $2, $3, $4, $5)
     on conflict do nothing`,
    [orgOf(req), b.threadId ?? null, b.postId ?? null, userId, b.reason]));
  res.status(201).json({ ok: true });
});

/** Moderators: open reports with what was reported. */
communityRouter.get('/reports', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgOf(req);
  const rows = await asUser(userId, async (db) => {
    if (!(await canModerate(db, orgId))) throw forbidden('Only moderators can see reports.');
    return (await db.query(
      `select r.id, r.reason, r.created_at as "createdAt", r.reporter_id as "reporterId",
              coalesce(r.thread_id, p.thread_id) as "threadId", r.post_id as "postId",
              coalesce(t.title, pt.title) as "threadTitle",
              left(coalesce(p.body, t.body), 400) as excerpt, coalesce(p.author_id, t.author_id) as "authorId",
              coalesce(p.is_hidden, t.is_hidden) as hidden
         from campus.community_reports r
         left join campus.community_threads t on t.id = r.thread_id
         left join campus.community_posts p on p.id = r.post_id
         left join campus.community_threads pt on pt.id = p.thread_id
        where r.org_id = $1 and r.resolved_at is null
        order by r.created_at desc limit 200`, [orgId])).rows;
  });
  const names = await people(rows.flatMap((r) => [r.reporterId, r.authorId]));
  res.json(rows.map(({ reporterId, authorId, ...r }) => ({
    ...r, reporter: reporterId ? names.get(reporterId) ?? nobody : nobody, author: authorId ? names.get(authorId) ?? nobody : nobody,
  })));
});

communityRouter.post('/reports/:id/resolve', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgOf(req);
  const id = uuid.parse(req.params.id);
  const { action } = z.object({ action: z.enum(['hide', 'dismiss']) }).parse(req.body);
  await asUser(userId, async (db) => {
    if (!(await canModerate(db, orgId))) throw forbidden('Only moderators can resolve reports.');
    const r = (await db.query<{ thread_id: string | null; post_id: string | null }>(
      `update campus.community_reports set resolved_at = now(), resolved_by = auth.uid()
        where id = $1 and org_id = $2 and resolved_at is null returning thread_id, post_id`, [id, orgId])).rows[0];
    if (!r) throw notFound('That report is already handled.');
    if (action === 'hide') {
      if (r.thread_id) await db.query(`update campus.community_threads set is_hidden = true where id = $1`, [r.thread_id]);
      if (r.post_id) await db.query(`update campus.community_posts set is_hidden = true where id = $1`, [r.post_id]);
      // Other reports about the same thing are handled too.
      await db.query(`update campus.community_reports set resolved_at = now(), resolved_by = auth.uid()
                       where org_id = $1 and resolved_at is null and (thread_id = $2 or post_id = $3)`, [orgId, r.thread_id, r.post_id]);
    }
  });
  res.json({ ok: true });
});

// ── People ─────────────────────────────────────────────────────────────────────

const peopleQuery = z.object({ q: z.string().trim().max(60).optional(), looking: z.enum(['1']).optional() });

communityRouter.get('/people', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgOf(req);
  const f = peopleQuery.parse(req.query);
  const rows = await asUser(userId, async (db) => (await db.query(
    `select p.user_id as "userId", p.headline, p.bio, p.skills, p.looking_for_team as "lookingForTeam",
            p.github_url as "githubUrl", p.linkedin_url as "linkedinUrl", p.updated_at as "updatedAt",
            (select coalesce(json_agg(json_build_object('id', t.id, 'name', t.name)), '[]')
               from campus.community_team_members m join campus.community_teams t on t.id = m.team_id
              where m.user_id = p.user_id and m.org_id = p.org_id and m.status = 'active' and t.status <> 'archived') as teams
       from campus.community_profiles p
      where p.org_id = $1 and (not $2 or p.looking_for_team)
      order by p.looking_for_team desc, p.updated_at desc limit 300`, [orgId, f.looking === '1'])).rows);
  const names = await people(rows.map((r) => r.userId));
  const needle = f.q?.toLowerCase();
  res.json(rows
    .map(({ userId: id, ...r }) => ({ ...r, person: names.get(id) ?? { ...nobody, id }, me: id === userId }))
    .filter((r) => !needle || r.person.name.toLowerCase().includes(needle) || (r.headline ?? '').toLowerCase().includes(needle)
      || (r.skills as string[]).some((s) => s.toLowerCase().includes(needle))));
});

communityRouter.get('/people/me', async (req, res) => {
  const userId = userOf(req);
  const row = await asUser(userId, async (db) => (await db.query(
    `select headline, bio, skills, looking_for_team as "lookingForTeam", github_url as "githubUrl", linkedin_url as "linkedinUrl"
       from campus.community_profiles where org_id = $1 and user_id = $2`, [orgOf(req), userId])).rows[0]);
  res.json(row ?? null);
});

const profileBody = z.object({
  headline: z.string().trim().max(120).nullable().optional(),
  bio: z.string().trim().max(1000).nullable().optional(),
  skills,
  lookingForTeam: z.boolean().default(false),
  githubUrl: httpsUrl.nullable().optional().or(z.literal('').transform(() => null)),
  linkedinUrl: httpsUrl.nullable().optional().or(z.literal('').transform(() => null)),
});

/** Join (or update your card in) the college's directory. */
communityRouter.put('/people/me', async (req, res) => {
  const userId = userOf(req);
  const b = profileBody.parse(req.body);
  await asUser(userId, async (db) => db.query(
    `insert into campus.community_profiles (org_id, user_id, headline, bio, skills, looking_for_team, github_url, linkedin_url)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (org_id, user_id) do update set headline = excluded.headline, bio = excluded.bio, skills = excluded.skills,
       looking_for_team = excluded.looking_for_team, github_url = excluded.github_url, linkedin_url = excluded.linkedin_url, updated_at = now()`,
    [orgOf(req), userId, b.headline || null, b.bio || null, [...new Set(b.skills)], b.lookingForTeam, b.githubUrl ?? null, b.linkedinUrl ?? null]));
  res.json({ ok: true });
});

/** Leave the directory. */
communityRouter.delete('/people/me', async (req, res) => {
  const userId = userOf(req);
  await asUser(userId, async (db) => db.query(`delete from campus.community_profiles where org_id = $1 and user_id = $2`, [orgOf(req), userId]));
  res.status(204).end();
});

// ── Teams ──────────────────────────────────────────────────────────────────────

const teamBody = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(4000).nullable().optional(),
  skillsNeeded: z.array(z.string().trim().min(1).max(40)).max(15).default([]),
  maxMembers: z.number().int().min(2).max(10).default(4),
  status: z.enum(['forming', 'building', 'shipped', 'archived']).optional(),
  repoUrl: httpsUrl.nullable().optional().or(z.literal('').transform(() => null)),
  demoUrl: httpsUrl.nullable().optional().or(z.literal('').transform(() => null)),
});

communityRouter.get('/teams', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgOf(req);
  const { status, mine } = z.object({ status: z.enum(['open', 'all']).default('open'), mine: z.enum(['1']).optional() }).parse(req.query);
  const rows = await asUser(userId, async (db) => (await db.query(
    `select t.id, t.name, left(t.description, 280) as excerpt, t.skills_needed as "skillsNeeded", t.max_members as "maxMembers",
            t.status, t.repo_url as "repoUrl", t.demo_url as "demoUrl", t.created_at as "createdAt",
            (select count(*)::int from campus.community_team_members m where m.team_id = t.id and m.status = 'active') as members,
            (select m.user_id from campus.community_team_members m where m.team_id = t.id and m.role = 'lead' and m.status = 'active') as "leadId",
            (select m.status from campus.community_team_members m where m.team_id = t.id and m.user_id = $2) as "myStatus"
       from campus.community_teams t
      where t.org_id = $1
        and ($3 = 'all' or t.status <> 'archived')
        and (not $4 or exists (select 1 from campus.community_team_members m where m.team_id = t.id and m.user_id = $2))
      order by (t.status = 'forming') desc, t.created_at desc limit 200`, [orgId, userId, status, mine === '1'])).rows);
  const names = await people(rows.map((r) => r.leadId));
  res.json(rows.map(({ leadId, ...r }) => ({ ...r, lead: leadId ? names.get(leadId) ?? null : null })));
});

communityRouter.post('/teams', async (req, res) => {
  const userId = userOf(req);
  const b = teamBody.parse(req.body);
  const team = await asUser(userId, async (db) => {
    await underLimit(db, 'community_teams', 'created_by', userId, 3, 'teams');
    return (await db.query<{ id: string }>(
      `insert into campus.community_teams (org_id, name, description, skills_needed, max_members, repo_url, demo_url, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
      [orgOf(req), b.name, b.description || null, [...new Set(b.skillsNeeded)], b.maxMembers, b.repoUrl ?? null, b.demoUrl ?? null, userId])).rows[0];
  });
  res.status(201).json(team);
});

communityRouter.get('/teams/:id', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgOf(req);
  const id = uuid.parse(req.params.id);
  const out = await asUser(userId, async (db) => {
    const team = (await db.query(
      `select id, name, description, skills_needed as "skillsNeeded", max_members as "maxMembers", status,
              repo_url as "repoUrl", demo_url as "demoUrl", created_at as "createdAt"
         from campus.community_teams where id = $1 and org_id = $2`, [id, orgId])).rows[0];
    if (!team) throw notFound('This team is not available.');
    const members = (await db.query(
      `select user_id as "userId", role, status, message, created_at as "createdAt"
         from campus.community_team_members where team_id = $1 order by role = 'lead' desc, decided_at nulls last, created_at`, [id])).rows;
    return { team, members, canModerate: await canModerate(db, orgId) };
  });
  const names = await people(out.members.map((m) => m.userId));
  const me = out.members.find((m) => m.userId === userId);
  res.json({
    ...out.team,
    members: out.members.filter((m) => m.status === 'active').map(({ userId: u, message: _m, ...m }) => ({ ...m, person: names.get(u) ?? { ...nobody, id: u } })),
    // Only the lead (and the person asking) can see requests; RLS already filtered them.
    requests: out.members.filter((m) => m.status === 'requested').map(({ userId: u, ...m }) => ({ ...m, person: names.get(u) ?? { ...nobody, id: u } })),
    myRole: me?.status === 'active' ? me.role : null,
    myRequest: me?.status === 'requested',
    canModerate: out.canModerate,
  });
});

communityRouter.patch('/teams/:id', async (req, res) => {
  const userId = userOf(req);
  const b = teamBody.partial().parse(req.body);
  const n = await asUser(userId, async (db) => (await db.query(
    `update campus.community_teams set
        name = coalesce($3, name), description = case when $4 then $5 else description end,
        skills_needed = coalesce($6, skills_needed), max_members = coalesce($7, max_members), status = coalesce($8, status),
        repo_url = case when $9 then $10 else repo_url end, demo_url = case when $11 then $12 else demo_url end
      where id = $1 and org_id = $2`,
    [uuid.parse(req.params.id), orgOf(req), b.name ?? null, b.description !== undefined, b.description || null,
     b.skillsNeeded ? [...new Set(b.skillsNeeded)] : null, b.maxMembers ?? null, b.status ?? null,
     b.repoUrl !== undefined, b.repoUrl ?? null, b.demoUrl !== undefined, b.demoUrl ?? null])).rowCount);
  if (!n) throw forbidden('Only the team lead can change the team.');
  res.json({ ok: true });
});

communityRouter.delete('/teams/:id', async (req, res) => {
  const userId = userOf(req);
  const n = await asUser(userId, async (db) => (await db.query(
    `delete from campus.community_teams where id = $1 and org_id = $2`, [uuid.parse(req.params.id), orgOf(req)])).rowCount);
  if (!n) throw forbidden('Only the team lead can delete the team.');
  res.status(204).end();
});

/** Ask to join; the lead hears about it. */
communityRouter.post('/teams/:id/join', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgOf(req);
  const teamId = uuid.parse(req.params.id);
  const { message } = z.object({ message: z.string().trim().max(500).optional() }).parse(req.body ?? {});
  const team = await asUser(userId, async (db) => {
    const t = (await db.query<{ name: string; lead: string | null }>(
      `select t.name, (select m.user_id from campus.community_team_members m where m.team_id = t.id and m.role = 'lead' and m.status = 'active') as lead
         from campus.community_teams t where t.id = $1 and t.org_id = $2`, [teamId, orgId])).rows[0];
    if (!t) throw notFound('This team is not available.');
    const r = await db.query(
      `insert into campus.community_team_members (team_id, org_id, user_id, message) values ($1, $2, $3, $4) on conflict do nothing`,
      [teamId, orgId, userId, message || null]);
    if (!r.rowCount) throw badRequest('You have already asked to join, or you are on this team.');
    return t;
  });
  if (team.lead) {
    const [me] = (await people([userId])).values();
    await notify([team.lead], {
      orgId, kind: 'team_request', title: `${me?.name ?? 'Someone'} asked to join ${team.name}`,
      body: message || null, link: `/community/${orgId}/teams/${teamId}`, dedupeKey: `team_request:${teamId}:${userId}`,
    });
  }
  res.status(201).json({ ok: true });
});

/** The lead accepts a request. */
communityRouter.post('/teams/:id/members/:userId/accept', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgOf(req);
  const teamId = uuid.parse(req.params.id);
  const member = uuid.parse(req.params.userId);
  const name = await asUser(userId, async (db) => {
    const r = await db.query(
      `update campus.community_team_members set status = 'active' where team_id = $1 and user_id = $2 and status = 'requested'`, [teamId, member]);
    if (!r.rowCount) throw forbidden('Only the team lead can accept requests.');
    return (await db.query<{ name: string }>(`select name from campus.community_teams where id = $1`, [teamId])).rows[0].name;
  });
  await notify([member], { orgId, kind: 'team_update', title: `You're on ${name} now`, link: `/community/${orgId}/teams/${teamId}` });
  res.json({ ok: true });
});

/** Leave, withdraw a request, or (lead) decline or remove someone. */
communityRouter.delete('/teams/:id/members/:userId', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgOf(req);
  const teamId = uuid.parse(req.params.id);
  const member = uuid.parse(req.params.userId);
  const removed = await asUser(userId, async (db) => {
    const r = (await db.query<{ status: string }>(
      `delete from campus.community_team_members where team_id = $1 and org_id = $2 and user_id = $3 returning status`,
      [teamId, orgId, member])).rows[0];
    if (!r) throw forbidden('You can only leave yourself, or manage your own team.');
    const name = (await db.query<{ name: string }>(`select name from campus.community_teams where id = $1`, [teamId])).rows[0]?.name;
    return { ...r, name };
  });
  if (member !== userId && removed.name) {
    await notify([member], {
      orgId, kind: 'team_update',
      title: removed.status === 'requested' ? `${removed.name} didn't take your request this time` : `You were removed from ${removed.name}`,
      link: '/community?tab=teams',
    });
  }
  res.status(204).end();
});

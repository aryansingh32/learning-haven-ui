// Notifications: in-app always, email when the person allows it. Everything
// here runs with system access and explicit ids — callers have already proven
// (through RLS) that the people being notified are the right audience.

import { asSystem, Db } from '../db';
import { env } from '../env';

export type NotificationKind =
  | 'test_assigned' | 'test_closing' | 'result_released' | 'feedback' | 'course_assigned' | 'course_due'
  | 'drive_announced' | 'drive_update' | 'job_alert' | 'announcement'
  | 'community_reply' | 'team_request' | 'team_update';

export interface NewNotification {
  orgId: string | null;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  link?: string | null;
  /** Same key + same person = created once (reminders are safe to re-run). */
  dedupeKey?: string | null;
}

/** Notify people, skipping anyone who muted this kind. Returns how many were created. */
export async function notify(userIds: string[], n: NewNotification, db?: Db): Promise<number> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return 0;
  const run = async (c: Db) => (await c.query(
    `insert into public.notifications (user_id, org_id, kind, title, body, link, dedupe_key)
     select u, $2, $3, $4, $5, $6, $7 from unnest($1::uuid[]) u
      where not exists (select 1 from public.notification_preferences p where p.user_id = u and $3 = any(p.muted_kinds))
     on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing`,
    [ids, n.orgId, n.kind, n.title.slice(0, 200), n.body?.slice(0, 1000) ?? null, n.link ?? null, n.dedupeKey ?? null])).rowCount ?? 0;
  return db ? run(db) : asSystem(run);
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) console.error('Email failed', { status: res.status, subject });
  return res.ok;
}

const item = (n: { title: string; body: string | null; link: string | null }) =>
  `<p style="margin:0 0 4px;font-weight:600">${escapeHtml(n.title)}</p>` +
  (n.body ? `<p style="margin:0 0 4px;color:#555">${escapeHtml(n.body)}</p>` : '') +
  (n.link ? `<p style="margin:0 0 16px"><a href="${escapeHtml(env.APP_URL + n.link)}">Open in Forge</a></p>` : '<p style="margin:0 0 16px"></p>');
const footer = `<p style="color:#888;font-size:12px">You can turn these emails off in Forge → Settings → Notifications.</p>`;

/**
 * Email notifications that haven't been emailed: one email each, or one daily
 * digest for people who chose that. Without RESEND_API_KEY nothing is sent and
 * nothing is marked, so turning email on later still delivers recent ones.
 */
export async function sendPendingEmails(limit = 200): Promise<{ sent: number; digests: number }> {
  if (!env.RESEND_API_KEY) return { sent: 0, digests: 0 };
  const rows = await asSystem(async (db) => (await db.query<{
    id: string; user_id: string; email: string; title: string; body: string | null; link: string | null;
    email_enabled: boolean | null; daily_digest: boolean | null; last_digest_at: string | null;
  }>(
    `select n.id, n.user_id, u.email, n.title, n.body, n.link, p.email_enabled, p.daily_digest, p.last_digest_at
       from public.notifications n join public.users u on u.id = n.user_id
       left join public.notification_preferences p on p.user_id = n.user_id
      where n.emailed_at is null and n.created_at > now() - interval '3 days'
      order by n.created_at limit $1`, [limit])).rows);
  let sent = 0; let digests = 0;
  const done: string[] = [];
  const digestUsers = new Map<string, typeof rows>();
  for (const r of rows) {
    if (r.email_enabled === false) { done.push(r.id); continue; }       // email off: never send these
    if (r.daily_digest) {
      if (r.last_digest_at && Date.now() - new Date(r.last_digest_at).getTime() < 23 * 3_600_000) continue;
      digestUsers.set(r.user_id, [...(digestUsers.get(r.user_id) ?? []), r]);
      continue;
    }
    if (await sendEmail(r.email, r.title, item(r) + footer)) { sent++; done.push(r.id); }
  }
  for (const [userId, list] of digestUsers) {
    if (await sendEmail(list[0].email, `Your Forge updates (${list.length})`, list.map(item).join('') + footer)) {
      digests++; done.push(...list.map((x) => x.id));
      await asSystem((db) => db.query(
        `insert into public.notification_preferences (user_id, last_digest_at) values ($1, now())
         on conflict (user_id) do update set last_digest_at = now()`, [userId]));
    }
  }
  if (done.length) await asSystem((db) => db.query(`update public.notifications set emailed_at = now() where id = any($1::uuid[])`, [done]));
  return { sent, digests };
}

/**
 * Time-based reminders. Idempotent: each reminder has a dedupe key, so running
 * this every few minutes creates each notification once.
 */
export async function runScheduler() {
  const created = await asSystem(async (db) => {
    let n = 0;
    // Tests closing within 24 hours, for students who haven't submitted.
    const closing = (await db.query<{ id: string; org_id: string; title: string; closes_at: string; users: string[] }>(
      `select a.id, a.org_id, a.title, a.closes_at,
              coalesce(array_agg(s.user_id) filter (where not exists (
                select 1 from public.test_attempts t where t.assignment_id = a.id and t.user_id = s.user_id and t.status = 'completed')), '{}') as users
         from campus.assignments a cross join lateral campus.assignment_students(a.id) s
        where a.status = 'published' and a.opens_at <= now() and a.closes_at > now() and a.closes_at <= now() + interval '24 hours'
        group by a.id`)).rows;
    for (const a of closing) {
      n += await notify(a.users, { orgId: a.org_id, kind: 'test_closing', title: `${a.title} closes soon`,
        body: `It closes at ${new Date(a.closes_at).toUTCString()}. Your answers save as you go.`, link: `/college/tests/${a.id}`, dedupeKey: `closing:${a.id}` }, db);
    }
    // Results that became visible: after close (closed in the last 7 days) or released by staff.
    const released = (await db.query<{ id: string; org_id: string; title: string; users: string[] }>(
      `select a.id, a.org_id, a.title, coalesce(array_agg(distinct t.user_id), '{}') as users
         from campus.assignments a join public.test_attempts t on t.assignment_id = a.id and t.status = 'completed'
        where a.status = 'published'
          and ((a.result_release = 'after_close' and a.closes_at <= now() and a.closes_at > now() - interval '7 days')
               or (a.result_release = 'manual' and a.results_released_at is not null and a.results_released_at > now() - interval '7 days'))
        group by a.id`)).rows;
    for (const a of released) {
      n += await notify(a.users, { orgId: a.org_id, kind: 'result_released', title: `Results are out: ${a.title}`,
        body: 'See your score and question-by-question result.', link: '/college', dedupeKey: `result:${a.id}` }, db);
    }
    // Courses due within 48 hours (not filtered by completion here: cheap reminder, finished students rarely mind).
    const due = (await db.query<{ id: string; org_id: string; title: string; course_id: string; due_at: string; users: string[] }>(
      `select a.id, a.org_id, a.title, a.course_id, a.due_at, coalesce(array_agg(s.user_id), '{}') as users
         from campus.course_assignments a cross join lateral campus.course_assignment_students(a.id) s
        where a.status = 'published' and a.due_at > now() and a.due_at <= now() + interval '48 hours'
        group by a.id`)).rows;
    for (const c of due) {
      n += await notify(c.users, { orgId: c.org_id, kind: 'course_due', title: `${c.title} is due soon`,
        body: `Due ${new Date(c.due_at).toUTCString()}.`, link: `/course/${c.course_id}/chapters`, dedupeKey: `coursedue:${c.id}` }, db);
    }
    // Drives closing for applications within 24 hours, for eligible students who haven't registered.
    const drives = (await db.query<{ id: string; org_id: string; company: string; role_title: string; users: string[] }>(
      `select d.id, d.org_id, d.company, d.role_title,
              coalesce(array_agg(s.user_id) filter (where not exists (
                select 1 from campus.drive_registrations r where r.drive_id = d.id and r.user_id = s.user_id)), '{}') as users
         from campus.placement_drives d cross join lateral campus.drive_students(d.id) s
        where d.status = 'open' and d.apply_by > now() and d.apply_by <= now() + interval '24 hours'
        group by d.id`)).rows;
    for (const d of drives) {
      n += await notify(d.users, { orgId: d.org_id, kind: 'drive_update', title: `Last day to apply: ${d.company}`,
        body: `${d.role_title} — applications close within 24 hours.`, link: '/college/drives', dedupeKey: `driveclose:${d.id}` }, db);
    }
    return n;
  });
  const email = await sendPendingEmails();
  return { created, ...email };
}

const when = (iso: string) => new Date(iso).toUTCString().replace(' GMT', ' UTC');

/** A test was published: tell everyone it is for. */
export async function notifyAssignmentPublished(assignmentId: string) {
  return asSystem(async (db) => {
    const a = (await db.query<{ org_id: string; title: string; opens_at: string; closes_at: string }>(
      `select org_id, title, opens_at, closes_at from campus.assignments where id = $1 and status = 'published'`, [assignmentId])).rows[0];
    if (!a) return 0;
    const users = (await db.query<{ user_id: string }>(`select user_id from campus.assignment_students($1)`, [assignmentId])).rows.map((r) => r.user_id);
    return notify(users, { orgId: a.org_id, kind: 'test_assigned', title: `New test: ${a.title}`,
      body: `Opens ${when(a.opens_at)}, closes ${when(a.closes_at)}.`, link: `/college/tests/${assignmentId}`, dedupeKey: `assigned:${assignmentId}` }, db);
  });
}

/** Staff released results by hand: tell everyone who submitted. */
export async function notifyResultsReleased(assignmentId: string) {
  return asSystem(async (db) => {
    const a = (await db.query<{ org_id: string; title: string }>(`select org_id, title from campus.assignments where id = $1`, [assignmentId])).rows[0];
    if (!a) return 0;
    const users = (await db.query<{ user_id: string }>(
      `select distinct user_id from public.test_attempts where assignment_id = $1 and status = 'completed'`, [assignmentId])).rows.map((r) => r.user_id);
    return notify(users, { orgId: a.org_id, kind: 'result_released', title: `Results are out: ${a.title}`,
      body: 'See your score and question-by-question result.', link: '/college', dedupeKey: `result:${assignmentId}` }, db);
  });
}

/** A course was given to a batch. */
export async function notifyCourseAssigned(courseAssignmentId: string) {
  return asSystem(async (db) => {
    const a = (await db.query<{ org_id: string; title: string; course_id: string; due_at: string | null }>(
      `select org_id, title, course_id, due_at from campus.course_assignments where id = $1 and status = 'published'`, [courseAssignmentId])).rows[0];
    if (!a) return 0;
    const users = (await db.query<{ user_id: string }>(`select user_id from campus.course_assignment_students($1)`, [courseAssignmentId])).rows.map((r) => r.user_id);
    return notify(users, { orgId: a.org_id, kind: 'course_assigned', title: `New course: ${a.title}`,
      body: a.due_at ? `Due ${when(a.due_at)}.` : null, link: `/course/${a.course_id}/chapters`, dedupeKey: `course:${courseAssignmentId}` }, db);
  });
}

/** An evaluator marked or commented on a student's attempt (once per attempt). */
export async function notifyFeedback(attemptId: string) {
  return asSystem(async (db) => {
    const t = (await db.query<{ user_id: string; org_id: string; title: string }>(
      `select t.user_id, t.org_id, a.title from public.test_attempts t join campus.assignments a on a.id = t.assignment_id where t.id = $1`, [attemptId])).rows[0];
    if (!t) return 0;
    return notify([t.user_id], { orgId: t.org_id, kind: 'feedback', title: `Feedback on ${t.title}`,
      body: 'Your evaluator marked your answers. Your score may have changed.', link: `/college/attempts/${attemptId}`, dedupeKey: `feedback:${attemptId}` }, db);
  });
}

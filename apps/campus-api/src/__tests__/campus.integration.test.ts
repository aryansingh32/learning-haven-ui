/**
 * End-to-end Campus API story against a real Postgres with every migration
 * applied: two colleges, a roster upload, a faculty-authored test, a
 * proctored assignment, a student sitting it, and the results report.
 * Each request is authenticated with a signed JWT, so RLS runs for real.
 */
import { SignJWT } from 'jose';
import request from 'supertest';
import { app } from '../app';
import { pool } from '../db';

const SECRET = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!);
const ISSUER = 'http://supabase.test/auth/v1';

async function token(sub: string, opts: { secret?: Uint8Array; expiresAt?: number } = {}) {
  return new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuer(ISSUER)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime(opts.expiresAt ?? '1h')
    .sign(opts.secret ?? SECRET);
}

const U = {
  adminA: 'a0000000-0000-0000-0000-000000000001',
  facultyA: 'a0000000-0000-0000-0000-000000000002',
  s1: 'a0000000-0000-0000-0000-000000000011', // verified, will be on the roster
  s2: 'a0000000-0000-0000-0000-000000000012', // verified, never on the roster
  adminB: 'b0000000-0000-0000-0000-000000000001',
  facultyB: 'b0000000-0000-0000-0000-000000000002',
};
const ORG_A = 'aaaaaaaa-1111-0000-0000-00000000000a';
const ORG_B = 'bbbbbbbb-1111-0000-0000-00000000000b';
const BATCH_A = 'aaaaaaaa-1111-0000-0000-0000000000b1';
const BATCH_B = 'bbbbbbbb-1111-0000-0000-0000000000b1';

const as = async (who: string) => ({ Authorization: `Bearer ${await token(who)}` });

beforeAll(async () => {
  const users = Object.entries(U).map(([name, id]) => ({ id, email: `${name.toLowerCase()}@${name.endsWith('B') ? 'b' : 'a'}.edu` }));
  for (const u of users) {
    await pool.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())`, [u.id, u.email]);
    await pool.query(`insert into public.users (id, email, full_name) values ($1, $2, $3)`, [u.id, u.email, u.email.split('@')[0]]);
  }
  await pool.query(`insert into campus.organizations (id, slug, name) values ($1, 'college-a', 'College A'), ($2, 'college-b', 'College B')`, [ORG_A, ORG_B]);
  await pool.query(`insert into campus.departments (org_id, name, code) values ($1, 'Computer Science', 'CSE')`, [ORG_A]);
  await pool.query(`insert into campus.batches (id, org_id, name) values ($1, $2, 'CSE-2027-A'), ($3, $4, 'B1')`, [BATCH_A, ORG_A, BATCH_B, ORG_B]);
  await pool.query(
    `insert into campus.org_memberships (org_id, user_id, role) values
       ($1, $2, 'admin'), ($1, $3, 'faculty'), ($4, $5, 'admin'), ($4, $6, 'faculty')`,
    [ORG_A, U.adminA, U.facultyA, ORG_B, U.adminB, U.facultyB]
  );
});

afterAll(() => pool.end());

describe('authentication', () => {
  it('rejects missing, forged and expired tokens', async () => {
    expect((await request(app).get('/campus/v1/me')).status).toBe(401);
    const forged = await token(U.s1, { secret: new TextEncoder().encode('wrong-secret') });
    expect((await request(app).get('/campus/v1/me').set('Authorization', `Bearer ${forged}`)).status).toBe(401);
    const expired = await token(U.s1, { expiresAt: Math.floor(Date.now() / 1000) - 60 });
    expect((await request(app).get('/campus/v1/me').set('Authorization', `Bearer ${expired}`)).status).toBe(401);
  });
});

describe('roster upload', () => {
  it('previews problems line by line without writing anything', async () => {
    const csv = 'Email,Name,Roll No,Branch,Section\nunknown-batch@a.edu,X,1,CSE,NoSuchBatch\nnot-an-email,Y,2,,\ns1@a.edu,Student One,21CS001,CSE,CSE-2027-A\n';
    const res = await request(app).post(`/campus/v1/orgs/${ORG_A}/roster/preview`).set(await as(U.adminA)).send({ csv });
    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({ valid: 1, invalid: 2 });
    expect(res.body.errors.map((e: { line: number }) => e.line)).toEqual([2, 3]);
    const { rows } = await pool.query(`select count(*)::int as n from campus.roster_entries`);
    expect(rows[0].n).toBe(0);
  });

  it('refuses the whole file while any line is wrong, then imports a clean one', async () => {
    const bad = await request(app).post(`/campus/v1/orgs/${ORG_A}/roster/import`).set(await as(U.adminA))
      .send({ csv: 'email,batch\ns1@a.edu,NoSuchBatch\n' });
    expect(bad.status).toBe(400);
    expect(bad.body.details).toHaveLength(1);

    const ok = await request(app).post(`/campus/v1/orgs/${ORG_A}/roster/import`).set(await as(U.adminA))
      .send({ csv: 'Email,Name,Roll No,Branch,Section\ns1@a.edu,Student One,21CS001,CSE,CSE-2027-A\n' });
    expect(ok.status).toBe(200);
    expect(ok.body.imported).toBe(1);
  });

  it('keeps the roster away from faculty and other colleges', async () => {
    expect((await request(app).get(`/campus/v1/orgs/${ORG_A}/roster`).set(await as(U.facultyA))).status).toBe(403);
    expect((await request(app).get(`/campus/v1/orgs/${ORG_A}/roster`).set(await as(U.adminB))).status).toBe(403);
    expect((await request(app).post(`/campus/v1/orgs/${ORG_A}/roster/import`).set(await as(U.adminB))
      .send({ csv: 'email\nintruder@b.edu\n' })).status).toBe(403);
  });

  it('attaches the student on first sign-in', async () => {
    const res = await request(app).get('/campus/v1/me').set(await as(U.s1));
    expect(res.body.claimed).toBe(1);
    expect(res.body.memberships).toEqual([expect.objectContaining({ orgId: ORG_A, role: 'student', rollNumber: '21CS001' })]);
    const none = await request(app).get('/campus/v1/me').set(await as(U.s2));
    expect(none.body.memberships).toEqual([]);
  });
});

let testId: string;
let assignmentId: string;

describe('faculty authoring', () => {
  it('builds and publishes a college test', async () => {
    const created = await request(app).post(`/campus/v1/orgs/${ORG_A}/tests`).set(await as(U.facultyA))
      .send({ title: 'Arrays weekly test', durationMinutes: 20 });
    expect(created.status).toBe(201);
    testId = created.body.id;

    const early = await request(app).patch(`/campus/v1/orgs/${ORG_A}/tests/${testId}`).set(await as(U.facultyA)).send({ published: true });
    expect(early.status).toBe(400);

    const questions = [
      { type: 'mcq', body: 'Index of first element?', options: ['0', '1'], correct: [0], marks: 2, negativeMarks: 1 },
      { type: 'msq', body: 'Which are O(1)?', options: ['Index access', 'Linear search', 'Push to end'], correct: [0, 2], marks: 2 },
      { type: 'nat', body: 'Length of [1,2,3]?', natAnswer: 3, marks: 1 },
    ];
    for (const q of questions) {
      const res = await request(app).post(`/campus/v1/orgs/${ORG_A}/tests/${testId}/questions`).set(await as(U.facultyA)).send(q);
      expect(res.status).toBe(201);
    }
    const bad = await request(app).post(`/campus/v1/orgs/${ORG_A}/tests/${testId}/questions`).set(await as(U.facultyA))
      .send({ type: 'mcq', body: 'Two answers?', options: ['a', 'b'], correct: [0, 1] });
    expect(bad.status).toBe(400);

    expect((await request(app).patch(`/campus/v1/orgs/${ORG_A}/tests/${testId}`).set(await as(U.facultyA)).send({ published: true })).status).toBe(200);
    const detail = await request(app).get(`/campus/v1/orgs/${ORG_A}/tests/${testId}`).set(await as(U.facultyA));
    expect(detail.body.questions).toHaveLength(3);
  });

  it('hides the test from other colleges', async () => {
    expect((await request(app).get(`/campus/v1/orgs/${ORG_A}/tests/${testId}`).set(await as(U.facultyB))).status).toBe(403);
    const own = await request(app).get(`/campus/v1/orgs/${ORG_B}/tests/${testId}`).set(await as(U.facultyB));
    expect(own.status).toBe(404);
    const list = await request(app).get(`/campus/v1/orgs/${ORG_B}/tests`).set(await as(U.facultyB));
    expect(list.body.map((t: { id: string }) => t.id)).not.toContain(testId);
  });

  it('refuses to assign another college\'s test', async () => {
    const res = await request(app).post(`/campus/v1/orgs/${ORG_B}/assignments`).set(await as(U.facultyB)).send({
      batchId: BATCH_B, testId, title: 'Borrowed', opensAt: new Date(Date.now() - 60_000), closesAt: new Date(Date.now() + 3_600_000),
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('This test is not available to this college');
  });

  it('assigns the test to a batch', async () => {
    const res = await request(app).post(`/campus/v1/orgs/${ORG_A}/assignments`).set(await as(U.facultyA)).send({
      batchId: BATCH_A, testId, title: 'Week 1 — Arrays', publish: true,
      opensAt: new Date(Date.now() - 60_000), closesAt: new Date(Date.now() + 3_600_000),
      resultRelease: 'immediately', proctoring: { maxViolations: 2, warnFirst: true },
    });
    expect(res.status).toBe(201);
    assignmentId = res.body.id;
  });
});

describe('a student sits the test', () => {
  let attemptId: string;

  it('shows the assignment only to the batch', async () => {
    const mine = await request(app).get('/campus/v1/my/assignments').set(await as(U.s1));
    expect(mine.body).toEqual([expect.objectContaining({ id: assignmentId, state: 'open', durationMinutes: 20, attemptsUsed: 0 })]);
    expect((await request(app).get('/campus/v1/my/assignments').set(await as(U.s2))).body).toEqual([]);
    expect((await request(app).post(`/campus/v1/my/assignments/${assignmentId}/start`).set(await as(U.s2))).status).toBe(404);
  });

  it('starts without revealing answers', async () => {
    const res = await request(app).post(`/campus/v1/my/assignments/${assignmentId}/start`).set(await as(U.s1));
    expect(res.status).toBe(201);
    attemptId = res.body.attemptId;
    expect(res.body.questions).toHaveLength(3);
    expect(JSON.stringify(res.body)).not.toMatch(/correct|natAnswer|nat_answer|explanation/i);
    expect(new Date(res.body.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(20 * 60_000 + 5_000);
    // Starting again resumes the same attempt rather than creating another.
    const again = await request(app).post(`/campus/v1/my/assignments/${assignmentId}/start`).set(await as(U.s1));
    expect(again.body.attemptId).toBe(attemptId);
  });

  it('keeps other people out of the attempt', async () => {
    expect((await request(app).get(`/campus/v1/my/attempts/${attemptId}`).set(await as(U.s2))).status).toBe(404);
    expect((await request(app).post(`/campus/v1/my/attempts/${attemptId}/submit`).set(await as(U.facultyA))).status).toBe(404);
  });

  it('saves answers and rejects options that do not exist', async () => {
    const view = await request(app).get(`/campus/v1/my/attempts/${attemptId}`).set(await as(U.s1));
    const byBody = (b: string) => view.body.questions.find((q: { body: string }) => q.body === b);
    const mcq = byBody('Index of first element?');
    const msq = byBody('Which are O(1)?');
    const nat = byBody('Length of [1,2,3]?');
    const optionId = (q: { options: Array<{ id: string; text: string }> }, text: string) => q.options.find((o) => o.text === text)!.id;

    expect((await request(app).put(`/campus/v1/my/attempts/${attemptId}/answers/${mcq.id}`).set(await as(U.s1))
      .send({ selectedOptions: ['zzz'] })).status).toBe(400);
    for (const [q, body] of [
      [mcq, { selectedOptions: [optionId(mcq, '0')] }],
      [msq, { selectedOptions: [optionId(msq, 'Index access'), optionId(msq, 'Push to end')] }],
      [nat, { natValue: 3 }],
    ] as const) {
      expect((await request(app).put(`/campus/v1/my/attempts/${attemptId}/answers/${q.id}`).set(await as(U.s1)).send(body)).status).toBe(200);
    }
  });

  it('warns first, then counts violations', async () => {
    const first = await request(app).post(`/campus/v1/my/attempts/${attemptId}/events`).set(await as(U.s1)).send({ type: 'tab_switch' });
    expect(first.body).toMatchObject({ severity: 'warning', violationCount: 0, autoSubmitted: false });
    const second = await request(app).post(`/campus/v1/my/attempts/${attemptId}/events`).set(await as(U.s1)).send({ type: 'tab_switch' });
    expect(second.body).toMatchObject({ severity: 'violation', violationCount: 1, autoSubmitted: false });
    const copy = await request(app).post(`/campus/v1/my/attempts/${attemptId}/events`).set(await as(U.s1)).send({ type: 'copy' });
    expect(copy.body).toMatchObject({ severity: 'warning', violationCount: 1 });
  });

  it('scores on submit and blocks a second attempt', async () => {
    const res = await request(app).post(`/campus/v1/my/attempts/${attemptId}/submit`).set(await as(U.s1));
    expect(res.body.status).toBe('completed');
    expect(res.body.submitReason).toBe('manual');
    expect(res.body.result).toMatchObject({ released: true, score: 5, totalMarks: 5, correctCount: 3 });
    const again = await request(app).post(`/campus/v1/my/assignments/${assignmentId}/start`).set(await as(U.s1));
    expect(again.status).toBe(409);
    const late = await request(app).post(`/campus/v1/my/attempts/${attemptId}/events`).set(await as(U.s1)).send({ type: 'tab_switch' });
    expect(late.body.violationCount).toBe(1);
  });

  it('cannot alter the score directly in the database', async () => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: U.s1, role: 'authenticated' })]);
      await client.query('set local role authenticated');
      const { rowCount } = await client.query(`update public.test_attempts set score = 999 where id = $1`, [attemptId]);
      expect(rowCount).toBe(0);
    } finally {
      await client.query('rollback');
      client.release();
    }
  });
});

describe('results', () => {
  it('reports every student in the batch, with violations', async () => {
    const res = await request(app).get(`/campus/v1/orgs/${ORG_A}/assignments/${assignmentId}/results`).set(await as(U.facultyA));
    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({ assigned: 1, submitted: 1, notAttempted: 0, averagePercent: 100, flagged: 1 });
    expect(res.body.rows[0]).toMatchObject({ rollNumber: '21CS001', status: 'submitted', score: 5, percent: 100, violations: 1 });
  });

  it('exports CSV for admins and blocks other colleges', async () => {
    const csv = await request(app).get(`/campus/v1/orgs/${ORG_A}/assignments/${assignmentId}/results?format=csv`).set(await as(U.adminA));
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text).toContain('"Roll number","Name"');
    expect(csv.text).toContain('"21CS001"');
    // Faculty can view results but not export them (reports.export).
    expect((await request(app).get(`/campus/v1/orgs/${ORG_A}/assignments/${assignmentId}/results?format=csv`).set(await as(U.facultyA))).status).toBe(403);
    expect((await request(app).get(`/campus/v1/orgs/${ORG_A}/assignments/${assignmentId}/results`).set(await as(U.adminB))).status).toBe(403);
  });
});

describe('auto-submit on violations', () => {
  it('submits the attempt when the limit is reached', async () => {
    const created = await request(app).post(`/campus/v1/orgs/${ORG_A}/assignments`).set(await as(U.facultyA)).send({
      batchId: BATCH_A, testId, title: 'Strict quiz', publish: true,
      opensAt: new Date(Date.now() - 60_000), closesAt: new Date(Date.now() + 3_600_000),
      proctoring: { maxViolations: 1, warnFirst: false },
    });
    const start = await request(app).post(`/campus/v1/my/assignments/${created.body.id}/start`).set(await as(U.s1));
    expect(start.status).toBe(201);
    const event = await request(app).post(`/campus/v1/my/attempts/${start.body.attemptId}/events`).set(await as(U.s1)).send({ type: 'fullscreen_exit' });
    expect(event.body).toMatchObject({ severity: 'violation', violationCount: 1, autoSubmitted: true });
    const view = await request(app).get(`/campus/v1/my/attempts/${start.body.attemptId}`).set(await as(U.s1));
    expect(view.body).toMatchObject({ status: 'completed', submitReason: 'violations' });
    // Results release after close by default, so no score is shown yet.
    expect(view.body.result).toEqual({ released: false });
  });
});

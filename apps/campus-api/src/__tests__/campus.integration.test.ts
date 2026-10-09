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
  forgeAdmin: 'f0000000-0000-0000-0000-000000000001',
  invigA: 'a0000000-0000-0000-0000-000000000003',
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
  await pool.query(`update public.users set role = 'super_admin' where id = $1`, [U.forgeAdmin]);
  await pool.query(`insert into campus.organizations (id, slug, name) values ($1, 'college-a', 'College A'), ($2, 'college-b', 'College B')`, [ORG_A, ORG_B]);
  await pool.query(`insert into campus.departments (org_id, name, code) values ($1, 'Computer Science', 'CSE')`, [ORG_A]);
  await pool.query(`insert into campus.batches (id, org_id, name) values ($1, $2, 'CSE-2027-A'), ($3, $4, 'B1')`, [BATCH_A, ORG_A, BATCH_B, ORG_B]);
  await pool.query(
    `insert into campus.org_memberships (org_id, user_id, role) values
       ($1, $2, 'admin'), ($1, $3, 'faculty'), ($4, $5, 'admin'), ($4, $6, 'faculty'), ($1, $7, 'invigilator')`,
    [ORG_A, U.adminA, U.facultyA, ORG_B, U.adminB, U.facultyB, U.invigA]
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
  let dealtOrder: string[];

  it('shows the assignment only to the batch', async () => {
    const mine = await request(app).get('/campus/v1/my/assignments').set(await as(U.s1));
    expect(mine.body).toEqual([expect.objectContaining({ id: assignmentId, state: 'open', durationMinutes: 20, attemptsUsed: 0 })]);
    expect(mine.body[0].proctoring).toEqual(expect.objectContaining({ enabled: true, maxViolations: 2, warnFirst: true }));
    expect((await request(app).get('/campus/v1/my/assignments').set(await as(U.s2))).body).toEqual([]);
    expect((await request(app).post(`/campus/v1/my/assignments/${assignmentId}/start`).set(await as(U.s2))).status).toBe(404);
  });

  it('starts without revealing answers', async () => {
    const res = await request(app).post(`/campus/v1/my/assignments/${assignmentId}/start`).set(await as(U.s1));
    expect(res.status).toBe(201);
    attemptId = res.body.attemptId;
    dealtOrder = res.body.questions.map((q: { id: string }) => q.id);
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

  it('scores on submit (on the questions it was dealt) and blocks a second attempt', async () => {
    // Faculty add a question while the student is mid-test; it must not change this attempt's total.
    const added = await request(app).post(`/campus/v1/orgs/${ORG_A}/tests/${testId}/questions`).set(await as(U.facultyA))
      .send({ type: 'nat', body: 'Added mid-test', natAnswer: 1, marks: 10 });
    expect(added.status).toBe(201);
    const res = await request(app).post(`/campus/v1/my/attempts/${attemptId}/submit`).set(await as(U.s1));
    expect(res.body.status).toBe('completed');
    expect(res.body.submitReason).toBe('manual');
    expect(res.body.result).toMatchObject({ released: true, score: 5, totalMarks: 5, correctCount: 3 });
    // The breakdown follows the order this student saw, so "Question 2" means the same thing on both screens.
    expect(res.body.result.perQuestion.map((q: { questionId: string }) => q.questionId)).toEqual(dealtOrder);
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

describe('platform: onboarding a college', () => {
  it('lets Forge staff create a college with an owner', async () => {
    const res = await request(app).post('/campus/v1/platform/colleges').set(await as(U.forgeAdmin))
      .send({ name: 'College C', slug: 'college-c', ownerEmail: 's2@a.edu', seatLimit: 500 });
    expect(res.status).toBe(201);
    const me = await request(app).get('/campus/v1/me').set(await as(U.s2));
    expect(me.body.memberships).toEqual([expect.objectContaining({ orgName: 'College C', role: 'owner' })]);
    const list = await request(app).get('/campus/v1/platform/colleges').set(await as(U.forgeAdmin));
    expect(list.body.map((c: { slug: string }) => c.slug)).toEqual(expect.arrayContaining(['college-a', 'college-b', 'college-c']));
  });

  it('explains when the owner has no account yet', async () => {
    const res = await request(app).post('/campus/v1/platform/colleges').set(await as(U.forgeAdmin))
      .send({ name: 'College D', slug: 'college-d', ownerEmail: 'nobody@nowhere.edu' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/doesn't have a Forge account/);
  });

  it('is closed to college admins', async () => {
    expect((await request(app).get('/campus/v1/platform/colleges').set(await as(U.adminA))).status).toBe(403);
    expect((await request(app).post('/campus/v1/platform/colleges').set(await as(U.adminA))
      .send({ name: 'Rogue', slug: 'rogue', ownerEmail: 'admina@a.edu' })).status).toBe(403);
  });
});

describe('coding questions', () => {
  let codingTestId: string;
  let codingAssignmentId: string;
  let attemptId: string;
  let questionId: string;
  const PY_STARTER = 'class Solution:\n    def double(self, x):\n        pass\n';
  // Passes the sample and one hidden test, fails the negative one.
  const PY_PARTIAL = 'class Solution:\n    def double(self, x):\n        return x * 2 if x > 0 else 0\n';

  it('lets faculty author a coding question with sample and hidden tests', async () => {
    const created = await request(app).post(`/campus/v1/orgs/${ORG_A}/tests`).set(await as(U.facultyA))
      .send({ title: 'Coding round', durationMinutes: 30 });
    codingTestId = created.body.id;
    const url = `/campus/v1/orgs/${ORG_A}/tests/${codingTestId}/questions`;

    const noSample = await request(app).post(url).set(await as(U.facultyA)).send({
      type: 'coding', body: 'Double it', starterCode: { python: PY_STARTER }, tests: [{ input: 'x = 1', expected: '2' }],
    });
    expect(noSample.status).toBe(400);
    const noStarter = await request(app).post(url).set(await as(U.facultyA)).send({
      type: 'coding', body: 'Double it', starterCode: { python: '  ' }, tests: [{ input: 'x = 1', expected: '2', isSample: true }],
    });
    expect(noStarter.status).toBe(400);

    const ok = await request(app).post(url).set(await as(U.facultyA)).send({
      type: 'coding', body: 'Return x doubled.', marks: 6,
      starterCode: { python: PY_STARTER, javascript: 'function double(x) {\n}\n' },
      tests: [
        { input: 'x = 1', expected: '2', isSample: true },
        { input: 'x = 5', expected: '10' },
        { input: 'x = -3', expected: '-6' },
      ],
    });
    expect(ok.status).toBe(201);
    questionId = ok.body.id;

    const detail = await request(app).get(`/campus/v1/orgs/${ORG_A}/tests/${codingTestId}`).set(await as(U.facultyA));
    expect(detail.body.questions[0]).toMatchObject({ type: 'coding', compare: 'exact', marks: 6 });
    expect(detail.body.questions[0].tests).toHaveLength(3);
    expect(Object.keys(detail.body.questions[0].starterCode).sort()).toEqual(['javascript', 'python']);

    await request(app).patch(`/campus/v1/orgs/${ORG_A}/tests/${codingTestId}`).set(await as(U.facultyA)).send({ published: true });
    const assigned = await request(app).post(`/campus/v1/orgs/${ORG_A}/assignments`).set(await as(U.facultyA)).send({
      batchId: BATCH_A, testId: codingTestId, title: 'Coding round', publish: true,
      opensAt: new Date(Date.now() - 60_000), closesAt: new Date(Date.now() + 3_600_000), resultRelease: 'immediately',
    });
    expect(assigned.status).toBe(201);
    codingAssignmentId = assigned.body.id;
  });

  it('gives the student starter code and samples, never hidden tests', async () => {
    const res = await request(app).post(`/campus/v1/my/assignments/${codingAssignmentId}/start`).set(await as(U.s1));
    expect(res.status).toBe(201);
    attemptId = res.body.attemptId;
    expect(res.body.questions[0]).toMatchObject({
      type: 'coding', languages: ['javascript', 'python'], samples: [{ input: 'x = 1', expected: '2' }],
    });
    expect(res.body.questions[0].starterCode.python).toBe(PY_STARTER);
    // (Match the quoted value: a bare "-6" also occurs inside random UUIDs.)
    expect(JSON.stringify(res.body)).not.toMatch(/x = 5|x = -3|"-6"/);
  });

  it('runs code on the samples only, with a short cooldown', async () => {
    const run = await request(app).post(`/campus/v1/my/attempts/${attemptId}/questions/${questionId}/run`).set(await as(U.s1))
      .send({ code: PY_PARTIAL, language: 'python' });
    expect(run.status).toBe(200);
    expect(run.body).toMatchObject({ verdict: 'Accepted', passed: 1, total: 1 });
    const again = await request(app).post(`/campus/v1/my/attempts/${attemptId}/questions/${questionId}/run`).set(await as(U.s1))
      .send({ code: PY_PARTIAL, language: 'python' });
    expect(again.status).toBe(429);
    const stranger = await request(app).post(`/campus/v1/my/attempts/${attemptId}/questions/${questionId}/run`).set(await as(U.s2))
      .send({ code: PY_PARTIAL, language: 'python' });
    expect(stranger.status).toBe(404);
  });

  it('saves code only in an allowed language', async () => {
    const url = `/campus/v1/my/attempts/${attemptId}/answers/${questionId}`;
    expect((await request(app).put(url).set(await as(U.s1)).send({ code: 'class Solution {}', language: 'java' })).status).toBe(400);
    expect((await request(app).put(url).set(await as(U.s1)).send({ selectedOptions: ['a'] })).status).toBe(400);
    const saved = await request(app).put(url).set(await as(U.s1)).send({ code: PY_PARTIAL, language: 'python' });
    expect(saved.body).toEqual({ questionId, status: 'answered' });
    // Marking for review keeps the saved code.
    const marked = await request(app).put(url).set(await as(U.s1)).send({ markedForReview: true });
    expect(marked.body.status).toBe('answered_marked');
  });

  it('judges every test on submit and gives partial marks', async () => {
    const res = await request(app).post(`/campus/v1/my/attempts/${attemptId}/submit`).set(await as(U.s1));
    expect(res.body.status).toBe('completed');
    expect(res.body.result).toMatchObject({ released: true, score: 4, totalMarks: 6, correctCount: 0 });
    expect(res.body.result.perQuestion[0]).toMatchObject({ testsPassed: 2, testsTotal: 3, isCorrect: false, marksAwarded: 4 });
  });

  it('lets faculty regrade pending answers, and no one else', async () => {
    // Simulate a submit while the judge was down.
    await pool.query(
      `update public.test_attempts set score = 0,
         answers = (select jsonb_agg(a || '{"grading":"pending","tests_passed":null,"tests_total":null}') from jsonb_array_elements(answers) a)
       where id = $1`, [attemptId]);
    const pending = await request(app).get(`/campus/v1/orgs/${ORG_A}/assignments/${codingAssignmentId}/results`).set(await as(U.facultyA));
    expect(pending.body.summary.gradingPending).toBe(1);
    expect(pending.body.rows[0]).toMatchObject({ score: 0, gradingPending: true });

    expect((await request(app).post(`/campus/v1/orgs/${ORG_A}/assignments/${codingAssignmentId}/regrade`).set(await as(U.facultyB)).send({})).status).toBe(403);
    expect((await request(app).post(`/campus/v1/orgs/${ORG_A}/assignments/${codingAssignmentId}/regrade`).set(await as(U.s1)).send({})).status).toBe(403);

    const regrade = await request(app).post(`/campus/v1/orgs/${ORG_A}/assignments/${codingAssignmentId}/regrade`).set(await as(U.facultyA)).send({});
    expect(regrade.body).toEqual({ attempts: 1, judged: 1, pending: 0 });
    const after = await request(app).get(`/campus/v1/orgs/${ORG_A}/assignments/${codingAssignmentId}/results`).set(await as(U.facultyA));
    expect(after.body.rows[0]).toMatchObject({ score: 4, gradingPending: false });
  });

  it('judges C++ answers the same way', async () => {
    const created = await request(app).post(`/campus/v1/orgs/${ORG_A}/tests`).set(await as(U.facultyA))
      .send({ title: 'C++ round', durationMinutes: 30 });
    const q = await request(app).post(`/campus/v1/orgs/${ORG_A}/tests/${created.body.id}/questions`).set(await as(U.facultyA)).send({
      type: 'coding', body: 'Sum the list.', marks: 4,
      starterCode: { cpp: 'class Solution {\npublic:\n    long long total(vector<int>& nums) {\n    }\n};\n' },
      tests: [
        { input: 'nums = [1,2,3]', expected: '6', isSample: true },
        { input: 'nums = [2000000000,2000000000]', expected: '4000000000' },
      ],
    });
    expect(q.status).toBe(201);
    await request(app).patch(`/campus/v1/orgs/${ORG_A}/tests/${created.body.id}`).set(await as(U.facultyA)).send({ published: true });
    const a = await request(app).post(`/campus/v1/orgs/${ORG_A}/assignments`).set(await as(U.facultyA)).send({
      batchId: BATCH_A, testId: created.body.id, title: 'C++ round', publish: true,
      opensAt: new Date(Date.now() - 60_000), closesAt: new Date(Date.now() + 3_600_000), resultRelease: 'immediately',
    });
    const start = await request(app).post(`/campus/v1/my/assignments/${a.body.id}/start`).set(await as(U.s1));
    expect(start.body.questions[0].languages).toEqual(['cpp']);
    // int overflows on the hidden test; long long would not.
    const code = 'class Solution {\npublic:\n    long long total(vector<int>& nums) {\n        int s = 0; for (int x : nums) s += x; return s;\n    }\n};\n';
    await request(app).put(`/campus/v1/my/attempts/${start.body.attemptId}/answers/${q.body.id}`).set(await as(U.s1)).send({ code, language: 'cpp' });
    const res = await request(app).post(`/campus/v1/my/attempts/${start.body.attemptId}/submit`).set(await as(U.s1));
    expect(res.body.result).toMatchObject({ score: 2, totalMarks: 4 });
    expect(res.body.result.perQuestion[0]).toMatchObject({ testsPassed: 1, testsTotal: 2 });
  });

  it('keeps hidden tests away from students in the database', async () => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: U.s1, role: 'authenticated' })]);
      await client.query('set local role authenticated');
      const { rows } = await client.query(`select count(*)::int as n from public.question_test_cases`);
      expect(rows[0].n).toBe(0);
    } finally {
      await client.query('rollback');
      client.release();
    }
  });
});

describe('timed sections', () => {
  let tid: string;
  let aid: string;
  let attemptId: string;
  const sec: Record<string, string> = {};
  const qid: Record<string, string> = {};
  const url = () => `/campus/v1/orgs/${ORG_A}/tests/${tid}`;

  it('lets faculty build sections, place questions and lock the timing', async () => {
    tid = (await request(app).post(`/campus/v1/orgs/${ORG_A}/tests`).set(await as(U.facultyA)).send({ title: 'Sectional mock', durationMinutes: 90 })).body.id;
    for (const [name, minutes] of [['Aptitude', 1], ['Technical', 1]] as const) {
      const r = await request(app).post(`${url()}/sections`).set(await as(U.facultyA)).send({ name, durationMinutes: minutes });
      expect(r.status).toBe(201);
      sec[name] = r.body.id;
    }
    expect((await request(app).post(`${url()}/sections`).set(await as(U.facultyB)).send({ name: 'x' })).status).toBe(403);

    for (const [key, section] of [['apt', 'Aptitude'], ['tech', 'Technical']] as const) {
      const r = await request(app).post(`${url()}/questions`).set(await as(U.facultyA))
        .send({ type: 'nat', body: `${key} question`, natAnswer: 1, marks: 1, sectionId: sec[section] });
      qid[key] = r.body.id;
    }
    qid.loose = (await request(app).post(`${url()}/questions`).set(await as(U.facultyA)).send({ type: 'nat', body: 'loose', natAnswer: 1 })).body.id;

    await request(app).patch(url()).set(await as(U.facultyA)).send({ sectionTimeLocked: true });
    const early = await request(app).patch(url()).set(await as(U.facultyA)).send({ published: true });
    expect(early.status).toBe(400);
    expect(early.body.error).toMatch(/every question in a section/);

    expect((await request(app).patch(`${url()}/questions/${qid.loose}`).set(await as(U.facultyA)).send({ sectionId: sec.Technical })).status).toBe(200);
    expect((await request(app).patch(url()).set(await as(U.facultyA)).send({ published: true })).status).toBe(200);
    const detail = await request(app).get(url()).set(await as(U.facultyA));
    expect(detail.body).toMatchObject({ sectionTimeLocked: true });
    expect(detail.body.sections.map((s: { name: string; questionCount: number }) => [s.name, s.questionCount])).toEqual([['Aptitude', 1], ['Technical', 2]]);

    aid = (await request(app).post(`/campus/v1/orgs/${ORG_A}/assignments`).set(await as(U.facultyA)).send({
      batchId: BATCH_A, testId: tid, title: 'Sectional mock', publish: true,
      opensAt: new Date(Date.now() - 60_000), closesAt: new Date(Date.now() + 3_600_000), resultRelease: 'immediately',
    })).body.id;
  });

  it('tells the student about the sections before they start', async () => {
    const mine = (await request(app).get('/campus/v1/my/assignments').set(await as(U.s1))).body.find((a: { id: string }) => a.id === aid);
    expect(mine).toMatchObject({ durationMinutes: 2, timedSections: [{ name: 'Aptitude', minutes: 1 }, { name: 'Technical', minutes: 1 }] });
  });

  it('shows only the current section and refuses answers elsewhere', async () => {
    const start = await request(app).post(`/campus/v1/my/assignments/${aid}/start`).set(await as(U.s1));
    attemptId = start.body.attemptId;
    expect(start.body.sections.map((s: { name: string }) => s.name)).toEqual(['Aptitude', 'Technical']);
    expect(start.body.currentSection.index).toBe(0);
    expect(start.body.questions.map((q: { id: string }) => q.id)).toEqual([qid.apt]);
    expect(new Date(start.body.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(120_000 + 5_000);

    expect((await request(app).put(`/campus/v1/my/attempts/${attemptId}/answers/${qid.tech}`).set(await as(U.s1)).send({ natValue: 1 })).status).toBe(423);
    expect((await request(app).put(`/campus/v1/my/attempts/${attemptId}/answers/${qid.apt}`).set(await as(U.s1)).send({ natValue: 1 })).status).toBe(200);
  });

  it('moves on by itself when the section time is up, and never goes back', async () => {
    await pool.query(`update public.test_attempts set section_started_at = now() - interval '61 seconds' where id = $1`, [attemptId]);
    const view = await request(app).get(`/campus/v1/my/attempts/${attemptId}`).set(await as(U.s1));
    expect(view.body.status).toBe('in_progress');
    expect(view.body.currentSection.index).toBe(1);
    expect(view.body.questions.map((q: { id: string }) => q.id).sort()).toEqual([qid.tech, qid.loose].sort());
    expect((await request(app).put(`/campus/v1/my/attempts/${attemptId}/answers/${qid.apt}`).set(await as(U.s1)).send({ natValue: 5 })).status).toBe(423);
    expect((await request(app).put(`/campus/v1/my/attempts/${attemptId}/answers/${qid.tech}`).set(await as(U.s1)).send({ natValue: 1 })).status).toBe(200);
  });

  it('finishing the last section submits the test, scored on every section', async () => {
    const done = await request(app).post(`/campus/v1/my/attempts/${attemptId}/sections/finish`).set(await as(U.s1));
    expect(done.body).toMatchObject({ status: 'completed', submitReason: 'manual' });
    expect(done.body.result).toMatchObject({ score: 2, totalMarks: 3 });
  });
});

describe('live invigilation', () => {
  let aid: string;
  let attemptId: string;
  const live = async (who = U.invigA) => request(app).get(`/campus/v1/orgs/${ORG_A}/assignments/${aid}/live`).set(await as(who));
  const act = async (path: string, body: object, who = U.invigA) =>
    request(app).post(`/campus/v1/orgs/${ORG_A}/assignments/${aid}/attempts/${attemptId}/${path}`).set(await as(who)).send(body);

  it('shows who is taking the test right now', async () => {
    const t = (await request(app).post(`/campus/v1/orgs/${ORG_A}/tests`).set(await as(U.facultyA)).send({ title: 'Invigilated quiz', durationMinutes: 30 })).body.id;
    await request(app).post(`/campus/v1/orgs/${ORG_A}/tests/${t}/questions`).set(await as(U.facultyA)).send({ type: 'nat', body: 'Two plus two?', natAnswer: 4 });
    await request(app).patch(`/campus/v1/orgs/${ORG_A}/tests/${t}`).set(await as(U.facultyA)).send({ published: true });
    aid = (await request(app).post(`/campus/v1/orgs/${ORG_A}/assignments`).set(await as(U.facultyA)).send({
      batchId: BATCH_A, testId: t, title: 'Invigilated quiz', publish: true, resultRelease: 'immediately',
      opensAt: new Date(Date.now() - 60_000), closesAt: new Date(Date.now() + 3_600_000), proctoring: { maxViolations: 5, warnFirst: true },
    })).body.id;

    expect((await live()).body.summary).toMatchObject({ assigned: 1, notStarted: 1, active: 0 });
    attemptId = (await request(app).post(`/campus/v1/my/assignments/${aid}/start`).set(await as(U.s1))).body.attemptId;
    expect((await request(app).post(`/campus/v1/my/attempts/${attemptId}/heartbeat`).set(await as(U.s1))).status).toBe(200);

    const board = await live();
    expect(board.status).toBe(200);
    expect(board.body.summary).toMatchObject({ active: 1, notStarted: 0 });
    expect(board.body.rows[0]).toMatchObject({ rollNumber: '21CS001', status: 'active', answered: 0, total: 1, violations: 0, attemptId });
  });

  it('flags a student who has dropped off', async () => {
    await pool.query(`update public.test_attempts set last_seen_at = now() - interval '3 minutes' where id = $1`, [attemptId]);
    expect((await live()).body.rows[0].status).toBe('offline');
    await request(app).put(`/campus/v1/my/attempts/${attemptId}/answers/${(await request(app).get(`/campus/v1/my/attempts/${attemptId}`).set(await as(U.s1))).body.questions[0].id}`)
      .set(await as(U.s1)).send({ natValue: 4 });
    expect((await live()).body.rows[0]).toMatchObject({ status: 'active', answered: 1 });
  });

  it('counts violations until someone reviews them', async () => {
    for (let i = 0; i < 2; i++) await request(app).post(`/campus/v1/my/attempts/${attemptId}/events`).set(await as(U.s1)).send({ type: 'tab_switch' });
    let board = (await live()).body;
    expect(board.rows[0]).toMatchObject({ violations: 1, lastEvent: { type: 'tab_switch', severity: 'violation' } });
    expect(board.summary.needsReview).toBe(1);

    expect((await act('reviews', { outcome: 'warning', note: 'Switched tabs twice; spoke to the student.' })).status).toBe(201);
    board = (await live()).body;
    expect(board.summary.needsReview).toBe(0);
    expect(board.rows[0].review).toMatchObject({ outcome: 'warning' });
  });

  it('gives a student extra time, on the record', async () => {
    const before = new Date((await request(app).get(`/campus/v1/my/attempts/${attemptId}`).set(await as(U.s1))).body.expiresAt).getTime();
    expect((await act('extend', { minutes: 10, reason: 'x' })).status).toBe(400);
    const r = await act('extend', { minutes: 10, reason: 'Power cut in lab 3' });
    expect(r.status).toBe(200);
    const after = new Date((await request(app).get(`/campus/v1/my/attempts/${attemptId}`).set(await as(U.s1))).body.expiresAt).getTime();
    expect(after - before).toBe(10 * 60_000);
    expect((await live()).body.rows[0].extraMinutes).toBe(10);
  });

  it('keeps the board to the college staff who may watch', async () => {
    expect((await live(U.facultyB)).status).toBe(403);
    expect((await live(U.s1)).status).toBe(403);
    expect((await act('extend', { minutes: 60, reason: 'more time please' }, U.s1)).status).toBe(403);
    expect((await act('reviews', { outcome: 'no_issue' }, U.adminB)).status).toBe(403);
    expect((await live(U.facultyA)).status).toBe(200); // reports.view may watch too
    const list = await request(app).get(`/campus/v1/orgs/${ORG_A}/assignments`).set(await as(U.invigA));
    expect(list.body.map((x: { id: string }) => x.id)).toContain(aid);
  });

  it('lets an invigilator end an attempt; the timeline shows everything in order', async () => {
    expect((await act('force-submit', { reason: 'Phone found on desk' })).status).toBe(200);
    const view = await request(app).get(`/campus/v1/my/attempts/${attemptId}`).set(await as(U.s1));
    expect(view.body).toMatchObject({ status: 'completed', submitReason: 'invigilator' });
    expect((await act('force-submit', { reason: 'again please' })).status).toBe(409);

    const timeline = await request(app).get(`/campus/v1/orgs/${ORG_A}/assignments/${aid}/attempts/${attemptId}/timeline`).set(await as(U.invigA));
    const kinds = timeline.body.items.map((i: { kind: string }) => i.kind);
    expect(kinds[0]).toBe('started');
    expect(kinds.slice(-1)[0]).toBe('submitted');
    expect(kinds).toEqual(expect.arrayContaining(['event', 'review', 'extend', 'force_submit']));
    expect(timeline.body.items.find((i: { kind: string }) => i.kind === 'review')).toMatchObject({ outcome: 'warning', by: 'inviga' });

    const csv = await request(app).get(`/campus/v1/orgs/${ORG_A}/assignments/${aid}/results?format=csv`).set(await as(U.adminA));
    expect(csv.text).toContain('"Warning"');
    expect(csv.text).toContain('"Ended by invigilator"');
  });
});

describe('question pools and accommodations', () => {
  let tid: string;
  let aid: string;
  const url = () => `/campus/v1/orgs/${ORG_A}/tests/${tid}`;

  it('deals N of M questions per pool, with publish rules that keep totals fair', async () => {
    tid = (await request(app).post(`/campus/v1/orgs/${ORG_A}/tests`).set(await as(U.facultyA)).send({ title: 'Pooled quiz', durationMinutes: 20 })).body.id;
    const pool = (await request(app).post(`${url()}/sections`).set(await as(U.facultyA)).send({ name: 'Aptitude pool', drawCount: 2 })).body.id;
    for (let i = 1; i <= 5; i++) {
      await request(app).post(`${url()}/questions`).set(await as(U.facultyA)).send({ type: 'nat', body: `Pool q${i}`, natAnswer: i, marks: 2, sectionId: pool });
    }
    const odd = (await request(app).post(`${url()}/questions`).set(await as(U.facultyA)).send({ type: 'nat', body: 'Odd marks', natAnswer: 1, marks: 5, sectionId: pool })).body.id;
    const refused = await request(app).patch(url()).set(await as(U.facultyA)).send({ published: true });
    expect(refused.status).toBe(400);
    expect(refused.body.error).toMatch(/same marks/);
    await request(app).delete(`${url()}/questions/${odd}`).set(await as(U.facultyA));
    await request(app).patch(`${url()}/sections/${pool}`).set(await as(U.facultyA)).send({ drawCount: 9 });
    expect((await request(app).patch(url()).set(await as(U.facultyA)).send({ published: true })).body.error).toMatch(/only 5/);
    await request(app).patch(`${url()}/sections/${pool}`).set(await as(U.facultyA)).send({ drawCount: 2 });
    expect((await request(app).patch(url()).set(await as(U.facultyA)).send({ published: true })).status).toBe(200);
    expect((await request(app).get(url()).set(await as(U.facultyA))).body.sections[0]).toMatchObject({ drawCount: 2, questionCount: 5 });

    aid = (await request(app).post(`/campus/v1/orgs/${ORG_A}/assignments`).set(await as(U.facultyA)).send({
      batchId: BATCH_A, testId: tid, title: 'Pooled quiz', publish: true, resultRelease: 'immediately',
      opensAt: new Date(Date.now() - 60_000), closesAt: new Date(Date.now() + 3_600_000),
    })).body.id;
  });

  it('gives a named student extra time, shown before they start', async () => {
    const put = async (body: object, who = U.facultyA, student = U.s1) =>
      request(app).put(`/campus/v1/orgs/${ORG_A}/assignments/${aid}/accommodations/${student}`).set(await as(who)).send(body);
    expect((await put({ extraPercent: 25, note: 'Scribe' }, U.facultyA, U.s2)).status).toBe(400); // not in the batch
    expect((await put({ extraPercent: 25 }, U.facultyB)).status).toBe(403);
    expect((await put({ extraPercent: 25, note: 'Scribe' })).status).toBe(200);
    const list = await request(app).get(`/campus/v1/orgs/${ORG_A}/assignments/${aid}/accommodations`).set(await as(U.facultyA));
    expect(list.body).toEqual([expect.objectContaining({ userId: U.s1, extraPercent: 25, rollNumber: '21CS001' })]);
    const mine = (await request(app).get('/campus/v1/my/assignments').set(await as(U.s1))).body.find((a: { id: string }) => a.id === aid);
    expect(mine).toMatchObject({ extraPercent: 25, durationMinutes: 25 });
  });

  it('starts the attempt with the drawn questions and the longer clock', async () => {
    const start = await request(app).post(`/campus/v1/my/assignments/${aid}/start`).set(await as(U.s1));
    expect(start.body.questions).toHaveLength(2);
    const minutes = (new Date(start.body.expiresAt).getTime() - new Date(start.body.startedAt).getTime()) / 60_000;
    expect(minutes).toBeCloseTo(25, 0);
    const done = await request(app).post(`/campus/v1/my/attempts/${start.body.attemptId}/submit`).set(await as(U.s1));
    expect(done.body.result).toMatchObject({ totalMarks: 4, totalQuestions: 2 });
  });
});

// Demo data for the local Forge + Campus stack. Talks only to local services
// (local Supabase on 54321/54322, Campus API on 5100) — never point it at production.
// Users are created through Supabase Auth (local), Campus data through the Campus API as those users.
// Run (after `supabase start` and starting both APIs; see docs/campus/LOCAL_E2E.md):
//   SB_SERVICE_KEY=<local service_role JWT> SB_ANON_KEY=<local anon JWT> node scripts/demo/seed.mjs
// Every demo account's password is Demo@12345.
import { createRequire } from 'node:module';
const pg = createRequire(new URL('../../apps/api/package.json', import.meta.url))('pg');

const SB = 'http://127.0.0.1:54321';
const SERVICE = process.env.SB_SERVICE_KEY, ANON = process.env.SB_ANON_KEY;
const CAMPUS = 'http://127.0.0.1:5100/campus/v1';
const db = new pg.Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });
const PASSWORD = 'Demo@12345';
const log = (...a) => console.log('•', ...a);

async function http(method, url, body, headers = {}) {
  const r = await fetch(url, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  if (!r.ok) throw new Error(`${method} ${url} -> ${r.status} ${text.slice(0, 300)}`);
  return json;
}

async function createUser(email, name, { confirmed = true, role = 'user' } = {}) {
  const admin = { apikey: SERVICE, authorization: `Bearer ${SERVICE}` };
  let u;
  try {
    u = await http('POST', `${SB}/auth/v1/admin/users`, { email, password: PASSWORD, email_confirm: confirmed, user_metadata: { full_name: name } }, admin);
  } catch (e) {
    if (!/already|registered|exists/i.test(e.message)) throw e;
    const list = await http('GET', `${SB}/auth/v1/admin/users?per_page=200`, undefined, admin);
    u = list.users.find((x) => x.email === email);
  }
  await db.query(
    `insert into public.users (id, email, full_name, role, onboarding_completed, current_plan, xp, level)
     values ($1, $2, $3, $4, true, 'free', 0, 1)
     on conflict (id) do update set full_name = excluded.full_name, role = excluded.role, onboarding_completed = true`,
    [u.id, email, name, role]);
  return u.id;
}

async function token(email) {
  const r = await http('POST', `${SB}/auth/v1/token?grant_type=password`, { email, password: PASSWORD }, { apikey: ANON });
  return { authorization: `Bearer ${r.access_token}` };
}

const at = (days, hours = 0) => new Date(Date.now() + days * 86400_000 + hours * 3600_000).toISOString();

await db.connect();

// ── People ────────────────────────────────────────────────────────────────
const people = {
  admin: ['admin@forge.demo', 'Priya Admin', { role: 'admin' }],
  learner: ['learner@forge.demo', 'Arjun Mehta', {}],
  newbie: ['newbie@forge.demo', 'Neha Unverified', { confirmed: false }],
  tpo: ['tpo@vit.demo', 'Dr. Ramesh Iyer', {}],
  faculty: ['faculty@vit.demo', 'Prof. Kavya Rao', {}],
};
const students = [
  ['s1@vit.demo', 'Aditi Sharma', '21CSE001', 'A', 8.7, 0], ['s2@vit.demo', 'Rohan Gupta', '21CSE002', 'A', 7.2, 0],
  ['s3@vit.demo', 'Sneha Reddy', '21CSE003', 'B', 9.1, 0], ['s4@vit.demo', 'Karan Singh', '21CSE004', 'B', 6.4, 2],
  ['s5@vit.demo', 'Meera Nair', '21CSE005', 'A', 8.0, 0], ['s6@vit.demo', 'Vikram Patel', '21CSE006', 'B', 5.9, 3],
];
const ids = {};
for (const [k, [email, name, opts]] of Object.entries(people)) ids[k] = await createUser(email, name, opts);
for (const [email, name] of students) ids[email] = await createUser(email, name);
log('users created');

// ── Forge learner progress, so dashboards have something to show ─────────
const firstCourse = (await db.query(`select id from public.courses where is_published and deleted_at is null order by order_index nulls last, created_at limit 1`)).rows[0];
if (firstCourse) {
  const chs = (await db.query(`select id, chapter_number from public.chapters where course_id = $1 order by chapter_number`, [firstCourse.id])).rows;
  for (const ch of chs.slice(0, 3)) {
    const status = ch.chapter_number <= 2 ? 'COMPLETED' : 'UNLOCKED';
    await db.query(`insert into public.user_chapter_progress (user_id, chapter_id, status, unlocked_at, completed_at)
      values ($1, $2, $3, now() - interval '5 days', case when $3 = 'COMPLETED' then now() - interval '2 days' end)
      on conflict (user_id, chapter_id) do nothing`, [ids.learner, ch.id, status]);
  }
  await db.query(`update public.users set xp = 340, level = public.calculate_level(340), streak = 4, streak_count = 4, longest_streak = 6,
                  last_active_date = current_date where id = $1`, [ids.learner]);
  await db.query(`insert into public.user_skills (user_id, name, level, category, sort_order) values ($1, 'Java', 'intermediate', 'language', 0),
                  ($1, 'SQL', 'beginner', 'language', 1) on conflict do nothing`, [ids.learner]);
}
// Prerequisite + drip on the second and third courses (shows both features).
const courses = (await db.query(`select id, title from public.courses where is_published and deleted_at is null and exists (select 1 from public.chapters c where c.course_id = courses.id) order by order_index nulls last, created_at`)).rows;
if (courses.length >= 2) {
  await db.query(`insert into public.course_prerequisites (course_id, required_course_id) values ($1, $2) on conflict do nothing`, [courses[1].id, courses[0].id]);
  await db.query(`update public.courses set drip_interval_days = 2 where id = $1`, [courses[1].id]);
}
log('learner progress, skills, prerequisite and drip set');

// ── College (created by Forge staff through the Campus API) ───────────────
const A = await token(people.admin[0]);
let org = (await http('GET', `${CAMPUS}/platform/colleges`, undefined, A)).find?.((c) => c.slug === 'vit-demo');
if (!org) org = await http('POST', `${CAMPUS}/platform/colleges`, { name: 'VIT Demo Institute of Technology', slug: 'vit-demo', ownerEmail: people.tpo[0], seatLimit: 500 }, A);
const T = await token(people.tpo[0]);
await http('GET', `${CAMPUS}/me`, undefined, T); // claims the owner seat
const me = await http('GET', `${CAMPUS}/me`, undefined, T);
const ORG = (me.memberships.find((m) => m.orgName?.startsWith('VIT')) || me.memberships[0]).orgId;
const O = (p) => `${CAMPUS}/orgs/${ORG}${p}`;
log('college', ORG);

const school = await http('POST', O('/departments'), { name: 'School of Engineering', code: 'SOE', kind: 'school' }, T);
const cse = await http('POST', O('/departments'), { name: 'Computer Science & Engineering', code: 'CSE', kind: 'department', parentId: school.id }, T);
const batch = await http('POST', O('/batches'), { name: 'CSE 2025', departmentId: cse.id, academicYear: '2024-25', graduationYear: 2025 }, T);
for (const s of ['A', 'B']) await http('POST', O(`/batches/${batch.id}/sections`), { name: s }, T);
log('units, batch CSE 2025 with sections A and B');

const csv = ['email,name,roll number,batch,section,role,cgpa,backlogs',
  `${people.faculty[0]},${people.faculty[1]},,CSE 2025,,faculty,,`,
  ...students.map(([e, n, r, s, c, b]) => `${e},${n},${r},CSE 2025,${s},student,${c},${b}`)].join('\n');
await http('POST', O('/roster/import'), { csv }, T);
for (const [email] of students) await http('GET', `${CAMPUS}/me`, undefined, await token(email));
await http('GET', `${CAMPUS}/me`, undefined, await token(people.faculty[0]));
log('roster imported and claimed by 6 students + 1 faculty');

// ── Tests ─────────────────────────────────────────────────────────────────
const F = await token(people.faculty[0]);
const quiz = await http('POST', O('/tests'), { title: 'Aptitude & Programming Basics', instructions: 'Answer all questions. No negative marking.', durationMinutes: 30 }, F);
const q = (body) => http('POST', O(`/tests/${quiz.id}/questions`), body, F);
await q({ type: 'mcq', body: 'What is the time complexity of binary search on a sorted array?', options: ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'], correct: [1], marks: 2, topic: 'Algorithms', difficulty: 'easy' });
await q({ type: 'mcq', body: 'Which data structure works on LIFO?', options: ['Queue', 'Stack', 'Heap', 'Graph'], correct: [1], marks: 2, topic: 'Data Structures', difficulty: 'easy' });
await q({ type: 'msq', body: 'Which of these are stable sorting algorithms?', options: ['Merge sort', 'Quick sort', 'Insertion sort', 'Heap sort'], correct: [0, 2], marks: 3, topic: 'Algorithms', difficulty: 'medium' });
await q({ type: 'nat', body: 'A train covers 180 km in 3 hours. What is its speed in km/h?', natAnswer: 60, marks: 2, topic: 'Quantitative', difficulty: 'easy' });
await q({ type: 'tf', body: 'A primary key column can contain NULL values.', answerTrue: false, marks: 1, topic: 'DBMS', difficulty: 'easy' });
await q({ type: 'fib', body: 'The keyword used to inherit a class in Java is ____.', acceptedAnswers: ['extends'], marks: 1, topic: 'Java', difficulty: 'easy' });
await q({ type: 'descriptive', body: 'Explain the difference between a process and a thread.', rubric: '2 marks: memory/address space. 2 marks: scheduling/cost. 1 mark: example.', maxWords: 200, marks: 5, topic: 'Operating Systems', difficulty: 'medium' });
await http('PATCH', O(`/tests/${quiz.id}`), { isPublished: true }, F).catch(() => {});
const coding = await http('POST', O('/tests'), { title: 'Coding Round 1', instructions: 'Solve in any language. Hidden tests decide the score.', durationMinutes: 45 }, F);
await http('POST', O(`/tests/${coding.id}/questions`), {
  type: 'coding', body: 'Given an array of integers nums and an integer target, return the indices of the two numbers that add up to target.',
  marks: 10, compare: 'unordered', topic: 'Arrays', difficulty: 'easy',
  starterCode: { python: 'class Solution:\n    def twoSum(self, nums, target):\n        pass\n', javascript: 'function twoSum(nums, target) {\n  \n}\n' },
  tests: [{ input: 'nums = [2,7,11,15], target = 9', expected: '[0,1]', isSample: true }, { input: 'nums = [3,2,4], target = 6', expected: '[1,2]' },
          { input: 'nums = [3,3], target = 6', expected: '[0,1]' }],
}, F);
await http('PATCH', O(`/tests/${coding.id}`), { isPublished: true }, F).catch(() => {});
log('2 tests: 7 question types + a coding question');

// ── Assignments: one closed with results, one open now (proctored), one upcoming ──
const closed = await http('POST', O('/assignments'), { batchId: batch.id, testId: quiz.id, title: 'Weekly Assessment 1', opensAt: at(0, -1), closesAt: at(0, 3),
  durationMinutes: 30, resultRelease: 'manual', publish: true }, F);
const open = await http('POST', O('/assignments'), { batchId: batch.id, testId: coding.id, title: 'Coding Round 1 (proctored)', opensAt: at(0, -1), closesAt: at(3),
  durationMinutes: 45, resultRelease: 'after_close', publish: true, proctoring: { enabled: true, requireFullscreen: true, blockClipboard: true, warnFirst: true, maxViolations: 5 } }, F);
await http('POST', O('/assignments'), { batchId: batch.id, testId: quiz.id, title: 'Mock Placement Test', opensAt: at(5), closesAt: at(6), durationMinutes: 30, publish: true }, F);
log('3 assignments');

// Five students take Weekly Assessment 1 with different answers.
const picks = [[1, 1, [0, 2], 60, false, 'extends'], [1, 0, [0], 60, false, 'extends'], [1, 1, [0, 2], 60, false, 'extend'],
               [0, 1, [1], 50, true, 'implements'], [1, 1, [0, 2], 55, false, 'extends']];
for (let i = 0; i < 5; i++) {
  const S = await token(students[i][0]);
  const att = await http('POST', `${CAMPUS}/my/assignments/${closed.id}/start`, { consent: true }, S).catch(async (e) => {
    if (/consent/i.test(e.message)) return http('POST', `${CAMPUS}/my/assignments/${closed.id}/start`, {}, S); throw e;
  });
  const attempt = { id: att.attemptId, questions: att.questions };
  const [a1, a2, a3, a4, a5, a6] = picks[i];
  for (const qq of attempt.questions ?? att.questions) {
    const opt = (text) => (qq.options || []).find((o) => o.text === text)?.id;
    let ans;
    if (/binary search/.test(qq.body)) ans = { selectedOptions: [opt(a1 ? 'O(log n)' : 'O(n)')] };
    else if (/LIFO/.test(qq.body)) ans = { selectedOptions: [opt(a2 ? 'Stack' : 'Queue')] };
    else if (/stable/.test(qq.body)) ans = { selectedOptions: a3.map((k) => opt(['Merge sort', 'Quick sort', 'Insertion sort', 'Heap sort'][k])) };
    else if (/train/.test(qq.body)) ans = { natValue: a4 };
    else if (/primary key/.test(qq.body)) ans = { selectedOptions: [opt(a5 ? 'True' : 'False')] };
    else if (/inherit/.test(qq.body)) ans = { textValue: a6 };
    else if (/process/.test(qq.body)) ans = { textValue: 'A process has its own address space; threads share the memory of their process and are cheaper to switch. Example: browser tabs as processes, a download thread inside one.' };
    if (ans) await http('PUT', `${CAMPUS}/my/attempts/${attempt.id ?? att.attemptId}/answers/${qq.id}`, ans, S).catch((e) => log('answer skipped', e.message.slice(-220)));
  }
  if (i === 3) await http('POST', `${CAMPUS}/my/attempts/${attempt.id}/events`, { type: 'tab_switch' }, S).catch(() => {});
  await http('POST', `${CAMPUS}/my/attempts/${attempt.id ?? att.attemptId}/submit`, {}, S);
}
log('5 students submitted Weekly Assessment 1 (one left the tab once)');

// ── Placement drive and a course given to the batch ───────────────────────
const drive = await http('POST', O('/drives'), { company: 'Infosys', roleTitle: 'Systems Engineer', jobType: 'full_time', ctc: '6.5 LPA', location: 'Bengaluru',
  batchIds: [batch.id], eligibility: { minCgpa: 7, maxBacklogs: 0 }, applyBy: at(7), description: 'Online test, technical interview, HR interview.' }, T);
await http('PATCH', O(`/drives/${drive.id}`), { status: 'open' }, T).catch(() => {});
await http('POST', `${CAMPUS}/my/drives/${drive.id}/apply`, {}, await token(students[0][0])).catch((e) => log('apply skipped', e.message.slice(0, 120)));
if (firstCourse) {
  const ca = await http('POST', O('/course-assignments'), { batchId: batch.id, courseId: firstCourse.id, title: 'Complete Programming Foundations', dueAt: at(14), publish: true }, F)
    .catch((e) => (log('course assignment skipped', e.message.slice(0, 160)), null));
  if (ca) log('course assigned to the batch');
}
log('placement drive opened');

console.log(JSON.stringify({ org: ORG, assignments: { closed: closed.id, open: open.id } }));
await db.end();

# Build plan — from the feature checklist to a placement-ready product

Source of truth for status: `FEATURE_CHECKLIST.md` (1,898 features: 375 done, 260 partly, 1,263 not done).
Strategy: `PLATFORM_AUDIT.md` (§4 the assess → gaps → practise → reassess → readiness loop).

**How we build:** small slices, each shippable on its own, each reusing what exists, each verified (tests +
a real browser run) before the next. Every slice states which checklist items it turns ✅. Rules that keep the
current product safe: additive migrations only, new UI in the existing Forge design (glass cards, Space Grotesk,
blue = action, orange = reward), Campus features gated by membership, RLS on every new table.

Order is by **value to a pilot college × how much already exists**, not by module number.

---

## Track A — Make coding real (modules 8, 9, 10, 15)
The biggest gap found: learners cannot code inside Forge, and Practice links to a page that doesn't exist.

| Slice | What | Reuses | Checklist items |
|---|---|---|---|
| **A1 · In-app practice** ✅ *built; migration not yet applied to the live DB* | `/problems/:slug` workspace: statement, examples, constraints, companies, complexity, progressive hints, solution after solving; Run on sample tests in the browser; **Submit judged on the server** against sample + hidden tests; solve → XP/streak; Practice opens it | `modules/CodeExecutor` (Monaco, 5 runtimes), problems API, XP service, Judge0 client | Browser editor, Monaco, multi-language, run/submit, test-case results, hidden/sample tests, progressive hints, editorials, company tags, solved tracking, compile/runtime errors, accepted/wrong-answer verdicts |
| **A2 · Judge0 for every language** ✅ *C++ built; C not yet* | One judge service (C, C++, Java, JS, Python); language map; TLE/MLE/WA/CE verdicts; per-test partial score | A1 judge | Multi-language judge, verdict detection, partial scoring, runtime config |
| **A3 · Submissions & editor quality** ✅ *built; migration not yet applied* | Submission history tab, code autosave per problem/language, reset, keyboard shortcuts, font size, light/dark editor | `submissions` table | Execution history, autosave, recovery, shortcuts, theme/font |
| A4 · Content | 75 core problems (Blind-75 style) with tests across the 22 taught DSA topics; company tags; POTD | admin Problems, content import | Problem library, curated sheets, POTD, company-wise |

## Track B — Assessments for colleges (modules 12, 13, 33)
| Slice | What | Reuses |
|---|---|---|
| **B1 · Coding questions in Campus tests** ✅ *built; migration not yet applied to the live DB* | Question type `coding` with test cases; exam screen embeds the A1 editor; scored by the shared judge; partial marks per test | A1, `packages/judge`, `assessment-core`, Campus exam screen |
| **B2 · Question pools & per-student extra time** ✅ *built; migration not yet applied* | Draw N of M per attempt; `assignment_accommodations` | `buildAttemptOrder` |
| **B3 · Section timers & locking** ✅ *built (Campus); migration not yet applied* | enforce `test_sections.duration_seconds`, `section_time_locked` | Test Series CBT |
| **B4 · College question import** ✅ *built* | CSV/Excel import into a college's bank, preview + per-row errors | roster import pattern, staged import |
| **B5 · Live invigilator board** ✅ *built; migration not yet applied* | live board (5 s polling + student heartbeats), timeline, reviews, extra time, end attempt | proctoring events |

## Track C — The loop: skills, readiness, remediation (modules 4, 6, 17, 18, 58, 59)
| Slice | What |
|---|---|
| C1 · Skill evidence | `skills`, `skill_evidence` (append-only), `skill_mastery`; written by judge, quizzes, Campus attempts, projects |
| C2 · Readiness | Server-side readiness per role/company profile, explainable ("62% ready for TCS NQT; gaps: …"); replaces client-side `RoadmapContext` score |
| C3 · Remediation | Result pages and dashboard link each gap to the exact chapter/problem; AI mentor reads mastery |
| C4 · Skill radar + weak topics on the dashboard | reads C1 |

## Track D — College operations (modules 2, 23, 24, 25, 40)
D1 placement-officer dashboard (batch/department rollups, CSV) · D2 notifications centre + "new test / closes in 24h / result out" emails · D3 academic year & semester on batches · D4 faculty at-risk list and per-student report · D5 announcements.

**D6 · Courses for colleges** (added 2026-10-12, after checking Learn vs Campus): catalogue and course pages honour
`owner_org_id`/`visibility` (and hide unpublished courses); assign a course or chapters to a batch with a due date;
faculty see per-student chapter progress; a college licence unlocks premium Forge courses for its students
(entitlement via membership, one source of truth with problems).

## Track E — AI that saves time (modules 6, 7, 14, 26)
E1 AI question drafting into a review queue (never auto-publish) · E2 AI explain-my-error in the editor · E3 batch result summary for faculty · E4 Hinglish mode in the mentor.

## Track F — Breadth, only after a paying pilot (modules 16, 20, 27, 29, 32, 35, 36, 41, 42, 56)
Aptitude content, AI mock interview, Meet/Zoom links + attendance, assessment certificates, contests, SQL practice (Judge0 SQLite), PWA, i18n (Hindi/Hinglish), CO-PO/NAAC reports.

## Not planned (see audit §8)
Native apps, parent portal, GPU/ML labs, cloud sandboxes, custom report builder, ABAC, in-house video, Codeforces ratings.

---

## Slice A1 — built

- **Data** (additive migration `20261010000001_problem_judging.sql`): `public.problem_test_cases`
  (problem, input, expected output, `is_sample`, order); `problems.starter_code jsonb`,
  `problems.judge_config jsonb` (`{"compare": "exact" | "unordered" | "unordered_deep"}`). RLS: sample tests are
  public; hidden tests have no client policy (server only). Seeds tests + starter code for the 8 live problems.
- **Judging:** `POST /api/problems/:id/judge {code, language}` runs every test on Judge0 with a per-language
  harness that calls the student's function exactly like the browser runner (same `name = value` input format,
  same comparison), returns per-test verdicts (hidden tests without their inputs), and records the solve + XP
  **only when every test passes**. Without `JUDGE0_URL` it returns 503 with a clear message (Run still works).
- **Integrity fix:** the legacy `POST /problems/:id/submit` (which marked any problem solved on the client's
  word) refuses problems that have test cases.
- **UI:** `/problems/:slug` full-screen workspace in Forge style; Practice opens it in the same tab.

**Status:** built and verified (shared compare: 5 tests; judge with real JS/Python/Java: 11 tests; endpoint rules: 7
tests; SQL suite: 7 checks, mutation-tested; browser run: open from Practice → hints → Run → wrong Submit caught by
hidden tests (2/6) → correct Submit 6/6 + XP → refresh keeps code → Python and Java accepted → any-order answers
accepted → Practice shows solved). Fixed on the way: Practice opened a page that didn't exist; the Practice status
menu never worked (wrong `useApiMutation` call); premium checks always saw "free"; the old submit trusted the browser;
the editor reset itself (and lost autosaved code) whenever its question data was refetched.

**To go live:** apply `20261010000001_problem_judging.sql` to Supabase (seeds tests + starter code for the 8 live
problems), deploy Judge0 and set `JUDGE0_URL` on the Forge API (without it, production Submit returns 503 and Run
still works).

**Next:** A2 (C/C++ on the judge, partial scores per test), then A4 content (more problems with tests), then B1
(coding questions in Campus tests, reusing this judge).

---

## Slice B1 — built

- **Shared judge** `packages/judge` (`@repo/judge`): the A1 harnesses, Judge0 client and dev-only local runner, now
  taking an explicit `JudgeConfig`. The Forge API's `problemJudge.service.ts` is a thin wrapper over it; the Campus
  API uses it too (new env `JUDGE0_URL`, `JUDGE0_AUTH_TOKEN`, language ids, `JUDGE0_TIMEOUT_MS`).
- **Data** (additive migration `20261011000001_campus_coding_questions.sql`): `testseries_questions` accepts
  `question_type = 'coding'` with `starter_code` (per language; its keys are the allowed languages) and
  `judge_config.compare`; a coding row must have starter code and a known compare mode. New
  `public.question_test_cases` (sample + hidden tests). RLS: only staff with `content.create` in the college that
  owns the question (never Forge-owned questions); students and anon have nothing.
- **Scoring** (`assessment-core`): coding answers carry `code`, `language` and the judge's `tests_passed` /
  `tests_total`; marks = marks × passed / total, no negative marking; 0 while `grading = 'pending'`.
- **Campus API:** faculty create coding questions with tests (≥ 1 sample); the attempt view sends starter code,
  languages and **sample tests only**; `PUT …/answers/:qid` accepts `{code, language}`;
  `POST /my/attempts/:id/questions/:qid/run` runs the samples (3 s cooldown per attempt). Submit **closes the attempt
  first** (no answer can change while judging), then judges every coding answer on all tests and rescores. If the
  judge is down, those answers stay "grading pending" and staff press **Grade now**
  (`POST /orgs/:org/assignments/:id/regrade`, `{rejudge: true}` re-runs all, e.g. after fixing a test); results show
  who is pending.
- **UI:** exam screen splits into statement + examples | Monaco editor + sample-run results; code autosaves per
  language; reload restores it. Lockdown listens in the capture phase so paste/copy/right-click are blocked inside
  Monaco too (and drag-dropped text). Result page shows tests passed per coding question. Portal: coding form
  (languages, starter code, compare mode, sample/hidden tests), question summary, pending banner + Grade now.

**Status:** built and verified — shared judge 14 tests; assessment-core 52; Forge API 86; Campus API 29 integration
tests (7 new: authoring rules, no hidden tests in the student view, Run on samples + cooldown, language rules,
partial marks 4/6 on submit, regrade permissions and pending → judged, students can't read test cases in SQL);
SQL suites pass with 12 new checks (mutation-tested); browser run against the real Campus API: hidden tests absent
from the page, paste into the editor blocked, wrong answer caught on samples, Python partial solution saved and
restored after reload, submit → 4/5 tests, 10/12 marks; portal authoring and results.

**To go live:** apply `20261011000001_campus_coding_questions.sql` (after `20261010000001_problem_judging.sql`),
deploy Judge0 and set `JUDGE0_URL` on the **Campus API** as well as the Forge API.

**Not in B1 (later):** editing a coding question after creation (delete + re-add today), C/C++ (A2), per-test
weights, plagiarism checks across submissions, showing students their code on the result page.

---

## Slice A2 — C++ built (C not yet)

- **Judge** (`packages/judge/src/cpp.ts`): C++ has no reflection, so the `Solution` method's signature is read from
  the code and each test's `name = value` input is turned into typed C++ literals at generation time — `int`,
  `long long`, `double`, `bool`, `char`, `string` and (nested) `vector`s of those. Results print JSON-style, so
  `compareOutputs()` treats them like every other language. The learner's `cout` is captured per test; a crash only
  fails the tests it didn't reach. Judge0 language 54 (GCC) with `-O2 -std=gnu++17`; `g++` locally in development.
  Clear messages for unsupported types, a learner-written `main()`, and compiler errors (no generated-file paths).
- **Security fix (affects A1 and B1):** a learner could read the judge's per-run marker (e.g. JavaScript
  `Function.caller` exposes the harness source) and print fake "passed" lines before the real one. A second result
  line for a test now fails that test. Mutation-checked: without the fix the forger passes 2 hidden tests.
  *Follow-up (2026-10-12):* the real risk was answer leakage, not forged lines — the Java judge sent expected outputs
  on stdin and in the source file. Fixed; the program now receives inputs only, so a forged line can't do better
  than an honest return value.
- **Practice:** `POST /api/problems/:id/run` (samples only, server side, never records anything); the workspace sends
  C++ Run there (the browser can't run a C++ Solution class) and keeps JS/Python/Java Run in the browser. Problems
  offer the languages they have starter code for; migration `20261012000001_problem_cpp_starters.sql` adds C++
  starters to the 8 live problems.
- **Campus:** coding questions may allow C++ (portal, API, exam screen).

**Status:** verified — judge 22 tests (C++: vectors/strings/nested/doubles/bools/long long, compile errors, unsupported
types, `main()`, exceptions, crash mid-run; tampering); Forge API 89 (run endpoint: samples only, nothing recorded,
C++, premium); Campus API 30 (C++ answer with an `int` overflow scores 1/2 tests); all 8 live problems' seeded tests
pass with correct C++ solutions (scratch DB with every migration applied); browser: C++ offered in practice, Run goes
to the server and catches a wrong answer, Submit accepted 6/6 with XP, JavaScript Run stays in the browser.

**To go live:** apply `20261012000001_problem_cpp_starters.sql` after `20261010000001_problem_judging.sql`.

**Left for later:** C (LeetCode-style C signatures pass arrays as pointer + size — needs its own harness), `pair`,
`map`, linked-list/tree inputs, per-test weights.

---

## Slice B3 — timed, locked sections (Campus) — built

- **Rules** (`assessment-core/sections.ts`): one section at a time; when its time is up the next starts *at that
  moment* (being offline buys nothing); finishing early forfeits the rest; never past the attempt deadline.
- **Data** (`20261013000001_campus_section_timing.sql`): `test_attempts.current_section`, `section_started_at`; a
  question can only sit in a section of its own test (trigger); section durations 1 min–24 h.
- **API:** section CRUD, move questions, the "timed sections" switch, publish refuses incomplete setups. An attempt
  snapshots its sections at start and lasts their sum; only the current section's questions are sent; answers
  elsewhere get 423; automatic and early (`POST /my/attempts/:id/sections/finish`) moves. `/my/assignments` lists the
  section plan.
- **UI:** instructions list the sections; exam shows "Section n of m", the section clock, "Finish section" with a
  no-going-back confirmation, and moves on by itself. Portal: Sections panel, switch, grouping, section mover/picker.

**Verified:** assessment-core 59 tests (7 new); SQL checks (5 new, mutation-tested); Campus API 35 (5 new: build,
publish rules, plan shown, current-section-only + 423, automatic move, finish last → submit); browser: full student
flow including the clock running out, portal panel.

**Not covered:** the Forge Test Series CBT (`apps/web` test series) still ignores section timing — it has 0 live
tests; port when it gets content.

---

## Slice B5 — live invigilation — built

- **Data** (`20261014000001_campus_invigilation.sql`): invigilators read their college's assignments, attempts and
  batch roster; `test_attempts.last_seen_at`; `campus.attempt_adjustments` (extra time / force-submit audit);
  `campus.incident_reviews` (append-only, signed by the reviewer); submit reason `invigilator`.
- **API:** `GET …/assignments/:id/live` (everyone in the batch: writing / offline / not started / submitted,
  answered, current section, time left, violations, last event, review, extra minutes); `extend` (also extends the
  current timed section), `force-submit`, `reviews`, `timeline`; student `heartbeat` every 30 s; last-seen stamped on
  every student request. Results + CSV show the review. Invigilators can open the assignment list.
- **UI:** portal Live board (stat tiles, filters, per-student actions, timeline dialog), Live links on open
  assignments and results; invigilator navigation; the exam notices an ended attempt within a heartbeat and the
  student's result explains it.
- **Why polling, not Supabase Realtime:** the portal talks only to the Campus API (RLS via `asUser`); 5 s polling of
  one indexed query per board is cheap at college scale and needs no new channel to secure.

**Verified:** SQL checks (10 new, mutation-tested); Campus API 41 (6 new); browser with a real invigilator account:
board, timeline, review, +15 min (time left 44:57 → 59:57), end attempt, student redirected with the notice.

---

## Slice A3 — submissions & editor quality — built

- **Data** (`20261015000001_practice_submission_history.sql`): `public.problem_submissions` — every judged practice
  submission (code, verdict, passed/total, time); learners read their own, only the API writes. **Security fix:**
  dropped "Users can insert own submissions" on `public.submissions` (a learner could mark a problem solved
  through the public API key without being judged; nothing in the apps used it).
- **API:** the judge records every submission (best effort); `GET /api/problems/:id/submissions`.
- **UI:** Submissions tab (newest first, expand to see and copy code); editor settings (font size, word wrap,
  Format code for JavaScript, shortcut list), Ctrl/⌘+Enter run, Ctrl/⌘+Shift+Enter submit, full-screen editor
  (disabled inside proctored exams, where leaving full screen counts as a violation). Prefs persist per browser.

**Verified:** SQL checks (4 new, mutation-tested); Forge API 92 (3 new); browser: history after a wrong and a right
submit, settings applied and remembered, Ctrl+Enter, Format, full screen in and out.

---

## Slice B2 — question pools and accommodations — built

- **Rules** (`assessment-core/pools.ts`): deal N of M per section (or the unsectioned part), seeded by the attempt.
- **Data** (`20261016000001_campus_pools_accommodations.sql`): `draw_count` on sections and tests;
  `campus.assignment_accommodations` (extra % per student; composite keys keep student, assignment and college the
  same; staff manage, the student sees their own).
- **API:** pool counts; publish refuses pools that deal more than they hold, mix marks, or hold passage questions;
  attempts draw before ordering; accommodations stretch the test and each timed section (and may run past closing
  by the same share); list / set / remove; `/my/assignments` shows the student's extra time.
- **UI:** portal "deal N per student" on sections (or a test-level pool), header shows what each student gets;
  results page "Extra time" card; the student's instructions show "includes your 25% extra time".

**Verified:** assessment-core 63 (4 new); SQL checks (9 new, mutation-tested); Campus API 44 (3 new); browser:
portal pool + extra time, student intro (25 min) and 3 of 8 questions dealt.

---

## Slice B4 — college question import — built

- **Parser** (`assessment-core/questionSheet.ts`): one question per row; forgiving headers (Question / Option A or A /
  Answer or Key…), answers as a letter, several letters, a number, or the option's text; infers the type when there
  is no Type column; strict per-line errors; up to 500 rows. Template included.
- **API:** `POST …/tests/:id/questions/import/preview` (writes nothing) and `…/import` (all or nothing, creates
  missing sections, RLS as the faculty member).
- **Portal:** "Import from Excel" on the test editor (template download, preview with errors and the first questions,
  import). `.xlsx` is read in the browser (`src/lib/sheets.ts`, unzip with `fflate` 0.8.2 + the sheet XML) and sent
  as CSV; the roster upload now takes `.xlsx` too. Old binary `.xls` is refused with "Save as .xlsx or .csv".
  No new dependency on the API side.

**Verified:** assessment-core 68 (5 new); Campus API 47 (3 new); browser with real Excel files: bad sheet shows
line 7 and blocks import, good sheet imports 5 questions into created sections; Excel roster preview flags line 4.

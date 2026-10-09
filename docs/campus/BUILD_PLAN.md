# Build plan — from the feature checklist to a placement-ready product

Source of truth for status: `FEATURE_CHECKLIST.md` (1,898 features: 321 done, 285 partly, 1,292 not done).
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
| A2 · Judge0 for every language | One judge service (C, C++, Java, JS, Python); language map; TLE/MLE/WA/CE verdicts; per-test partial score | A1 judge | Multi-language judge, verdict detection, partial scoring, runtime config |
| A3 · Submissions & editor quality | Submission history tab, code autosave per problem/language, reset, keyboard shortcuts, font size, light/dark editor | `submissions` table | Execution history, autosave, recovery, shortcuts, theme/font |
| A4 · Content | 75 core problems (Blind-75 style) with tests across the 22 taught DSA topics; company tags; POTD | admin Problems, content import | Problem library, curated sheets, POTD, company-wise |

## Track B — Assessments for colleges (modules 12, 13, 33)
| Slice | What | Reuses |
|---|---|---|
| B1 · Coding questions in Campus tests | Question type `coding` with test cases; exam screen embeds the A1 editor; scored by the A2 judge; partial marks per test | A1/A2, `assessment-core`, Campus exam screen |
| B2 · Question pools & per-student extra time | Draw N of M per attempt; `attempt_overrides` | `buildAttemptOrder` |
| B3 · Section timers & locking | enforce `test_sections.duration_seconds`, `section_time_locked` | Test Series CBT |
| B4 · College question import | CSV/Excel import into a college's bank, preview + per-row errors | roster import pattern, staged import |
| B5 · Live invigilator board | Supabase Realtime over `proctoring_events` | proctoring events |

## Track C — The loop: skills, readiness, remediation (modules 4, 6, 17, 18, 58, 59)
| Slice | What |
|---|---|
| C1 · Skill evidence | `skills`, `skill_evidence` (append-only), `skill_mastery`; written by judge, quizzes, Campus attempts, projects |
| C2 · Readiness | Server-side readiness per role/company profile, explainable ("62% ready for TCS NQT; gaps: …"); replaces client-side `RoadmapContext` score |
| C3 · Remediation | Result pages and dashboard link each gap to the exact chapter/problem; AI mentor reads mastery |
| C4 · Skill radar + weak topics on the dashboard | reads C1 |

## Track D — College operations (modules 2, 23, 24, 25, 40)
D1 placement-officer dashboard (batch/department rollups, CSV) · D2 notifications centre + "new test / closes in 24h / result out" emails · D3 academic year & semester on batches · D4 faculty at-risk list and per-student report · D5 announcements.

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

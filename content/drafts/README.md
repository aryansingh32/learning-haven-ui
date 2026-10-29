# Content drafts (W5)

Original practice problems, aptitude questions, mock tests and courses, written for Forge and **not yet published**.
Nothing here touches a database until someone runs an `out/import_*.sql` file by hand. The imports are
idempotent (re-running adds nothing), and everything they create is unpublished except the practice problems
(the `problems` table has no draft flag, so run `import_problems.sql` only after review).

| Set | Size | Source | How correctness is checked |
|---|---|---|---|
| Practice problems | 82, each with starter code (JS, Python, C++, and Java where the signature allows), editorial, hints, 8-10 tests | `p_*.py` | Expected outputs are computed from a Python reference solution. `verify_problems.mjs` runs every reference through the real judge package (all tests must pass, an empty solution must fail). `crosscheck.py` compares ~28 references with independent brute force. |
| Aptitude bank | 414 MCQs (221 quant, 150 reasoning, 43 verbal), tagged by section and topic | `aptitude_gen.py`, `aptitude_verbal.py` | Quant and reasoning answers are computed in code (with exact-division guards); distractors are validated as 4 distinct options. Verbal questions are hand-written: **needs a human reader**. |
| Mock tests | 8 sectional tests x 29 questions (Quant 14, Reasoning 10, Verbal 5), in an unpublished series | `build_aptitude.py` | SQL tested on a scratch database: re-runnable, 8 x 29 links. |
| Courses | *DSA Patterns for Interviews* (15 chapters) and *Aptitude Mastery for Placements* (12 chapters): story, lesson, quiz, practice task each | `courses_dsa.py`, `courses_aptitude.py`, `build_courses.py` | Every code snippet in the lessons is executed against asserts; practice links must name real problems; aptitude quizzes come from the verified bank. |

## Rebuild
```bash
cd content/drafts
python3 build_problems.py && node verify_problems.mjs && python3 crosscheck.py
python3 build_aptitude.py && python3 build_courses.py
```

## Review, then publish
1. The team reads `out/problems.json`, `out/aptitude.json` and `out/courses.json` (or the generated SQL).
   Reject or edit at the source (`p_*.py`, generators, course files), rebuild, re-verify.
2. Apply the SQL on the live project (owner step, one file at a time, in this order):
   `import_problems.sql`, `import_aptitude.sql`, `import_courses.sql`.
3. Publish: `update public.courses set is_published = true where slug in (...)`, then the test series and each mock
   (`public.test_series.is_published`, `public.tests.is_published`; mock 1 is already marked free as a sample).

## Not done yet
- Linked-list and tree problems (the judge has no structure types yet), and C-language starters.
- Company tags are deliberately empty: "asked at X" claims need a source.
- More courses (SQL, Python, web, English, communication), more problems per topic, and a hand-reviewed verbal bank.
- Course videos: the lessons are text only (the chapter model supports video steps).

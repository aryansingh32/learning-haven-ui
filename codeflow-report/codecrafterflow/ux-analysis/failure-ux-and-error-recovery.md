# Failure UX & Error Recovery Analysis

## Failure Log Format (From Browser Logs Panel)
When a test fails, the log panel at the bottom of the browser workspace shows:

```
[tester::#EZ5] Running tests for Stage #EZ5 (Implement type)
[tester::#EZ5] Running ./your_program.sh
[your-program] $ type echo
[your-program] type: command not found
[tester::#EZ5] ^ Line does not match expected value.
[tester::#EZ5] Expected: "echo is a shell builtin"
[tester::#EZ5] Received: "type: command not found"
[tester::#EZ5] Test failed
```

## Critical Failure UX Elements

### 1. Diff-Style Assertion Rendering
- **`^ Line does not match expected value.`** — A caret pointing to the problematic output line.
- **`Expected: "echo is a shell builtin"`** — Shows the EXACT expected output in quotes.
- **`Received: "type: command not found"`** — Shows the EXACT user output in quotes.
- **Design principle**: No ambiguity. The user knows EXACTLY what went wrong and what was expected.

### 2. Failure Psychology
- The failure message is **educational, not punishing**:
  - It doesn't say "ERROR" or "WRONG"
  - It says "Line does not match expected value" — neutral, diagnostic language
  - It provides both expected and received — enabling self-diagnosis
- The status bar changes to `● Tests failed.` with a red/orange indicator
- The "Show logs" button remains accessible for detailed inspection

### 3. No Penalty for Failure
- Users can resubmit unlimited times
- No streak breaking
- No rank reduction
- No cool-down period
- **Psychology**: This creates a safe-to-fail environment. Users feel comfortable experimenting because failure has zero cost.

### 4. Guided Recovery Path
After seeing a failure, the user has clear options:
1. Read the diff to understand what went wrong
2. Check hints (expandable accordion)
3. View concepts tab for foundational knowledge
4. View code examples (with the spoiler gate warning)
5. Ask on the forum tab
6. Re-edit their code and resubmit

### 5. Bottom Status Bar States
The status bar at the bottom cycles through these states:

| State | Indicator | Text |
|---|---|---|
| Idle | ● (gray) | "Ready to run tests" |
| Running | ● (yellow/animated) | "Running tests..." |
| Passed | ● (green) | "Tests passed!" + "Show logs" |
| Failed | ● (red/orange) | "Tests failed." + "Show logs" |
| Already implemented | ● (green) | "Next stage already implemented!" + "Show logs" |

### 6. "Next stage already implemented!" — Proactive Detection
When the platform detects that the user's current code ALREADY satisfies the next stage's tests (because they implemented ahead), it shows:
`● Next stage already implemented!`
This is a **delightful surprise UX** — the user gets a bonus stage completion without extra work. It rewards thorough/experienced developers.

## Inferred Backend Behavior on Failure
1. Tester runs the stage tests
2. First assertion failure triggers:
   - Log line with `^` indicator
   - Expected/received diff
   - `Test failed` termination
3. **Remaining regression tests are NOT run** — the pipeline stops at the first failure
4. Failure result is broadcast via WebSocket to the browser
5. Browser updates the bottom bar and logs panel

## Error Types We Can Infer

### Compilation Error
```
[compile] Error: ...
[compile] Compilation failed.
```
Would appear if the user's code has syntax errors (for compiled languages).

### Runtime Error / Crash
```
[your-program] Traceback (most recent call last):
[your-program]   File "app/main.py", line X, in <module>
[your-program] ...Error
[tester::#XXX] Program exited with error code 1
[tester::#XXX] Test failed
```
The tester captures stderr and reports non-zero exit codes.

### Timeout
```
[tester::#XXX] Timed out waiting for output
[tester::#XXX] Test failed
```
If the user's program hangs or takes too long, a timeout triggers failure.

### Output Mismatch (Observed)
```
[tester::#XXX] ^ Line does not match expected value.
[tester::#XXX] Expected: "..."
[tester::#XXX] Received: "..."
```
The most common failure type — wrong output format or logic error.

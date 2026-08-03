# Stage-by-Stage Verification Observations

## Critical Discovery: Regression Testing

When submitting Stage 2, the grading system ran BOTH:
1. `[tester::#CZ2] Running tests for Stage #CZ2 (Handle invalid commands)` — the NEW stage
2. `[tester::#OO8] Running tests for Stage #OO8 (Print a prompt)` — Stage 1 REGRESSION test

**This means**: Every submission re-runs ALL previously passed stages. This is a critical design decision:

### Why This Matters
- **Code quality enforcement**: Users can't break previous stages while solving new ones.
- **Holistic validation**: The final submission represents a working shell at every stage of completion.
- **Architecture insight**: The test harness has an ordered list of all stages and runs them sequentially for the current stage + all prior stages.

### Implications for Our Platform
- Tests must be **cumulative**, not isolated.
- The test runner must know the stage ordering and execute from the current stage backward (or forward through all).
- This increases execution time linearly with stage count — turbo mode becomes more valuable as users progress.

---

## Stage 1: Print a Prompt (#OO8)

### Test Behavior
```
[tester::#OO8] Running tests for Stage #OO8 (Print a prompt)
[tester::#OO8] Running ./your_program.sh
[your-program] $ 
[tester::#OO8] ✓ Received prompt
[tester::#OO8] Test passed.
```

### Test Logic
- Tester launches the user's program.
- Reads stdout.
- Asserts that `$ ` appears in the output.
- Simple pattern matching — no stdin interaction needed.

### Timing
- Total execution: ~2-3 seconds (turbo mode).
- Compilation + test run.

---

## Stage 2: Handle Invalid Commands (#CZ2)

### Test Behavior
```
[tester::#CZ2] Running tests for Stage #CZ2 (Handle invalid commands)
[tester::#CZ2] Running ./your_program.sh
[your-program] $ invalid_banana_command
[your-program] invalid_banana_command: command not found
[tester::#CZ2] ✓ Received command not found message
[tester::#CZ2] Test passed.
```

### Test Logic
1. Tester launches the user's program.
2. Reads `$ ` prompt from stdout (implicit Stage 1 check within Stage 2).
3. Sends `invalid_banana_command\n` via stdin.
4. Reads stdout for `invalid_banana_command: command not found`.
5. Asserts the output matches the expected "command not found" format.

### Insights
- The tester uses **creative, non-obvious test inputs** (`invalid_banana_command`) — this prevents hardcoding.
- The test is likely randomized or has a set of test commands that vary between runs.
- The tester communicates with the user's program via **stdin/stdout pipes** — a classic process interaction pattern.

---

## Stage Identifier Mapping
| Stage Name | ID | Position |
|---|---|---|
| Print a prompt | #OO8 | 1 |
| Handle invalid commands | #CZ2 | 2 |
| REPL | #FF4 (predicted) | 3 |

Note: IDs are NOT sequential numbers — they are short alphanumeric codes. This allows non-breaking reordering and flexible challenge management.

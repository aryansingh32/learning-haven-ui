# Test Execution Deep Analysis — Stages 1-4 Complete Run

## Full Test Output (Stage 4 Submission)

### Stage #PN5 (Implement exit) — The CURRENT stage
```
[tester::#PN5] Running tests for Stage #PN5 (Implement exit)
[tester::#PN5] Running ./your_program.sh
[your-program] $ invalid_blueberry_command
[your-program] invalid_blueberry_command: command not found
[tester::#PN5] ✓ Received command not found message
[your-program] $ exit
[tester::#PN5] ✓ Program exited successfully
[tester::#PN5] ✓ No output after exit command
[tester::#PN5] Test passed.
```

### Stage #FF0 (Implement a REPL) — Regression
```
[tester::#FF0] Running tests for Stage #FF0 (Implement a REPL)
[tester::#FF0] Running ./your_program.sh
[your-program] $ invalid_command_1
[your-program] invalid_command_1: command not found
[tester::#FF0] ✓ Received command not found message
[your-program] $ invalid_command_2
[your-program] invalid_command_2: command not found
[tester::#FF0] ✓ Received command not found message
[your-program] $ invalid_command_3
[your-program] invalid_command_3: command not found
[tester::#FF0] ✓ Received command not found message
[your-program] $ 
[tester::#FF0] Test passed.
```

### Stage #CZ2 (Handle invalid commands) — Regression
```
[tester::#CZ2] Running tests for Stage #CZ2 (Handle invalid commands)
[tester::#CZ2] Running ./your_program.sh
[your-program] $ invalid_strawberry_command
[your-program] invalid_strawberry_command: command not found
[tester::#CZ2] ✓ Received command not found message
[tester::#CZ2] Test passed.
```

### Stage #OO8 (Print a prompt) — Regression
```
[tester::#OO8] Running tests for Stage #OO8 (Print a prompt)
[tester::#OO8] Running ./your_program.sh
[your-program] $ 
[tester::#OO8] ✓ Received prompt
[tester::#OO8] Test passed.
```

---

## Critical Findings

### 1. Test Execution Order: Current → Oldest
Tests run in **reverse chronological order** (newest stage first):
`#PN5 → #FF0 → #CZ2 → #OO8`

**Why this matters**:
- Failing the CURRENT stage gives immediate feedback
- Only if the current stage passes do regression tests run
- This optimizes for fast failure — if the user's new code doesn't even pass the current stage, no need to waste time on regressions

### 2. Randomized Test Inputs (Confirmed)
Across submissions, test inputs vary:
- Stage 1 submission: `invalid_banana_command`
- Stage 2 submission: `invalid_apple_command`
- Stage 4 submission: `invalid_blueberry_command`, `invalid_strawberry_command`
- REPL test: `invalid_command_1`, `invalid_command_2`, `invalid_command_3`

**Pattern**: Uses `invalid_<fruit>_command` for single-command tests, and `invalid_command_<N>` for sequential REPL tests.

**Why randomize?**:
- Prevents hardcoded responses (e.g., `if input == "invalid_banana_command"`)
- Ensures the user's code actually implements the logic, not just pattern-matches known inputs
- Creates different log output each time, preventing "I'll just submit until it works" mindset

### 3. Multi-Assertion Tests
Stage #PN5 shows three assertions in one test:
```
✓ Received command not found message   ← Tests invalid command handling (Stage 2 behavior)
✓ Program exited successfully           ← Tests exit command works
✓ No output after exit command          ← Tests exit is clean (no trailing prompts)
```

**Insight**: Each stage's test is a **scenario** that validates not just the new feature but its integration with previous features. Stage 4's test:
1. First sends an invalid command (validating Stage 2 still works)
2. Then sends `exit` (validating Stage 4)
3. Then checks there's no output after exit (edge case validation)

### 4. REPL Test: Triple Command Sequence
```
[your-program] $ invalid_command_1  → ✓ Received command not found message
[your-program] $ invalid_command_2  → ✓ Received command not found message
[your-program] $ invalid_command_3  → ✓ Received command not found message
[your-program] $                    → (implied: exits on EOF)
```

**Insight**: The REPL test sends 3 commands to verify the loop persists across multiple iterations, then sends EOF to verify clean exit. This validates:
- The loop doesn't exit after one command
- The prompt re-appears after each command
- The program handles EOF gracefully

### 5. Process Lifecycle Per Test
EACH stage test spawns a **fresh process** (`Running ./your_program.sh`). Tests are NOT cumulative within a single process — each test starts with a clean shell instance.

**Architecture implication**: The tester binary:
1. Spawns `your_program.sh` as a child process
2. Controls its stdin/stdout via pipes
3. Sends inputs and reads outputs
4. Verifies assertions
5. Kills the process
6. Reports results
7. Moves to the next stage's test (spawns a new process)

### 6. Compilation Step Consistency
Every submission starts with:
```
[compile] Moved ./.codecrafters/run.sh → ./your_program.sh
[compile] Compilation successful.
```
The entry point overwrite happens EVERY time, confirming it's a security-critical step in the pipeline.

---

## Inferred Tester Architecture

```python
# Pseudo-code for the tester
class StageTester:
    def __init__(self, stage_id, test_config):
        self.stage_id = stage_id
        self.test_config = test_config
    
    def run(self):
        # 1. Spawn user program
        process = subprocess.Popen(
            ["./your_program.sh"],
            stdin=PIPE, stdout=PIPE, stderr=PIPE
        )
        
        # 2. Execute test scenario
        for step in self.test_config.steps:
            if step.type == "wait_for_output":
                output = process.stdout.readline()
                assert step.expected in output
                log(f"✓ {step.description}")
            elif step.type == "send_input":
                process.stdin.write(step.input + "\n")
            elif step.type == "wait_for_exit":
                process.wait(timeout=5)
                assert process.returncode == step.expected_code
                log(f"✓ {step.description}")
        
        log("Test passed.")

# Main runner
stages = get_stages_for_challenge("shell", up_to=current_stage)
for stage in reversed(stages):  # Run current stage first
    tester = StageTester(stage.id, stage.test_config)
    result = tester.run()
    if not result.passed:
        report_failure(result)
        exit(1)

report_success()
```

### Admin Test Configuration (Inferred)
Each stage's test is probably defined as a YAML/JSON configuration:

```yaml
stage_id: "PN5"
name: "Implement exit"
test_scenarios:
  - steps:
      - type: "wait_for_output"
        expected: "$ "
        description: "Received prompt"
      - type: "send_input"
        input: "invalid_{{random_fruit}}_command"
      - type: "wait_for_output"
        expected: "{{input}}: command not found"
        description: "Received command not found message"
      - type: "wait_for_output"
        expected: "$ "
      - type: "send_input"
        input: "exit 0"
      - type: "wait_for_exit"
        expected_code: 0
        description: "Program exited successfully"
      - type: "assert_no_output"
        description: "No output after exit command"
```

The `{{random_fruit}}` template variable is replaced at runtime to prevent hardcoding.

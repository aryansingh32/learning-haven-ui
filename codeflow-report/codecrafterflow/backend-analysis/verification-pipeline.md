# Automatic Code Verification Pipeline — Deep Analysis

## Full Lifecycle Observed (Stage 1: Print a Prompt)

### 1. User Action → Git Push
```
git add -A
git commit -m "Stage 1: Print a prompt"
codecrafters submit
```
- The `codecrafters submit` CLI command is a wrapper around `git push`.
- It commits any staged changes and pushes to the remote `origin master`.
- **Key observation**: The local commit hash was `0c2f625`, but the CLI reported "Submitting changes (commit: e4aaaba)". This suggests the CLI or Git server **rewrites/squashes** commits during push, possibly to normalize commit hashes for the grading pipeline.

### 2. Turbo Test Mode
```
⚡ This is a turbo test run. https://codecrafters.io/turbo
```
- **Turbo tests** are a premium feature that provides faster test execution.
- The CLI automatically detects whether the user has turbo access and uses it.
- **Inference**: There are likely two execution tiers:
  - **Standard**: Shared worker pool, possible queue wait times.
  - **Turbo**: Dedicated or priority workers, near-instant execution.

### 3. Compilation Phase
```
[compile] Moved ./.codecrafters/run.sh → ./your_program.sh
[compile] Compilation successful.
```
- The grading pipeline **overwrites** `your_program.sh` with `.codecrafters/run.sh`.
- This is a security measure — it ensures the user's local `your_program.sh` customizations cannot bypass the canonical execution contract.
- For Python, compilation is trivially successful (no-op), but for compiled languages this step would invoke the compiler.

### 4. Test Execution Phase
```
[tester::#OO8] Running tests for Stage #OO8 (Print a prompt)
[tester::#OO8] Running ./your_program.sh
[your-program] $ 
[tester::#OO8] ✓ Received prompt
[tester::#OO8] Test passed.
```
- **Stage ID**: `#OO8` — each stage has a unique alphanumeric identifier, NOT sequential integers. This allows stages to be reordered or inserted without breaking references.
- **Test Execution**: The grading system runs `./your_program.sh` (which is now the canonical `run.sh`).
- **Output Capture**: The tester captures stdout from the user's program (`[your-program] $ `).
- **Assertion**: The tester checks if the output matches the expected pattern ("Received prompt" → looking for `$ ` in stdout).
- **Result**: `Test passed.`

### 5. Post-Test Actions
```
Test passed. Congrats!
Mark step as complete in your browser.
```
- The CLI instructs the user to return to the browser.
- **Inference**: The CLI does NOT automatically advance the stage. The browser receives a real-time update (via WebSocket) that tests passed, and the user must acknowledge/click in the browser to unlock the next stage.

## Verification Pipeline Architecture (Inferred)

```
┌─────────────────┐     ┌───────────────────┐     ┌──────────────────┐
│   User's IDE    │     │  Git Server        │     │  Job Queue       │
│   (Local)       │────▶│  git.codecrafters  │────▶│  (Redis/Sidekiq) │
│                 │push │  .io               │hook │                  │
└─────────────────┘     └───────────────────┘     └────────┬─────────┘
                                                           │
                                                           ▼
                        ┌───────────────────┐     ┌──────────────────┐
                        │  WebSocket Server  │◀────│  Execution Worker│
                        │  (ActionCable)     │     │  (Docker/K8s)    │
                        └───────┬───────────┘     └──────────────────┘
                                │                         │
                                ▼                         │
                        ┌───────────────────┐             │
                        │  Browser UI       │             │
                        │  (Ember.js)       │             │
                        └───────────────────┘             │
                                ▲                         │
                                │    result event         │
                                └─────────────────────────┘
```

### Execution Worker Internals (Inferred)
1. **Pull commit**: Worker clones/pulls the specific commit from the Git server.
2. **Resolve buildpack**: Reads `codecrafters.yml` → determines Docker image (e.g., `python-3.14`).
3. **Prepare sandbox**: Spins up an isolated container with the buildpack image.
4. **Compile**: Runs `.codecrafters/compile.sh` inside the container.
5. **Overwrite entry point**: Copies `.codecrafters/run.sh` → `your_program.sh`.
6. **Execute test**: Runs the stage-specific test harness, which invokes `./your_program.sh`.
7. **Capture output**: Captures stdout/stderr from the user's program.
8. **Assert**: Compares output against expected patterns/values.
9. **Report**: Sends pass/fail result + logs back via WebSocket/API.
10. **Cleanup**: Destroys the container.

### Test Harness Architecture
- Each stage has a dedicated **tester binary** (e.g., `tester::#OO8`).
- The tester likely runs as a separate process that:
  1. Spawns the user's program (`./your_program.sh`)
  2. Sends inputs via stdin (simulating user commands)
  3. Reads stdout/stderr
  4. Asserts against expected patterns
- The tester is NOT part of the user's repository — it lives on the backend, configured by admins.
- The `[tester::...]` and `[your-program]` prefixes in logs show that output is multiplexed from two sources.

### Log Streaming
- Logs are streamed in real-time to the CLI terminal.
- They are also broadcast to the browser via WebSocket.
- The `[compile]`, `[tester::#XXX]`, and `[your-program]` prefixes are structured log tags.
- This suggests a structured logging pipeline (possibly JSON logs parsed and formatted by both CLI and browser).

### Key Security Observations
1. **Entry point overwrite**: The system copies `.codecrafters/run.sh` → `your_program.sh` to prevent user tampering.
2. **Isolated containers**: Each test run likely gets a fresh container to prevent state leakage.
3. **No network access**: The sandbox probably blocks outbound network to prevent cheating.
4. **Timeouts**: Implied by the structured test execution (no hanging tests observed).

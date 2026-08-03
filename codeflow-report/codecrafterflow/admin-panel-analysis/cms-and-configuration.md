# Admin Panel Architecture — Deep Inferential Analysis

## How Admins Probably Create Courses

### Course Creation Workflow
1. **Create Course Entity**
   - Set slug, title, description, logo
   - Configure difficulty rating
   - Set supported languages
   - Define stage groups/themes (Base, Navigation, Quoting, Redirection, etc.)

2. **Create Stage Definitions**
   - For each stage, define:
     - Stage ID (3-char alphanumeric, e.g., `OO8`, `CZ2`)
     - Title (e.g., "Print a prompt")
     - Position/order within the course
     - Difficulty label (VERY EASY, EASY, MEDIUM, HARD)
     - Group/theme assignment
     - Dependency (which stage must be completed first)

3. **Author Stage Instructions (Markdown)**
   - Write the "Your Task" description
   - Write examples with input/output
   - Define the "Tests" section explaining what will be validated
   - Create hints (ordered, progressive difficulty)
   - Link or create concept pages
   - Configure per-language instruction variations

4. **Define Test Configurations**
   - Create the tester binary/script for each stage
   - Define test scenarios as structured configs:
     ```yaml
     scenarios:
       - name: "basic_test"
         steps:
           - wait_for_prompt: "$ "
           - send: "{{random_invalid_command}}"
           - expect: "{{input}}: command not found"
           - assert_success: "Received command not found message"
     ```
   - Configure randomization templates
   - Set timeout values
   - Define multiple test scenarios for robustness

5. **Create Starter Templates**
   - For EACH (course × language) combination:
     - Create the starter code file (e.g., `app/main.py`)
     - Write `.codecrafters/compile.sh`
     - Write `.codecrafters/run.sh`
     - Configure `codecrafters.yml` with buildpack options
     - Set up project files (package.json, Cargo.toml, etc.)

### Content Management System (Inferred)

```
┌─────────────────────────────────────────┐
│           ADMIN DASHBOARD               │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────┐  ┌──────────┐  ┌────────┐ │
│  │ Courses │  │ Stages   │  │ Tests  │ │
│  │ Manager │  │ Editor   │  │ Config │ │
│  └─────────┘  └──────────┘  └────────┘ │
│                                         │
│  ┌─────────┐  ┌──────────┐  ┌────────┐ │
│  │Templates│  │ Users    │  │ Subs   │ │
│  │ Manager │  │ Manager  │  │ Manage │ │
│  └─────────┘  └──────────┘  └────────┘ │
│                                         │
│  ┌─────────┐  ┌──────────┐  ┌────────┐ │
│  │Analytics│  │ Promo    │  │ Deploy │ │
│  │ Dashboard│  │ Manager │  │ Tools  │ │
│  └─────────┘  └──────────┘  └────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

### Stage Instruction Editor
- Likely a **rich Markdown editor** with:
  - Live preview
  - Per-language tabs for language-specific instructions
  - Hint authoring section (ordered list)
  - Concept linking
  - File path highlights (e.g., `app/main.py`)
  - Code block rendering with language syntax highlighting

### Test Configuration Dashboard
- **Visual test builder** or **YAML/JSON editor** for defining test scenarios
- **Test runner**: "Run tests against reference solution" button to validate test correctness
- **Randomization config**: Define template variables (`{{random_fruit}}`, `{{random_int}}`)
- **Timeout settings**: Per-stage timeout configuration (default: 5s?)
- **Edge case manager**: Define edge cases and boundary conditions

### Template Repository Manager
- Per-language template editor
- **Buildpack selector**: Dropdown of available Docker images per language
- **Script editors** for `compile.sh` and `run.sh`
- **Starter code editor** with TODO comment placement
- **Preview**: "Generate preview repo" to test the starter template

## How Admins Probably Configure Tests

### Test Harness Architecture
Based on the observed `[tester::#XXX]` output format, the test system likely uses:

1. **Dedicated tester binary** per challenge (not per stage)
   - Written in Go or Rust for performance
   - Compiled and deployed separately from user code
   - Takes stage ID as parameter: `./tester --stage=#OO8`

2. **Test definition files** (probably YAML or TOML)
   ```yaml
   stage: "#OO8"
   name: "Print a prompt"
   difficulty: "VERY EASY"
   tests:
     - scenario: "basic_prompt"
       steps:
         - action: "run_program"
         - action: "wait_for_output"
           timeout_ms: 5000
           expected_pattern: "\\$ $"
           success_message: "Received prompt"
   ```

3. **Randomization engine**
   ```yaml
   variables:
     random_fruit:
       type: "random_choice"
       values: ["apple", "banana", "blueberry", "grape", "mango", "pineapple", "strawberry"]
     random_command:
       type: "template"
       pattern: "invalid_{{random_fruit}}_command"
   ```

4. **Stage dependency graph**
   ```yaml
   dependencies:
     CZ2: [OO8]        # Handle invalid commands requires Print a prompt
     FF0: [CZ2]        # REPL requires Handle invalid commands
     PN5: [FF0]        # Exit requires REPL
     IZ3: [PN5]        # Echo requires Exit
   ```

### Test Validation Pipeline (Admin-side)
Before publishing a new stage, admins probably:
1. Write the test configuration
2. Write a reference solution
3. Run the tester against the reference solution → must pass
4. Run the tester against intentionally broken solutions → must fail correctly
5. Review the error messages for clarity
6. Publish the stage

### Buildpack (Docker Image) Management
```
┌────────────────────────────────────────────┐
│ Buildpack Registry                         │
├────────────────────────────────────────────┤
│ python-3.13  → python:3.13-slim + uv      │
│ python-3.14  → python:3.14-slim + uv      │
│ rust-1.77    → rust:1.77-slim              │
│ go-1.22      → golang:1.22-alpine         │
│ nodejs-21    → node:21-slim               │
│ ...20+ language buildpacks                 │
└────────────────────────────────────────────┘
```

Each buildpack is a Docker image containing:
- The language runtime at a specific version
- Build tools (cargo, uv, npm, etc.)
- The tester binary for the current challenge
- Standard unix tools (bash, git, etc.)

## User & Subscription Management

### User Dashboard
Admins can probably:
- View user profiles and progress
- See submission history per user
- Manage subscription status
- Handle support tickets
- View analytics per user (stages completed, time spent, failure rate)

### Subscription Management
- Toggle free challenges for promotional periods ("Free this month")
- Configure the countdown timer duration
- Manage membership tiers (Free, Pro, Team)
- Configure turbo test access per tier
- Handle billing and invoicing

## Analytics Dashboard (Inferred)

### Stage-Level Analytics
- **Completion rate**: % of users who pass each stage
- **Failure rate**: % of submissions that fail
- **Average attempts**: How many submissions before passing
- **Average time**: How long users spend on each stage
- **Drop-off points**: Which stages cause users to quit

### Course-Level Analytics
- **Enrollment rate**: How many users start each course
- **Completion rate**: How many finish all stages
- **Language distribution**: Which languages are most popular
- **Revenue metrics**: Conversion from free to paid

### Real-Time Monitoring
- Active users per course
- Submissions per minute
- Queue depth (pending evaluations)
- Worker utilization
- Error rates

## Promotion System

### "Free This Month" Configuration
Admins likely have a panel to:
1. Select a course for free promotion
2. Set start and end dates
3. Configure the countdown timer
4. Set the promotional badge text ("FREE THIS MONTH")
5. Configure email campaigns for the promotion
6. Set the upsell message within the free course

### Urgency Timer
- Configurable countdown duration (24h, 48h, 7d)
- Tied to user's first visit or course enrollment date
- Displays in the header as a yellow pill with clock icon

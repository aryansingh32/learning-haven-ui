# Network & API Analysis

## Inferred API Endpoints

Based on frontend behavior, URL patterns, and observed data flows, the following API structure is inferred:

### Authentication & User
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/auth/github` | OAuth callback from GitHub login |
| GET | `/api/v1/users/me` | Get current user profile |
| GET | `/api/v1/users/:username` | Get user public profile |
| PATCH | `/api/v1/users/me` | Update user settings (email preferences, etc.) |

### Courses / Challenges
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/courses` | List all courses for catalog page |
| GET | `/api/v1/courses/:slug` | Get course details (shell, redis, git, etc.) |
| GET | `/api/v1/courses/:slug/stages` | Get all stages for a course |
| GET | `/api/v1/courses/:slug/stages/:stage_id` | Get specific stage instructions |
| GET | `/api/v1/courses/:slug/languages` | Get supported languages |

### Repositories (User's Challenge Attempts)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/repositories` | Create a new repo (when user starts a challenge) |
| GET | `/api/v1/repositories/:id` | Get repo details & progress |
| PATCH | `/api/v1/repositories/:id/stages/:stage_id/complete` | Mark a stage as complete |
| GET | `/api/v1/repositories/:id/submissions` | Get submission history |

### Submissions & Evaluation
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/submissions` | Triggered by git push webhook |
| GET | `/api/v1/submissions/:id` | Get submission status & logs |
| GET | `/api/v1/submissions/:id/logs` | Stream submission logs |

### Leaderboards
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/courses/:slug/leaderboard` | Global challenge leaderboard |
| GET | `/api/v1/courses/:slug/leaderboard/:language` | Language-specific leaderboard |
| GET | `/api/v1/users/:id/rank` | Get user's rank for a challenge |

### Code Examples
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/stages/:stage_id/code-examples` | Get community solutions |
| POST | `/api/v1/code-examples/:id/vote` | Vote helpful/not-helpful |

### Community / Forum
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/stages/:stage_id/forum` | Get discussion threads |
| POST | `/api/v1/stages/:stage_id/forum` | Create a new thread |

---

## URL Routing Patterns (Observed)

### Catalog
```
/catalog                                    — Main catalog page
```

### Course Overview
```
/courses/:slug/overview                     — Course overview/marketing page
```

### Course Workspace (Post-enrollment)
```
/courses/:slug/introduction                 — Introduction/onboarding
/courses/:slug/setup                        — Local setup instructions
/courses/:slug/stages/:stage_id             — Stage workspace
/courses/:slug/stages/:stage_id?repo=:uuid  — Stage with specific repo context
```

### Observed Stage ID Pattern
Route parameter uses the short alphanumeric stage ID (3 chars):
- `/courses/shell/stages/oo8` (Print a prompt)
- `/courses/shell/stages/cz2` (Handle invalid commands)
- `/courses/shell/stages/ff0` (Implement a REPL)
- `/courses/shell/stages/pn5` (Implement exit)
- `/courses/shell/stages/iz3` (Implement echo)

Note: IDs appear as LOWERCASE in URLs but UPPERCASE in test output (`#OO8`, `#CZ2`).

---

## WebSocket / Real-time Communication

### Channel Architecture (Inferred from console logs)
```
CourseLeaderboardChannel
  - Subscribes when: User views course overview or workspace
  - Payload: { user: "username", language: "python", stage: "#OO8", action: "completed" }
  
SubmissionChannel
  - Subscribes when: User pushes code via CLI
  - Payload: { repo_id: "uuid", stage_id: "#IZ3", status: "running"|"passed"|"failed" }
  - Log streaming: { log_line: "[tester::#IZ3] ✓ Received expected response" }
  
RepositoryChannel
  - Subscribes when: User views workspace
  - Payload: { repo_id: "uuid", event: "ping_received"|"tests_completed" }
```

### Connection Pattern
- Framework: Likely **ActionCable** (Rails WebSocket framework)
- Protocol: `wss://app.codecrafters.io/cable`
- Authentication: Via session cookie / JWT token in connection parameters
- Heartbeat: Standard ActionCable ping/pong (every 3 seconds)

---

## Storage Analysis

### LocalStorage (Inferred)
| Key | Value | Purpose |
|-----|-------|---------|
| `ember-simple-auth:session` | JWT/session data | Authentication persistence |
| `codecrafters:theme` | `dark`/`light`/`system` | Theme preference |
| `codecrafters:accepted-cookies` | `true` | Cookie consent |
| `codecrafters:onboarding-completed` | `true` | Skip onboarding on revisit |

### Cookies (Inferred)
| Name | Domain | Purpose |
|------|--------|---------|
| `_codecrafters_session` | `.codecrafters.io` | Session ID |
| `_csrf_token` | `.codecrafters.io` | CSRF protection |
| `cf_clearance` | `.codecrafters.io` | Cloudflare bot protection |

### Git Credentials
- Stored in git config as URL-embedded credentials: `https://username:PAT@git.codecrafters.io/slug`
- Also configurable via `~/.codecrafters/credentials` (CLI config)

---

## Dynamic Progress Badge API

### Endpoint
```
GET https://backend.codecrafters.io/progress/:challenge/:attempt_uuid
```

### Response
Returns a dynamically generated SVG/PNG image showing:
- Challenge name
- Progress percentage
- Stages completed / total stages
- Language icon

### Usage
Embedded in README.md for public GitHub repos:
```markdown
[![progress-banner](https://backend.codecrafters.io/progress/shell/d1fe6aab-...)]
```

This is a **public, unauthenticated endpoint** — anyone with the attempt UUID can see the progress.

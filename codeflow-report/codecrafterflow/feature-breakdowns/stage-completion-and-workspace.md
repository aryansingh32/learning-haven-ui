# Feature Breakdown: Stage Completion UX & Workspace Features

## Stage Completion Modal — Two-Step Flow

### Screenshot Evidence: Stage 3 (REPL) — "Tests passed!" Modal

The completion flow has **TWO distinct phases**:

#### Phase 1: "Tests passed!" 
- **Header**: Large green checkmark icon ✓
- **Title**: "Tests passed!"
- **Subtitle**: "You can now mark this stage as complete."
- **TWO action buttons**:
  1. **"Refactor code (optional)"** → `</>` icon + arrow → "Edit your code before moving to the next stage"
  2. **"Mark stage as complete"** → ✓ icon + arrow → "Submit code and proceed to the next stage"

**UX Insight**: The "Refactor" option is brilliant:
- It encourages **code quality** without enforcing it.
- It signals that the platform values clean code, not just passing tests.
- It's labeled "(optional)" to avoid friction — users who want to move fast can skip it.
- It creates a habit of reviewing code before submission, building better engineering practice.

#### Phase 2: "Stage complete!"
- **Header**: Trophy/shield icon
- **Title**: "Stage complete!"
- **Leaderboard rank display**: "Your leaderboard rank is **#15,454**" (with decorative dashes below)
- **CTA**: "View next stage →" (teal button, full-width)

**UX Insight**: 
- The rank display creates an **instant dopamine hit**.
- The rank number is shown in large, bold, teal text.
- The leaderboard on the right sidebar simultaneously updates to show the user's position highlighted in teal.
- Users surrounding the user (#15452, #15453, #15455) are shown — creating a sense of competition and proximity.

### Bottom Status Bar Insights
- **"Next stage already implemented!"** — Green dot indicator when the backend detects the code already satisfies the next stage's tests.
- **"Ready to run tests"** — Gray dot indicator when awaiting user submission.
- **"Show logs"** — Expandable log panel for viewing test output without leaving the page.

## Tab System: Four Content Tabs

Each stage page has exactly 4 tabs:
1. **📄 Instructions** — Main stage instructions, hints, and task description
2. **</> Code Examples** — Community-submitted solutions with language filter (Python dropdown)
3. **🧩 Concepts** — Interactive concept tutorials (e.g., "What are builtin commands?")
4. **💬 Forum** — Discussion thread for the stage

### Code Examples Tab — Anti-Spoiler Gate
When clicking "Code Examples" before completing a stage, a **warning modal** appears:
- **Title**: "Stage incomplete"
- **Text**: "You haven't completed this stage yet. Are you sure you want to view code examples?"
- **Buttons**: 
  - "← No, back to instructions" (teal, primary)
  - "Yes, show me the code □" (outline, secondary)
  
**UX Insight**: This friction gate:
- Discourages premature code copying
- Forces a conscious decision to "spoil" the answer
- Uses language like "Are you sure?" which creates psychological hesitation
- The primary button leads BACK to instructions — the design wants users to try first

### Code Examples — Community Voting
- Each code example has **"👍 Helpful" / "👎 Not helpful"** voting buttons.
- A **language filter dropdown** (e.g., "Python ▼") allows users to see solutions in their language.
- Examples are presumably ranked by helpfulness votes.

## Sidebar: Left Navigation

### Stage List
```
✓ Local Setup
✓ Print a prompt
✓ Handle invalid commands  
✓ Implement a REPL
… Implement exit           ← In-progress (animated dots)
# Implement echo           ← Locked
# Implement type           ← Locked
# Locate executable files  ← Locked
# Run a program            ← Locked
```

### Section Groups (Toggle-able)
- **NAVIGATION** (toggle ON/OFF ⬤)
  - # The pwd builtin
  - # The cd builtin: Absolute p...
  - # The cd builtin: Relative p...
- **More sections below** (collapsed by scroll)

**UX Insight**: Sections can be **toggled on/off**. This is likely a feature for:
- Users who want to focus only on the base stages
- Extension/bonus stages that are optional
- Admin-configurable stage grouping

### Stage ID Mapping (Confirmed)
| Stage Name | ID | Status |
|---|---|---|
| Print a prompt | #OO8 | ✓ Completed |
| Handle invalid commands | #CZ2 | ✓ Completed |
| Implement a REPL | #FF0 | ✓ Completed |
| Implement exit | #PN5 | In-progress |

## Right Sidebar: Dynamic Leaderboard

### Leaderboard Structure
```
PYTHON LEADERBOARD ↗
michael-xiayi-li    #1
yanruijie902136     #2
doubledare704       #3
eaverdeja           #4
Caceresenzo         #5
---other users---
pranav-gaur         #12933
orkiporkii          #12934
lappybackup         #12935  ← HIGHLIGHTED (teal bg)
ngggDuy             #12936
extrad              #15455
```

**UX Insight**: 
- The leaderboard shows the **top 5** (aspirational targets) AND the users **directly surrounding the current user** (competitive proximity).
- The current user is highlighted with a teal background, making them easy to find.
- The "other users" separator creates a clear visual break between the elite and the user's neighborhood.
- The ↗ link opens a full leaderboard page.

## Top Header Bar Elements
- **Challenge selector**: "Build your own Shell" + "using Python" subtitle + dropdown chevron
- **Dark mode toggle**: Three icons (monitor, sun, moon) for system/light/dark theme switching
- **Urgency counter**: "⏰ 21 hours left" in a yellow/amber pill — countdown to free access expiry
- **Close button**: × to exit the challenge workspace

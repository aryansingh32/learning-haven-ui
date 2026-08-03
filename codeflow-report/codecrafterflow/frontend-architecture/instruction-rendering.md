# Instruction Rendering & Workspace Layout

## Local-First Philosophy
* **No In-Browser Editor**: Unlike LeetCode or Codecademy, CodeCrafters enforces a 100% local IDE workflow. There is no web-based Monaco editor. The browser acts purely as a dashboard, instruction manual, and real-time validation HUD.

## Multi-Pane Responsive Layout
* **Left Sidebar (Syllabus)**: A visual checklist of stages (Introduction, Local Setup, Stage 1, Stage 2, etc.). It tracks progress visually and unlocks linearly.
* **Center Pane (Instructions & Hints)**:
  * Renders markdown/code snippets beautifully.
  * **Tabbed Environments**: Allows toggling instructions between OS/shells (Linux/macOS vs. PowerShell).
  * **Multimedia**: Embeds dynamic video walkthroughs.
  * **Inline Hints**: Highly contextual hints that point to exact file paths (e.g., `app/main.py`) and specific line ranges to modify (e.g., "uncomment lines 12-15").
* **Right Sidebar (Social Proof & Leaderboard)**: Displays a language-specific leaderboard showing real-time rankings of peers learning the exact same stack (e.g., "Python Leaderboard"). This creates a sense of multiplayer learning.

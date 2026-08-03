# Onboarding & Questionnaire Flow

## Immediate Routing & Zero Friction
* Clicking "Start Building" triggers an **instantaneous client-side route transition** (from `/courses/shell/overview` to `/courses/shell/introduction`). There is no full page reload, maintaining immersion.

## The Questionnaire 
The platform asks a sequence of non-intrusive questions to tailor the experience:
1. **Language Selection**: Users select from over 20 languages (e.g., Python, Rust, Go). *Action*: Selecting a language likely triggers a background job to provision a custom Git repository tailored to that language's starter template.
2. **Language Proficiency**: "Beginner", "Intermediate", "Advanced". *Psychology*: Sets a baseline for the user's confidence and allows the platform to potentially tailor hints or metrics later.
3. **Practice Cadence**: "Every day", "A few times a week", etc. *Psychology*: Secures a micro-commitment from the user regarding their learning habit.
4. **Accountability**: "Yes, send emails" vs "I'll pass". *Product Logic*: Opt-in engagement loop for retention via email nudges.

## Linear Lock System
* The system enforces **strict progression**. Attempting to click ahead to Stage 1 ("Print a prompt") without completing the Local Setup triggers a blocking modal: "Previous steps incomplete!". This ensures the developer's local environment is properly configured before they get bogged down in code logic, reducing early churn caused by environmental setup errors.

# UI Analysis: Catalog and Shell Overview Page

## Vibe & Color Psychology
* **Dark-Mode First**: The primary background uses a deep charcoal/black (`#0B0F19` or similar dark-blue grey). High-contrast white and light-grey text ensures excellent readability.
* **Accent Colors**:
  * **Teal/Green (`#10B981` / `#34D399`)**: Associated with free access, completion, and growth. Used for badges like "FREE THIS MONTH".
  * **Yellow/Amber (`#F59E0B`)**: Associated with urgency, attention, and subscriptions. Used for the checkout countdown timer.
  * **Blue (`#3B82F6`)**: Associated with information and onboarding guidance.

## Layout & Spacing System
* **Header**: ~60px height containing the logo, key navigation items (Catalog, Leaderboards), a feedback trigger, a persistent conversion countdown pill, and the user's avatar.
* **Grid Systems**: 
  * A balanced **2-column grid** is used for main course challenges.
  * A **3-column grid** is used at the bottom for modular "Language Tracks". 
  * Spacing is managed cleanly with standard Tailwind-like classes (`p-5`, `px-2 py-1`, etc.).

## Hover & Interactions
* **Opacity Hierarchy**: Cards for locked premium courses are presented with a low base opacity (`opacity-50 dark:opacity-30`) to establish hierarchy.
* **Hover Reveal**: Hovering over a premium course restores full opacity smoothly (`hover:opacity-100`). This lets users "preview" detail without feeling blocked, giving them a tactile sense of interaction.

## Shell Course Overview Page
* **Inclusivity of Language Choice**: Displays a list of 15+ programming language icons (Go, Rust, Python, C, C++, Kotlin, Zig, etc.) beautifully aligned.
* **Social Proof Sidebar**: The right-hand sidebar lists active attempts by developers with their usernames, chosen languages, and visual progress bars.

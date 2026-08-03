# Frontend Architecture Inferences

## Framework
* **Ember.js**: The frontend application is built using Ember.js. This is evident from DOM inspection showing classes like `ember-view`, `ember-basic-dropdown-trigger`, unique element ID hashes typical of Ember, and Ember fastboot rehydration errors in the console.

## State Management & Real-time
* **Live WebSockets**: Console log analysis reveals active subscriptions to `CourseLeaderboardChannel` via WebSockets (likely ActionCable if Rails backend). This powers the real-time sidebar on the course overview page.

## Styling
* **Tailwind CSS**: The application makes heavy use of utility classes that match Tailwind's API (`p-5`, `px-2`, `py-1`, `hover:opacity-100`, `opacity-50`, `dark:opacity-30`), indicating a utility-first CSS approach, likely Tailwind CSS.

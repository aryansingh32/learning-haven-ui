# Realtime Feedback System

## Active Polling / WebSockets
* **"Listening for ping..." Status**: At the bottom of the Local Setup page, the UI renders a dynamic status bar waiting for the user to execute `codecrafters ping` locally.
* **Architecture**: The Ember frontend establishes a continuous connection—either via ActionCable WebSockets or rapid long-polling—subscribing to a specific channel linked to the user's repository/session UUID.
* **Event Loop**:
  1. User runs a local CLI command (`codecrafters ping`) or pushes via Git.
  2. The CodeCrafters backend receives the ping/push.
  3. The backend immediately broadcasts a success event over the WebSocket channel.
  4. The frontend receives the event and updates the DOM in real-time, transitioning the state from "Listening..." to "Success!".
* **UX Impact**: This instant, real-time feedback loop between a local terminal and the web browser creates a magical, highly responsive developer experience.

## State Transitions & Celebration
* Upon receiving the completion event for a stage, the frontend triggers a celebration modal/animation and automatically redirects the user to the instructions for the next stage.

# Git-Based Submission Flow & Workspace Architecture

## Dynamic Repository Generation
* Upon selecting a language during onboarding, the backend instantly provisions a custom, language-specific Git repository hosted on their internal Git server: `git.codecrafters.io`.
* **Example Remote URL**: `https://git.codecrafters.io/23e6d7439485685e` (UUID-based repo slug).
* The user is instructed to `git clone` this repository locally. It contains a starter template pre-configured for that specific language.

## Custom CLI Tooling
* Instead of relying purely on standard Git commands, CodeCrafters provides a proprietary CLI tool.
* **Installation**: `curl -fsSL https://codecrafters.io/install.sh | bash`
* **Purpose**: The `codecrafters` CLI abstracts away complex Git hook setups and provides commands like `codecrafters ping` (for local setup validation) and `codecrafters test` (for running tests against their remote executors before formally submitting a stage).

## Webhook Architecture (Inferred)
* Pushing code to `git.codecrafters.io` likely triggers an internal webhook.
* This webhook enqueues a background job (e.g., via Redis/Sidekiq or Kafka) that pulls the latest commit into an isolated container (Docker/Kubernetes pod).
* The container runs a test suite against the user's code to validate the output against the expected challenge criteria.

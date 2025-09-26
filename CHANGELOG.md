# Changelog

All notable changes to this project will be documented in this file.

## 0.0.1 - Initial Upload
- Reintroduced the full modular server architecture (auth, YouTube client, transcript manager, metadata service, scheduler, playlist manager, backup service, batch manager, utilities) according to the implementation plan.
- Added an OAuth service with PKCE flow, state storage, optional AES-256 encrypted token persistence (`OAUTH_ENCRYPTION_SECRET`), and automatic token refresh.
- Wrapped YouTube Data API access in a dedicated client featuring quota tracking, rate limiting, playlist helpers, and integration with the backup workflow.
- Restored MCP tool handlers for authentication, video listing, transcript retrieval, metadata suggestion/appli­cation, scheduling, playlist operations, backups, and batch status reporting.
- Updated README and architecture notes with explicit status of implemented vs. pending roadmap features.
- Updated documentation (README, docs/usage.md) to describe environment variables, encryption, and available tools.
- Added metadata review guardrails: persisted suggestions with checklist, enforced `acknowledgedGuardrails` confirmation, and storage under `storage/metadata-suggestions/`.
- Introduced batch orchestrator with queueing, failure handling, and `resources/subscribe`-gestützte Fortschritts-Streams for scheduling/playlist jobs.
- Added `organize_playlists` tool for automated categorisation + playlist creation via batch orchestrator.
- Hinweis: Release 0.0.1 ist rein manuell überprüft; automatisierte Tests und produktive Validierung stehen aus.

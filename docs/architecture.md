# Architecture Overview

The current implementation keeps the runtime deliberately small. The entry point `src/index.ts` wires together three main concerns:

1. **Authentication** – Uses `google-auth-library` to create an `OAuth2Client`, persists tokens under `tokens/`, refreshes when necessary.
2. **YouTube API access** – Leverages the official `googleapis` client to call search, videos, captions, and playlists endpoints.
3. **MCP tooling** – Registers a set of JSON-RPC tools for Claude Desktop, returning JSON payloads that the assistant can inspect and act upon.

Support modules are kept inline inside `src/index.ts`:

- Transcript download relies on `youtube.captions.list` + `youtube.captions.download`.
- Metadata suggestions are currently heuristic; they derive keywords from existing descriptions and transcripts.
- Vorschläge werden in einem lokalen Review-Store (`storage/metadata-suggestions/`) abgelegt, inklusive Guardrails & Prüfliste.
- Das Batch-Orchestrator-Modul (`src/batch/batch-orchestrator.ts`) verwaltet eine sequentielle Queue, aktualisiert `batchManager` und triggert `resources/updated` für `batch://status/<id>`.
- Resource-Subscriptions werden pro URI/Sitzung verfolgt (`resourceSubscriptions` in `src/index.ts`), damit `notifications/resources/updated` nur bei vorheriger Anmeldung gesendet werden.
- Playlist-Organisation (`organize_playlists`) generiert Batch-Pläne, die Playlists per Kategorie oder manuellen Gruppen erstellen/füllen.
- Scheduling produces ISO timestamps with a simple round-robin algorithm and (optionally) executes YouTube updates.
- Backups write raw snippet/status/contentDetails blobs into `backups/YYYY-MM-DD/videoId.json` for manual diffing.

This layout keeps deployment straightforward: one compiled file in `dist/index.js`, with runtime state stored outside of version control.

> Pending roadmap items (see `.kiro/specs/youtube-mcp-extended/tasks.md`): KI-gestützte Metadatenoptimierung, Thumbnail-Konzeptgenerator, erweiterte Batch-Orchestrierung/Streaming sowie formale MCP-Prompts.

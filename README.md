# YouTube MCP Extended

A lightweight Model Context Protocol (MCP) server that lets Claude Desktop manage a YouTube channel on your behalf. The server runs locally, authenticates against Google via OAuth, and exposes an opinionated toolbox for batch updates: transcripts, heuristic metadata improvements, scheduling, playlist management, and JSON backups.

## Features

- **OAuth 2.0 authorisation flow** – initiate from Claude, finish in the browser, tokens stored under `tokens/` (excluded from git).
- **Video discovery** – list your latest uploads, inspect raw metadata, pipe results back into Claude for analysis.
- **Transcript retrieval** – download caption tracks for downstream prompt engineering.
- **Metadata helpers** – generate and optionally apply quick suggestions derived from existing descriptions/transcripts.
- **Review guardrails** – persist suggestions with checklisten & verpflichtende Guardrail-Bestätigung vor jeder Anwendung.
- **Scheduling pipeline** – preview or apply batched publish times; keep publication state private until the slot arrives.
- **Playlists** – create/organize playlists in Bulk, inkl. automatischer Kategorisierung & Batch-Queue.
- **Metadata backups** – snapshot original metadata to `backups/YYYY-MM-DD/videoId.json` and restore when needed.
- **Batch orchestrierung** – zentrale Queue mit Fortschritts-Streaming über `batch://status/<id>` für Scheduling & Playlist-Updates.

## Project Status

- **Implemented**: OAuth with PKCE + encrypted storage, YouTube client with quota/rate limiting, transcript retrieval, heuristic metadata suggestions, scheduling with batch IDs, playlist helpers (inkl. Batch-Orchestrierung), backup/restore MCP tools.
- **In Progress**: KI-unterstützte Metadaten-Generierung (LLM-Einbindung), reichere Batch-Orchestrierung (Streaming, Queueing), Playlist-Integration innerhalb von Batches, Thumbnail-Konzeptgenerator.
- **Planned**: Reliability instrumentation (structured logging, quota dashboards), deployment profiles + environment validation scripts, automated unit/integration tests, extended end-user and developer documentation.

## Release 0.0.1 – Initial Upload

- Fokus: Bereitstellung eines vollständigen, aber noch nicht produktiv getesteten MCP-Servers für YouTube-Automationen.
- Enthält: OAuth-Fluss, Video-/Playlist-Tools, Batch-Orchestrierung mit Fortschritts-Streaming, Guardrail-basierte Metadatenprüfungen, Backup/Restore.
- Hinweis: Bislang ausschließlich manuell überprüft – keine automatisierten Tests oder Live-Verifikation auf produktiven Kanälen durchgeführt.

## Prerequisites

- Node.js 20+
- A Google Cloud project with the **YouTube Data API v3** enabled
- OAuth client credentials (Web application type)

## Installation

```bash
npm install
npm run build:basic
```

## Configuration

Set the following environment variables before launching the MCP server (e.g. via Claude Desktop configuration or a `.env` file that you source manually):

- `YOUTUBE_CLIENT_ID` – OAuth client ID
- `YOUTUBE_CLIENT_SECRET` – OAuth client secret
- `YOUTUBE_REDIRECT_URI` *(optional)* – defaults to `http://localhost:3000/callback`
- `OAUTH_ENCRYPTION_SECRET` *(optional)* – if set, tokens are stored AES-256-GCM encrypted under `tokens/`

The server writes persisted credentials to `tokens/oauth_tokens.json`; backups go into `backups/`. Both paths are ignored by git.

## Running the server

Claude Desktop expects an MCP server executable. You can wire it up with:

```json
{
  "mcpServers": {
    "youtube-extended": {
      "command": "node",
      "args": ["./dist/index.js"],
      "cwd": "/absolute/path/to/youtube_MetaData_MCP"
    }
  }
}
```

Generate the build artefact beforehand (`npm run build:basic`). During development you can also use `tsx src/index.ts` for hot reload behaviour.

## OAuth workflow

1. Ask Claude to call the `start_oauth_flow` tool – it returns an auth URL and instructions.
2. Open the URL in a browser, grant access, and copy the `code` + `state` query params from the redirect.
3. Provide those values to the `complete_oauth_flow` tool. Stored tokens include a refresh token so you normally authenticate once per machine.

## Metadata review workflow

1. `generate_metadata_suggestions` erzeugt einen Vorschlag, speichert ihn unter `storage/metadata-suggestions/<id>.json` und liefert `suggestionId`, Guardrails sowie eine Review-Checkliste zurück.
2. Arbeite die Checkliste mit Claude durch, passe Vorschläge bei Bedarf manuell an und bestätige, dass die Guardrails eingehalten werden.
3. Rufe `apply_metadata` auf und übergib `{"videoId": "…", "suggestionId": "…", "acknowledgedGuardrails": true}` (optional mit manuellen Overrides wie `title`). Ohne Bestätigung bricht das Tool mit `GUARDRAILS_NOT_ACKNOWLEDGED` ab.
4. Nach erfolgreichem Apply markiert der Server den Vorschlag als `applied` und gibt die übernommenen Felder zurück. Optional kannst du per `createBackup: false` das automatische Backup abschalten.

## Batch-Orchestrierung & Fortschritt

- `schedule_videos` mit `mode: "apply"` und `add_videos_to_playlist` starten Batch-Jobs im Hintergrund; die Antwort enthält `batchId`.
- Bitte Claude, `resources/subscribe` auf `batch://status/<batchId>` aufzurufen. Der Server liefert bei Fortschritt `notifications/resources/updated`.
- Nutze `get_batch_status` oder `readResource` (`batch://status/<batchId>`), um den aktuellen Stand (inkl. Operationsliste, Erfolge/Fehler) abzurufen.
- Mehrere Jobs werden in einer Queue seriell abgearbeitet; Fehler einzelner Schritte stoppen den Batch nicht, werden aber protokolliert.

## Available tools

| Tool | Description |
| --- | --- |
| `start_oauth_flow` | Generates the Google OAuth URL with offline access. |
| `complete_oauth_flow` | Exchanges the browser-provided code for tokens. |
| `list_videos` | Returns recent uploads with snippet/status details. |
| `get_video_transcript` | Downloads caption text for a given video. |
| `generate_metadata_suggestions` | Produces heuristic title/description/tag suggestions. |
| `apply_metadata` | Applies manual or gespeicherte Vorschläge (inkl. Guardrail-Bestätigung, optional Backup). |
| `schedule_videos` | Builds a publish schedule (preview by default, apply with `"apply": true`). |
| `create_playlist` | Creates a playlist with title/description/privacy settings. |
| `add_videos_to_playlist` | Startet einen Batch, der Videos nacheinander an gewünschte Playlist-Positionen einfügt. |
| `organize_playlists` | Gruppiert Videos (manuell oder per YouTube-Kategorie), legt Playlists an und füllt sie via Batch. |
| `backup_video_metadata` | Writes JSON snapshots under `backups/YYYY-MM-DD/`. |
| `restore_video_metadata` | Restores metadata from a specific backup. |
| `get_batch_status` | Polls status for an in-flight scheduling batch. |

## Development quick start

```bash
npm install
npm run build:basic
```

Linting requires the TypeScript ESLint presets. If you want the extra checks, install the peer dependencies and run `npm run lint` once those configs are available locally.

## Testing and verification

The project currently ships without automated tests (the previous testing harness relied on tooling that has been removed). Manually verify:

1. `npm run build:basic`
2. `tsx src/index.ts` and exercise the OAuth flow
3. Call each MCP tool through Claude to validate credentials, scheduling, Playlist-Orchestrierung (`add_videos_to_playlist` / `organize_playlists`), und den neuen Guardrail-Workflow (`generate_metadata_suggestions` → Prüfliste abarbeiten → `apply_metadata` mit `acknowledgedGuardrails=true`)

> **Status:** Stand Version 0.0.1 existiert keine automatisierte oder produktive Verifizierung – bitte sämtliche Workflows manuell prüfen, bevor reale Kanäle bearbeitet werden.

## Repository hygiene

- `node_modules`, build artefacts, tokens, backups, and logs are ignored via `.gitignore`.
- Runtime directories (`backups/`, `tokens/`) are created on demand.
- Keep secrets out of version control; use environment variables or a local `.env` that never gets committed.

## License

MIT

# Usage Notes

## Starting the server

```bash
npm run build:basic
node dist/index.js
```

Claude Desktop will handle the process when configured under `claude_desktop_config.json`.

## Token storage

- Tokens live at `tokens/oauth_tokens.json` (generated after completing the OAuth flow).
- Delete the file if you need to re-run consent from scratch.
- Set `OAUTH_ENCRYPTION_SECRET` to have the token file stored encrypted (AES-256-GCM).

## Metadata workflow

- `generate_metadata_suggestions` persistiert jeden Vorschlag mit einer `suggestionId` in `storage/metadata-suggestions/`.
- Das Tool liefert Guardrails und eine Prüfliste zurück; bestätige diese, bevor du Änderungen übernimmst.
- Rufe `apply_metadata` mit `suggestionId` und `acknowledgedGuardrails=true` auf. Optional kannst du Felder wie `title` überschreiben oder `createBackup=false` setzen.
- Fehlende Bestätigung führt zu `GUARDRAILS_NOT_ACKNOWLEDGED` – arbeite dann die Checkliste ab und starte neu.

## Batch workflow

- `schedule_videos` (mit `mode: "apply"`) und `add_videos_to_playlist` erzeugen Batch-Jobs im Hintergrund und liefern eine `batchId`.
- `organize_playlists` kombiniert automatische Playlist-Erstellung (z. B. nach Kategorie) und Videozuordnung in einem Batch.
- Bitte Claude, `resources/subscribe` für `batch://status/<batchId>` aufzurufen, um Live-Updates (`notifications/resources/updated`) zu erhalten.
- Abruf des aktuellen Status per `get_batch_status` oder `readResource` (`batch://status/<batchId>`); die Antwort enthält Fortschritt, Operationen und Fehler.
- Jobs laufen sequenziell; Fehlschläge einzelner Items werden protokolliert, ohne nachfolgende Schritte zu blockieren.

## Backups

- Backups are created manually via the `backup_video_metadata` tool or automatically before metadata updates.
- Files are organised per day: `backups/YYYY-MM-DD/<videoId>.json`.
- Restoring expects a date folder and replays snippet/status content to YouTube.
- Auch bei manuellen Overrides empfiehlt sich ein schnelles Backup (`createBackup` belässt den Standardwert `true`).

## Scheduling

- Provide `videoIds`, optional `startDate`, `timeSlots` (HH:MM), and `timezone`.
- Use `"apply": true` to push updates; otherwise the tool returns a preview schedule.
- Bei `mode: "apply"` werden Uploads als Batch eingeplant; kombiniere `resources/subscribe` + `get_batch_status` für Monitoring.

## Playlist organisation

- `organize_playlists` akzeptiert zwei Modi: `"category"` (Standard, gruppiert nach YouTube `categoryId`) oder `"manual"` mit frei definierten Gruppen.
- Hinterlege optional `categoryMap` (Kategorie-ID → Playlist-Metadaten) oder explizite `groups` mit `playlistTitle`/`playlistId`.
- Mit `createMissingPlaylists` (Standard: `true`) legt der Server fehlende Playlists automatisch an; andernfalls schlägt der Batch fehl, wenn sie fehlen.
- Ergebnis enthält `unassigned`-IDs für Videos, die keiner Playlist zugewiesen wurden.

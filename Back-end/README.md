# Soundcheck backend

## Setup

1. Copy `.env.example` to `.env`.
2. Add `OPENROUTER_API_KEY` to generate literal translations.
3. Optionally set `OPENROUTER_MODEL`.
4. Run `npm run dev` from this folder.

The API listens on `http://localhost:4000` by default.

## Endpoints

- `GET /api/health` checks that the service is running.
- `GET /api/round/random` searches YouTube Music with Tamil-focused queries, randomly selects a song while avoiding immediate repeats, fetches its lyrics in memory through `ytmusic-api`, and returns metadata plus translated lines.
- `POST /api/playlists` is reserved for playlist upload and currently returns `501`.

Raw lyrics are never written to disk or returned to the client. They are passed directly from YouTube Music to the optional translation step and then discarded.
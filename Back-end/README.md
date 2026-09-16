# Soundcheck backend

## Setup

1. Copy `.env.example` to `.env`.
2. Add `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` to enable public playlist import.
3. Add `SPOTIFY_REDIRECT_URI=http://127.0.0.1:4000/api/auth/spotify/callback` and register that exact URL in the Spotify Developer Dashboard.
4. Add `OPENROUTER_API_KEY` to generate literal translations.
5. Optionally set `OPENROUTER_MODEL`.
4. Run `npm run dev` from this folder.

The API listens on `http://localhost:4000` by default.

## Endpoints

- `GET /api/health` checks that the service is running.
- `GET /api/round/random` searches YouTube Music with Tamil-focused queries, randomly selects a song while avoiding immediate repeats, fetches its lyrics in memory through `ytmusic-api`, and returns metadata plus translated lines.
- `POST /api/playlists/import` accepts a Spotify playlist URL and returns its public tracks.
- `POST /api/round/playlist-random` accepts the imported tracks and starts a round from one random track.
- `GET /api/auth/spotify/login` starts Spotify user sign-in.
- `GET /api/auth/spotify/status` returns the signed-in profile and avatar.

Raw lyrics are never written to disk or returned to the client. They are passed directly from YouTube Music to the optional translation step and then discarded.
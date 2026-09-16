# Soundcheck

Soundcheck is a single-player guessing game for Tamil songs. The player sees a deliberately awkward English interpretation of a song and reveals the translation progressively while trying to identify the original track.

## Project Structure

```text
Sound-Check/
├── Back-end/       Express API, Spotify OAuth, YouTube Music, OpenRouter
├── Front-end/      React + Vite game interface
└── spotify-trial.js  Standalone Spotify API/OAuth test server
```

## Requirements

- Node.js 20+
- Spotify Developer application credentials
- OpenRouter API key for live translations

The current lyrics provider is `ytmusic-api`. Raw lyrics are held in memory for the translation request and are not persisted or returned to the browser.

## Environment

Create a `.env` file at the repository root or in `Back-end/`:

```env
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:4000/api/auth/spotify/callback
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=openai/gpt-4o-mini
VITE_API_URL=http://localhost:4000
```

Register this exact redirect URI in the Spotify Developer Dashboard:

```text
http://127.0.0.1:4000/api/auth/spotify/callback
```

Never commit `.env` files or expose API keys in client-side code.

## Run The App

Install backend dependencies:

```powershell
cd Back-end
npm install
```

Install frontend dependencies:

```powershell
cd ..\Front-end
npm install
```

Start the backend:

```powershell
npm run dev
```

In a second terminal, start the frontend:

```powershell
cd Front-end
npm run dev
```

Open `http://localhost:5173`.

## Features

- Random Tamil-song rounds from YouTube Music
- Spotify sign-in with user OAuth
- Public Spotify playlist import
- Playlist track listing and random playlist selection
- Progressive translation reveals
- Score reduction as more lines are revealed
- YouTube Music-backed guess checking
- OpenRouter-generated vague, awkward translations

## API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Check backend availability |
| GET | `/api/round/random` | Start a random Tamil-song round |
| POST | `/api/playlists/import` | Import a Spotify playlist's tracks |
| POST | `/api/round/playlist-random` | Start a round from an imported playlist |
| POST | `/api/round/guess` | Check a song guess and calculate score |
| GET | `/api/auth/spotify/login` | Start Spotify sign-in |
| GET | `/api/auth/spotify/callback` | Complete Spotify sign-in |
| GET | `/api/auth/spotify/status` | Get current Spotify profile status |
| POST | `/api/auth/spotify/logout` | Clear the in-memory Spotify session |

## Spotify Trial Server

For isolated Spotify testing:

```powershell
node spotify-trial.js
```

It runs on `http://localhost:4011` and provides `/health`, `/search`, `/login`, `/callback`, and `/playlist` routes. Its OAuth redirect is:

```text
http://127.0.0.1:4011/callback
```

Only use the trial redirect while testing the trial server. Use the port `4000` redirect for the main application.

## Validation

Frontend:

```powershell
cd Front-end
npm run lint
npm run build
```

Backend:

```powershell
node --check Back-end/src/server.js
```
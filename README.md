# Soundcheck

Soundcheck is a single-player Tamil song guessing game. The player sees an awkward English interpretation of a song, reveals it a piece at a time, and tries to identify the original.

## How It Works

- Choose a random Tamil song or use a personal playlist.
- The backend finds the song and retrieves a lyric snippet.
- An AI model creates a vague, literal translation.
- The frontend reveals translated chunks progressively.
- The player guesses the song and receives a score based on how many chunks were revealed.

Raw lyrics are used in memory only and are not saved or sent to the frontend.

## Project Structure

```text
Sound-Check/
├── Back-end/   Express API and game services
└── Front-end/  React + Vite interface
```

## Requirements

- Node.js 20+
- API credentials configured in `.env`

Keep `.env` files private and never commit API keys.

## Run Locally

Install dependencies in both project folders:

```powershell
cd Back-end
npm install

cd ..\Front-end
npm install
```

Start the backend in one terminal:

```powershell
cd Back-end
npm run dev
```

Start the frontend in another terminal:

```powershell
cd Front-end
npm run dev
```

Open `http://localhost:5173` in your browser.

## Validation

```powershell
cd Front-end
npm run lint
npm run build

node ..\Back-end\src\server.js
```
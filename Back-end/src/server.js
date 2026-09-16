import dotenv from 'dotenv'
import cors from 'cors'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import YTMusic from 'ytmusic-api'

const backendDirectory = path.dirname(fileURLToPath(import.meta.url))
dotenv.config()
dotenv.config({ path: path.resolve(backendDirectory, '../../.env'), override: false })

const app = express()
const port = Number(process.env.PORT || 4000)
const spotifyApiBase = 'https://api.spotify.com/v1'
const spotifyRedirectUri = process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:4000/api/auth/spotify/callback'
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
const ytmusic = new YTMusic()
const ytmusicReady = ytmusic.initialize()
let spotifyToken = null
let spotifyUserToken = null
let spotifyOauthState = null
const tamilSearchQueries = [
  'Tamil hit songs',
  'Tamil melody songs',
  'Tamil love songs',
  'Tamil film songs',
  'Tamil kuthu songs',
  'Tamil songs A R Rahman',
  'Tamil songs Ilaiyaraaja',
]
const recentlySelectedVideoIds = new Set()

app.use(cors({ origin: frontendOrigin }))
app.use(express.json())

function requiredEnv(name) {
  if (!process.env[name]) throw new Error(`${name} is not configured.`)
  return process.env[name]
}

async function getSpotifyToken() {
  if (spotifyToken && spotifyToken.expiresAt > Date.now()) return spotifyToken.value

  const credentials = Buffer.from(`${requiredEnv('SPOTIFY_CLIENT_ID')}:${requiredEnv('SPOTIFY_CLIENT_SECRET')}`).toString('base64')
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  if (!response.ok) throw new Error(`Spotify authentication failed with ${response.status}.`)
  const data = await response.json()
  spotifyToken = { value: data.access_token, expiresAt: Date.now() + ((data.expires_in - 60) * 1000) }
  return spotifyToken.value
}

async function getSpotifyUserToken() {
  if (spotifyUserToken?.accessToken && spotifyUserToken.expiresAt > Date.now()) return spotifyUserToken.accessToken
  if (!spotifyUserToken?.refreshToken) return null

  const credentials = Buffer.from(`${requiredEnv('SPOTIFY_CLIENT_ID')}:${requiredEnv('SPOTIFY_CLIENT_SECRET')}`).toString('base64')
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: spotifyUserToken.refreshToken }),
  })
  if (!response.ok) {
    spotifyUserToken = null
    return null
  }
  const data = await response.json()
  spotifyUserToken = { ...spotifyUserToken, accessToken: data.access_token, expiresAt: Date.now() + ((data.expires_in - 60) * 1000) }
  return spotifyUserToken.accessToken
}

function spotifyLoginUrl() {
  spotifyOauthState = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: requiredEnv('SPOTIFY_CLIENT_ID'),
    scope: 'playlist-read-private playlist-read-collaborative user-read-private',
    redirect_uri: spotifyRedirectUri,
    state: spotifyOauthState,
  })
  return `https://accounts.spotify.com/authorize?${params}`
}

async function exchangeSpotifyCode(code) {
  const credentials = Buffer.from(`${requiredEnv('SPOTIFY_CLIENT_ID')}:${requiredEnv('SPOTIFY_CLIENT_SECRET')}`).toString('base64')
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, redirect_uri: spotifyRedirectUri, grant_type: 'authorization_code' }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error_description || `Spotify authorization failed with ${response.status}.`)
  spotifyUserToken = { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: Date.now() + ((data.expires_in - 60) * 1000) }
}

async function getSpotifyProfile() {
  const token = await getSpotifyUserToken()
  if (!token) return null
  const response = await fetch(`${spotifyApiBase}/me`, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) return null
  return response.json()
}

function getPlaylistId(value) {
  try {
    const url = new URL(value)
    return url.pathname.match(/\/playlist\/([a-zA-Z0-9]+)$/)?.[1] || null
  } catch {
    return null
  }
}

async function getSpotifyPlaylistTracks(playlistId) {
  const token = await getSpotifyUserToken()
  if (!token) throw new Error('Spotify sign-in is required before importing a playlist.')
  const tracks = []
  let url = `${spotifyApiBase}/playlists/${playlistId}/items?limit=50&market=IN`

  while (url && tracks.length < 500) {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!response.ok) throw new Error(`Spotify playlist request failed with ${response.status}.`)
    const data = await response.json()
    for (const item of data.items || []) {
      const track = item.item || item.track
      if (!track?.id || track.type !== 'track') continue
      tracks.push({
        id: track.id,
        title: track.name,
        artist: track.artists?.map((artist) => artist.name).join(', ') || 'Unknown artist',
        album: track.album?.name || null,
        album_art_url: track.album?.images?.[0]?.url || null,
        isrc: track.external_ids?.isrc || null,
      })
    }
    url = data.next
  }

  return tracks
}

function toTrack(song) {
  const bestThumbnail = [...(song.thumbnails || [])].sort((first, second) =>
    (second.width * second.height) - (first.width * first.height)
  )[0]

  return {
    title: song.name,
    artist: song.artist?.name || 'Unknown artist',
    album: song.album?.name || null,
    album_art_url: `https://i.ytimg.com/vi/${song.videoId}/maxresdefault.jpg`,
    thumbnail_fallback_url: bestThumbnail?.url || null,
    isrc: null,
    youtube_music_url: `https://music.youtube.com/watch?v=${song.videoId}`,
    video_id: song.videoId,
  }
}

function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function findRandomTamilSong() {
  await ytmusicReady
  const query = tamilSearchQueries[Math.floor(Math.random() * tamilSearchQueries.length)]
  const results = await ytmusic.searchSongs(query)
  const candidates = results.filter((song) => song.videoId && !recentlySelectedVideoIds.has(song.videoId))
  const pool = candidates.length ? candidates : results.filter((song) => song.videoId)
  const song = pool[Math.floor(Math.random() * pool.length)]
  if (!song) throw new Error(`YouTube Music returned no songs for the query: ${query}`)

  recentlySelectedVideoIds.add(song.videoId)
  if (recentlySelectedVideoIds.size > 20) {
    recentlySelectedVideoIds.delete(recentlySelectedVideoIds.values().next().value)
  }
  return toTrack(song)
}

async function getLyrics(track) {
  const lines = await ytmusic.getLyrics(track.video_id)
  if (!lines?.length) throw new Error('YouTube Music did not return lyrics for this track.')
  return lines.map((line) => line.trim()).filter(Boolean).join('\n')
}

async function findYouTubeSong(searchTitle, searchArtist) {
  await ytmusicReady
  const results = await ytmusic.searchSongs(`${searchTitle} ${searchArtist}`)
  const title = normalizeTitle(searchTitle)
  const song = results.find((item) => normalizeTitle(item.name).includes(title)) || results[0]
  if (!song) throw new Error(`YouTube Music did not find ${searchTitle}.`)
  return toTrack(song)
}

async function translateLyrics(lyrics) {
  const openRouterKey = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_key
  if (!openRouterKey) {
    return {
      status: 'pending',
      lines: [
        { line_number: 1, translated_line: 'Translation is waiting for an LLM key.' },
        { line_number: 2, translated_line: 'The lyric snippet was fetched safely.' },
        { line_number: 3, translated_line: 'Add OPENROUTER_API_KEY to generate this round.' },
      ],
    }
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openRouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
      'X-Title': 'Soundcheck',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Translate the Tamil lyric snippet into deliberately awkward, vague English based on the overall meaning. Do not translate strictly line by line. Group nearby lyrics into loose sentence-sized or idea-sized chunks, preserving the mood and imagery while making the wording literal enough to feel strange. Return ONLY valid JSON in this exact shape: {"lines":[{"line_number":1,"translated_line":"..."}]}. Return no more than 8 chunks, and keep each translated_line under 160 characters. Do not add commentary or markdown.' },
        { role: 'user', content: lyrics },
      ],
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`OpenRouter translation failed with ${response.status}: ${errorBody}`)
  }
  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenRouter returned an empty translation.')
  const text = typeof content === 'string' ? content.trim() : JSON.stringify(content)
  const jsonStart = text.indexOf('{')
  const jsonEnd = text.lastIndexOf('}')
  if (jsonStart < 0 || jsonEnd <= jsonStart) throw new Error('OpenRouter returned no JSON translation.')

  try {
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1))
    if (!Array.isArray(parsed.lines) || parsed.lines.length === 0) throw new Error('Translation JSON has no lines.')
    return { status: 'ready', lines: parsed.lines }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') console.error('[translation-response]', text)
    throw new Error(`OpenRouter returned invalid translation JSON: ${error.message}`)
  }
}

async function createRound(track) {
  const lyrics = await getLyrics(track)
  if (process.env.NODE_ENV !== 'production') console.log(`\n[lyrics] ${track.title}\n${lyrics}`)
  const translation = await translateLyrics(lyrics)
  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n[translation] ${track.title}`)
    translation.lines.forEach(({ line_number, translated_line }) => console.log(`${line_number}. ${translated_line}`))
  }
  return {
    track,
    literal_translation: translation.lines,
    translation_status: translation.status,
    original_line_count: lyrics.split('\n').length,
    tamil_confidence: 'auto-flagged',
  }
}

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, service: 'soundcheck-backend' })
})

app.get('/api/auth/spotify/status', async (_request, response) => {
  try {
    const profile = await getSpotifyProfile()
    response.json({ authenticated: Boolean(profile), profile: profile ? {
      id: profile.id,
      display_name: profile.display_name,
      image_url: profile.images?.[0]?.url || null,
    } : null })
  } catch (error) {
    response.status(502).json({ error: error.message })
  }
})

app.get('/api/auth/spotify/login', (_request, response) => {
  try {
    response.redirect(spotifyLoginUrl())
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
})

app.get('/api/auth/spotify/callback', async (request, response) => {
  try {
    if (request.query.state !== spotifyOauthState) throw new Error('Invalid Spotify OAuth state.')
    if (request.query.error) throw new Error(`Spotify authorization was cancelled: ${request.query.error}`)
    await exchangeSpotifyCode(request.query.code)
    response.redirect(`${frontendOrigin}/?spotify=connected`)
  } catch (error) {
    response.redirect(`${frontendOrigin}/?spotify_error=${encodeURIComponent(error.message)}`)
  }
})

app.post('/api/auth/spotify/logout', (_request, response) => {
  spotifyUserToken = null
  response.json({ authenticated: false })
})

app.get('/api/round/random', async (_request, response) => {
  try {
    response.json(await createRound(await findRandomTamilSong()))
  } catch (error) {
    console.error('[random-round]', error.message)
    response.status(502).json({ error: error.message })
  }
})

app.post('/api/round/guess', async (request, response) => {
  try {
    const { guess, target_video_id: targetVideoId, revealed_lines: revealedLines } = request.body
    if (!guess?.trim() || !targetVideoId) {
      return response.status(400).json({ error: 'A song guess and target round are required.' })
    }

    await ytmusicReady
    const results = await ytmusic.searchSongs(guess.trim())
    const firstResult = results.find((song) => song.videoId)
    if (!firstResult) return response.json({ correct: false, score: 0, matched_track: null })

    const correct = firstResult.videoId === targetVideoId
      || normalizeTitle(firstResult.name) === normalizeTitle(request.body.target_title || '')
    const lineCount = Math.max(Number(revealedLines) || 1, 1)
    const score = correct ? Math.max(100 - ((lineCount - 1) * 20), 20) : 0

    response.json({
      correct,
      score,
      matched_track: toTrack(firstResult),
    })
  } catch (error) {
    console.error('[guess]', error.message)
    response.status(502).json({ error: `Could not check the guess: ${error.message}` })
  }
})

app.post('/api/playlists/import', async (request, response) => {
  try {
    const playlistId = getPlaylistId(request.body?.playlist_url)
    if (!playlistId) return response.status(400).json({ error: 'Enter a valid Spotify playlist link.' })
    const tracks = await getSpotifyPlaylistTracks(playlistId)
    if (!tracks.length) return response.status(404).json({ error: 'No playable tracks were found in that playlist.' })
    response.json({ playlist_id: playlistId, tracks })
  } catch (error) {
    console.error('[playlist-import]', error.message)
    response.status(502).json({ error: error.message })
  }
})

app.post('/api/round/playlist-random', async (request, response) => {
  try {
    const tracks = Array.isArray(request.body?.tracks) ? request.body.tracks : []
    if (!tracks.length) return response.status(400).json({ error: 'Import a playlist before starting a round.' })
    const selected = tracks[Math.floor(Math.random() * tracks.length)]
    response.json(await createRound(await findYouTubeSong(selected.title, selected.artist)))
  } catch (error) {
    console.error('[playlist-round]', error.message)
    response.status(502).json({ error: error.message })
  }
})

const server = app.listen(port, () => {
  console.log(`Soundcheck backend listening on http://localhost:${port}`)
})

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the existing backend process or choose another PORT in .env.`)
    process.exit(1)
  }
  throw error
})

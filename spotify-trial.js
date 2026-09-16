const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')

const port = 4011
const envPath = path.join(__dirname, '.env')
const spotifyApiBase = 'https://api.spotify.com/v1'
const redirectUri = 'http://127.0.0.1:4011/callback'
const oauthScopes = 'playlist-read-private playlist-read-collaborative'
let userToken = null
let oauthState = null

function loadEnv() {
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}

async function getClientAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in the root .env file.')

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  const body = await response.text()
  if (!response.ok) throw new Error(`Spotify token failed (${response.status}): ${body}`)
  return JSON.parse(body).access_token
}

async function getAccessToken() {
  if (userToken?.accessToken && userToken.expiresAt > Date.now()) return userToken.accessToken
  return getClientAccessToken()
}

function spotifyLoginUrl() {
  oauthState = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SPOTIFY_CLIENT_ID,
    scope: oauthScopes,
    redirect_uri: redirectUri,
    state: oauthState,
  })
  return `https://accounts.spotify.com/authorize?${params}`
}

async function exchangeCode(code) {
  const credentials = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')
  const params = new URLSearchParams({ code, redirect_uri: redirectUri, grant_type: 'authorization_code' })
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })
  const body = await response.text()
  if (!response.ok) throw new Error(`Spotify user authorization failed (${response.status}): ${body}`)
  const data = JSON.parse(body)
  userToken = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + ((data.expires_in - 60) * 1000),
  }
}

async function searchTrack(query) {
  const token = await getAccessToken()
  const params = new URLSearchParams({ q: query || 'Poovukkul Olinthirukkum', type: 'track', limit: '5', market: 'IN' })
  const response = await fetch(`${spotifyApiBase}/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await response.text()
  if (!response.ok) throw new Error(`Spotify search failed (${response.status}): ${body}`)

  const data = JSON.parse(body)
  return (data.tracks?.items || []).map((track) => ({
    id: track.id,
    title: track.name,
    artists: track.artists.map((artist) => artist.name),
    album: track.album.name,
    album_art_url: track.album.images[0]?.url || null,
    isrc: track.external_ids?.isrc || null,
    spotify_url: track.external_urls?.spotify || null,
  }))
}

function extractPlaylistId(value) {
  if (!value) return null
  if (/^[a-zA-Z0-9]+$/.test(value)) return value
  try {
    const url = new URL(value)
    return url.pathname.match(/\/playlist\/([a-zA-Z0-9]+)/)?.[1] || null
  } catch {
    return null
  }
}

async function getPlaylistTracks(value) {
  const playlistId = extractPlaylistId(value)
  if (!playlistId) throw new Error('Provide a Spotify playlist URL or playlist ID.')
  if (!userToken || userToken.expiresAt <= Date.now()) {
    throw new Error('Spotify user authorization is required. Open http://127.0.0.1:4011/login first, then retry this playlist request.')
  }

  const token = await getAccessToken()
  const tracks = []
  let nextUrl = `${spotifyApiBase}/playlists/${playlistId}/items?limit=50&market=IN`

  while (nextUrl && tracks.length < 500) {
    const response = await fetch(nextUrl, { headers: { Authorization: `Bearer ${token}` } })
    const body = await response.text()
    if (!response.ok) throw new Error(`Spotify playlist failed (${response.status}): ${body}`)

    const data = JSON.parse(body)
    for (const item of data.items || []) {
      const track = item.item || item.track
      if (!track?.id || track.type !== 'track') continue
      tracks.push({
        id: track.id,
        title: track.name,
        artists: track.artists?.map((artist) => artist.name) || [],
        album: track.album?.name || null,
        album_art_url: track.album?.images?.[0]?.url || null,
        isrc: track.external_ids?.isrc || null,
        spotify_url: track.external_urls?.spotify || null,
      })
    }
    nextUrl = data.next
  }

  return { playlist_id: playlistId, count: tracks.length, tracks }
}

function sendJson(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
  response.end(JSON.stringify(data, null, 2))
}

function sendHtml(response, status, html) {
  response.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' })
  response.end(html)
}

loadEnv()
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://localhost:${port}`)
    if (url.pathname === '/health') {
      return sendJson(response, 200, {
        ok: true,
        spotify_client_id_loaded: Boolean(process.env.SPOTIFY_CLIENT_ID),
        spotify_client_secret_loaded: Boolean(process.env.SPOTIFY_CLIENT_SECRET),
        spotify_user_authorized: Boolean(userToken),
      })
    }
    if (url.pathname === '/login') {
      response.writeHead(302, { Location: spotifyLoginUrl() })
      return response.end()
    }
    if (url.pathname === '/callback') {
      if (url.searchParams.get('state') !== oauthState) return sendHtml(response, 400, '<h1>Invalid OAuth state</h1>')
      if (url.searchParams.get('error')) return sendHtml(response, 400, `<h1>Spotify authorization failed</h1><p>${url.searchParams.get('error')}</p>`)
      await exchangeCode(url.searchParams.get('code'))
      return sendHtml(response, 200, '<h1>Spotify connected</h1><p>You can close this tab and call the playlist endpoint.</p>')
    }
    if (url.pathname === '/search') {
      return sendJson(response, 200, { query: url.searchParams.get('q') || 'Poovukkul Olinthirukkum', tracks: await searchTrack(url.searchParams.get('q')) })
    }
    if (url.pathname === '/playlist') {
      return sendJson(response, 200, await getPlaylistTracks(url.searchParams.get('url') || url.searchParams.get('id')))
    }
    sendJson(response, 404, { error: 'Use /health, /search?q=Song%20Name, or /playlist?url=SpotifyPlaylistUrl' })
  } catch (error) {
    console.error(error.message)
    sendJson(response, 502, { error: error.message })
  }
})

server.listen(port, () => {
  console.log(`Spotify trial server: http://localhost:${port}`)
  console.log(`Health: http://localhost:${port}/health`)
  console.log(`Search: http://localhost:${port}/search?q=Poovukkul%20Olinthirukkum`)
  console.log(`Playlist: http://localhost:${port}/playlist?url=https://open.spotify.com/playlist/PLAYLIST_ID`)
})

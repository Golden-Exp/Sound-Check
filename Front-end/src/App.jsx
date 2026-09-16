import { useState } from 'react'
import './App.css'

function App() {
  const [view, setView] = useState('home')
  const [revealedLines, setRevealedLines] = useState(1)
  const [guess, setGuess] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [round, setRound] = useState(null)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [isChecking, setIsChecking] = useState(false)

  const lyricLines = round?.literal_translation?.length
    ? round.literal_translation.map((line) => line.translated_line)
    : ['Translation is waiting for an LLM key.', 'The lyrics were fetched safely.', 'Add OPENROUTER_API_KEY to translate this round.']

  const openModeSelect = () => {
    setView('mode-select')
    setError('')
  }

  const startRandomRound = async () => {
    setView('loading')
    setError('')
    setRevealedLines(1)
    setGuess('')
    setSubmitted(false)
    setResult(null)
    setIsChecking(false)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/round/random`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not start a round.')
      setRound(data)
      setView('round')
    } catch (requestError) {
      setError(requestError.message)
      setView('mode-select')
    }
  }

  const revealNext = () => {
    setRevealedLines((current) => Math.min(current + 1, lyricLines.length))
  }

  const submitGuess = async (event) => {
    event.preventDefault()
    if (!guess.trim() || isChecking || !round) return
    setIsChecking(true)
    setError('')
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/round/guess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guess,
          target_video_id: round.track.video_id,
          target_title: round.track.title,
          revealed_lines: revealedLines,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not check your guess.')
      setSubmitted(true)
      setResult(data)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsChecking(false)
    }
  }

  const quitRound = () => {
    setView('home')
    setRound(null)
    setResult(null)
  }

  return (
    <main className={view === 'round' ? 'app app--round' : 'app'}>
      <header className="topbar">
        <button className="brand" onClick={() => setView('home')} aria-label="Return to home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span>sound<span className="brand-accent">check</span></span>
        </button>
        <div className="topbar-meta">
          <span className="live-dot" />
          <span>single player</span>
        </div>
      </header>

      {view === 'home' ? (
        <section className="landing" aria-labelledby="landing-title">
          <div className="landing-copy">
            <p className="eyebrow">Tamil songs, translated badly</p>
            <h1 id="landing-title">How well do you know<br /><em>the original?</em></h1>
            <p className="intro">A line-by-line guessing game for lyrics that got lost in translation.</p>
            <button className="play-button" onClick={openModeSelect}>
              <span className="play-icon" aria-hidden="true">▶</span>
              <span>Play a round</span>
              <span className="arrow" aria-hidden="true">↗</span>
            </button>
            <p className="hint">Reveal fewer lines. Score higher.</p>
          </div>
          <div className="sound-art" aria-hidden="true">
            <div className="art-ring art-ring--one" />
            <div className="art-ring art-ring--two" />
            <div className="art-core"><span>தமிழ்</span><strong>?</strong></div>
            <div className="art-note art-note--one">♪</div>
            <div className="art-note art-note--two">♫</div>
            <div className="art-caption">THE SONG<br />IS IN THERE</div>
          </div>
          <div className="landing-footer">
            <span>01 / 04</span>
            <span className="footer-rule" />
            <span>made for curious ears</span>
          </div>
        </section>
      ) : view === 'mode-select' ? (
        <section className="mode-select" aria-labelledby="mode-title">
          <div className="mode-copy">
            <p className="eyebrow">Choose your starting point</p>
            <h1 id="mode-title">How do you<br /><em>want to play?</em></h1>
            <p className="intro">Pick a playlist you already love, or let the game surprise you with a Tamil song.</p>
          </div>
          <div className="mode-options">
            <button className="mode-option mode-option--active" onClick={startRandomRound}>
              <span className="mode-number">01</span>
              <span><strong>Random Tamil song</strong><small>Let soundcheck choose for you</small></span>
              <span className="mode-arrow">↗</span>
            </button>
            <button className="mode-option mode-option--disabled" disabled>
              <span className="mode-number">02</span>
              <span><strong>Upload a playlist</strong><small>Spotify playlist support is coming next</small></span>
              <span className="mode-soon">soon</span>
            </button>
            {error && <p className="error-message">{error}</p>}
          </div>
          <button className="home-link mode-back" onClick={() => setView('home')}>← Back to home</button>
        </section>
      ) : view === 'loading' ? (
        <section className="loading-state" aria-live="polite">
          <div className="loading-mark"><i /><i /><i /><i /></div>
          <p className="eyebrow">Finding a song in the wild</p>
          <h1>Listening...</h1>
          <p>Checking Spotify, then fetching a lyric snippet.</p>
        </section>
      ) : (
        <section className="round" aria-labelledby="round-title">
          <div className="round-heading">
            <div>
              <p className="eyebrow">Round 01 <span>/</span> Tamil translation</p>
              <h1 id="round-title">Name that song.</h1>
            </div>
            <div className="score-badge"><span>LINES REVEALED</span><strong>0{revealedLines}</strong><small>/ 04</small></div>
          </div>
          <div className="round-layout">
            <div className="lyrics-panel">
              <div className="panel-top"><span>literal translation</span><span>from a song you know</span></div>
              <div className="lyrics-list">
                {lyricLines.map((line, index) => (
                  <div className={`lyric-line ${index < revealedLines ? 'lyric-line--visible' : ''}`} key={line}>
                    <span className="line-number">0{index + 1}</span>
                    <span>{index < revealedLines ? line : '— — — — — — —'}</span>
                  </div>
                ))}
              </div>
              <div className="lyrics-bottom">
                <span>the more you reveal, the less you score</span>
                <button className="reveal-button" onClick={revealNext} disabled={revealedLines === lyricLines.length || submitted}>
                  {revealedLines === lyricLines.length ? 'All lines revealed' : 'Reveal next line'} <span>↓</span>
                </button>
              </div>
            </div>
            <aside className="guess-panel">
              <p className="eyebrow">Your guess</p>
              <h2>What song<br />is this?</h2>
              <form onSubmit={submitGuess}>
                <label htmlFor="guess">Song title</label>
                <input id="guess" value={guess} onChange={(event) => setGuess(event.target.value)} placeholder="Type a title..." autoComplete="off" />
                <button className="submit-button" type="submit" disabled={isChecking || submitted}>{isChecking ? 'Checking...' : submitted ? 'Guess submitted' : 'Lock in guess'} <span>↗</span></button>
              </form>
              {error && <p className="error-message">{error}</p>}
              <button className="home-link" onClick={quitRound}>← Quit round</button>
            </aside>
          </div>
          {result && (
            <div className="result-backdrop" role="dialog" aria-modal="true" aria-labelledby="result-title">
              <div className={`result-modal ${result.correct ? 'result-modal--correct' : 'result-modal--wrong'}`}>
                <button className="result-close" onClick={() => setResult(null)} aria-label="Close result">×</button>
                {result.correct && result.matched_track?.album_art_url && <img className="result-art" src={result.matched_track.album_art_url} onError={(event) => { if (result.matched_track.thumbnail_fallback_url) event.currentTarget.src = result.matched_track.thumbnail_fallback_url }} alt="" />}
                <p className="eyebrow">{result.correct ? 'That is the one' : 'Not quite this time'}</p>
                <h2 id="result-title">{result.correct ? 'You were right.' : 'Keep listening.'}</h2>
                {result.correct ? (
                  <>
                    <p className="result-song">{result.matched_track.title}<span>{result.matched_track.artist}</span></p>
                    <div className="result-score"><span>YOUR SCORE</span><strong>{result.score}</strong><small> / 100</small></div>
                  </>
                ) : <p className="result-copy">The first song found for that guess did not match this round.</p>}
                <div className="result-actions">
                  <button className="submit-button" onClick={startRandomRound}>Continue <span>↗</span></button>
                  <button className="home-link" onClick={quitRound}>Quit game</button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  )
}

export default App

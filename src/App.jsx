import { useState, useEffect } from 'react'
import { Octokit } from '@octokit/rest'
import Onboarding from './onboarding'
import Home from './Home'
import CreateCharacter from './CreateCharacter'
import CharacterLayout from './CharacterLayout'
import GMDashboard from './GMDashboard'

const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID

function App() {
  const [user, setUser]                       = useState(null)
  const [token, setToken]                     = useState(localStorage.getItem('gh_token'))
  const [onboarded, setOnboarded]             = useState(localStorage.getItem('onboarded') === 'true')
  const [screen, setScreen]                   = useState('home')
  const [selectedCharacter, setSelectedCharacter] = useState(null)

  const octokit   = token ? new Octokit({ auth: token }) : null
  const repoName  = localStorage.getItem('character_repo')

  // ── OAuth callback ────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code   = params.get('code')
    if (code) {
      fetch(`/api/auth/callback?code=${code}`)
        .then(res => res.json())
        .then(data => {
          if (data.access_token) {
            localStorage.setItem('gh_token', data.access_token)
            setToken(data.access_token)
            window.history.replaceState({}, '', '/')
          }
        })
    }
  }, [])

  // ── Load GitHub user ──────────────────────────────────────
  useEffect(() => {
    if (token) {
      fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => res.json())
        .then(data => setUser(data))
    }
  }, [token])

  // ── Auth ──────────────────────────────────────────────────
  const login = () => {
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=repo`
  }

  const logout = () => {
    localStorage.removeItem('gh_token')
    localStorage.removeItem('onboarded')
    localStorage.removeItem('character_repo')
    localStorage.removeItem('is_gm')
    setToken(null)
    setUser(null)
    setOnboarded(false)
    setScreen('home')
  }

  // ── Save character to GitHub ──────────────────────────────
  const saveCharacter = async (character) => {
    const fileName = character.identity.name.toLowerCase().replace(/\s+/g, '-')
    // Need current SHA for update
    let sha
    try {
      const { data } = await octokit.repos.getContent({
        owner: user.login,
        repo:  repoName,
        path:  `characters/${fileName}.json`,
      })
      sha = data.sha
    } catch {
      // File doesn't exist yet — create without SHA
    }

    await octokit.repos.createOrUpdateFileContents({
      owner:   user.login,
      repo:    repoName,
      path:    `characters/${fileName}.json`,
      message: `Update character: ${character.identity.name}`,
      content: btoa(unescape(encodeURIComponent(JSON.stringify(character, null, 2)))),
      ...(sha ? { sha } : {}),
    })
  }

  // ── Not logged in ─────────────────────────────────────────
  if (!token) return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">⚔️</div>
        <h1 className="login-title">TTRPG Sheet</h1>
        <p className="login-sub">Create, share and track your characters across every session.</p>
        <button className="login-btn" onClick={login}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          Sign in with GitHub
        </button>
      </div>
      <style>{`
        .login-screen {
          min-height: 100%;
          background: var(--bg-base);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }
        .login-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 12px;
          max-width: 320px;
          width: 100%;
        }
        .login-logo { font-size: 3rem; }
        .login-title {
          font-family: var(--font-display);
          font-size: 24px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .login-sub {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.6;
          margin-bottom: 8px;
        }
        .login-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 24px;
          background: var(--accent);
          color: var(--text-inverse);
          border: none;
          border-radius: var(--radius-md);
          font-family: var(--font-body);
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .login-btn:hover { opacity: 0.85; }
      `}</style>
    </div>
  )

  // ── Loading user ──────────────────────────────────────────
  if (!user) return (
    <div style={{
      minHeight: '100%',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-secondary)',
      fontFamily: 'var(--font-body)',
      gap: '10px',
    }}>
      <div style={{
        width: 18, height: 18, border: '2px solid var(--border-strong)',
        borderTopColor: 'var(--accent)', borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      Loading…
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  // ── Onboarding ────────────────────────────────────────────
  if (!onboarded) return (
    <Onboarding
      token={token}
      user={user}
      onComplete={() => setOnboarded(true)}
    />
  )

  // ── Create character ──────────────────────────────────────
  if (screen === 'create') return (
    <div className="screen-scroll">
      <CreateCharacter
        token={token}
        user={user}
        onComplete={() => setScreen('home')}
        onCancel={() => setScreen('home')}
      />
    </div>
  )

  // ── Character sheet ───────────────────────────────────────
  if (screen === 'character' && selectedCharacter) return (
    <CharacterLayout
      characters={[selectedCharacter]}
      activeCharId={selectedCharacter.meta.characterId}
      onSwitchChar={() => {}}
      onNewChar={() => setScreen('create')}
      onBack={() => setScreen('home')}
      user={user}
      onUpdateChar={saveCharacter}
      syncStatus="saved"
    />
  )

  // ── GM Dashboard ──────────────────────────────────────────
  if (screen === 'gm-dashboard') return (
    <GMDashboard
      onBack={() => setScreen('home')}
      onViewCharacter={(char) => {
        setSelectedCharacter(char)
        setScreen('character')
      }}
    />
  )

  // ── Home ──────────────────────────────────────────────────
  return (
    <Home
      token={token}
      user={user}
      isGM={localStorage.getItem('is_gm') === 'true'}
      onCreateCharacter={() => setScreen('create')}
      onSelectCharacter={(char) => {
        setSelectedCharacter(char)
        setScreen('character')
      }}
      onOpenGMDashboard={() => setScreen('gm-dashboard')}
      onLogout={logout}
    />
  )
}

export default App

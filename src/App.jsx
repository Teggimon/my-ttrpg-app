import { useState, useEffect } from 'react'
import { Octokit } from '@octokit/rest'
import Onboarding from './onboarding'
import Home from './Home'
import CreateCharacter from './CreateCharacter'
import CharacterLayout from './CharacterLayout'
import GMDashboard from './GMDashboard'

const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID

function App() {
  const [user, setUser]                           = useState(null)
  const [token, setToken]                         = useState(localStorage.getItem('gh_token'))
  const [onboarded, setOnboarded]                 = useState(localStorage.getItem('onboarded') === 'true')
  const [screen, setScreen]                       = useState('home')
  const [selectedCharacter, setSelectedCharacter] = useState(null)

  const octokit  = token ? new Octokit({ auth: token }) : null
  const repoName = localStorage.getItem('character_repo')

  // OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code   = params.get('code')
    if (code) {
      fetch(`/api/auth/callback?code=${code}`)
        .then(r => r.json())
        .then(data => {
          if (data.access_token) {
            localStorage.setItem('gh_token', data.access_token)
            setToken(data.access_token)
            window.history.replaceState({}, '', '/')
          }
        })
    }
  }, [])

  // Load GitHub user
  useEffect(() => {
    if (token) {
      fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(data => setUser(data))
    }
  }, [token])

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

  const saveCharacter = async (character) => {
    const fileName = character.identity.name.toLowerCase().replace(/\s+/g, '-')
    const path     = `characters/${fileName}.json`
    const content  = btoa(unescape(encodeURIComponent(JSON.stringify(character, null, 2))))

    let sha
    try {
      const { data } = await octokit.repos.getContent({ owner: user.login, repo: repoName, path })
      sha = data.sha
    } catch { /* new file — no sha needed */ }

    await octokit.repos.createOrUpdateFileContents({
      owner: user.login,
      repo:  repoName,
      path,
      message: `Update character: ${character.identity.name}`,
      content,
      ...(sha ? { sha } : {}),
    })
  }

  // ── Not logged in ──
  if (!token) return (
    <div style={{
      minHeight: '100%', background: 'var(--bg-base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', maxWidth: '300px', width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem' }}>⚔️</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
          TTRPG Sheet
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Create, share and track your characters across every session.
        </p>
        <button
          onClick={login}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '12px 24px', background: 'var(--accent)', color: 'var(--text-inverse)',
            border: 'none', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-body)',
            fontSize: '15px', fontWeight: 700, cursor: 'pointer', width: '100%', justifyContent: 'center',
          }}
        >
          Sign in with GitHub
        </button>
      </div>
    </div>
  )

  // ── Loading ──
  if (!user) return (
    <div style={{
      minHeight: '100%', background: 'var(--bg-base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', gap: '10px',
    }}>
      Loading…
    </div>
  )

  // ── Onboarding ──
  if (!onboarded) return (
    <Onboarding token={token} user={user} onComplete={() => setOnboarded(true)} />
  )

  // ── Create character ──
  if (screen === 'create') return (
    <div className="screen-scroll">
      <CreateCharacter
        token={token} user={user}
        onComplete={() => setScreen('home')}
        onCancel={() => setScreen('home')}
      />
    </div>
  )

  // ── Character sheet ──
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

  // ── GM Dashboard ──
  if (screen === 'gm-dashboard') return (
    <GMDashboard
      onBack={() => setScreen('home')}
      onViewCharacter={(char) => {
        setSelectedCharacter(char)
        setScreen('character')
      }}
    />
  )

  // ── Home ──
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

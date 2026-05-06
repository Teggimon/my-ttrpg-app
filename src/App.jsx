import { useState, useEffect } from 'react'
import { Octokit } from '@octokit/rest'
import Onboarding from './onboarding'
import Home from './Home'
import DMHome from './DMHome'
import CampaignView from './CampaignView'
import SessionView from './SessionView'
import EncounterView from './EncounterView'
import CreateCharacter from './CreateCharacter'
import CharacterLayout from './CharacterLayout'
import GMDashboard from './GMDashboard'

const CLIENT_ID      = import.meta.env.VITE_GITHUB_CLIENT_ID
const CHARACTERS_REPO = 'ttrpg-characters'

function App() {
  const [token, setToken]                         = useState(localStorage.getItem('gh_token'))
  const [user, setUser]                           = useState(null)
  const [onboarded, setOnboarded]                 = useState(false)
  const [checkingOnboard, setCheckingOnboard]     = useState(true)
  const [screen, setScreen]                       = useState('home')
  const [selectedCharacter, setSelectedCharacter] = useState(null)
  const [selectedCampaign, setSelectedCampaign]   = useState(null)
  const [selectedSession, setSelectedSession]     = useState(null)
  const [selectedEncounter, setSelectedEncounter] = useState(null)
  const [sessionParty, setSessionParty]           = useState([])
  const [isGM, setIsGM]                           = useState(false)

  const octokit = token ? new Octokit({ auth: token }) : null

  // ── OAuth callback ──────────────────────────────────────────
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

  // ── Load GitHub user ────────────────────────────────────────
  useEffect(() => {
    if (!token) { setCheckingOnboard(false); return }
    fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        setUser(data)
        checkOnboardStatus(data.login)
      })
      .catch(() => setCheckingOnboard(false))
  }, [token])

  // ── Check onboard: does ttrpg-characters exist on GitHub? ──
  const checkOnboardStatus = async (login) => {
    if (!token) { setCheckingOnboard(false); return }
    const ok = new Octokit({ auth: token })
    try {
      await ok.repos.get({ owner: login, repo: CHARACTERS_REPO })
      setOnboarded(true)

      // Detect GM status: check if ttrpg-campaigns repo exists
      try {
        await ok.repos.get({ owner: login, repo: 'ttrpg-campaigns' })
        setIsGM(true)
      } catch {
        setIsGM(false)
      }
    } catch {
      setOnboarded(false)
    }
    setCheckingOnboard(false)
  }

  // ── Auth ────────────────────────────────────────────────────
  const login = () => {
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=repo`
  }

  const logout = () => {
    localStorage.removeItem('gh_token')
    setToken(null)
    setUser(null)
    setOnboarded(false)
    setIsGM(false)
    setScreen('home')
    setSelectedCharacter(null)
    setSelectedCampaign(null)
  }

  // ── Save character to GitHub ────────────────────────────────
  const saveCharacter = async (character) => {
    // Update local state immediately so controlled inputs reflect changes
    setSelectedCharacter(character)

    const fileName = character._fileName
      ?? character.identity.name.toLowerCase().replace(/\s+/g, '-') + '.json'
    const path    = `characters/${fileName}`
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(character, null, 2))))

    let sha
    try {
      const { data } = await octokit.repos.getContent({
        owner: user.login, repo: CHARACTERS_REPO, path,
      })
      sha = data.sha
    } catch { /* new file */ }

    await octokit.repos.createOrUpdateFileContents({
      owner:   user.login,
      repo:    CHARACTERS_REPO,
      path,
      message: `Update character: ${character.identity.name}`,
      content,
      ...(sha ? { sha } : {}),
    })
  }

  // ── Onboarding complete ─────────────────────────────────────
  const handleOnboardComplete = (gmStatus) => {
    setOnboarded(true)
    setIsGM(gmStatus)
  }

  // ── DM mode toggled from Home ───────────────────────────────
  const handleGMToggle = (newIsGM) => {
    setIsGM(newIsGM)
  }

  // ═══════════════════════════════════════════════════════════
  //  Render
  // ═══════════════════════════════════════════════════════════

  // ── Not logged in ──
  if (!token) return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-body)',
      padding: '2rem',
      gap: '24px',
    }}>
      <div style={{ fontSize: 48 }}>⚔️</div>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '24px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '8px',
        }}>TTRPG Sheet</div>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 300 }}>
          Create, share and track your characters across every session
        </div>
      </div>
      <button
        onClick={login}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '12px 28px',
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontFamily: 'var(--font-body)',
          fontSize: '15px',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Sign in with GitHub
      </button>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
        Your characters live in your own GitHub repository. You own your data, always.
      </div>
    </div>
  )

  // ── Checking onboard status ──
  if (checkingOnboard || !user) return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-secondary)',
      fontFamily: 'var(--font-body)',
      gap: '10px',
    }}>
      <div style={{
        width: 16, height: 16,
        border: '2px solid var(--border-strong)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      Loading…
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  // ── Onboarding ──
  if (!onboarded) return (
    <Onboarding
      token={token}
      user={user}
      onComplete={handleOnboardComplete}
    />
  )

  // ── Create character ──
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

  // ── Character sheet ──
  if (screen === 'character' && selectedCharacter) return (
    <CharacterLayout
      characters={[selectedCharacter]}
      activeCharId={selectedCharacter.meta.characterId}
      onSwitchChar={() => {}}
      onNewChar={() => setScreen('create')}
      onBack={() => setScreen(selectedCampaign ? 'gm-dashboard' : 'home')}
      user={user}
      onUpdateChar={saveCharacter}
      syncStatus="saved"
    />
  )

  // ── DM Home ──
  if (screen === 'dm-home') return (
    <DMHome
      token={token}
      user={user}
      onBack={() => { setScreen('home'); setIsGM(false) }}
      onOpenCampaign={(campaign) => {
        setSelectedCampaign(campaign)
        setScreen('dm-campaign')
      }}
    />
  )

  // ── Campaign View ──
  if (screen === 'dm-campaign' && selectedCampaign) return (
    <CampaignView
      token={token}
      user={user}
      campaign={selectedCampaign}
      onBack={() => setScreen('dm-home')}
      onOpenSession={(session, campaign, party) => {
        setSelectedSession(session)
        setSelectedCampaign(campaign)
        setSessionParty(party ?? [])
        setScreen('dm-session')
      }}
    />
  )

  // ── Session View ──
  if (screen === 'dm-session' && selectedSession) return (
    <SessionView
      token={token}
      user={user}
      session={selectedSession}
      campaign={selectedCampaign}
      party={sessionParty}
      onBack={() => setScreen('dm-campaign')}
      onOpenEncounter={(encounter, session, campaign) => {
        setSelectedEncounter(encounter)
        setSelectedSession(session)
        setSelectedCampaign(campaign)
        setScreen('dm-encounter')
      }}
    />
  )

  // ── Encounter View ──
  if (screen === 'dm-encounter' && selectedEncounter) return (
    <EncounterView
      encounter={selectedEncounter}
      session={selectedSession}
      campaign={selectedCampaign}
      party={sessionParty}
      onBack={() => setScreen('dm-session')}
      onEndEncounter={(result) => {
        setSelectedEncounter(result)
        setScreen('dm-session')
      }}
    />
  )

  // ── GM Dashboard (legacy — keep for now) ──
  if (screen === 'gm-dashboard') return (
    <GMDashboard
      token={token}
      user={user}
      campaign={selectedCampaign}
      onBack={() => setScreen('dm-home')}
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
      isGM={isGM}
      onGMToggle={handleGMToggle}
      onCreateCharacter={() => setScreen('create')}
      onSelectCharacter={(char) => {
        setSelectedCharacter(char)
        setScreen('character')
      }}
      onOpenGMDashboard={() => setScreen('dm-home')}
      onLogout={logout}
    />
  )
}

export default App

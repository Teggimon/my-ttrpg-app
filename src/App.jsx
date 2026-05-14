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
import { APP_META_PATH, CHARACTERS_PATH, DATA_REPO } from './githubStorage'

const CLIENT_ID      = import.meta.env.VITE_GITHUB_CLIENT_ID

function fileToBase64(file) {
  return file.arrayBuffer().then(buffer => {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const chunkSize = 0x8000
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
    }
    return btoa(binary)
  })
}

function stringToBase64(value) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

function safeCharacterFileName(character) {
  const existing = character._fileName
  if (existing) return existing.endsWith('.json') ? existing : `${existing}.json`
  const slug = String(character.identity?.name ?? 'character')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'character'}.json`
}

function safeFilePart(value, fallback = 'image') {
  return (value || fallback)
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || fallback
}

function App() {
  const [token, setToken]                         = useState(localStorage.getItem('gh_token'))
  const [user, setUser]                           = useState(null)
  const [onboarded, setOnboarded]                 = useState(false)
  const [checkingOnboard, setCheckingOnboard]     = useState(true)
  const [screen, setScreen]                       = useState('home')
  const [selectedCharacter, setSelectedCharacter] = useState(null)
  const [selectedCampaign, setSelectedCampaign]   = useState(null)
  const [selectedCampaignOptions, setSelectedCampaignOptions] = useState(null)
  const [selectedSession, setSelectedSession]     = useState(null)
  const [selectedEncounter, setSelectedEncounter] = useState(null)
  const [characterReturnScreen, setCharacterReturnScreen] = useState('home')
  const [sessionParty, setSessionParty]           = useState([])
  const [sessionPreparedEncounters, setSessionPreparedEncounters] = useState([])

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

  // ── Check onboard: does ttrpg-app-data exist on GitHub? ──
  const checkOnboardStatus = async (login) => {
    if (!token) { setCheckingOnboard(false); return }
    const ok = new Octokit({ auth: token })
    try {
      await ok.repos.get({ owner: login, repo: DATA_REPO })
      setOnboarded(true)
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
    setScreen('home')
    setSelectedCharacter(null)
    setSelectedCampaign(null)
    setSelectedCampaignOptions(null)
  }

  // ── Save character to GitHub ────────────────────────────────
  const saveCharacter = async (character) => {
    // Update local state immediately so controlled inputs reflect changes
    setSelectedCharacter(character)

    const fileName = safeCharacterFileName(character)
    const path    = `${CHARACTERS_PATH}/${fileName}`
    const { _fileName, ...persistedCharacter } = character
    void _fileName
    const content = stringToBase64(JSON.stringify(persistedCharacter, null, 2))

    let sha
    try {
      const { data } = await octokit.repos.getContent({
        owner: user.login, repo: DATA_REPO, path,
      })
      sha = Array.isArray(data) ? undefined : data.sha
    } catch { /* new file */ }

    await octokit.repos.createOrUpdateFileContents({
      owner:   user.login,
      repo:    DATA_REPO,
      path,
      message: `Update character: ${persistedCharacter.identity.name}`,
      content,
      ...(sha ? { sha } : {}),
    })
  }

  const uploadCharacterImage = async (character, file) => {
    const jsonName = character._fileName
      ?? character.identity.name.toLowerCase().replace(/\s+/g, '-') + '.json'
    const baseName = safeFilePart(jsonName, character.meta?.characterId ?? 'character')
    const imageName = safeFilePart(file.name, 'portrait')
    const ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? 'jpg').toLowerCase()
    const stamp = Date.now()
    const path = `${CHARACTERS_PATH}/${baseName}-images/${stamp}-${imageName}.${ext}`
    const content = await fileToBase64(file)

    await octokit.repos.createOrUpdateFileContents({
      owner: user.login,
      repo: DATA_REPO,
      path,
      message: `Upload character image: ${character.identity.name}`,
      content,
    })

    const rawPath = path.split('/').map(encodeURIComponent).join('/')
    return {
      id: String(stamp),
      name: file.name,
      path,
      url: `https://raw.githubusercontent.com/${user.login}/${DATA_REPO}/main/${rawPath}?v=${stamp}`,
      type: file.type,
      size: file.size,
      uploadedAt: new Date(stamp).toISOString(),
    }
  }

  const loadCampaignCharacter = async (character, campaign) => {
    const owner = character.owner ?? character.github ?? character.meta?.owner?.replace('github:', '')
    if (!owner) return

    let loaded = null
    let campaignOptions
    try {
      const { data } = await octokit.repos.getContent({
        owner: user.login,
        repo: DATA_REPO,
        path: `campaigns/${campaign.slug}/options.json`,
      })
      campaignOptions = JSON.parse(atob(data.content.replace(/\s/g, '')))
    } catch { /* campaign options not created yet */ }

    const fileName = character.fileName ?? character._fileName
    if (fileName) {
      try {
        const { data } = await octokit.repos.getContent({
          owner,
          repo: DATA_REPO,
          path: `${CHARACTERS_PATH}/${fileName.endsWith('.json') ? fileName : `${fileName}.json`}`,
        })
        loaded = JSON.parse(atob(data.content.replace(/\s/g, '')))
        loaded._fileName = data.name
      } catch {
        loaded = null
      }
    }

    if (!loaded && character.characterId) {
      const { data: files } = await octokit.repos.getContent({
        owner,
        repo: DATA_REPO,
        path: CHARACTERS_PATH,
      })
      for (const file of files.filter(f => f.name.endsWith('.json'))) {
        const { data } = await octokit.repos.getContent({
          owner,
          repo: DATA_REPO,
          path: file.path,
        })
        const parsed = JSON.parse(atob(data.content.replace(/\s/g, '')))
        if (parsed.meta?.characterId === character.characterId) {
          loaded = { ...parsed, _fileName: file.name }
          break
        }
      }
    }

    if (!loaded) return
    setSelectedCampaign(campaign)
    setSelectedCampaignOptions(campaignOptions)
    setSelectedCharacter(loaded)
    setCharacterReturnScreen('dm-campaign')
    setScreen('character')
  }

  // ── Onboarding complete ─────────────────────────────────────
  const handleOnboardComplete = () => {
    setOnboarded(true)
  }

  // ── DM mode toggled from Home ───────────────────────────────
  const handleGMToggle = async (newIsGM) => {
    try {
      let sha
      try {
        const { data } = await octokit.repos.getContent({
          owner: user.login,
          repo: DATA_REPO,
          path: APP_META_PATH,
        })
        sha = data.sha
      } catch { /* first metadata write */ }

      await octokit.repos.createOrUpdateFileContents({
        owner: user.login,
        repo: DATA_REPO,
        path: APP_META_PATH,
        message: newIsGM ? 'Enable GM tools' : 'Disable GM tools',
        content: stringToBase64(JSON.stringify({ isGM: newIsGM, updatedAt: new Date().toISOString() }, null, 2)),
        ...(sha ? { sha } : {}),
      })
    } catch (err) {
      console.error('Failed to save GM preference:', err)
    }
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
      <img
        src="/uploads/placeholders/default-portrait.jpg"
        alt=""
        style={{
          width: 72,
          height: 72,
          objectFit: 'cover',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
        }}
      />
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--font-name)',
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
          color: 'var(--accent-text)',
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
        user={user}
        onComplete={async (character) => {
          await saveCharacter(character)
          setScreen('home')
        }}
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
      onBack={() => setScreen(characterReturnScreen)}
      user={user}
      onUpdateChar={saveCharacter}
      onUploadImage={uploadCharacterImage}
      campaign={selectedCampaign}
      campaignOptions={selectedCampaignOptions}
      syncStatus="saved"
    />
  )

  // ── DM Home ──
  if (screen === 'dm-home') return (
    <DMHome
      token={token}
      user={user}
      onBack={() => setScreen('home')}
      onOpenCampaign={(campaign) => {
        setSelectedCampaign(campaign)
        setSelectedCampaignOptions(null)
        setScreen('dm-campaign')
      }}
      onLogout={logout}
    />
  )

  // ── Campaign View ──
  if (screen === 'dm-campaign' && selectedCampaign) return (
    <CampaignView
      token={token}
      user={user}
      campaign={selectedCampaign}
      onBack={() => setScreen('dm-home')}
      onOpenSession={(session, campaign, party, preparedEncounters) => {
        setSelectedSession(session)
        setSelectedCampaign(campaign)
        setSessionParty(party ?? [])
        setSessionPreparedEncounters(preparedEncounters ?? [])
        setScreen('dm-session')
      }}
      onViewCharacter={loadCampaignCharacter}
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
      initialPreparedEncounters={sessionPreparedEncounters}
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
      token={token}
      user={user}
      encounter={selectedEncounter}
      session={selectedSession}
      campaign={selectedCampaign}
      party={sessionParty}
      onBack={() => setScreen('dm-session')}
      onEndEncounter={(result, updatedSession) => {
        setSelectedEncounter(result)
        if (updatedSession) setSelectedSession(updatedSession)
        setScreen('dm-session')
      }}
    />
  )

  // ── Home ──
  return (
    <Home
      token={token}
      user={user}
      onGMToggle={handleGMToggle}
      onCreateCharacter={() => setScreen('create')}
      onSelectCharacter={(char) => {
        setSelectedCampaign(null)
        setSelectedCampaignOptions(null)
        setSelectedSession(null)
        setSelectedEncounter(null)
        setSelectedCharacter(char)
        setCharacterReturnScreen('home')
        setScreen('character')
      }}
      onOpenDMHome={() => setScreen('dm-home')}
      onLogout={logout}
    />
  )
}

export default App

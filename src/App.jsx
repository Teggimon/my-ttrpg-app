import { useState, useEffect } from 'react'
import Onboarding from './onboarding'
import Home from './Home'
import CreateCharacter from './CreateCharacter'

const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID

function App() {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('gh_token'))
  const [onboarded, setOnboarded] = useState(localStorage.getItem('onboarded') === 'true')
  const [screen, setScreen] = useState('home')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')

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

  useEffect(() => {
    if (token) {
      fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
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

  if (!token) return (
    <div style={{ padding: '2rem' }}>
      <h1>⚔️ TTRPG Sheet</h1>
      <p>Create, share and track your characters across every session.</p>
      <button onClick={login}>Sign in with GitHub</button>
    </div>
  )

  if (!user) return (
    <div style={{ padding: '2rem' }}>
      <h1>⚔️ TTRPG Sheet</h1>
      <p>Loading...</p>
    </div>
  )

  if (!onboarded) return (
    <Onboarding
      token={token}
      user={user}
      onComplete={() => setOnboarded(true)}
    />
  )

  if (screen === 'create') return (
    <CreateCharacter
      token={token}
      user={user}
      onComplete={() => setScreen('home')}
      onCancel={() => setScreen('home')}
    />
  )

  return (
    <Home
      token={token}
      user={user}
      isGM={localStorage.getItem('is_gm') === 'true'}
      onCreateCharacter={() => setScreen('create')}
      onSelectCharacter={(char) => alert(`Selected: ${char.identity.name}`)}
    />
  )
}

export default App
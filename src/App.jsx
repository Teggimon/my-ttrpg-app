import { useState, useEffect } from 'react'
import Onboarding from './Onboarding'

const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID

function App() {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('gh_token'))
  const [onboarded, setOnboarded] = useState(false)

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
  }

  if (!user) return (
    <div style={{ padding: '2rem' }}>
      <h1>⚔️ TTRPG Sheet</h1>
      <p>Create, share and track your characters across every session.</p>
      <button onClick={login}>Sign in with GitHub</button>
    </div>
  )

  if (!onboarded) return (
    <Onboarding
      token={token}
      user={user}
      onComplete={() => setOnboarded(true)}
    />
  )

  return (
    <div style={{ padding: '2rem' }}>
      <h1>⚔️ TTRPG Sheet</h1>
      <p>Welcome back, {user.login}! 👋</p>
      <img src={user.avatar_url} width={64} style={{ borderRadius: '50%' }} />
      <br /><br />
      <p>Your character repo: <strong>{localStorage.getItem('character_repo')}</strong></p>
      <button onClick={logout}>Sign out</button>
    </div>
  )
}

export default App

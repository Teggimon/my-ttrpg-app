import { useState, useEffect } from 'react'

const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID

function App() {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('gh_token'))

  useEffect(() => {
    // Handle OAuth callback
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
    setToken(null)
    setUser(null)
  }

  if (!user) {
    return (
      <div style={{ padding: '2rem' }}>
        <h1>⚔️ TTRPG Sheet</h1>
        <button onClick={login}>Sign in with GitHub</button>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>⚔️ TTRPG Sheet</h1>
      <p>Welcome, {user.login}! 👋</p>
      <img src={user.avatar_url} width={64} style={{ borderRadius: '50%' }} />
      <br /><br />
      <button onClick={logout}>Sign out</button>
    </div>
  )
}

export default App
import { useState } from 'react'
import { Octokit } from '@octokit/rest'

function Onboarding({ token, user, onComplete }) {
  const [step, setStep] = useState(1)
  const repoName = 'ttrpg-characters'
  const [isGM, setIsGM] = useState(false)
  const [partyRepoName, setPartyRepoName] = useState('my-party-repo')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const octokit = new Octokit({ auth: token })

  const createCharacterRepo = async () => {
    setLoading(true)
    setError(null)
    try {
      await octokit.repos.createForAuthenticatedUser({
        name: repoName,
        description: 'My TTRPG characters',
        auto_init: true,
        private: false,
      })
      setStep(2)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const createPartyRepo = async () => {
    setLoading(true)
    setError(null)
    try {
      await octokit.repos.createForAuthenticatedUser({
        name: partyRepoName,
        description: 'Party repository for shared content',
        auto_init: true,
        private: false,
      })
      localStorage.setItem('party_repo', partyRepoName)
      setStep(4)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const finish = () => {
    localStorage.setItem('character_repo', repoName)
    localStorage.setItem('is_gm', isGM)
    localStorage.setItem('onboarded', 'true')
    onComplete()
  }

  if (step === 1) return (
    <div style={{ padding: '2rem', maxWidth: '480px', margin: '0 auto' }}>
      <h1>⚔️ TTRPG Sheet</h1>
      <h2>Welcome, {user.login}! 👋</h2>
      <p>First, let's create your character repository. This is where all your characters will be stored — in your own GitHub account.</p>
      <label>Repo name</label><br />
      <input
        value={repoName}
        onChange={e => setRepoName(e.target.value)}
        style={{ padding: '0.5rem', width: '100%', marginBottom: '1rem' }}
      />
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button onClick={createCharacterRepo} disabled={loading}>
        {loading ? 'Creating...' : 'Create My Repository'}
      </button>
    </div>
  )

  if (step === 2) return (
    <div style={{ padding: '2rem', maxWidth: '480px', margin: '0 auto' }}>
      <h1>⚔️ TTRPG Sheet</h1>
      <h2>One quick question...</h2>
      <p>Do you ever run games as a Game Master?</p>
      <button onClick={() => { setIsGM(true); setStep(3) }} style={{ marginRight: '1rem' }}>
        Yes, I'm a GM
      </button>
      <button onClick={() => { setIsGM(false); setStep(4) }}>
        No, just a player
      </button>
    </div>
  )

  if (step === 3) return (
    <div style={{ padding: '2rem', maxWidth: '480px', margin: '0 auto' }}>
      <h1>⚔️ TTRPG Sheet</h1>
      <h2>Set up a Party Repository</h2>
      <p>A shared space for your party's custom content and homebrew.</p>
      <label>Repo name</label><br />
      <input
        value={partyRepoName}
        onChange={e => setPartyRepoName(e.target.value)}
        style={{ padding: '0.5rem', width: '100%', marginBottom: '1rem' }}
      />
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button onClick={createPartyRepo} disabled={loading} style={{ marginRight: '1rem' }}>
        {loading ? 'Creating...' : 'Create Party Repo'}
      </button>
      <button onClick={() => setStep(4)}>Skip for now</button>
    </div>
  )

  if (step === 4) return (
    <div style={{ padding: '2rem', maxWidth: '480px', margin: '0 auto' }}>
      <h1>⚔️ TTRPG Sheet</h1>
      <h2>{isGM ? 'GM All Set! ⚔️' : 'All set! 🎲'}</h2>
      <p>Your character repository is ready. Time to create your first character!</p>
      <button onClick={finish}>Let's go!</button>
    </div>
  )
}

export default Onboarding

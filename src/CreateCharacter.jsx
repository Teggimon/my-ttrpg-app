import { useState } from 'react'
import { Octokit } from '@octokit/rest'
import { v4 as uuidv4 } from 'uuid'

function CreateCharacter({ token, user, onComplete, onCancel }) {
  const [name, setName] = useState('')
  const [race, setRace] = useState('')
  const [className, setClassName] = useState('')
  const [background, setBackground] = useState('')
  const [alignment, setAlignment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const octokit = new Octokit({ auth: token })
  const repoName = localStorage.getItem('character_repo')

  const createCharacter = async () => {
    if (!name || !race || !className) {
      setError('Name, race and class are required.')
      return
    }

    setLoading(true)
    setError(null)

    const character = {
      meta: {
        owner: `github:${user.login}`,
        characterId: uuidv4(),
        copiedFrom: null,
        system: 'dnd5e',
        version: 1,
        lastUpdated: new Date().toISOString(),
      },
      identity: {
        name,
        race,
        class: [{ name: className, level: 1 }],
        background,
        alignment,
        xp: 0,
        portrait: null,
      },
      stats: {
        abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        savingThrows: {},
        skills: {},
      },
      combat: {
        hpMax: 10,
        hpCurrent: 10,
        hpTemp: 0,
        ac: 10,
        initiative: 0,
        speed: 30,
        deathSaves: { successes: 0, failures: 0 },
        conditions: [],
      },
      inventory: [],
      spells: {
        spellcastingAbility: null,
        slots: {},
        known: [],
        prepared: [],
        concentration: null,
      },
      notes: {
        personalityTraits: '',
        ideals: '',
        bonds: '',
        flaws: '',
        appearance: '',
        backstory: '',
        alliesAndOrganisations: '',
        general: '',
      },
      settings: {
        encumbranceTracking: false,
      },
    }

    const fileName = name.toLowerCase().replace(/\s+/g, '-')

    try {
      await octokit.repos.createOrUpdateFileContents({
        owner: user.login,
        repo: repoName,
        path: `characters/${fileName}.json`,
        message: `Add character: ${name}`,
        content: btoa(JSON.stringify(character, null, 2)),
      })
      onComplete(character)
    } catch (err) {
      setError(err.message)
    }

    setLoading(false)
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '480px', margin: '0 auto' }}>
      <h1>⚔️ New Character</h1>

      <label>Name *</label><br />
      <input value={name} onChange={e => setName(e.target.value)}
        style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }} /><br />

      <label>Race *</label><br />
      <input value={race} onChange={e => setRace(e.target.value)}
        style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }} /><br />

      <label>Class *</label><br />
      <input value={className} onChange={e => setClassName(e.target.value)}
        style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }} /><br />

      <label>Background</label><br />
      <input value={background} onChange={e => setBackground(e.target.value)}
        style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }} /><br />

      <label>Alignment</label><br />
      <input value={alignment} onChange={e => setAlignment(e.target.value)}
        style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }} /><br />

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <button onClick={createCharacter} disabled={loading} style={{ marginRight: '1rem' }}>
        {loading ? 'Creating...' : 'Create Character'}
      </button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  )
}

export default CreateCharacter
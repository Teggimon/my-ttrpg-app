import { useState, useEffect } from 'react'
import { Octokit } from '@octokit/rest'
import { v4 as uuidv4 } from 'uuid'
import { getClasses, getRaces, getBackgrounds } from './srdContent'

function CreateCharacter({ token, user, onComplete, onCancel }) {
  const [name, setName] = useState('')
  const [race, setRace] = useState('')
  const [className, setClassName] = useState('')
  const [background, setBackground] = useState('')
  const [alignment, setAlignment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [classes, setClasses] = useState([])
  const [races, setRaces] = useState([])
  const [backgrounds, setBackgrounds] = useState([])

  const [classSearch, setClassSearch] = useState('')
  const [raceSearch, setRaceSearch] = useState('')
  const [backgroundSearch, setBackgroundSearch] = useState('')

  const [showClassList, setShowClassList] = useState(false)
  const [showRaceList, setShowRaceList] = useState(false)
  const [showBackgroundList, setShowBackgroundList] = useState(false)

  const octokit = new Octokit({ auth: token })
  const repoName = localStorage.getItem('character_repo')

  useEffect(() => {
    getClasses().then(setClasses)
    getRaces().then(setRaces)
    getBackgrounds().then(setBackgrounds)
  }, [])

  const alignments = [
    'Lawful Good', 'Neutral Good', 'Chaotic Good',
    'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
    'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'
  ]

  const filteredClasses = classes.filter(c => c.name.toLowerCase().includes(classSearch.toLowerCase()))
  const filteredRaces = races.filter(r => r.name.toLowerCase().includes(raceSearch.toLowerCase()))
  const filteredBackgrounds = backgrounds.filter(b => b.name.toLowerCase().includes(backgroundSearch.toLowerCase()))

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
        milestoneMode: false,
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

  const inputStyle = { width: '100%', padding: '0.5rem', marginBottom: '0.25rem', background: '#12122a', border: '1px solid #444', color: '#fff', borderRadius: '4px' }
  const listStyle = { background: '#12122a', border: '1px solid #444', borderRadius: '4px', marginBottom: '1rem', maxHeight: '180px', overflowY: 'auto' }
  const listItemStyle = { padding: '0.5rem', cursor: 'pointer', borderBottom: '1px solid #333' }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '480px', margin: '0 auto' }}>
      <h1>⚔️ New Character</h1>

      <label>Name *</label>
      <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />

      <label>Race *</label>
      <input
        value={raceSearch || race}
        onChange={e => { setRaceSearch(e.target.value); setRace(e.target.value); setShowRaceList(true) }}
        onFocus={() => setShowRaceList(true)}
        placeholder="Search or type a race..."
        style={inputStyle}
      />
      {showRaceList && (
        <div style={listStyle}>
          {filteredRaces.map(r => (
            <div key={r.index} style={listItemStyle} onClick={() => { setRace(r.name); setRaceSearch(''); setShowRaceList(false) }}>
              {r.name}
            </div>
          ))}
          {raceSearch && !filteredRaces.find(r => r.name.toLowerCase() === raceSearch.toLowerCase()) && (
            <div style={{ ...listItemStyle, color: '#aaa' }} onClick={() => { setRace(raceSearch); setShowRaceList(false) }}>
              Use "{raceSearch}" (custom)
            </div>
          )}
        </div>
      )}

      <label>Class *</label>
      <input
        value={classSearch || className}
        onChange={e => { setClassSearch(e.target.value); setClassName(e.target.value); setShowClassList(true) }}
        onFocus={() => setShowClassList(true)}
        placeholder="Search or type a class..."
        style={inputStyle}
      />
      {showClassList && (
        <div style={listStyle}>
          {filteredClasses.map(c => (
            <div key={c.index} style={listItemStyle} onClick={() => { setClassName(c.name); setClassSearch(''); setShowClassList(false) }}>
              {c.name}
            </div>
          ))}
          {classSearch && !filteredClasses.find(c => c.name.toLowerCase() === classSearch.toLowerCase()) && (
            <div style={{ ...listItemStyle, color: '#aaa' }} onClick={() => { setClassName(classSearch); setShowClassList(false) }}>
              Use "{classSearch}" (custom)
            </div>
          )}
        </div>
      )}

      <label>Background</label>
      <input
        value={backgroundSearch || background}
        onChange={e => { setBackgroundSearch(e.target.value); setBackground(e.target.value); setShowBackgroundList(true) }}
        onFocus={() => setShowBackgroundList(true)}
        placeholder="Search or type a background..."
        style={inputStyle}
      />
      {showBackgroundList && (
        <div style={listStyle}>
          {filteredBackgrounds.map(b => (
            <div key={b.index} style={listItemStyle} onClick={() => { setBackground(b.name); setBackgroundSearch(''); setShowBackgroundList(false) }}>
              {b.name}
            </div>
          ))}
          {backgroundSearch && !filteredBackgrounds.find(b => b.name.toLowerCase() === backgroundSearch.toLowerCase()) && (
            <div style={{ ...listItemStyle, color: '#aaa' }} onClick={() => { setBackground(backgroundSearch); setShowBackgroundList(false) }}>
              Use "{backgroundSearch}" (custom)
            </div>
          )}
        </div>
      )}

      <label>Alignment</label>
      <select
        value={alignment}
        onChange={e => setAlignment(e.target.value)}
        style={{ ...inputStyle, marginBottom: '1rem' }}
      >
        <option value="">Select alignment...</option>
        {alignments.map(a => <option key={a} value={a}>{a}</option>)}
      </select>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <button onClick={createCharacter} disabled={loading} style={{ marginRight: '1rem' }}>
        {loading ? 'Creating...' : 'Create Character'}
      </button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  )
}

export default CreateCharacter
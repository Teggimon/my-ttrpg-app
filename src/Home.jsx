import { useState, useEffect } from 'react'
import { Octokit } from '@octokit/rest'

function Home({ token, user, isGM, onCreateCharacter, onSelectCharacter }) {
  const [characters, setCharacters] = useState([])
  const [loading, setLoading] = useState(true)

  const octokit = new Octokit({ auth: token })
  const repoName = localStorage.getItem('character_repo')

  useEffect(() => {
    loadCharacters()
  }, [])

  const loadCharacters = async () => {
    setLoading(true)
    try {
      const { data } = await octokit.repos.getContent({
        owner: user.login,
        repo: repoName,
        path: 'characters',
      })

      const characterFiles = await Promise.all(
        data
          .filter(f => f.name.endsWith('.json'))
          .map(async f => {
            const { data: fileData } = await octokit.repos.getContent({
              owner: user.login,
              repo: repoName,
              path: f.path,
            })
            const content = JSON.parse(atob(fileData.content))
            return content
          })
      )

      setCharacters(characterFiles)
    } catch (err) {
      // characters folder doesn't exist yet — that's fine
      setCharacters([])
    }
    setLoading(false)
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>⚔️ TTRPG Sheet</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <img src={user.avatar_url} width={32} style={{ borderRadius: '50%' }} />
          <span>{user.login}</span>
        </div>
      </div>

      <h2>My Characters</h2>

      {loading ? (
        <p>Loading characters...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
          {characters.map(char => (
            <div
              key={char.meta.characterId}
              onClick={() => onSelectCharacter(char)}
              style={{
                border: '1px solid #444',
                borderRadius: '8px',
                padding: '1rem',
                cursor: 'pointer',
                background: '#1a1a2e',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚔️</div>
              <strong>{char.identity.name}</strong>
              <div style={{ fontSize: '0.85rem', color: '#aaa' }}>
                {char.identity.race} · {char.identity.class[0].name} {char.identity.class[0].level}
              </div>
              <div style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                HP {char.combat.hpCurrent}/{char.combat.hpMax} · AC {char.combat.ac}
              </div>
            </div>
          ))}

          <div
            onClick={onCreateCharacter}
            style={{
              border: '2px dashed #444',
              borderRadius: '8px',
              padding: '1rem',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '120px',
              color: '#aaa',
            }}
          >
            <div style={{ fontSize: '2rem' }}>+</div>
            <div>New Character</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Home
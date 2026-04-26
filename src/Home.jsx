import { useState, useEffect } from 'react'
import { Octokit } from '@octokit/rest'

function Home({ token, user, isGM, onCreateCharacter, onSelectCharacter }) {
  const [characters, setCharacters] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(null)

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
            return { ...content, _fileName: f.name }
          })
      )

      setCharacters(characterFiles)
    } catch (err) {
      setCharacters([])
    }
    setLoading(false)
  }

  const deleteCharacter = async (char) => {
    try {
      const { data: fileData } = await octokit.repos.getContent({
        owner: user.login,
        repo: repoName,
        path: `characters/${char._fileName}`,
      })

      await octokit.repos.deleteFile({
        owner: user.login,
        repo: repoName,
        path: `characters/${char._fileName}`,
        message: `Delete character: ${char.identity.name}`,
        sha: fileData.sha,
      })

      setCharacters(prev => prev.filter(c => c.meta.characterId !== char.meta.characterId))
      setConfirmDelete(null)
    } catch (err) {
      alert('Failed to delete character.')
    }
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

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div style={{ background: '#1a1a2e', padding: '2rem', borderRadius: '8px', maxWidth: '320px', textAlign: 'center' }}>
            <h3>Delete {confirmDelete.identity.name}?</h3>
            <p style={{ color: '#aaa', fontSize: '0.9rem' }}>This will permanently delete the character file from your GitHub repo.</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
              <button
                onClick={() => deleteCharacter(confirmDelete)}
                style={{ background: '#8b0000', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{ background: '#333', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p>Loading characters...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
          {characters.map(char => (
            <div
              key={char.meta.characterId}
              style={{
                border: '1px solid #444',
                borderRadius: '8px',
                padding: '1rem',
                background: '#1a1a2e',
                position: 'relative',
              }}
            >
              <div
                onClick={() => onSelectCharacter(char)}
                style={{ cursor: 'pointer' }}
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
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(char) }}
                style={{
                  position: 'absolute', top: '0.5rem', right: '0.5rem',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#666', fontSize: '1rem'
                }}
              >
                🗑️
              </button>
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
import { useState, useEffect } from 'react'
import { Octokit } from '@octokit/rest'
import './Home.css'

function hpPercent(char) {
  if (!char.combat?.hpMax) return 0
  return Math.min(100, Math.round((char.combat.hpCurrent / char.combat.hpMax) * 100))
}

function hpColour(pct) {
  if (pct > 50) return 'var(--hp-high)'
  if (pct > 25) return 'var(--hp-mid)'
  return 'var(--hp-low)'
}

// ─── Character Card ───────────────────────────────────────────────────────────

function CharCard({ char, onClick, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const pct = hpPercent(char)
  const cls = char.identity.class?.[0]
  const subtitle = [char.identity.race, cls ? `${cls.name} ${cls.level}` : ''].filter(Boolean).join(' · ')

  return (
    <div className="char-card" onClick={onClick}>
      {/* Portrait area */}
      <div className="char-card-portrait">
        {char.identity.portrait
          ? <img src={char.identity.portrait} alt={char.identity.name} className="char-card-img" />
          : <span className="char-card-placeholder">⚔️</span>
        }
      </div>

      {/* Info */}
      <div className="char-card-body">
        <div className="char-card-name">{char.identity.name}</div>
        <div className="char-card-sub">{subtitle}</div>

        {/* HP bar */}
        <div className="char-card-hp-row">
          <span className="char-card-hp-val" style={{ fontFamily: 'var(--font-mono)' }}>
            {char.combat.hpCurrent}/{char.combat.hpMax}
          </span>
          <span className="char-card-ac">AC {char.combat.ac}</span>
        </div>
        <div className="char-card-hp-track">
          <div className="char-card-hp-fill" style={{ width: `${pct}%`, background: hpColour(pct) }} />
        </div>

        {/* Conditions */}
        {char.combat?.conditions?.length > 0 && (
          <div className="char-card-conditions">
            {char.combat.conditions.slice(0, 2).map(c => (
              <span key={c} className="condition-pill">{c}</span>
            ))}
            {char.combat.conditions.length > 2 && (
              <span className="condition-pill">+{char.combat.conditions.length - 2}</span>
            )}
          </div>
        )}
      </div>

      {/* Context menu button */}
      <button
        className="char-card-menu-btn"
        onClick={e => { e.stopPropagation(); setMenuOpen(o => !o) }}
        aria-label="Character options"
      >⋮</button>

      {menuOpen && (
        <div className="char-card-menu" onClick={e => e.stopPropagation()}>
          <button className="char-menu-item" onClick={() => { setMenuOpen(false); onClick() }}>
            ✏️ Edit Character
          </button>
          <button className="char-menu-item danger" onClick={() => { setMenuOpen(false); onDelete(char) }}>
            🗑️ Delete
          </button>
        </div>
      )}
    </div>
  )
}

// ─── New Character Card ───────────────────────────────────────────────────────

function NewCharCard({ onClick }) {
  return (
    <div className="char-card char-card--new" onClick={onClick}>
      <div className="char-card-new-inner">
        <span className="char-card-new-icon">+</span>
        <span className="char-card-new-label">New Character</span>
      </div>
    </div>
  )
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────

function ConfirmDelete({ char, onConfirm, onCancel, loading }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <p className="modal-title">Delete {char.identity.name}?</p>
        <p className="modal-body">
          This removes the character from your repo. This cannot be undone.
        </p>
        <div className="modal-actions">
          <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn--danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── GM Strip (home page preview) ────────────────────────────────────────────

function GMStrip({ onOpen }) {
  return (
    <div className="gm-strip" onClick={onOpen}>
      <div className="gm-strip-left">
        <span className="gm-strip-icon">⚔️</span>
        <div>
          <div className="gm-strip-title">Party Dashboard</div>
          <div className="gm-strip-sub">Track your party live · GM mode</div>
        </div>
      </div>
      <span className="gm-strip-arrow">→</span>
    </div>
  )
}

// ─── Main Home ────────────────────────────────────────────────────────────────

export default function Home({ token, user, isGM, onCreateCharacter, onSelectCharacter, onOpenGMDashboard }) {
  const [characters, setCharacters] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [gmMode, setGmMode] = useState(isGM)

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
      const files = await Promise.all(
        data
          .filter(f => f.name.endsWith('.json'))
          .map(async f => {
            const { data: fd } = await octokit.repos.getContent({
              owner: user.login,
              repo: repoName,
              path: f.path,
            })
            return { ...JSON.parse(atob(fd.content)), _fileName: f.name }
          })
      )
      setCharacters(files)
    } catch {
      setCharacters([])
    }
    setLoading(false)
  }

  const deleteCharacter = async () => {
    if (!confirmDelete) return
    setDeleteLoading(true)
    try {
      const { data: fd } = await octokit.repos.getContent({
        owner: user.login,
        repo: repoName,
        path: `characters/${confirmDelete._fileName}`,
      })
      await octokit.repos.deleteFile({
        owner: user.login,
        repo: repoName,
        path: `characters/${confirmDelete._fileName}`,
        message: `Delete character: ${confirmDelete.identity.name}`,
        sha: fd.sha,
      })
      setCharacters(prev => prev.filter(c => c.meta.characterId !== confirmDelete.meta.characterId))
      setConfirmDelete(null)
    } catch {
      alert('Failed to delete character.')
    }
    setDeleteLoading(false)
  }

  const toggleGM = () => {
    const next = !gmMode
    setGmMode(next)
    localStorage.setItem('is_gm', next)
  }

  return (
    <div className="home">
      {/* ── Header ── */}
      <header className="home-header">
        <div className="home-header-left">
          <span className="home-logo">⚔️</span>
          <span className="home-title">TTRPG Sheet</span>
        </div>
        <div className="home-header-right">
          <div className="gm-toggle-wrap">
            <span className="gm-toggle-label">GM</span>
            <button
              className={`gm-toggle ${gmMode ? 'gm-toggle--on' : ''}`}
              onClick={toggleGM}
              aria-label="Toggle GM mode"
            >
              <span className="gm-toggle-knob" />
            </button>
          </div>
          <div className="home-avatar">
            {user.avatar_url
              ? <img src={user.avatar_url} alt={user.login} className="avatar-img" />
              : <span>{user.login[0].toUpperCase()}</span>
            }
          </div>
        </div>
      </header>

      {/* ── GM Dashboard strip ── */}
      {gmMode && (
        <div className="home-section">
          <GMStrip onOpen={onOpenGMDashboard} />
        </div>
      )}

      {/* ── My Characters ── */}
      <div className="home-section">
        <h2 className="home-section-title">My Characters</h2>

        {loading ? (
          <div className="home-loading">
            <div className="home-loading-spinner" />
            <span>Loading characters…</span>
          </div>
        ) : (
          <div className="char-grid">
            {characters.map(char => (
              <CharCard
                key={char.meta.characterId}
                char={char}
                onClick={() => onSelectCharacter(char)}
                onDelete={setConfirmDelete}
              />
            ))}
            <NewCharCard onClick={onCreateCharacter} />
          </div>
        )}
      </div>

      {/* ── Delete confirm ── */}
      {confirmDelete && (
        <ConfirmDelete
          char={confirmDelete}
          onConfirm={deleteCharacter}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  )
}

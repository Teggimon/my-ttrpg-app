import { useState, useEffect } from 'react'
import { Octokit } from '@octokit/rest'
import './Home.css'

// ── Helpers ─────────────────────────────────────────────────

function hpPercent(char) {
  if (!char.combat?.hpMax) return 0
  return Math.min(100, Math.round((char.combat.hpCurrent / char.combat.hpMax) * 100))
}

function hpAccentColour(pct) {
  if (pct <= 0)  return 'var(--text-muted)'   // dead / zero
  if (pct < 25)  return 'var(--hp-low)'
  if (pct < 50)  return 'var(--hp-mid)'
  return 'var(--hp-high)'
}

function classLine(char) {
  return (char.identity?.class ?? []).map(c => `${c.name} ${c.level}`).join(' / ')
}

// ── Character Card ───────────────────────────────────────────

function CharCard({ char, onClick, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const pct    = hpPercent(char)
  const accent = hpAccentColour(pct)

  useEffect(() => {
    if (!menuOpen) return
    const close = () => setMenuOpen(false)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [menuOpen])

  return (
    <div className="char-card" onClick={onClick} style={{ '--card-accent': accent }}>

      {/* Top accent line (HP colour) */}
      <div className="char-card-accent-line" />

      {/* Portrait area — top 55% of 3:4 card */}
      <div className="char-card-portrait">
        {char.identity?.portrait
          ? <img src={char.identity.portrait} alt={char.identity.name} className="char-card-img" />
          : <span className="char-card-placeholder">⚔️</span>
        }
      </div>

      {/* Text body */}
      <div className="char-card-body">
        <div className="char-card-name">{char.identity.name}</div>
        <div className="char-card-sub">
          {char.identity.race} · {classLine(char)}
        </div>

        <div className="char-card-stats-row">
          <span className="char-card-hp">
            <span className="char-card-hp-cur">{char.combat.hpCurrent}</span>
            <span className="char-card-hp-sep"> / </span>
            <span className="char-card-hp-max">{char.combat.hpMax} HP</span>
          </span>
          <span className="char-card-level-badge">
            Lv {(char.identity?.class ?? []).reduce((s, c) => s + (c.level ?? 0), 0) || '—'}
          </span>
        </div>

        {/* HP bar */}
        <div className="char-card-hp-track">
          <div
            className="char-card-hp-fill"
            style={{ width: `${pct}%`, background: accent }}
          />
        </div>

        {char.identity?.owner && (
          <div className="char-card-owner">@{char._username || char.meta?.owner?.replace('github:', '')}</div>
        )}
      </div>

      {/* Context menu trigger */}
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
          <button
            className="char-menu-item char-menu-item--danger"
            onClick={() => { setMenuOpen(false); onDelete(char) }}
          >
            🗑️ Delete
          </button>
        </div>
      )}
    </div>
  )
}

// ── New Character Card ───────────────────────────────────────

function NewCharCard({ onClick }) {
  return (
    <div className="char-card char-card--new" onClick={onClick}>
      <div className="char-card-new-inner">
        <span className="char-card-new-plus">+</span>
        <span className="char-card-new-label">New Character</span>
        <span className="char-card-new-hint">Start from scratch or use a template</span>
      </div>
    </div>
  )
}

// ── Delete Confirm ───────────────────────────────────────────

function ConfirmDelete({ char, onConfirm, onCancel, loading }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <p className="modal-title">Delete {char.identity.name}?</p>
        <p className="modal-body">
          This permanently removes the character from your GitHub repo.
        </p>
        <div className="modal-actions">
          <button className="home-btn home-btn--ghost" onClick={onCancel}>Cancel</button>
          <button className="home-btn home-btn--danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Home ────────────────────────────────────────────────

export default function Home({
  token, user,
  isGM: isGMProp,
  onCreateCharacter,
  onSelectCharacter,
  onOpenGMDashboard,
  onLogout,
}) {
  const [characters, setCharacters]     = useState([])
  const [loading, setLoading]           = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [gmMode, setGmMode]             = useState(isGMProp)

  const octokit  = new Octokit({ auth: token })
  const repoName = localStorage.getItem('character_repo')

  useEffect(() => { loadCharacters() }, [])

  const loadCharacters = async () => {
    setLoading(true)
    try {
      const { data: files } = await octokit.repos.getContent({
        owner: user.login, repo: repoName, path: 'characters',
      })
      const loaded = await Promise.all(
        files
          .filter(f => f.name.endsWith('.json'))
          .map(async f => {
            const { data: fd } = await octokit.repos.getContent({
              owner: user.login, repo: repoName, path: f.path,
            })
            return {
              ...JSON.parse(atob(fd.content.replace(/\s/g, ''))),
              _fileName: f.name,
            }
          })
      )
      setCharacters(loaded)
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
        owner: user.login, repo: repoName,
        path: `characters/${confirmDelete._fileName}`,
      })
      await octokit.repos.deleteFile({
        owner: user.login, repo: repoName,
        path: `characters/${confirmDelete._fileName}`,
        message: `Delete character: ${confirmDelete.identity.name}`,
        sha: fd.sha,
      })
      setCharacters(prev =>
        prev.filter(c => c.meta?.characterId !== confirmDelete.meta?.characterId)
      )
      setConfirmDelete(null)
    } catch {
      alert('Failed to delete character.')
    }
    setDeleteLoading(false)
  }

  const toggleGM = () => {
    const next = !gmMode
    setGmMode(next)
    localStorage.setItem('is_gm', String(next))
    if (next) onOpenGMDashboard()
  }

  return (
    <div className="home">

      {/* ── Header ── */}
      <header className="home-header">
        {/* Logo + wordmark */}
        <div className="home-logo-wrap">
          <div className={`home-logo-icon${gmMode ? ' home-logo-icon--dm' : ''}`}>
            {gmMode ? '📖' : '⚔️'}
          </div>
          <div>
            <div className="home-wordmark">TTRPG Sheet</div>
            <div className="home-tagline">{gmMode ? 'Dungeon Master' : 'Character Manager'}</div>
          </div>
        </div>

        {/* Player / DM pill toggle */}
        <div className="mode-toggle">
          <button
            className={`mode-btn${!gmMode ? ' mode-btn--active' : ''}`}
            onClick={() => { setGmMode(false); localStorage.setItem('is_gm', 'false') }}
          >
            ⚔️ Player
          </button>
          <button
            className={`mode-btn mode-btn--dm${gmMode ? ' mode-btn--active mode-btn--dm-active' : ''}`}
            onClick={() => { setGmMode(true); localStorage.setItem('is_gm', 'true') }}
          >
            📖 DM
          </button>
        </div>

        {/* User */}
        <div className="home-user">
          <div className="home-user-info">
            <span className="home-user-name">{user.login}</span>
            <span className="home-user-handle">@{user.login}</span>
          </div>
          {user.avatar_url
            ? <img src={user.avatar_url} alt={user.login} className="home-avatar" onClick={onLogout} title="Log out" />
            : <div className="home-avatar home-avatar--initial" onClick={onLogout}>{user.login[0].toUpperCase()}</div>
          }
        </div>
      </header>

      {/* ── DM mode banner ── */}
      {gmMode && (
        <div className="dm-banner">
          <span className="dm-banner-icon">📖</span>
          You're in DM mode. Your characters are safe — switch back to Player mode anytime.
        </div>
      )}

      {/* ── Scrollable content ── */}
      <div className="home-scroll">

        {/* ── GM: Party Dashboard button ── */}
        {gmMode && (
          <section className="home-section">
            <div className="gm-campaigns-header">
              <h2 className="home-section-title">Party Dashboard</h2>
              <button className="section-action-btn" onClick={onOpenGMDashboard}>Open →</button>
            </div>
            <div className="gm-strip" onClick={onOpenGMDashboard}>
              <span className="gm-strip-emoji">⚔️</span>
              <div>
                <div className="gm-strip-title">Open Party Dashboard</div>
                <div className="gm-strip-sub">Track HP, conditions and stats for all your players live</div>
              </div>
              <span className="gm-strip-arrow">→</span>
            </div>
          </section>
        )}

        {/* ── My Characters ── */}
        <section className="home-section">
          <div className="home-section-header">
            <h2 className="home-section-title">
              My Characters
              {!loading && <span className="home-section-count">{characters.length}</span>}
            </h2>
          </div>

          {loading ? (
            <div className="home-loading">
              <div className="home-spinner" />
              Loading characters…
            </div>
          ) : (
            <div className="char-grid">
              {characters.map(char => (
                <CharCard
                  key={char.meta?.characterId ?? char._fileName}
                  char={char}
                  onClick={() => onSelectCharacter(char)}
                  onDelete={setConfirmDelete}
                />
              ))}
              <NewCharCard onClick={onCreateCharacter} />
            </div>
          )}
        </section>

      </div>

      {/* ── Delete modal ── */}
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

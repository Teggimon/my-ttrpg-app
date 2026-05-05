import { useState, useEffect, useRef, useCallback } from 'react'
import {
  fetchPlayerCharacters,
  fetchSingleCharacter,
  hpPercent,
  hpColour,
  isWarning,
  initiativeMod,
  passivePerception,
  spellStats,
  classLine,
} from './gmUtils'
import './GMDashboard.css'

const POLL_MS = 30_000
const STORAGE_KEY = 'gm_party_v1'

function loadParty() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function saveParty(party) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(party))
}

function charKey(username, fileName) {
  return `${username}/${fileName}`
}

// ─── Add Player Modal ─────────────────────────────────────────────────────────

function AddPlayerModal({ onClose, onAdd }) {
  const [username, setUsername]   = useState('')
  const [chars, setChars]         = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  // selection: fileName → true (active) | false (inactive) | absent (not selected)
  const [selected, setSelected]   = useState({})

  const doFetch = async () => {
    const u = username.trim().toLowerCase()
    if (!u) return
    setLoading(true)
    setError(null)
    setChars(null)
    setSelected({})
    try {
      const results = await fetchPlayerCharacters(u)
      setChars(results)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const toggleChar = (fileName) => {
    setSelected(prev => {
      const cur = prev[fileName]
      if (cur === undefined) return { ...prev, [fileName]: true }   // tap 1 → active
      if (cur === true)      return { ...prev, [fileName]: false }  // tap 2 → inactive
      const next = { ...prev }; delete next[fileName]; return next  // tap 3 → remove
    })
  }

  const confirm = () => {
    const entries = Object.entries(selected).map(([fileName, active]) => ({
      username: username.trim().toLowerCase(),
      fileName,
      active,
    }))
    if (entries.length) onAdd(entries)
    onClose()
  }

  const selectedCount = Object.keys(selected).length

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet add-player-sheet" onClick={e => e.stopPropagation()}>

        {/* Handle bar */}
        <div className="modal-handle" />

        <div className="modal-header">
          <span className="modal-title-text">Add Player</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Username row */}
        <div className="add-player-input-row">
          <input
            className="input"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doFetch()}
            placeholder="GitHub username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <button
            className="btn btn--accent"
            onClick={doFetch}
            disabled={!username.trim() || loading}
          >
            {loading ? '…' : 'Fetch →'}
          </button>
        </div>

        {error && <p className="add-player-error">{error}</p>}

        {/* Character list */}
        {chars && (
          <>
            <p className="add-player-hint">
              Tap once to add as Active · twice for Inactive · three times to remove
            </p>
            <div className="add-player-char-list">
              {chars.map(char => {
                const state = selected[char._fileName]
                const added = state !== undefined
                const active = state === true
                return (
                  <div
                    key={char._fileName}
                    className={`add-player-char-row ${added ? 'add-player-char-row--selected' : ''}`}
                    onClick={() => toggleChar(char._fileName)}
                  >
                    <div className="add-player-char-info">
                      <span className="add-player-char-name">{char.identity.name}</span>
                      <span className="add-player-char-sub">
                        {char.identity.race} · {classLine(char)}
                      </span>
                    </div>
                    {added && (
                      <span className={`status-badge ${active ? 'status-badge--active' : 'status-badge--inactive'}`}>
                        {active ? '● Active' : '○ Inactive'}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="modal-actions">
              <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
              <button
                className="btn btn--accent"
                onClick={confirm}
                disabled={selectedCount === 0}
              >
                Add {selectedCount > 0 ? `${selectedCount} character${selectedCount > 1 ? 's' : ''}` : ''}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Stat Tile ────────────────────────────────────────────────────────────────

function StatTile({ label, value }) {
  return (
    <div className="stat-tile">
      <span className="stat-tile-val">{value}</span>
      <span className="stat-tile-lbl">{label}</span>
    </div>
  )
}

// ─── Party Card ───────────────────────────────────────────────────────────────

function PartyCard({ entry, char, onRemove, onToggleActive, onView }) {
  // Loading skeleton
  if (!char) {
    return (
      <div className="party-card party-card--loading">
        <div className="party-card-skeleton-name" />
        <div className="party-card-skeleton-bar" />
      </div>
    )
  }

  const pct   = hpPercent(char)
  const warn  = isWarning(char)
  const spell = spellStats(char)
  const hp    = char.combat.hpCurrent
  const hpMax = char.combat.hpMax
  const hasConditions = (char.combat?.conditions?.length ?? 0) > 0

  return (
    <div
      className={[
        'party-card',
        warn              ? 'party-card--warn'     : '',
        !entry.active     ? 'party-card--inactive' : '',
      ].join(' ')}
      onClick={onView}
    >
      {/* Remove button */}
      <button
        className="party-card-remove"
        onClick={e => { e.stopPropagation(); onRemove() }}
        aria-label="Remove character"
      >✕</button>

      {/* ── Header row ── */}
      <div className="party-card-header">
        <div className="party-card-header-left">
          <span className="party-card-name">{char.identity.name}</span>
          <span className="party-card-sub">
            {char.identity.race} · {classLine(char)}
          </span>
        </div>
        <div className="party-card-header-right">
          {warn && <span className="party-card-warn-icon" title="Low HP or conditions active">⚠️</span>}
          <span className="party-card-username">@{entry.username}</span>
        </div>
      </div>

      {/* ── Active/Inactive toggle ── */}
      <button
        className={`status-badge status-badge--btn ${entry.active ? 'status-badge--active' : 'status-badge--inactive'}`}
        onClick={e => { e.stopPropagation(); onToggleActive() }}
      >
        {entry.active ? '● Active' : '○ Inactive'}
      </button>

      {/* ── HP bar ── */}
      <div className="party-card-hp-row">
        <span className="party-card-hp-label">HP</span>
        <div className="party-card-hp-track">
          <div
            className="party-card-hp-fill"
            style={{ width: `${pct}%`, background: hpColour(pct) }}
          />
        </div>
        <span className="party-card-hp-val">{hp} / {hpMax}</span>
      </div>

      {/* ── Stat tiles ── */}
      <div className="party-card-stats">
        <StatTile label="AC"   value={char.combat.ac} />
        <StatTile label="Init" value={initiativeMod(char)} />
        <StatTile label="Perc" value={passivePerception(char)} />
        {spell && <>
          <StatTile label="DC"  value={spell.dc} />
          <StatTile label="Atk" value={spell.atk} />
        </>}
      </div>

      {/* ── Conditions ── */}
      {hasConditions && (
        <div className="party-card-conditions">
          {char.combat.conditions.map(c => (
            <span key={c} className="condition-pill">{c}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function GMDashboard({ onBack, onViewCharacter }) {
  const [party, setParty]       = useState(loadParty)
  const [chars, setChars]       = useState({})
  const [showModal, setShowModal] = useState(false)
  const [lastPoll, setLastPoll] = useState(null)
  const [polling, setPolling]   = useState(false)
  const pollRef = useRef(null)

  // Poll all party members
  const pollAll = useCallback(async (currentParty) => {
    if (currentParty.length === 0) return
    setPolling(true)
    const results = await Promise.allSettled(
      currentParty.map(e => fetchSingleCharacter(e.username, e.fileName))
    )
    setChars(prev => {
      const next = { ...prev }
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          next[charKey(currentParty[i].username, currentParty[i].fileName)] = r.value
        }
      })
      return next
    })
    setLastPoll(new Date())
    setPolling(false)
  }, [])

  // Re-run poll + interval whenever party changes
  useEffect(() => {
    pollAll(party)
    clearInterval(pollRef.current)
    pollRef.current = setInterval(() => pollAll(party), POLL_MS)
    return () => clearInterval(pollRef.current)
  }, [party, pollAll])

  const addEntries = (entries) => {
    setParty(prev => {
      const existing = new Set(prev.map(e => charKey(e.username, e.fileName)))
      const fresh = entries.filter(e => !existing.has(charKey(e.username, e.fileName)))
      const next = [...prev, ...fresh]
      saveParty(next)
      return next
    })
  }

  const removeEntry = (username, fileName) => {
    setParty(prev => {
      const next = prev.filter(e => !(e.username === username && e.fileName === fileName))
      saveParty(next)
      return next
    })
    setChars(prev => {
      const next = { ...prev }
      delete next[charKey(username, fileName)]
      return next
    })
  }

  const toggleActive = (username, fileName) => {
    setParty(prev => {
      const next = prev.map(e =>
        e.username === username && e.fileName === fileName
          ? { ...e, active: !e.active }
          : e
      )
      saveParty(next)
      return next
    })
  }

  const activeCount = party.filter(e => e.active).length
  const warnCount   = party.filter(e => {
    const c = chars[charKey(e.username, e.fileName)]
    return c && isWarning(c)
  }).length

  const syncLabel = polling
    ? '⟳ Syncing…'
    : lastPoll
      ? `✓ Updated ${lastPoll.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : ''

  return (
    <div className="gm-dash">

      {/* ── Header ── */}
      <header className="gm-dash-header">
        <button className="gm-dash-back" onClick={onBack}>←</button>
        <div className="gm-dash-header-center">
          <span className="gm-dash-title">Party Dashboard</span>
          <span className="gm-dash-meta">
            {activeCount} active · {party.length} total
            {warnCount > 0 && <span className="gm-dash-warn-count"> · ⚠️ {warnCount}</span>}
          </span>
        </div>
        <button className="btn btn--accent gm-dash-add-btn" onClick={() => setShowModal(true)}>
          + Add Player
        </button>
      </header>

      {/* ── Sync indicator ── */}
      {syncLabel && (
        <div className="gm-dash-sync">{syncLabel}</div>
      )}

      {/* ── Empty state ── */}
      {party.length === 0 && !showModal && (
        <div className="gm-dash-empty">
          <span className="gm-dash-empty-icon">⚔️</span>
          <p className="gm-dash-empty-title">No players yet</p>
          <p className="gm-dash-empty-sub">
            Tap <strong>+ Add Player</strong> and enter a player's GitHub username.<br />
            The app will find their characters automatically.
          </p>
          <button className="btn btn--accent" onClick={() => setShowModal(true)}>
            + Add Player
          </button>
        </div>
      )}

      {/* ── Party cards ── */}
      <div className="gm-dash-cards">
        {party.map(entry => (
          <PartyCard
            key={charKey(entry.username, entry.fileName)}
            entry={entry}
            char={chars[charKey(entry.username, entry.fileName)]}
            onRemove={() => removeEntry(entry.username, entry.fileName)}
            onToggleActive={() => toggleActive(entry.username, entry.fileName)}
            onView={() => {
              const c = chars[charKey(entry.username, entry.fileName)]
              if (c && onViewCharacter) onViewCharacter(c)
            }}
          />
        ))}
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <AddPlayerModal
          onClose={() => setShowModal(false)}
          onAdd={addEntries}
        />
      )}
    </div>
  )
}

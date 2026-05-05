import { useState, useEffect, useRef, useCallback } from 'react'
import {
  fetchPlayerCharacters, fetchSingleCharacter,
  hpPercent, hpColour, isWarning,
  initiativeMod, passivePerception, spellStats, classLine,
} from './gmUtils'
import './GMDashboard.css'

const POLL_MS    = 30_000
const STORAGE_KEY = 'gm_party_v1'

function loadParty()     { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] } }
function saveParty(p)    { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)) }
function charKey(u, f)   { return `${u}/${f}` }

// ── Add Player Modal ────────────────────────────────────────

function AddPlayerModal({ onClose, onAdd }) {
  const [username, setUsername] = useState('')
  const [chars, setChars]       = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [selected, setSelected] = useState({})

  const doFetch = async () => {
    const u = username.trim().toLowerCase()
    if (!u) return
    setLoading(true); setError(null); setChars(null); setSelected({})
    try { setChars(await fetchPlayerCharacters(u)) }
    catch (e) { setError(e.message) }
    setLoading(false)
  }

  const toggle = (fileName) => {
    setSelected(prev => {
      const cur = prev[fileName]
      if (cur === undefined) return { ...prev, [fileName]: true }
      if (cur === true)      return { ...prev, [fileName]: false }
      const n = { ...prev }; delete n[fileName]; return n
    })
  }

  const confirm = () => {
    const entries = Object.entries(selected).map(([fileName, active]) => ({
      username: username.trim().toLowerCase(), fileName, active,
    }))
    if (entries.length) onAdd(entries)
    onClose()
  }

  const count = Object.keys(selected).length

  return (
    <div className="gm-modal-overlay" onClick={onClose}>
      <div className="gm-modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="gm-modal-handle" />
        <div className="gm-modal-header">
          <span className="gm-modal-title">Add Player</span>
          <button className="gm-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="gm-input-row">
          <input
            className="gm-input"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doFetch()}
            placeholder="GitHub username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <button className="gm-btn gm-btn--accent" onClick={doFetch} disabled={!username.trim() || loading}>
            {loading ? '…' : 'Fetch →'}
          </button>
        </div>

        {error && <p className="gm-error">{error}</p>}

        {chars && (
          <>
            <p className="gm-hint">Tap once → Active · twice → Inactive · three times → remove</p>
            <div className="gm-char-list">
              {chars.map(char => {
                const state  = selected[char._fileName]
                const added  = state !== undefined
                const active = state === true
                return (
                  <div
                    key={char._fileName}
                    className={`gm-char-row${added ? ' gm-char-row--selected' : ''}`}
                    onClick={() => toggle(char._fileName)}
                  >
                    <div>
                      <div className="gm-char-name">{char.identity.name}</div>
                      <div className="gm-char-sub">{char.identity.race} · {classLine(char)}</div>
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
            <div className="gm-modal-actions">
              <button className="gm-btn gm-btn--ghost" onClick={onClose}>Cancel</button>
              <button className="gm-btn gm-btn--accent" onClick={confirm} disabled={count === 0}>
                Add {count > 0 ? `${count} character${count > 1 ? 's' : ''}` : ''}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Stat Tile ───────────────────────────────────────────────

function StatTile({ label, value }) {
  return (
    <div className="stat-tile">
      <span className="stat-tile-val">{value}</span>
      <span className="stat-tile-lbl">{label}</span>
    </div>
  )
}

// ── Party Card ──────────────────────────────────────────────

function PartyCard({ entry, char, onRemove, onToggleActive, onView }) {
  if (!char) return (
    <div className="party-card party-card--loading">
      <div className="party-skeleton-name" />
      <div className="party-skeleton-bar" />
    </div>
  )

  const pct   = hpPercent(char)
  const warn  = isWarning(char)
  const spell = spellStats(char)
  const hasConds = (char.combat?.conditions?.length ?? 0) > 0

  return (
    <div
      className={`party-card${warn ? ' party-card--warn' : ''}${!entry.active ? ' party-card--inactive' : ''}`}
      onClick={onView}
    >
      <button className="party-card-remove" onClick={e => { e.stopPropagation(); onRemove() }} aria-label="Remove">✕</button>

      {/* Header */}
      <div className="party-card-hd">
        <div className="party-card-hd-left">
          <span className="party-card-name">{char.identity.name}</span>
          <span className="party-card-sub">{char.identity.race} · {classLine(char)}</span>
        </div>
        <div className="party-card-hd-right">
          {warn && <span className="party-warn-icon" title="Needs attention">⚠️</span>}
          <span className="party-username">@{entry.username}</span>
        </div>
      </div>

      {/* Active badge */}
      <button
        className={`status-badge status-badge--btn ${entry.active ? 'status-badge--active' : 'status-badge--inactive'}`}
        onClick={e => { e.stopPropagation(); onToggleActive() }}
      >
        {entry.active ? '● Active' : '○ Inactive'}
      </button>

      {/* HP bar */}
      <div className="party-hp-row">
        <span className="party-hp-lbl">HP</span>
        <div className="party-hp-track">
          <div className="party-hp-fill" style={{ width: `${pct}%`, background: hpColour(pct) }} />
        </div>
        <span className="party-hp-val">{char.combat.hpCurrent} / {char.combat.hpMax}</span>
      </div>

      {/* Stat tiles */}
      <div className="party-stats">
        <StatTile label="AC"   value={char.combat.ac} />
        <StatTile label="Init" value={initiativeMod(char)} />
        <StatTile label="Perc" value={passivePerception(char)} />
        {spell && <>
          <StatTile label="DC"  value={spell.dc} />
          <StatTile label="Atk" value={spell.atk} />
        </>}
      </div>

      {/* Conditions */}
      {hasConds && (
        <div className="party-conditions">
          {char.combat.conditions.map(c => (
            <span key={c} className="condition-pill">{c}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Dashboard ──────────────────────────────────────────

export default function GMDashboard({ onBack, onViewCharacter }) {
  const [party, setParty]       = useState(loadParty)
  const [chars, setChars]       = useState({})
  const [showModal, setShowModal] = useState(false)
  const [lastPoll, setLastPoll] = useState(null)
  const [polling, setPolling]   = useState(false)
  const pollRef = useRef(null)

  const pollAll = useCallback(async (currentParty) => {
    if (!currentParty.length) return
    setPolling(true)
    const results = await Promise.allSettled(
      currentParty.map(e => fetchSingleCharacter(e.username, e.fileName))
    )
    setChars(prev => {
      const next = { ...prev }
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') next[charKey(currentParty[i].username, currentParty[i].fileName)] = r.value
      })
      return next
    })
    setLastPoll(new Date())
    setPolling(false)
  }, [])

  useEffect(() => {
    pollAll(party)
    clearInterval(pollRef.current)
    pollRef.current = setInterval(() => pollAll(party), POLL_MS)
    return () => clearInterval(pollRef.current)
  }, [party, pollAll])

  const addEntries = (entries) => {
    setParty(prev => {
      const existing = new Set(prev.map(e => charKey(e.username, e.fileName)))
      const next = [...prev, ...entries.filter(e => !existing.has(charKey(e.username, e.fileName)))]
      saveParty(next)
      return next
    })
  }

  const removeEntry = (username, fileName) => {
    setParty(prev => { const n = prev.filter(e => !(e.username === username && e.fileName === fileName)); saveParty(n); return n })
    setChars(prev => { const n = { ...prev }; delete n[charKey(username, fileName)]; return n })
  }

  const toggleActive = (username, fileName) => {
    setParty(prev => {
      const n = prev.map(e => e.username === username && e.fileName === fileName ? { ...e, active: !e.active } : e)
      saveParty(n); return n
    })
  }

  const activeCount = party.filter(e => e.active).length
  const warnCount   = party.filter(e => { const c = chars[charKey(e.username, e.fileName)]; return c && isWarning(c) }).length

  return (
    <div className="gm-dash">
      {/* Header */}
      <header className="gm-dash-header">
        <button className="gm-back" onClick={onBack}>←</button>
        <div className="gm-dash-hd-center">
          <span className="gm-dash-title">Party Dashboard</span>
          <span className="gm-dash-meta">
            {activeCount} active · {party.length} total
            {warnCount > 0 && <span className="gm-warn-count"> · ⚠️ {warnCount}</span>}
            {lastPoll && <span className="gm-sync"> · {polling ? '⟳' : '✓'} {lastPoll.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
          </span>
        </div>
        <button className="gm-btn gm-btn--accent gm-add-btn" onClick={() => setShowModal(true)}>
          + Add Player
        </button>
      </header>

      {/* Empty state */}
      {!party.length && (
        <div className="gm-empty">
          <span className="gm-empty-icon">⚔️</span>
          <p className="gm-empty-title">No players yet</p>
          <p className="gm-empty-sub">Ask your players for their GitHub username, then tap Add Player.</p>
          <button className="gm-btn gm-btn--accent" style={{ maxWidth: 200 }} onClick={() => setShowModal(true)}>+ Add Player</button>
        </div>
      )}

      {/* Cards */}
      <div className="gm-cards">
        {party.map(entry => (
          <PartyCard
            key={charKey(entry.username, entry.fileName)}
            entry={entry}
            char={chars[charKey(entry.username, entry.fileName)]}
            onRemove={() => removeEntry(entry.username, entry.fileName)}
            onToggleActive={() => toggleActive(entry.username, entry.fileName)}
            onView={() => { const c = chars[charKey(entry.username, entry.fileName)]; if (c && onViewCharacter) onViewCharacter(c) }}
          />
        ))}
      </div>

      {showModal && <AddPlayerModal onClose={() => setShowModal(false)} onAdd={addEntries} />}
    </div>
  )
}

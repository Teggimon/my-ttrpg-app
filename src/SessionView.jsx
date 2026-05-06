import { useState, useEffect, useRef, useCallback } from 'react'
import { Octokit } from '@octokit/rest'
import './SessionView.css'

const CAMPAIGNS_REPO = 'ttrpg-campaigns'

function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
function encode(obj) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj, null, 2))))
}
function decode(b64) {
  return JSON.parse(atob(b64.replace(/\s/g, '')))
}
function hpPct(cur, max) { return max ? Math.min(100, Math.round((cur / max) * 100)) : 0 }
function hpColor(pct) {
  if (pct <= 0) return 'var(--text-muted)'
  if (pct < 25) return 'var(--hp-low)'
  if (pct < 50) return 'var(--hp-mid)'
  return 'var(--hp-high)'
}
function formatClock(s) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}
function formatInGame(rounds) {
  const total = rounds * 6
  if (total < 60) return `${total}s`
  const m = Math.floor(total / 60)
  const s = total % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

// ── Character Reference Card ──────────────────────────────────
function CharRefCard({ char, isPresent, onTogglePresent }) {
  const pct   = hpPct(char.hpCurrent, char.hpMax)
  const color = hpColor(pct)

  return (
    <div className={`crc${!isPresent ? ' crc--absent' : ''}`}>
      {/* Attendance toggle */}
      <button
        className={`crc-attend-btn${isPresent ? ' crc-attend-btn--present' : ''}`}
        onClick={() => onTogglePresent(char.characterId)}
        title={isPresent ? 'Mark absent' : 'Mark present'}
      >
        {isPresent ? '✓' : '✕'}
      </button>

      {/* Header */}
      <div className="crc-header">
        <div className="crc-portrait">{char.portrait ? <img src={char.portrait} alt={char.name} /> : '⚔️'}</div>
        <div className="crc-header-info">
          <div className="crc-name">{char.name}</div>
          <div className="crc-sub">{char.race} · {char.class} · Lv {char.level}</div>
        </div>
      </div>

      {/* HP bar */}
      <div className="crc-hp-section">
        <div className="crc-hp-row">
          <span className="crc-hp-cur" style={{ color }}>{char.hpCurrent}</span>
          <span className="crc-hp-sep"> / </span>
          <span className="crc-hp-max">{char.hpMax} HP</span>
          {char.hpTemp > 0 && <span className="crc-hp-temp">+{char.hpTemp} temp</span>}
        </div>
        <div className="crc-hp-track">
          <div className="crc-hp-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>

      {/* Stat tiles */}
      <div className="crc-stat-grid">
        <div className="crc-stat">
          <div className="crc-stat-val">{char.initiative ?? '—'}</div>
          <div className="crc-stat-lbl">Initiative</div>
        </div>
        <div className="crc-stat">
          <div className="crc-stat-val">{char.ac ?? '—'}</div>
          <div className="crc-stat-lbl">AC</div>
        </div>
        <div className="crc-stat">
          <div className="crc-stat-val">{char.passivePerception ?? '—'}</div>
          <div className="crc-stat-lbl">Passive Perc</div>
        </div>
        <div className="crc-stat">
          <div className="crc-stat-val">{char.spellSaveDC ?? '—'}</div>
          <div className="crc-stat-lbl">Spell DC</div>
        </div>
      </div>

      {/* Secondary */}
      <div className="crc-secondary">
        {char.resistances && (
          <div className="crc-sec-row">
            <span className="crc-sec-label">Resistances</span>
            <span className="crc-sec-val">{char.resistances}</span>
          </div>
        )}
        {char.immunities && (
          <div className="crc-sec-row">
            <span className="crc-sec-label">Immunities</span>
            <span className="crc-sec-val">{char.immunities}</span>
          </div>
        )}
        {char.alignment && (
          <div className="crc-sec-row">
            <span className="crc-sec-label">Alignment</span>
            <span className="crc-sec-val">{char.alignment}</span>
          </div>
        )}
      </div>

      {/* Conditions */}
      {char.conditions?.length > 0 && (
        <div className="crc-conditions">
          {char.conditions.map(c => (
            <span key={c} className="crc-condition-pill">{c}</span>
          ))}
        </div>
      )}

      {/* DM note */}
      <textarea className="crc-note" placeholder="DM note for this session…" rows={2} />
    </div>
  )
}

// ── Encounter row ─────────────────────────────────────────────
function EncounterRow({ encounter, onOpen, isActive }) {
  return (
    <div className={`sv-enc-row${isActive ? ' sv-enc-row--live' : ''}`} onClick={() => onOpen(encounter)}>
      <div className="sv-enc-num">{encounter.number}</div>
      <div className="sv-enc-info">
        <div className="sv-enc-name">{encounter.name}</div>
        <div className="sv-enc-meta">
          {encounter.rounds ? `Round ${encounter.rounds} · ${formatInGame(encounter.rounds)}` : 'Not started'}
          {encounter.enemyCount ? ` · ${encounter.enemyCount} enemies` : ''}
        </div>
      </div>
      <div className={`sv-enc-status${isActive ? ' sv-enc-status--live' : encounter.outcome ? ' sv-enc-status--done' : ''}`}>
        {isActive
          ? '● Live'
          : encounter.outcome === 'victory'
            ? '⚔ Victory'
            : encounter.outcome === 'fled'
              ? '↩ Fled'
              : encounter.outcome === 'defeat'
                ? '💀 Defeat'
                : '—'
        }
      </div>
    </div>
  )
}

// ── Note section ──────────────────────────────────────────────
function SVNoteSection({ section, onChange }) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div className={`sv-note-section${collapsed ? ' sv-note-section--collapsed' : ''}`}>
      <div className="sv-note-head">
        <div className="sv-note-label">{section.title}</div>
        <button className="sv-note-chevron" onClick={() => setCollapsed(c => !c)}>
          {collapsed ? '▸' : '▾'}
        </button>
      </div>
      {!collapsed && (
        <textarea
          className="sv-note-textarea"
          value={section.content}
          onChange={e => onChange(section.id, e.target.value)}
          placeholder={`${section.title}…`}
          rows={4}
        />
      )}
    </div>
  )
}

// ── New Encounter Modal ───────────────────────────────────────
function NewEncounterModal({ encounterNumber, onCreate, onClose }) {
  const [name, setName] = useState(`Encounter ${encounterNumber}`)
  return (
    <div className="sv-modal-overlay" onClick={onClose}>
      <div className="sv-modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="sv-modal-handle" />
        <div className="sv-modal-title">New Encounter</div>
        <label className="sv-modal-label">Encounter name</label>
        <input
          className="sv-modal-input"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onCreate(name)}
          autoFocus
        />
        <div className="sv-modal-actions">
          <button className="sv-btn sv-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="sv-btn sv-btn--dm" onClick={() => onCreate(name)}>Create →</button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//  Main SessionView
// ════════════════════════════════════════════════════════════════
export default function SessionView({ token, user, session, campaign, party, onBack, onOpenEncounter }) {
  const [tab, setTab]             = useState('party')
  const [encounters, setEncounters] = useState(session.encounters ?? [])
  const [notes, setNotes]         = useState({
    sections: [
      { id: 'happened',  title: 'What Happened',     content: '' },
      { id: 'dm-notes',  title: 'DM Notes (Private)', content: '' },
      { id: 'loot',      title: 'Loot Given Out',     content: '' },
    ]
  })
  const [attendance, setAttendance] = useState(() => {
    const a = {}
    allActiveChars(party).forEach(c => { a[c.characterId] = true })
    return a
  })
  const [showNewEncounter, setShowNewEncounter] = useState(false)
  const [saving, setSaving]       = useState(false)

  // ── Session clock ──
  const [clockSeconds, setClockSeconds] = useState(session.duration ?? 0)
  const [clockRunning, setClockRunning] = useState(true)
  const clockRef = useRef(null)

  useEffect(() => {
    if (clockRunning) {
      clockRef.current = setInterval(() => setClockSeconds(s => s + 1), 1000)
    } else {
      clearInterval(clockRef.current)
    }
    return () => clearInterval(clockRef.current)
  }, [clockRunning])

  const octokit  = new Octokit({ auth: token })
  const slug     = campaign.slug
  const basePath = `campaigns/${slug}`

  function allActiveChars(party) {
    return (party ?? []).flatMap(p =>
      (p.characters ?? []).filter(c => c.active)
    )
  }

  // Active encounter
  const activeEncounter = encounters.find(e => e.status === 'live')
  const pastEncounters  = encounters.filter(e => e.status !== 'live')
  const activeRounds    = activeEncounter?.rounds ?? 0

  const saveEncounters = async (updated) => {
    setSaving(true)
    try {
      let sha
      try {
        const { data } = await octokit.repos.getContent({
          owner: user.login, repo: CAMPAIGNS_REPO,
          path: `${basePath}/encounters.json`,
        })
        sha = data.sha
      } catch { /* new */ }

      // Read all sessions, update this one's encounters
      let sessions = []
      let sessionsSha
      try {
        const { data } = await octokit.repos.getContent({
          owner: user.login, repo: CAMPAIGNS_REPO,
          path: `${basePath}/sessions.json`,
        })
        sessions = decode(data.content).sessions ?? []
        sessionsSha = data.sha
      } catch { /* no sessions yet */ }

      const updatedSessions = sessions.map(s =>
        s.sessionId === session.sessionId
          ? { ...s, encounters: updated, duration: clockSeconds, status: 'live' }
          : s
      )

      await octokit.repos.createOrUpdateFileContents({
        owner:   user.login,
        repo:    CAMPAIGNS_REPO,
        path:    `${basePath}/sessions.json`,
        message: 'Update session encounters',
        content: encode({ sessions: updatedSessions }),
        ...(sessionsSha ? { sha: sessionsSha } : {}),
      })
    } catch (e) {
      console.error('Save failed:', e)
    }
    setSaving(false)
  }

  const createEncounter = async (name) => {
    const enc = {
      encounterId: genId(),
      name,
      number:      encounters.length + 1,
      status:      'pending',
      rounds:      0,
      enemyCount:  0,
      combatants:  [],
      outcome:     null,
    }
    const updated = [...encounters, enc]
    setEncounters(updated)
    await saveEncounters(updated)
    setShowNewEncounter(false)
  }

  const toggleAttendance = (characterId) => {
    setAttendance(prev => ({ ...prev, [characterId]: !prev[characterId] }))
  }

  const updateNote = useCallback((id, content) => {
    setNotes(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === id ? { ...s, content } : s)
    }))
  }, [])

  const chars = allActiveChars(party)

  return (
    <div className="app-page app-page--full">
    <div className="app-container app-container--wide app-container--dm app-container--full-height sv-layout">
      {/* ── Left panel ── */}
      <aside className="sv-sidebar">
        {/* Back + title */}
        <div className="sv-sidebar-top">
          <button className="sv-back-btn" onClick={onBack}>← Campaign</button>
          <div className="sv-session-name">{session.name}</div>
        </div>

        {/* Session clock */}
        <div className="sv-clock-card">
          <div className="sv-clock-display">
            <div className="sv-clock-time">{formatClock(clockSeconds)}</div>
            <div className="sv-clock-label">Session Time</div>
          </div>

          {activeEncounter && (
            <div className="sv-clock-encounter">
              <div className="sv-clock-mini-val">{activeRounds}</div>
              <div className="sv-clock-mini-label">Rounds</div>
              <div className="sv-clock-mini-sep">·</div>
              <div className="sv-clock-mini-val">{formatInGame(activeRounds)}</div>
              <div className="sv-clock-mini-label">In-game</div>
            </div>
          )}

          <div className="sv-clock-controls">
            <button
              className={`sv-clock-btn${clockRunning ? '' : ' sv-clock-btn--paused'}`}
              onClick={() => setClockRunning(r => !r)}
            >
              {clockRunning ? '⏸ Pause' : '▶ Resume'}
            </button>
          </div>
        </div>

        {/* Sidebar tabs */}
        <div className="sv-sidebar-tabs">
          {[
            { id: 'party',     label: '👥', title: 'Party' },
            { id: 'encounter', label: '⚔️',  title: 'Encounter' },
            { id: 'notes',     label: '📝', title: 'Notes' },
          ].map(t => (
            <button
              key={t.id}
              className={`sv-sidebar-tab${tab === t.id ? ` sv-sidebar-tab--active${t.id === 'encounter' ? ' sv-sidebar-tab--dm' : ''}` : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span className="sv-tab-icon">{t.label}</span>
              {t.title}
            </button>
          ))}
        </div>
      </aside>

      {/* ── Right panel ── */}
      <div className="sv-main">
        {saving && <div className="sv-saving-bar">Saving…</div>}

        {/* ── PARTY TAB ── */}
        {tab === 'party' && (
          <div className="sv-tab-content">
            {chars.length === 0 ? (
              <div className="sv-empty">
                <div className="sv-empty-icon">👥</div>
                <div className="sv-empty-title">No active characters</div>
                <div className="sv-empty-sub">Add players and activate characters in the Campaign Party tab</div>
              </div>
            ) : (
              <div className="crc-grid">
                {chars.map(char => (
                  <CharRefCard
                    key={char.characterId}
                    char={char}
                    isPresent={attendance[char.characterId] ?? true}
                    onTogglePresent={toggleAttendance}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ENCOUNTER TAB ── */}
        {tab === 'encounter' && (
          <div className="sv-tab-content">
            {/* Active encounter */}
            {activeEncounter ? (
              <div className="sv-enc-section">
                <div className="sv-sec-label">Active Encounter</div>
                <EncounterRow
                  encounter={activeEncounter}
                  onOpen={enc => onOpenEncounter(enc, session, campaign)}
                  isActive
                />
                <button
                  className="sv-enter-enc-btn"
                  onClick={() => onOpenEncounter(activeEncounter, session, campaign)}
                >
                  ⚔️ Enter Encounter View →
                </button>
              </div>
            ) : (
              <div className="sv-no-encounter">
                <div className="sv-no-enc-icon">⚔️</div>
                <div className="sv-no-enc-title">No active encounter</div>
                <div className="sv-no-enc-sub">Start a new encounter to begin combat tracking</div>
                <button className="sv-enter-enc-btn" onClick={() => setShowNewEncounter(true)}>
                  + Start New Encounter
                </button>
              </div>
            )}

            {/* Past encounters */}
            {pastEncounters.length > 0 && (
              <div className="sv-enc-section">
                <div className="sv-sec-label">Previous Encounters This Session</div>
                {pastEncounters.map(enc => (
                  <EncounterRow
                    key={enc.encounterId}
                    encounter={enc}
                    onOpen={enc => onOpenEncounter(enc, session, campaign)}
                    isActive={false}
                  />
                ))}
              </div>
            )}

            <button className="sv-add-enc-row" onClick={() => setShowNewEncounter(true)}>
              + New Encounter
            </button>
          </div>
        )}

        {/* ── NOTES TAB ── */}
        {tab === 'notes' && (
          <div className="sv-tab-content">
            {notes.sections.map(section => (
              <SVNoteSection
                key={section.id}
                section={section}
                onChange={updateNote}
              />
            ))}
          </div>
        )}
      </div>

      {showNewEncounter && (
        <NewEncounterModal
          encounterNumber={encounters.length + 1}
          onCreate={createEncounter}
          onClose={() => setShowNewEncounter(false)}
        />
      )}
    </div>
    </div>
  )
}

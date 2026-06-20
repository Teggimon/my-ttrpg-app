import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Octokit } from '@octokit/rest'
import { DATA_REPO } from './githubStorage'
import './SessionView.css'

function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
function encode(obj) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj, null, 2))))
}
function decode(b64) {
  return JSON.parse(atob(b64.replace(/\s/g, '')))
}
function cloneCombatant(combatant) {
  return {
    ...combatant,
    id: genId(),
    hp: combatant.hpMax ?? combatant.hp ?? 10,
    hpMax: combatant.hpMax ?? combatant.hp ?? 10,
    conditions: [],
    downed: false,
  }
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
function sessionDuration(session, nowMs = Date.now()) {
  const base = session.duration ?? 0
  if (!session.timerRunning || !session.timerStartedAt) return base
  return base + Math.max(0, Math.floor((nowMs - new Date(session.timerStartedAt).getTime()) / 1000))
}
function formatInGame(rounds) {
  const total = rounds * 6
  if (total < 60) return `${total}s`
  const m = Math.floor(total / 60)
  const s = total % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}
const SESSION_TABS = [
  { id: 'party',     label: 'PTY', title: 'Party' },
  { id: 'encounter', label: 'ENC', title: 'Encounter' },
  { id: 'notes',     label: 'NT', title: 'Notes' },
]

// ── Character Reference Card ──────────────────────────────────
function CharRefCard({ char, isPresent, onTogglePresent }) {
  const pct   = hpPct(char.hpCurrent, char.hpMax)
  const color = hpColor(pct)
  const details = [
    char.race,
    char.class || 'Adventurer',
    `Lv ${char.level ?? 1}`,
  ].filter(Boolean).join(' · ')

  return (
    <div className={`crc${!isPresent ? ' crc--absent' : ''}`}>
      {/* Attendance toggle */}
      <button
        className={`crc-attend-btn${isPresent ? ' crc-attend-btn--present' : ''}`}
        onClick={() => onTogglePresent(char.characterId)}
        title={isPresent ? 'Mark absent' : 'Mark present'}
      >
        {isPresent ? 'In' : 'Out'}
      </button>

      {/* Header */}
      <div className="crc-header">
        <div className="crc-portrait">{char.portrait ? <img src={char.portrait} alt={char.name} /> : <img src="/uploads/placeholders/default-portrait.jpg" alt="" />}</div>
        <div className="crc-header-info">
          <div className="crc-name">{char.name}</div>
          <div className="crc-sub">{details}</div>
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
        {char.keySkills && (
          <div className="crc-sec-row">
            <span className="crc-sec-label">Key Skills</span>
            <span className="crc-sec-val">{char.keySkills}</span>
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
function EncounterRow({ encounter, onOpen, isActive, actionLabel }) {
  const statusLabel = actionLabel ?? (isActive
    ? 'Live'
    : encounter.defeated
      ? 'Defeated'
      : encounter.outcome === 'victory'
        ? 'Victory'
        : encounter.outcome === 'fled'
          ? 'Fled'
          : encounter.outcome === 'defeat'
            ? 'Defeat'
            : encounter.outcome === 'continued'
              ? 'Continued'
              : encounter.outcome === 'unresolved'
                ? 'Unresolved'
                : '—')
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
        {statusLabel}
      </div>
    </div>
  )
}

// ── Note section ──────────────────────────────────────────────
function SVNoteSection({ section, onChange }) {
  const [collapsed, setCollapsed] = useState(false)
  const taRef = useRef(null)

  useEffect(() => {
    if (!taRef.current || collapsed) return
    taRef.current.style.height = 'auto'
    taRef.current.style.height = `${Math.max(120, taRef.current.scrollHeight)}px`
  }, [section.content, collapsed])

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
          ref={taRef}
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

// ════════════════════════════════════════════════════════════════
//  Main SessionView
// ════════════════════════════════════════════════════════════════
export default function SessionView({ token, user, session, campaign, party, initialPreparedEncounters = [], onBack, onOpenEncounter }) {
  const [tab, setTab]             = useState('party')
  const [encounters, setEncounters] = useState(session.encounters ?? [])
  const [preparedEncounters, setPreparedEncounters] = useState(initialPreparedEncounters)
  const [notes, setNotes]         = useState({
    ...(session.notes ?? {}),
    sections: [
      { id: 'happened',  title: 'What Happened',     content: '' },
      { id: 'dm-notes',  title: 'DM Notes (Private)', content: '' },
      { id: 'loot',      title: 'Loot Given Out',     content: '' },
      ...(session.notes?.sections ?? []).filter(section => !['happened', 'dm-notes', 'loot'].includes(section.id)),
    ]
  })
  const [attendance, setAttendance] = useState(() => {
    const a = {}
    allActiveChars(party).forEach(c => { a[c.characterId] = true })
    return a
  })
  const [saving, setSaving]       = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)

  // ── Session clock ──
  const [clockSeconds, setClockSeconds] = useState(() => sessionDuration(session))
  const [clockRunning, setClockRunning] = useState(session.timerRunning ?? true)
  const clockRef = useRef(null)
  const clockSecondsRef = useRef(clockSeconds)
  const encountersRef = useRef(encounters)
  const notesRef = useRef(notes)
  const sessionEndedRef = useRef(false)

  useEffect(() => {
    if (clockRunning) {
      clockRef.current = setInterval(() => setClockSeconds(s => s + 1), 1000)
    } else {
      clearInterval(clockRef.current)
    }
    return () => clearInterval(clockRef.current)
  }, [clockRunning])

  useEffect(() => {
    clockSecondsRef.current = clockSeconds
  }, [clockSeconds])

  useEffect(() => {
    encountersRef.current = encounters
  }, [encounters])

  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  const octokit  = useMemo(() => new Octokit({ auth: token }), [token])
  const slug     = campaign.slug
  const basePath = `campaigns/${slug}`

  const updateStoredSession = useCallback(async (patch, message = 'Update session', showSaving = false) => {
    if (showSaving) setSaving(true)
    try {
      let sessions = []
      let sessionsSha
      try {
        const { data } = await octokit.repos.getContent({
          owner: user.login, repo: DATA_REPO,
          path: `${basePath}/sessions.json`,
        })
        sessions = decode(data.content).sessions ?? []
        sessionsSha = data.sha
      } catch { /* no sessions yet */ }

      const hasSession = sessions.some(s => s.sessionId === session.sessionId)
      const updatedSession = {
        ...session,
        encounters: encountersRef.current,
        notes: notesRef.current,
        duration: clockSecondsRef.current,
        status: 'live',
        timerRunning: clockRunning,
        timerStartedAt: clockRunning ? new Date().toISOString() : null,
        timerUpdatedAt: new Date().toISOString(),
        ...patch,
      }
      const updatedSessions = hasSession
        ? sessions.map(s => s.sessionId === session.sessionId ? { ...s, ...updatedSession } : s)
        : [updatedSession, ...sessions]

      await octokit.repos.createOrUpdateFileContents({
        owner:   user.login,
        repo:    DATA_REPO,
        path:    `${basePath}/sessions.json`,
        message,
        content: encode({ sessions: updatedSessions }),
        ...(sessionsSha ? { sha: sessionsSha } : {}),
      })
    } catch (e) {
      console.error('Save failed:', e)
    }
    if (showSaving) setSaving(false)
  }, [basePath, clockRunning, octokit, session, user.login])

  const saveDuration = useCallback(() => {
    if (sessionEndedRef.current) return Promise.resolve()
    return updateStoredSession(
      {
        duration: clockSecondsRef.current,
        encounters: encountersRef.current,
        notes: notesRef.current,
        timerRunning: clockRunning,
        timerStartedAt: clockRunning ? new Date().toISOString() : null,
        timerUpdatedAt: new Date().toISOString(),
      },
      'Update session timer'
    )
  }, [clockRunning, updateStoredSession])

  useEffect(() => {
    if (!clockRunning) {
      saveDuration()
      return
    }
    const persistRef = setInterval(() => {
      saveDuration()
    }, 15000)
    return () => {
      clearInterval(persistRef)
      saveDuration()
    }
  }, [clockRunning, saveDuration])

  useEffect(() => {
    const loadPreparedEncounters = async () => {
      try {
        const { data } = await octokit.repos.getContent({
          owner: user.login,
          repo: DATA_REPO,
          path: `${basePath}/encounters.json`,
        })
        setPreparedEncounters(decode(data.content).encounters ?? [])
      } catch {
        setPreparedEncounters(initialPreparedEncounters)
      }
    }
    loadPreparedEncounters()
  }, [basePath, initialPreparedEncounters, octokit, user.login])

  function allActiveChars(party) {
    return (party ?? []).flatMap(p =>
      (p.characters ?? []).filter(c => c.active).map(c => ({ ...c, github: p.github }))
    )
  }

  // Active encounter
  const activeEncounter = encounters.find(e => e.status === 'live')
  const pastEncounters  = encounters.filter(e => e.status !== 'live')
  const activeRounds    = activeEncounter?.rounds ?? 0

  const saveEncounters = async (updated) => {
    await updateStoredSession(
      {
        encounters: updated,
        notes: notesRef.current,
        duration: clockSecondsRef.current,
        status: 'live',
        timerRunning: clockRunning,
        timerStartedAt: clockRunning ? new Date().toISOString() : null,
        timerUpdatedAt: new Date().toISOString(),
      },
      'Update session encounters',
      true
    )
  }

  const startPreparedEncounter = async (preparedEncounter) => {
    const groups = preparedEncounter?.groups ?? []
    const combatants = (preparedEncounter?.combatants ?? []).map(combatant => {
      const hpGroup = groups.find(g => g.npcId === combatant.npcId)
      return cloneCombatant(hpGroup ? {
        ...combatant,
        hpMode: hpGroup.hpMode,
        hpValue: hpGroup.hpValue,
        hpFormula: hpGroup.hpFormula,
      } : combatant)
    })
    const enc = {
      encounterId: genId(),
      name: preparedEncounter.name,
      number:      encounters.length + 1,
      status:      'live',
      rounds:      1,
      enemyCount:  combatants.length,
      combatants,
      preparedEncounterId: preparedEncounter?.encounterId ?? null,
      defeated:    false,
      outcome:     null,
    }
    const updated = [...encounters, enc]
    setEncounters(updated)
    await saveEncounters(updated)
  }

  const toggleAttendance = (characterId) => {
    setAttendance(prev => ({ ...prev, [characterId]: !prev[characterId] }))
  }

  const updateNote = useCallback((id, content) => {
    const updatedNotes = {
      ...notesRef.current,
      sections: notesRef.current.sections.map(s => s.id === id ? { ...s, content } : s)
    }
    setNotes(updatedNotes)
    notesRef.current = updatedNotes
    updateStoredSession({ notes: updatedNotes }, 'Update session notes')
  }, [updateStoredSession])

  const chars = allActiveChars(party)
  const sessionPreparedEncounters = preparedEncounters.filter(enc =>
    !enc.defeated &&
    !encounters.some(existing => existing.preparedEncounterId === enc.encounterId)
  )
  const currentSession = {
    ...session,
    duration: clockSeconds,
    timerRunning: clockRunning,
    timerStartedAt: clockRunning ? new Date().toISOString() : null,
    timerUpdatedAt: new Date().toISOString(),
    encounters,
  }
  const handleBack = async () => {
    await saveDuration()
    onBack()
  }
  const handleEndSession = async () => {
    const finalDuration = clockSecondsRef.current
    const finalEncounters = activeEncounter
      ? encountersRef.current.map(enc =>
          enc.encounterId === activeEncounter.encounterId
            ? {
                ...enc,
                status: 'done',
                outcome: enc.outcome ?? 'unresolved',
                unresolvedAt: new Date().toISOString(),
              }
            : enc
        )
      : encountersRef.current
    sessionEndedRef.current = true
    await updateStoredSession(
      {
        encounters: finalEncounters,
        notes: notesRef.current,
        players: chars.map(char => ({
          characterId: char.characterId,
          characterName: char.name,
          github: char.github,
          absent: attendance[char.characterId] === false,
        })),
        duration: finalDuration,
        status: 'done',
        timerRunning: false,
        timerStartedAt: null,
        timerUpdatedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
      },
      'End session',
      true
    )
    setShowEndConfirm(false)
    onBack()
  }

  const handleCarryEncounterForward = async () => {
    if (!activeEncounter) return

    setSaving(true)
    const now = new Date().toISOString()
    const finalDuration = clockSecondsRef.current
    const nextNumber = (session.number ?? 0) + 1
    const oldEncounterId = activeEncounter.encounterId
    const carriedEncounterId = activeEncounter.continuation?.toEncounterId ?? genId()
    let sessions = []
    let sessionsSha

    try {
      try {
        const { data } = await octokit.repos.getContent({
          owner: user.login,
          repo: DATA_REPO,
          path: `${basePath}/sessions.json`,
        })
        sessions = decode(data.content).sessions ?? []
        sessionsSha = data.sha
      } catch { /* no sessions yet */ }

      const storedCurrent = sessions.find(s => s.sessionId === session.sessionId) ?? session
      const existingNext = sessions.find(s =>
        s.sessionId !== session.sessionId && s.number === nextNumber
      )
      const nextSessionId = existingNext?.sessionId ?? genId()
      const oldEncounter = {
        ...activeEncounter,
        status: 'continued',
        outcome: 'continued',
        continuedAt: now,
        continuation: {
          fromSessionId: session.sessionId,
          fromEncounterId: oldEncounterId,
          toSessionId: nextSessionId,
          toEncounterId: carriedEncounterId,
        },
      }
      const carriedEncounter = {
        ...activeEncounter,
        encounterId: carriedEncounterId,
        number: ((existingNext?.encounters ?? []).length || 0) + 1,
        status: 'live',
        outcome: null,
        defeated: false,
        carriedAt: now,
        continuation: {
          fromSessionId: session.sessionId,
          fromEncounterId: oldEncounterId,
          toSessionId: nextSessionId,
          toEncounterId: carriedEncounterId,
        },
      }
      const currentEncounters = (encountersRef.current ?? []).map(enc =>
        enc.encounterId === oldEncounterId ? oldEncounter : enc
      )
      const closedCurrentSession = {
        ...storedCurrent,
        encounters: currentEncounters,
        notes: notesRef.current,
        players: chars.map(char => ({
          characterId: char.characterId,
          characterName: char.name,
          github: char.github,
          absent: attendance[char.characterId] === false,
        })),
        duration: finalDuration,
        status: 'done',
        timerRunning: false,
        timerStartedAt: null,
        timerUpdatedAt: now,
        endedAt: now,
      }
      const nextSession = existingNext
        ? {
            ...existingNext,
            status: 'live',
            timerRunning: existingNext.timerRunning ?? true,
            timerStartedAt: existingNext.timerStartedAt ?? now,
            timerUpdatedAt: now,
            encounters: (existingNext.encounters ?? []).some(enc =>
              enc.encounterId === carriedEncounterId ||
              enc.continuation?.fromEncounterId === oldEncounterId
            )
              ? (existingNext.encounters ?? []).map(enc =>
                  enc.encounterId === carriedEncounterId ||
                  enc.continuation?.fromEncounterId === oldEncounterId
                    ? { ...carriedEncounter, number: enc.number ?? carriedEncounter.number }
                    : enc
                )
              : [...(existingNext.encounters ?? []), carriedEncounter],
          }
        : {
            sessionId: nextSessionId,
            name: `Session ${nextNumber}`,
            number: nextNumber,
            date: now,
            status: 'live',
            duration: 0,
            timerRunning: true,
            timerStartedAt: now,
            timerUpdatedAt: now,
            players: [],
            encounters: [carriedEncounter],
            carriedFromSessionId: session.sessionId,
          }

      let sawCurrent = false
      let sawNext = false
      const updatedSessions = sessions.map(s => {
        if (s.sessionId === session.sessionId) {
          sawCurrent = true
          return closedCurrentSession
        }
        if (s.sessionId === nextSession.sessionId) {
          sawNext = true
          return nextSession
        }
        return s
      })
      if (!sawCurrent) updatedSessions.push(closedCurrentSession)
      if (!sawNext) updatedSessions.unshift(nextSession)

      await octokit.repos.createOrUpdateFileContents({
        owner: user.login,
        repo: DATA_REPO,
        path: `${basePath}/sessions.json`,
        message: 'Carry encounter to next session',
        content: encode({ sessions: updatedSessions }),
        ...(sessionsSha ? { sha: sessionsSha } : {}),
      })

      sessionEndedRef.current = true
      setEncounters(currentEncounters)
      setShowEndConfirm(false)
      onBack()
    } catch (e) {
      console.error('Carry encounter failed:', e)
    }
    setSaving(false)
  }

  const handleOpenEncounter = async (encounter) => {
    await saveDuration()
    onOpenEncounter(encounter, currentSession, campaign)
  }

  return (
    <div className="app-page app-page--full">
    <div className="app-container app-container--wide app-container--dm app-container--full-height sv-layout">
      {/* ── Left panel ── */}
      <aside className="sv-sidebar">
        {/* Back + title */}
        <div className="sv-sidebar-top">
          <button className="sv-back-btn" onClick={handleBack}>← Campaign</button>
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
              {clockRunning ? 'Pause' : 'Resume'}
            </button>
            <button
              className="sv-clock-btn sv-clock-btn--end"
              onClick={() => setShowEndConfirm(true)}
            >
              End
            </button>
          </div>
        </div>

        {/* Sidebar tabs */}
        <div className="sv-sidebar-tabs">
          {SESSION_TABS.map(t => (
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
        <div className="sv-mobile-head">
          <button className="sv-back-btn" onClick={handleBack}>← Campaign</button>
          <div className="sv-mobile-title">
            <span>{session.name}</span>
            <small>{formatClock(clockSeconds)}{clockRunning ? '' : ' paused'}</small>
          </div>
          <button
            className={`sv-mobile-clock-btn${clockRunning ? '' : ' sv-mobile-clock-btn--paused'}`}
            onClick={() => setClockRunning(r => !r)}
          >
            {clockRunning ? 'Pause' : 'Resume'}
          </button>
          <button
            className="sv-mobile-clock-btn sv-mobile-clock-btn--end"
            onClick={() => setShowEndConfirm(true)}
          >
            End
          </button>
        </div>

        <div className="sv-mobile-tabs">
          {SESSION_TABS.map(t => (
            <button
              key={t.id}
              className={`sv-mobile-tab${tab === t.id ? ' sv-mobile-tab--active' : ''}`}
              type="button"
              onClick={() => setTab(t.id)}
            >
              <span>{t.label}</span>
              {t.title}
            </button>
          ))}
        </div>

        {saving && <div className="sv-saving-bar">Saving…</div>}

        {/* ── PARTY TAB ── */}
        {tab === 'party' && (
          <div className="sv-tab-content">
            {chars.length === 0 ? (
              <div className="sv-empty">
                <div className="sv-empty-icon">PTY</div>
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
                  onOpen={handleOpenEncounter}
                  isActive
                />
                <button
                  className="sv-enter-enc-btn"
                  onClick={() => handleOpenEncounter(activeEncounter)}
                >
                  Enter Encounter View
                </button>
              </div>
            ) : (
              <div className="sv-no-encounter">
                <div className="sv-no-enc-icon">ENC</div>
                <div className="sv-no-enc-title">No active encounter</div>
                <div className="sv-no-enc-sub">Start a prepared campaign encounter below to begin combat tracking</div>
              </div>
            )}

            <div className="sv-enc-section">
              <div className="sv-sec-label">Prepared Encounters</div>
              {sessionPreparedEncounters.length === 0 ? (
                <div className="sv-prepared-empty">No prepared encounters available. Add or edit encounters from the Campaign Encounters tab.</div>
              ) : sessionPreparedEncounters.map(enc => (
                <EncounterRow
                  key={enc.encounterId}
                  encounter={{
                    ...enc,
                    number: 'ENC',
                    enemyCount: enc.enemyCount ?? enc.combatants?.length ?? 0,
                  }}
                  onOpen={() => startPreparedEncounter(enc)}
                  actionLabel="Start"
                />
              ))}
            </div>

            {/* Past encounters */}
            {pastEncounters.length > 0 && (
              <div className="sv-enc-section">
                <div className="sv-sec-label">Previous Encounters This Session</div>
                {pastEncounters.map(enc => (
                  <EncounterRow
                    key={enc.encounterId}
                    encounter={enc}
                    onOpen={handleOpenEncounter}
                    isActive={false}
                  />
                ))}
              </div>
            )}
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

      {showEndConfirm && (
        <div className="sv-modal-overlay" onClick={() => setShowEndConfirm(false)}>
          <div className="sv-modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="sv-modal-handle" />
            <div className="sv-modal-title">End {session.name}?</div>
            <p className="sv-modal-body">
              This marks the session as done, saves the final timer, notes, attendance, and encounter history, then returns you to the campaign.
            </p>
            {activeEncounter && (
              <p className="sv-modal-warning">
                {activeEncounter.name} is still live. Carry it forward to preserve round {activeEncounter.rounds ?? 1}, combatants, HP, conditions, and turn order in Session {(session.number ?? 0) + 1}.
              </p>
            )}
            <div className="sv-modal-actions">
              <button className="sv-btn sv-btn--ghost" onClick={() => setShowEndConfirm(false)}>
                Keep Session Live
              </button>
              {activeEncounter && (
                <button className="sv-btn sv-btn--dm" onClick={handleCarryEncounterForward} disabled={saving}>
                  {saving ? 'Carrying...' : 'Carry Forward'}
                </button>
              )}
              <button className="sv-btn sv-btn--danger" onClick={handleEndSession} disabled={saving}>
                {saving ? 'Ending...' : activeEncounter ? 'End Anyway' : 'End Session'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </div>
  )
}

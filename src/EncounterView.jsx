import { useState, useEffect } from 'react'
import './EncounterView.css'

function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
function rollD20() { return Math.floor(Math.random() * 20) + 1 }
function hpPct(cur, max) { return max ? Math.min(100, Math.round((cur / max) * 100)) : 0 }
function hpColor(pct) {
  if (pct <= 0) return 'var(--text-muted)'
  if (pct < 25) return 'var(--hp-low)'
  if (pct < 50) return 'var(--hp-mid)'
  return 'var(--hp-high)'
}
function formatInGame(rounds) {
  const total = rounds * 6
  if (total < 60) return `${total}s`
  const m = Math.floor(total / 60); const s = total % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

// Build initial combatant list from party + encounter enemies
function buildCombatants(party, encounter) {
  const playerCombatants = (party ?? [])
    .flatMap(p => (p.characters ?? []).filter(c => c.active))
    .map(char => ({
      id:       char.characterId ?? genId(),
      type:     'player',
      name:     char.name,
      emoji:    '⚔️',
      hp:       char.hpCurrent ?? char.hpMax ?? 10,
      hpMax:    char.hpMax ?? 10,
      initiative: rollD20() + (char.initiativeMod ?? 0),
      initiativeMod: char.initiativeMod ?? 0,
      ac:       char.ac ?? 10,
      conditions: [],
      downed:   false,
    }))

  const enemyCombatants = (encounter.combatants ?? [])
    .filter(c => c.type === 'enemy' || c.type === 'boss')
    .map(c => ({
      ...c,
      initiative: rollD20() + (c.initiativeMod ?? 0),
    }))

  // If no enemies defined yet, add a placeholder set
  if (enemyCombatants.length === 0 && (encounter.enemies ?? []).length === 0) {
    return [
      ...playerCombatants,
      {
        id: genId(), type: 'enemy', name: 'Goblin', emoji: '👺',
        hp: 7, hpMax: 7, initiative: rollD20() + 2, initiativeMod: 2,
        ac: 15, attackBonus: 4, saveDC: 8, cr: '1/4',
        conditions: [], downed: false,
        actions: [
          { name: 'Scimitar', toHit: '+4', damage: '1d6+2 slashing' },
          { name: 'Shortbow', toHit: '+4', damage: '1d6+2 piercing', note: 'Range 80/320ft' },
        ],
      },
    ]
  }

  return [...playerCombatants, ...enemyCombatants]
}

// ── Initiative Setup Overlay ──────────────────────────────────
function InitiativeOverlay({ combatants, onStart, onCancel }) {
  const [order, setOrder] = useState(combatants.map(c => ({ ...c })))

  const setInit = (id, val) => {
    setOrder(prev => prev.map(c => c.id === id ? { ...c, initiative: parseInt(val) || 0 } : c))
  }
  const reroll = (id) => {
    setOrder(prev => prev.map(c =>
      c.id === id ? { ...c, initiative: rollD20() + (c.initiativeMod ?? 0) } : c
    ))
  }
  const sorted = [...order].sort((a, b) => b.initiative - a.initiative)

  return (
    <div className="init-overlay">
      <div className="init-panel">
        <div className="init-title">⚔️ Initiative Order</div>
        <div className="init-subtitle">Roll or adjust initiative for each combatant</div>

        <div className="init-list">
          {order.map(c => (
            <div key={c.id} className={`init-row${c.type === 'player' ? ' init-row--player' : ' init-row--enemy'}`}>
              <div className="init-portrait">{c.emoji}</div>
              <div className="init-info">
                <div className="init-name">{c.name}</div>
                <div className="init-sub">
                  {c.type === 'player' ? 'Player' : `${c.cr ? `CR ${c.cr}` : 'Enemy'}`}
                  {c.initiativeMod != null && ` · DEX ${c.initiativeMod >= 0 ? '+' : ''}${c.initiativeMod}`}
                </div>
              </div>
              <input
                className="init-input"
                type="number"
                value={c.initiative}
                onChange={e => setInit(c.id, e.target.value)}
              />
              <button className="init-reroll-btn" onClick={() => reroll(c.id)} title="Re-roll">🎲</button>
            </div>
          ))}
        </div>

        <div className="init-actions">
          <button className="init-cancel-btn" onClick={onCancel}>Cancel</button>
          <button className="init-start-btn" onClick={() => onStart(sorted)}>Start Encounter →</button>
        </div>
      </div>
    </div>
  )
}

// ── Player combatant row (read-only) ──────────────────────────
function PlayerRow({ combatant, isActive }) {
  const [expanded, setExpanded] = useState(false)
  const pct   = hpPct(combatant.hp, combatant.hpMax)
  const color = hpColor(pct)

  return (
    <div className={`combatant player-comb${isActive ? ' active-turn' : ''}${combatant.downed ? ' downed' : ''}`}>
      <div className="comb-head" onClick={() => setExpanded(e => !e)}>
        <div className="init-badge">{combatant.initiative}</div>
        <div className="comb-portrait">{combatant.emoji}</div>
        <div className="comb-info">
          <div className="comb-name">{combatant.name}</div>
          <div className="comb-sub">{combatant.type === 'player' ? 'Player' : combatant.cr ? `CR ${combatant.cr}` : 'Enemy'}</div>
        </div>
        <div className="comb-hp-readonly">
          <div className="comb-hp-val" style={{ color }}>{combatant.hp}/{combatant.hpMax}</div>
          <div className="comb-hp-bar-sm">
            <div className="comb-hp-bar-fill" style={{ width: `${pct}%`, background: color }} />
          </div>
        </div>
        <div className={`comb-chevron${expanded ? ' comb-chevron--open' : ''}`}>▾</div>
      </div>

      {expanded && (
        <div className="comb-detail">
          <div className="comb-conditions">
            <span className="cond-label">Conditions</span>
            {combatant.conditions?.length > 0
              ? combatant.conditions.map(c => <span key={c} className="cond-pill">{c}</span>)
              : <span className="cond-none">None</span>
            }
          </div>
        </div>
      )}
    </div>
  )
}

// ── Enemy combatant row (full DM control) ─────────────────────
function EnemyRow({ combatant, isActive, onHpChange, onAddCondition, onRemoveCondition }) {
  const [expanded, setExpanded] = useState(false)
  const pct   = hpPct(combatant.hp, combatant.hpMax)
  const color = hpColor(pct)

  const adj = (delta) => onHpChange(combatant.id, Math.max(0, Math.min(combatant.hpMax, combatant.hp + delta)))

  return (
    <div className={`combatant enemy-comb${isActive ? ' active-turn' : ''}${combatant.downed ? ' downed' : ''}`}>
      <div className="comb-head" onClick={() => setExpanded(e => !e)}>
        <div className="init-badge">{combatant.initiative}</div>
        <div className="comb-portrait">{combatant.emoji ?? '👺'}</div>
        <div className="comb-info">
          <div className="comb-name">{combatant.name}</div>
          <div className="comb-sub">{combatant.cr ? `CR ${combatant.cr}` : 'Enemy'}</div>
        </div>

        {/* HP stepper */}
        <div className="hp-stepper" onClick={e => e.stopPropagation()}>
          <button className="hs-btn hs-btn--minus" onClick={() => adj(-1)}>−</button>
          <div className="hs-val" style={{ color }}>{combatant.hp}</div>
          <button className="hs-btn hs-btn--plus" onClick={() => adj(1)}>+</button>
        </div>
        <div className="hs-max">/ {combatant.hpMax}</div>

        <div className={`comb-chevron${expanded ? ' comb-chevron--open' : ''}`}>▾</div>
      </div>

      {/* HP bar */}
      <div className="enemy-hp-track">
        <div className="enemy-hp-fill" style={{ width: `${pct}%`, background: color }} />
      </div>

      {expanded && (
        <div className="comb-detail">
          {/* Stats */}
          <div className="enemy-stat-grid">
            <div className="esg-cell">
              <div className="esg-val">{combatant.attackBonus != null ? (combatant.attackBonus >= 0 ? `+${combatant.attackBonus}` : combatant.attackBonus) : '—'}</div>
              <div className="esg-lbl">Atk Bonus</div>
            </div>
            <div className="esg-cell">
              <div className="esg-val">{combatant.ac ?? '—'}</div>
              <div className="esg-lbl">AC</div>
            </div>
            <div className="esg-cell">
              <div className="esg-val">{combatant.saveDC ?? '—'}</div>
              <div className="esg-lbl">Save DC</div>
            </div>
          </div>

          {/* Conditions */}
          <div className="comb-conditions">
            <span className="cond-label">Conditions</span>
            {combatant.conditions?.map(c => (
              <span key={c} className="cond-pill cond-pill--removable" onClick={() => onRemoveCondition(combatant.id, c)}>
                {c} ✕
              </span>
            ))}
            <button className="add-cond-btn" onClick={() => {
              const cond = prompt('Condition name:')
              if (cond?.trim()) onAddCondition(combatant.id, cond.trim())
            }}>+ Add</button>
          </div>

          {/* Actions */}
          {combatant.actions?.length > 0 && (
            <div className="actions-section">
              <div className="actions-label">Actions</div>
              {combatant.actions.map((a, i) => (
                <div key={i} className="action-row">
                  <div className="action-name">{a.name}</div>
                  <div className="action-badges">
                    {a.toHit   && <span className="action-badge">{a.toHit} to hit</span>}
                    {a.damage  && <span className="action-badge">{a.damage}</span>}
                    {a.note    && <span className="action-badge action-badge--dim">{a.note}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Traits */}
          {combatant.traits?.length > 0 && (
            <div className="actions-section">
              <div className="actions-label">Traits</div>
              {combatant.traits.map((t, i) => (
                <div key={i} className="trait-row">
                  <span className="trait-name">{t.name}.</span>
                  <span className="trait-desc"> {t.desc}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//  Main EncounterView
// ════════════════════════════════════════════════════════════════
export default function EncounterView({ encounter, session, campaign, party, onBack, onEndEncounter }) {
  const [phase, setPhase]         = useState('initiative')  // 'initiative' | 'combat'
  const [combatants, setCombatants] = useState(() => buildCombatants(party, encounter))
  const [order, setOrder]         = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [round, setRound]         = useState(encounter.rounds ?? 1)
  const [showEndConfirm, setShowEndConfirm] = useState(false)

  // Start encounter after initiative setup
  const startEncounter = (sorted) => {
    setOrder(sorted)
    setPhase('combat')
  }

  // Next turn
  const nextTurn = () => {
    const next = currentIdx + 1
    if (next >= order.length) {
      // Wrap — new round
      setCurrentIdx(0)
      setRound(r => r + 1)
    } else {
      setCurrentIdx(next)
    }
  }

  // HP change
  const handleHpChange = (id, newHp) => {
    setCombatants(prev => prev.map(c => {
      if (c.id !== id) return c
      const downed = newHp <= 0
      return { ...c, hp: newHp, downed }
    }))
    // Sync order
    setOrder(prev => prev.map(c => {
      if (c.id !== id) return c
      return { ...c, hp: newHp, downed: newHp <= 0 }
    }))
  }

  const addCondition = (id, condition) => {
    setCombatants(prev => prev.map(c =>
      c.id === id ? { ...c, conditions: [...(c.conditions ?? []), condition] } : c
    ))
    setOrder(prev => prev.map(c =>
      c.id === id ? { ...c, conditions: [...(c.conditions ?? []), condition] } : c
    ))
  }

  const removeCondition = (id, condition) => {
    setCombatants(prev => prev.map(c =>
      c.id === id ? { ...c, conditions: c.conditions.filter(x => x !== condition) } : c
    ))
    setOrder(prev => prev.map(c =>
      c.id === id ? { ...c, conditions: c.conditions.filter(x => x !== condition) } : c
    ))
  }

  const players = phase === 'combat' ? order.filter(c => c.type === 'player') : combatants.filter(c => c.type === 'player')
  const enemies = phase === 'combat' ? order.filter(c => c.type !== 'player') : combatants.filter(c => c.type !== 'player')

  const activeEnemies  = enemies.filter(e => !e.downed)
  const defeatedEnemies = enemies.filter(e => e.downed)

  const currentCombatant = phase === 'combat' ? order[currentIdx] : null
  const nextCombatants   = phase === 'combat'
    ? [order[(currentIdx + 1) % order.length], order[(currentIdx + 2) % order.length]].filter(Boolean)
    : []

  return (
    <div className="app-page app-page--full">
    <div className="app-container app-container--wide app-container--dm app-container--full-height ev-layout">
      {/* ── Initiative overlay ── */}
      {phase === 'initiative' && (
        <InitiativeOverlay
          combatants={combatants}
          onStart={startEncounter}
          onCancel={onBack}
        />
      )}

      {/* ── Combat phase ── */}
      {phase === 'combat' && (
        <>
          {/* Top bar */}
          <div className="ev-topbar">
            <div className="ev-topbar-left">
              <button className="ev-back-btn" onClick={onBack}>← Session</button>
              <div className="ev-enc-name">{encounter.name}</div>
            </div>

            <div className="ev-topbar-stats">
              <div className="ev-stat">
                <span className="ev-stat-val">{round}</span>
                <span className="ev-stat-label">Round</span>
              </div>
              <div className="ev-stat-sep" />
              <div className="ev-stat">
                <span className="ev-stat-val">{formatInGame(round)}</span>
                <span className="ev-stat-label">In-game</span>
              </div>
              <div className="ev-stat-sep" />
              <div className="ev-stat">
                <span className="ev-stat-val" style={{ color: activeEnemies.length === 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {activeEnemies.length}
                </span>
                <span className="ev-stat-label">Enemies</span>
              </div>
            </div>

            <div className="ev-topbar-right">
              <button className="ev-end-btn" onClick={() => setShowEndConfirm(true)}>End Encounter</button>
            </div>
          </div>

          {/* Active turn bar */}
          {currentCombatant && (
            <div className="ev-turn-bar">
              <div className="ev-turn-info">
                <div className={`ev-turn-pip ev-turn-pip--${currentCombatant.type === 'player' ? 'player' : 'enemy'}`} />
                <div className="ev-turn-name">{currentCombatant.name}</div>
                <div className="ev-turn-init">Initiative {currentCombatant.initiative}</div>
              </div>

              {nextCombatants.length > 0 && (
                <div className="ev-turn-next">
                  <span className="ev-turn-next-label">Next:</span>
                  {nextCombatants.map((c, i) => (
                    <span key={i} className="ev-turn-next-name">{c.name}</span>
                  ))}
                </div>
              )}

              <button className="ev-next-btn" onClick={nextTurn}>
                Next Turn →
              </button>
            </div>
          )}

          {/* Two-column combat area */}
          <div className="ev-combat-area">
            {/* Players column (25%) */}
            <div className="ev-col ev-col--players">
              <div className="ev-col-header">
                <span className="ev-col-label">Players</span>
                <span className="ev-col-count">{players.length}</span>
              </div>
              <div className="ev-col-scroll">
                {players.map((c, i) => (
                  <PlayerRow
                    key={c.id}
                    combatant={c}
                    isActive={phase === 'combat' && order[currentIdx]?.id === c.id}
                  />
                ))}
              </div>
            </div>

            {/* Enemies column (75%) */}
            <div className="ev-col ev-col--enemies">
              <div className="ev-col-header">
                <span className="ev-col-label">Enemies</span>
                <span className="ev-col-count">{activeEnemies.length} remaining</span>
                <button className="ev-add-enemy-btn">+ Add</button>
              </div>
              <div className="ev-col-scroll">
                {activeEnemies.map(c => (
                  <EnemyRow
                    key={c.id}
                    combatant={c}
                    isActive={phase === 'combat' && order[currentIdx]?.id === c.id}
                    onHpChange={handleHpChange}
                    onAddCondition={addCondition}
                    onRemoveCondition={removeCondition}
                  />
                ))}

                {defeatedEnemies.length > 0 && (
                  <>
                    <div className="ev-defeated-label">Defeated</div>
                    {defeatedEnemies.map(c => (
                      <EnemyRow
                        key={c.id}
                        combatant={c}
                        isActive={false}
                        onHpChange={handleHpChange}
                        onAddCondition={addCondition}
                        onRemoveCondition={removeCondition}
                      />
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* End encounter confirm */}
          {showEndConfirm && (
            <div className="ev-modal-overlay" onClick={() => setShowEndConfirm(false)}>
              <div className="ev-modal-sheet" onClick={e => e.stopPropagation()}>
                <div className="ev-modal-handle" />
                <div className="ev-modal-title">End Encounter?</div>
                <p className="ev-modal-body">Round {round} · {formatInGame(round)} elapsed in-game.</p>
                <div className="ev-outcome-row">
                  {['victory','fled','defeat'].map(outcome => (
                    <button
                      key={outcome}
                      className={`ev-outcome-btn ev-outcome-btn--${outcome}`}
                      onClick={() => {
                        setShowEndConfirm(false)
                        onEndEncounter({ ...encounter, rounds: round, outcome, status: 'done' })
                      }}
                    >
                      {outcome === 'victory' ? '⚔ Victory' : outcome === 'fled' ? '↩ Fled' : '💀 Defeat'}
                    </button>
                  ))}
                </div>
                <button className="ev-cancel-btn" onClick={() => setShowEndConfirm(false)}>Keep Fighting</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
    </div>
  )
}

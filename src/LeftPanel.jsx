import { useState } from 'react'
import { ShortRestModal, LongRestModal } from './RestModals'
import LevelUpModal, { checkLevelUp } from './LevelUpModal'
import './LeftPanel.css'

const XP_THRESHOLDS = [0,300,900,2700,6500,14000,23000,34000,48000,64000,85000,100000,120000,140000,165000,195000,225000,265000,305000,355000]

function fmtBonus(n) { return n >= 0 ? `+${n}` : `${n}` }

export default function LeftPanel({
  char, isOwner, locked, onToggleLock,
  updateChar, onBack,
  portrait, tabs, activeTab, onTabChange,
  syncStatus,
}) {
  const [showShortRest, setShowShortRest] = useState(false)
  const [showLongRest,  setShowLongRest]  = useState(false)
  const [xpInput,       setXpInput]       = useState('')
  const [showXpInput,   setShowXpInput]   = useState(false)
  const [showLevelUp,   setShowLevelUp]   = useState(false)

  if (!char) return null

  const level    = char.identity.class?.reduce((s, c) => s + (c.level ?? 0), 0) ?? 1
  const dexScore = char.stats?.abilityScores?.dex ?? 10
  const dexMod   = Math.floor((dexScore - 10) / 2)
  const initBonus = dexMod + (char.combat?.initiativeBonus ?? 0)

  const hpCur = char.combat?.hpCurrent ?? 0
  const hpMax = char.combat?.hpMax ?? 1
  const hpPct = Math.max(0, Math.min(100, Math.round((hpCur / hpMax) * 100)))
  const hpColor = hpPct > 66 ? 'var(--hp-high)' : hpPct > 33 ? 'var(--hp-mid)' : 'var(--hp-low)'

  const xp   = char.identity.xp ?? 0
  const next = XP_THRESHOLDS[level]
  const prev = XP_THRESHOLDS[level - 1] ?? 0
  const xpPct = next ? Math.min(100, Math.round(((xp - prev) / (next - prev)) * 100)) : 100

  const className = char.identity.class?.[0]?.name ?? ''
  const race      = char.identity.race ?? ''

  const syncClass = syncStatus === 'saving' ? 'lp-sync--saving'
    : syncStatus === 'saved'  ? 'lp-sync--saved'
    : syncStatus === 'error'  ? 'lp-sync--error'
    : ''
  const syncLabel = syncStatus === 'saving' ? 'Saving…'
    : syncStatus === 'saved'  ? 'Saved'
    : syncStatus === 'error'  ? 'Save failed'
    : ''

  const adjustHP = (delta) => {
    const cur = char.combat.hpCurrent ?? 0
    const max = char.combat.hpMax ?? 0
    updateChar({ combat: { ...char.combat, hpCurrent: Math.max(0, Math.min(max, cur + delta)) } })
  }

  const removeCondition = (cond) => {
    updateChar({
      combat: { ...char.combat, conditions: char.combat.conditions.filter(c => c !== cond) }
    })
  }

  const handleRestConfirm = (updatedChar) => {
    updateChar(updatedChar)
    setShowShortRest(false)
    setShowLongRest(false)
  }

  return (
    <div className={`left-panel left-panel--${portrait ? 'portrait' : 'landscape'}`}>

      {/* ── Char info ── */}
      <div className="lp-char-info">
        <div className="lp-char-info-row">
          <div className="lp-name-block">
            {onBack && (
              <button className="icon-btn lp-back" onClick={onBack} title="Back">←</button>
            )}
            <div>
              <div className="lp-char-name">{char.identity.name}</div>
              <div className="lp-char-meta">{race} · {className} · Lv {level}</div>
            </div>
          </div>
          <div className="lp-char-actions">
            {isOwner
              ? <button className="icon-btn" onClick={onToggleLock} title={locked ? 'Unlock' : 'Lock'}>{locked ? '🔒' : '🔓'}</button>
              : <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>🔒</span>
            }
            <button className="icon-btn" title="Share">↑</button>
            <button className="icon-btn" title="More">⋯</button>
          </div>
        </div>
      </div>

      {/* ── HP block ── */}
      <div className="lp-hp-wrap">
        <div className="lp-hp-block">
          <div className="lp-hp-label">Hit Points</div>
          <div className="lp-hp-row">
            <div>
              <span className="lp-hp-value">{hpCur}</span>
              <span className="lp-hp-max"> / {hpMax}</span>
            </div>
            {isOwner && !locked && (
              <div className="lp-hp-controls">
                <button className="lp-hp-btn" onClick={() => adjustHP(-1)}>−</button>
                <button className="lp-hp-btn lp-hp-btn--plus" onClick={() => adjustHP(+1)}>+</button>
              </div>
            )}
          </div>
          <div className="lp-hp-bar-track">
            <div className="lp-hp-bar-fill" style={{ width: `${hpPct}%`, background: hpColor }} />
          </div>
        </div>
      </div>

      {/* ── Stat tiles ── */}
      <div className="lp-stat-tiles">
        <div className="lp-stat-tile">
          <div className="lp-stat-value">{char.combat?.ac ?? '—'}</div>
          <div className="lp-stat-label">AC</div>
        </div>
        <div className="lp-stat-tile">
          <div className="lp-stat-value">{fmtBonus(initBonus)}</div>
          <div className="lp-stat-label">Init</div>
        </div>
        <div className="lp-stat-tile">
          <div className="lp-stat-value">{char.combat?.speed ?? 30}ft</div>
          <div className="lp-stat-label">Speed</div>
        </div>
      </div>

      {/* ── Conditions ── */}
      <div className="lp-conditions-row">
        {(char.combat?.conditions ?? []).map(c => (
          <span
            key={c}
            className="lp-condition-pill"
            onClick={() => isOwner && !locked && removeCondition(c)}
            title={isOwner && !locked ? 'Click to remove' : c}
          >
            {c}
          </span>
        ))}
        {isOwner && !locked && (
          <button className="lp-add-condition" onClick={() => onTabChange?.('combat')}>+ Add</button>
        )}
      </div>

      {/* ── XP row ── */}
      <div className="lp-xp-row">
        <div className="lp-xp-labels">
          <span>{xp.toLocaleString()} XP</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {next && <span>Lv {level + 1} at {next >= 1000 ? `${Math.round(next / 1000)}k` : next}</span>}
            {isOwner && !locked && (
              <button className="lp-xp-add-btn" onClick={() => setShowXpInput(v => !v)}>
                {showXpInput ? '✕' : '+ XP'}
              </button>
            )}
          </span>
        </div>
        <div className="lp-xp-track">
          <div className="lp-xp-fill" style={{ width: `${xpPct}%` }} />
        </div>
        {showXpInput && isOwner && !locked && (
          <form
            className="lp-xp-form"
            onSubmit={e => {
              e.preventDefault()
              const delta = parseInt(xpInput, 10)
              if (!isNaN(delta) && delta !== 0) {
                const newXp = Math.max(0, xp + delta)
                const updated = { ...char, identity: { ...char.identity, xp: newXp } }
                updateChar({ identity: updated.identity })
                if (checkLevelUp(updated)) setShowLevelUp(true)
              }
              setXpInput('')
              setShowXpInput(false)
            }}
          >
            <input
              className="lp-xp-input"
              type="number"
              placeholder="e.g. 300"
              value={xpInput}
              onChange={e => setXpInput(e.target.value)}
              autoFocus
            />
            <button className="lp-xp-submit" type="submit">Add</button>
          </form>
        )}
      </div>

      {/* ── Saved indicator ── */}
      {syncLabel && (
        <div className={`lp-saved-indicator ${syncClass}`}>
          <div className="lp-saved-dot" />
          {syncLabel}
        </div>
      )}

      {/* ── Rest buttons (landscape, owner, unlocked) ── */}
      {!portrait && isOwner && !locked && (
        <div className="lp-rest-btns">
          <button className="lp-rest-btn lp-rest-btn--short" onClick={() => setShowShortRest(true)}>
            🌙 Short Rest
          </button>
          <button className="lp-rest-btn lp-rest-btn--long" onClick={() => setShowLongRest(true)}>
            🌑 Long Rest
          </button>
        </div>
      )}

      {/* ── Sidebar tabs (landscape only) ── */}
      {!portrait && tabs && (
        <div className="lp-sidebar-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`lp-sidebar-tab${activeTab === tab.id ? ' lp-sidebar-tab--active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              <span className="lp-tab-icon">{tab.icon}</span>
              <span className="lp-tab-label">{tab.label}</span>
            </button>
          ))}
        </div>
      )}

      {showShortRest && (
        <ShortRestModal char={char} onConfirm={handleRestConfirm} onClose={() => setShowShortRest(false)} />
      )}
      {showLongRest && (
        <LongRestModal char={char} onConfirm={handleRestConfirm} onClose={() => setShowLongRest(false)} />
      )}
      {showLevelUp && (
        <LevelUpModal
          char={char}
          onConfirm={updated => { updateChar(updated); setShowLevelUp(false) }}
          onClose={() => setShowLevelUp(false)}
        />
      )}
    </div>
  )
}

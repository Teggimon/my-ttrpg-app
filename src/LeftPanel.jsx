import { useState } from 'react'
import { ShortRestModal, LongRestModal } from './RestModals'
import './LeftPanel.css'

function fmtBonus(n) { return n >= 0 ? `+${n}` : `${n}` }

const XP_THRESHOLDS = [0,300,900,2700,6500,14000,23000,34000,48000,64000,85000,100000,120000,140000,165000,195000,225000,265000,305000,355000]

function XPBar({ char, isOwner, locked, updateChar }) {
  const level = char.identity.class?.[0]?.level ?? 1
  const xp    = char.identity.xp ?? 0
  const next  = XP_THRESHOLDS[level]
  const prev  = XP_THRESHOLDS[level - 1] ?? 0
  const pct   = next ? Math.min(100, Math.round(((xp - prev) / (next - prev)) * 100)) : 100

  return (
    <div className="xp-bar-wrap">
      <div className="xp-meta">
        <span>{xp.toLocaleString()} XP</span>
        {next && <span>Lv {level + 1} at {next.toLocaleString()}</span>}
      </div>
      <div className="xp-track">
        <div className="xp-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function LeftPanel({
  char, isOwner, locked, onToggleLock,
  updateChar, onBack,
  portrait, tabs, activeTab, onTabChange,
  syncStatus,
}) {
  const [showShortRest, setShowShortRest] = useState(false)
  const [showLongRest,  setShowLongRest]  = useState(false)

  if (!char) return null

  const level    = char.identity.class?.reduce((s, c) => s + (c.level ?? 0), 0) ?? 1
  const dexMod   = Math.floor(((char.stats?.DEX ?? char.abilities?.dexterity ?? 10) - 10) / 2)
  const initBonus = dexMod + (char.combat?.initiativeBonus ?? 0)

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
    const max = char.combat.hpMax     ?? 0
    updateChar({ combat: { ...char.combat, hpCurrent: Math.max(0, Math.min(max, cur + delta)) } })
  }

  const removeCondition = (cond) => {
    updateChar({
      combat: {
        ...char.combat,
        conditions: char.combat.conditions.filter(c => c !== cond),
      }
    })
  }

  const handleRestConfirm = (updatedChar) => {
    updateChar(updatedChar)
    setShowShortRest(false)
    setShowLongRest(false)
  }

  return (
    <div className={`left-panel left-panel--${portrait ? 'portrait' : 'landscape'}`}>

      {/* ── Identity row ── */}
      <div className="lp-identity">
        {onBack && (
          <button className="icon-btn lp-back" onClick={onBack} title="Back">←</button>
        )}
        {isOwner && (
          <button className="icon-btn lp-lock" onClick={onToggleLock} title={locked ? 'Unlock sheet' : 'Lock sheet'}>
            {locked ? '🔒' : '🔓'}
          </button>
        )}
        {!isOwner && <span className="icon-btn lp-lock" title="Read only">🔒</span>}
        <div className="lp-name-block">
          <span className="lp-name">{char.identity.name}</span>
          <span className="lp-meta">
            {char.identity.race} · {char.identity.class?.[0]?.name} {level}
          </span>
        </div>
        <div className="lp-actions">
          <button className="icon-btn" title="Share">↑</button>
          <button className="icon-btn" title="More">⋯</button>
        </div>
      </div>

      {/* ── HP block ── */}
      <div className="lp-vitals">
        <div className="lp-hp">
          <div className="lp-hp-label">Hit points</div>
          <div className="lp-hp-row">
            <span className="lp-hp-current">{char.combat.hpCurrent}</span>
            <span className="lp-hp-max">/ {char.combat.hpMax}</span>
            {isOwner && !locked && (
              <div className="lp-hp-btns">
                <button className="hp-btn" onClick={() => adjustHP(-1)}>−</button>
                <button className="hp-btn" onClick={() => adjustHP(+1)}>+</button>
              </div>
            )}
          </div>
        </div>

        <div className="lp-stats">
          <div className="stat-pip">
            <span className="stat-pip-val">{char.combat.ac}</span>
            <span className="stat-pip-lbl">AC</span>
          </div>
          <div className="stat-pip">
            <span className="stat-pip-val">{fmtBonus(initBonus)}</span>
            <span className="stat-pip-lbl">Init</span>
          </div>
          <div className="stat-pip">
            <span className="stat-pip-val">{char.combat.speed}ft</span>
            <span className="stat-pip-lbl">Speed</span>
          </div>
        </div>
      </div>

      {/* ── Conditions ── */}
      {(char.combat.conditions?.length > 0 || (isOwner && !locked)) && (
        <div className="lp-conditions">
          {char.combat.conditions?.map(c => (
            <span
              key={c}
              className="pill pill-danger"
              onClick={() => !locked && isOwner && removeCondition(c)}
            >
              {c} {isOwner && !locked && '×'}
            </span>
          ))}
          {isOwner && !locked && (
            <span className="pill pill-ghost">+ Add</span>
          )}
        </div>
      )}

      {/* ── XP bar ── */}
      <div className="lp-xp">
        <XPBar char={char} isOwner={isOwner} locked={locked} updateChar={updateChar} />
      </div>

      {/* ── Rest buttons (owner only, unlocked) ── */}
      {isOwner && !locked && (
        <div className="lp-rest-btns">
          <button
            className="rest-trigger-btn rest-trigger-btn--short"
            onClick={() => setShowShortRest(true)}
            title="Short Rest — spend Hit Dice to recover HP"
          >
            🌙 Short Rest
          </button>
          <button
            className="rest-trigger-btn rest-trigger-btn--long"
            onClick={() => setShowLongRest(true)}
            title="Long Rest — fully restore HP, spell slots and abilities"
          >
            🌑 Long Rest
          </button>
        </div>
      )}

      {/* ── Sync ── */}
      <div className={`lp-sync ${syncClass}`}>
        <span className="lp-sync-dot" />
        {syncLabel}
      </div>

      {/* ── Nav rail (landscape only) ── */}
      {!portrait && tabs && (
        <nav className="nav-rail">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`nav-rail-item ${activeTab === tab.id ? 'nav-rail-item--active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              <span className="nav-rail-icon">{tab.icon}</span>
              <span className="nav-rail-label">{tab.label}</span>
            </button>
          ))}
        </nav>
      )}

      {/* ── Rest Modals ── */}
      {showShortRest && (
        <ShortRestModal
          char={char}
          onConfirm={handleRestConfirm}
          onClose={() => setShowShortRest(false)}
        />
      )}

      {showLongRest && (
        <LongRestModal
          char={char}
          onConfirm={handleRestConfirm}
          onClose={() => setShowLongRest(false)}
        />
      )}
    </div>
  )
}

import './LeftPanel.css'

const PROFICIENCY = [0, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6]

function abilityMod(score) {
  return Math.floor((score - 10) / 2)
}

function initiativeBonus(char) {
  const dex = char.stats?.abilityScores?.dex ?? 10
  return abilityMod(dex)
}

function fmtBonus(n) {
  return n >= 0 ? `+${n}` : `${n}`
}

export default function LeftPanel({
  char,
  isOwner,
  locked,
  onToggleLock,
  syncStatus,
  updateChar,
  portrait = false,
  tabs,
  activeTab,
  onTabChange,
  onBack,
}) {
  const level = char.identity.class?.[0]?.level ?? 1
  const pb = PROFICIENCY[level] ?? 2
  const initBonus = initiativeBonus(char)

  function adjustHP(delta) {
    const next = Math.max(0, Math.min(char.combat.hpMax, char.combat.hpCurrent + delta))
    updateChar({ combat: { ...char.combat, hpCurrent: next } })
  }

  function removeCondition(cond) {
    updateChar({ combat: { ...char.combat, conditions: char.combat.conditions.filter(c => c !== cond) } })
  }

  const syncLabel = syncStatus === 'saved'  ? '✓ Saved'
                  : syncStatus === 'saving' ? '⟳ Saving…'
                  : '⚠ Error'
  const syncClass = syncStatus === 'saved'  ? 'sync--ok'
                  : syncStatus === 'error'  ? 'sync--err'
                  : 'sync--busy'

  return (
    <div className={`left-panel ${portrait ? 'left-panel--portrait' : 'left-panel--landscape'}`}>

      {/* ── Identity row ── */}
      <div className="lp-identity">
        <button className="icon-btn lp-back" onClick={onBack} title="Back">←</button>
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
            <span key={c} className="pill pill-danger" onClick={() => !locked && isOwner && removeCondition(c)}>
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
    </div>
  )
}

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

import { useState, useMemo } from 'react'
import './RestModals.css'

// ── D&D helpers ───────────────────────────────────────────────

const HIT_DICE = {
  barbarian: 12, fighter: 10, paladin: 10, ranger: 10,
  monk: 8, bard: 8, cleric: 8, druid: 8, rogue: 8, warlock: 8,
  artificer: 8, wizard: 6, sorcerer: 6,
}

function classKey(char) {
  return (char.identity?.class?.[0]?.name ?? '').toLowerCase()
}

function totalLevel(char) {
  return (char.identity?.class ?? []).reduce((s, c) => s + (c.level ?? 0), 0)
}

function getConMod(char) {
  const con = char.stats?.CON ?? char.abilities?.constitution ?? 10
  return Math.floor((con - 10) / 2)
}

function getHitDie(char) {
  return HIT_DICE[classKey(char)] ?? 8
}

// Roll actual Hit Dice and sum results
function rollHitDice(count, die, conMod, hpCurrent, hpMax) {
  let total = 0
  const rolls = []
  for (let i = 0; i < count; i++) {
    const roll = Math.floor(Math.random() * die) + 1
    rolls.push(roll)
    total += Math.max(1, roll + conMod)
  }
  const gained = Math.min(hpMax - hpCurrent, total)
  return { rolls, total, gained }
}

// Average HD recovery estimate
function estimateRecovery(count, die, conMod, hpCurrent, hpMax) {
  const avg = Math.floor(die / 2) + 1
  const perDie = Math.max(1, avg + conMod)
  return Math.min(hpMax - hpCurrent, count * perDie)
}

// SR abilities from character's class abilities
function getSRAbilities(char) {
  return (char.classAbilities ?? char.combat?.classAbilities ?? [])
    .filter(a => a.recharge === 'SR' || a.recharge === 'sr')
}

// LR abilities from character
function getLRAbilities(char) {
  return (char.classAbilities ?? char.combat?.classAbilities ?? [])
    .filter(a => a.recharge === 'LR' || a.recharge === 'lr')
}

// All spell slots
function getSpellSlots(char) {
  return char.spells?.slots ?? {}
}

// Hit dice state: { available, max }
function getHitDiceState(char) {
  const max       = totalLevel(char)
  const available = char.combat?.hitDiceAvailable ?? max
  return { available, max }
}

// Concentration spell
function getConcentration(char) {
  const concIdx = char.spells?.concentration
  if (!concIdx) return null
  return concIdx
}

// ════════════════════════════════════════════════════════════════
//  Short Rest Modal
// ════════════════════════════════════════════════════════════════
export function ShortRestModal({ char, onConfirm, onClose }) {
  const die     = getHitDie(char)
  const conMod  = getConMod(char)
  const hpCur   = char.combat?.hpCurrent ?? 0
  const hpMax   = char.combat?.hpMax     ?? 0
  const hdState = getHitDiceState(char)
  const srAbilities = getSRAbilities(char)

  const [hdSpend, setHdSpend] = useState(1)

  const alreadyFull  = hpCur >= hpMax
  const maxSpendable = Math.min(hdState.available, Math.max(0, hpMax - hpCur > 0 ? hdState.available : 0))
  const estimate     = estimateRecovery(hdSpend, die, conMod, hpCur, hpMax)

  const decHD = () => setHdSpend(v => Math.max(0, v - 1))
  const incHD = () => setHdSpend(v => Math.min(hdState.available, v + 1))

  const takeRest = () => {
    const { gained } = rollHitDice(hdSpend, die, conMod, hpCur, hpMax)

    // Reset SR abilities (set used to 0)
    const updatedAbilities = (char.classAbilities ?? char.combat?.classAbilities ?? []).map(a =>
      (a.recharge === 'SR' || a.recharge === 'sr') ? { ...a, used: 0 } : a
    )

    const updatedChar = {
      ...char,
      combat: {
        ...char.combat,
        hpCurrent:        Math.min(hpMax, hpCur + gained),
        hitDiceAvailable: Math.max(0, hdState.available - hdSpend),
        classAbilities:   updatedAbilities,
      },
    }

    // Also handle if abilities are stored at top level
    if (char.classAbilities) {
      updatedChar.classAbilities = updatedAbilities
    }

    onConfirm(updatedChar, { type: 'short', hdSpent: hdSpend, hpGained: gained })
  }

  return (
    <div className="rest-overlay" onClick={onClose}>
      <div className="rest-sheet" onClick={e => e.stopPropagation()}>
        <div className="rest-handle" />

        <div className="rest-title-row">
          <div className="rest-title">🌙 Short Rest</div>
          <div className="rest-sub">Spend Hit Dice to recover HP. A short rest takes 1 hour.</div>
        </div>

        <div className="rest-summary">

          {/* Current HP */}
          <div className="rest-row">
            <span className="rest-label">Current HP</span>
            <span className="rest-val">
              <span className={hpCur < hpMax * 0.25 ? 'rest-val--danger' : hpCur < hpMax * 0.5 ? 'rest-val--warn' : ''}>
                {hpCur}
              </span>
              {' / '}{hpMax}
            </span>
          </div>

          <div className="rest-divider" />

          {/* Hit Dice available */}
          <div className="rest-row">
            <span className="rest-label">Hit Dice available</span>
            <span className="rest-val">{hdState.available} / {hdState.max} (d{die})</span>
          </div>

          {/* HD stepper */}
          <div className="hd-stepper-row">
            <span className="hd-label">Spend Hit Dice:</span>
            <div className="hd-stepper">
              <button className="hd-btn" onClick={decHD} disabled={hdSpend <= 0}>−</button>
              <div className="hd-val">{hdSpend}</div>
              <button className="hd-btn" onClick={incHD} disabled={hdSpend >= hdState.available}>+</button>
            </div>
            <span className="hd-die-label">× d{die}+{conMod >= 0 ? conMod : conMod}</span>
          </div>

          <div className="rest-divider" />

          {/* Estimated recovery */}
          {hdSpend > 0 ? (
            <div className="rest-row">
              <span className="rest-label">Estimated recovery</span>
              <span className="rest-val rest-val--green">~{estimate} HP</span>
            </div>
          ) : (
            <div className="rest-row">
              <span className="rest-label">Estimated recovery</span>
              <span className="rest-val rest-val--muted">No dice spent</span>
            </div>
          )}

          {alreadyFull && (
            <div className="rest-row">
              <span className="rest-label rest-label--muted">HP already full</span>
              <span className="rest-val rest-val--muted">No recovery needed</span>
            </div>
          )}

          {/* SR abilities restored */}
          {srAbilities.length > 0 && (
            <div className="rest-row rest-row--abilities">
              <span className="rest-label">Abilities restored</span>
              <span className="rest-val rest-val--gold">
                {srAbilities.map(a => a.name).join(' · ')}
              </span>
            </div>
          )}

          {hdState.available === 0 && (
            <div className="rest-row">
              <span className="rest-label rest-label--warn">⚠ No Hit Dice left</span>
              <span className="rest-val rest-val--muted">Take a long rest to restore them</span>
            </div>
          )}
        </div>

        <div className="rest-actions">
          <button className="rest-btn rest-btn--ghost" onClick={onClose}>Cancel</button>
          <button
            className="rest-btn rest-btn--primary"
            onClick={takeRest}
            disabled={hdSpend === 0 && srAbilities.length === 0}
          >
            Take Short Rest
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//  Long Rest Modal
// ════════════════════════════════════════════════════════════════
export function LongRestModal({ char, onConfirm, onClose }) {
  const hpCur      = char.combat?.hpCurrent ?? 0
  const hpMax      = char.combat?.hpMax     ?? 0
  const hdState    = getHitDiceState(char)
  const die        = getHitDie(char)
  const slots      = getSpellSlots(char)
  const srAbilities = getSRAbilities(char)
  const lrAbilities = getLRAbilities(char)
  const allAbilities = [...srAbilities, ...lrAbilities]
  const concentration = getConcentration(char)
  const deathSaves = char.combat?.deathSaves ?? { successes: 0, failures: 0 }

  // HD restored = half max, rounded down (min 1)
  const hdRestored  = Math.max(1, Math.floor(hdState.max / 2))
  const newHdTotal  = Math.min(hdState.max, hdState.available + hdRestored)

  const hpGain     = hpMax - hpCur
  const hasSlots   = Object.values(slots).some(s => s?.max > 0)
  const hasDeaths  = deathSaves.successes > 0 || deathSaves.failures > 0

  const takeRest = () => {
    // Reset all spell slots
    const resetSlots = {}
    Object.entries(slots).forEach(([level, s]) => {
      resetSlots[level] = { ...s, used: 0 }
    })

    // Reset all SR + LR abilities
    const updatedAbilities = (char.classAbilities ?? char.combat?.classAbilities ?? []).map(a => ({
      ...a, used: 0,
    }))

    const updatedChar = {
      ...char,
      combat: {
        ...char.combat,
        hpCurrent:        hpMax,
        hitDiceAvailable: newHdTotal,
        classAbilities:   updatedAbilities,
        deathSaves:       { successes: 0, failures: 0 },
      },
      spells: {
        ...char.spells,
        slots:         resetSlots,
        concentration: null,  // concentration ends on long rest
      },
    }

    if (char.classAbilities) {
      updatedChar.classAbilities = updatedAbilities
    }

    onConfirm(updatedChar, { type: 'long', hpGained: hpGain, hdRestored })
  }

  return (
    <div className="rest-overlay" onClick={onClose}>
      <div className="rest-sheet" onClick={e => e.stopPropagation()}>
        <div className="rest-handle" />

        <div className="rest-title-row">
          <div className="rest-title">🌑 Long Rest</div>
          <div className="rest-sub">A long rest of at least 8 hours fully restores HP, spell slots, and most abilities.</div>
        </div>

        <div className="rest-summary">

          {/* HP */}
          <div className="rest-row">
            <span className="rest-label">HP restored</span>
            <span className="rest-val rest-val--green">
              {hpCur} → {hpMax} HP
              {hpGain > 0 && <span className="rest-delta"> (+{hpGain})</span>}
              {hpGain === 0 && <span className="rest-val--muted"> (already full)</span>}
            </span>
          </div>

          <div className="rest-divider" />

          {/* Spell slots */}
          {hasSlots && (
            <div className="rest-row">
              <span className="rest-label">Spell slots restored</span>
              <span className="rest-val rest-val--green">All slots</span>
            </div>
          )}

          {/* Hit Dice */}
          <div className="rest-row">
            <span className="rest-label">Hit Dice restored</span>
            <span className="rest-val rest-val--green">
              +{Math.min(hdRestored, hdState.max - hdState.available)} d{die}
              <span className="rest-val--muted"> ({newHdTotal}/{hdState.max} total)</span>
            </span>
          </div>

          {/* Abilities */}
          {allAbilities.length > 0 && (
            <div className="rest-row rest-row--abilities">
              <span className="rest-label">Abilities restored</span>
              <span className="rest-val rest-val--green">All SR + LR abilities</span>
            </div>
          )}

          {/* Death saves */}
          {hasDeaths && (
            <div className="rest-row">
              <span className="rest-label">Death saves cleared</span>
              <span className="rest-val rest-val--green">Reset to 0</span>
            </div>
          )}

          {/* Concentration warning */}
          {concentration && (
            <>
              <div className="rest-divider" />
              <div className="rest-row">
                <span className="rest-label rest-label--warn">⚠ Concentration</span>
                <span className="rest-val rest-val--warn">
                  {typeof concentration === 'string' ? concentration : 'Active spell'} ends
                </span>
              </div>
            </>
          )}

          {/* Slot detail */}
          {hasSlots && (
            <div className="rest-slot-detail">
              {Object.entries(slots)
                .filter(([, s]) => (s?.max ?? 0) > 0 && (s?.used ?? 0) > 0)
                .map(([level, s]) => (
                  <div key={level} className="rest-slot-row">
                    <span className="rest-slot-label">Level {level}</span>
                    <div className="rest-slot-pips">
                      {Array.from({ length: s.max }).map((_, i) => (
                        <div
                          key={i}
                          className={`rest-slot-pip${i < s.used ? ' rest-slot-pip--used' : ' rest-slot-pip--free'}`}
                        />
                      ))}
                      <span className="rest-slot-restored">→ all restored</span>
                    </div>
                  </div>
                ))
              }
            </div>
          )}

        </div>

        <div className="rest-actions">
          <button className="rest-btn rest-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="rest-btn rest-btn--primary" onClick={takeRest}>
            Take Long Rest
          </button>
        </div>
      </div>
    </div>
  )
}

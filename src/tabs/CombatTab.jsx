import { useState } from 'react'
import '../TabShared.css'
import './CombatTab.css'

const ALL_CONDITIONS = [
  'Blinded','Charmed','Deafened','Exhaustion','Frightened',
  'Grappled','Incapacitated','Invisible','Paralyzed','Petrified',
  'Poisoned','Prone','Restrained','Stunned','Unconscious',
]

function abilityMod(score) { return Math.floor((score - 10) / 2) }
function fmtBonus(n)        { return n >= 0 ? `+${n}` : `${n}` }

const PROFICIENCY = [0,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6]

export default function CombatTab({ char, locked, isOwner, updateChar }) {
  const [showCondPicker, setShowCondPicker] = useState(false)

  const level   = char.identity.class?.[0]?.level ?? 1
  const pb      = PROFICIENCY[level] ?? 2
  const strMod  = abilityMod(char.stats?.abilityScores?.str ?? 10)
  const dexMod  = abilityMod(char.stats?.abilityScores?.dex ?? 10)

  const equippedWeapons = (char.inventory ?? []).filter(i => i.equipped && i.damage)

  function toggleDeathSave(type, index) {
    const current = char.combat.deathSaves[type]
    const updated = current > index ? index : index + 1
    updateChar({ combat: { ...char.combat, deathSaves: { ...char.combat.deathSaves, [type]: updated } } })
  }

  function toggleSlot(level, index) {
    const slots    = char.spells?.slots ?? {}
    const current  = slots[level] ?? { total: index + 1, used: 0 }
    const used     = current.used > index ? index : index + 1
    updateChar({ spells: { ...char.spells, slots: { ...slots, [level]: { ...current, used } } } })
  }

  function addCondition(cond) {
    if (!char.combat.conditions.includes(cond)) {
      updateChar({ combat: { ...char.combat, conditions: [...char.combat.conditions, cond] } })
    }
    setShowCondPicker(false)
  }

  function removeCondition(cond) {
    updateChar({ combat: { ...char.combat, conditions: char.combat.conditions.filter(c => c !== cond) } })
  }

  const spellSlotEntries = Object.entries(char.spells?.slots ?? {})
    .filter(([, v]) => v.total > 0)
    .sort(([a], [b]) => Number(a) - Number(b))

  const ORDINALS = ['','I','II','III','IV','V','VI','VII','VIII','IX']

  return (
    <div className="tab-combat">

      {/* ── Attacks ── */}
      <div className="sec-head">Attacks</div>
      {equippedWeapons.length === 0 && (
        <p className="empty-hint">
          Equip weapons in the Gear tab to show attacks here.
        </p>
      )}
      {equippedWeapons.map(item => {
        const isFin  = item.properties?.includes('finesse')
        const isRanged = item.properties?.includes('ammunition') || item.throwRange
        const base   = isRanged || (isFin && dexMod > strMod) ? dexMod : strMod
        const enh    = item.enhancement ?? 0
        const toHit  = base + pb + enh
        const dmgBonus = base + enh
        return (
          <div key={item.itemId} className="attack-card card">
            <div className="atk-name">{item.name}</div>
            <span className="badge">{fmtBonus(toHit)} to hit</span>
            <span className="badge">{item.damage.dice}{dmgBonus !== 0 ? fmtBonus(dmgBonus) : ''} {item.damage.type}</span>
          </div>
        )
      })}

      {/* ── Spell slots ── */}
      {spellSlotEntries.length > 0 && (
        <>
          <div className="sec-head">Spell slots</div>
          <div className="card slot-grid">
            {spellSlotEntries.map(([lvl, { total, used }]) => (
              <div key={lvl} className="slot-row">
                <span className="slot-lbl">{ORDINALS[Number(lvl)]}</span>
                <div className="slot-pips">
                  {Array.from({ length: total }, (_, i) => (
                    <button
                      key={i}
                      className={`slot-pip ${i < used ? 'slot-pip--used' : ''}`}
                      onClick={() => isOwner && !locked && toggleSlot(lvl, i)}
                      aria-label={`Slot ${i + 1} ${i < used ? 'used' : 'available'}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Conditions ── */}
      <div className="sec-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Conditions</span>
        {isOwner && !locked && (
          <button className="add-link" onClick={() => setShowCondPicker(v => !v)}>
            {showCondPicker ? 'Cancel' : '+ Add'}
          </button>
        )}
      </div>

      {showCondPicker && (
        <div className="cond-picker card">
          {ALL_CONDITIONS.filter(c => !char.combat.conditions.includes(c)).map(c => (
            <button key={c} className="cond-option" onClick={() => addCondition(c)}>{c}</button>
          ))}
        </div>
      )}

      {char.combat.conditions.length === 0 && !showCondPicker && (
        <p className="empty-hint">No active conditions.</p>
      )}
      {char.combat.conditions.length > 0 && (
        <div className="active-conds">
          {char.combat.conditions.map(c => (
            <span key={c} className="pill pill-danger">
              {c}
              {isOwner && !locked && (
                <button className="cond-remove" onClick={() => removeCondition(c)}>×</button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* ── Death saves ── */}
      <div className="sec-head">Death saves</div>
      <div className="card death-saves">
        {['successes', 'failures'].map(type => (
          <div key={type} className="ds-group">
            <div className="ds-label">{type}</div>
            <div className="ds-pips">
              {[0, 1, 2].map(i => {
                const filled = i < char.combat.deathSaves[type]
                return (
                  <button
                    key={i}
                    className={`ds-pip ds-pip--${type === 'successes' ? 'success' : 'failure'}${filled ? ' ds-pip--filled' : ''}`}
                    onClick={() => isOwner && !locked && toggleDeathSave(type, i)}
                    aria-label={`${type} ${i + 1}`}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── Temp HP / AC editor ── */}
      {isOwner && !locked && (
        <>
          <div className="sec-head">Edit</div>
          <div className="edit-row">
            <label className="edit-field">
              <span>Temp HP</span>
              <input
                type="number"
                min="0"
                value={char.combat.hpTemp ?? 0}
                onChange={e => updateChar({ combat: { ...char.combat, hpTemp: Number(e.target.value) } })}
              />
            </label>
            <label className="edit-field">
              <span>Max HP</span>
              <input
                type="number"
                min="1"
                value={char.combat.hpMax}
                onChange={e => updateChar({ combat: { ...char.combat, hpMax: Number(e.target.value) } })}
              />
            </label>
            <label className="edit-field">
              <span>AC</span>
              <input
                type="number"
                min="0"
                value={char.combat.ac}
                onChange={e => updateChar({ combat: { ...char.combat, ac: Number(e.target.value) } })}
              />
            </label>
            <label className="edit-field">
              <span>Speed (ft)</span>
              <input
                type="number"
                min="0"
                step="5"
                value={char.combat.speed ?? 30}
                onChange={e => updateChar({ combat: { ...char.combat, speed: Number(e.target.value) } })}
              />
            </label>
          </div>
        </>
      )}
    </div>
  )
}

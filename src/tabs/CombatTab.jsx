import { useState, useEffect } from 'react'
import { getEquipment, getSpells } from '../srdContent'
import { xpToLevel } from '../LevelUpModal'
import '../TabShared.css'
import './CombatTab.css'

const ALL_CONDITIONS = [
  'Blinded','Charmed','Deafened','Exhaustion','Frightened',
  'Grappled','Incapacitated','Invisible','Paralyzed','Petrified',
  'Poisoned','Prone','Restrained','Stunned','Unconscious',
]

const ORDINALS    = ['','I','II','III','IV','V','VI','VII','VIII','IX']
const PROFICIENCY = [0,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6]

// Racial traits that are combat-relevant (show in Attacks/Abilities section)
const COMBAT_TRAIT_INDICES = new Set([
  'breath-weapon', 'relentless-endurance', 'savage-attacks',
  'gnome-cunning', 'halfling-luck', 'brave', 'stone-cunning',
  'stonecunning', 'lucky', 'martial-arts', 'unarmored-defense',
])

// Breath weapon damage dice scale by level
function breathDice(level) {
  if (level >= 16) return '5d6'
  if (level >= 11) return '4d6'
  if (level >= 6)  return '3d6'
  return '2d6'
}

function abilityMod(score) { return Math.floor((score - 10) / 2) }
function fmtB(n)            { return n >= 0 ? `+${n}` : `${n}` }

export default function CombatTab({ char, locked, isOwner, updateChar }) {
  const [showCondPicker, setShowCondPicker] = useState(false)
  const [showEdit,       setShowEdit]       = useState(false)
  const [srdMap,         setSrdMap]         = useState({})
  const [spellMap,       setSpellMap]       = useState({})

  const level  = xpToLevel(char.identity?.xp ?? 0)
  const pb     = PROFICIENCY[level] ?? 2
  const scores = char.stats?.abilityScores ?? {}
  const strMod = abilityMod(scores.str ?? 10)
  const dexMod = abilityMod(scores.dex ?? 10)
  const conMod = abilityMod(scores.con ?? 10)
  const hpCur  = char.combat?.hpCurrent ?? 0
  const isDying = hpCur <= 0

  const castAbility = char.spells?.spellcastingAbility
  const castMod     = castAbility ? abilityMod((char.stats?.abilityScores ?? {})[castAbility] ?? 10) : null
  const spellAtk    = castMod != null ? pb + castMod : null

  useEffect(() => {
    getEquipment().then(all => setSrdMap(Object.fromEntries(all.map(e => [e.index, e])))).catch(() => {})
    getSpells().then(all => setSpellMap(Object.fromEntries(all.map(s => [s.index, s])))).catch(() => {})
  }, [])

  // Resolve damage for a weapon item (item data + SRD fallback)
  function resolveWeapon(item) {
    const srd = srdMap[item.index] ?? {}
    const props = item.properties ?? srd.properties?.map(p => p.name) ?? []
    const propsLower = props.map(p => (typeof p === 'string' ? p : p.name ?? '').toLowerCase())

    const isFin    = propsLower.includes('finesse')
    const isRanged = propsLower.includes('ammunition') || propsLower.includes('thrown')
    const useAttr  = isRanged || (isFin && dexMod > strMod) ? 'dex' : 'str'
    const attrMod  = useAttr === 'dex' ? dexMod : strMod
    const enh      = item.enhancement ?? 0
    const toHit    = attrMod + pb + enh
    const dmgMod   = attrMod + enh

    // Damage: prefer stored item.damage, fallback to SRD
    const damageDice = item.damage?.dice ?? srd.damage?.damage_dice ?? null
    const damageType = item.damage?.type ?? srd.damage?.damage_type?.name ?? ''
    if (!damageDice) return null

    const dmgStr = `${damageDice}${dmgMod !== 0 ? fmtB(dmgMod) : ''} ${damageType}`.trim()
    const breakdown = `${useAttr.toUpperCase()} ${fmtB(attrMod)}, Prof ${fmtB(pb)}${enh > 0 ? `, Magic +${enh}` : ''}`

    return { toHit, dmgStr, breakdown }
  }

  // Equipped weapons — any equipped/attuned item that has damage dice
  const equippedWeapons = (char.inventory ?? []).filter(item => {
    if (!item.equipped && !item.attuned) return false
    if (item.damage?.dice) return true
    const srd = srdMap[item.index]
    return !!srd?.damage?.damage_dice
  })

  // Charged items — wands, staves, rods with limited uses (equipped or attuned, no damage dice)
  const chargedItems = (char.inventory ?? []).filter(item =>
    (item.equipped || item.attuned) && item.chargesMax &&
    !item.damage?.dice && !srdMap[item.index]?.damage?.damage_dice
  )

  function useCharge(item) {
    const current = item.chargesCurrent ?? item.chargesMax
    if (current <= 0) return
    updateChar({ inventory: (char.inventory ?? []).map(i =>
      i.itemId === item.itemId ? { ...i, chargesCurrent: current - 1 } : i
    )})
  }

  function restoreCharge(item) {
    const current = item.chargesCurrent ?? item.chargesMax
    if (current >= item.chargesMax) return
    updateChar({ inventory: (char.inventory ?? []).map(i =>
      i.itemId === item.itemId ? { ...i, chargesCurrent: current + 1 } : i
    )})
  }

  // Spell slots
  const slotEntries = Object.entries(char.spells?.slots ?? {})
    .filter(([, v]) => v.total > 0)
    .sort(([a], [b]) => Number(a) - Number(b))

  // Prepared spells (cantrips + prepared leveled spells)
  const known    = char.spells?.known    ?? []
  const prepared = char.spells?.prepared ?? []
  const preparedSpells = known.filter(s =>
    s.level === 0 || prepared.includes(s.id)
  )

  // Racial combat abilities
  const racialCombatTraits = (char.identity.racialTraits ?? [])
    .filter(t => COMBAT_TRAIT_INDICES.has(t.index))

  function castSpell(spellLevel) {
    if (spellLevel === 0) return // cantrips use no slots
    const slots = char.spells?.slots ?? {}
    // Find lowest available slot at or above spell level
    for (let lvl = spellLevel; lvl <= 9; lvl++) {
      const slot = slots[lvl]
      if (slot && slot.used < slot.total) {
        const updated = { ...slots, [lvl]: { ...slot, used: slot.used + 1 } }
        updateChar({ spells: { ...char.spells, slots: updated } })
        return
      }
    }
    // No slots available — nothing to do
  }

  function toggleDeathSave(type, index) {
    const current = char.combat.deathSaves?.[type] ?? 0
    const updated = current > index ? index : index + 1
    updateChar({ combat: { ...char.combat, deathSaves: { ...(char.combat.deathSaves ?? {}), [type]: updated } } })
  }

  function toggleSlot(lvl, index) {
    const slots   = char.spells?.slots ?? {}
    const current = slots[lvl] ?? { total: index + 1, used: 0 }
    const used    = current.used > index ? index : index + 1
    updateChar({ spells: { ...char.spells, slots: { ...slots, [lvl]: { ...current, used } } } })
  }

  function addCondition(cond) {
    if (!(char.combat.conditions ?? []).includes(cond))
      updateChar({ combat: { ...char.combat, conditions: [...(char.combat.conditions ?? []), cond] } })
    setShowCondPicker(false)
  }

  function removeCondition(cond) {
    updateChar({ combat: { ...char.combat, conditions: (char.combat.conditions ?? []).filter(c => c !== cond) } })
  }

  const hasAnything = equippedWeapons.length > 0 || racialCombatTraits.length > 0 || chargedItems.length > 0

  return (
    <div className="tab-combat">

      {/* ── Attacks & Abilities ── */}
      <div className="sec-head">Attacks &amp; Abilities</div>

      {!hasAnything && Object.keys(srdMap).length > 0 && (
        <p className="empty-hint">Equip weapons in the Gear tab to show attacks here.</p>
      )}

      {/* Weapon attack cards */}
      {equippedWeapons.map(item => {
        const resolved = resolveWeapon(item)
        if (!resolved) return null
        const { toHit, dmgStr, breakdown } = resolved
        return (
          <div key={item.itemId ?? item.index ?? item.name} className="attack-card">
            <div className="atk-line1">
              <span className="atk-name">{item.name}</span>
            </div>
            <div className="atk-line2">
              <span className="badge" title={breakdown}>{fmtB(toHit)} to hit</span>
              <span className="badge">{dmgStr}</span>
              <div className="atk-btns">
                <button className="atk-btn atk-btn--roll">Roll</button>
              </div>
            </div>
          </div>
        )
      })}

      {/* Charged item cards — wands, staves, rods etc. */}
      {chargedItems.map(item => {
        const current = item.chargesCurrent ?? item.chargesMax
        const pct     = item.chargesMax > 0 ? current / item.chargesMax : 0
        const enh     = item.enhancement ?? 0
        const useDice = item.useDice
        const useType = item.useDiceType ?? ''
        return (
          <div key={item.itemId ?? item.index} className="attack-card">
            <div className="atk-line1">
              <span className="atk-name">{item.name}</span>
            </div>
            <div className="atk-line2">
              <span className="badge" style={{ color: pct === 0 ? '#f09090' : pct < 0.34 ? '#efa027' : undefined }}>
                {current} / {item.chargesMax} charges
              </span>
              {useDice && (
                <span className="badge">
                  {useDice}{enh > 0 ? `+${enh}` : ''}{useType ? ` ${useType}` : ''}
                </span>
              )}
              <div className="atk-btns">
                <button
                  className="atk-btn atk-btn--use"
                  onClick={() => isOwner && !locked && useCharge(item)}
                  disabled={!isOwner || locked || current <= 0}
                  title="Use one charge"
                >Use</button>
                <button
                  className="atk-btn"
                  onClick={() => isOwner && !locked && restoreCharge(item)}
                  disabled={!isOwner || locked || current >= item.chargesMax}
                  title="Restore one charge"
                  style={{ fontSize:12 }}
                >+</button>
              </div>
            </div>
          </div>
        )
      })}

      {/* Racial ability cards */}
      {racialCombatTraits.map(trait => {
        const isBreath = trait.index === 'breath-weapon'
        return (
          <div key={trait.index} className="attack-card">
            <div className="atk-line1">
              <span className="atk-source">{char.identity.race?.toUpperCase()}</span>
              <span className="atk-name">{trait.name}</span>
            </div>
            <div className="atk-line2">
              {isBreath && (
                <>
                  <span className="badge">{breathDice(level)} damage</span>
                  <span className="badge badge--dim">DEX/CON save DC {8 + pb + conMod}</span>
                </>
              )}
              <div className="atk-btns">
                <button className="atk-btn atk-btn--use">Use</button>
              </div>
            </div>
          </div>
        )
      })}

      {/* ── Spell slots ── */}
      {slotEntries.length > 0 && (
        <>
          <div className="sec-head">Spell Slots</div>
          <div className="card slot-grid">
            {slotEntries.map(([lvl, { total, used }]) => (
              <div key={lvl} className="slot-row">
                <span className="slot-lbl">{ORDINALS[Number(lvl)]}</span>
                <div className="slot-pips">
                  {Array.from({ length: total }, (_, i) => (
                    <button
                      key={i}
                      className={`slot-pip${i < used ? ' slot-pip--used' : ''}`}
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

      {/* ── Prepared Spells ── */}
      {preparedSpells.length > 0 && (
        <>
          <div className="sec-head">Prepared Spells</div>
          {preparedSpells.map(spell => {
            const srd  = spellMap[spell.index] ?? {}
            const isConc = srd.concentration === true
            const dmgDice = srd.damage?.damage_at_character_level
              ? Object.values(srd.damage.damage_at_character_level)[0]
              : srd.damage?.damage_at_slot_level
                ? Object.values(srd.damage.damage_at_slot_level)[0]
                : null
            const dmgType = srd.damage?.damage_type?.name ?? ''
            const isAtk   = !!srd.attack_type

            return (
              <div key={spell.id} className="spell-combat-card">
                <div className="spell-combat-left">
                  <span className={`conc-dot${isConc ? ' conc-dot--on' : ''}`} />
                  <span className="spell-combat-name">{spell.name}</span>
                </div>
                <div className="spell-combat-badges">
                  {dmgDice && <span className="badge">{dmgDice}{dmgType ? ` ${dmgType}` : ''}</span>}
                  {isAtk && spellAtk != null && <span className="badge">{fmtB(spellAtk)} to hit</span>}
                  {isConc && <span className="badge badge--dim">Conc</span>}
                  {spell.level > 0 && <span className="badge badge--dim">Lv {spell.level}</span>}
                  <button
                    className="atk-btn atk-btn--roll"
                    onClick={() => isOwner && !locked && castSpell(spell.level)}
                    title={spell.level === 0 ? 'Cantrip — no slot used' : 'Cast — uses one spell slot'}
                  >Cast</button>
                </div>
              </div>
            )
          })}
        </>
      )}

      {/* ── Conditions ── */}
      <div className="sec-head" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span>Conditions</span>
        {isOwner && !locked && (
          <button className="add-link" onClick={() => setShowCondPicker(v => !v)}>
            {showCondPicker ? 'Cancel' : '+ Add'}
          </button>
        )}
      </div>

      {showCondPicker && (
        <div className="cond-picker card">
          {ALL_CONDITIONS.filter(c => !(char.combat.conditions ?? []).includes(c)).map(c => (
            <button key={c} className="cond-option" onClick={() => addCondition(c)}>{c}</button>
          ))}
        </div>
      )}

      {(char.combat.conditions ?? []).length === 0 && !showCondPicker && (
        <p className="empty-hint">No active conditions.</p>
      )}
      {(char.combat.conditions ?? []).length > 0 && (
        <div className="active-conds">
          {(char.combat.conditions ?? []).map(c => (
            <span key={c} className="pill pill-danger">
              {c}
              {isOwner && !locked && <button className="cond-remove" onClick={() => removeCondition(c)}>×</button>}
            </span>
          ))}
        </div>
      )}

      {/* ── Death saves — only when HP = 0 ── */}
      {isDying && (
        <>
          <div className="sec-head death-head">Death Saves</div>
          <div className="card death-saves">
            {['successes','failures'].map(type => (
              <div key={type} className="ds-group">
                <div className="ds-label">{type === 'successes' ? '✓ Successes' : '✕ Failures'}</div>
                <div className="ds-pips">
                  {[0,1,2].map(i => {
                    const filled = i < (char.combat.deathSaves?.[type] ?? 0)
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
        </>
      )}

      {/* ── Edit stats ── */}
      {isOwner && !locked && (
        <>
          <button className="edit-toggle-btn" onClick={() => setShowEdit(v => !v)}>
            {showEdit ? '▲ Hide edit' : '✎ Edit stats'}
          </button>

          {showEdit && (
            <div className="edit-row">
              <label className="edit-field">
                <span>Temp HP</span>
                <input type="number" min="0"
                  value={char.combat.hpTemp ?? 0}
                  onChange={e => updateChar({ combat: { ...char.combat, hpTemp: Number(e.target.value) } })} />
              </label>
              <label className="edit-field">
                <span>Max HP</span>
                <input type="number" min="1"
                  value={char.combat.hpMax}
                  onChange={e => updateChar({ combat: { ...char.combat, hpMax: Number(e.target.value) } })} />
              </label>
              <label className="edit-field">
                <span>AC</span>
                <input type="number" min="0"
                  value={char.combat.ac ?? 10}
                  onChange={e => updateChar({ combat: { ...char.combat, ac: Number(e.target.value) } })} />
              </label>
              <label className="edit-field">
                <span>Speed (ft)</span>
                <input type="number" min="0" step="5"
                  value={char.combat.speed ?? 30}
                  onChange={e => updateChar({ combat: { ...char.combat, speed: Number(e.target.value) } })} />
              </label>
            </div>
          )}
        </>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { getEquipment, getMagicItems, getSpells } from '../srdContent'
import { xpToLevel } from '../LevelUpModal'
import { ammoKindForItem, ammoKindForWeapon } from '../itemRules'
import '../TabShared.css'
import './CombatTab.css'

const ALL_CONDITIONS = [
  'Blinded','Charmed','Deafened','Exhaustion','Frightened',
  'Grappled','Incapacitated','Invisible','Paralyzed','Petrified',
  'Poisoned','Prone','Restrained','Stunned','Unconscious',
]

const ORDINALS    = ['','I','II','III','IV','V','VI','VII','VIII','IX']
const PROFICIENCY = [0,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6]

function characterLevel(char) {
  return (char.identity?.class ?? []).reduce((sum, cls) => sum + (cls.level ?? 0), 0) || xpToLevel(char.identity?.xp ?? 0)
}

// Racial traits that are combat-relevant (show in Attacks/Abilities section)
const COMBAT_TRAIT_INDICES = new Set([
  'breath-weapon', 'relentless-endurance', 'savage-attacks',
  'gnome-cunning', 'halfling-luck', 'brave', 'stone-cunning',
  'stonecunning', 'lucky', 'martial-arts', 'unarmored-defense',
])

// Breath weapon damage dice scale by level
function breathDice(level, trait) {
  if (trait?.source === 'XPHB' || trait?.source === 'FTD') {
    if (level >= 17) return '4d10'
    if (level >= 11) return '3d10'
    if (level >= 5) return '2d10'
    return '1d10'
  }
  if (level >= 16) return '5d6'
  if (level >= 11) return '4d6'
  if (level >= 6)  return '3d6'
  return '2d6'
}

function abilityMod(score) { return Math.floor((score - 10) / 2) }
function fmtB(n)            { return n >= 0 ? `+${n}` : `${n}` }
function featureKey(name)   { return String(name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-') }
function itemKey(item) {
  return item.itemId ?? item.index ?? item.name
}
function itemEffectBonus(item, statName) {
  const effects = (item.effects ?? []).filter(effect =>
    String(effect.stat ?? '').toLowerCase() === statName.toLowerCase()
  )
  const setEffect = [...effects].reverse().find(effect => effect.mode === 'set')
  if (setEffect) return Number(setEffect.value) || 0
  return effects
    .filter(effect => (effect.mode ?? 'add') === 'add')
    .reduce((sum, effect) => sum + (Number(effect.value) || 0), 0)
}

function sneakAttackDice(level) {
  return `${Math.ceil(Math.max(1, level) / 2)}d6`
}

function breathWeaponLimit(trait, pb) {
  if (trait?.source === 'XPHB' || trait?.source === 'FTD') {
    return { max: pb, recharge: 'LR', label: 'LR' }
  }
  return { max: 1, recharge: 'SR', label: 'SR' }
}

function hasClassFeatureChoice(char, optionName) {
  return (char.customContent?.classFeatureChoices ?? []).some(choice =>
    (choice.options ?? []).some(option => option.name === optionName)
  )
}

function isMagicItem(item, srdMap) {
  const srd = srdMap[item.index] ?? {}
  return !!(
    item.rarity || srd.rarity ||
    item.type === 'Magic Item' ||
    item.requiresAttunement || srd.requires_attunement ||
    (item.enhancement ?? 0) > 0 ||
    item.ac_bonus != null ||
    item.chargesMax ||
    (item.effects ?? []).length > 0
  )
}

export default function CombatTab({ char, locked, isOwner, updateChar }) {
  const [showCondPicker, setShowCondPicker] = useState(false)
  const [showEdit,       setShowEdit]       = useState(false)
  const [srdMap,         setSrdMap]         = useState({})
  const [spellMap,       setSpellMap]       = useState({})
  const [castSlots,      setCastSlots]      = useState({})
  const [versatileMode,  setVersatileMode]  = useState({})

  const level  = characterLevel(char)
  const pb     = PROFICIENCY[level] ?? 2
  const scores = char.stats?.abilityScores ?? {}
  const strMod = abilityMod(scores.str ?? 10)
  const dexMod = abilityMod(scores.dex ?? 10)
  const conMod = abilityMod(scores.con ?? 10)
  const hpCur  = char.combat?.hpCurrent ?? 0
  const isDying = hpCur <= 0
  const actionEconomy = {
    action: char.combat?.actionEconomy?.action ?? 1,
    bonusAction: char.combat?.actionEconomy?.bonusAction ?? 1,
    reaction: char.combat?.actionEconomy?.reaction ?? 1,
  }

  const castAbility = char.spells?.spellcastingAbility
  const castMod     = castAbility ? abilityMod((char.stats?.abilityScores ?? {})[castAbility] ?? 10) : null
  const spellAtk    = castMod != null ? pb + castMod : null

  useEffect(() => {
    Promise.all([getEquipment().catch(() => []), getMagicItems().catch(() => [])])
      .then(([equipment, magicItems]) => setSrdMap(Object.fromEntries([...equipment, ...magicItems].map(e => [e.index, e]))))
    getSpells().then(all => setSpellMap(Object.fromEntries(all.map(s => [s.index, s])))).catch(() => {})
  }, [])

  // Resolve damage for a weapon item (item data + SRD fallback)
  function resolveWeapon(item) {
    const srd = srdMap[item.index] ?? {}
    const props = item.properties ?? srd.properties?.map(p => p.name) ?? []
    const propsLower = props.map(p => (typeof p === 'string' ? p : p.name ?? '').toLowerCase())

    const isFin    = propsLower.includes('finesse')
    const usesAmmo = propsLower.includes('ammunition')
    const isRanged = usesAmmo || propsLower.includes('thrown')
    const useAttr  = isRanged || (isFin && dexMod > strMod) ? 'dex' : 'str'
    const attrMod  = useAttr === 'dex' ? dexMod : strMod
    const enh      = item.enhancement ?? 0
    const attackEffectBonus = itemEffectBonus(item, 'Attack Roll')
    const damageEffectBonus = itemEffectBonus(item, 'Damage')
    const archeryBonus = usesAmmo && hasClassFeatureChoice(char, 'Archery') ? 2 : 0
    const toHit    = attrMod + pb + enh + attackEffectBonus + archeryBonus
    const dmgMod   = attrMod + enh + damageEffectBonus

    // Damage: prefer stored item.damage, fallback to SRD
    const damageDice = item.damage?.dice ?? srd.damage?.damage_dice ?? null
    const versatileDice = item.damage?.versatile ?? srd.damage?.versatile ?? null
    const damageType = item.damage?.type ?? srd.damage?.damage_type?.name ?? ''
    if (!damageDice) return null

    const dmgStr = `${damageDice}${dmgMod !== 0 ? fmtB(dmgMod) : ''} ${damageType}`.trim()
    const versatileStr = versatileDice
      ? `${versatileDice}${dmgMod !== 0 ? fmtB(dmgMod) : ''} ${damageType} versatile`.trim()
      : null
    const breakdown = [
      `${useAttr.toUpperCase()} ${fmtB(attrMod)}`,
      `Prof ${fmtB(pb)}`,
      enh ? `Magic ${fmtB(enh)}` : null,
      attackEffectBonus ? `Attack effect ${fmtB(attackEffectBonus)}` : null,
      damageEffectBonus ? `Damage effect ${fmtB(damageEffectBonus)}` : null,
      archeryBonus ? 'Archery +2' : null,
    ].filter(Boolean).join(', ')

    return { toHit, dmgStr, versatileStr, breakdown, usesAmmo }
  }

  function isAmmoItem(item) {
    const srd = srdMap[item.index] ?? {}
    return item.isAmmo || srd.equipment_category?.index === 'ammunition' || item.equipment_category?.index === 'ammunition'
  }

  function ammoForWeapon(weapon) {
    const srd = srdMap[weapon.index] ?? {}
    const wantedKind = ammoKindForWeapon(weapon, srd)
    const ammo = (char.inventory ?? [])
      .map((item, inventoryIndex) => ({ item, inventoryIndex }))
      .filter(({ item }) => isAmmoItem(item) && (item.quantity ?? 0) > 0)
      .map(({ item, inventoryIndex }) => ({
        item,
        inventoryIndex,
        kind: ammoKindForItem(item),
      }))
    if (wantedKind) return ammo.find(entry => entry.kind === wantedKind) ?? null
    return ammo[0] ?? null
  }

  function spendAmmoForWeapon(weapon) {
    const ammoEntry = ammoForWeapon(weapon)
    if (!ammoEntry) return
    updateChar({
      inventory: (char.inventory ?? [])
        .map((item, inventoryIndex) => inventoryIndex === ammoEntry.inventoryIndex
          ? { ...item, quantity: Math.max(0, (item.quantity ?? 1) - 1) }
          : item
        )
        .filter(item => (item.quantity ?? 1) > 0)
    })
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

  function spendCharge(item) {
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
  const pactSlotEntries = Object.entries(char.spells?.pactSlots ?? {})
    .filter(([, v]) => v.total > 0)
    .sort(([a], [b]) => Number(a) - Number(b))

  // Prepared spells (cantrips + prepared leveled spells)
  const known    = char.spells?.known    ?? []
  const prepared = char.spells?.prepared ?? []
  const preparedSpells = known.filter(s =>
    s.level === 0 || prepared.includes(s.id)
  )

  // Racial combat abilities
  const racialCombatTraits = (char.identity?.racialTraits ?? char.racialTraits ?? [])
    .filter(t => COMBAT_TRAIT_INDICES.has(t.index))

  function availableSlotOptions(spellLevel) {
    if (spellLevel === 0) return [] // cantrips use no slots
    const slots = char.spells?.slots ?? {}
    const normalOptions = Object.entries(slots)
      .filter(([lvl, slot]) => Number(lvl) >= spellLevel && slot.total > 0 && slot.used < slot.total)
      .map(([lvl]) => ({
        pool: 'slots',
        level: Number(lvl),
        value: `slots:${lvl}`,
        label: `Lv ${lvl}`,
      }))
    const pactOptions = Object.entries(char.spells?.pactSlots ?? {})
      .filter(([lvl, slot]) => Number(lvl) >= spellLevel && slot.total > 0 && slot.used < slot.total)
      .map(([lvl]) => ({
        pool: 'pactSlots',
        level: Number(lvl),
        value: `pactSlots:${lvl}`,
        label: `Pact Lv ${lvl}`,
      }))
    return [...normalOptions, ...pactOptions]
      .sort((a, b) => a.level - b.level || (a.pool === 'slots' ? -1 : 1))
  }

  function castSpell(spellLevel, slotValue) {
    if (spellLevel === 0) return // cantrips use no slots
    const [pool = 'slots', slotLevel] = String(slotValue ?? '').split(':')
    const slotPool = pool === 'pactSlots' ? 'pactSlots' : 'slots'
    const slots = char.spells?.[slotPool] ?? {}
    const slot = slots[slotLevel]
    if (!slot || slot.used >= slot.total) return
    updateChar({
      spells: {
        ...char.spells,
        [slotPool]: { ...slots, [slotLevel]: { ...slot, used: slot.used + 1 } },
      },
    })
  }

  function toggleDeathSave(type, index) {
    const current = char.combat.deathSaves?.[type] ?? 0
    const updated = current > index ? index : index + 1
    updateChar({ combat: { ...char.combat, deathSaves: { ...(char.combat.deathSaves ?? {}), [type]: updated } } })
  }

  function toggleSlot(lvl, index, pool = 'slots') {
    const slotPool = pool === 'pactSlots' ? 'pactSlots' : 'slots'
    const slots   = char.spells?.[slotPool] ?? {}
    const current = slots[lvl] ?? { total: index + 1, used: 0 }
    const used    = current.used > index ? index : index + 1
    updateChar({ spells: { ...char.spells, [slotPool]: { ...slots, [lvl]: { ...current, used } } } })
  }

  function addCondition(cond) {
    if (!(char.combat.conditions ?? []).includes(cond))
      updateChar({ combat: { ...char.combat, conditions: [...(char.combat.conditions ?? []), cond] } })
    setShowCondPicker(false)
  }

  function removeCondition(cond) {
    updateChar({ combat: { ...char.combat, conditions: (char.combat.conditions ?? []).filter(c => c !== cond) } })
  }

  function setActionEconomy(patch) {
    updateChar({ combat: { ...char.combat, actionEconomy: { ...actionEconomy, ...patch } } })
  }

  function spendAction(kind) {
    if (!isOwner || locked) return
    setActionEconomy({ [kind]: Math.max(0, (actionEconomy[kind] ?? 0) - 1) })
  }

  function resetTurn() {
    if (!isOwner || locked) return
    setActionEconomy({ action: 1, bonusAction: 1, reaction: 1 })
  }

  const fighterLevel = (char.identity?.class ?? [])
    .filter(cls => /fighter/i.test(cls.name ?? cls.index ?? ''))
    .reduce((sum, cls) => sum + (cls.level ?? 0), 0)
  const rogueLevel = (char.identity?.class ?? [])
    .filter(cls => /rogue/i.test(cls.name ?? cls.index ?? ''))
    .reduce((sum, cls) => sum + (cls.level ?? 0), 0)

  const storedAbilities = char.combat?.classAbilities ?? char.classAbilities ?? []
  const storedAbilityMap = Object.fromEntries(storedAbilities.flatMap(ability => [
    [featureKey(ability.name), ability],
    ability.key ? [ability.key, ability] : null,
  ].filter(Boolean)))
  const classFeatures = char.customContent?.classFeatures ?? []
  const combatFeatures = classFeatures
    .filter(feature => /^(second wind|action surge|sneak attack)$/i.test(feature.name ?? ''))
    .filter((feature, index, list) => list.findIndex(other => featureKey(other.name) === featureKey(feature.name)) === index)
    .map(feature => {
      const key = featureKey(feature.name)
      const isActionSurge = key === 'action-surge'
      const isSneakAttack = key === 'sneak-attack'
      const max = isActionSurge
        ? (fighterLevel >= 17 ? 2 : 1)
        : isSneakAttack
          ? null
          : (/xphb/i.test(feature.source ?? '') ? 2 : 1)
      return {
        ...feature,
        key,
        sourceType: 'Class',
        actionType: isActionSurge ? 'Free' : isSneakAttack ? 'Once/turn' : 'Bonus',
        recharge: isSneakAttack ? null : 'SR',
        max,
        used: storedAbilityMap[key]?.used ?? 0,
        effect: isActionSurge
          ? '+1 Action'
          : isSneakAttack
            ? `${sneakAttackDice(rogueLevel || level)} extra`
            : `1d10 + ${fighterLevel || 'Fighter level'} HP`,
      }
    })
  const martialAdeptChoice = (char.customContent?.featChoices ?? []).find(choice => choice.featName === 'Martial Adept')
  const featCombatFeatures = martialAdeptChoice?.maneuvers?.length
    ? [{
        name: 'Martial Adept',
        key: 'feat-martial-adept',
        sourceType: 'Feat',
        actionType: 'Maneuver',
        recharge: 'SR',
        max: 1,
        used: storedAbilityMap['feat-martial-adept']?.used ?? 0,
        effect: '1d6 superiority',
        detail: martialAdeptChoice.maneuvers.map(maneuver => maneuver.name).join(' · '),
      }]
    : []

  const raceAbilityFeatures = racialCombatTraits.map(trait => {
    const isBreath = trait.index === 'breath-weapon'
    const breathLimit = isBreath ? breathWeaponLimit(trait, pb) : null
    const key = `race-${trait.index}`
    return {
      ...trait,
      key,
      sourceType: char.identity.race || 'Race',
      actionType: isBreath ? 'Action' : 'Trait',
      recharge: breathLimit?.recharge ?? null,
      max: breathLimit?.max ?? null,
      used: storedAbilityMap[key]?.used ?? 0,
      effect: isBreath
        ? `${breathDice(level, trait)}${trait.damageType ? ` ${trait.damageType}` : ''}`
        : trait.name,
      detail: isBreath
        ? [
            trait.breathWeapon,
            `${trait.savingThrow ?? 'DEX/CON'} DC ${8 + pb + conMod}`,
            `${breathLimit.max}/${breathLimit.label}`,
          ].filter(Boolean).join(' · ')
        : null,
    }
  })
  const combatAbilityFeatures = [...combatFeatures, ...featCombatFeatures, ...raceAbilityFeatures]

  function handleCombatFeature(feature) {
    if (!isOwner || locked || !feature.max || feature.used >= feature.max) return
    const nextAbility = {
      name: feature.name,
      key: feature.key,
      recharge: feature.recharge,
      max: feature.max,
      used: feature.used + 1,
    }
    const nextAbilities = [
      ...storedAbilities.filter(ability => featureKey(ability.name) !== feature.key && ability.key !== feature.key),
      nextAbility,
    ]
    const nextEconomy = feature.key === 'action-surge'
      ? { ...actionEconomy, action: (actionEconomy.action ?? 0) + 1 }
      : actionEconomy
    updateChar({
      combat: {
        ...char.combat,
        classAbilities: nextAbilities,
        actionEconomy: nextEconomy,
      },
    })
  }

  const hasAnything = equippedWeapons.length > 0 || chargedItems.length > 0 || combatAbilityFeatures.length > 0

  return (
    <div className="tab-combat">
      <div className="action-economy">
        {[
          { key: 'action', label: 'Action' },
          { key: 'bonusAction', label: 'Bonus' },
          { key: 'reaction', label: 'Reaction' },
        ].map(action => (
          <button
            key={action.key}
            className={`action-square${actionEconomy[action.key] <= 0 ? ' action-square--spent' : ''}`}
            type="button"
            onClick={() => spendAction(action.key)}
            disabled={!isOwner || locked}
          >
            <span className="action-square-count">{actionEconomy[action.key]}</span>
            <span className="action-square-label">{action.label}</span>
          </button>
        ))}
        <button className="action-reset-square" type="button" onClick={resetTurn} disabled={!isOwner || locked}>
          Reset
        </button>
      </div>

      {/* ── Attacks & Abilities ── */}
      <div className="sec-head">Attacks &amp; Abilities</div>

      {!hasAnything && Object.keys(srdMap).length > 0 && (
        <p className="empty-hint">Equip weapons in the Gear tab to show attacks here.</p>
      )}

      {/* Weapon attack cards */}
      {equippedWeapons.map(item => {
        const resolved = resolveWeapon(item)
        if (!resolved) return null
        const { toHit, dmgStr, versatileStr, breakdown, usesAmmo } = resolved
        const key = itemKey(item)
        const useVersatile = !!versatileStr && !!versatileMode[key]
        const selectedDamage = useVersatile ? versatileStr : dmgStr
        const ammoEntry = usesAmmo ? ammoForWeapon(item) : null
        const ammo = ammoEntry?.item
        return (
          <div key={key} className={`attack-card${isMagicItem(item, srdMap) ? ' attack-card--magic' : ''}`}>
            <div className="atk-line1">
              <span className="atk-name">{item.name}</span>
            </div>
            <div className="atk-line2">
              <span className="badge" title={breakdown}>{fmtB(toHit)} to hit</span>
              <button
                className={`badge atk-damage-choice${!useVersatile ? ' atk-damage-choice--active' : ''}`}
                type="button"
                onClick={() => setVersatileMode(prev => ({ ...prev, [key]: false }))}
                aria-pressed={!useVersatile}
                title="Use one-handed damage"
              >
                {dmgStr}
              </button>
              {versatileStr && (
                <button
                  className={`badge atk-damage-choice${useVersatile ? ' atk-damage-choice--active' : ''}`}
                  type="button"
                  onClick={() => setVersatileMode(prev => ({ ...prev, [key]: true }))}
                  aria-pressed={useVersatile}
                  title="Use versatile two-handed damage"
                >
                  {versatileStr}
                </button>
              )}
              {usesAmmo && (
                <span className="badge badge--ammo" style={{ color: ammo ? undefined : 'var(--danger)' }}>
                  {ammo ? `${ammo.quantity ?? 1} ${ammo.name}` : 'No ammo'}
                </span>
              )}
              <div className="atk-btns">
                <button
                  className="atk-btn atk-btn--roll"
                  onClick={() => isOwner && !locked && usesAmmo && spendAmmoForWeapon(item)}
                  disabled={!isOwner || locked || (usesAmmo && !ammo)}
                  title={usesAmmo ? (ammo ? `Use 1 ${ammo.name} and roll ${selectedDamage}` : 'No matching ammunition in Gear') : `Roll ${selectedDamage}`}
                >
                  {usesAmmo ? 'Use' : 'Roll'}
                </button>
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
          <div key={item.itemId ?? item.index} className={`attack-card${isMagicItem(item, srdMap) ? ' attack-card--magic' : ''}`}>
            <div className="atk-line1">
              <span className="atk-name">{item.name}</span>
            </div>
            <div className="atk-line2">
              <span className="badge" style={{ color: pct === 0 ? 'var(--danger)' : pct < 0.34 ? 'var(--warning)' : undefined }}>
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
                  onClick={() => isOwner && !locked && spendCharge(item)}
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

      {combatAbilityFeatures.length > 0 && (
        <div className="combat-feature-grid" aria-label="Combat abilities">
          {combatAbilityFeatures.map(feature => {
            const remaining = feature.max ? Math.max(0, feature.max - feature.used) : null
            const isSpent = remaining != null && remaining <= 0
            const title = Array.isArray(feature.desc) ? feature.desc.join(' ') : feature.detail ?? ''
            return feature.max ? (
              <button
                key={feature.key}
                className={`combat-feature-square${isSpent ? ' combat-feature-square--spent' : ''}`}
                type="button"
                onClick={() => handleCombatFeature(feature)}
                disabled={!isOwner || locked || isSpent}
                title={title}
              >
                <span className="combat-feature-name">{feature.name}</span>
                <span className="combat-feature-effect">{feature.effect}</span>
                <span className="combat-feature-meta">{feature.actionType} · {remaining}/{feature.max}</span>
              </button>
            ) : (
              <div key={feature.key} className="combat-feature-square combat-feature-square--static" title={title}>
                <span className="combat-feature-source">{String(feature.sourceType).toUpperCase()}</span>
                <span className="combat-feature-name">{feature.name}</span>
                <span className="combat-feature-effect">{feature.effect}</span>
                <span className="combat-feature-meta">{feature.detail || feature.actionType}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Spell slots ── */}
      {(slotEntries.length > 0 || pactSlotEntries.length > 0) && (
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
            {pactSlotEntries.map(([lvl, { total, used }]) => (
              <div key={`pact-${lvl}`} className="slot-row slot-row--pact">
                <span className="slot-lbl slot-lbl--pact">Pact {ORDINALS[Number(lvl)]}</span>
                <div className="slot-pips">
                  {Array.from({ length: total }, (_, i) => (
                    <button
                      key={i}
                      className={`slot-pip slot-pip--pact${i < used ? ' slot-pip--used' : ''}`}
                      onClick={() => isOwner && !locked && toggleSlot(lvl, i, 'pactSlots')}
                      aria-label={`Pact slot ${i + 1} ${i < used ? 'used' : 'available'}`}
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
            const availableSlots = spell.level > 0 ? availableSlotOptions(spell.level) : []
            const selectedSlot = availableSlots.some(option => option.value === castSlots[spell.id])
              ? castSlots[spell.id]
              : availableSlots[0]?.value
            const selectedSlotLevel = availableSlots.find(option => option.value === selectedSlot)?.level
            const dmgDice = srd.damage?.damage_at_character_level
              ? Object.values(srd.damage.damage_at_character_level)[0]
              : srd.damage?.damage_at_slot_level
                ? srd.damage.damage_at_slot_level[selectedSlotLevel] ?? srd.damage.damage_at_slot_level[spell.level] ?? Object.values(srd.damage.damage_at_slot_level)[0]
                : null
            const dmgType = srd.damage?.damage_type?.name ?? ''
            const isAtk   = !!srd.attack_type

            return (
              <div key={spell.id} className="spell-combat-card">
                <div className="spell-combat-line1">
                  <span className={`conc-dot${isConc ? ' conc-dot--on' : ''}`} />
                  <span className="spell-combat-name">{spell.name}</span>
                </div>
                <div className="spell-combat-line2">
                  {dmgDice && <span className="badge">{dmgDice}{dmgType ? ` ${dmgType}` : ''}</span>}
                  {isAtk && spellAtk != null && <span className="badge">{fmtB(spellAtk)} to hit</span>}
                  {isConc && <span className="badge badge--dim">Conc</span>}
                  {spell.level > 0 && <span className="badge badge--dim">Lv {spell.level}</span>}
                  {spell.level > 0 && (
                    <select
                      className="cast-slot-select"
                      value={selectedSlot ?? ''}
                      onChange={e => setCastSlots(prev => ({ ...prev, [spell.id]: e.target.value }))}
                      disabled={!isOwner || locked || availableSlots.length === 0}
                      title="Choose spell slot level"
                    >
                      {availableSlots.length === 0 ? (
                        <option value="">No slots</option>
                      ) : availableSlots.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  )}
                  <div className="atk-btns">
                    <button
                      className="atk-btn atk-btn--roll"
                      onClick={() => isOwner && !locked && castSpell(spell.level, selectedSlot)}
                      disabled={spell.level > 0 && !selectedSlot}
                      title={spell.level === 0 ? 'Cantrip — no slot used' : 'Cast — uses one spell slot'}
                    >Cast</button>
                  </div>
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
            {showEdit ? 'Hide edit' : 'Edit stats'}
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

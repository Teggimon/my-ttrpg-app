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
const SPELLCASTING_ABILITY = {
  bard: 'cha',
  cleric: 'wis',
  druid: 'wis',
  paladin: 'cha',
  ranger: 'wis',
  sorcerer: 'cha',
  warlock: 'cha',
  wizard: 'int',
  artificer: 'int',
  eldritchKnight: 'int',
  arcaneTrickster: 'int',
}

function characterLevel(char) {
  return (char.identity?.class ?? []).reduce((sum, cls) => sum + (cls.level ?? 0), 0) || xpToLevel(char.identity?.xp ?? 0)
}
function classIndex(cls) {
  return cls?.index ?? cls?.name?.toLowerCase?.().replace(/\s+/g, '-')
}
function classLevel(char, index) {
  return (char.identity?.class ?? []).find(cls => classIndex(cls) === index)?.level ?? null
}
function spellCastingAbility(spell, char) {
  return spell.castingAbility
    ?? SPELLCASTING_ABILITY[spell.classIndex]
    ?? char.spells?.spellcastingAbility
    ?? null
}
function cantripScalingLevel(spell, char, fallbackLevel) {
  if (char.settings?.cantripScaling !== 'class') return fallbackLevel
  return classLevel(char, spell.classIndex) ?? fallbackLevel
}
function damageForCharacterLevel(table, level) {
  const bestLevel = Object.keys(table ?? {})
    .map(Number)
    .filter(key => key <= level)
    .sort((a, b) => b - a)[0]
  if (bestLevel != null) return table[bestLevel]
  const firstLevel = Object.keys(table ?? {}).map(Number).sort((a, b) => a - b)[0]
  return firstLevel != null ? table[firstLevel] : null
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

function rageUses(level, source) {
  if (!/xphb/i.test(source ?? '') && level >= 20) return null
  if (level >= 17) return 6
  if (level >= 12) return 5
  if (level >= 6) return 4
  if (level >= 3) return 3
  return level >= 1 ? 2 : 0
}

function rageDamage(level) {
  if (level >= 16) return 4
  if (level >= 9) return 3
  return level >= 1 ? 2 : 0
}

function bardicDie(level) {
  if (level >= 15) return 'd12'
  if (level >= 10) return 'd10'
  if (level >= 5) return 'd8'
  return 'd6'
}

function indomitableUses(level) {
  if (level >= 17) return 3
  if (level >= 13) return 2
  return level >= 9 ? 1 : 0
}

function secondWindUses(level, source) {
  if (!/xphb/i.test(source ?? '')) return 1
  if (level >= 10) return 4
  if (level >= 4) return 3
  return 2
}

function brutalCriticalDice(level) {
  if (level >= 17) return 3
  if (level >= 13) return 2
  return level >= 9 ? 1 : 0
}

function clericChannelUses(level) {
  if (level >= 18) return 3
  if (level >= 6) return 2
  return level >= 2 ? 1 : 0
}

function xphbClericChannelUses(level) {
  if (level >= 18) return 4
  if (level >= 6) return 3
  return level >= 2 ? 2 : 0
}

function paladinChannelUses(level, source) {
  if (!/xphb/i.test(source ?? '')) return level >= 3 ? 1 : 0
  if (level >= 11) return 3
  return level >= 3 ? 2 : 0
}

function wildShapeUses(level, source) {
  if (!/xphb/i.test(source ?? '')) return level >= 20 ? null : 2
  if (level >= 18) return 4
  if (level >= 6) return 3
  return level >= 2 ? 2 : 0
}

function xphbFavoredEnemyUses(level) {
  if (level >= 17) return 6
  if (level >= 13) return 5
  if (level >= 9) return 4
  if (level >= 5) return 3
  return level >= 1 ? 2 : 0
}

function mysticArcanumCount(level) {
  return [11, 13, 15, 17].filter(required => level >= required).length
}

function mysticArcanumLevels(level) {
  return [
    level >= 11 && '6th',
    level >= 13 && '7th',
    level >= 15 && '8th',
    level >= 17 && '9th',
  ].filter(Boolean).join(', ')
}

function martialArtsDie(level, source) {
  if (/xphb/i.test(source ?? '')) {
    if (level >= 17) return '1d12'
    if (level >= 11) return '1d10'
    if (level >= 5) return '1d8'
    return '1d6'
  }
  if (level >= 17) return '1d10'
  if (level >= 11) return '1d8'
  if (level >= 5) return '1d6'
  return '1d4'
}

function extraAttackCount({ fighterLevel, barbarianLevel, monkLevel, paladinLevel, rangerLevel }) {
  return Math.max(
    fighterLevel >= 20 ? 4 : fighterLevel >= 11 ? 3 : fighterLevel >= 5 ? 2 : 1,
    barbarianLevel >= 5 ? 2 : 1,
    monkLevel >= 5 ? 2 : 1,
    paladinLevel >= 5 ? 2 : 1,
    rangerLevel >= 5 ? 2 : 1,
  )
}

function hasClassFeatureChoice(char, optionName) {
  return (char.customContent?.classFeatureChoices ?? []).some(choice =>
    (choice.options ?? []).some(option => option.name === optionName)
  )
}

function selectedClassFeatureOptionNames(char) {
  return new Set((char.customContent?.classFeatureChoices ?? []).flatMap(choice =>
    (choice.options ?? []).map(option => option.name)
  ))
}

function classFeatureChoiceOptions(char, predicate) {
  return (char.customContent?.classFeatureChoices ?? []).flatMap(choice =>
    (choice.options ?? [])
      .filter(option => predicate(option, choice))
      .map(option => ({ ...option, choice }))
  )
}

function classSourceFor(char, classIndexValue, featurePattern = null) {
  const identitySource = (char.identity?.class ?? []).find(cls => classIndex(cls) === classIndexValue)?.source
  if (identitySource) return identitySource
  const feature = (char.customContent?.classFeatures ?? []).find(item => {
    const featureClass = classIndex({ index: item.classIndex, name: item.className })
    return featureClass === classIndexValue && (!featurePattern || featurePattern.test(item.name ?? ''))
  })
  return feature?.source ?? null
}

function hasClassFeature(char, classIndexValue, featurePattern) {
  return (char.customContent?.classFeatures ?? []).some(item => {
    const featureClass = classIndex({ index: item.classIndex, name: item.className })
    return featureClass === classIndexValue && featurePattern.test(item.name ?? '')
  })
}

function hasFeat(char, featName) {
  return (char.feats ?? []).some(feat => feat.name === featName)
}

function featChoice(char, featName) {
  return (char.customContent?.featChoices ?? []).find(choice => choice.featName === featName)
    ?? (char.feats ?? []).find(feat => feat.name === featName)?.choices
    ?? null
}

function isPolearmMasterWeapon(item) {
  const name = String(item.name ?? '').toLowerCase()
  return ['glaive', 'halberd', 'pike', 'quarterstaff', 'spear'].some(weapon => name.includes(weapon))
}

function weaponProperties(item, srdMap) {
  const srd = srdMap[item.index] ?? {}
  return (item.properties ?? srd.properties?.map(prop => prop.name) ?? [])
    .map(prop => (typeof prop === 'string' ? prop : prop.name ?? '').toLowerCase())
}

function hasWeaponProperty(item, srdMap, property) {
  return weaponProperties(item, srdMap).includes(property.toLowerCase())
}

function isRangedWeapon(item, srdMap) {
  const props = weaponProperties(item, srdMap)
  return props.includes('ammunition') || props.includes('thrown')
}

function isFinesseWeapon(item, srdMap) {
  return hasWeaponProperty(item, srdMap, 'finesse')
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
  const wisMod = abilityMod(scores.wis ?? 10)
  const chaMod = abilityMod(scores.cha ?? 10)
  const hpCur  = char.combat?.hpCurrent ?? 0
  const isDying = hpCur <= 0
  const actionEconomy = {
    action: char.combat?.actionEconomy?.action ?? 1,
    bonusAction: char.combat?.actionEconomy?.bonusAction ?? 1,
    reaction: char.combat?.actionEconomy?.reaction ?? 1,
  }

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
    const isThrown = propsLower.includes('thrown')
    const isHeavy = propsLower.includes('heavy')
    const isTwoHanded = propsLower.includes('two-handed')
    const isRanged = usesAmmo || isThrown
    const useAttr  = isRanged || (isFin && dexMod > strMod) ? 'dex' : 'str'
    const attrMod  = useAttr === 'dex' ? dexMod : strMod
    const enh      = item.enhancement ?? 0
    const attackEffectBonus = itemEffectBonus(item, 'Attack Roll')
    const damageEffectBonus = itemEffectBonus(item, 'Damage')
    const archeryBonus = usesAmmo && hasClassFeatureChoice(char, 'Archery') ? 2 : 0
    const useVersatile = !!versatileMode[itemKey(item)]
    const duelingBonus = hasClassFeatureChoice(char, 'Dueling') && !usesAmmo && !isThrown && !isTwoHanded && !useVersatile ? 2 : 0
    const thrownWeaponBonus = hasClassFeatureChoice(char, 'Thrown Weapon Fighting') && isThrown ? 2 : 0
    const greatWeaponFighting = hasClassFeatureChoice(char, 'Great Weapon Fighting') && !usesAmmo && !isThrown && (isTwoHanded || useVersatile)
    const powerAttack = [
      hasFeat(char, 'Great Weapon Master') && isHeavy && !usesAmmo && !isThrown ? 'Great Weapon Master' : null,
      hasFeat(char, 'Sharpshooter') && isRanged ? 'Sharpshooter' : null,
    ].find(Boolean)
    const toHit    = attrMod + pb + enh + attackEffectBonus + archeryBonus
    const dmgMod   = attrMod + enh + damageEffectBonus + duelingBonus + thrownWeaponBonus

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
      duelingBonus ? 'Dueling +2 damage' : null,
      thrownWeaponBonus ? 'Thrown Weapon Fighting +2 damage' : null,
      greatWeaponFighting ? 'Great Weapon Fighting: reroll damage dice showing 1 or 2' : null,
      powerAttack ? `${powerAttack}: optional -5 to hit for +10 damage` : null,
    ].filter(Boolean).join(', ')

    return { toHit, dmgStr, versatileStr, breakdown, usesAmmo, greatWeaponFighting, powerAttack }
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
  const equippedShields = (char.inventory ?? []).filter(item => {
    if (!item.equipped && !item.attuned) return false
    const srd = srdMap[item.index] ?? {}
    return (item.armor_category ?? srd.armor_category) === 'Shield'
  })
  const equippedHeavyArmor = (char.inventory ?? []).some(item => {
    if (!item.equipped && !item.attuned) return false
    const srd = srdMap[item.index] ?? {}
    return (item.armor_category ?? srd.armor_category) === 'Heavy'
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
  const hasSpellcasting = !!char.spells?.spellcastingAbility
    || (char.spells?.known ?? []).length > 0
    || slotEntries.length > 0
    || pactSlotEntries.length > 0

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

  function nextConcentration(spell, requiresConcentration) {
    if (!requiresConcentration) return char.spells?.concentration ?? null
    if (char.settings?.concentrationMode === 'none') return char.spells?.concentration ?? spell.id
    return spell.id
  }

  function castSpell(spell, slotValue, requiresConcentration = false) {
    const concentration = nextConcentration(spell, requiresConcentration)
    const spellLevel = spell.level ?? 0
    if (spellLevel === 0) {
      if (requiresConcentration && concentration !== (char.spells?.concentration ?? null)) {
        updateChar({ spells: { ...char.spells, concentration } })
      }
      return
    }
    const [pool = 'slots', slotLevel] = String(slotValue ?? '').split(':')
    const slotPool = pool === 'pactSlots' ? 'pactSlots' : 'slots'
    const slots = char.spells?.[slotPool] ?? {}
    const slot = slots[slotLevel]
    if (!slot || slot.used >= slot.total) return
    updateChar({
      spells: {
        ...char.spells,
        [slotPool]: { ...slots, [slotLevel]: { ...slot, used: slot.used + 1 } },
        concentration,
      },
    })
  }

  function clearConcentration() {
    updateChar({ spells: { ...char.spells, concentration: null } })
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
    updateChar({
      combat: {
        ...char.combat,
        actionEconomy: { action: 1, bonusAction: 1, reaction: 1 },
        classAbilities: (char.combat?.classAbilities ?? []).filter(ability => ability.recharge !== 'Turn'),
      },
    })
  }

  const fighterLevel = (char.identity?.class ?? [])
    .filter(cls => /fighter/i.test(cls.name ?? cls.index ?? ''))
    .reduce((sum, cls) => sum + (cls.level ?? 0), 0)
  const rogueLevel = (char.identity?.class ?? [])
    .filter(cls => /rogue/i.test(cls.name ?? cls.index ?? ''))
    .reduce((sum, cls) => sum + (cls.level ?? 0), 0)
  const barbarianLevel = (char.identity?.class ?? [])
    .filter(cls => /barbarian/i.test(cls.name ?? cls.index ?? ''))
    .reduce((sum, cls) => sum + (cls.level ?? 0), 0)
  const monkLevel = (char.identity?.class ?? [])
    .filter(cls => /monk/i.test(cls.name ?? cls.index ?? ''))
    .reduce((sum, cls) => sum + (cls.level ?? 0), 0)
  const bardLevel = (char.identity?.class ?? [])
    .filter(cls => /bard/i.test(cls.name ?? cls.index ?? ''))
    .reduce((sum, cls) => sum + (cls.level ?? 0), 0)
  const paladinLevel = (char.identity?.class ?? [])
    .filter(cls => /paladin/i.test(cls.name ?? cls.index ?? ''))
    .reduce((sum, cls) => sum + (cls.level ?? 0), 0)
  const clericLevel = (char.identity?.class ?? [])
    .filter(cls => /cleric/i.test(cls.name ?? cls.index ?? ''))
    .reduce((sum, cls) => sum + (cls.level ?? 0), 0)
  const druidLevel = (char.identity?.class ?? [])
    .filter(cls => /druid/i.test(cls.name ?? cls.index ?? ''))
    .reduce((sum, cls) => sum + (cls.level ?? 0), 0)
  const sorcererLevel = (char.identity?.class ?? [])
    .filter(cls => /sorcerer/i.test(cls.name ?? cls.index ?? ''))
    .reduce((sum, cls) => sum + (cls.level ?? 0), 0)
  const warlockLevel = (char.identity?.class ?? [])
    .filter(cls => /warlock/i.test(cls.name ?? cls.index ?? ''))
    .reduce((sum, cls) => sum + (cls.level ?? 0), 0)
  const rangerLevel = (char.identity?.class ?? [])
    .filter(cls => /ranger/i.test(cls.name ?? cls.index ?? ''))
    .reduce((sum, cls) => sum + (cls.level ?? 0), 0)
  const wizardLevel = (char.identity?.class ?? [])
    .filter(cls => /wizard/i.test(cls.name ?? cls.index ?? ''))
    .reduce((sum, cls) => sum + (cls.level ?? 0), 0)

  const storedAbilities = char.combat?.classAbilities ?? char.classAbilities ?? []
  const storedAbilityMap = Object.fromEntries(storedAbilities.flatMap(ability => [
    [featureKey(ability.name), ability],
    ability.key ? [ability.key, ability] : null,
  ].filter(Boolean)))
  const maneuverDC = 8 + pb + Math.max(strMod, dexMod)
  const attackCount = extraAttackCount({ fighterLevel, barbarianLevel, monkLevel, paladinLevel, rangerLevel })
  const classFeatures = char.customContent?.classFeatures ?? []
  const barbarianSource = classSourceFor(char, 'barbarian', /^rage$/i)
  const monkSource = classSourceFor(char, 'monk', /^(martial arts|bonus unarmed strike)$/i)
  const clericSource = classSourceFor(char, 'cleric', /^channel divinity$/i)
  const clericInterventionSource = classSourceFor(char, 'cleric', /^divine intervention$/i) ?? clericSource
  const fighterSource = classSourceFor(char, 'fighter', /^indomitable/i)
  const paladinSource = classSourceFor(char, 'paladin', /^channel divinity$/i)
  const druidSource = classSourceFor(char, 'druid', /^wild shape$/i)
  const rangerFavoredEnemySource = classSourceFor(char, 'ranger', /^favored enemy$/i)
  const rageMax = rageUses(barbarianLevel, barbarianSource)
  const clericChannelMax = /xphb/i.test(clericSource ?? '') ? xphbClericChannelUses(clericLevel) : clericChannelUses(clericLevel)
  const paladinChannelMax = paladinChannelUses(paladinLevel, paladinSource)
  const wildShapeMax = wildShapeUses(druidLevel, druidSource)
  const favoredEnemyMax = xphbFavoredEnemyUses(rangerLevel)
  const isXphbBarbarian = /xphb/i.test(barbarianSource ?? '')
  const isXphbClericIntervention = /xphb/i.test(clericInterventionSource ?? '')
  const isXphbFighter = /xphb/i.test(fighterSource ?? '')
  const isXphbRangerFavoredEnemy = /xphb/i.test(rangerFavoredEnemySource ?? '')
  const isXphbPaladin = /xphb/i.test(paladinSource ?? '')
  const hasPrimevalAwareness = hasClassFeature(char, 'ranger', /^primeval awareness$/i)
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
          : secondWindUses(fighterLevel, feature.source)
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
  const classResourceFeatures = [
    barbarianLevel > 0 && {
      name: 'Rage',
      key: 'class-rage',
      sourceType: 'Class',
      actionType: 'Bonus',
      recharge: rageMax == null ? null : isXphbBarbarian ? 'SR/LR' : 'LR',
      max: rageMax,
      used: storedAbilityMap['class-rage']?.used ?? 0,
      effect: `+${rageDamage(barbarianLevel)} damage`,
      detail: rageMax == null
        ? 'Unlimited uses'
        : isXphbBarbarian
          ? `${rageMax} uses. Regain one on a short rest and all on a long rest.`
          : `${rageMax}/LR`,
    },
    monkLevel >= 2 && {
      name: 'Ki',
      key: 'class-ki',
      sourceType: 'Class',
      actionType: 'Resource',
      recharge: 'SR',
      max: monkLevel,
      used: storedAbilityMap['class-ki']?.used ?? 0,
      effect: `${monkLevel} ki`,
      detail: 'Patient Defense, Step of the Wind, Flurry of Blows, and other monk features.',
    },
    monkLevel > 0 && {
      name: 'Martial Arts',
      key: 'class-martial-arts',
      sourceType: 'Class',
      actionType: 'Bonus',
      effect: 'Unarmed strike',
      detail: 'After attacking with an unarmed strike or monk weapon, make one unarmed strike as a bonus action.',
    },
    bardLevel > 0 && {
      name: 'Bardic Inspiration',
      key: 'class-bardic-inspiration',
      sourceType: 'Class',
      actionType: 'Bonus',
      recharge: bardLevel >= 5 ? 'SR' : 'LR',
      max: Math.max(1, chaMod),
      used: storedAbilityMap['class-bardic-inspiration']?.used ?? 0,
      effect: bardicDie(bardLevel),
      detail: bardLevel >= 5 ? 'Refreshes on short rest from Font of Inspiration.' : 'Refreshes on long rest.',
    },
    paladinLevel > 0 && {
      name: 'Lay on Hands',
      key: 'class-lay-on-hands',
      sourceType: 'Class',
      actionType: 'Action',
      recharge: 'LR',
      max: paladinLevel * 5,
      used: storedAbilityMap['class-lay-on-hands']?.used ?? 0,
      effect: `${paladinLevel * 5} HP pool`,
      detail: 'Spend points to heal, or 5 points to neutralize one disease or poison.',
    },
    paladinLevel >= 3 && {
      name: 'Channel Divinity',
      key: 'class-paladin-channel-divinity',
      sourceType: 'Paladin',
      actionType: 'Feature',
      recharge: 'SR',
      max: paladinChannelMax,
      used: storedAbilityMap['class-paladin-channel-divinity']?.used ?? 0,
      effect: `${paladinChannelMax} use${paladinChannelMax === 1 ? '' : 's'}`,
      detail: isXphbPaladin ? 'Use Divine Sense or an option granted by your oath.' : 'Use one Channel Divinity option granted by your oath.',
    },
    clericLevel >= 2 && {
      name: 'Channel Divinity',
      key: 'class-cleric-channel-divinity',
      sourceType: 'Cleric',
      actionType: 'Feature',
      recharge: 'SR',
      max: clericChannelMax,
      used: storedAbilityMap['class-cleric-channel-divinity']?.used ?? 0,
      effect: `${clericChannelMax} use${clericChannelMax === 1 ? '' : 's'}`,
      detail: 'Turn Undead and domain Channel Divinity options.',
    },
    druidLevel >= 2 && {
      name: 'Wild Shape',
      key: 'class-wild-shape',
      sourceType: 'Class',
      actionType: 'Action',
      recharge: wildShapeMax == null ? null : 'SR',
      max: wildShapeMax,
      used: storedAbilityMap['class-wild-shape']?.used ?? 0,
      effect: wildShapeMax == null ? 'Unlimited' : `${wildShapeMax} uses`,
      detail: wildShapeMax == null ? 'Unlimited Wild Shape uses.' : 'Regain one use on a short rest and all uses on a long rest.',
    },
    sorcererLevel >= 2 && {
      name: 'Sorcery Points',
      key: 'class-sorcery-points',
      sourceType: 'Class',
      actionType: 'Resource',
      recharge: 'LR',
      max: sorcererLevel,
      used: storedAbilityMap['class-sorcery-points']?.used ?? 0,
      effect: `${sorcererLevel} points`,
      detail: 'Flexible Casting and Metamagic fuel.',
    },
    mysticArcanumCount(warlockLevel) > 0 && {
      name: 'Mystic Arcanum',
      key: 'class-mystic-arcanum',
      sourceType: 'Warlock',
      actionType: 'Spell',
      recharge: 'LR',
      max: mysticArcanumCount(warlockLevel),
      used: storedAbilityMap['class-mystic-arcanum']?.used ?? 0,
      effect: mysticArcanumLevels(warlockLevel),
      detail: 'Each arcanum spell can be cast once without a spell slot.',
    },
    fighterLevel >= 9 && {
      name: 'Indomitable',
      key: 'class-indomitable',
      sourceType: 'Fighter',
      actionType: 'Save',
      recharge: 'LR',
      max: indomitableUses(fighterLevel),
      used: storedAbilityMap['class-indomitable']?.used ?? 0,
      effect: isXphbFighter
        ? `${indomitableUses(fighterLevel)} reroll${indomitableUses(fighterLevel) === 1 ? '' : 's'} +${fighterLevel}`
        : `${indomitableUses(fighterLevel)} reroll${indomitableUses(fighterLevel) === 1 ? '' : 's'}`,
      detail: isXphbFighter
        ? 'Reroll a failed saving throw with a bonus equal to your Fighter level.'
        : 'Reroll a failed saving throw.',
    },
    paladinLevel > 0 && !isXphbPaladin && {
      name: 'Divine Sense',
      key: 'class-divine-sense',
      sourceType: 'Paladin',
      actionType: 'Action',
      recharge: 'LR',
      max: Math.max(1, chaMod + 1),
      used: storedAbilityMap['class-divine-sense']?.used ?? 0,
      effect: `${Math.max(1, chaMod + 1)} uses`,
      detail: 'Sense celestials, fiends, undead, and consecrated or desecrated places within 60 ft.',
    },
    barbarianLevel >= 2 && {
      name: 'Reckless Attack',
      key: 'class-reckless-attack',
      sourceType: 'Barbarian',
      actionType: 'Attack',
      effect: 'STR advantage',
      detail: 'Gain advantage on Strength melee attacks this turn; attacks against you have advantage until your next turn.',
    },
    barbarianLevel >= 2 && {
      name: 'Danger Sense',
      key: 'class-danger-sense',
      sourceType: 'Barbarian',
      actionType: 'Passive',
      effect: 'DEX save adv',
      detail: 'Advantage on Dexterity saves against effects you can see, while not blinded, deafened, or incapacitated.',
    },
    brutalCriticalDice(barbarianLevel) > 0 && {
      name: 'Brutal Critical',
      key: 'class-brutal-critical',
      sourceType: 'Barbarian',
      actionType: 'Critical',
      effect: `+${brutalCriticalDice(barbarianLevel)} die${brutalCriticalDice(barbarianLevel) === 1 ? '' : 's'}`,
      detail: 'Roll extra weapon damage dice on a melee critical hit.',
    },
    rogueLevel >= 2 && {
      name: 'Cunning Action',
      key: 'class-cunning-action',
      sourceType: 'Rogue',
      actionType: 'Bonus',
      effect: 'Dash/Disengage/Hide',
      detail: 'Take Dash, Disengage, or Hide as a bonus action.',
    },
    rogueLevel >= 5 && {
      name: 'Uncanny Dodge',
      key: 'class-uncanny-dodge',
      sourceType: 'Rogue',
      actionType: 'Reaction',
      effect: 'Half damage',
      detail: 'Halve damage from one attacker you can see.',
    },
    rogueLevel >= 7 && {
      name: 'Evasion',
      key: 'class-rogue-evasion',
      sourceType: 'Rogue',
      actionType: 'Passive',
      effect: 'DEX save',
      detail: 'Dexterity save damage becomes half on failure, none on success.',
    },
    monkLevel >= 3 && {
      name: 'Deflect Missiles',
      key: 'class-deflect-missiles',
      sourceType: 'Monk',
      actionType: 'Reaction',
      effect: `1d10${fmtB(dexMod + monkLevel)}`,
      detail: 'Reduce ranged weapon damage; spend 1 ki to throw the missile back when reduced to 0.',
    },
    monkLevel >= 5 && {
      name: 'Stunning Strike',
      key: 'class-stunning-strike',
      sourceType: 'Monk',
      actionType: 'On hit',
      effect: `DC ${8 + pb + wisMod}`,
      detail: 'Spend 1 ki after a melee weapon hit; target makes a Constitution save or is stunned.',
    },
    attackCount > 1 && {
      name: 'Extra Attack',
      key: 'class-extra-attack',
      sourceType: 'Class',
      actionType: 'Attack',
      effect: `${attackCount} attacks`,
      detail: 'Attack this many times when you take the Attack action.',
    },
    paladinLevel >= 2 && {
      name: 'Divine Smite',
      key: 'class-divine-smite',
      sourceType: 'Paladin',
      actionType: 'On hit',
      effect: '+2d8 radiant',
      detail: 'Spend a spell slot after a melee weapon hit; +1d8 per slot level above 1st, plus +1d8 vs fiends or undead.',
    },
    paladinLevel >= 6 && {
      name: 'Aura of Protection',
      key: 'class-aura-protection',
      sourceType: 'Paladin',
      actionType: 'Aura',
      effect: `${fmtB(Math.max(1, chaMod))} saves`,
      detail: 'You and nearby allies add your Charisma modifier to saving throws.',
    },
    paladinLevel >= 10 && {
      name: 'Aura of Courage',
      key: 'class-aura-courage',
      sourceType: 'Paladin',
      actionType: 'Aura',
      effect: 'No frightened',
      detail: 'You and nearby allies cannot be frightened while you are conscious.',
    },
    paladinLevel >= 11 && {
      name: 'Improved Divine Smite',
      key: 'class-improved-divine-smite',
      sourceType: 'Paladin',
      actionType: 'Passive',
      effect: '+1d8 radiant',
      detail: 'Melee weapon hits deal an extra 1d8 radiant damage.',
    },
    barbarianLevel >= 7 && {
      name: 'Feral Instinct',
      key: 'class-feral-instinct',
      sourceType: 'Barbarian',
      actionType: 'Initiative',
      effect: 'Advantage',
      detail: 'Advantage on initiative rolls; act normally when surprised if you rage first.',
    },
    monkLevel >= 4 && {
      name: 'Slow Fall',
      key: 'class-slow-fall',
      sourceType: 'Monk',
      actionType: 'Reaction',
      effect: `-${monkLevel * 5} damage`,
      detail: 'Reduce falling damage by five times your Monk level.',
    },
    monkLevel >= 7 && {
      name: 'Stillness of Mind',
      key: 'class-stillness-of-mind',
      sourceType: 'Monk',
      actionType: 'Action',
      effect: 'End charm/fear',
      detail: 'End one effect causing you to be charmed or frightened.',
    },
    isXphbRangerFavoredEnemy && rangerLevel > 0 && {
      name: "Hunter's Mark",
      key: 'class-ranger-favored-enemy',
      sourceType: 'Ranger',
      actionType: 'Spell',
      recharge: 'LR',
      max: favoredEnemyMax,
      used: storedAbilityMap['class-ranger-favored-enemy']?.used ?? 0,
      effect: `${favoredEnemyMax} free cast${favoredEnemyMax === 1 ? '' : 's'}`,
      detail: "Favored Enemy: cast Hunter's Mark without expending a spell slot.",
    },
    rangerLevel >= 3 && hasPrimevalAwareness && {
      name: 'Primeval Awareness',
      key: 'class-primeval-awareness',
      sourceType: 'Ranger',
      actionType: 'Action',
      effect: 'Spend slot',
      detail: 'Spend a Ranger spell slot to sense nearby creature types for 1 minute per slot level.',
    },
    wizardLevel > 0 && {
      name: 'Arcane Recovery',
      key: 'class-arcane-recovery',
      sourceType: 'Wizard',
      actionType: 'Short rest',
      recharge: 'LR',
      max: 1,
      used: storedAbilityMap['class-arcane-recovery']?.used ?? 0,
      effect: `${Math.ceil(wizardLevel / 2)} slot levels`,
      detail: 'Recover expended spell slots after a short rest; no recovered slot can be 6th level or higher.',
    },
    clericLevel >= 10 && {
      name: 'Divine Intervention',
      key: 'class-divine-intervention',
      sourceType: 'Cleric',
      actionType: isXphbClericIntervention ? 'Magic' : 'Action',
      recharge: 'LR',
      max: 1,
      used: storedAbilityMap['class-divine-intervention']?.used ?? 0,
      effect: isXphbClericIntervention
        ? (clericLevel >= 20 ? 'Wish option' : 'Lv 5 spell')
        : clericLevel >= 20 ? 'Automatic' : `${clericLevel}%`,
      detail: isXphbClericIntervention
        ? (clericLevel >= 20
            ? 'Cast a Cleric spell of level 5 or lower without a slot; Wish is also an option, then this recharges after 2d4 long rests.'
            : 'Cast a Cleric spell of level 5 or lower without expending a slot or material components.')
        : clericLevel >= 20 ? 'Your deity intervenes without a roll.' : 'Roll percentile dice; success if the result is equal to or below your Cleric level.',
    },
    warlockLevel >= 20 && {
      name: 'Eldritch Master',
      key: 'class-eldritch-master',
      sourceType: 'Warlock',
      actionType: '1 minute',
      recharge: 'LR',
      max: 1,
      used: storedAbilityMap['class-eldritch-master']?.used ?? 0,
      effect: 'Restore pact slots',
      detail: 'Spend 1 minute entreating your patron to regain all expended Pact Magic slots.',
    },
  ].filter(Boolean)
  const martialAdeptChoice = featChoice(char, 'Martial Adept')
  const magicInitiateChoice = featChoice(char, 'Magic Initiate')
  const magicInitiateSpellNames = (magicInitiateChoice?.spells ?? []).map(spell => spell.name).filter(Boolean)
  const selectedFeatureOptions = selectedClassFeatureOptionNames(char)
  const eldritchInvocations = classFeatureChoiceOptions(char, option =>
    (option.featureType ?? []).includes('EI')
  ).filter((option, index, list) => list.findIndex(other => other.name === option.name) === index)
  const metamagicOptions = classFeatureChoiceOptions(char, option =>
    (option.featureType ?? []).includes('MM')
  ).filter((option, index, list) => list.findIndex(other => other.name === option.name) === index)
  const elementalDisciplines = classFeatureChoiceOptions(char, option =>
    (option.featureType ?? []).includes('ED')
  ).filter((option, index, list) => list.findIndex(other => other.name === option.name) === index)
  const pactBoon = classFeatureChoiceOptions(char, (option, choice) =>
    /pact boon/i.test(choice.featureName ?? '') || /^Pact of /i.test(option.name ?? '')
  )[0]
  const choiceReminderFeatures = [
    eldritchInvocations.length > 0 && {
      name: 'Eldritch Invocations',
      key: 'choice-eldritch-invocations',
      sourceType: 'Warlock',
      actionType: 'Chosen',
      effect: `${eldritchInvocations.length} known`,
      detail: eldritchInvocations.map(option => option.name).join(' · '),
    },
    pactBoon && {
      name: 'Pact Boon',
      key: 'choice-pact-boon',
      sourceType: 'Warlock',
      actionType: 'Chosen',
      effect: pactBoon.name,
      detail: pactBoon.desc?.[0] || 'Your pact boon choice.',
    },
    metamagicOptions.length > 0 && {
      name: 'Metamagic',
      key: 'choice-metamagic',
      sourceType: 'Sorcerer',
      actionType: 'Spell',
      effect: `${metamagicOptions.length} options`,
      detail: metamagicOptions.map(option => option.name).join(' · '),
    },
    elementalDisciplines.length > 0 && {
      name: 'Elemental Disciplines',
      key: 'choice-elemental-disciplines',
      sourceType: 'Monk',
      actionType: 'Ki',
      effect: `${elementalDisciplines.length} known`,
      detail: elementalDisciplines.map(option => option.name).join(' · '),
    },
  ].filter(Boolean)
  const battleMasterManeuvers = classFeatureChoiceOptions(char, (option, choice) => {
    const featureName = String(choice.featureName ?? '').toLowerCase()
    const isFighterChoice = /fighter/i.test(choice.className ?? choice.classIndex ?? '')
    const isManeuverFeature = /maneuver/.test(featureName)
    const isManeuverOption = (option.featureType ?? []).includes('MV:B')
    return isFighterChoice && (isManeuverFeature || isManeuverOption)
  }).filter((option, index, list) => list.findIndex(other => other.name === option.name) === index)
  const battleMasterDice = fighterLevel >= 15 ? 6 : fighterLevel >= 7 ? 5 : 4
  const battleMasterDie = fighterLevel >= 18 ? 'd12' : fighterLevel >= 10 ? 'd10' : 'd8'
  const battleMasterFeature = battleMasterManeuvers.length
    ? [{
        name: 'Battle Master Maneuvers',
        key: 'class-battle-master-maneuvers',
        sourceType: 'Subclass',
        actionType: 'Maneuver',
        recharge: 'SR',
        max: battleMasterDice,
        used: storedAbilityMap['class-battle-master-maneuvers']?.used ?? 0,
        effect: `${battleMasterDice}${battleMasterDie} superiority`,
        detail: [`DC ${maneuverDC}`, battleMasterManeuvers.map(maneuver => maneuver.name).join(' · ')].filter(Boolean).join(' · '),
      }]
    : []
  const superiorTechniqueFeature = selectedFeatureOptions.has('Superior Technique')
    ? [{
        name: 'Superior Technique',
        key: 'style-superior-technique',
        sourceType: 'Fighting Style',
        actionType: 'Maneuver',
        recharge: 'SR',
        max: 1,
        used: storedAbilityMap['style-superior-technique']?.used ?? 0,
        effect: '1d6 superiority',
        detail: `Maneuver DC ${maneuverDC}. One Battle Master maneuver from your fighting style.`,
      }]
    : []
  const fightingStyleFeatures = [
    selectedFeatureOptions.has('Blind Fighting') && {
      name: 'Blind Fighting',
      key: 'style-blind-fighting',
      sourceType: 'Fighting Style',
      actionType: 'Passive',
      effect: '10 ft blindsight',
      detail: 'See invisible creatures within 10 ft unless hidden, and see through darkness but not total cover.',
    },
    selectedFeatureOptions.has('Interception') && {
      name: 'Interception',
      key: 'style-interception',
      sourceType: 'Fighting Style',
      actionType: 'Reaction',
      effect: `1d10${fmtB(pb)} reduction`,
      detail: 'Reduce damage to a nearby ally while wielding a shield or weapon.',
    },
    selectedFeatureOptions.has('Protection') && {
      name: 'Protection',
      key: 'style-protection',
      sourceType: 'Fighting Style',
      actionType: 'Reaction',
      effect: 'Impose disadvantage',
      detail: 'Use your reaction while wielding a shield to protect a nearby ally.',
    },
    selectedFeatureOptions.has('Two-Weapon Fighting') && {
      name: 'Two-Weapon Fighting',
      key: 'style-two-weapon-fighting',
      sourceType: 'Fighting Style',
      actionType: 'Off-hand',
      effect: 'Add ability mod',
      detail: 'Add your ability modifier to the damage of the second light-weapon attack.',
    },
  ].filter(Boolean)
  const featCombatFeatures = [
    martialAdeptChoice?.maneuvers?.length && {
      name: 'Martial Adept',
      key: 'feat-martial-adept',
      sourceType: 'Feat',
      actionType: 'Maneuver',
      recharge: 'SR',
      max: 1,
      used: storedAbilityMap['feat-martial-adept']?.used ?? 0,
      effect: '1d6 superiority',
      detail: [`DC ${maneuverDC}`, martialAdeptChoice.maneuvers.map(maneuver => maneuver.name).join(' · ')].filter(Boolean).join(' · '),
    },
    hasFeat(char, 'Charger') && {
      name: 'Charger',
      key: 'feat-charger',
      sourceType: 'Feat',
      actionType: 'Bonus',
      effect: '+5 damage / push',
      detail: 'After using your action to Dash, make one bonus-action melee attack or shove. If you moved at least 10 ft in a straight line, add +5 damage or push the target up to 10 ft.',
    },
    hasFeat(char, 'Crossbow Expert') && {
      name: 'Crossbow Expert',
      key: 'feat-crossbow-expert',
      sourceType: 'Feat',
      actionType: 'Bonus',
      effect: 'Hand crossbow',
      detail: 'Ignore loading with crossbows, and attacking within 5 ft does not impose disadvantage. After attacking with a one-handed weapon, you can make a bonus-action hand crossbow attack.',
    },
    hasFeat(char, 'Lucky') && {
      name: 'Lucky',
      key: 'feat-lucky',
      sourceType: 'Feat',
      actionType: 'Roll',
      recharge: 'LR',
      max: 3,
      used: storedAbilityMap['feat-lucky']?.used ?? 0,
      effect: '3 luck points',
      detail: 'Spend a luck point to roll an extra d20 on your attack, ability check, or save, or to affect an attack roll against you.',
    },
    hasFeat(char, 'Magic Initiate') && magicInitiateSpellNames.length > 0 && {
      name: 'Magic Initiate',
      key: 'feat-magic-initiate',
      sourceType: 'Feat',
      actionType: 'Spell',
      recharge: 'LR',
      max: 1,
      used: storedAbilityMap['feat-magic-initiate']?.used ?? 0,
      effect: '1 free cast',
      detail: `Cast ${magicInitiateSpellNames.join(', ')} once per long rest without expending a spell slot.`,
    },
    (char.feats ?? []).some(feat => feat.name === 'Heavy Armour Master') && equippedHeavyArmor && {
      name: 'Heavy Armour Master',
      key: 'feat-heavy-armour-master',
      sourceType: 'Feat',
      actionType: 'Passive',
      effect: '-3 B/P/S',
      detail: 'While wearing heavy armor, reduce nonmagical bludgeoning, piercing, and slashing damage by 3.',
    },
    hasFeat(char, 'Defensive Duelist') && equippedWeapons.some(item => isFinesseWeapon(item, srdMap)) && {
      name: 'Defensive Duelist',
      key: 'feat-defensive-duelist',
      sourceType: 'Feat',
      actionType: 'Reaction',
      effect: `+${pb} AC`,
      detail: 'When hit by a melee attack while wielding a finesse weapon, use your reaction to add your proficiency bonus to AC for that attack.',
    },
    hasFeat(char, 'Grappler') && {
      name: 'Grappler',
      key: 'feat-grappler',
      sourceType: 'Feat',
      actionType: 'Attack',
      effect: 'Grapple control',
      detail: 'You have advantage on attack rolls against a creature you are grappling, and you can use your action to try to pin it; both of you are restrained on success.',
    },
    hasFeat(char, 'Great Weapon Master') && equippedWeapons.some(item => hasWeaponProperty(item, srdMap, 'heavy') && !isRangedWeapon(item, srdMap)) && {
      name: 'Great Weapon Master',
      key: 'feat-great-weapon-master',
      sourceType: 'Feat',
      actionType: 'Bonus',
      effect: 'Extra attack',
      detail: 'On your turn, after scoring a critical hit with a melee weapon or reducing a creature to 0 HP, make one melee weapon attack as a bonus action. Heavy weapon attack cards also show the optional -5/+10 attack.',
    },
    hasFeat(char, 'Healer') && {
      name: 'Healer',
      key: 'feat-healer',
      sourceType: 'Feat',
      actionType: 'Action',
      effect: `1d6 + 4 + ${level} HP`,
      detail: 'Use a healer\'s kit to stabilize a dying creature to 1 HP, or restore hit points equal to 1d6 + 4 + the creature\'s maximum Hit Dice. One heal per creature per rest.',
    },
    hasFeat(char, 'Inspiring Leader') && {
      name: 'Inspiring Leader',
      key: 'feat-inspiring-leader',
      sourceType: 'Feat',
      actionType: 'Rest',
      effect: `${level + chaMod} temp HP`,
      detail: 'Spend 10 minutes inspiring up to six friendly creatures; each gains temporary hit points equal to your level + Charisma modifier.',
    },
    hasFeat(char, 'Mage Slayer') && {
      name: 'Mage Slayer',
      key: 'feat-mage-slayer',
      sourceType: 'Feat',
      actionType: 'Reaction',
      effect: 'Anti-caster',
      detail: 'React to attack a creature that casts a spell within 5 ft. Nearby casters have disadvantage on concentration saves, and you have advantage on saves against their spells.',
    },
    hasFeat(char, 'Mounted Combatant') && {
      name: 'Mounted Combatant',
      key: 'feat-mounted-combatant',
      sourceType: 'Feat',
      actionType: 'Mounted',
      effect: 'Protect mount',
      detail: 'Gain advantage on melee attacks against unmounted creatures smaller than your mount, redirect attacks from your mount to you, and help your mount avoid Dexterity-save damage.',
    },
    hasFeat(char, 'Polearm Master') && equippedWeapons.some(isPolearmMasterWeapon) && {
      name: 'Polearm Master',
      key: 'feat-polearm-master',
      sourceType: 'Feat',
      actionType: 'Bonus',
      effect: `1d4${fmtB(strMod)} bludgeoning`,
      detail: 'After attacking with a qualifying polearm, make a bonus-action melee attack with the opposite end. Creatures provoke opportunity attacks when they enter your reach.',
    },
    hasFeat(char, 'Shield Master') && equippedShields.length > 0 && {
      name: 'Shield Master',
      key: 'feat-shield-master',
      sourceType: 'Feat',
      actionType: 'Bonus',
      effect: 'Shield shove',
      detail: 'After attacking, shove with your shield as a bonus action. Add your shield bonus to Dexterity saves against effects that target only you; after a successful Dexterity save for half damage, you can use your reaction to take no damage.',
    },
    hasFeat(char, 'Savage Attacker') && equippedWeapons.length > 0 && {
      name: 'Savage Attacker',
      key: 'feat-savage-attacker',
      sourceType: 'Feat',
      actionType: 'Once/turn',
      recharge: 'Turn',
      max: 1,
      used: storedAbilityMap['feat-savage-attacker']?.used ?? 0,
      effect: 'Reroll damage',
      detail: 'Once per turn when you roll weapon damage, reroll the weapon damage dice and use either total.',
    },
    hasFeat(char, 'Sharpshooter') && equippedWeapons.some(item => isRangedWeapon(item, srdMap)) && {
      name: 'Sharpshooter',
      key: 'feat-sharpshooter',
      sourceType: 'Feat',
      actionType: 'Attack',
      effect: 'Ignore range/cover',
      detail: 'Ranged weapon attacks ignore half and three-quarters cover and do not suffer disadvantage at long range. Ranged attack cards also show the optional -5/+10 attack.',
    },
    hasFeat(char, 'Sentinel') && {
      name: 'Sentinel',
      key: 'feat-sentinel',
      sourceType: 'Feat',
      actionType: 'Reaction',
      effect: 'Lockdown',
      detail: 'Opportunity attacks reduce speed to 0, ignore Disengage, and you can react when a nearby creature attacks someone other than you.',
    },
    hasFeat(char, 'Tavern Brawler') && {
      name: 'Tavern Brawler',
      key: 'feat-tavern-brawler',
      sourceType: 'Feat',
      actionType: 'Bonus',
      effect: 'Bonus grapple',
      detail: 'After hitting a creature with an unarmed strike or improvised weapon on your turn, you can try to grapple it as a bonus action.',
    },
    hasFeat(char, 'War Caster') && hasSpellcasting && {
      name: 'War Caster',
      key: 'feat-war-caster',
      sourceType: 'Feat',
      actionType: 'Reaction',
      effect: 'Battle casting',
      detail: 'You have advantage on concentration saves, can perform somatic components while holding weapons or a shield, and can cast a spell instead of making an opportunity attack.',
    },
  ].filter(Boolean)

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
  const combatAbilityFeatures = [
    ...combatFeatures,
    ...classResourceFeatures,
    ...battleMasterFeature,
    ...superiorTechniqueFeature,
    ...fightingStyleFeatures,
    ...choiceReminderFeatures,
    ...featCombatFeatures,
    ...raceAbilityFeatures,
  ]
  const hasSpentShortRestFeature = combatAbilityFeatures.some(feature => feature.max && feature.used > 0 && /SR/.test(feature.recharge ?? ''))
  const hasSpentLongRestFeature = combatAbilityFeatures.some(feature => feature.max && feature.used > 0 && /LR/.test(feature.recharge ?? ''))
  const hasSpentPactSlots = pactSlotEntries.some(([, slot]) => (slot.used ?? 0) > 0)
  const hasSpentSpellSlots = slotEntries.some(([, slot]) => (slot.used ?? 0) > 0)
  const hasSpentChargedItems = (char.inventory ?? []).some(item => item.chargesMax && (item.chargesCurrent ?? item.chargesMax) < item.chargesMax)
  const canShortRestRecover = hasSpentShortRestFeature || hasSpentPactSlots
  const canLongRestRecover = hasSpentLongRestFeature || hasSpentSpellSlots || hasSpentPactSlots || hasSpentChargedItems
  const showRestRecovery = canShortRestRecover || canLongRestRecover || slotEntries.length > 0 || pactSlotEntries.length > 0 || chargedItems.length > 0

  function recoverFeatures(restType) {
    if (!isOwner || locked) return
    const rechargePattern = restType === 'SR' ? /SR/ : /LR/
    const nextSpells = { ...(char.spells ?? {}) }
    if (restType === 'SR') {
      nextSpells.pactSlots = Object.fromEntries(Object.entries(nextSpells.pactSlots ?? {}).map(([lvl, slot]) => [
        lvl,
        { ...slot, used: 0 },
      ]))
    } else {
      nextSpells.slots = Object.fromEntries(Object.entries(nextSpells.slots ?? {}).map(([lvl, slot]) => [
        lvl,
        { ...slot, used: 0 },
      ]))
      nextSpells.pactSlots = Object.fromEntries(Object.entries(nextSpells.pactSlots ?? {}).map(([lvl, slot]) => [
        lvl,
        { ...slot, used: 0 },
      ]))
      nextSpells.concentration = null
    }
    updateChar({
      inventory: restType === 'LR'
        ? (char.inventory ?? []).map(item => item.chargesMax ? { ...item, chargesCurrent: item.chargesMax } : item)
        : char.inventory,
      spells: nextSpells,
      combat: {
        ...char.combat,
        classAbilities: (char.combat?.classAbilities ?? []).filter(ability => !rechargePattern.test(ability.recharge ?? '')),
      },
    })
  }

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

  const hasUnarmedFighting = hasClassFeatureChoice(char, 'Unarmed Fighting')
  const hasTavernBrawler = (char.feats ?? []).some(feat => feat.name === 'Tavern Brawler')
  const hasMonkMartialArts = monkLevel > 0
  const monkAttackMod = Math.max(strMod, dexMod)
  const monkAttackAttr = dexMod >= strMod ? 'DEX' : 'STR'
  const unarmedDie = hasUnarmedFighting
    ? equippedWeapons.length === 0 && equippedShields.length === 0 ? '1d8' : '1d6'
    : hasMonkMartialArts ? martialArtsDie(monkLevel, monkSource)
      : hasTavernBrawler ? '1d4'
      : '1'
  const unarmedMod = hasMonkMartialArts ? monkAttackMod : strMod
  const unarmedAttr = hasMonkMartialArts ? monkAttackAttr : 'STR'
  const unarmedLabel = hasUnarmedFighting ? 'Unarmed Fighting' : hasMonkMartialArts ? 'Martial Arts' : hasTavernBrawler ? 'Tavern Brawler' : 'Basic'
  const unarmedDamage = `${unarmedDie}${unarmedDie !== '1' && unarmedMod !== 0 ? fmtB(unarmedMod) : ''} bludgeoning`
  const unarmedTitle = hasUnarmedFighting
    ? 'Unarmed Fighting style changes your unarmed strike damage.'
    : hasMonkMartialArts
      ? 'Martial Arts changes your unarmed strike damage and can use Dexterity.'
      : hasTavernBrawler
        ? 'Tavern Brawler changes your unarmed strike damage to 1d4.'
        : 'A basic unarmed strike deals 1 bludgeoning damage.'

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

      <div className="attack-card">
        <div className="atk-line1">
          <span className="atk-name">Unarmed Strike</span>
        </div>
        <div className="atk-line2">
          <span className="badge" title={`${unarmedAttr} ${fmtB(unarmedMod)}, Prof ${fmtB(pb)}`}>{fmtB(unarmedMod + pb)} to hit</span>
          <span className="badge">{unarmedDamage}</span>
          <span className="badge badge--dim" title={unarmedTitle}>
            {unarmedLabel}
          </span>
          {hasUnarmedFighting && (
            <span className="badge badge--dim" title="Unarmed Fighting: deal 1d4 bludgeoning damage to one creature grappled by you at the start of each of your turns">
              Grapple 1d4
            </span>
          )}
          <div className="atk-btns">
            <button
              className="atk-btn atk-btn--roll"
              disabled={!isOwner || locked}
              title={`Roll ${unarmedDamage}`}
            >
              Roll
            </button>
          </div>
        </div>
      </div>

      {/* Weapon attack cards */}
      {equippedWeapons.map(item => {
        const resolved = resolveWeapon(item)
        if (!resolved) return null
        const { toHit, dmgStr, versatileStr, breakdown, usesAmmo, greatWeaponFighting, powerAttack } = resolved
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
              {greatWeaponFighting && (
                <span className="badge badge--dim" title="Great Weapon Fighting: reroll weapon damage dice that show 1 or 2">
                  GWF
                </span>
              )}
              {powerAttack && (
                <span className="badge badge--dim" title={`${powerAttack}: before attacking, you can take -5 to hit for +10 damage.`}>
                  -5/+10
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

      {showRestRecovery && (
        <div className="combat-rest-actions">
          <button
            className="combat-rest-btn"
            type="button"
            onClick={() => recoverFeatures('SR')}
            disabled={!isOwner || locked || !canShortRestRecover}
            title="Recover spent short-rest features and pact slots"
          >
            Short Rest
          </button>
          <button
            className="combat-rest-btn"
            type="button"
            onClick={() => recoverFeatures('LR')}
            disabled={!isOwner || locked || !canLongRestRecover}
            title="Recover spent long-rest features, spell slots, pact slots, charges, and concentration"
          >
            Long Rest
          </button>
        </div>
      )}

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
                  <span className="combat-feature-meta">{feature.actionType} · {remaining}/{feature.max}{feature.recharge ? ` · ${feature.recharge}` : ''}</span>
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
            const requiresConc = srd.concentration === true
            const isConc = char.spells?.concentration === spell.id
            const availableSlots = spell.level > 0 ? availableSlotOptions(spell.level) : []
            const selectedSlot = availableSlots.some(option => option.value === castSlots[spell.id])
              ? castSlots[spell.id]
              : availableSlots[0]?.value
            const selectedSlotLevel = availableSlots.find(option => option.value === selectedSlot)?.level
            const scalingLevel = cantripScalingLevel(spell, char, level)
            const dmgDice = srd.damage?.damage_at_character_level
              ? damageForCharacterLevel(srd.damage.damage_at_character_level, scalingLevel)
              : srd.damage?.damage_at_slot_level
                ? srd.damage.damage_at_slot_level[selectedSlotLevel] ?? srd.damage.damage_at_slot_level[spell.level] ?? Object.values(srd.damage.damage_at_slot_level)[0]
                : null
            const dmgType = srd.damage?.damage_type?.name ?? ''
            const isAtk   = !!srd.attack_type
            const castAbility = spellCastingAbility(spell, char)
            const castMod = castAbility ? abilityMod((char.stats?.abilityScores ?? {})[castAbility] ?? 10) : null
            const spellAtk = castMod != null ? pb + castMod : null
            const spellDC = castMod != null ? 8 + pb + castMod : null
            const saveName = srd.dc?.dc_type?.name ?? srd.saving_throw

            return (
              <div key={spell.id} className="spell-combat-card">
                <div className="spell-combat-line1">
                  <span
                    className={`conc-dot combat-conc-dot${isConc ? ' conc-dot--on' : ''}`}
                    title={isConc ? 'Concentration active' : requiresConc ? 'Requires concentration' : 'No concentration'}
                  />
                  <span className="spell-combat-name">{spell.name}</span>
                </div>
                <div className="spell-combat-line2">
                  {dmgDice && <span className="badge">{dmgDice}{dmgType ? ` ${dmgType}` : ''}</span>}
                  {isAtk && spellAtk != null && <span className="badge">{fmtB(spellAtk)} to hit</span>}
                  {saveName && spellDC != null && <span className="badge">DC {spellDC} {saveName}</span>}
                  {requiresConc && <span className="badge badge--dim">Conc</span>}
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
                      onClick={() => isOwner && !locked && castSpell(spell, selectedSlot, requiresConc)}
                      disabled={spell.level > 0 && !selectedSlot}
                      title={spell.level === 0 ? (requiresConc ? 'Cantrip — no slot used, starts concentration' : 'Cantrip — no slot used') : requiresConc ? 'Cast — uses one spell slot and starts concentration' : 'Cast — uses one spell slot'}
                    >Cast</button>
                    {isConc && (
                      <button
                        className="atk-btn atk-btn--concentration"
                        onClick={() => isOwner && !locked && clearConcentration()}
                        disabled={!isOwner || locked}
                        title="End concentration"
                      >End Conc</button>
                    )}
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

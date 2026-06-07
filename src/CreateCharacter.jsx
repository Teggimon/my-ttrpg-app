import { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { getClasses, getRaces, getSubraces, getBackgrounds, getEquipment, getOptionalFeatures } from './srdContent'
import { FEATS, SUBCLASSES, SUBCLASS_LEVELS, featRule, getSlotsForCharacter, CANTRIPS_KNOWN, SPELLS_KNOWN_L1 } from './LevelUpModal'
import { getSpells } from './srdContent'
import { ALL_SOURCES, effectiveSourceFilter, filterBySearchAndSource, sourceCode, sourceOptions } from './sourceFilters'
import { inventoryItemFromCatalogItem, normalizeInventoryItem } from './itemRules'
import { RULES_EDITION_OPTIONS, normalizeAvailableRulesEdition, normalizeRuleSettings, normalizeRulesEdition, rulesSystemForEdition } from './ruleSettings'

// Spellcasting ability by class index
const SPELLCASTING_ABILITY = {
  bard: 'cha', cleric: 'wis', druid: 'wis', paladin: 'cha',
  ranger: 'wis', sorcerer: 'cha', warlock: 'cha', wizard: 'int',
  artificer: 'int',
}

const SKILL_INDEX_TO_STAT_KEY = {
  'animal-handling': 'animalHandling',
  'sleight-of-hand': 'sleightOfHand',
}

const CONTENT_LOADING_INITIAL = {
  races: true,
  subraces: true,
  classes: true,
  backgrounds: true,
  equipment: true,
}

function skillKeyFromIndex(index) {
  const key = String(index ?? '').replace(/^skill-/, '')
  return SKILL_INDEX_TO_STAT_KEY[key] ?? key
}

function effectiveRaceAbilityBonuses(raceData, subraceData) {
  return subraceData?.abilityOverridesRace ? [] : (raceData?.ability_bonuses ?? [])
}

function effectiveRaceAbilityChoice(raceData, subraceData) {
  return subraceData?.abilityOverridesRace ? null : raceData?.ability_bonus_options
}
function effectiveAbilityChoices(raceData, subraceData) {
  return [
    effectiveRaceAbilityChoice(raceData, subraceData),
    subraceData?.ability_bonus_options,
  ].filter(Boolean)
}
function isVariantHuman(raceData, subraceData) {
  return raceData?.index === 'human' && /^variant$/i.test(subraceData?.name ?? '') && subraceData?.source === 'PHB'
}

function featNeedsCreationSetup(feat) {
  const rule = featRule(feat)
  return !!(
    rule.damageTypeChoice ||
    rule.spellClassChoice ||
    rule.ritualClassChoice ||
    rule.cantripsKnown ||
    rule.cantripFromAnyClass ||
    rule.spellsKnown ||
    rule.ritualSpellsKnown ||
    rule.maneuverChoices ||
    rule.skillOrToolProficiencies ||
    rule.weaponProficiencies
  )
}

function creationFeatPrereqStatus(feat, abilityScores, raceData, subraceData, raceBonusOptions) {
  const prereq = feat?.prereq
  if (!prereq) return { ok: true }
  if (/spellcasting/i.test(prereq)) return { ok: false, reason: 'Requires spellcasting after class selection.' }
  if (/armou?r/i.test(prereq)) return { ok: false, reason: 'Requires armor proficiency after class selection.' }

  const abilityParts = String(prereq).match(/(STR|DEX|CON|INT|WIS|CHA)(?:\s+or\s+(STR|DEX|CON|INT|WIS|CHA))*\s+(\d+)/i)
  if (abilityParts) {
    const required = Number(abilityParts[3])
    const abilities = [...String(prereq).matchAll(/STR|DEX|CON|INT|WIS|CHA/gi)].map(match => match[0].toLowerCase())
    const ok = abilities.some(key => abilityScoreWithCreationBonuses(abilityScores, key, raceData, subraceData, raceBonusOptions) >= required)
    return { ok, reason: `Requires ${feat.prereq}.` }
  }

  return { ok: false, reason: `Requires ${prereq}.` }
}

function selectedSubclassData(classData, subclassChoice) {
  const choice = String(subclassChoice ?? '').toLowerCase()
  if (!choice) return null
  return (classData?.subclasses ?? []).find(subclass =>
    String(subclass.name ?? '').toLowerCase() === choice ||
    String(subclass.fullName ?? '').toLowerCase() === choice
  ) ?? null
}

function featureText(feature) {
  return (feature?.desc ?? []).join(' ')
}

function bonusProficienciesFromFeatures(features = []) {
  const proficiencies = []
  for (const feature of features) {
    const text = featureText(feature).toLowerCase()
    if (/\bheavy armor\b/.test(text)) proficiencies.push({ index: 'heavy-armor-proficiency', name: 'Heavy armor proficiency' })
    if (/\bmartial weapons\b/.test(text)) proficiencies.push({ index: 'martial-weapon-proficiency', name: 'Martial weapon proficiency' })
  }
  return proficiencies
}

function bonusSpellsFromSubclass(classData, subclassData, startingCantrips = []) {
  const knownIndexes = new Set(startingCantrips.map(spell => spell.index))
  return (subclassData?.additionalSpells ?? []).flatMap(entry =>
    Object.entries(entry?.known ?? {})
      .filter(([unlockLevel]) => Number(unlockLevel) <= 1)
      .flatMap(([, spells]) => (spells ?? [])
        .filter(spell => typeof spell === 'string')
        .map(spell => {
          const index = spellIndexFromName(spell)
          const isCantrip = /#c\b/i.test(spell) || index === 'light'
          return {
            id: index,
            index,
            name: spellNameFromIndex(index),
            source: subclassData?.source ?? 'PHB',
            level: isCantrip ? 0 : 1,
            classIndex: classData?.index ?? null,
            castingAbility: SPELLCASTING_ABILITY[classData?.index] ?? null,
            origin: `${subclassData?.name ?? 'Subclass'} Bonus Spells`,
            bonusKnown: true,
          }
        }))
  ).filter(spell => !knownIndexes.has(spell.index))
}

function fixedBonusCantripsFromFeatures(features = [], classData = {}, existingSpells = []) {
  const existingIndexes = new Set(existingSpells.map(spell => spell.index))
  return features.flatMap(feature => {
    const text = featureText(feature)
    if (!/cantrips?/i.test(text) || !/does(?:n'?t| not) count/i.test(text) || /\bchoice\b/i.test(text)) return []
    return [...text.matchAll(/{@spell ([^}|#]+)(?:\|[^}#]+)?(?:#[^}]*)?}/gi)]
      .map(match => {
        const index = spellIndexFromName(match[1])
        return {
          id: index,
          index,
          name: spellNameFromIndex(index),
          source: feature.source ?? classData?.source ?? 'PHB',
          level: 0,
          classIndex: classData?.index ?? null,
          castingAbility: SPELLCASTING_ABILITY[classData?.index] ?? null,
          origin: feature.name ?? 'Bonus Cantrip',
          bonusKnown: true,
        }
      })
      .filter(spell => !existingIndexes.has(spell.index))
  })
}

function selectedFeatureOptionsByType(classFeatureChoices = [], featureType) {
  return classFeatureChoices.flatMap(choice =>
    (choice.options ?? []).filter(option => (option.featureType ?? []).includes(featureType))
  )
}

function featureToolProficiencyLabel(option) {
  if (!option?.name) return null
  return (option.featureType ?? []).includes('EXPERTISE') ? `${option.name} expertise` : option.name
}

function selectedDraconicAncestor(classFeatureChoices = []) {
  const option = selectedFeatureOptionsByType(classFeatureChoices, 'SORCERER:DRACONIC_ANCESTRY')[0]
  if (!option) return null
  return {
    name: option.name,
    damageType: option.damageType ?? option.desc?.[0]?.match(/^(\w+)/)?.[1]?.toLowerCase() ?? null,
  }
}

function shouldAutoEquipStartingItem(item, armorEquipped) {
  const category = item.armor_category
  if (item.damage) return true
  if (category === 'Shield') return true
  if (['Light', 'Medium', 'Heavy'].includes(category)) return !armorEquipped
  return false
}

function autoEquipStartingInventory(inventory = []) {
  let armorEquipped = false
  return inventory.map(item => {
    const equipped = shouldAutoEquipStartingItem(item, armorEquipped)
    if (equipped && ['Light', 'Medium', 'Heavy'].includes(item.armor_category)) armorEquipped = true
    return equipped ? { ...item, equipped: true } : item
  })
}

function hasFeatByName(feat, name) {
  return feat?.name === name
}

function isOneHandedMeleeWeapon(item) {
  if (!item.damage) return false
  const props = item.properties ?? []
  const propsLower = props.map(prop => (typeof prop === 'string' ? prop : prop.name ?? '').toLowerCase())
  return !propsLower.includes('ammunition') && !propsLower.includes('two-handed')
}

function initialArmorClass(inventory, abilityScores, classFeatures, classFeatureChoices, feat = null) {
  const dexMod = Math.floor(((abilityScores?.dex ?? 10) - 10) / 2)
  const conMod = Math.floor(((abilityScores?.con ?? 10) - 10) / 2)
  const wisMod = Math.floor(((abilityScores?.wis ?? 10) - 10) / 2)
  const active = inventory.filter(item => item.equipped || item.attuned)
  let armorBase = null
  let armorCat = null
  let shieldAC = 0

  for (const item of active) {
    const ac = item.armor_class
    const cat = item.armor_category
    if (!ac || !cat) continue
    if (cat === 'Shield') shieldAC += ac.base ?? 2
    else if (['Light', 'Medium', 'Heavy'].includes(cat)) {
      armorBase = ac.base
      armorCat = cat
    }
  }

  const hasDraconicResilience = classFeatures.some(feature => feature.name === 'Draconic Resilience')
  const hasBarbarianUnarmored = classFeatures.some(feature =>
    feature.name === 'Unarmored Defense' && feature.classIndex === 'barbarian'
  )
  const hasMonkUnarmored = classFeatures.some(feature =>
    feature.name === 'Unarmored Defense' && feature.classIndex === 'monk'
  )
  const hasDefenseStyle = classFeatureChoices.some(choice =>
    (choice.options ?? []).some(option => option.name === 'Defense')
  )
  const dualWielderBonus = hasFeatByName(feat, 'Dual Wielder') &&
    active.filter(isOneHandedMeleeWeapon).length >= 2
    ? 1
    : 0
  if (armorBase != null) {
    const mediumDexCap = hasFeatByName(feat, 'Medium Armour Master') ? 3 : 2
    const armorAC = armorCat === 'Light' ? armorBase + dexMod
      : armorCat === 'Medium' ? armorBase + Math.min(dexMod, mediumDexCap)
      : armorBase
    return armorAC + shieldAC + (hasDefenseStyle ? 1 : 0) + dualWielderBonus
  }

  const baseCandidates = [
    10 + dexMod,
    hasDraconicResilience ? 13 + dexMod : null,
    hasBarbarianUnarmored ? 10 + dexMod + conMod : null,
    hasMonkUnarmored && shieldAC === 0 ? 10 + dexMod + wisMod : null,
  ].filter(value => value != null)
  return Math.max(...baseCandidates) + shieldAC + dualWielderBonus
}

function spellNameFromIndex(index) {
  return String(index ?? '')
    .split('-')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function spellIndexFromName(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function domainPreparedSpells(subclassData) {
  const spellIndexes = (subclassData?.additionalSpells ?? [])
    .flatMap(entry => entry?.prepared?.['1'] ?? entry?.prepared?.[1] ?? [])
    .filter(spell => typeof spell === 'string')
    .map(spell => spell.replace(/#.*$/, ''))
  return [...new Set(spellIndexes)].map(index => ({
    id: index,
    index,
    name: spellNameFromIndex(index),
    source: subclassData?.source ?? 'PHB',
    level: 1,
    classIndex: 'cleric',
    castingAbility: SPELLCASTING_ABILITY.cleric,
    origin: `${subclassData?.name ?? 'Domain'} Domain`,
    alwaysPrepared: true,
    domainSpell: true,
  }))
}

function expandedSpellIndexesForLevel(subclassData, spellLevel) {
  return [...new Set((subclassData?.additionalSpells ?? [])
    .flatMap(entry => entry?.expanded?.[`s${spellLevel}`] ?? [])
    .filter(spell => typeof spell === 'string')
    .map(spell => spellIndexFromName(spell.replace(/#.*$/, ''))))]
}

function classGrantedLanguages(classData, subclassData) {
  return [
    classData?.index === 'druid' ? 'Druidic' : null,
    classData?.index === 'rogue' ? "Thieves' Cant" : null,
    classData?.index === 'sorcerer' && /^draconic$/i.test(subclassData?.name ?? '') ? 'Draconic' : null,
  ].filter(Boolean)
}

function groupProficiencies(proficiencies = [], languages = []) {
  const groups = { Armour: [], Weapons: [], Tools: [], Languages: languages }
  for (const proficiency of proficiencies) {
    const name = String(proficiency ?? '').trim()
    if (!name) continue
    const lower = name.toLowerCase()
    const category = lower.includes('weapon') ? 'Weapons'
      : lower.includes('armor') || lower.includes('armour') || lower.includes('shield') ? 'Armour'
      : 'Tools'
    groups[category].push(name)
  }
  return Object.fromEntries(Object.entries(groups).map(([category, values]) => [
    category,
    values.filter((value, index, list) => value && list.indexOf(value) === index),
  ]))
}

// ─── Character builder ────────────────────────────────────────────────────────

export function buildCharacter({ user, name, raceData, subraceData, classData, subclassChoice, backgroundData, alignment, rulesEdition = '2014', choices, baseAbilityScores, startingCantrips, startingBonusCantrips, startingSpells, equipmentCatalog = [] }) {
  const normalizedRulesEdition = normalizeRulesEdition(rulesEdition)
  const {
    raceBonusOptions = [],   // [{ability_score:{index}, bonus}]
    classSkills = [],        // ['skill-perception', ...]
    classTools = [],
    classEquipment = [],     // [{index, name, quantity}]
    classFeatureChoices = [],
    backgroundLanguages = [],
    backgroundTools = [],
    backgroundEquipment = [],
    backgroundFeature = null,
    racialOptionChoices = {},
    racialFeat = null,
    racialFeatAbility = null,
    racialLanguages = [],
    racialSkills = [],
    racialTools = [],
  } = choices

  // 1. Base ability scores from creation step (default 10 if not provided)
  const abilityScores = {
    str: baseAbilityScores?.str ?? 10,
    dex: baseAbilityScores?.dex ?? 10,
    con: baseAbilityScores?.con ?? 10,
    int: baseAbilityScores?.int ?? 10,
    wis: baseAbilityScores?.wis ?? 10,
    cha: baseAbilityScores?.cha ?? 10,
  }

  // 2. Race ability bonuses (fixed) — StepAbilityScores shows these as preview but does NOT apply them;
  //    buildCharacter applies them so the stored value is final.
  for (const bonus of effectiveRaceAbilityBonuses(raceData, subraceData)) {
    abilityScores[bonus.ability_score.index] += bonus.bonus
  }
  // 2b. Subrace ability bonuses
  for (const bonus of (subraceData?.ability_bonuses ?? [])) {
    abilityScores[bonus.ability_score.index] += bonus.bonus
  }
  // 2c. Chosen ability bonus options (e.g. Half-Elf +1 to two stats)
  for (const bonus of raceBonusOptions) {
    abilityScores[bonus.ability_score.index] += bonus.bonus
  }
  const racialFeatRule = featRule(racialFeat)
  if (racialFeatRule.abilityIncrease && racialFeatAbility) {
    abilityScores[racialFeatAbility] = Math.min(20, (abilityScores[racialFeatAbility] ?? 10) + racialFeatRule.abilityIncrease)
  }

  const subclassData = selectedSubclassData(classData, subclassChoice)
  const draconicAncestor = selectedDraconicAncestor(classFeatureChoices)
  const subclassFeatures = Object.values(subclassData?.features_by_level ?? {})
    .flat()
    .filter(feature => (feature.level ?? 1) <= 1)

  // 3. HP: hit_die + CON mod
  const conMod = Math.floor((abilityScores.con - 10) / 2)
  const hitDie = classData?.hit_die ?? 8
  const subclassHpBonus = classData?.index === 'sorcerer' && /^draconic$/i.test(subclassData?.name ?? '') ? 1 : 0
  const hpMax = Math.max(1, hitDie + conMod + subclassHpBonus)

  // 4. Speed & size from race
  const speed = raceData?.speed ?? 30
  const size = raceData?.size ?? 'Medium'

  // 5. Saving throw proficiencies from class
  const savingThrows = {}
  for (const save of (classData?.saving_throws ?? [])) {
    savingThrows[save.index] = { proficient: true }
  }
  if (racialFeatRule.savingThrowChoice && racialFeatAbility) {
    savingThrows[racialFeatAbility] = {
      ...(savingThrows[racialFeatAbility] ?? {}),
      proficient: true,
    }
  }

  // 6. Skill proficiencies
  const skills = {}
  // From class choices
  for (const skillIndex of classSkills) {
    const key = skillKeyFromIndex(skillIndex)
    skills[key] = { proficient: true }
  }
  // From background (fixed)
  for (const prof of (backgroundData?.starting_proficiencies ?? [])) {
    if (prof.index?.startsWith('skill-')) {
      skills[skillKeyFromIndex(prof.index)] = { proficient: true }
    }
  }
  // From race/subrace fixed and chosen skill proficiencies
  for (const prof of [
    ...(raceData?.starting_proficiencies ?? []),
    ...(subraceData?.starting_proficiencies ?? []),
  ]) {
    if (prof.index?.startsWith('skill-')) {
      skills[skillKeyFromIndex(prof.index)] = { proficient: true }
    }
  }
  for (const skillIndex of racialSkills) {
    skills[skillKeyFromIndex(skillIndex)] = { proficient: true }
  }
  for (const choice of classFeatureChoices) {
    for (const option of (choice.options ?? []).filter(option => (option.featureType ?? []).includes('SKILL'))) {
      const key = skillKeyFromIndex(option.id)
      skills[key] = {
        ...(skills[key] ?? {}),
        proficient: true,
        ...(choice.featureName === 'Blessings of Knowledge' && { expertise: true }),
      }
    }
    for (const option of (choice.options ?? []).filter(option => (option.featureType ?? []).includes('EXPERTISE') && option.id?.startsWith('skill-'))) {
      const key = skillKeyFromIndex(option.id)
      skills[key] = {
        ...(skills[key] ?? {}),
        proficient: true,
        expertise: true,
      }
    }
  }

  // 7. Armor / weapon proficiencies from class
  const proficiencies = [
    ...(classData?.proficiencies ?? []),
    ...bonusProficienciesFromFeatures(subclassFeatures),
    ...(raceData?.starting_proficiencies ?? []),
    ...(subraceData?.starting_proficiencies ?? []),
    ...(backgroundData?.starting_proficiencies ?? []),
  ]
    .filter(p => !p.index?.startsWith('saving-throw-'))
    .filter(p => !p.index?.startsWith('skill-'))
    .map(p => p.name)
  for (const tool of racialTools) proficiencies.push(tool.name ?? tool)
  for (const tool of classTools) proficiencies.push(tool.name ?? tool)
  for (const tool of backgroundTools) proficiencies.push(tool.name ?? tool)
  for (const values of Object.values(racialFeatRule.proficiencies ?? {})) {
    proficiencies.push(...values)
  }
  for (const option of selectedFeatureOptionsByType(classFeatureChoices, 'TOOL')) {
    const label = featureToolProficiencyLabel(option)
    if (label) proficiencies.push(label)
  }

  // 8. Inventory: class starting_equipment + chosen class equipment + background equipment
  const inventory = []
  const equipmentByIndex = Object.fromEntries(equipmentCatalog.map(item => [item.index, item]))
  const addInventoryItem = (item, originPack = null, packTrail = []) => {
    const normalizedInput = normalizeInventoryItem(item)
    const catalogItem = equipmentByIndex[item.index] ?? equipmentByIndex[normalizedInput.index]
    if (catalogItem?.pack_contents?.length) {
      if (packTrail.includes(catalogItem.index)) {
        inventory.push({
          itemId: uuidv4(),
          equipped: false,
          ...inventoryItemFromCatalogItem(catalogItem, item.quantity ?? 1),
          ...(originPack && { sourcePack: originPack }),
        })
        return
      }
      for (const packItem of catalogItem.pack_contents) {
        addInventoryItem(
          { ...packItem, quantity: (packItem.quantity ?? 1) * (item.quantity ?? 1) },
          catalogItem.name,
          [...packTrail, catalogItem.index],
        )
      }
      return
    }
    const quantityIsIndividualAmmoCount = normalizedInput.isAmmo && (item.quantity ?? 1) > 1
    const baseItem = catalogItem
      ? inventoryItemFromCatalogItem(catalogItem, quantityIsIndividualAmmoCount ? 1 : item.quantity ?? 1)
      : normalizedInput
    if (quantityIsIndividualAmmoCount) baseItem.quantity = item.quantity
    inventory.push({
      itemId: uuidv4(),
      equipped: false,
      ...baseItem,
      source: item.source ?? baseItem.source ?? catalogItem?.source,
      ...(item.custom && { custom: true }),
      ...(item.containsValue && { containsValue: item.containsValue }),
      ...(originPack && { sourcePack: originPack }),
    })
  }
  for (const item of (classData?.starting_equipment ?? [])) {
    addInventoryItem({ index: item.equipment.index, name: item.equipment.name, quantity: item.quantity })
  }
  for (const item of classEquipment) {
    addInventoryItem(item)
  }
  for (const item of (backgroundData?.starting_equipment ?? [])) {
    addInventoryItem({ index: item.equipment.index, name: item.equipment.name, quantity: item.quantity })
  }
  for (const item of backgroundEquipment) {
    addInventoryItem(item)
  }
  const equippedInventory = autoEquipStartingInventory(inventory)

  // 9. Racial traits
  const draconicAncestry = racialOptionChoices['draconic-ancestry'] ?? null
  const racialTraits = [
    ...(raceData?.traits ?? []).map(t => ({ index: t.index, name: t.name, source: raceData.source })),
    ...(subraceData?.racial_traits ?? []).map(t => ({ index: t.index, name: t.name, source: subraceData.source })),
  ].map(t => {
    if (t.index !== 'breath-weapon' || !draconicAncestry) return t
    return {
      ...t,
      ancestry: draconicAncestry.name,
      damageType: draconicAncestry.damageType,
      breathWeapon: draconicAncestry.breathWeapon,
      savingThrow: draconicAncestry.savingThrow,
    }
  })
  const damageResistances = draconicAncestry?.grantsResistance && draconicAncestry?.damageType ? [draconicAncestry.damageType] : []
  const classFeatures = [
    ...Object.values(classData?.features_by_level ?? {})
      .flat()
      .filter(feature => (feature.level ?? 1) <= 1)
      .map(feature => ({
        index: feature.index,
        name: feature.name,
        source: feature.source,
        desc: feature.desc ?? [],
        classIndex: classData?.index ?? null,
        className: classData?.name ?? '',
        gainedAtLevel: feature.level ?? 1,
      })),
    ...subclassFeatures.map(feature => ({
        index: feature.index,
        name: feature.name,
        source: feature.source,
        desc: feature.desc ?? [],
        classIndex: classData?.index ?? null,
        className: classData?.name ?? '',
        subclassName: subclassData?.name ?? subclassChoice,
        ...(feature.name === 'Dragon Ancestor' && draconicAncestor ? { dragonAncestor: draconicAncestor.name, damageType: draconicAncestor.damageType } : {}),
        gainedAtLevel: feature.level ?? 1,
      })),
  ]
  const startingAC = initialArmorClass(equippedInventory, abilityScores, classFeatures, classFeatureChoices, racialFeat)
  const bonusSpells = [
    ...bonusSpellsFromSubclass(classData, subclassData, startingCantrips),
    ...(startingBonusCantrips ?? []),
    ...fixedBonusCantripsFromFeatures(subclassFeatures, classData, [...(startingCantrips ?? []), ...(startingBonusCantrips ?? [])]),
    ...(classData?.index === 'cleric' ? domainPreparedSpells(subclassData) : []),
  ]
  const selectedClassFeatureChoices = classFeatureChoices.map(choice => ({
    choiceKey: choice.choiceKey,
    featureIndex: choice.featureIndex,
      featureName: choice.featureName,
      className: choice.className,
      classIndex: choice.classIndex,
      subclassName: choice.subclassName,
      gainedAtLevel: choice.gainedAtLevel,
    options: (choice.options ?? []).map(option => ({
      id: option.id,
      name: option.name,
      source: option.source,
      desc: option.desc ?? [],
      featureType: option.featureType,
      damageType: option.damageType,
    })),
  }))
  const racialFeatChoices = racialFeat ? {
    featName: racialFeat.name,
    ability: racialFeatAbility ?? null,
    skills: [],
    tools: [],
    damageType: null,
    spellClass: null,
    cantrips: [],
    spells: [],
    maneuvers: [],
    weapons: [],
  } : null

  // 10. Languages
  const languages = [
    ...(raceData?.languages ?? []).map(l => l.name),
    ...(subraceData?.languages ?? []).map(l => l.name),
    ...racialLanguages,
    ...selectedFeatureOptionsByType(classFeatureChoices, 'LANGUAGE').map(option => option.name),
    ...classGrantedLanguages(classData, subclassData),
    ...backgroundLanguages,
  ].filter((language, index, all) => language && all.indexOf(language) === index)
  const spellSlotData = getSlotsForCharacter([{ index: classData?.index ?? null, level: 1 }])
  const featHpBonus = racialFeatRule.hpPerLevel ? racialFeatRule.hpPerLevel : 0
  const featSpeedBonus = racialFeatRule.speedBonus ?? 0
  const featInitiativeBonus = racialFeatRule.initiativeBonus ?? 0
  const featPassiveBonus = racialFeatRule.passiveBonus ?? 0

  return {
    meta: {
      owner: `github:${user.login}`,
      characterId: uuidv4(),
      copiedFrom: null,
      system: rulesSystemForEdition(normalizedRulesEdition),
      rulesEdition: normalizedRulesEdition,
      version: 1,
      lastUpdated: new Date().toISOString(),
    },
    identity: {
      name,
      race: raceData?.name ?? name,
      raceIndex: raceData?.index ?? null,
      subrace: subraceData?.isBaseRaceOption ? null : subraceData?.name ?? null,
      subraceIndex: subraceData?.isBaseRaceOption ? null : subraceData?.index ?? null,
      class: [{ name: classData?.name ?? '', index: classData?.index ?? null, source: classData?.source ?? null, level: 1, subclass: subclassChoice ?? null }],
      background: backgroundData?.name ?? '',
      backgroundIndex: backgroundData?.index ?? null,
      backgroundFeature: backgroundFeature ?? null,
      alignment,
      xp: 0,
      portrait: null,
      size,
      languages,
      racialOptions: racialOptionChoices,
      racialTraits,
    },
    stats: {
      abilityScores,
      savingThrows,
      skills,
      proficiencies: groupProficiencies(proficiencies, languages),
      damageResistances,
      ...(featPassiveBonus && {
        passiveBonuses: {
          perception: featPassiveBonus,
          investigation: featPassiveBonus,
        },
      }),
    },
    combat: {
      hpMax: hpMax + featHpBonus,
      hpCurrent: hpMax + featHpBonus,
      hpTemp: 0,
      ac: startingAC,
      initiative: 0,
      ...(featInitiativeBonus && { initiativeBonus: featInitiativeBonus }),
      speed: speed + featSpeedBonus,
      deathSaves: { successes: 0, failures: 0 },
      conditions: [],
    },
    inventory: equippedInventory,
    feats: racialFeat ? [{
      name: racialFeat.name,
      desc: racialFeat.desc,
      source: racialFeat.source ?? null,
      origin: 'Variant Human',
      choices: racialFeatAbility ? { ability: racialFeatAbility } : {},
    }] : [],
    racialTraits,
    spells: {
      spellcastingAbility: SPELLCASTING_ABILITY[classData?.index] ?? null,
      slots: spellSlotData.slots,
      pactSlots: spellSlotData.pactSlots,
      known: [...(startingCantrips ?? []), ...bonusSpells, ...(startingSpells ?? [])],
      prepared: [...(startingSpells ?? []), ...bonusSpells.filter(spell => spell.level > 0)].map(s => s.index),
      concentration: null,
    },
    customContent: {
      classFeatures,
      classFeatureChoices: selectedClassFeatureChoices,
      ...(racialFeatChoices && { featChoices: [racialFeatChoices] }),
      backgroundFeature: backgroundFeature ?? null,
    },
    notes: {
      personalityTraits: '',
      ideals: '',
      bonds: '',
      flaws: '',
      appearance: '',
      backstory: '',
      alliesAndOrganisations: '',
      general: '',
    },
    settings: normalizeRuleSettings({
      rulesEdition: normalizedRulesEdition,
      encumbranceTracking: false,
      encumbranceMode: 'disabled',
      attunementLimit: 3,
      spellComponents: 'all',
      concentrationMode: 'raw',
      cantripScaling: 'character',
      hitDiceRecovery: 'all',
      longRestHpRecovery: 'full',
      longRestDuration: '8h',
      shortRestDuration: '1h',
      shortRestsPerLongRest: 2,
      levellingSystem: 'xp',
      milestoneMode: false,
      multiclassing: 'enabled',
    }),
  }
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const S = {
  shell: { minHeight: '100dvh', width: '100%', padding: 'clamp(0px, 2vw, 1rem)', boxSizing: 'border-box', display: 'grid', placeItems: 'stretch', background: 'var(--bg-base)' },
  panel: { width: '100%', maxWidth: '920px', minWidth: 0, minHeight: '100dvh', height: '100%', justifySelf: 'center', display: 'flex', flexDirection: 'column', overflowY: 'auto', scrollbarGutter: 'stable', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', boxSizing: 'border-box' },
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', padding: '1.25rem 1rem 0', width: '100%', maxWidth: '720px', minWidth: 0, margin: '0 auto', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', boxSizing: 'border-box' },
  h1: { fontSize: '1.05rem', fontWeight: 800, marginBottom: '0.25rem', color: 'var(--text-primary)', letterSpacing:'0.01em' },
  sub: { fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight:1.45 },
  label: { display: 'block', fontSize: '0.72rem', fontWeight:700, color: 'var(--text-muted)', marginBottom: '0.35rem', marginTop: '1rem', textTransform: 'uppercase', letterSpacing: '0.08em' },
  input: { width: '100%', minHeight:44, padding: '0.62rem 0.75rem', background: 'var(--bg-inset)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontSize: '0.9rem', boxSizing: 'border-box', outline:'none' },
  card: (selected, disabled = false) => ({
    minHeight: 74, padding: '0.8rem 0.9rem', borderRadius: 'var(--radius-md)', cursor: disabled ? 'default' : 'pointer', marginBottom: '0.45rem', boxSizing: 'border-box',
    background: selected ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
    border: selected ? '1px solid var(--accent)' : '1px solid var(--border)',
    boxShadow: selected ? 'var(--shadow-sm)' : 'none',
    opacity: disabled ? 0.45 : 1,
    transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
  }),
  cardName: { fontWeight: 800, fontSize: '0.95rem', color:'var(--text-primary)' },
  cardSub: { fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' },
  emptyState: { minHeight:74, display:'grid', placeItems:'center', padding:'0.8rem 0.9rem', border:'1px dashed var(--border-strong)', borderRadius:'var(--radius-md)', background:'var(--bg-inset)', color:'var(--text-secondary)', fontSize:'0.85rem', textAlign:'center' },
  row: { position:'sticky', bottom:0, zIndex:30, display: 'grid', gridTemplateColumns:'minmax(0, 1fr) minmax(0, 1fr)', gap: '0.75rem', marginTop: 'auto', padding:'0.75rem 0 1rem', background:'var(--bg-surface)', boxSizing:'border-box' },
  btn: (primary) => ({
    width:'100%', minHeight:44, padding: '0.65rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem',
    background: primary ? 'var(--accent)' : 'var(--bg-elevated)',
    color: primary ? 'var(--accent-text)' : 'var(--text-secondary)',
    border: primary ? 'none' : '1px solid var(--border-strong)',
  }),
  progress: { display: 'flex', gap: '0.35rem', marginBottom: '1.5rem' },
  dot: (active, done) => ({
    height: '4px', flex: 1, borderRadius: '2px',
    background: done ? 'var(--accent)' : active ? 'var(--accent-hover)' : 'var(--border)',
    transition: 'background 0.2s',
  }),
  checkRow: { display: 'flex', alignItems: 'center', gap: '0.6rem', minHeight:44, padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', marginBottom: '0.35rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)' },
  tag: { display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'var(--accent-subtle)', border: '1px solid var(--accent-secondary)', fontSize: '0.75rem', color: 'var(--accent-hover)', marginRight: '0.35rem', marginTop: '0.35rem' },
  featureBox: { background: 'var(--bg-inset)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem', marginTop: '0.75rem' },
  featureName: { fontWeight: 700, color: 'var(--accent-hover)', marginBottom: '0.5rem' },
  featureDesc: { fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 },
  error: { color: 'var(--danger)', fontSize: '0.85rem', marginTop: '0.75rem' },
  scrollList: { marginTop: '0.5rem' },
  searchWrap: { display:'flex', gap:'0.45rem', alignItems:'stretch', marginBottom:'0.55rem' },
  searchBox: { position:'relative', flex:1 },
  inputWithClear: { paddingRight:'2.3rem' },
  clearBtn: { position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', width:32, height:32, border:'none', borderRadius:'var(--radius-sm)', background:'transparent', color:'var(--text-muted)', cursor:'pointer', fontSize:'1rem', fontFamily:'var(--font-body)' },
  sourceWrap: { position:'relative', flex:'0 0 auto' },
  sourceButton: (active) => ({
    minHeight:44, width:54, padding:'0', borderRadius:'var(--radius-md)', cursor:'pointer',
    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
    background: active ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
    color: active ? 'var(--accent-hover)' : 'var(--text-secondary)',
    fontFamily:'var(--font-body)', fontSize:'0.72rem', fontWeight:800, display:'grid', placeItems:'center',
  }),
  sourceMenu: { position:'absolute', right:0, top:'calc(100% + 6px)', zIndex:40, width:190, maxHeight:260, overflowY:'auto', padding:'0.35rem', border:'1px solid var(--border-strong)', borderRadius:'var(--radius-md)', background:'var(--bg-elevated)', boxShadow:'var(--shadow-lg)' },
  sourceOption: (active) => ({ width:'100%', minHeight:36, padding:'0.45rem 0.6rem', border:'none', borderRadius:'var(--radius-sm)', background: active ? 'var(--accent-subtle)' : 'transparent', color: active ? 'var(--accent-hover)' : 'var(--text-secondary)', textAlign:'left', cursor:'pointer', fontSize:'0.78rem', fontWeight:700, fontFamily:'var(--font-body)' }),
  sourceBadge: { flex:'0 0 auto', padding:'0.15rem 0.5rem', borderRadius:'9999px', border:'1px solid var(--border-strong)', background:'var(--bg-inset)', color:'var(--text-muted)', fontSize:'0.68rem', fontWeight:800, fontFamily:'var(--font-mono)', letterSpacing:'0.02em' },
  cardTop: { display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'0.65rem' },
}

function FunnelIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 6h16l-6 7v5l-4 2v-7L4 6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

function SourceFilter({ items, value, onChange }) {
  const [open, setOpen] = useState(false)
  const options = sourceOptions(items)
  if (options.length <= 1) return null
  const active = value !== ALL_SOURCES
  return (
    <div style={S.sourceWrap}>
      <button
        type="button"
        aria-label="Filter sources"
        style={S.sourceButton(active)}
        onClick={() => setOpen(o => !o)}
      >
        {active ? sourceCode({ source: value }) : <FunnelIcon />}
      </button>
      {open && (
        <div style={S.sourceMenu}>
      {[ALL_SOURCES, ...options].map(source => (
        <button
          key={source}
          type="button"
              style={S.sourceOption(value === source)}
              onClick={() => { onChange(source); setOpen(false) }}
        >
          {source === ALL_SOURCES ? 'All sources' : source}
        </button>
      ))}
        </div>
      )}
    </div>
  )
}

function SearchInput({ placeholder, value, onChange, items, sourceFilter, onSourceFilter }) {
  return (
    <div style={S.searchWrap}>
      <div style={S.searchBox}>
        <input
          style={{ ...S.input, ...S.inputWithClear }}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        {value && (
          <button type="button" style={S.clearBtn} onClick={() => onChange('')} aria-label="Clear search">
            ×
          </button>
        )}
      </div>
      <SourceFilter items={items} value={sourceFilter} onChange={onSourceFilter} />
    </div>
  )
}

function SourceBadge({ item }) {
  return <span style={S.sourceBadge}>{sourceCode(item)}</span>
}

function raceSearchText(race) {
  return [
    race?.name,
    race?.source,
    race?.size,
    ...(race?.ability_bonuses ?? []).map(bonus => bonus?.ability_score?.name),
    ...(race?.traits ?? []).map(trait => trait?.name),
    ...(race?.subraces ?? []).map(subrace => subrace?.name),
  ].filter(Boolean).join(' ')
}

function StepEdition({ selected, onSelect, onNext, onCancel }) {
  return (
    <div style={S.wrap}>
      <div style={S.h1}>Choose Rules Edition</div>
      <div style={S.sub}>Which rules should this character use?</div>
      <div style={S.scrollList}>
        {RULES_EDITION_OPTIONS.map(option => (
          option.available === false ? (
            <div
              key={option.value}
              style={S.card(false, true)}
              aria-disabled="true"
            >
              <div style={S.cardName}>{option.label}</div>
              <div style={S.cardSub}>{option.sub} · {option.unavailableLabel ?? 'Unavailable'}</div>
            </div>
          ) : (
          <div
            key={option.value}
            style={S.card(selected === option.value)}
            onClick={() => onSelect(option.value)}
          >
            <div style={S.cardName}>{option.label}</div>
            <div style={S.cardSub}>{option.sub}</div>
          </div>
          )
        ))}
      </div>
      <div style={S.row}>
        <button style={S.btn(false)} onClick={onCancel}>Cancel</button>
        <button style={S.btn(true)} onClick={onNext}>Next: Name →</button>
      </div>
    </div>
  )
}

// ─── Ability score constants ──────────────────────────────────────────────────

const STANDARD_ARRAY  = [15, 14, 13, 12, 10, 8]
const ABILITIES       = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const ABILITY_LABEL   = { str:'STR', dex:'DEX', con:'CON', int:'INT', wis:'WIS', cha:'CHA' }
const ABILITY_NAME    = { str:'Strength', dex:'Dexterity', con:'Constitution', int:'Intelligence', wis:'Wisdom', cha:'Charisma' }
// Point-buy cost per score value
const PB_COST = { 8:0, 9:1, 10:2, 11:3, 12:4, 13:5, 14:7, 15:9 }
const COMMON_LANGUAGES = ['Abyssal', 'Celestial', 'Draconic', 'Deep Speech', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin', 'Halfling', 'Infernal', 'Orc', 'Primordial', 'Sylvan', 'Undercommon']
const SKILL_OPTIONS = [
  ['acrobatics', 'Acrobatics'],
  ['animal-handling', 'Animal Handling'],
  ['arcana', 'Arcana'],
  ['athletics', 'Athletics'],
  ['deception', 'Deception'],
  ['history', 'History'],
  ['insight', 'Insight'],
  ['intimidation', 'Intimidation'],
  ['investigation', 'Investigation'],
  ['medicine', 'Medicine'],
  ['nature', 'Nature'],
  ['perception', 'Perception'],
  ['performance', 'Performance'],
  ['persuasion', 'Persuasion'],
  ['religion', 'Religion'],
  ['sleight-of-hand', 'Sleight of Hand'],
  ['stealth', 'Stealth'],
  ['survival', 'Survival'],
].map(([index, name]) => ({ index: `skill-${index}`, name: `Skill: ${name}` }))

function roll4d6dl() {
  const d = [1,2,3,4].map(() => Math.ceil(Math.random() * 6))
  d.sort((a,b) => a - b)
  return d[1] + d[2] + d[3]
}

// ─── Step: Ability Scores ─────────────────────────────────────────────────────

function StepAbilityScores({ raceData, subraceData, raceBonusOptions, onChange, onNext, onBack }) {
  const [method, setMethod] = useState('standard')
  const [assign,  setAssign]  = useState({})          // standard array assignments
  const [pb,      setPb]      = useState({ str:8, dex:8, con:8, int:8, wis:8, cha:8 })
  const [manual,  setManual]  = useState({ str:10, dex:10, con:10, int:10, wis:10, cha:10 })

  // Racial bonuses (including chosen half-elf style options)
  const racialBonus = {}
  for (const b of effectiveRaceAbilityBonuses(raceData, subraceData))
    racialBonus[b.ability_score.index] = (racialBonus[b.ability_score.index] ?? 0) + b.bonus
  for (const b of (subraceData?.ability_bonuses ?? []))
    racialBonus[b.ability_score.index] = (racialBonus[b.ability_score.index] ?? 0) + b.bonus
  for (const b of (raceBonusOptions ?? []))
    racialBonus[b.ability_score.index] = (racialBonus[b.ability_score.index] ?? 0) + b.bonus

  const canNext = method === 'standard'
    ? ABILITIES.every(a => assign[a] != null)
    : method === 'pointbuy'
    ? true
    : ABILITIES.every(a => (manual[a] ?? 0) >= 3 && (manual[a] ?? 0) <= 20)

  const used       = Object.values(assign).filter(Boolean)
  const pbSpent    = ABILITIES.reduce((s, a) => s + (PB_COST[pb[a]] ?? 0), 0)
  const pbLeft     = 27 - pbSpent

  const handleNext = () => {
    const scores = method === 'standard'
      ? Object.fromEntries(ABILITIES.map(a => [a, assign[a] ?? 10]))
      : method === 'pointbuy' ? { ...pb } : { ...manual }
    onChange(scores)
    onNext()
  }

  const tabBtn = (id) => ({
    flex: 1, padding: '0.5rem', borderRadius: '6px', cursor: 'pointer',
    fontWeight: 600, fontSize: '0.82rem', fontFamily: 'var(--font-body)',
    background: method === id ? 'var(--accent)' : 'var(--bg-elevated)',
    color:      method === id ? 'var(--accent-text)'    : 'var(--text-secondary)',
    border:     method === id ? 'none'    : '1px solid var(--border)',
  })

  const pbCanInc = (a) => pb[a] < 15 && pbLeft >= (PB_COST[pb[a]+1] ?? 99) - (PB_COST[pb[a]] ?? 0)
  const pbCanDec = (a) => pb[a] > 8
  const pbAdj    = (a, dir) => {
    const next = pb[a] + dir
    if (next < 8 || next > 15) return
    const costDelta = (PB_COST[next] ?? 0) - (PB_COST[pb[a]] ?? 0)
    if (dir > 0 && costDelta > pbLeft) return
    setPb(p => ({ ...p, [a]: next }))
  }

  return (
    <div style={S.wrap}>
      <div style={S.h1}>Ability Scores</div>
      <div style={S.sub}>Choose how to generate your six ability scores.</div>

      {/* Method tabs */}
      <div style={{ display:'flex', gap:'0.4rem', marginBottom:'1.25rem' }}>
        <button style={tabBtn('standard',  'Standard')}  onClick={() => setMethod('standard')}>Standard Array</button>
        <button style={tabBtn('pointbuy',  'Point Buy')} onClick={() => setMethod('pointbuy')}>Point Buy</button>
        <button style={tabBtn('manual',    'Manual')}    onClick={() => setMethod('manual')}>Manual / Roll</button>
      </div>

      {/* ── Standard Array ── */}
      {method === 'standard' && (
        <>
          <div style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginBottom:'0.75rem' }}>
            Assign each value to one ability. Values: {STANDARD_ARRAY.join(', ')}.
          </div>
          {ABILITIES.map(a => {
            const bonus = racialBonus[a] ?? 0
            const val   = assign[a]
            const final = val != null ? val + bonus : null
            return (
              <div key={a} style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.5rem' }}>
                <span style={{ width:36, fontSize:'0.8rem', color:'var(--text-secondary)', fontWeight:700 }}>{ABILITY_LABEL[a]}</span>
                <select
                  style={{ ...S.input, flex:1, padding:'0.45rem 0.6rem' }}
                  value={val ?? ''}
                  onChange={e => {
                    const v = e.target.value === '' ? null : Number(e.target.value)
                    setAssign(p => ({ ...p, [a]: v }))
                  }}
                >
                  <option value="">— pick —</option>
                  {STANDARD_ARRAY.filter(v => v === val || !used.includes(v)).map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
                <span style={{ width:52, textAlign:'right', fontFamily:'var(--font-mono)', fontSize:'0.95rem', color: final ? 'var(--accent-hover)' : 'var(--text-muted)' }}>
                  {final != null ? `= ${final}` : '—'}
                  {bonus !== 0 && val != null && <span style={{ fontSize:'0.7rem', color:'var(--accent)' }}> (+{bonus})</span>}
                </span>
              </div>
            )
          })}
        </>
      )}

      {/* ── Point Buy ── */}
      {method === 'pointbuy' && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.82rem', color:'var(--text-secondary)', marginBottom:'0.75rem' }}>
            <span>27-point budget. Scores 8–15 before racial bonuses.</span>
            <span style={{ color: pbLeft === 0 ? 'var(--success)' : pbLeft < 0 ? 'var(--danger)' : 'var(--accent-hover)', fontWeight:700 }}>
              {pbLeft} pts left
            </span>
          </div>
          {ABILITIES.map(a => {
            const bonus = racialBonus[a] ?? 0
            const final = pb[a] + bonus
            return (
              <div key={a} style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.45rem' }}>
                <span style={{ width:36, fontSize:'0.8rem', color:'var(--text-secondary)', fontWeight:700 }}>{ABILITY_LABEL[a]}</span>
                <button onClick={() => pbAdj(a,-1)} disabled={!pbCanDec(a)}
                  style={{ width:28, height:28, borderRadius:4, border:'1px solid var(--border-strong)', background:'var(--bg-inset)', color:'var(--text-secondary)', cursor:'pointer', fontSize:'1rem', fontFamily:'var(--font-body)' }}>−</button>
                <span style={{ width:24, textAlign:'center', fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--text-primary)' }}>{pb[a]}</span>
                <button onClick={() => pbAdj(a,+1)} disabled={!pbCanInc(a)}
                  style={{ width:28, height:28, borderRadius:4, border:'1px solid var(--border-strong)', background:'var(--bg-inset)', color:'var(--text-secondary)', cursor:'pointer', fontSize:'1rem', fontFamily:'var(--font-body)' }}>+</button>
                <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', width:32 }}>({PB_COST[pb[a]]}pt)</span>
                <span style={{ marginLeft:'auto', fontFamily:'var(--font-mono)', fontSize:'0.95rem', color:'var(--accent-hover)' }}>
                  {final}{bonus !== 0 && <span style={{ fontSize:'0.7rem', color:'var(--accent)' }}> (+{bonus})</span>}
                </span>
              </div>
            )
          })}
        </>
      )}

      {/* ── Manual / Roll ── */}
      {method === 'manual' && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
            <span style={{ fontSize:'0.8rem', color:'var(--text-secondary)' }}>Enter scores or roll 4d6 drop lowest.</span>
            <button
              style={{ padding:'0.35rem 0.75rem', borderRadius:6, border:'1px solid var(--accent)', background:'transparent', color:'var(--accent-hover)', cursor:'pointer', fontSize:'0.8rem', fontFamily:'var(--font-body)', fontWeight:600 }}
              onClick={() => setManual(Object.fromEntries(ABILITIES.map(a => [a, roll4d6dl()])))}
            >Roll All</button>
          </div>
          {ABILITIES.map(a => {
            const bonus = racialBonus[a] ?? 0
            const val   = manual[a] ?? 10
            return (
              <div key={a} style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.45rem' }}>
                <span style={{ width:36, fontSize:'0.8rem', color:'var(--text-secondary)', fontWeight:700 }}>{ABILITY_LABEL[a]}</span>
                <span style={{ width:80, fontSize:'0.75rem', color:'var(--text-muted)' }}>{ABILITY_NAME[a]}</span>
                <input
                  type="number" min="3" max="20"
                  style={{ ...S.input, width:70, padding:'0.4rem 0.5rem', textAlign:'center', fontFamily:'var(--font-mono)' }}
                  value={val}
                  onChange={e => setManual(p => ({ ...p, [a]: Math.max(1, Math.min(20, Number(e.target.value))) }))}
                />
                <button
                  style={{ padding:'0.3rem 0.6rem', borderRadius:4, border:'1px solid var(--border-strong)', background:'var(--bg-inset)', color:'var(--text-secondary)', cursor:'pointer', fontSize:'0.75rem', fontFamily:'var(--font-body)' }}
                  onClick={() => setManual(p => ({ ...p, [a]: roll4d6dl() }))}
                >Roll</button>
                <span style={{ marginLeft:'auto', fontFamily:'var(--font-mono)', fontSize:'0.95rem', color:'var(--accent-hover)' }}>
                  {val + bonus}{bonus !== 0 && <span style={{ fontSize:'0.7rem', color:'var(--accent)' }}> (+{bonus})</span>}
                </span>
              </div>
            )
          })}
        </>
      )}

      <div style={S.row}>
        <button style={S.btn(false)} onClick={onBack}>← Back</button>
        <button style={S.btn(true)} onClick={handleNext} disabled={!canNext}>Next: Background →</button>
      </div>
    </div>
  )
}

// ─── Step 1: Name ─────────────────────────────────────────────────────────────

function StepName({ value, onChange, onNext, onCancel, cancelLabel = 'Cancel' }) {
  return (
    <div style={S.wrap}>
      <div style={S.h1}>New Character</div>
      <div style={S.sub}>Let's start with a name.</div>
      <label style={S.label}>Character Name *</label>
      <input
        style={S.input}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="e.g. Aria Thornwood"
        autoFocus
      />
      <div style={S.row}>
        <button style={S.btn(false)} onClick={onCancel}>{cancelLabel}</button>
        <button style={S.btn(true)} onClick={onNext} disabled={!value.trim()}>Next: Race →</button>
      </div>
    </div>
  )
}

// ─── Step 2: Race ─────────────────────────────────────────────────────────────

function StepRace({ races, selected, loading, onSelect, onNext, onBack }) {
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState(ALL_SOURCES)
  const availableSources = sourceOptions(races)
  const filtered = filterBySearchAndSource(races, search, sourceFilter, raceSearchText)
  const selectedIsAvailable = !!selected && races.some(race => race.index === selected.index)

  useEffect(() => {
    if (sourceFilter !== ALL_SOURCES && !availableSources.includes(sourceFilter)) {
      setSourceFilter(ALL_SOURCES)
    }
  }, [availableSources, sourceFilter])

  return (
    <div style={S.wrap}>
      <div style={S.h1}>Choose a Race</div>
      <div style={S.sub}>Your race shapes your innate abilities and traits.</div>
      <SearchInput
        placeholder="Search races..."
        value={search}
        onChange={setSearch}
        items={races}
        sourceFilter={sourceFilter}
        onSourceFilter={setSourceFilter}
      />
      <div style={S.scrollList}>
        {loading && races.length === 0 && (
          <div style={S.emptyState}>Loading races...</div>
        )}
        {!loading && races.length === 0 && (
          <div style={S.emptyState}>Race content could not be loaded. Try switching rules editions and back again.</div>
        )}
        {races.length > 0 && filtered.length === 0 && (
          <div style={S.emptyState}>
            No races match {search ? `"${search}"` : sourceFilter === ALL_SOURCES ? 'that filter' : sourceFilter}.
          </div>
        )}
        {filtered.map(r => (
          <div key={r.index} style={S.card(selected?.index === r.index)} onClick={() => onSelect(r)}>
            <div style={S.cardTop}>
              <div style={S.cardName}>{r.name}</div>
              <SourceBadge item={r} />
            </div>
            <div style={S.cardSub}>
              Speed {r.speed}ft · {r.size}
              {r.ability_bonuses?.map(b => ` · +${b.bonus} ${b.ability_score.name}`).join('')}
              {r.subraces?.length > 0 && ` · ${r.subraces.length} subrace${r.subraces.length > 1 ? 's' : ''}`}
            </div>
          </div>
        ))}
      </div>
      <div style={S.row}>
        <button style={S.btn(false)} onClick={onBack}>← Back</button>
        <button style={S.btn(true)} onClick={onNext} disabled={!selectedIsAvailable}>
          Next: {selected?.subraces?.length > 0 ? 'Subrace' : 'Class'} →
        </button>
      </div>
    </div>
  )
}

// ─── Step 3: Subrace ──────────────────────────────────────────────────────────

function StepSubrace({ race, subraces, selected, onSelect, bonusOptions, onBonusOptions, selectedFeat, onFeatChange, selectedFeatAbility, onFeatAbilityChange, baseAbilityScores, onNext, onBack }) {
  const [sourceFilter, setSourceFilter] = useState(ALL_SOURCES)
  const [featSearch, setFeatSearch] = useState('')
  // Filter subraces for this race
  const allAvailable = subraces.filter(s => s.race?.index === race.index)
  const effectiveSource = effectiveSourceFilter(allAvailable, sourceFilter)
  const available = allAvailable.filter(s => effectiveSource === ALL_SOURCES || sourceCode(s) === effectiveSource)

  // Half-Elf and Variant Human style: ability_bonus_options can live on race or subrace.
  const abilityChoices = effectiveAbilityChoices(race, selected)
  const hasBonusOptions = abilityChoices.length > 0
  const bonusCount = abilityChoices.reduce((sum, choice) => sum + (choice.choose ?? 0), 0)
  const bonusPool = abilityChoices
    .flatMap(choice => choice.from?.options ?? [])
    .filter((option, index, options) =>
      options.findIndex(other => other.ability_score.index === option.ability_score.index) === index
    )
  const grantsFeat = isVariantHuman(race, selected)

  const toggleBonus = (opt) => {
    const key = opt.ability_score.index
    const already = bonusOptions.find(b => b.ability_score.index === key)
    if (already) {
      onBonusOptions(bonusOptions.filter(b => b.ability_score.index !== key))
    } else if (bonusOptions.length < bonusCount) {
      onBonusOptions([...bonusOptions, opt])
    }
  }

  const canProceed = available.length === 0 || selected
  const bonusReady = !hasBonusOptions || bonusOptions.length === bonusCount
  const selectedFeatRule = featRule(selectedFeat)
  const selectedFeatAbilityOptions = (selectedFeatRule.abilityOptions ?? [])
    .filter(ability => abilityScoreWithCreationBonuses(baseAbilityScores, ability, race, selected, bonusOptions) < 20)
  const featNeedsAbility = (selectedFeatRule.abilityOptions ?? []).length > 0
  const featReady = !grantsFeat || (!!selectedFeat && (!featNeedsAbility || (selectedFeatAbilityOptions.length > 0 && !!selectedFeatAbility)))
  const missing = [
    !canProceed ? 'subrace' : null,
    !bonusReady ? `${bonusCount - bonusOptions.length} ability bonus${bonusCount - bonusOptions.length === 1 ? '' : 'es'}` : null,
    !featReady ? 'feat' : null,
  ].filter(Boolean)
  const nextLabel = missing.length ? `Choose ${missing.join(' + ')}` : 'Next: Class →'
  const filteredFeats = FEATS.filter(feat =>
    `${feat.name} ${feat.desc} ${feat.prereq ?? ''}`.toLowerCase().includes(featSearch.trim().toLowerCase())
  )

  return (
    <div style={S.wrap}>
      <div style={S.h1}>Subrace & Racial Options</div>
      <div style={S.sub}>{race.name} has additional choices.</div>

      {available.length > 0 && (
        <>
          <label style={S.label}>Choose a Subrace</label>
          <SourceFilter items={allAvailable} value={sourceFilter} onChange={setSourceFilter} />
          {available.map(s => (
            <div key={s.index} style={S.card(selected?.index === s.index)} onClick={() => onSelect(s)}>
              <div style={S.cardTop}>
                <div style={S.cardName}>{s.name}</div>
                <SourceBadge item={s} />
              </div>
              <div style={S.cardSub}>
                {s.isBaseRaceOption
                  ? `Use the original ${s.source ?? race.source} ${race.name} without a later subrace.`
                  : [
                    ...(s.ability_bonuses?.map(b => `+${b.bonus} ${b.ability_score.name}`) ?? []),
                    s.ability_bonus_options ? `choose ${s.ability_bonus_options.choose} ability bonus${s.ability_bonus_options.choose > 1 ? 'es' : ''}` : null,
                  ].filter(Boolean).join(' · ')}
                {s.abilityOverridesRace && ' · replaces base race ability bonuses'}
              </div>
            </div>
          ))}
        </>
      )}

      {hasBonusOptions && (
        <>
          <label style={S.label}>Choose {bonusCount} Ability Score Bonus{bonusCount > 1 ? 'es' : ''} (+1 each)</label>
          <div style={S.cardSub}>Selected: {bonusOptions.length} / {bonusCount}</div>
          {bonusPool.map((opt, i) => {
            const key = opt.ability_score.index
            const checked = !!bonusOptions.find(b => b.ability_score.index === key)
            return (
              <div key={i} style={{ ...S.checkRow, border: checked ? '1px solid var(--accent)' : '1px solid var(--border)' }} onClick={() => toggleBonus(opt)}>
                <span style={{ color: checked ? 'var(--accent-hover)' : 'var(--text-muted)', fontSize: '1.1rem' }}>{checked ? '◉' : '○'}</span>
                <span>+{opt.bonus} {opt.ability_score.name}</span>
              </div>
            )
          })}
        </>
      )}

      {grantsFeat && (
        <>
          <label style={S.label}>Choose a Level 1 Feat</label>
          <div style={S.cardSub}>
            Variant Human grants one feat at character creation.
            {selectedFeat && ` Selected: ${selectedFeat.name}.`}
          </div>
          <input
            style={{ ...S.input, marginBottom: '0.5rem' }}
            value={featSearch}
            onChange={e => setFeatSearch(e.target.value)}
            placeholder="Search feats..."
          />
          <div style={{ maxHeight: 280, overflowY: 'auto', paddingRight: 4, marginBottom: '0.75rem' }}>
            {filteredFeats.map(feat => {
              const selectedFeatName = selectedFeat?.name === feat.name
              const prereqStatus = creationFeatPrereqStatus(feat, baseAbilityScores, race, selected, bonusOptions)
              const needsSetup = featNeedsCreationSetup(feat)
              const disabled = needsSetup || !prereqStatus.ok
              return (
                <div
                  key={feat.name}
                  style={{ ...S.card(selectedFeatName), ...(disabled && { opacity: 0.55, cursor: 'not-allowed' }) }}
                  onClick={() => !disabled && onFeatChange(feat)}
                >
                  <div style={S.cardTop}>
                    <div style={S.cardName}>{feat.name}</div>
                    {feat.prereq && <span style={S.sourceBadge}>{feat.prereq}</span>}
                  </div>
                  <div style={S.cardSub}>{feat.desc}</div>
                  {disabled && (
                    <div style={{ ...S.cardSub, color: 'var(--warning)', marginTop: 4 }}>
                      {needsSetup ? 'Needs a detailed feat setup step after character creation.' : prereqStatus.reason}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {selectedFeat && featNeedsAbility && (
            <>
              <label style={S.label}>Choose Feat Ability Increase</label>
              <div style={S.cardSub}>{selectedFeat.name} increases one ability score by 1.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {selectedFeatAbilityOptions.map(ability => (
                  <div
                    key={ability}
                    style={{ ...S.card(selectedFeatAbility === ability), textAlign: 'center', padding: '0.6rem' }}
                    onClick={() => onFeatAbilityChange(ability)}
                  >
                    <div style={{ fontSize: '0.85rem', fontWeight: selectedFeatAbility === ability ? 700 : 400 }}>{ability.toUpperCase()}</div>
                  </div>
                ))}
                {selectedFeatAbilityOptions.length === 0 && (
                  <div style={{ ...S.cardSub, gridColumn: '1 / -1', color: 'var(--warning)' }}>
                    All eligible ability scores are already 20.
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      <div style={S.row}>
        <button style={S.btn(false)} onClick={onBack}>← Back</button>
        <button style={S.btn(true)} onClick={onNext} disabled={!canProceed || !bonusReady || !featReady}>{nextLabel}</button>
      </div>
    </div>
  )
}

// ─── Step: Racial Options ────────────────────────────────────────────────────

function racialOptionGroups(raceData, subraceData) {
  const groups = new Map()
  for (const group of (raceData?.racial_options ?? [])) groups.set(group.id, group)
  for (const group of (subraceData?.racial_options ?? [])) groups.set(group.id, group)
  return [...groups.values()]
}

function combineChoiceGroups(raceData, subraceData, key) {
  return [...(raceData?.[key] ?? []), ...(subraceData?.[key] ?? [])]
}

function racialChoiceCount(groups) {
  return groups.reduce((sum, group) => sum + (group.choose ?? 0), 0)
}

function hasRacialSetupOptions(raceData, subraceData) {
  return racialOptionGroups(raceData, subraceData).length > 0
    || racialChoiceCount(combineChoiceGroups(raceData, subraceData, 'racial_language_options')) > 0
    || racialChoiceCount(combineChoiceGroups(raceData, subraceData, 'racial_skill_options')) > 0
    || racialChoiceCount(combineChoiceGroups(raceData, subraceData, 'racial_tool_options')) > 0
}

function StepRacialOptions({ raceData, subraceData, selectedOptions, onOptionsChange, onNext, onBack }) {
  const groups = racialOptionGroups(raceData, subraceData)
  const languageGroups = combineChoiceGroups(raceData, subraceData, 'racial_language_options')
  const skillGroups = combineChoiceGroups(raceData, subraceData, 'racial_skill_options')
  const toolGroups = combineChoiceGroups(raceData, subraceData, 'racial_tool_options')
  const languageCount = racialChoiceCount(languageGroups)
  const skillCount = racialChoiceCount(skillGroups)
  const toolCount = racialChoiceCount(toolGroups)
  const selectedLanguages = selectedOptions.racialLanguages ?? []
  const selectedSkills = selectedOptions.racialSkills ?? []
  const selectedTools = selectedOptions.racialTools ?? []
  const knownLanguages = new Set([
    ...(raceData?.languages ?? []).map(l => l.name),
    ...(subraceData?.languages ?? []).map(l => l.name),
  ])
  const languagePool = [
    ...COMMON_LANGUAGES.filter(name => !knownLanguages.has(name)).map(name => ({ index: name.toLowerCase().replace(/\s+/g, '-'), name })),
    ...languageGroups.flatMap(group => group.options ?? []),
  ].filter((language, index, options) => options.findIndex(other => other.name === language.name) === index)
  const skillPool = (skillGroups.some(group => !group.options) ? SKILL_OPTIONS : skillGroups.flatMap(group => group.options ?? []))
    .filter((skill, index, options) => options.findIndex(other => other.index === skill.index) === index)
  const toolPool = toolGroups.flatMap(group => group.options ?? [])
    .filter((tool, index, options) => options.findIndex(other => other.index === tool.index) === index)
  const ready = groups.every(group => !!selectedOptions[group.id])
    && selectedLanguages.length >= languageCount
    && selectedSkills.length >= skillCount
    && selectedTools.length >= toolCount

  const chooseOption = (group, option) => {
    onOptionsChange({ ...selectedOptions, [group.id]: option })
  }
  const toggleListOption = (key, current, option, max) => {
    const optionKey = typeof option === 'string' ? option : option.index ?? option.name
    const checked = current.some(item => (typeof item === 'string' ? item : item.index ?? item.name) === optionKey)
    const next = checked
      ? current.filter(item => (typeof item === 'string' ? item : item.index ?? item.name) !== optionKey)
      : current.length < max
      ? [...current, option]
      : current
    onOptionsChange({ ...selectedOptions, [key]: next })
  }

  return (
    <div style={S.wrap}>
      <div style={S.h1}>Racial Options</div>
      <div style={S.sub}>Choose ancestry options that affect your traits in play.</div>

      {groups.map(group => (
        <div key={group.id}>
          <label style={S.label}>{group.name}</label>
          <div style={S.cardSub}>{group.desc}</div>
          {group.options.map(option => {
            const selected = selectedOptions[group.id]?.id === option.id
            return (
              <div key={option.id} style={S.card(selected)} onClick={() => chooseOption(group, option)}>
                <div style={S.cardTop}>
                  <div style={S.cardName}>{option.name}</div>
                  {option.damageType && <span style={S.sourceBadge}>{option.damageType}</span>}
                </div>
                <div style={S.cardSub}>
                  {option.breathWeapon}
                  {option.savingThrow && ` · ${option.savingThrow} save`}
                </div>
              </div>
            )
          })}
        </div>
      ))}

      {languageCount > 0 && (
        <div>
          <label style={S.label}>Choose {languageCount} Racial Language{languageCount === 1 ? '' : 's'}</label>
          <div style={S.cardSub}>{selectedLanguages.length} / {languageCount} selected</div>
          {languagePool.map(language => {
            const checked = selectedLanguages.includes(language.name)
            const disabled = !checked && selectedLanguages.length >= languageCount
            return (
              <div
                key={language.name}
                style={{ ...S.checkRow, opacity: disabled ? 0.4 : 1, border: checked ? '1px solid var(--accent)' : '1px solid var(--border)' }}
                onClick={() => !disabled && toggleListOption('racialLanguages', selectedLanguages, language.name, languageCount)}
              >
                <span style={{ color: checked ? 'var(--accent-hover)' : 'var(--text-muted)', fontSize: '1.1rem' }}>{checked ? '◉' : '○'}</span>
                <span>{language.name}</span>
              </div>
            )
          })}
        </div>
      )}

      {skillCount > 0 && (
        <div>
          <label style={S.label}>Choose {skillCount} Racial Skill{skillCount === 1 ? '' : 's'}</label>
          <div style={S.cardSub}>{selectedSkills.length} / {skillCount} selected</div>
          {skillPool.map(skill => {
            const checked = selectedSkills.includes(skill.index)
            const disabled = !checked && selectedSkills.length >= skillCount
            return (
              <div
                key={skill.index}
                style={{ ...S.checkRow, opacity: disabled ? 0.4 : 1, border: checked ? '1px solid var(--accent)' : '1px solid var(--border)' }}
                onClick={() => !disabled && toggleListOption('racialSkills', selectedSkills, skill.index, skillCount)}
              >
                <span style={{ color: checked ? 'var(--accent-hover)' : 'var(--text-muted)', fontSize: '1.1rem' }}>{checked ? '◉' : '○'}</span>
                <span>{skill.name.replace('Skill: ', '')}</span>
              </div>
            )
          })}
        </div>
      )}

      {toolCount > 0 && (
        <div>
          <label style={S.label}>Choose {toolCount} Racial Tool Proficiency{toolCount === 1 ? '' : 'ies'}</label>
          <div style={S.cardSub}>{selectedTools.length} / {toolCount} selected</div>
          {toolPool.map(tool => {
            const checked = selectedTools.some(item => item.index === tool.index)
            const disabled = !checked && selectedTools.length >= toolCount
            return (
              <div
                key={tool.index}
                style={{ ...S.checkRow, opacity: disabled ? 0.4 : 1, border: checked ? '1px solid var(--accent)' : '1px solid var(--border)' }}
                onClick={() => !disabled && toggleListOption('racialTools', selectedTools, tool, toolCount)}
              >
                <span style={{ color: checked ? 'var(--accent-hover)' : 'var(--text-muted)', fontSize: '1.1rem' }}>{checked ? '◉' : '○'}</span>
                <span>{tool.name}</span>
              </div>
            )
          })}
        </div>
      )}

      <div style={S.row}>
        <button style={S.btn(false)} onClick={onBack}>← Back</button>
        <button style={S.btn(true)} onClick={onNext} disabled={!ready}>Next: Class →</button>
      </div>
    </div>
  )
}

// ─── Step: Starting Spells ────────────────────────────────────────────────────

function SpellPicker({ label, spells, selected, max, onToggle }) {
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState(ALL_SOURCES)
  const filtered = filterBySearchAndSource(spells, search, sourceFilter).slice(0, 80)
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
        <label style={S.label}>{label}</label>
        <span style={{ fontSize:'0.75rem', color: selected.length === max ? 'var(--success)' : 'var(--text-secondary)' }}>
          {selected.length} / {max}
        </span>
      </div>
      <SearchInput
        placeholder="Search..."
        value={search}
        onChange={setSearch}
        items={spells}
        sourceFilter={sourceFilter}
        onSourceFilter={setSourceFilter}
      />
      <div style={{ maxHeight: 200, overflowY:'auto', border:'1px solid var(--border)', borderRadius:6 }}>
        {filtered.map(sp => {
          const sel = selected.some(s => s.index === sp.index)
          const disabled = !sel && selected.length >= max
          return (
            <div key={sp.index}
              style={{ display:'flex', alignItems:'center', gap:'0.6rem', padding:'0.45rem 0.75rem',
                background: sel ? 'var(--accent-subtle)' : 'transparent',
                borderBottom:'1px solid var(--bg-elevated)', cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.4 : 1 }}
              onClick={() => !disabled && onToggle(sp)}
            >
              <span style={{ color: sel ? 'var(--accent-hover)' : 'var(--text-muted)', fontSize:'1rem', lineHeight:1 }}>{sel ? '◉' : '○'}</span>
              <span style={{ fontSize:'0.87rem', fontWeight: sel ? 600 : 400, color: sel ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{sp.name}</span>
              <SourceBadge item={sp} />
              {sp.level === 0 && <span style={{ fontSize:'0.7rem', color:'var(--accent)', marginLeft:'auto' }}>cantrip</span>}
              {sp.level > 0  && <span style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginLeft:'auto' }}>Lv {sp.level}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const PREPARED_SPELLCASTERS_L1 = new Set(['cleric', 'druid'])

function abilityScoreWithCreationBonuses(baseAbilityScores, ability, raceData, subraceData, raceBonusOptions) {
  let score = baseAbilityScores?.[ability] ?? 10
  for (const bonus of effectiveRaceAbilityBonuses(raceData, subraceData)) {
    if (bonus.ability_score.index === ability) score += bonus.bonus
  }
  for (const bonus of (subraceData?.ability_bonuses ?? [])) {
    if (bonus.ability_score.index === ability) score += bonus.bonus
  }
  for (const bonus of (raceBonusOptions ?? [])) {
    if (bonus.ability_score.index === ability) score += bonus.bonus
  }
  return score
}

function spellChoiceCountAtCreation(classIdx, abilityScores, raceData, subraceData, raceBonusOptions) {
  if (!PREPARED_SPELLCASTERS_L1.has(classIdx)) return SPELLS_KNOWN_L1[classIdx] ?? 0
  const ability = SPELLCASTING_ABILITY[classIdx]
  const score = abilityScoreWithCreationBonuses(abilityScores, ability, raceData, subraceData, raceBonusOptions)
  const mod = Math.floor((score - 10) / 2)
  return Math.max(1, 1 + mod)
}

function spellChoiceLabel(classIdx, spellMax) {
  if (PREPARED_SPELLCASTERS_L1.has(classIdx)) return `Prepared 1st-Level Spells (choose ${spellMax})`
  if (classIdx === 'wizard') return `Spellbook 1st-Level Spells (choose ${spellMax})`
  return `1st-Level Spells (choose ${spellMax})`
}

function StepSpells({ classData, subclassChoice, abilityScores, raceData, subraceData, raceBonusOptions, selectedCantrips, onCantrips, selectedBonusCantrips, onBonusCantrips, selectedSpells, onSpells, onNext, onBack }) {
  const [allSpells, setAllSpells] = useState([])
  const classIdx   = classData?.index ?? ''
  const cantripMax = CANTRIPS_KNOWN[classIdx] ?? 0
  const spellMax   = spellChoiceCountAtCreation(classIdx, abilityScores, raceData, subraceData, raceBonusOptions)
  const needsNatureCantrip = classIdx === 'cleric' && /^nature$/i.test(subclassChoice ?? '')
  const subclassData = selectedSubclassData(classData, subclassChoice)

  useEffect(() => {
    getSpells().then(all => setAllSpells(all)).catch(() => {})
  }, [])

  const expandedSpellIndexes = new Set(expandedSpellIndexesForLevel(subclassData, 1))
  const classSpells = allSpells.filter(s => s.classes?.some(c => c.index === classIdx) || expandedSpellIndexes.has(s.index))
  const cantrips      = classSpells.filter(s => s.level === 0)
  const druidCantrips = allSpells.filter(s => s.level === 0 && s.classes?.some(c => c.index === 'druid'))
  const leveledSpells = classSpells.filter(s => s.level === 1) // level 1 only at creation

  const toggleCantrip = (sp) => {
    if (selectedCantrips.some(s => s.index === sp.index))
      onCantrips(selectedCantrips.filter(s => s.index !== sp.index))
    else if (selectedCantrips.length < cantripMax)
      onCantrips([...selectedCantrips, {
        id: sp.index,
        index: sp.index,
        name: sp.name,
        source: sp.source,
        level: 0,
        classIndex: classIdx,
        castingAbility: SPELLCASTING_ABILITY[classIdx] ?? null,
      }])
  }
  const toggleSpell = (sp) => {
    if (selectedSpells.some(s => s.index === sp.index))
      onSpells(selectedSpells.filter(s => s.index !== sp.index))
    else if (selectedSpells.length < spellMax)
      onSpells([...selectedSpells, {
        id: sp.index,
        index: sp.index,
        name: sp.name,
        source: sp.source,
        level: sp.level,
        classIndex: classIdx,
        castingAbility: SPELLCASTING_ABILITY[classIdx] ?? null,
        ...(expandedSpellIndexes.has(sp.index) && { origin: `${subclassData?.name ?? subclassChoice} Expanded Spells` }),
      }])
  }
  const toggleBonusCantrip = (sp) => {
    if (selectedBonusCantrips.some(s => s.index === sp.index)) {
      onBonusCantrips(selectedBonusCantrips.filter(s => s.index !== sp.index))
    } else if (selectedBonusCantrips.length < 1) {
      onBonusCantrips([...selectedBonusCantrips, {
        id: sp.index,
        index: sp.index,
        name: sp.name,
        source: sp.source,
        level: 0,
        classIndex: 'druid',
        castingAbility: SPELLCASTING_ABILITY.cleric,
        origin: 'Acolyte of Nature',
      }])
    }
  }

  const cantripDone = cantripMax === 0 || selectedCantrips.length === cantripMax
  const bonusCantripDone = !needsNatureCantrip || selectedBonusCantrips.length === 1
  const spellDone   = spellMax   === 0 || selectedSpells.length   === spellMax

  return (
    <div style={S.wrap}>
      <div style={S.h1}>Starting Spells — {classData?.name}</div>
      <div style={S.sub}>
        {PREPARED_SPELLCASTERS_L1.has(classIdx)
          ? `Choose cantrips and prepare ${spellMax} 1st-level spell${spellMax === 1 ? '' : 's'} based on your level and ${SPELLCASTING_ABILITY[classIdx]?.toUpperCase()}.`
          : 'Choose your starting cantrips and spells.'}
      </div>

      {allSpells.length === 0 && <div style={{ color:'var(--text-secondary)', fontSize:'0.85rem' }}>Loading spells…</div>}

      {cantripMax > 0 && (
        <SpellPicker
          label={`Cantrips (choose ${cantripMax})`}
          spells={cantrips}
          selected={selectedCantrips}
          max={cantripMax}
          onToggle={toggleCantrip}
        />
      )}

      {spellMax > 0 && (
        <SpellPicker
          label={spellChoiceLabel(classIdx, spellMax)}
          spells={leveledSpells}
          selected={selectedSpells}
          max={spellMax}
          onToggle={toggleSpell}
        />
      )}

      {needsNatureCantrip && (
        <SpellPicker
          label="Acolyte of Nature Druid Cantrip (choose 1)"
          spells={druidCantrips}
          selected={selectedBonusCantrips}
          max={1}
          onToggle={toggleBonusCantrip}
        />
      )}

      <div style={S.row}>
        <button style={S.btn(false)} onClick={onBack}>← Back</button>
        <button style={S.btn(true)} onClick={onNext} disabled={!cantripDone || !bonusCantripDone || !spellDone}>
          Next: Background →
        </button>
      </div>
    </div>
  )
}

// ─── Step: Subclass (for classes that choose at level 1) ─────────────────────

function StepSubclass({ classData, selected, onSelect, onNext, onBack }) {
  const options = classData?.subclasses?.length
    ? classData.subclasses
    : (SUBCLASSES[classData?.index] ?? []).map(name => ({ name, source: 'manual' }))
  return (
    <div style={S.wrap}>
      <div style={S.h1}>Choose Your {classData?.name} Subclass</div>
      <div style={S.sub}>
        {classData?.name}s choose their path at level 1. This choice is permanent.
      </div>
      <div style={S.scrollList}>
        {options.map(option => (
          <div
            key={`${option.name}:${option.source ?? ''}`}
            style={S.card(selected === option.name)}
            onClick={() => onSelect(option.name)}
          >
            <div style={S.cardTop}>
              <div style={S.cardName}>{option.name}</div>
              {option.source && <SourceBadge item={option} />}
            </div>
          </div>
        ))}
      </div>
      <div style={S.row}>
        <button style={S.btn(false)} onClick={onBack}>← Back</button>
        <button style={S.btn(true)} onClick={onNext} disabled={!selected}>Next: Class Setup →</button>
      </div>
    </div>
  )
}

// ─── Step 4: Class ────────────────────────────────────────────────────────────

function StepClass({ classes, selected, onSelect, onNext, onBack }) {
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState(ALL_SOURCES)
  const filtered = filterBySearchAndSource(classes, search, sourceFilter)

  return (
    <div style={S.wrap}>
      <div style={S.h1}>Choose a Class</div>
      <div style={S.sub}>Your class defines your combat role and abilities.</div>
      <SearchInput
        placeholder="Search classes..."
        value={search}
        onChange={setSearch}
        items={classes}
        sourceFilter={sourceFilter}
        onSourceFilter={setSourceFilter}
      />
      <div style={S.scrollList}>
        {filtered.map(c => (
          <div key={c.index} style={S.card(selected?.index === c.index)} onClick={() => onSelect(c)}>
            <div style={S.cardTop}>
              <div style={S.cardName}>{c.name}</div>
              <SourceBadge item={c} />
            </div>
            <div style={S.cardSub}>
              d{c.hit_die} hit die
              {c.saving_throws?.length > 0 && ` · Saves: ${c.saving_throws.map(s => s.name).join(', ')}`}
              {SPELLCASTING_ABILITY[c.index] && ` · Spellcaster (${SPELLCASTING_ABILITY[c.index].toUpperCase()})`}
            </div>
          </div>
        ))}
      </div>
      <div style={S.row}>
        <button style={S.btn(false)} onClick={onBack}>← Back</button>
        <button style={S.btn(true)} onClick={onNext} disabled={!selected}>Next: Class Setup →</button>
      </div>
    </div>
  )
}

// ─── Step 5: Class setup (skills + equipment choices) ─────────────────────────

// Weapon category index → { weapon_category, weapon_range? }
const WEAPON_CATEGORY_MAP = {
  'simple-weapons':         { weapon_category: 'Simple' },
  'martial-weapons':        { weapon_category: 'Martial' },
  'simple-melee-weapons':   { weapon_category: 'Simple',  weapon_range: 'Melee' },
  'simple-ranged-weapons':  { weapon_category: 'Simple',  weapon_range: 'Ranged' },
  'martial-melee-weapons':  { weapon_category: 'Martial', weapon_range: 'Melee' },
  'martial-ranged-weapons': { weapon_category: 'Martial', weapon_range: 'Ranged' },
}

const EQUIPMENT_TYPE_MAP = {
  'musical-instruments': { equipment_category_index: 'instrument' },
  'arcane-focuses': { equipment_category_index: 'spellcasting-focus', scfType: 'arcane' },
  'druidic-focuses': { equipment_category_index: 'spellcasting-focus', scfType: 'druid' },
  'holy-symbols': { equipment_category_index: 'spellcasting-focus', scfType: 'holy' },
}

async function fetchCategoryItems(categoryIndex) {
  try {
    const all = await getEquipment()

    // Try direct equipment_category.index match first
    let items = all.filter(item => item.equipment_category?.index === categoryIndex)

    // Fallback: weapon_category / weapon_range matching (SRD stores weapons this way)
    if (items.length === 0) {
      const wc = WEAPON_CATEGORY_MAP[categoryIndex]
      if (wc) {
        items = all.filter(item =>
          item.weapon_category === wc.weapon_category &&
          (!wc.weapon_range || item.weapon_range === wc.weapon_range)
        )
      }
    }
    if (items.length === 0) {
      const eq = EQUIPMENT_TYPE_MAP[categoryIndex]
      if (eq) {
        items = all.filter(item =>
          Object.entries(eq).every(([key, value]) => item[key] === value)
        )
      }
    }

    return items.map(item => ({ index: item.index, name: item.name, source: item.source, quantity: 1 }))
  } catch { return [] }
}

function classFeatureChoiceGroups(classData, subclassChoice) {
  const subclassData = selectedSubclassData(classData, subclassChoice)
  const sourceFeatures = [
    ...Object.values(classData?.features_by_level ?? {}).flat(),
    ...Object.values(subclassData?.features_by_level ?? {}).flat(),
  ]
  const choices = sourceFeatures
    .flat()
    .filter(feature => (feature.level ?? 1) <= 1)
    .flatMap(feature => (feature.choices ?? []).map(choice => ({
      ...choice,
      choiceKey: `${feature.index}:${choice.choiceIndex ?? 0}`,
      feature: {
        index: feature.index,
        name: feature.name,
        className: classData?.name,
        classIndex: classData?.index,
        subclassName: subclassData?.name,
        level: feature.level ?? 1,
      },
    })))
  const merged = new Map()
  for (const choice of choices) {
    const optionTypes = [...new Set((choice.options ?? []).flatMap(option => option.featureType ?? []))].sort()
    const key = optionTypes.length
      ? `${choice.feature?.classIndex ?? ''}:${choice.feature?.level ?? ''}:${optionTypes.join('|')}`
      : choice.choiceKey
    const previous = merged.get(key)
    if (!previous) {
      merged.set(key, choice)
      continue
    }
    const optionMap = new Map((previous.options ?? []).map(option => [option.id ?? option.name, option]))
    for (const option of choice.options ?? []) optionMap.set(option.id ?? option.name, option)
    merged.set(key, {
      ...previous,
      choose: Math.max(previous.choose ?? 1, choice.choose ?? 1),
      options: [...optionMap.values()],
    })
  }
  return [...merged.values()]
}

function StepClassSetup({ classData, subclassChoice, selectedSkills, onSkillsChange, selectedTools = [], onToolsChange, selectedEquipment, onEquipmentChange, selectedFeatureChoices, onFeatureChoicesChange, onNext, onBack }) {
  const [categoryItems, setCategoryItems] = useState({}) // { choiceId: [items] }
  const [categorySourceFilters, setCategorySourceFilters] = useState({})
  const [expandedChoice, setExpandedChoice] = useState(null) // choiceId being expanded
  const [maneuverOptions, setManeuverOptions] = useState([])

  const profChoices = classData.proficiency_choices?.filter(pc => pc.type === 'proficiencies') ?? []
  const equipOptions = classData.starting_equipment_options ?? []
  const featureChoiceGroups = classFeatureChoiceGroups(classData, subclassChoice)
  const toolGroups = (classData.class_tool_options ?? []).map((group, groupIndex) => ({ ...group, groupIndex }))
  const superiorTechniqueChoiceKey = `${classData.index}:superior-technique-maneuver`
  const superiorTechniqueSelected = selectedFeatureChoices.some(choice =>
    (choice.options ?? []).some(option => option.name === 'Superior Technique')
  )
  const superiorTechniqueChoice = selectedFeatureChoices.find(choice => choice.choiceKey === superiorTechniqueChoiceKey)
  const superiorTechniqueManeuver = superiorTechniqueChoice?.options?.[0] ?? null

  useEffect(() => {
    getOptionalFeatures()
      .then(features => setManeuverOptions(features
        .filter(feature => (feature.featureType ?? []).includes('MV:B'))
        .filter((feature, index, list) => list.findIndex(other => other.name === feature.name && other.source === feature.source) === index)
      ))
      .catch(() => setManeuverOptions([]))
  }, [])

  // Collect all skill choices across all proficiency_choices groups
  const allSkillGroups = profChoices.map((pc, gi) => ({
    choose: pc.choose,
    desc: pc.desc,
    options: pc.from?.options?.filter(o => o.item?.index?.startsWith('skill-')) ?? [],
    groupIndex: gi,
  })).filter(g => g.options.length > 0)

  const toggleSkill = (groupIndex, skillIndex) => {
    const group = allSkillGroups[groupIndex]
    const groupSelected = selectedSkills.filter(s => group.options.some(o => o.item.index === s))
    if (groupSelected.includes(skillIndex)) {
      onSkillsChange(selectedSkills.filter(s => s !== skillIndex))
    } else if (groupSelected.length < group.choose) {
      onSkillsChange([...selectedSkills, skillIndex])
    }
  }
  const toggleTool = (group, tool) => {
    const selectedForGroup = selectedTools.filter(item => item.groupIndex === group.groupIndex)
    const checked = selectedForGroup.some(item => item.index === tool.index)
    if (checked) {
      onToolsChange(selectedTools.filter(item => !(item.groupIndex === group.groupIndex && item.index === tool.index)))
    } else if (selectedForGroup.length < (group.choose ?? 1)) {
      onToolsChange([...selectedTools, { ...tool, groupIndex: group.groupIndex }])
    }
  }

  // Parse a single equipment option into a selectable card descriptor
  const parseEquipOption = (o, gi, oi) => {
    if (o.option_type === 'counted_reference') {
      const idx = o.of?.index ?? `__ref__${gi}_${oi}`
      const name = o.of?.name ?? 'Unknown item'
      return { id: `${gi}_${oi}`, label: o.count > 1 ? `${name} ×${o.count}` : name, items: [{ index: idx, name, quantity: o.count ?? 1 }], isCategory: false }
    }
    if (o.option_type === 'multiple') {
      // Bundle — may include counted_reference AND choice (e.g. holy symbol option)
      const parts = (o.items ?? []).flatMap((i, ii) => {
        if (i.option_type === 'counted_reference') {
          return [{ index: i.of?.index ?? `__multi__${gi}_${oi}_${ii}`, name: i.of?.name ?? 'Item', quantity: i.count ?? 1 }]
        }
        return []
      })
      const equipmentChoice = (o.items ?? []).find(i => i.option_type === 'equipment_type_choice')
      if (equipmentChoice) {
        const label = [
          equipmentChoice.label ?? 'Choose equipment',
          ...parts.map(p => p.quantity > 1 ? `${p.name} ×${p.quantity}` : p.name),
        ].join(' + ')
        return {
          id: `${gi}_${oi}`,
          label,
          items: parts,
          isCategory: false,
          isEquipmentTypeChoice: true,
          equipmentChoice,
        }
      }
      const embeddedChoice = (o.items ?? []).find(i => i.option_type === 'choice' && i.choice?.from?.equipment_category?.index)
      if (embeddedChoice) {
        const desc = embeddedChoice.choice?.desc ?? 'Any item'
        const categoryIndex = embeddedChoice.choice?.from?.equipment_category?.index ?? null
        const choose = embeddedChoice.choice?.choose ?? 1
        const label = [desc, ...parts.map(p => p.quantity > 1 ? `${p.name} ×${p.quantity}` : p.name)].join(' + ')
        return { id: `${gi}_${oi}`, label, items: parts, isCategory: true, isCategoryBundle: true, categoryIndex, choiceDesc: desc, choose }
      }
      const label = parts.map(p => p.quantity > 1 ? `${p.name} ×${p.quantity}` : p.name).join(' + ')
      return { id: `${gi}_${oi}`, label, items: parts, isCategory: false }
    }
    if (o.option_type === 'choice') {
      // Category pick — needs inline expansion; may allow choosing multiple
      const desc = o.choice?.desc ?? 'Any item'
      const categoryIndex = o.choice?.from?.equipment_category?.index ?? null
      const choose = o.choice?.choose ?? 1
      return { id: `${gi}_${oi}`, label: desc, items: [], isCategory: true, categoryIndex, choiceDesc: desc, choose }
    }
    return null
  }

  const equipGroups = equipOptions.map((opt, gi) => {
    const choices = (opt.from?.options ?? []).map((o, oi) => parseEquipOption(o, gi, oi)).filter(Boolean)
    return { desc: opt.desc, choices, groupIndex: gi }
  }).filter(g => g.choices.length > 0)

  // When user clicks a category card, fetch its items
  // null = not fetched; [] = fetched but empty; [...] = loaded
  const expandCategory = async (choice) => {
    setExpandedChoice(choice.id)
    if (categoryItems[choice.id] !== undefined) return // already fetched
    setCategoryItems(prev => ({ ...prev, [choice.id]: null })) // mark as loading
    const items = choice.categoryIndex
      ? await fetchCategoryItems(choice.categoryIndex)
      : []
    setCategoryItems(prev => ({ ...prev, [choice.id]: items }))
  }

  const allSkillsSelected = allSkillGroups.every(g => {
    const count = selectedSkills.filter(s => g.options.some(o => o.item.index === s)).length
    return count >= g.choose
  })
  const allToolsSelected = toolGroups.every(group =>
    selectedTools.filter(item => item.groupIndex === group.groupIndex).length >= (group.choose ?? 1)
  )
  const allEquipSelected = equipGroups.every(g => {
    const groupSelections = selectedEquipment.filter(e => e.groupIndex === g.groupIndex)
    if (groupSelections.length === 0) return false
    const selectedChoiceIds = new Set(groupSelections.map(e => e.choiceId))
    // At least one choice in the group must be fully satisfied
    return g.choices.some(choice => {
      if (!selectedChoiceIds.has(choice.id)) return false
      if (choice.isEquipmentTypeChoice) {
        return groupSelections.some(e => e.choiceId === choice.id && e.equipmentTypeChoice)
      }
      if (!choice.isCategory) return true
      const need = choice.choose ?? 1
      const have = groupSelections.filter(e => e.choiceId === choice.id && !e.bundledFixed).length
      return have >= need
    })
  })
  const allFeatureChoicesSelected = featureChoiceGroups.every(choice => {
    const selected = selectedFeatureChoices.find(item => item.choiceKey === choice.choiceKey)
    return (selected?.options?.length ?? 0) >= (choice.choose ?? 1)
  }) && (!superiorTechniqueSelected || !!superiorTechniqueManeuver)

  const toggleFeatureOption = (choice, option) => {
    const existing = selectedFeatureChoices.find(item => item.choiceKey === choice.choiceKey)
    const currentOptions = existing?.options ?? []
    const checked = currentOptions.some(item => item.id === option.id)
    const choose = choice.choose ?? 1
    const nextOptions = checked
      ? currentOptions.filter(item => item.id !== option.id)
      : currentOptions.length >= choose
      ? currentOptions
      : [...currentOptions, {
        id: option.id,
        name: option.name,
        source: option.source,
        desc: option.desc,
        featureType: option.featureType,
      }]
    const nextChoice = {
      choiceKey: choice.choiceKey,
      featureIndex: choice.feature.index,
      featureName: choice.feature.name,
      className: choice.feature.className,
      classIndex: choice.feature.classIndex,
      subclassName: choice.feature.subclassName,
      gainedAtLevel: choice.feature.level,
      options: nextOptions,
    }
    const clearSuperiorTechnique = checked && option.name === 'Superior Technique'
    onFeatureChoicesChange([
      ...selectedFeatureChoices.filter(item =>
        item.choiceKey !== choice.choiceKey &&
        (!clearSuperiorTechnique || item.choiceKey !== superiorTechniqueChoiceKey)
      ),
      nextChoice,
    ])
  }
  const chooseSuperiorTechniqueManeuver = (maneuver) => {
    const nextChoice = {
      choiceKey: superiorTechniqueChoiceKey,
      featureIndex: 'superior-technique-maneuver',
      featureName: 'Superior Technique Maneuver',
      className: classData.name,
      classIndex: classData.index,
      gainedAtLevel: 1,
      options: [{
        id: maneuver.id,
        name: maneuver.name,
        source: maneuver.source,
        desc: maneuver.desc,
        featureType: maneuver.featureType,
      }],
    }
    onFeatureChoicesChange([
      ...selectedFeatureChoices.filter(item => item.choiceKey !== superiorTechniqueChoiceKey),
      nextChoice,
    ])
  }

  return (
    <div style={S.wrap}>
      <div style={S.h1}>{classData.name} Setup</div>
      <div style={S.sub}>Choose your starting skills and equipment.</div>

      {/* Fixed proficiencies summary */}
      {classData.proficiencies?.filter(p => !p.index.startsWith('saving-throw-')).length > 0 && (
        <>
          <label style={S.label}>You gain these proficiencies</label>
          <div>
            {classData.proficiencies.filter(p => !p.index.startsWith('saving-throw-')).map(p => (
              <span key={p.index} style={S.tag}>{p.name}</span>
            ))}
          </div>
        </>
      )}

     {/* Skill choices */}
{allSkillGroups.map((group, gi) => (
  <div key={gi}>
    <label style={S.label}>Choose {group.choose} Skill{group.choose > 1 ? 's' : ''}</label>
    <div style={S.cardSub}>{group.desc}</div>

    {group.options.map(o => {
      const skillIndex = o.item.index
      const checked = selectedSkills.includes(skillIndex)
      const groupSelected = selectedSkills.filter(s => group.options.some(opt => opt.item.index === s)).length
      const disabled = !checked && groupSelected >= group.choose
      return (
        <div
          key={skillIndex}
          style={{ ...S.checkRow, opacity: disabled ? 0.4 : 1, border: checked ? '1px solid var(--accent)' : '1px solid var(--border)' }}
          onClick={() => !disabled && toggleSkill(gi, skillIndex)}
        >
          <span style={{ color: checked ? 'var(--accent-hover)' : 'var(--text-muted)', fontSize: '1.1rem' }}>{checked ? '◉' : '○'}</span>
          <span>{o.item.name.replace('Skill: ', '')}</span>
        </div>
      )
    })}
  </div>
))}

      {/* Tool choices */}
      {toolGroups.map(group => {
        const selectedForGroup = selectedTools.filter(item => item.groupIndex === group.groupIndex)
        const choose = group.choose ?? 1
        return (
          <div key={group.groupIndex}>
            <label style={S.label}>Choose {choose} Class Tool Proficiency{choose === 1 ? '' : 'ies'}</label>
            <div style={S.cardSub}>{selectedForGroup.length} / {choose} selected</div>
            {(group.options ?? []).map(tool => {
              const checked = selectedForGroup.some(item => item.index === tool.index)
              const disabled = !checked && selectedForGroup.length >= choose
              return (
                <div
                  key={tool.index}
                  style={{ ...S.checkRow, opacity: disabled ? 0.4 : 1, border: checked ? '1px solid var(--accent)' : '1px solid var(--border)' }}
                  onClick={() => !disabled && toggleTool(group, tool)}
                >
                  <span style={{ color: checked ? 'var(--accent-hover)' : 'var(--text-muted)', fontSize: '1.1rem' }}>{checked ? '◉' : '○'}</span>
                  <span>{tool.name}</span>
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Feature choices */}
      {featureChoiceGroups.map(choice => {
        const selected = selectedFeatureChoices.find(item => item.choiceKey === choice.choiceKey)
        const selectedOptions = selected?.options ?? []
        const choose = choice.choose ?? 1
        return (
          <div key={choice.choiceKey}>
            <label style={S.label}>{choice.feature.name}</label>
            <div style={S.cardSub}>Choose {choose} {choose === 1 ? 'option' : 'options'}.</div>
            {choice.options.map(option => {
              const checked = selectedOptions.some(item => item.id === option.id)
              const disabled = !checked && selectedOptions.length >= choose
              return (
                <div
                  key={option.id}
                  style={{ ...S.checkRow, alignItems:'flex-start', opacity: disabled ? 0.4 : 1, border: checked ? '1px solid var(--accent)' : '1px solid var(--border)' }}
                  onClick={() => !disabled && toggleFeatureOption(choice, option)}
                >
                  <span style={{ color: checked ? 'var(--accent-hover)' : 'var(--text-muted)', fontSize: '1.1rem', lineHeight:1.2 }}>{checked ? '◉' : '○'}</span>
                  <span style={{ display:'flex', flexDirection:'column', gap:3 }}>
                    <span>{option.name}</span>
                    {option.desc?.[0] && <span style={{ fontSize:'0.75rem', color:'var(--text-secondary)', lineHeight:1.35 }}>{option.desc[0].slice(0, 180)}{option.desc[0].length > 180 ? '…' : ''}</span>}
                  </span>
                  {option.source && <span style={{ marginLeft:'auto' }}><SourceBadge item={option} /></span>}
                </div>
              )
            })}
          </div>
        )
      })}

      {superiorTechniqueSelected && (
        <div>
          <label style={S.label}>Superior Technique Maneuver</label>
          <div style={S.cardSub}>Choose 1 Battle Master maneuver.</div>
          {maneuverOptions.map(maneuver => {
            const checked = superiorTechniqueManeuver?.id === maneuver.id
            return (
              <div
                key={maneuver.id}
                style={{ ...S.checkRow, alignItems:'flex-start', border: checked ? '1px solid var(--accent)' : '1px solid var(--border)' }}
                onClick={() => chooseSuperiorTechniqueManeuver(maneuver)}
              >
                <span style={{ color: checked ? 'var(--accent-hover)' : 'var(--text-muted)', fontSize: '1.1rem', lineHeight:1.2 }}>{checked ? '◉' : '○'}</span>
                <span style={{ display:'flex', flexDirection:'column', gap:3 }}>
                  <span>{maneuver.name}</span>
                  {maneuver.desc?.[0] && <span style={{ fontSize:'0.75rem', color:'var(--text-secondary)', lineHeight:1.35 }}>{maneuver.desc[0].slice(0, 180)}{maneuver.desc[0].length > 180 ? '…' : ''}</span>}
                </span>
                {maneuver.source && <span style={{ marginLeft:'auto' }}><SourceBadge item={maneuver} /></span>}
              </div>
            )
          })}
        </div>
      )}

      {/* Equipment choices */}
      {equipGroups.map((group) => (
        <div key={group.groupIndex}>
          <label style={S.label}>Choose Starting Equipment</label>
          <div style={S.cardSub}>{group.desc}</div>
          {group.choices.map(choice => {
            const groupSelections = selectedEquipment.filter(e => e.groupIndex === group.groupIndex)
            const activeChoiceId = groupSelections[0]?.choiceId ?? null
            const checked = groupSelections.some(e => e.choiceId === choice.id)
            const lockedByOtherChoice = !!activeChoiceId && activeChoiceId !== choice.id
            const isExpanded = expandedChoice === choice.id
            if (choice.isCategory) {
              const choose = choice.choose ?? 1
              const selectedForChoice = groupSelections.filter(e => e.choiceId === choice.id)
              const selectedCategoryItems = selectedForChoice.filter(e => !e.bundledFixed)
              const choiceComplete = selectedCategoryItems.length >= choose
              const loadedItems = categoryItems[choice.id] // null=loading, undefined=not started, []=empty, [...]
              const itemSourceFilter = categorySourceFilters[choice.id] ?? ALL_SOURCES
              const effectiveItemSource = effectiveSourceFilter(loadedItems ?? [], itemSourceFilter)
              const visibleItems = (loadedItems ?? []).filter(item => effectiveItemSource === ALL_SOURCES || sourceCode(item) === effectiveItemSource)
              return (
                <div key={choice.id}>
                  <div
                    style={S.card(choiceComplete, lockedByOtherChoice)}
                    onClick={() => !lockedByOtherChoice && expandCategory(choice)}
                  >
                    <div style={S.cardName}>{choice.label}</div>
                    <div style={S.cardSub}>
                      {lockedByOtherChoice
                        ? 'Locked by another option in this group'
                        : isExpanded
                        ? `${selectedCategoryItems.length}/${choose} selected — choose below ↓`
                        : `Tap to expand · choose ${choose}`}
                    </div>
                  </div>
                  {isExpanded && !lockedByOtherChoice && (
                    <div style={{ paddingLeft: '1rem', marginBottom: '0.5rem' }}>
                      {loadedItems === null || loadedItems === undefined
                        ? <div style={S.cardSub}>Loading…</div>
                        : loadedItems.length === 0
                        ? <div style={S.cardSub}>No items found for this category.</div>
                        : <>
                          <SourceFilter
                            items={loadedItems}
                            value={itemSourceFilter}
                            onChange={(source) => setCategorySourceFilters(prev => ({ ...prev, [choice.id]: source }))}
                          />
                          {visibleItems.map(item => {
                            const itemChecked = selectedCategoryItems.some(e => e.index === item.index)
                            const disabled = !itemChecked && selectedCategoryItems.length >= choose
                            return (
                              <div
                                key={item.index}
                                style={{ ...S.checkRow, opacity: disabled ? 0.4 : 1, border: itemChecked ? '1px solid var(--accent)' : '1px solid var(--border)', marginBottom: '0.35rem' }}
                                onClick={() => {
                  if (disabled) return
                  const otherGroups = selectedEquipment.filter(e => e.groupIndex !== group.groupIndex)
                                  const sameChoiceWithoutItem = selectedForChoice.filter(e => e.index !== item.index)
                                  if (itemChecked) {
                                    onEquipmentChange([...otherGroups, ...sameChoiceWithoutItem])
                                  } else {
                                    const bundleItems = choice.isCategoryBundle && selectedCategoryItems.length === 0
                                      ? choice.items.map(bundleItem => ({ ...bundleItem, groupIndex: group.groupIndex, choiceId: choice.id, bundledFixed: true }))
                                      : []
                    onEquipmentChange([...otherGroups, ...sameChoiceWithoutItem, ...bundleItems, { ...item, groupIndex: group.groupIndex, choiceId: choice.id }])
                  }
                }}
                              >
                                <span style={{ color: itemChecked ? 'var(--accent-hover)' : 'var(--text-muted)', fontSize: '1.1rem' }}>{itemChecked ? '◉' : '○'}</span>
                                <span>{item.name}</span>
                                <span style={{ marginLeft:'auto' }}><SourceBadge item={item} /></span>
                              </div>
                            )
                          })}
                        </>
                      }
                    </div>
                  )}
                </div>
              )
            }

            if (choice.isEquipmentTypeChoice) {
              const selectedForChoice = groupSelections.filter(e => e.choiceId === choice.id)
              const selectedToolIndex = selectedForChoice.find(item => item.equipmentTypeChoice)?.index
              return (
                <div key={choice.id}>
                  <div style={S.card(checked, lockedByOtherChoice)}>
                    <div style={S.cardName}>{choice.equipmentChoice?.label ?? choice.label}</div>
                    {choice.items.length > 0 && (
                      <div style={S.cardSub}>Also includes {choice.items.map(item => item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name).join(', ')}</div>
                    )}
                  </div>
                  {!lockedByOtherChoice && (
                    <div style={{ paddingLeft: '1rem', marginBottom: '0.5rem' }}>
                      {(choice.equipmentChoice?.options ?? []).map(option => {
                        const optionChecked = selectedToolIndex === option.index
                        return (
                          <div
                            key={option.index}
                            style={{ ...S.checkRow, border: optionChecked ? '1px solid var(--accent)' : '1px solid var(--border)', marginBottom: '0.35rem' }}
                            onClick={() => {
                              const without = selectedEquipment.filter(e => e.groupIndex !== group.groupIndex)
                              onEquipmentChange([
                                ...without,
                                { ...option, quantity: choice.equipmentChoice?.count ?? 1, groupIndex: group.groupIndex, choiceId: choice.id, equipmentTypeChoice: true },
                                ...choice.items.map(item => ({ ...item, groupIndex: group.groupIndex, choiceId: choice.id })),
                              ])
                            }}
                          >
                            <span style={{ color: optionChecked ? 'var(--accent-hover)' : 'var(--text-muted)', fontSize: '1.1rem' }}>{optionChecked ? '◉' : '○'}</span>
                            <span>{option.name}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            // Normal card (single item or bundle)
            return (
              <div
                key={choice.id}
                style={S.card(checked, lockedByOtherChoice)}
                onClick={() => {
                  if (lockedByOtherChoice) return
                  const without = selectedEquipment.filter(e => e.groupIndex !== group.groupIndex)
                  onEquipmentChange(checked ? without : [...without, ...choice.items.map(item => ({ ...item, groupIndex: group.groupIndex, choiceId: choice.id }))])
                }}
              >
                <div style={S.cardName}>{choice.label}</div>
              </div>
            )
          })}
        </div>
      ))}

      {/* Auto-added gear summary */}
      {classData.starting_equipment?.length > 0 && (
        <>
          <label style={S.label}>Automatically Added</label>
          <div>
            {classData.starting_equipment.map(e => (
              <span key={e.equipment.index} style={S.tag}>{e.equipment.name}{e.quantity > 1 ? ` ×${e.quantity}` : ''}</span>
            ))}
          </div>
        </>
      )}

      <div style={S.row}>
        <button style={S.btn(false)} onClick={onBack}>← Back</button>
        <button style={S.btn(true)} onClick={onNext} disabled={!allSkillsSelected || !allToolsSelected || !allEquipSelected || !allFeatureChoicesSelected}>
          Next: Background →
        </button>
      </div>
      {(!allSkillsSelected || !allToolsSelected || !allEquipSelected || !allFeatureChoicesSelected) && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          {!allSkillsSelected && <div>Skills not complete ({allSkillGroups.map(g => `${selectedSkills.filter(s => g.options.some(o => o.item.index === s)).length}/${g.choose}`).join(', ')})</div>}
          {!allToolsSelected && <div>Tool choices not complete.</div>}
          {!allFeatureChoicesSelected && <div>Feature choices not complete.</div>}
          {!allEquipSelected && <div>Equipment not complete — groups: {equipGroups.length}, selected groupIndexes: [{selectedEquipment.map(e => e.groupIndex).join(', ')}]</div>}
        </div>
      )}
    </div>
  )
}

// ─── Step 6: Background ───────────────────────────────────────────────────────

function StepBackground({ backgrounds, selected, onSelect, onNext, onBack }) {
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState(ALL_SOURCES)
  const filtered = filterBySearchAndSource(backgrounds, search, sourceFilter)

  return (
    <div style={S.wrap}>
      <div style={S.h1}>Choose a Background</div>
      <div style={S.sub}>Your background reflects your life before adventuring.</div>
      <SearchInput
        placeholder="Search backgrounds..."
        value={search}
        onChange={setSearch}
        items={backgrounds}
        sourceFilter={sourceFilter}
        onSourceFilter={setSourceFilter}
      />
      <div style={S.scrollList}>
        {filtered.map(b => (
          <div key={b.index} style={S.card(selected?.index === b.index)} onClick={() => onSelect(b)}>
            <div style={S.cardTop}>
              <div style={S.cardName}>{b.name}</div>
              <SourceBadge item={b} />
            </div>
            <div style={S.cardSub}>
              Skills: {b.starting_proficiencies?.filter(p => p.index.startsWith('skill-')).map(p => p.name.replace('Skill: ', '')).join(', ')}
            </div>
          </div>
        ))}
      </div>
      <div style={S.row}>
        <button style={S.btn(false)} onClick={onBack}>← Back</button>
        <button style={S.btn(true)} onClick={onNext} disabled={!selected}>Next: Background Setup →</button>
      </div>
    </div>
  )
}

// ─── Step 7: Background setup (languages, tools + equipment choices) ──────────

function StepBackgroundSetup({ backgroundData, selectedLanguages, onLanguagesChange, selectedTools = [], onToolsChange, selectedEquipment, onEquipmentChange, onNext, onBack }) {
  const langOptions = backgroundData.language_options
  const langPool = langOptions?.from?.options ?? langOptions?.from?.resource_list_url
    ? [] // resource_list means "any language" — we'll show a curated list
    : []
  const langChoose = langOptions?.choose ?? 0
  const isResourceList = langOptions?.from?.option_set_type === 'resource_list'

  const COMMON_LANGUAGES = ['Abyssal', 'Celestial', 'Draconic', 'Deep Speech', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin', 'Halfling', 'Infernal', 'Orc', 'Primordial', 'Sylvan', 'Undercommon']

  const displayLangs = isResourceList
    ? COMMON_LANGUAGES.map(name => ({ option_type: 'reference', item: { index: name.toLowerCase().replace(/\s/g, '-'), name } }))
    : langPool

  const toggleLang = (name) => {
    if (selectedLanguages.includes(name)) {
      onLanguagesChange(selectedLanguages.filter(l => l !== name))
    } else if (selectedLanguages.length < langChoose) {
      onLanguagesChange([...selectedLanguages, name])
    }
  }

  const toolGroups = (backgroundData.tool_options ?? []).map((group, groupIndex) => ({ ...group, groupIndex }))
  const toggleTool = (group, tool) => {
    const selectedForGroup = selectedTools.filter(item => item.groupIndex === group.groupIndex)
    const checked = selectedForGroup.some(item => item.index === tool.index)
    if (checked) {
      onToolsChange(selectedTools.filter(item => !(item.groupIndex === group.groupIndex && item.index === tool.index)))
    } else if (selectedForGroup.length < (group.choose ?? 1)) {
      onToolsChange([...selectedTools, { ...tool, groupIndex: group.groupIndex }])
    }
  }

  const equipOptions = backgroundData.starting_equipment_options ?? []
  const equipGroups = equipOptions.map((opt, gi) => {
    const choices = opt.from?.option_set_type === 'options_array'
      ? (opt.from.options ?? []).map((o, oi) => {
        if (o.option_type === 'counted_reference') {
          const idx = o.of?.index ?? `__ref__${gi}_${oi}`
          const name = o.of?.name ?? 'Item'
          return {
            id: `${gi}_${oi}`,
            label: o.count > 1 ? `${name} ×${o.count}` : name,
            items: [{ index: idx, name, source: o.of?.source, quantity: o.count ?? 1, custom: o.custom, containsValue: o.containsValue }],
            isChoice: false,
          }
        }
        if (o.option_type === 'multiple') {
          const parts = (o.items ?? []).filter(i => i.option_type === 'counted_reference').map(i => ({
            index: i.of?.index ?? `__multi__${gi}_${oi}`,
            name: i.of?.name ?? 'Item',
            source: i.of?.source,
            quantity: i.count ?? 1,
            custom: i.custom,
            containsValue: i.containsValue,
          }))
          const equipmentChoice = (o.items ?? []).find(i => i.option_type === 'equipment_type_choice')
          if (equipmentChoice) {
            const label = [
              equipmentChoice.label ?? 'Choose equipment',
              ...parts.map(p => p.quantity > 1 ? `${p.name} ×${p.quantity}` : p.name),
            ].join(' + ')
            return {
              id: `${gi}_${oi}`,
              label,
              items: parts,
              isEquipmentTypeChoice: true,
              equipmentChoice,
            }
          }
          const label = parts.map(p => p.quantity > 1 ? `${p.name} ×${p.quantity}` : p.name).join(' + ')
          return { id: `${gi}_${oi}`, label, items: parts, isChoice: false }
        }
        if (o.option_type === 'equipment_type_choice') {
          return {
            id: `${gi}_${oi}`,
            label: o.label ?? 'Choose equipment',
            items: [],
            isEquipmentTypeChoice: true,
            equipmentChoice: o,
          }
        }
        if (o.option_type === 'choice') {
          const desc = o.choice?.desc ?? 'Any item'
          return { id: `${gi}_${oi}`, label: desc, items: [], isChoice: true, choiceDesc: desc }
        }
        return null
      }).filter(Boolean)
      : (() => {
          const desc = `Any ${opt.from?.equipment_category?.name ?? 'item'}`
          return [{ id: `${gi}_0`, label: desc, items: [{ index: `__category__${gi}`, name: desc, quantity: 1 }], isChoice: true, choiceDesc: desc }]
        })()
    return { desc: opt.desc, choices, groupIndex: gi }
  })

  const langReady = langChoose === 0 || selectedLanguages.length >= langChoose
  const toolReady = toolGroups.every(group =>
    selectedTools.filter(item => item.groupIndex === group.groupIndex).length >= (group.choose ?? 1)
  )
  const equipOk = equipGroups.length === 0 || equipGroups.every(g => selectedEquipment.some(e => e.groupIndex === g.groupIndex))

  return (
    <div style={S.wrap}>
      <div style={S.h1}>{backgroundData.name} Setup</div>
      <div style={S.sub}>Your background grants skills, languages, and gear.</div>

      {/* Fixed skills */}
      {backgroundData.starting_proficiencies?.filter(p => p.index.startsWith('skill-')).length > 0 && (
        <>
          <label style={S.label}>Skills Gained</label>
          <div>{backgroundData.starting_proficiencies.filter(p => p.index.startsWith('skill-')).map(p => (
            <span key={p.index} style={S.tag}>{p.name.replace('Skill: ', '')}</span>
          ))}</div>
        </>
      )}

      {/* Fixed tools */}
      {backgroundData.starting_proficiencies?.filter(p => !p.index.startsWith('skill-')).length > 0 && (
        <>
          <label style={S.label}>Tool Proficiencies Gained</label>
          <div>{backgroundData.starting_proficiencies.filter(p => !p.index.startsWith('skill-')).map(p => (
            <span key={p.index} style={S.tag}>{p.name}</span>
          ))}</div>
        </>
      )}

      {/* Language choices */}
      {langChoose > 0 && (
        <>
          <label style={S.label}>Choose {langChoose} Language{langChoose > 1 ? 's' : ''}</label>
          <div style={S.cardSub}>{selectedLanguages.length} / {langChoose} selected</div>
          {displayLangs.map((opt, i) => {
            const name = opt.item?.name ?? opt
            const checked = selectedLanguages.includes(name)
            const disabled = !checked && selectedLanguages.length >= langChoose
            return (
              <div
                key={i}
                style={{ ...S.checkRow, opacity: disabled ? 0.4 : 1, border: checked ? '1px solid var(--accent)' : '1px solid var(--border)' }}
                onClick={() => !disabled && toggleLang(name)}
              >
                <span style={{ color: checked ? 'var(--accent-hover)' : 'var(--text-muted)', fontSize: '1.1rem' }}>{checked ? '◉' : '○'}</span>
                <span>{name}</span>
              </div>
            )
          })}
        </>
      )}

      {/* Tool choices */}
      {toolGroups.map(group => {
        const selectedForGroup = selectedTools.filter(item => item.groupIndex === group.groupIndex)
        const choose = group.choose ?? 1
        return (
          <div key={group.groupIndex}>
            <label style={S.label}>Choose {choose} Tool Proficiency{choose === 1 ? '' : 'ies'}</label>
            <div style={S.cardSub}>{selectedForGroup.length} / {choose} selected</div>
            {(group.options ?? []).map(tool => {
              const checked = selectedForGroup.some(item => item.index === tool.index)
              const disabled = !checked && selectedForGroup.length >= choose
              return (
                <div
                  key={tool.index}
                  style={{ ...S.checkRow, opacity: disabled ? 0.4 : 1, border: checked ? '1px solid var(--accent)' : '1px solid var(--border)' }}
                  onClick={() => !disabled && toggleTool(group, tool)}
                >
                  <span style={{ color: checked ? 'var(--accent-hover)' : 'var(--text-muted)', fontSize: '1.1rem' }}>{checked ? '◉' : '○'}</span>
                  <span>{tool.name}</span>
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Equipment choices */}
      {equipGroups.map((group) => (
        <div key={group.groupIndex}>
          <label style={S.label}>Choose Equipment</label>
          <div style={S.cardSub}>{group.desc}</div>
          {group.choices.map(choice => {
            const checked = selectedEquipment.some(e => e.groupIndex === group.groupIndex && e.choiceId === choice.id)
            if (choice.isEquipmentTypeChoice) {
              const selectedForChoice = selectedEquipment.filter(e => e.groupIndex === group.groupIndex && e.choiceId === choice.id)
              const selectedToolIndex = selectedForChoice.find(item => item.equipmentTypeChoice)?.index
              return (
                <div key={choice.id}>
                  <div style={S.card(checked)}>
                    <div style={S.cardName}>{choice.equipmentChoice?.label ?? choice.label}</div>
                    {choice.items.length > 0 && (
                      <div style={S.cardSub}>Also includes {choice.items.map(item => item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name).join(', ')}</div>
                    )}
                  </div>
                  <div style={{ paddingLeft: '1rem', marginBottom: '0.5rem' }}>
                    {(choice.equipmentChoice?.options ?? []).map(option => {
                      const optionChecked = selectedToolIndex === option.index
                      return (
                        <div
                          key={option.index}
                          style={{ ...S.checkRow, border: optionChecked ? '1px solid var(--accent)' : '1px solid var(--border)', marginBottom: '0.35rem' }}
                          onClick={() => {
                            const without = selectedEquipment.filter(e => e.groupIndex !== group.groupIndex)
                            onEquipmentChange([
                              ...without,
                              { ...option, quantity: choice.equipmentChoice?.count ?? 1, groupIndex: group.groupIndex, choiceId: choice.id, equipmentTypeChoice: true },
                              ...choice.items.map(item => ({ ...item, groupIndex: group.groupIndex, choiceId: choice.id })),
                            ])
                          }}
                        >
                          <span style={{ color: optionChecked ? 'var(--accent-hover)' : 'var(--text-muted)', fontSize: '1.1rem' }}>{optionChecked ? '◉' : '○'}</span>
                          <span>{option.name}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            }
            return (
              <div
                key={choice.id}
                style={S.card(checked)}
                onClick={() => {
                  const without = selectedEquipment.filter(e => e.groupIndex !== group.groupIndex)
                  if (choice.isChoice) {
                    onEquipmentChange([...without, { index: `__choice__${choice.id}`, name: choice.choiceDesc, quantity: 1, groupIndex: group.groupIndex, choiceId: choice.id }])
                  } else {
                    onEquipmentChange([...without, ...choice.items.map(item => ({ ...item, groupIndex: group.groupIndex, choiceId: choice.id }))])
                  }
                }}
              >
                <div style={S.cardName}>{choice.label}</div>
                {choice.isChoice && <div style={S.cardSub}>You'll be able to specify this item later</div>}
              </div>
            )
          })}
        </div>
      ))}

      {/* Auto-added gear */}
      {backgroundData.starting_equipment?.length > 0 && (
        <>
          <label style={S.label}>Automatically Added</label>
          <div>{backgroundData.starting_equipment.map(e => (
            <span key={e.equipment.index} style={S.tag}>{e.equipment.name}{e.quantity > 1 ? ` ×${e.quantity}` : ''}</span>
          ))}</div>
        </>
      )}

      {/* Background feature */}
      {backgroundData.feature && (
        <>
          <label style={S.label}>Background Feature</label>
          <div style={S.featureBox}>
            <div style={S.featureName}>{backgroundData.feature.name}</div>
            {backgroundData.feature.desc?.map((d, i) => (
              <div key={i} style={{ ...S.featureDesc, marginBottom: '0.4rem' }}>{d}</div>
            ))}
          </div>
        </>
      )}

      <div style={S.row}>
        <button style={S.btn(false)} onClick={onBack}>← Back</button>
        <button style={S.btn(true)} onClick={onNext} disabled={!langReady || !toolReady || !equipOk}>Next: Alignment →</button>
      </div>
    </div>
  )
}

// ─── Step 8: Alignment ────────────────────────────────────────────────────────

const ALIGNMENTS = [
  'Lawful Good', 'Neutral Good', 'Chaotic Good',
  'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
  'Lawful Evil', 'Neutral Evil', 'Chaotic Evil',
]

function StepAlignment({ raceData, selected, onSelect, onNext, onBack, creating }) {
  return (
    <div style={S.wrap}>
      <div style={S.h1}>Choose Alignment</div>
      <div style={S.sub}>
        {raceData?.alignment
          ? <><em style={{ color: 'var(--accent-hover)' }}>{raceData.name} tendency:</em> {raceData.alignment}</>
          : 'Your moral and ethical outlook.'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginTop: '0.75rem' }}>
        {ALIGNMENTS.map(a => (
          <div key={a} style={{ ...S.card(selected === a), textAlign: 'center', padding: '0.6rem' }} onClick={() => onSelect(a)}>
            <div style={{ fontSize: '0.85rem', fontWeight: selected === a ? 700 : 400 }}>{a}</div>
          </div>
        ))}
      </div>
      <div style={S.row}>
        <button style={S.btn(false)} onClick={onBack} disabled={creating}>← Back</button>
        <button style={S.btn(true)} onClick={onNext} disabled={!selected || creating}>
          {creating ? 'Creating…' : 'Create Character ✓'}
        </button>
      </div>
    </div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step, totalSteps }) {
  return (
    <div style={{ padding: '1rem 1rem 0', width: 'min(100%, 720px)', margin: '0 auto', boxSizing:'border-box' }}>
      <div style={S.progress}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} style={S.dot(i === step, i < step)} />
        ))}
      </div>
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

function CreateCharacter({ user, onComplete, onCancel }) {
  const [step, setStep] = useState(0)
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)

  // SRD data
  const [races, setRaces] = useState([])
  const [allSubraces, setAllSubraces] = useState([])
  const [classes, setClasses] = useState([])
  const [backgrounds, setBackgrounds] = useState([])
  const [equipmentCatalog, setEquipmentCatalog] = useState([])
  const [contentLoading, setContentLoading] = useState(CONTENT_LOADING_INITIAL)

  // Wizard state
  const [rulesEdition, setRulesEdition] = useState('2014')
  const [name, setName] = useState('')
  const [raceData, setRaceData] = useState(null)
  const [subraceData, setSubraceData] = useState(null)
  const [raceBonusOptions, setRaceBonusOptions] = useState([])
  const [racialOptionChoices, setRacialOptionChoices] = useState({})
  const [racialFeat, setRacialFeat] = useState(null)
  const [racialFeatAbility, setRacialFeatAbility] = useState(null)
  const [classData, setClassData] = useState(null)
  const [subclassChoice, setSubclassChoice] = useState(null)
  const [classSkills, setClassSkills] = useState([])
  const [classTools, setClassTools] = useState([])
  const [classEquipment, setClassEquipment] = useState([])
  const [classFeatureChoices, setClassFeatureChoices] = useState([])
  const [abilityScores, setAbilityScores] = useState({ str:10, dex:10, con:10, int:10, wis:10, cha:10 })
  const [startingCantrips, setStartingCantrips] = useState([])
  const [startingBonusCantrips, setStartingBonusCantrips] = useState([])
  const [startingSpells,   setStartingSpells]   = useState([])
  const [backgroundData, setBackgroundData] = useState(null)
  const [backgroundLanguages, setBackgroundLanguages] = useState([])
  const [backgroundTools, setBackgroundTools] = useState([])
  const [backgroundEquipment, setBackgroundEquipment] = useState([])
  const [alignment, setAlignment] = useState('')

  useEffect(() => {
    let cancelled = false
    setContentLoading(CONTENT_LOADING_INITIAL)
    setRaces([])
    setAllSubraces([])
    setClasses([])
    setBackgrounds([])
    setEquipmentCatalog([])

    const loadCatalog = (key, label, load, apply) => {
      load()
        .then(value => {
          if (!cancelled) apply(value)
        })
        .catch(err => {
          if (!cancelled) setError(prev => prev ?? `${label} content failed to load: ${err.message}`)
        })
        .finally(() => {
          if (!cancelled) setContentLoading(prev => ({ ...prev, [key]: false }))
        })
    }

    loadCatalog('races', 'Race', () => getRaces(rulesEdition), setRaces)
    loadCatalog('subraces', 'Subrace', () => getSubraces(rulesEdition), setAllSubraces)
    loadCatalog('classes', 'Class', () => getClasses(rulesEdition), setClasses)
    loadCatalog('backgrounds', 'Background', () => getBackgrounds(rulesEdition), setBackgrounds)
    loadCatalog('equipment', 'Equipment', getEquipment, setEquipmentCatalog)

    return () => { cancelled = true }
  }, [rulesEdition])

  const hasSubrace = raceData?.subraces?.length > 0 || !!raceData?.ability_bonus_options
  const hasRacialOptions = hasRacialSetupOptions(raceData, subraceData)
  const hasSubclassAtCreation = !!(classData && (SUBCLASS_LEVELS[classData.index] ?? []).includes(1))
  const isSpellcaster = !!(classData && (CANTRIPS_KNOWN[classData.index] || SPELLS_KNOWN_L1[classData.index]))

  // Compute step indices dynamically
  const STEP_EDITION    = 0
  const STEP_NAME       = 1
  const STEP_RACE       = 2
  const STEP_SUBRACE    = 3                                        // may be skipped
  const STEP_RACE_OPTIONS = hasSubrace ? 4 : 3                      // may be skipped
  const STEP_CLASS      = STEP_RACE_OPTIONS + (hasRacialOptions ? 1 : 0)
  const STEP_SUBCLASS   = STEP_CLASS + 1                          // may be skipped
  const STEP_CLASS_SETUP    = hasSubclassAtCreation ? STEP_SUBCLASS + 1 : STEP_CLASS + 1
  const STEP_ABILITY_SCORES = STEP_CLASS_SETUP + 1
  const STEP_SPELLS         = STEP_ABILITY_SCORES + 1             // may be skipped
  const STEP_BACKGROUND     = isSpellcaster ? STEP_SPELLS + 1 : STEP_ABILITY_SCORES + 1
  const STEP_BG_SETUP       = STEP_BACKGROUND + 1
  const STEP_ALIGNMENT      = STEP_BACKGROUND + 2
  const TOTAL_STEPS         = STEP_BACKGROUND + 3

  const finish = async () => {
    setCreating(true)
    setError(null)
    try {
      const character = buildCharacter({
        user, name,
        raceData, subraceData, classData, subclassChoice, backgroundData, alignment,
        rulesEdition,
        baseAbilityScores: abilityScores,
        startingCantrips,
        startingBonusCantrips,
        startingSpells,
        equipmentCatalog,
        choices: {
          raceBonusOptions,
          classSkills,
          classTools,
          classEquipment: classEquipment.filter(e => !e.index.startsWith('__')),
          classFeatureChoices,
          backgroundLanguages,
          backgroundTools,
          backgroundEquipment: backgroundEquipment.filter(e => !e.index.startsWith('__')),
          backgroundFeature: backgroundData?.feature ?? null,
          racialOptionChoices,
          racialFeat,
          racialFeatAbility,
          racialLanguages: racialOptionChoices.racialLanguages ?? [],
          racialSkills: racialOptionChoices.racialSkills ?? [],
          racialTools: racialOptionChoices.racialTools ?? [],
        },
      })
      await onComplete(character)
    } catch (err) {
      setError(err.message)
      setCreating(false)
    }
  }

  const goTo = (s) => { setError(null); setStep(s) }

  const selectRulesEdition = (value) => {
    setRulesEdition(normalizeAvailableRulesEdition(value))
    setRaceData(null)
    setSubraceData(null)
    setRaceBonusOptions([])
    setRacialOptionChoices({})
    setRacialFeat(null)
    setRacialFeatAbility(null)
    setClassData(null)
    setSubclassChoice(null)
    setClassSkills([])
    setClassTools([])
    setClassEquipment([])
    setClassFeatureChoices([])
    setStartingCantrips([])
    setStartingBonusCantrips([])
    setStartingSpells([])
    setBackgroundData(null)
    setBackgroundLanguages([])
    setBackgroundTools([])
    setBackgroundEquipment([])
  }

  // When race changes, reset downstream
  const selectRace = (r) => {
    setRaceData(r)
    setSubraceData(null)
    setRaceBonusOptions([])
    setRacialOptionChoices({})
    setRacialFeat(null)
    setRacialFeatAbility(null)
  }

  // When class changes, reset downstream
  const selectClass = (c) => {
    setClassData(c)
    setSubclassChoice(null)
    setClassSkills([])
    setClassTools([])
    setClassEquipment([])
    setClassFeatureChoices([])
    setStartingCantrips([])
    setStartingBonusCantrips([])
    setStartingSpells([])
  }

  const selectSubrace = (s) => {
    setSubraceData(s)
    setRaceBonusOptions([])
    setRacialOptionChoices({})
    setRacialFeat(null)
    setRacialFeatAbility(null)
  }

  const selectRacialFeat = (feat) => {
    setRacialFeat(feat)
    setRacialFeatAbility(null)
  }

  // When background changes, reset downstream
  const selectBackground = (b) => {
    setBackgroundData(b)
    setBackgroundLanguages([])
    setBackgroundTools([])
    setBackgroundEquipment([])
  }

  return (
    <div style={S.shell}>
      <div style={S.panel}>
        <ProgressBar step={step} totalSteps={TOTAL_STEPS} />

        {step === STEP_EDITION && (
          <StepEdition
            selected={rulesEdition}
            onSelect={selectRulesEdition}
            onNext={() => goTo(STEP_NAME)}
            onCancel={onCancel}
          />
        )}

        {step === STEP_NAME && (
          <StepName value={name} onChange={setName} onNext={() => goTo(STEP_RACE)} onCancel={() => goTo(STEP_EDITION)} cancelLabel="← Back" />
        )}

        {step === STEP_RACE && (
          <StepRace
            races={races}
            selected={raceData}
            loading={contentLoading.races}
            onSelect={selectRace}
            onNext={() => goTo(hasSubrace ? STEP_SUBRACE : hasRacialOptions ? STEP_RACE_OPTIONS : STEP_CLASS)}
            onBack={() => goTo(STEP_NAME)}
          />
        )}

        {step === STEP_SUBRACE && hasSubrace && (
          <StepSubrace
            race={raceData}
            subraces={allSubraces}
            selected={subraceData}
            onSelect={selectSubrace}
            bonusOptions={raceBonusOptions}
            onBonusOptions={setRaceBonusOptions}
            selectedFeat={racialFeat}
            onFeatChange={selectRacialFeat}
            selectedFeatAbility={racialFeatAbility}
            onFeatAbilityChange={setRacialFeatAbility}
            baseAbilityScores={abilityScores}
            onNext={() => goTo(hasRacialOptions ? STEP_RACE_OPTIONS : STEP_CLASS)}
            onBack={() => goTo(STEP_RACE)}
          />
        )}

        {step === STEP_RACE_OPTIONS && hasRacialOptions && (
          <StepRacialOptions
            raceData={raceData}
            subraceData={subraceData}
            selectedOptions={racialOptionChoices}
            onOptionsChange={setRacialOptionChoices}
            onNext={() => goTo(STEP_CLASS)}
            onBack={() => goTo(hasSubrace ? STEP_SUBRACE : STEP_RACE)}
          />
        )}

        {step === STEP_CLASS && (
          <StepClass
            classes={classes}
            selected={classData}
            onSelect={selectClass}
            onNext={() => goTo(hasSubclassAtCreation ? STEP_SUBCLASS : STEP_CLASS_SETUP)}
            onBack={() => goTo(hasRacialOptions ? STEP_RACE_OPTIONS : hasSubrace ? STEP_SUBRACE : STEP_RACE)}
          />
        )}

        {step === STEP_SUBCLASS && classData && hasSubclassAtCreation && (
          <StepSubclass
            classData={classData}
            selected={subclassChoice}
            onSelect={setSubclassChoice}
            onNext={() => goTo(STEP_CLASS_SETUP)}
            onBack={() => goTo(STEP_CLASS)}
          />
        )}

        {step === STEP_CLASS_SETUP && classData && (
          <StepClassSetup
            classData={classData}
            subclassChoice={subclassChoice}
            selectedSkills={classSkills}
            onSkillsChange={setClassSkills}
            selectedTools={classTools}
            onToolsChange={setClassTools}
            selectedEquipment={classEquipment}
            onEquipmentChange={setClassEquipment}
            selectedFeatureChoices={classFeatureChoices}
            onFeatureChoicesChange={setClassFeatureChoices}
            onNext={() => goTo(STEP_ABILITY_SCORES)}
            onBack={() => goTo(hasSubclassAtCreation ? STEP_SUBCLASS : STEP_CLASS)}
          />
        )}

        {step === STEP_ABILITY_SCORES && (
          <StepAbilityScores
            raceData={raceData}
            subraceData={subraceData}
            raceBonusOptions={raceBonusOptions}
            onChange={setAbilityScores}
            onNext={() => goTo(isSpellcaster ? STEP_SPELLS : STEP_BACKGROUND)}
            onBack={() => goTo(STEP_CLASS_SETUP)}
          />
        )}

        {step === STEP_SPELLS && classData && isSpellcaster && (
          <StepSpells
            classData={classData}
            subclassChoice={subclassChoice}
            abilityScores={abilityScores}
            raceData={raceData}
            subraceData={subraceData}
            raceBonusOptions={raceBonusOptions}
            selectedCantrips={startingCantrips}
            onCantrips={setStartingCantrips}
            selectedBonusCantrips={startingBonusCantrips}
            onBonusCantrips={setStartingBonusCantrips}
            selectedSpells={startingSpells}
            onSpells={setStartingSpells}
            onNext={() => goTo(STEP_BACKGROUND)}
            onBack={() => goTo(STEP_ABILITY_SCORES)}
          />
        )}

        {step === STEP_BACKGROUND && (
          <StepBackground
            backgrounds={backgrounds}
            selected={backgroundData}
            onSelect={selectBackground}
            onNext={() => goTo(STEP_BG_SETUP)}
            onBack={() => goTo(isSpellcaster ? STEP_SPELLS : STEP_ABILITY_SCORES)}
          />
        )}

        {step === STEP_BG_SETUP && backgroundData && (
          <StepBackgroundSetup
            backgroundData={backgroundData}
            selectedLanguages={backgroundLanguages}
            onLanguagesChange={setBackgroundLanguages}
            selectedTools={backgroundTools}
            onToolsChange={setBackgroundTools}
            selectedEquipment={backgroundEquipment}
            onEquipmentChange={setBackgroundEquipment}
            onNext={() => goTo(STEP_ALIGNMENT)}
            onBack={() => goTo(STEP_BACKGROUND)}
          />
        )}

        {step === STEP_ALIGNMENT && (
          <StepAlignment
            raceData={raceData}
            selected={alignment}
            onSelect={setAlignment}
            onNext={finish}
            onBack={() => goTo(STEP_BG_SETUP)}
            creating={creating}
          />
        )}

        {error && (
          <div style={{ ...S.wrap, flex: '0 0 auto', paddingTop: 0 }}>
            <div style={S.error}>{error}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CreateCharacter

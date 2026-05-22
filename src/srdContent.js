import { canonicalizeAmmoItem } from './itemRules'

const cache = {}

const raceData = import.meta.glob('../ttrpg_resource/5etools_data/races.json', { eager: true, import: 'default' })
const backgroundData = import.meta.glob('../ttrpg_resource/5etools_data/backgrounds.json', { eager: true, import: 'default' })
const itemData = import.meta.glob('../ttrpg_resource/5etools_data/{items-base,items}.json', { eager: true, import: 'default' })
const classData = import.meta.glob('../ttrpg_resource/5etools_data/class/class-*.json', { eager: true, import: 'default' })
const spellData = import.meta.glob('../ttrpg_resource/5etools_data/spells/spells-*.json', { eager: true, import: 'default' })
const monsterData = import.meta.glob('../ttrpg_resource/5etools_data/bestiary/bestiary-*.json', { eager: true, import: 'default' })
const spellLookupData = import.meta.glob('../ttrpg_resource/5etools_data/generated/gendata-spell-source-lookup.json', { eager: true, import: 'default' })
const optionalFeatureData = import.meta.glob('../ttrpg_resource/5etools_data/optionalfeatures.json', { eager: true, import: 'default' })

const ABILITY_NAMES = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
}

const SKILL_NAMES = {
  acrobatics: 'Acrobatics',
  'animal handling': 'Animal Handling',
  arcana: 'Arcana',
  athletics: 'Athletics',
  deception: 'Deception',
  history: 'History',
  insight: 'Insight',
  intimidation: 'Intimidation',
  investigation: 'Investigation',
  medicine: 'Medicine',
  nature: 'Nature',
  perception: 'Perception',
  performance: 'Performance',
  persuasion: 'Persuasion',
  religion: 'Religion',
  'sleight of hand': 'Sleight of Hand',
  stealth: 'Stealth',
  survival: 'Survival',
}

const TOOL_CHOICE_POOLS = {
  anyGamingSet: ['Dice set', 'Dragonchess set', 'Playing card set', 'Three-Dragon Ante set'],
  anyMusicalInstrument: ['Bagpipes', 'Drum', 'Dulcimer', 'Flute', 'Lute', 'Lyre', 'Horn', 'Pan flute', 'Shawm', 'Viol'],
  anyArtisansTool: [
    "Alchemist's supplies",
    "Brewer's supplies",
    "Calligrapher's supplies",
    "Carpenter's tools",
    "Cartographer's tools",
    "Cobbler's tools",
    "Cook's utensils",
    "Glassblower's tools",
    "Jeweler's tools",
    "Leatherworker's tools",
    "Mason's tools",
    "Painter's supplies",
    "Potter's tools",
    "Smith's tools",
    "Tinker's tools",
    "Weaver's tools",
    "Woodcarver's tools",
  ],
}

const SCHOOL_NAMES = {
  A: 'Abjuration',
  C: 'Conjuration',
  D: 'Divination',
  E: 'Enchantment',
  V: 'Evocation',
  I: 'Illusion',
  N: 'Necromancy',
  T: 'Transmutation',
}

const ITEM_TYPES = {
  '$': 'Treasure',
  A: 'Ammunition',
  AF: 'Ammunition',
  AT: 'Adventuring Gear',
  EXP: 'Explosive',
  G: 'Adventuring Gear',
  GS: 'Gaming Set',
  HA: 'Heavy Armor',
  INS: 'Instrument',
  LA: 'Light Armor',
  M: 'Melee Weapon',
  MA: 'Medium Armor',
  MELEE: 'Melee Weapon',
  P: 'Potion',
  R: 'Ranged Weapon',
  RD: 'Rod',
  RING: 'Ring',
  S: 'Shield',
  SC: 'Scroll',
  SCF: 'Spellcasting Focus',
  T: 'Tool',
  TG: 'Trade Good',
  VEH: 'Vehicle',
  WD: 'Wand',
  WND: 'Wondrous Item',
}

const DAMAGE_TYPES = {
  A: 'acid',
  B: 'bludgeoning',
  C: 'cold',
  F: 'fire',
  L: 'lightning',
  N: 'necrotic',
  P: 'piercing',
  R: 'radiant',
  S: 'slashing',
  T: 'thunder',
}

const ITEM_PROPERTIES = {
  A: 'Ammunition',
  F: 'Finesse',
  H: 'Heavy',
  L: 'Light',
  LD: 'Loading',
  R: 'Reach',
  T: 'Thrown',
  '2H': 'Two-Handed',
  V: 'Versatile',
}

function firstModule(globResult) {
  return Object.values(globResult)[0] ?? {}
}

function fromModules(globResult, key) {
  return Object.values(globResult).flatMap(module => module?.[key] ?? [])
}

function memo(key, build) {
  if (!cache[key]) cache[key] = Promise.resolve().then(build)
  return cache[key]
}

function slug(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function stripTags(value) {
  if (value == null) return ''
  if (Array.isArray(value)) return value.map(stripTags).filter(Boolean).join(' ')
  if (typeof value === 'object') return stripTags(value.entries ?? value.entry ?? value.items ?? value.name ?? '')
  return String(value)
    .replace(/{@(?:[a-zA-Z]+) ([^}|]+)(?:\|[^}]*)?}/g, '$1')
    .replace(/{@(?:dice|damage|hit|dc) ([^}]+)}/g, '$1')
    .replace(/{@h}/g, 'Hit: ')
}

function ref(indexOrName) {
  const name = stripTags(indexOrName)
  return { index: slug(name), name }
}

function abilityRef(ability) {
  return { index: ability, name: ABILITY_NAMES[ability] ?? ability.toUpperCase() }
}

function normalizeAbilityBonuses(ability = []) {
  const bonuses = []
  const choices = []
  for (const block of ability) {
    for (const ability of Object.keys(ABILITY_NAMES)) {
      if (typeof block?.[ability] === 'number') {
        bonuses.push({ ability_score: abilityRef(ability), bonus: block[ability] })
      }
    }
    const choose = block?.choose
    const from = choose?.from ?? choose?.weighted?.from
    const weights = choose?.weighted?.weights
    const count = choose?.count ?? (weights ? weights.length : 1)
    if (Array.isArray(from)) {
      choices.push({
        choose: count,
        from: {
          options: from.map(ability => ({
            ability_score: abilityRef(ability),
            bonus: weights?.[0] ?? 1,
          })),
        },
      })
    }
  }
  return { bonuses, choice: choices[0] }
}

function totalAbilityBonus(bonuses = []) {
  return bonuses.reduce((sum, bonus) => sum + Math.abs(bonus.bonus ?? 0), 0)
}

function normalizeSpeed(speed) {
  if (typeof speed === 'number') return speed
  if (typeof speed?.walk === 'number') return speed.walk
  if (typeof speed?.walk === 'object') return speed.walk.number ?? 30
  return 30
}

function normalizeSize(size) {
  const value = Array.isArray(size) ? size[0] : size
  return { S: 'Small', M: 'Medium', L: 'Large' }[value] ?? 'Medium'
}

function normalizeEntriesToTraits(entries = []) {
  return entries
    .filter(entry => entry?.name)
    .map(entry => ({ index: slug(entry.name), name: entry.name, desc: [stripTags(entry.entries)] }))
}

function normalizeMonsterAc(ac) {
  const firstAc = Array.isArray(ac) ? ac[0] : ac
  if (firstAc == null) return null
  if (typeof firstAc === 'number' || typeof firstAc === 'string') return firstAc
  if (typeof firstAc?.ac === 'number' || typeof firstAc?.ac === 'string') return firstAc.ac
  if (firstAc?.special) return stripTags(firstAc.special)
  return stripTags(firstAc)
}

function normalizeMonsterType(type) {
  if (type == null) return null
  if (typeof type === 'string') return type
  return stripTags(type.type ?? type)
}

function normalizeMonsterCr(cr) {
  if (cr == null) return null
  if (typeof cr === 'number' || typeof cr === 'string') return cr
  if (cr.cr != null) return cr.cr
  return stripTags(cr)
}

function normalizeMonsterCrDetail(cr) {
  if (cr == null || typeof cr !== 'object') return null
  const details = []
  if (cr.lair != null) details.push(`lair ${cr.lair}`)
  if (cr.coven != null) details.push(`coven ${cr.coven}`)
  return details.length ? details.join(', ') : null
}

function draconicAncestryOptions(entries = []) {
  const ancestry = entries.find(entry => /(draconic|chromatic|gem|metallic) ancestry/i.test(entry?.name ?? ''))
  const table = ancestry?.entries?.find(entry => entry?.type === 'table' && Array.isArray(entry.rows))
  if (!table) return null
  const labels = table.colLabels ?? []
  const damageIndex = labels.findIndex(label => /damage/i.test(label))
  const breathIndex = labels.findIndex(label => /breath/i.test(label))
  const breathTrait = entries.find(entry => /^breath weapon$/i.test(entry?.name ?? ''))
  const breathText = stripTags(breathTrait?.entries ?? '')
  const breathShape = breathText.match(/(\d+)[-\s]foot (cone|line)/i)
  const fallbackBreathWeapon = breathShape ? `${breathShape[1]} ft. ${breathShape[2].toLowerCase()}` : '15 ft. cone or 30 ft. line'
  const fallbackSave = /constitution saving throw/i.test(breathText) ? 'Constitution' : 'Dexterity'
  const grantsResistance = entries.some(entry => /(damage|draconic) resistance/i.test(entry?.name ?? ''))
  return {
    id: 'draconic-ancestry',
    name: ancestry.name ?? 'Draconic Ancestry',
    desc: 'Choose the dragon ancestry that determines your breath weapon and resistance.',
    choose: 1,
    grantsResistance,
    options: table.rows.map(row => {
      const name = stripTags(row[0])
      const damageType = stripTags(row[damageIndex >= 0 ? damageIndex : 1]).toLowerCase()
      const breathWeapon = breathIndex >= 0 ? stripTags(row[breathIndex]) : fallbackBreathWeapon
      const saveText = breathWeapon.match(/\(([^)]+)\)/)?.[1] ?? 'Dex. save'
      const savingThrow = /con/i.test(saveText) ? 'Constitution' : fallbackSave
      return {
        id: slug(name),
        name,
        damageType,
        breathWeapon,
        savingThrow,
        grantsResistance,
      }
    }),
  }
}

function fixedLanguagesFromProficiencies(languageProficiencies = []) {
  return languageProficiencies.flatMap(group =>
    Object.entries(group ?? {})
      .filter(([key, value]) => value === true && !['any', 'anyStandard', 'other', 'choose'].includes(key))
      .map(([name]) => ref(name))
  )
}

function racialLanguageOptions(languageProficiencies = []) {
  const options = languageProficiencies.flatMap(group => {
    const choose = group?.choose
    if (choose?.from?.length) {
      return [{ choose: choose.count ?? 1, options: choose.from.map(name => ref(name)), desc: 'Choose a racial language' }]
    }
    const count = (group?.anyStandard ?? 0) + (group?.other === true ? 1 : 0)
    return count > 0 ? [{ choose: count, options: null, desc: 'Choose a racial language' }] : []
  })
  return options.length ? options : null
}

function racialSkillOptions(skillProficiencies = []) {
  const options = skillProficiencies.flatMap(group => {
    const choose = group?.choose
    if (choose?.from?.length) {
      return [{ choose: choose.count ?? 1, options: choose.from.map(skill => skillRef(skill)), desc: 'Choose racial skills' }]
    }
    if (group?.any) return [{ choose: group.any, options: null, desc: 'Choose racial skills' }]
    return []
  })
  return options.length ? options : null
}

function racialToolOptions(toolProficiencies = []) {
  return toolChoiceOptions(toolProficiencies, 'Choose a racial tool proficiency')
}

function classToolOptions(startingProficiencies = {}) {
  const toolProficiencies = startingProficiencies.toolProficiencies ?? []
  const toolText = stripTags(startingProficiencies.tools ?? []).toLowerCase()
  if (/\bor\b/.test(toolText) && toolProficiencies.length > 1) {
    const options = toolProficiencies.flatMap(group =>
      Object.entries(group ?? {})
        .filter(([key, count]) => TOOL_CHOICE_POOLS[key] && Number(count) > 0)
        .flatMap(([key]) => toolOptionsFromKey(key))
    )
    if (options.length) {
      return [{
        choose: 1,
        options: options.filter((option, index, list) => list.findIndex(other => other.index === option.index) === index),
        desc: 'Choose a class tool proficiency',
      }]
    }
  }
  return toolChoiceOptions(toolProficiencies, 'Choose a class tool proficiency')
}

function normalizeRace(race) {
  const { bonuses, choice } = normalizeAbilityBonuses(race.ability)
  const racialOptions = [draconicAncestryOptions(race.entries)].filter(Boolean)
  const fixedProficiencies = [
    ...proficienciesFromObject(race.skillProficiencies?.[0] ?? {}),
    ...fixedToolProficiencies(race.toolProficiencies),
  ]
  return {
    index: slug(race.name),
    name: race.name,
    source: race.source,
    edition: race.edition,
    speed: normalizeSpeed(race.speed),
    size: normalizeSize(race.size),
    ability_bonuses: bonuses,
    ...(choice && { ability_bonus_options: choice }),
    alignment: stripTags(race.entries?.find(e => e?.name === 'Alignment')?.entries),
    languages: fixedLanguagesFromProficiencies(race.languageProficiencies),
    starting_proficiencies: fixedProficiencies,
    racial_language_options: racialLanguageOptions(race.languageProficiencies),
    racial_skill_options: racialSkillOptions(race.skillProficiencies),
    racial_tool_options: racialToolOptions(race.toolProficiencies),
    traits: normalizeEntriesToTraits(race.entries),
    racial_options: racialOptions,
    subraces: [],
  }
}

function normalizeSubrace(subrace) {
  const raceName = subrace.raceName ?? subrace._baseName
  if (!raceName) return null
  const { bonuses, choice } = normalizeAbilityBonuses(subrace.ability)
  const isBaseRaceOption = !subrace.name
  const racialOptions = [draconicAncestryOptions(subrace.entries)].filter(Boolean)
  const fixedProficiencies = [
    ...proficienciesFromObject(subrace.skillProficiencies?.[0] ?? {}),
    ...fixedToolProficiencies(subrace.toolProficiencies),
  ]
  return {
    index: isBaseRaceOption ? `${slug(raceName)}-base-${slug(subrace.source)}` : slug(`${raceName ?? ''} ${subrace.name}`),
    name: isBaseRaceOption ? `${subrace.source ?? 'Base'} / Base-Only` : subrace.name,
    source: subrace.source,
    edition: subrace.edition,
    race: ref(raceName),
    isBaseRaceOption,
    ability_bonuses: bonuses,
    ...(choice && { ability_bonus_options: choice }),
    racial_traits: normalizeEntriesToTraits(subrace.entries),
    languages: fixedLanguagesFromProficiencies(subrace.languageProficiencies),
    starting_proficiencies: fixedProficiencies,
    racial_language_options: racialLanguageOptions(subrace.languageProficiencies),
    racial_skill_options: racialSkillOptions(subrace.skillProficiencies),
    racial_tool_options: racialToolOptions(subrace.toolProficiencies),
    racial_options: racialOptions,
  }
}

function markSubraceAbilityModes(subraces = [], races = []) {
  const raceByIndex = Object.fromEntries(races.map(race => [race.index, race]))
  return subraces.map(subrace => {
    const race = raceByIndex[subrace.race?.index]
    const baseTotal = totalAbilityBonus(race?.ability_bonuses)
    const subraceTotal = totalAbilityBonus(subrace.ability_bonuses)
    const abilityOverridesRace = !subrace.isBaseRaceOption
      && subrace.source !== race?.source
      && baseTotal > 0
      && subraceTotal >= baseTotal
    return { ...subrace, abilityOverridesRace }
  })
}

function skillRef(skill) {
  const key = String(skill).toLowerCase()
  const name = SKILL_NAMES[key] ?? stripTags(skill)
  return { index: `skill-${slug(name)}`, name: `Skill: ${name}` }
}

function allSkillRefs() {
  return Object.keys(SKILL_NAMES).map(skillRef)
}

function toolRef(tool) {
  const name = stripTags(tool)
  return { index: slug(name), name }
}

function toolOptionsFromKey(tool) {
  const pool = TOOL_CHOICE_POOLS[tool]
  return (pool ?? [tool]).map(toolRef)
}

function fixedToolProficiencies(toolProficiencies = []) {
  return toolProficiencies.flatMap(group =>
    Object.entries(group ?? {})
      .filter(([key, enabled]) => enabled === true && key !== 'choose')
      .flatMap(([tool]) => toolOptionsFromKey(tool))
  )
}

function toolChoiceOptions(toolProficiencies = [], desc = 'Choose a tool proficiency') {
  const options = toolProficiencies.flatMap(group => {
    const choose = group?.choose
    if (choose?.from?.length) {
      return [{
        choose: choose.count ?? 1,
        options: choose.from.flatMap(toolOptionsFromKey),
        desc,
      }]
    }
    if (group?.any) {
      return [{
        choose: group.any,
        options: Object.keys(TOOL_CHOICE_POOLS).flatMap(toolOptionsFromKey),
        desc,
      }]
    }

    return Object.entries(group ?? {})
      .filter(([key, count]) => TOOL_CHOICE_POOLS[key] && Number(count) > 0)
      .map(([key, count]) => ({
        choose: Number(count),
        options: toolOptionsFromKey(key),
        desc,
      }))
  })
  return options.length ? options : null
}

function proficienciesFromObject(value = {}) {
  return Object.entries(value)
    .filter(([, enabled]) => enabled === true)
    .map(([name]) => skillRef(name))
}

function optionalFeatureLookup() {
  const lookup = {}
  for (const feature of fromModules(optionalFeatureData, 'optionalfeature')) {
    lookup[slug(feature.name)] ??= feature
    lookup[slug(`${feature.name} ${feature.source ?? ''}`)] = feature
  }
  return lookup
}

function parseFeatureRef(refValue = '') {
  const [name, source] = String(refValue).split('|')
  return { name: stripTags(name), source }
}

function inferChoiceCount(entries = []) {
  const text = stripTags(entries).toLowerCase()
  if (/\b(two|2)\b/.test(text) && /\b(choice|choose|options?|invocations?|metamagic|enemy|enemies|terrain)\b/.test(text)) return 2
  if (/\b(one|1|an additional|additional)\b/.test(text) && /\b(choice|choose|options?|invocation|metamagic|enemy|terrain)\b/.test(text)) return 1
  return null
}

function optionFeatureArray(optionalFeatures = {}) {
  return Object.values(optionalFeatures)
    .filter(Boolean)
    .filter((feature, index, arr) => arr.findIndex(other => other.name === feature.name && other.source === feature.source) === index)
}

function meetsOptionalFeatureLevel(feature, level) {
  if (!level) return true
  return (feature.prerequisite ?? []).every(prereq => {
    const requiredLevel = prereq?.level?.level
    return !requiredLevel || requiredLevel <= level
  })
}

function optionalFeaturesForType(optionalFeatures, type, level) {
  return optionFeatureArray(optionalFeatures)
    .filter(feature => (feature.featureType ?? []).includes(type))
    .filter(feature => meetsOptionalFeatureLevel(feature, level))
    .map(feature => ({
      id: slug(`${feature.name} ${feature.source ?? ''}`),
      name: feature.name,
      source: feature.source,
      optionType: 'optionalFeature',
      desc: [stripTags(feature.entries)].filter(Boolean),
      featureType: feature.featureType,
    }))
}

function manualFeatureChoices(feature, optionalFeatures = {}) {
  const name = feature.name ?? ''
  const lowerName = name.toLowerCase()
  const choices = []

  if (/blessings of knowledge/i.test(lowerName)) {
    choices.push({
      type: 'option',
      choose: 2,
      choiceIndex: 200,
      options: ['Celestial', 'Draconic', 'Deep Speech', 'Infernal', 'Primordial', 'Sylvan', 'Undercommon']
        .map(option => ({ id: slug(option), name: option, optionType: 'manual', desc: [], featureType: ['LANGUAGE'] })),
    })
    choices.push({
      type: 'option',
      choose: 2,
      choiceIndex: 201,
      options: ['Arcana', 'History', 'Nature', 'Religion']
        .map(option => ({ id: `skill-${slug(option)}`, name: `Skill: ${option}`, optionType: 'manual', desc: [], featureType: ['SKILL', 'EXPERTISE'] })),
    })
  }

  if (/dragon ancestor/i.test(lowerName)) {
    const dragons = [
      ['Black', 'Acid'], ['Blue', 'Lightning'], ['Brass', 'Fire'], ['Bronze', 'Lightning'], ['Copper', 'Acid'],
      ['Gold', 'Fire'], ['Green', 'Poison'], ['Red', 'Fire'], ['Silver', 'Cold'], ['White', 'Cold'],
    ]
    choices.push({
      type: 'option',
      choose: 1,
      choiceIndex: 202,
      options: dragons.map(([dragon, damageType]) => ({
        id: slug(dragon),
        name: dragon,
        damageType: damageType.toLowerCase(),
        optionType: 'manual',
        desc: [`${damageType} damage`],
        featureType: ['SORCERER:DRACONIC_ANCESTRY'],
      })),
    })
  }

  if (/acolyte of nature/i.test(lowerName)) {
    choices.push({
      type: 'option',
      choose: 1,
      choiceIndex: 203,
      options: ['Animal Handling', 'Nature', 'Survival']
        .map(option => ({ id: `skill-${slug(option)}`, name: `Skill: ${option}`, optionType: 'manual', desc: [], featureType: ['SKILL'] })),
    })
  }

  if (/^circle spells$/i.test(name) && /land/i.test(feature.subclassShortName ?? '')) {
    choices.push({
      type: 'option',
      choose: 1,
      choiceIndex: 204,
      options: ['Arctic', 'Coast', 'Desert', 'Forest', 'Grassland', 'Mountain', 'Swamp', 'Underdark']
        .map(option => ({ id: slug(option), name: option, optionType: 'manual', desc: [], featureType: ['DRUID:LAND_TERRAIN'] })),
    })
  }

  if (/^expertise$/i.test(name) && /rogue/i.test(feature.className ?? '')) {
    choices.push({
      type: 'option',
      choose: 2,
      choiceIndex: 107,
      options: [
        'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception', 'History',
        'Insight', 'Intimidation', 'Investigation', 'Medicine', 'Nature', 'Perception',
        'Performance', 'Persuasion', 'Religion', 'Sleight of Hand', 'Stealth', 'Survival',
      ].map(option => ({
        id: `skill-${slug(option)}`,
        name: `Skill: ${option}`,
        optionType: 'manual',
        desc: ['Double your proficiency bonus for checks with this skill if proficient.'],
        featureType: ['EXPERTISE'],
      })).concat({
        id: 'thieves-tools',
        name: "Thieves' Tools",
        optionType: 'manual',
        desc: ["Double your proficiency bonus for checks with thieves' tools."],
        featureType: ['EXPERTISE', 'TOOL'],
      }),
    })
  }

  if (/^combat superiority$/i.test(name) && /battle master/i.test(feature.subclassShortName ?? '')) {
    choices.push({
      type: 'option',
      choose: 3,
      choiceIndex: 108,
      options: optionalFeaturesForType(optionalFeatures, 'MV:B', feature.level),
    })
  }

  if (/^student of war$/i.test(name) && /battle master/i.test(feature.subclassShortName ?? '')) {
    choices.push({
      type: 'option',
      choose: 1,
      choiceIndex: 109,
      options: toolOptionsFromKey('anyArtisansTool').map(option => ({
        id: option.index,
        name: option.name,
        optionType: 'manual',
        desc: [],
        featureType: ['TOOL'],
      })),
    })
  }

  if (/^favored enemy/i.test(name)) {
    choices.push({
      type: 'option',
      choose: 1,
      choiceIndex: 100,
      options: [
        'Aberrations', 'Beasts', 'Celestials', 'Constructs', 'Dragons', 'Elementals',
        'Fey', 'Fiends', 'Giants', 'Monstrosities', 'Oozes', 'Plants', 'Undead',
        'Two humanoid races',
      ].map(option => ({ id: slug(option), name: option, optionType: 'manual', desc: [], featureType: ['RANGER:FAVORED_ENEMY'] })),
    })
    choices.push({
      type: 'option',
      choose: 1,
      choiceIndex: 106,
      options: [
        'Abyssal', 'Celestial', 'Draconic', 'Deep Speech', 'Dwarvish', 'Elvish', 'Giant',
        'Gnomish', 'Goblin', 'Halfling', 'Infernal', 'Orc', 'Primordial', 'Sylvan', 'Undercommon',
      ].map(option => ({
        id: slug(option),
        name: option,
        optionType: 'manual',
        desc: ['Language associated with your favored enemy, if they speak one.'],
        featureType: ['LANGUAGE', 'RANGER:FAVORED_ENEMY_LANGUAGE'],
      })),
    })
  }

  if (/natural explorer/i.test(lowerName)) {
    choices.push({
      type: 'option',
      choose: 1,
      choiceIndex: 101,
      options: ['Arctic', 'Coast', 'Desert', 'Forest', 'Grassland', 'Mountain', 'Swamp', 'Underdark']
        .map(option => ({ id: slug(option), name: option, optionType: 'manual', desc: [], featureType: ['RANGER:NATURAL_EXPLORER'] })),
    })
  }

  if (/eldritch invocations/i.test(lowerName)) {
    choices.push({
      type: 'option',
      choose: feature.level <= 2 ? 2 : 1,
      choiceIndex: 102,
      options: optionalFeaturesForType(optionalFeatures, 'EI', feature.level),
    })
  }

  if (/^metamagic$/i.test(name) && !feature.entries?.some(entry => entry?.type === 'options')) {
    choices.push({
      type: 'option',
      choose: /XPHB/i.test(feature.source ?? '') ? 2 : 1,
      choiceIndex: 103,
      options: optionalFeaturesForType(optionalFeatures, 'MM', feature.level),
    })
  }

  if (/additional maneuvers/i.test(lowerName)) {
    choices.push({
      type: 'option',
      choose: 2,
      choiceIndex: 104,
      options: optionalFeaturesForType(optionalFeatures, 'MV:B', feature.level),
    })
  }

  if (/additional fighting style/i.test(lowerName)) {
    choices.push({
      type: 'option',
      choose: 1,
      choiceIndex: 105,
      options: optionalFeaturesForType(optionalFeatures, 'FS:F', feature.level),
    })
  }

  if (/^elemental disciplines$/i.test(name) && /four elements/i.test(feature.subclassShortName ?? '')) {
    const elementalAttunement = optionalFeaturesForType(optionalFeatures, 'ED', feature.level)
      .find(option => /^elemental attunement$/i.test(option.name))
    choices.push({
      type: 'option',
      choose: 1,
      choiceIndex: 110,
      ...(elementalAttunement && feature.level === 3 ? { autoOptions: [elementalAttunement] } : {}),
      options: optionalFeaturesForType(optionalFeatures, 'ED', feature.level)
        .filter(option => !/^elemental attunement$/i.test(option.name)),
    })
  }

  if (/^extra elemental discipline$/i.test(name) && /four elements/i.test(feature.subclassShortName ?? '')) {
    choices.push({
      type: 'option',
      choose: 1,
      choiceIndex: 111,
      options: optionalFeaturesForType(optionalFeatures, 'ED', feature.level)
        .filter(option => !/^elemental attunement$/i.test(option.name)),
    })
  }

  return choices.filter(choice => choice.options.length > 0)
}

function shouldSkipNormalizedChoices(feature) {
  return /^elemental disciplines$/i.test(feature.name ?? '') && /four elements/i.test(feature.subclassShortName ?? '')
}

function normalizeFeatureChoices(feature, optionalFeatures = {}) {
  const entries = feature.entries ?? []
  return entries
    .filter(entry => entry?.type === 'options' && Array.isArray(entry.entries))
    .map((entry, choiceIndex) => {
      const choose = entry.count ?? inferChoiceCount(entries)
      if (!choose) return null
      return {
        type: 'option',
        choose,
        choiceIndex,
        options: entry.entries.map((option, optionIndex) => {
        const refValue = option.optionalfeature ?? option.classFeature ?? option.subclassFeature ?? option.name
        const { name, source } = parseFeatureRef(refValue)
        const optional = optionalFeatures[slug(`${name} ${source ?? ''}`)] ?? optionalFeatures[slug(name)]
        return {
          id: slug(`${name} ${source ?? ''}`) || `option-${optionIndex}`,
          name,
          source: source ?? optional?.source,
          optionType: option.type,
          desc: [stripTags(optional?.entries ?? option.entries ?? option.entry ?? '')].filter(Boolean),
          featureType: optional?.featureType,
        }
        }).filter(option => option.name),
      }
    })
    .filter(Boolean)
    .filter(choice => choice.options.length > 0)
}

function normalizeClassFeature(feature, optionalFeatures = {}) {
  const choices = [
    ...(shouldSkipNormalizedChoices(feature) ? [] : normalizeFeatureChoices(feature, optionalFeatures)),
    ...manualFeatureChoices(feature, optionalFeatures),
  ]
  return {
    index: slug(`${feature.className ?? ''} ${feature.level ?? ''} ${feature.name}`),
    name: feature.name,
    source: feature.source,
    className: feature.className,
    level: feature.level,
    desc: [stripTags(feature.entries)],
    choices,
  }
}

function normalizeSubclassFeature(feature, optionalFeatures = {}) {
  const choices = [
    ...(shouldSkipNormalizedChoices(feature) ? [] : normalizeFeatureChoices(feature, optionalFeatures)),
    ...manualFeatureChoices(feature, optionalFeatures),
  ]
  return {
    index: slug(`${feature.className ?? ''} ${feature.subclassShortName ?? ''} ${feature.level ?? ''} ${feature.name}`),
    name: feature.name,
    source: feature.source,
    className: feature.className,
    classIndex: slug(feature.className),
    subclassName: feature.subclassShortName,
    subclassSource: feature.subclassSource,
    level: feature.level,
    desc: [stripTags(feature.entries)],
    choices,
  }
}

function normalizeClass(cls, module = {}, rulesEdition = '2014') {
  const optionalFeatures = optionalFeatureLookup()
  const skillChoiceGroup = cls.startingProficiencies?.skills?.find(s => s.choose || s.any)
  const skillChoice = skillChoiceGroup?.choose
  const skillCount = skillChoice?.count ?? skillChoiceGroup?.any ?? 0
  const skillPool = skillChoice?.from?.length ? skillChoice.from.map(skillRef) : skillChoiceGroup?.any ? allSkillRefs() : []
  const skillOptions = skillPool.map(item => ({ option_type: 'reference', item }))
  const armor = (cls.startingProficiencies?.armor ?? []).map(item => ref(`${stripTags(item.full ?? item.proficiency ?? item)} armor proficiency`))
  const weapons = (cls.startingProficiencies?.weapons ?? []).map(item => ref(`${stripTags(item.full ?? item.proficiency ?? item)} weapon proficiency`))
  const tools = fixedToolProficiencies(cls.startingProficiencies?.toolProficiencies)
  const features = (module.classFeature ?? [])
    .filter(feature => feature.className === cls.name && (!feature.classSource || feature.classSource === cls.source))
    .map(feature => normalizeClassFeature(feature, optionalFeatures))
  const featuresByLevel = features.reduce((byLevel, feature) => {
    const level = String(feature.level ?? 1)
    byLevel[level] = [...(byLevel[level] ?? []), feature]
    return byLevel
  }, {})
  const subclasses = dedupeByIndex((module.subclass ?? [])
    .filter(subclass => subclass.className === cls.name && (!subclass.classSource || subclass.classSource === cls.source))
    .filter(subclass => matchesRulesEdition(subclass, rulesEdition))
    .map(subclass => {
      const subclassFeatures = (module.subclassFeature ?? [])
        .filter(feature =>
          feature.className === cls.name &&
          feature.subclassShortName === (subclass.shortName ?? subclass.name) &&
          (!feature.subclassSource || !subclass.source || feature.subclassSource === subclass.source)
        )
        .map(feature => normalizeSubclassFeature(feature, optionalFeatures))
      const featuresByLevel = subclassFeatures.reduce((byLevel, feature) => {
        const level = String(feature.level ?? 1)
        byLevel[level] = [...(byLevel[level] ?? []), feature]
        return byLevel
      }, {})
      return {
        index: slug(subclass.shortName ?? subclass.name),
        name: subclass.shortName ?? subclass.name,
        fullName: subclass.name,
        source: subclass.source,
        additionalSpells: subclass.additionalSpells ?? [],
        features_by_level: featuresByLevel,
      }
    }), cls.source)
  return {
    index: slug(cls.name),
    name: cls.name,
    source: cls.source,
    edition: cls.edition,
    hit_die: cls.hd?.faces ?? 8,
    saving_throws: (cls.proficiency ?? []).map(abilityRef),
    proficiencies: [
      ...(cls.proficiency ?? []).map(a => ({ index: `saving-throw-${a}`, name: `Saving Throw: ${ABILITY_NAMES[a]}` })),
      ...armor,
      ...weapons,
      ...tools,
    ],
    class_tool_options: classToolOptions(cls.startingProficiencies),
    proficiency_choices: skillOptions.length ? [{
      type: 'proficiencies',
      choose: skillCount || 2,
      desc: `Choose ${skillCount || 2} skills`,
      from: { options: skillOptions },
    }] : [],
    starting_equipment: [],
    starting_equipment_options: normalizeStartingEquipment(cls.startingEquipment?.default ?? []),
    features_by_level: featuresByLevel,
    subclasses,
  }
}

function itemRefsFromText(text) {
  const matches = [...String(text).matchAll(/{@item ([^}|]+)(?:\|[^}|]+)?(?:\|([^}]+))?}/g)]
  return matches.map((match, i) => {
    const display = stripTags(match[2] || match[1])
    const prefix = String(text).slice(Math.max(0, match.index - 24), match.index).toLowerCase()
    const wordCount = Object.entries(COUNT_WORDS).find(([word]) => new RegExp(`\\b${word}\\s*$`).test(prefix))?.[1]
    const quantity = Number(display.match(/\b(\d+)\b/)?.[1] ?? wordCount ?? 1)
    const name = display.replace(/^\d+\s+/, '').replace(/\s+\(\d+\)$/g, '')
    const categoryIndex = equipmentCategoryFromText(name)
    if (categoryIndex) {
      return {
        option_type: 'choice',
        choice: {
          choose: quantity,
          desc: stripTags(name),
          from: { equipment_category: { index: categoryIndex } },
        },
      }
    }
    return {
      option_type: 'counted_reference',
      count: quantity,
      of: { index: slug(match[1]) || `item-${i}`, name: stripTags(name) },
    }
  })
}

const EQUIPMENT_FILTER_CATEGORIES = [
  { pattern: /\bsimple melee weapons?\b/i, index: 'simple-melee-weapons' },
  { pattern: /\bsimple ranged weapons?\b/i, index: 'simple-ranged-weapons' },
  { pattern: /\bmartial melee weapons?\b/i, index: 'martial-melee-weapons' },
  { pattern: /\bmartial ranged weapons?\b/i, index: 'martial-ranged-weapons' },
  { pattern: /\bsimple weapons?\b/i, index: 'simple-weapons' },
  { pattern: /\bmartial weapons?\b/i, index: 'martial-weapons' },
  { pattern: /\bmusical instruments?\b/i, index: 'musical-instruments' },
  { pattern: /\barcane focus(?:es)?\b/i, index: 'arcane-focuses' },
  { pattern: /\bdruidic focus(?:es)?\b/i, index: 'druidic-focuses' },
  { pattern: /\bholy symbols?\b/i, index: 'holy-symbols' },
]

const COUNT_WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
}

function choiceCountFromText(text) {
  const clean = stripTags(text).toLowerCase()
  const digit = clean.match(/\b(?:any|choose|a)\s+(\d+)\b/)?.[1]
  if (digit) return Number(digit)
  for (const [word, count] of Object.entries(COUNT_WORDS)) {
    if (new RegExp(`\\b(?:any|choose|a)?\\s*${word}\\b`).test(clean)) return count
  }
  return 1
}

function equipmentCategoryFromText(text) {
  const clean = stripTags(text)
  return EQUIPMENT_FILTER_CATEGORIES.find(category => category.pattern.test(clean))?.index ?? null
}

function normalizeStartingEquipment(lines) {
  return lines.map((line, groupIndex) => {
    const parts = String(line)
      .split(/\s+or\s+(?=\([a-z]\))/i)
      .map(part => part.replace(/^\([a-z]\)\s*/i, '').trim())
      .filter(Boolean)
    const options = (parts.length ? parts : [line]).map((part) => {
      const items = itemRefsFromText(part)
      const categoryIndex = equipmentCategoryFromText(part)
      const hasCategoryChoice = items.some(item =>
        item.option_type === 'choice' &&
        item.choice?.from?.equipment_category?.index === categoryIndex
      )
      if (categoryIndex && !hasCategoryChoice) {
        items.push({
          option_type: 'choice',
          choice: {
            choose: choiceCountFromText(part),
            desc: stripTags(part),
            from: { equipment_category: { index: categoryIndex } },
          },
        })
      }
      if (items.length === 1) return items[0]
      if (items.length > 1) return { option_type: 'multiple', items }
      return {
        option_type: 'choice',
        choice: {
          choose: choiceCountFromText(part),
          desc: stripTags(part),
          from: categoryIndex ? { equipment_category: { index: categoryIndex } } : {},
        },
      }
    })
    return {
      desc: stripTags(line),
      from: { option_set_type: 'options_array', options },
      groupIndex,
    }
  })
}

function cloneData(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function applyEntryMod(entries = [], mod) {
  if (!mod || !Array.isArray(entries)) return entries
  if (Array.isArray(mod)) return mod.reduce((nextEntries, entryMod) => applyEntryMod(nextEntries, entryMod), entries)
  if (mod.mode === 'replaceArr') {
    const replacement = mod.items
    const replace = mod.replace
    const nextEntries = [...entries]
    const targetIndex = typeof replace?.index === 'number'
      ? replace.index
      : nextEntries.findIndex(entry => entry?.name === replace)
    if (targetIndex >= 0) {
      nextEntries.splice(targetIndex, 1, ...(Array.isArray(replacement) ? replacement : [replacement]))
    }
    return nextEntries
  }
  if (mod.mode === 'insertArr') {
    const insertion = Array.isArray(mod.items) ? mod.items : [mod.items]
    const index = Number.isInteger(mod.index) ? mod.index : entries.length
    const nextEntries = [...entries]
    nextEntries.splice(index, 0, ...insertion)
    return nextEntries
  }
  return entries
}

function resolveBackgroundCopies(backgrounds = []) {
  const byKey = new Map(backgrounds.map(background => [`${background.name}|${background.source}`, background]))
  const resolved = new Map()

  const resolveOne = (background, stack = []) => {
    const key = `${background.name}|${background.source}`
    if (resolved.has(key)) return resolved.get(key)
    if (!background._copy) {
      resolved.set(key, background)
      return background
    }

    const copyKey = `${background._copy.name}|${background._copy.source ?? background.source}`
    const base = byKey.get(copyKey)
    if (!base || stack.includes(copyKey)) {
      resolved.set(key, background)
      return background
    }

    const merged = {
      ...cloneData(resolveOne(base, [...stack, key])),
      ...cloneData(background),
      name: background.name,
      source: background.source,
    }
    if (background._copy?._mod?.entries) {
      merged.entries = applyEntryMod(merged.entries, background._copy._mod.entries)
    }
    delete merged._copy
    resolved.set(key, merged)
    return merged
  }

  return backgrounds.map(background => resolveOne(background))
}

function normalizeBackground(background) {
  const skillBlock = background.skillProficiencies?.[0] ?? {}
  const featureEntry = background.entries?.find(entry => /feature/i.test(entry?.name ?? ''))
  return {
    index: slug(background.name),
    name: background.name,
    source: background.source,
    edition: background.edition,
    starting_proficiencies: [
      ...proficienciesFromObject(skillBlock),
      ...fixedToolProficiencies(background.toolProficiencies),
    ],
    starting_equipment: [],
    starting_equipment_options: normalizeBackgroundEquipment(background.startingEquipment ?? []),
    language_options: normalizeLanguageOptions(background.languageProficiencies),
    tool_options: toolChoiceOptions(background.toolProficiencies, 'Choose a background tool proficiency'),
    feature: featureEntry ? { name: featureEntry.name.replace(/^Feature:\s*/i, ''), desc: [stripTags(featureEntry.entries)] } : null,
  }
}

function normalizeBackgroundEquipment(groups) {
  const equipmentTypeName = (type, fallback) => ({
    instrumentMusical: 'musical instrument',
    setGaming: 'gaming set',
    toolArtisan: "artisan's tools",
  }[type] ?? fallback ?? 'custom item')
  const equipmentTypeChoiceKey = (type) => ({
    instrumentMusical: 'anyMusicalInstrument',
    setGaming: 'anyGamingSet',
    toolArtisan: 'anyArtisansTool',
  }[type])

  const normalizeBackgroundItem = (item, i) => {
    if (typeof item === 'string') {
      const [name, source] = item.split('|')
      return {
        option_type: 'counted_reference',
        count: 1,
        of: { index: slug(name) || `item-${i}`, name: stripTags(name), source: source?.toUpperCase() },
      }
    }
    if (item?.item) {
      const [name, source] = item.item.split('|')
      return {
        option_type: 'counted_reference',
        count: item.quantity ?? 1,
        of: { index: slug(name) || `item-${i}`, name: stripTags(name), source: source?.toUpperCase() },
        ...(item.containsValue && { containsValue: item.containsValue }),
      }
    }
    if (item?.special) {
      return {
        option_type: 'counted_reference',
        count: item.quantity ?? 1,
        custom: true,
        of: { index: slug(item.special) || `special-${i}`, name: stripTags(item.special) },
      }
    }
    if (item?.equipmentType) {
      const name = item.displayName ?? equipmentTypeName(item.equipmentType)
      const choiceKey = equipmentTypeChoiceKey(item.equipmentType)
      if (choiceKey) {
        return {
          option_type: 'equipment_type_choice',
          count: item.quantity ?? 1,
          equipmentType: item.equipmentType,
          label: `Choose a ${name}`,
          options: toolOptionsFromKey(choiceKey),
        }
      }
      return {
        option_type: 'counted_reference',
        count: item.quantity ?? 1,
        custom: true,
        of: { index: slug(name) || `equipment-type-${i}`, name: stripTags(name) },
      }
    }
    if (item?.value || item?.containsValue) {
      const copperValue = item.value ?? item.containsValue
      return {
        option_type: 'counted_reference',
        count: 1,
        custom: true,
        containsValue: copperValue,
        of: { index: `${copperValue}-cp`, name: `${copperValue / 100} gp` },
      }
    }
    return null
  }

  return groups.map((group, groupIndex) => {
    const options = Object.entries(group)
      .filter(([, value]) => Array.isArray(value))
      .map(([, value]) => {
        const items = value
          .map(normalizeBackgroundItem)
          .filter(Boolean)
        return items.length > 1 ? { option_type: 'multiple', items } : items[0]
      })
      .filter(Boolean)
    return {
      desc: 'Choose background equipment',
      from: { option_set_type: 'options_array', options },
      groupIndex,
    }
  })
}

function normalizeLanguageOptions(languageProficiencies = []) {
  const choose = languageProficiencies.find(option => option?.choose)?.choose
  if (!choose) return null
  return {
    choose: choose.count ?? 1,
    from: { option_set_type: 'resource_list', resource_list_url: '/api/languages' },
  }
}

function normalizeItem(item, isMagic = false) {
  const typeName = ITEM_TYPES[item.type] ?? (isMagic ? 'Magic Item' : 'Adventuring Gear')
  const damageDice = item.dmg1 || item.dmg2
  const armorBase = item.ac ?? (item.type === 'S' ? 2 : null)
  const weaponCategory = item.weaponCategory
    ? item.weaponCategory[0].toUpperCase() + item.weaponCategory.slice(1)
    : ['M', 'R', 'MELEE'].includes(item.type) ? 'Simple' : undefined
  return {
    index: slug(item.name),
    name: item.name,
    source: item.source,
    equipment_category: { index: slug(typeName), name: typeName },
    equipment_category_index: slug(typeName),
    ...(item.scfType && { scfType: item.scfType }),
    weapon_category: weaponCategory,
    weapon_range: item.type === 'R' ? 'Ranged' : item.type === 'M' || item.type === 'MELEE' ? 'Melee' : undefined,
    armor_category: ['LA', 'MA', 'HA', 'S'].includes(item.type) ? typeName.replace(' Armor', '') : undefined,
    ...(armorBase && { armor_class: { base: armorBase, dex_bonus: item.type !== 'HA' } }),
    ...(damageDice && { damage: { damage_dice: damageDice, damage_type: { name: DAMAGE_TYPES[item.dmgType] ?? item.dmgType ?? '' }, ...(item.dmg2 && { versatile: item.dmg2 }) } }),
    properties: (item.property ?? []).map(prop => ({ index: slug(ITEM_PROPERTIES[prop] ?? prop), name: ITEM_PROPERTIES[prop] ?? prop })),
    weight: item.weight,
    rarity: item.rarity && item.rarity !== 'none' ? item.rarity : undefined,
    requires_attunement: !!item.reqAttune,
    desc: [stripTags(item.entries ?? item.additionalEntries)],
    ...(item.packContents && { pack_contents: item.packContents.map(normalizePackContent) }),
  }
}

function normalizePackContent(content) {
  if (typeof content === 'string') {
    const [name, source] = content.split('|')
    return { index: slug(name), name: stripTags(name), source: source?.toUpperCase(), quantity: 1 }
  }
  const item = content?.item
  if (item) {
    const [name, source] = item.split('|')
    return { index: slug(name), name: stripTags(name), source: source?.toUpperCase(), quantity: content.quantity ?? 1 }
  }
  const special = content?.special ?? 'Pack item'
  return { index: slug(special), name: stripTags(special), quantity: content?.quantity ?? 1 }
}

function titleCase(value) {
  return String(value ?? '').replace(/\b\w/g, char => char.toUpperCase())
}

function formatSpellTime(time = []) {
  const first = time[0]
  if (!first) return ''
  return `${first.number ?? 1} ${first.unit}${first.number === 1 ? '' : 's'}`
}

function formatSpellRange(range) {
  if (!range) return ''
  const distance = range.distance
  if (!distance) return titleCase(range.type)
  if (distance.type === 'self') return range.type === 'cone' ? `Self (${distance.amount ?? ''}-foot cone)` : 'Self'
  if (distance.amount != null) return `${distance.amount} ${distance.type}`
  return titleCase(distance.type ?? range.type)
}

function formatSpellDuration(duration = []) {
  const first = duration[0]
  if (!first) return ''
  const prefix = first.concentration ? 'Concentration, up to ' : ''
  if (first.type === 'instant') return 'Instantaneous'
  if (first.type === 'permanent') return 'Until dispelled'
  const amount = first.duration?.amount
  const type = first.duration?.type
  return `${prefix}${amount ?? ''}${amount ? ' ' : ''}${type ?? first.type}${amount === 1 ? '' : 's'}`.trim()
}

function normalizeSpellComponents(components = {}) {
  return [
    components.v ? 'V' : null,
    components.s ? 'S' : null,
    components.m ? `M${typeof components.m === 'string' ? ` (${stripTags(components.m)})` : ''}` : null,
  ].filter(Boolean)
}

function parseDice(dice) {
  const match = String(dice ?? '').match(/(\d+)d(\d+)/i)
  return match ? { count: Number(match[1]), die: Number(match[2]) } : null
}

function addDice(base, increment, times) {
  const baseDice = parseDice(base)
  const incrementDice = parseDice(increment)
  if (!baseDice || !incrementDice || baseDice.die !== incrementDice.die) return base
  return `${baseDice.count + incrementDice.count * times}d${baseDice.die}`
}

function normalizeSpellDamage(spell) {
  const damageType = spell.damageInflict?.[0]
  const damage = {}
  if (spell.scalingLevelDice?.scaling) {
    damage.damage_at_character_level = spell.scalingLevelDice.scaling
  }

  const rawHigher = JSON.stringify(spell.entriesHigherLevel ?? '')
  const scaling = rawHigher.match(/{@scaledamage ([^|}]+)\|[^|}]+\|([^}]+)}/)
  const baseDamage = scaling?.[1] ?? JSON.stringify(spell.entries ?? '').match(/{@damage ([^}|]+)(?:\|[^}]*)?}/)?.[1]
  if (spell.level > 0 && baseDamage) {
    damage.damage_at_slot_level = {}
    for (let slotLevel = spell.level; slotLevel <= 9; slotLevel++) {
      damage.damage_at_slot_level[slotLevel] = scaling
        ? addDice(baseDamage, scaling[2], slotLevel - spell.level)
        : baseDamage
    }
  }

  if (damageType) {
    damage.damage_type = { index: slug(damageType), name: titleCase(damageType) }
  }
  return Object.keys(damage).length ? damage : undefined
}

function normalizeSpell(spell, sourceLookup) {
  const lookup = sourceLookup?.[String(spell.source).toLowerCase()]?.[spell.name.toLowerCase()]
  const classNames = Object.values(lookup?.class ?? {}).flatMap(sourceBlock => Object.keys(sourceBlock))
  const savingThrow = spell.savingThrow?.[0]
  return {
    index: slug(spell.name),
    name: spell.name,
    source: spell.source,
    level: spell.level ?? 0,
    ritual: !!spell.meta?.ritual,
    school: { index: slug(SCHOOL_NAMES[spell.school] ?? spell.school), name: SCHOOL_NAMES[spell.school] ?? spell.school },
    classes: [...new Set(classNames)].map(name => ref(name)),
    casting_time: formatSpellTime(spell.time),
    range: formatSpellRange(spell.range),
    components: normalizeSpellComponents(spell.components),
    duration: formatSpellDuration(spell.duration),
    concentration: spell.duration?.some(entry => entry.concentration) ?? false,
    attack_type: spell.spellAttack?.[0] === 'R' ? 'ranged' : spell.spellAttack?.[0] === 'M' ? 'melee' : undefined,
    dc: savingThrow ? { dc_type: abilityRef(slug(savingThrow).slice(0, 3)) } : undefined,
    saving_throw: savingThrow ? titleCase(savingThrow) : undefined,
    damage: normalizeSpellDamage(spell),
    desc: [stripTags(spell.entries)],
    higher_level: spell.entriesHigherLevel ? [stripTags(spell.entriesHigherLevel)] : [],
  }
}

function normalizeOptionalFeature(feature) {
  const minLevel = Math.max(0, ...(feature.prerequisite ?? []).map(prereq => prereq?.level?.level ?? 0))
  return {
    id: slug(`${feature.name} ${feature.source ?? ''}`),
    index: slug(feature.name),
    name: feature.name,
    source: feature.source,
    featureType: feature.featureType ?? [],
    minLevel,
    desc: [stripTags(feature.entries)].filter(Boolean),
  }
}

function normalizeMonster(monster) {
  return {
    index: slug(monster.name),
    name: monster.name,
    source: monster.source,
    type: normalizeMonsterType(monster.type),
    challenge_rating: normalizeMonsterCr(monster.cr),
    challenge_rating_detail: normalizeMonsterCrDetail(monster.cr),
    hit_points: monster.hp?.average,
    hit_dice: monster.hp?.formula,
    hitDie: monster.hp?.formula,
    armor_class: [{ value: normalizeMonsterAc(monster.ac) }],
    strength: monster.str,
    dexterity: monster.dex,
    constitution: monster.con,
    intelligence: monster.int,
    wisdom: monster.wis,
    charisma: monster.cha,
    actions: (monster.action ?? []).map(action => ({ name: action.name, desc: [stripTags(action.entries)] })),
    traits: (monster.trait ?? []).map(trait => ({ name: trait.name, desc: [stripTags(trait.entries)] })),
  }
}

function matchesRulesEdition(item, rulesEdition = '2014') {
  const edition = item?.edition
  const source = item?.source
  if (rulesEdition === '2024') return edition === 'one' || source === 'XPHB'
  return edition !== 'one' && source !== 'XPHB'
}

function preferredSourceForRules(rulesEdition = '2014') {
  return rulesEdition === '2024' ? 'XPHB' : 'PHB'
}

function dedupeByIndex(items, preferredSource = 'PHB') {
  const map = new Map()
  for (const item of items.filter(item => item?.index && item?.name)) {
    if (!map.has(item.index) || item.source === preferredSource) map.set(item.index, item)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export const getRaces = (rulesEdition = '2014') => memo(`races:${rulesEdition}`, () => {
  const data = firstModule(raceData)
  const preferredSource = preferredSourceForRules(rulesEdition)
  const races = dedupeByIndex((data.race ?? []).map(normalizeRace).filter(race => matchesRulesEdition(race, rulesEdition)), preferredSource)
  const subraces = markSubraceAbilityModes((data.subrace ?? []).map(normalizeSubrace).filter(Boolean).filter(subrace => matchesRulesEdition(subrace, rulesEdition)), races)
  return races.map(race => ({
    ...race,
    subraces: subraces.filter(subrace => subrace.race.index === race.index).map(({ index, name, source, edition, isBaseRaceOption, abilityOverridesRace }) => ({ index, name, source, edition, isBaseRaceOption, abilityOverridesRace })),
  }))
})

export const getSubraces = (rulesEdition = '2014') => memo(`subraces:${rulesEdition}`, () => {
  const data = firstModule(raceData)
  const preferredSource = preferredSourceForRules(rulesEdition)
  const races = dedupeByIndex((data.race ?? []).map(normalizeRace).filter(race => matchesRulesEdition(race, rulesEdition)), preferredSource)
  return dedupeByIndex(markSubraceAbilityModes((data.subrace ?? []).map(normalizeSubrace).filter(Boolean).filter(subrace => matchesRulesEdition(subrace, rulesEdition)), races), preferredSource)
})

export const getClasses = (rulesEdition = '2014') => memo(`classes:${rulesEdition}`, () => {
  const preferredSource = preferredSourceForRules(rulesEdition)
  const classes = Object.values(classData).flatMap(module =>
    (module?.class ?? [])
      .filter(cls => matchesRulesEdition(cls, rulesEdition))
      .map(cls => normalizeClass(cls, module, rulesEdition))
  )
  return dedupeByIndex(classes, preferredSource)
})

export const getBackgrounds = (rulesEdition = '2014') => memo(`backgrounds:${rulesEdition}`, () => {
  const data = firstModule(backgroundData)
  const preferredSource = preferredSourceForRules(rulesEdition)
  return dedupeByIndex(resolveBackgroundCopies(data.background ?? []).map(normalizeBackground).filter(background => matchesRulesEdition(background, rulesEdition)), preferredSource)
})

export const getEquipment = () => memo('equipment', () => {
  const mundane = fromModules(itemData, 'baseitem').map(item => canonicalizeAmmoItem(normalizeItem(item, false)))
  return dedupeByIndex(mundane)
})

export const getMagicItems = () => memo('magicItems', () => {
  const magic = fromModules(itemData, 'item').map(item => normalizeItem(item, true))
  return dedupeByIndex(magic)
})

export const getSpells = () => memo('spells', () => {
  const lookup = firstModule(spellLookupData)
  return dedupeByIndex(fromModules(spellData, 'spell').map(spell => normalizeSpell(spell, lookup)))
})

export const getOptionalFeatures = () => memo('optionalFeatures', () => (
  optionFeatureArray(optionalFeatureLookup()).map(normalizeOptionalFeature)
))

export const getMonsters = () => memo('monsters', () => (
  dedupeByIndex(fromModules(monsterData, 'monster').map(normalizeMonster))
))

export const getConditions = () => Promise.resolve([])

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

function normalizeRace(race) {
  const { bonuses, choice } = normalizeAbilityBonuses(race.ability)
  const racialOptions = [draconicAncestryOptions(race.entries)].filter(Boolean)
  return {
    index: slug(race.name),
    name: race.name,
    source: race.source,
    speed: normalizeSpeed(race.speed),
    size: normalizeSize(race.size),
    ability_bonuses: bonuses,
    ...(choice && { ability_bonus_options: choice }),
    alignment: stripTags(race.entries?.find(e => e?.name === 'Alignment')?.entries),
    languages: Object.keys(race.languageProficiencies?.[0] ?? {}).map(name => ref(name)),
    traits: normalizeEntriesToTraits(race.entries),
    racial_options: racialOptions,
    subraces: [],
  }
}

function normalizeSubrace(subrace) {
  const raceName = subrace.raceName ?? subrace._baseName
  if (!raceName) return null
  const { bonuses } = normalizeAbilityBonuses(subrace.ability)
  const isBaseRaceOption = !subrace.name
  const racialOptions = [draconicAncestryOptions(subrace.entries)].filter(Boolean)
  return {
    index: isBaseRaceOption ? `${slug(raceName)}-base-${slug(subrace.source)}` : slug(`${raceName ?? ''} ${subrace.name}`),
    name: isBaseRaceOption ? `${subrace.source ?? 'Base'} / Base-Only` : subrace.name,
    source: subrace.source,
    race: ref(raceName),
    isBaseRaceOption,
    ability_bonuses: bonuses,
    racial_traits: normalizeEntriesToTraits(subrace.entries),
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

  if (/^favored enemy/i.test(name)) {
    choices.push({
      type: 'option',
      choose: 1,
      choiceIndex: 100,
      options: [
        'Aberrations', 'Beasts', 'Celestials', 'Constructs', 'Dragons', 'Elementals',
        'Fey', 'Fiends', 'Giants', 'Monstrosities', 'Oozes', 'Plants', 'Undead',
        'Two humanoid races',
      ].map(option => ({ id: slug(option), name: option, optionType: 'manual', desc: [] })),
    })
  }

  if (/natural explorer/i.test(lowerName)) {
    choices.push({
      type: 'option',
      choose: 1,
      choiceIndex: 101,
      options: ['Arctic', 'Coast', 'Desert', 'Forest', 'Grassland', 'Mountain', 'Swamp', 'Underdark']
        .map(option => ({ id: slug(option), name: option, optionType: 'manual', desc: [] })),
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
      choose: 1,
      choiceIndex: 103,
      options: optionalFeaturesForType(optionalFeatures, 'MM', feature.level),
    })
  }

  return choices.filter(choice => choice.options.length > 0)
}

function normalizeFeatureChoices(entries = [], optionalFeatures = {}) {
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
    ...normalizeFeatureChoices(feature.entries, optionalFeatures),
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

function normalizeClass(cls, module = {}) {
  const optionalFeatures = optionalFeatureLookup()
  const skillChoice = cls.startingProficiencies?.skills?.find(s => s.choose)?.choose
  const skillOptions = (skillChoice?.from ?? []).map(skill => ({ option_type: 'reference', item: skillRef(skill) }))
  const armor = (cls.startingProficiencies?.armor ?? []).map(name => ref(`${name} armor proficiency`))
  const weapons = (cls.startingProficiencies?.weapons ?? []).map(name => ref(`${name} weapon proficiency`))
  const features = (module.classFeature ?? [])
    .filter(feature => feature.className === cls.name && (!feature.classSource || feature.classSource === cls.source))
    .map(feature => normalizeClassFeature(feature, optionalFeatures))
  const featuresByLevel = features.reduce((byLevel, feature) => {
    const level = String(feature.level ?? 1)
    byLevel[level] = [...(byLevel[level] ?? []), feature]
    return byLevel
  }, {})
  return {
    index: slug(cls.name),
    name: cls.name,
    source: cls.source,
    hit_die: cls.hd?.faces ?? 8,
    saving_throws: (cls.proficiency ?? []).map(abilityRef),
    proficiencies: [
      ...(cls.proficiency ?? []).map(a => ({ index: `saving-throw-${a}`, name: `Saving Throw: ${ABILITY_NAMES[a]}` })),
      ...armor,
      ...weapons,
    ],
    proficiency_choices: skillOptions.length ? [{
      type: 'proficiencies',
      choose: skillChoice.count ?? 2,
      desc: `Choose ${skillChoice.count ?? 2} skills`,
      from: { options: skillOptions },
    }] : [],
    starting_equipment: [],
    starting_equipment_options: normalizeStartingEquipment(cls.startingEquipment?.default ?? []),
    features_by_level: featuresByLevel,
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
      if (items.length === 1) return items[0]
      if (items.length > 1) return { option_type: 'multiple', items }
      const categoryIndex = equipmentCategoryFromText(part)
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

function normalizeBackground(background) {
  const skillBlock = background.skillProficiencies?.[0] ?? {}
  const featureEntry = background.entries?.find(entry => /feature/i.test(entry?.name ?? ''))
  return {
    index: slug(background.name),
    name: background.name,
    source: background.source,
    starting_proficiencies: proficienciesFromObject(skillBlock),
    starting_equipment: [],
    starting_equipment_options: normalizeBackgroundEquipment(background.startingEquipment ?? []),
    language_options: normalizeLanguageOptions(background.languageProficiencies),
    feature: featureEntry ? { name: featureEntry.name.replace(/^Feature:\s*/i, ''), desc: [stripTags(featureEntry.entries)] } : null,
  }
}

function normalizeBackgroundEquipment(groups) {
  const equipmentTypeName = (type, fallback) => ({
    instrumentMusical: 'musical instrument',
    setGaming: 'gaming set',
    toolArtisan: "artisan's tools",
  }[type] ?? fallback ?? 'custom item')

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
    weapon_category: weaponCategory,
    weapon_range: item.type === 'R' ? 'Ranged' : item.type === 'M' || item.type === 'MELEE' ? 'Melee' : undefined,
    armor_category: ['LA', 'MA', 'HA', 'S'].includes(item.type) ? typeName.replace(' Armor', '') : undefined,
    ...(armorBase && { armor_class: { base: armorBase, dex_bonus: item.type !== 'HA' } }),
    ...(damageDice && { damage: { damage_dice: damageDice, damage_type: { name: DAMAGE_TYPES[item.dmgType] ?? item.dmgType ?? '' } } }),
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

function normalizeSpell(spell, sourceLookup) {
  const lookup = sourceLookup?.[String(spell.source).toLowerCase()]?.[spell.name.toLowerCase()]
  const classNames = Object.values(lookup?.class ?? {}).flatMap(sourceBlock => Object.keys(sourceBlock))
  return {
    index: slug(spell.name),
    name: spell.name,
    source: spell.source,
    level: spell.level ?? 0,
    school: { index: slug(SCHOOL_NAMES[spell.school] ?? spell.school), name: SCHOOL_NAMES[spell.school] ?? spell.school },
    classes: [...new Set(classNames)].map(name => ref(name)),
    desc: [stripTags(spell.entries)],
    higher_level: spell.entriesHigherLevel ? [stripTags(spell.entriesHigherLevel)] : [],
  }
}

function normalizeMonster(monster) {
  return {
    index: slug(monster.name),
    name: monster.name,
    source: monster.source,
    type: typeof monster.type === 'string' ? monster.type : monster.type?.type,
    challenge_rating: monster.cr,
    hit_points: monster.hp?.average,
    hit_dice: monster.hp?.formula,
    hitDie: monster.hp?.formula,
    armor_class: [{ value: Array.isArray(monster.ac) ? (monster.ac[0]?.ac ?? monster.ac[0]) : monster.ac }],
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

function dedupeByIndex(items) {
  const map = new Map()
  for (const item of items.filter(item => item?.index && item?.name)) {
    if (!map.has(item.index) || item.source === 'PHB') map.set(item.index, item)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export const getRaces = () => memo('races', () => {
  const data = firstModule(raceData)
  const races = dedupeByIndex((data.race ?? []).map(normalizeRace))
  const subraces = markSubraceAbilityModes((data.subrace ?? []).map(normalizeSubrace).filter(Boolean), races)
  return races.map(race => ({
    ...race,
    subraces: subraces.filter(subrace => subrace.race.index === race.index).map(({ index, name, source, isBaseRaceOption, abilityOverridesRace }) => ({ index, name, source, isBaseRaceOption, abilityOverridesRace })),
  }))
})

export const getSubraces = () => memo('subraces', () => {
  const data = firstModule(raceData)
  const races = dedupeByIndex((data.race ?? []).map(normalizeRace))
  return dedupeByIndex(markSubraceAbilityModes((data.subrace ?? []).map(normalizeSubrace).filter(Boolean), races))
})

export const getClasses = () => memo('classes', () => {
  const classes = Object.values(classData).flatMap(module =>
    (module?.class ?? [])
      .filter(cls => !cls.edition || cls.edition === 'classic')
      .map(cls => normalizeClass(cls, module))
  )
  return dedupeByIndex(classes)
})

export const getBackgrounds = () => memo('backgrounds', () => {
  const data = firstModule(backgroundData)
  return dedupeByIndex((data.background ?? []).map(normalizeBackground))
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

export const getMonsters = () => memo('monsters', () => (
  dedupeByIndex(fromModules(monsterData, 'monster').map(normalizeMonster))
))

export const getConditions = () => Promise.resolve([])

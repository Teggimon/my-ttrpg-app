import { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { getClasses, getRaces, getSubraces, getBackgrounds, getEquipment } from './srdContent'
import { FEATS, SUBCLASSES, SUBCLASS_LEVELS, getSlotsForClass, CANTRIPS_KNOWN, SPELLS_KNOWN_L1 } from './LevelUpModal'
import { getSpells } from './srdContent'
import { ALL_SOURCES, filterBySearchAndSource, sourceCode, sourceOptions } from './sourceFilters'
import { inventoryItemFromCatalogItem, normalizeInventoryItem } from './itemRules'

// Spellcasting ability by class index
const SPELLCASTING_ABILITY = {
  bard: 'cha', cleric: 'wis', druid: 'wis', paladin: 'cha',
  ranger: 'wis', sorcerer: 'cha', warlock: 'cha', wizard: 'int',
}

const SKILL_INDEX_TO_STAT_KEY = {
  'animal-handling': 'animalHandling',
  'sleight-of-hand': 'sleightOfHand',
}

function characterFileName(name) {
  const slug = String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'character'}.json`
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

// ─── Character builder ────────────────────────────────────────────────────────

export function buildCharacter({ user, name, raceData, subraceData, classData, subclassChoice, backgroundData, alignment, choices, baseAbilityScores, startingCantrips, startingSpells, equipmentCatalog = [] }) {
  const {
    raceBonusOptions = [],   // [{ability_score:{index}, bonus}]
    classSkills = [],        // ['skill-perception', ...]
    classEquipment = [],     // [{index, name, quantity}]
    classFeatureChoices = [],
    backgroundLanguages = [],
    backgroundEquipment = [],
    backgroundFeature = null,
    racialOptionChoices = {},
    racialFeat = null,
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

  // 3. HP: hit_die + CON mod
  const conMod = Math.floor((abilityScores.con - 10) / 2)
  const hitDie = classData?.hit_die ?? 8
  const hpMax = Math.max(1, hitDie + conMod)

  // 4. Speed & size from race
  const speed = raceData?.speed ?? 30
  const size = raceData?.size ?? 'Medium'

  // 5. Saving throw proficiencies from class
  const savingThrows = {}
  for (const save of (classData?.saving_throws ?? [])) {
    savingThrows[save.index] = { proficient: true }
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

  // 7. Armor / weapon proficiencies from class
  const proficiencies = (classData?.proficiencies ?? [])
    .filter(p => !p.index.startsWith('saving-throw-'))
    .map(p => p.name)

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
  const classFeatures = Object.values(classData?.features_by_level ?? {})
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
    }))
  const selectedClassFeatureChoices = classFeatureChoices.map(choice => ({
    choiceKey: choice.choiceKey,
    featureIndex: choice.featureIndex,
    featureName: choice.featureName,
    className: choice.className,
    classIndex: choice.classIndex,
    gainedAtLevel: choice.gainedAtLevel,
    options: (choice.options ?? []).map(option => ({
      id: option.id,
      name: option.name,
      source: option.source,
      desc: option.desc ?? [],
      featureType: option.featureType,
    })),
  }))

  // 10. Languages
  const languages = [
    ...(raceData?.languages ?? []).map(l => l.name),
    ...backgroundLanguages,
  ]

  return {
    meta: {
      owner: `github:${user.login}`,
      characterId: uuidv4(),
      copiedFrom: null,
      system: 'dnd5e',
      version: 1,
      lastUpdated: new Date().toISOString(),
    },
    identity: {
      name,
      race: raceData?.name ?? name,
      raceIndex: raceData?.index ?? null,
      subrace: subraceData?.isBaseRaceOption ? null : subraceData?.name ?? null,
      subraceIndex: subraceData?.isBaseRaceOption ? null : subraceData?.index ?? null,
      class: [{ name: classData?.name ?? '', index: classData?.index ?? null, level: 1, subclass: subclassChoice ?? null }],
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
      proficiencies,
      damageResistances,
    },
    combat: {
      hpMax,
      hpCurrent: hpMax,
      hpTemp: 0,
      ac: 10,
      initiative: 0,
      speed,
      deathSaves: { successes: 0, failures: 0 },
      conditions: [],
    },
    inventory,
    feats: racialFeat ? [{ name: racialFeat.name, desc: racialFeat.desc, source: racialFeat.source ?? null, origin: 'Variant Human' }] : [],
    racialTraits,
    spells: {
      spellcastingAbility: SPELLCASTING_ABILITY[classData?.index] ?? null,
      slots: getSlotsForClass(classData?.index ?? null, 1),
      known: [...(startingCantrips ?? []), ...(startingSpells ?? [])],
      prepared: (startingSpells ?? []).map(s => s.index),
      concentration: null,
    },
    customContent: {
      classFeatures,
      classFeatureChoices: selectedClassFeatureChoices,
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
    settings: {
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
    },
  }
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const S = {
  shell: { minHeight: '100dvh', width: '100vw', marginLeft: 'calc(50% - 50vw)', padding: '1rem', boxSizing: 'border-box', display: 'grid', placeItems: 'center', background: 'var(--bg-base)' },
  panel: { width: 'min(calc(100vw - 2rem), 920px)', minWidth: 'min(calc(100vw - 2rem), 720px)', height: 'calc(100dvh - 2rem)', display: 'flex', flexDirection: 'column', overflowY: 'auto', scrollbarGutter: 'stable', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', boxSizing: 'border-box' },
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', padding: '1.25rem 1rem 0', width: '720px', maxWidth: '100%', margin: '0 auto', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', boxSizing: 'border-box' },
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

// ─── Ability score constants ──────────────────────────────────────────────────

const STANDARD_ARRAY  = [15, 14, 13, 12, 10, 8]
const ABILITIES       = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const ABILITY_LABEL   = { str:'STR', dex:'DEX', con:'CON', int:'INT', wis:'WIS', cha:'CHA' }
const ABILITY_NAME    = { str:'Strength', dex:'Dexterity', con:'Constitution', int:'Intelligence', wis:'Wisdom', cha:'Charisma' }
// Point-buy cost per score value
const PB_COST = { 8:0, 9:1, 10:2, 11:3, 12:4, 13:5, 14:7, 15:9 }

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

function StepName({ value, onChange, onNext, onCancel }) {
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
        <button style={S.btn(false)} onClick={onCancel}>Cancel</button>
        <button style={S.btn(true)} onClick={onNext} disabled={!value.trim()}>Next: Race →</button>
      </div>
    </div>
  )
}

// ─── Step 2: Race ─────────────────────────────────────────────────────────────

function StepRace({ races, selected, onSelect, onNext, onBack }) {
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState(ALL_SOURCES)
  const filtered = filterBySearchAndSource(races, search, sourceFilter)

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
        <button style={S.btn(true)} onClick={onNext} disabled={!selected}>
          Next: {selected?.subraces?.length > 0 ? 'Subrace' : 'Class'} →
        </button>
      </div>
    </div>
  )
}

// ─── Step 3: Subrace ──────────────────────────────────────────────────────────

function StepSubrace({ race, subraces, selected, onSelect, bonusOptions, onBonusOptions, selectedFeat, onFeatChange, onNext, onBack }) {
  const [sourceFilter, setSourceFilter] = useState(ALL_SOURCES)
  const [featSearch, setFeatSearch] = useState('')
  // Filter subraces for this race
  const allAvailable = subraces.filter(s => s.race?.index === race.index)
  const available = allAvailable.filter(s => sourceFilter === ALL_SOURCES || sourceCode(s) === sourceFilter)

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
  const featReady = !grantsFeat || !!selectedFeat
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
              return (
                <div key={feat.name} style={S.card(selectedFeatName)} onClick={() => onFeatChange(feat)}>
                  <div style={S.cardTop}>
                    <div style={S.cardName}>{feat.name}</div>
                    {feat.prereq && <span style={S.sourceBadge}>{feat.prereq}</span>}
                  </div>
                  <div style={S.cardSub}>{feat.desc}</div>
                </div>
              )
            })}
          </div>
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

function StepRacialOptions({ raceData, subraceData, selectedOptions, onOptionsChange, onNext, onBack }) {
  const groups = racialOptionGroups(raceData, subraceData)
  const ready = groups.every(group => !!selectedOptions[group.id])

  const chooseOption = (group, option) => {
    onOptionsChange({ ...selectedOptions, [group.id]: option })
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

function StepSpells({ classData, selectedCantrips, onCantrips, selectedSpells, onSpells, onNext, onBack }) {
  const [allSpells, setAllSpells] = useState([])
  const classIdx   = classData?.index ?? ''
  const cantripMax = CANTRIPS_KNOWN[classIdx] ?? 0
  const spellMax   = SPELLS_KNOWN_L1[classIdx] ?? 0

  useEffect(() => {
    getSpells().then(all => setAllSpells(all)).catch(() => {})
  }, [])

  const classSpells   = allSpells.filter(s => s.classes?.some(c => c.index === classIdx))
  const cantrips      = classSpells.filter(s => s.level === 0)
  const leveledSpells = classSpells.filter(s => s.level === 1) // level 1 only at creation

  const toggleCantrip = (sp) => {
    if (selectedCantrips.some(s => s.index === sp.index))
      onCantrips(selectedCantrips.filter(s => s.index !== sp.index))
    else if (selectedCantrips.length < cantripMax)
      onCantrips([...selectedCantrips, { id: sp.index, index: sp.index, name: sp.name, source: sp.source, level: 0 }])
  }
  const toggleSpell = (sp) => {
    if (selectedSpells.some(s => s.index === sp.index))
      onSpells(selectedSpells.filter(s => s.index !== sp.index))
    else if (selectedSpells.length < spellMax)
      onSpells([...selectedSpells, { id: sp.index, index: sp.index, name: sp.name, source: sp.source, level: sp.level }])
  }

  const cantripDone = cantripMax === 0 || selectedCantrips.length === cantripMax
  const spellDone   = spellMax   === 0 || selectedSpells.length   === spellMax

  return (
    <div style={S.wrap}>
      <div style={S.h1}>Starting Spells — {classData?.name}</div>
      <div style={S.sub}>Choose your starting cantrips and spells.</div>

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
          label={`1st-Level Spells (choose ${spellMax})`}
          spells={leveledSpells}
          selected={selectedSpells}
          max={spellMax}
          onToggle={toggleSpell}
        />
      )}

      <div style={S.row}>
        <button style={S.btn(false)} onClick={onBack}>← Back</button>
        <button style={S.btn(true)} onClick={onNext} disabled={!cantripDone || !spellDone}>
          Next: Ability Scores →
        </button>
      </div>
    </div>
  )
}

// ─── Step: Subclass (for classes that choose at level 1) ─────────────────────

function StepSubclass({ classData, selected, onSelect, onNext, onBack }) {
  const options = SUBCLASSES[classData?.index] ?? []
  return (
    <div style={S.wrap}>
      <div style={S.h1}>Choose Your {classData?.name} Subclass</div>
      <div style={S.sub}>
        {classData?.name}s choose their path at level 1. This choice is permanent.
      </div>
      <div style={S.scrollList}>
        {options.map(name => (
          <div key={name} style={S.card(selected === name)} onClick={() => onSelect(name)}>
            <div style={S.cardName}>{name}</div>
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

function classFeatureChoiceGroups(classData) {
  return Object.values(classData?.features_by_level ?? {})
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
        level: feature.level ?? 1,
      },
    })))
}

function StepClassSetup({ classData, selectedSkills, onSkillsChange, selectedEquipment, onEquipmentChange, selectedFeatureChoices, onFeatureChoicesChange, onNext, onBack }) {
  const [categoryItems, setCategoryItems] = useState({}) // { choiceId: [items] }
  const [categorySourceFilters, setCategorySourceFilters] = useState({})
  const [expandedChoice, setExpandedChoice] = useState(null) // choiceId being expanded

  const profChoices = classData.proficiency_choices?.filter(pc => pc.type === 'proficiencies') ?? []
  const equipOptions = classData.starting_equipment_options ?? []
  const featureChoiceGroups = classFeatureChoiceGroups(classData)

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
        if (i.option_type === 'choice') {
          // e.g. "a holy symbol" — use a generic placeholder that the user sees as real gear
          const desc = i.choice?.desc ?? 'Holy Symbol'
          return [{ index: 'holy-symbol', name: 'Holy Symbol', quantity: 1, placeholder: desc }]
        }
        return []
      })
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
  const allEquipSelected = equipGroups.every(g => {
    const groupSelections = selectedEquipment.filter(e => e.groupIndex === g.groupIndex)
    if (groupSelections.length === 0) return false
    const selectedChoiceIds = new Set(groupSelections.map(e => e.choiceId))
    // At least one choice in the group must be fully satisfied
    return g.choices.some(choice => {
      if (!selectedChoiceIds.has(choice.id)) return false
      if (!choice.isCategory) return true
      const need = choice.choose ?? 1
      const have = groupSelections.filter(e => e.choiceId === choice.id).length
      return have >= need
    })
  })
  const allFeatureChoicesSelected = featureChoiceGroups.every(choice => {
    const selected = selectedFeatureChoices.find(item => item.choiceKey === choice.choiceKey)
    return (selected?.options?.length ?? 0) >= (choice.choose ?? 1)
  })

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
      gainedAtLevel: choice.feature.level,
      options: nextOptions,
    }
    onFeatureChoicesChange([
      ...selectedFeatureChoices.filter(item => item.choiceKey !== choice.choiceKey),
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
              const choiceComplete = selectedForChoice.length >= choose
              const loadedItems = categoryItems[choice.id] // null=loading, undefined=not started, []=empty, [...]
              const itemSourceFilter = categorySourceFilters[choice.id] ?? ALL_SOURCES
              const visibleItems = (loadedItems ?? []).filter(item => itemSourceFilter === ALL_SOURCES || sourceCode(item) === itemSourceFilter)
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
                        ? `${selectedForChoice.length}/${choose} selected — choose below ↓`
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
                            const itemChecked = selectedForChoice.some(e => e.index === item.index)
                            const disabled = !itemChecked && selectedForChoice.length >= choose
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
                                    onEquipmentChange([...otherGroups, ...sameChoiceWithoutItem, { ...item, groupIndex: group.groupIndex, choiceId: choice.id }])
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
        <button style={S.btn(true)} onClick={onNext} disabled={!allSkillsSelected || !allEquipSelected || !allFeatureChoicesSelected}>
          Next: Background →
        </button>
      </div>
      {(!allSkillsSelected || !allEquipSelected || !allFeatureChoicesSelected) && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          {!allSkillsSelected && <div>Skills not complete ({allSkillGroups.map(g => `${selectedSkills.filter(s => g.options.some(o => o.item.index === s)).length}/${g.choose}`).join(', ')})</div>}
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

// ─── Step 7: Background setup (languages + equipment choices) ─────────────────

function StepBackgroundSetup({ backgroundData, selectedLanguages, onLanguagesChange, selectedEquipment, onEquipmentChange, onNext, onBack }) {
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
          const label = parts.map(p => p.quantity > 1 ? `${p.name} ×${p.quantity}` : p.name).join(' + ')
          return { id: `${gi}_${oi}`, label, items: parts, isChoice: false }
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

      {/* Equipment choices */}
      {equipGroups.map((group) => (
        <div key={group.groupIndex}>
          <label style={S.label}>Choose Equipment</label>
          <div style={S.cardSub}>{group.desc}</div>
          {group.choices.map(choice => {
            const checked = selectedEquipment.some(e => e.groupIndex === group.groupIndex && e.choiceId === choice.id)
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
        <button style={S.btn(true)} onClick={onNext} disabled={!langReady || !equipOk}>Next: Alignment →</button>
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

  // Wizard state
  const [name, setName] = useState('')
  const [raceData, setRaceData] = useState(null)
  const [subraceData, setSubraceData] = useState(null)
  const [raceBonusOptions, setRaceBonusOptions] = useState([])
  const [racialOptionChoices, setRacialOptionChoices] = useState({})
  const [racialFeat, setRacialFeat] = useState(null)
  const [classData, setClassData] = useState(null)
  const [subclassChoice, setSubclassChoice] = useState(null)
  const [classSkills, setClassSkills] = useState([])
  const [classEquipment, setClassEquipment] = useState([])
  const [classFeatureChoices, setClassFeatureChoices] = useState([])
  const [abilityScores, setAbilityScores] = useState({ str:10, dex:10, con:10, int:10, wis:10, cha:10 })
  const [startingCantrips, setStartingCantrips] = useState([])
  const [startingSpells,   setStartingSpells]   = useState([])
  const [backgroundData, setBackgroundData] = useState(null)
  const [backgroundLanguages, setBackgroundLanguages] = useState([])
  const [backgroundEquipment, setBackgroundEquipment] = useState([])
  const [alignment, setAlignment] = useState('')

  useEffect(() => {
    Promise.all([getRaces(), getSubraces(), getClasses(), getBackgrounds(), getEquipment()])
      .then(([r, s, c, b, e]) => { setRaces(r); setAllSubraces(s); setClasses(c); setBackgrounds(b); setEquipmentCatalog(e) })
      .catch(err => setError(err.message))
  }, [])

  const hasSubrace = raceData?.subraces?.length > 0 || !!raceData?.ability_bonus_options
  const hasRacialOptions = racialOptionGroups(raceData, subraceData).length > 0
  const hasSubclassAtCreation = !!(classData && (SUBCLASS_LEVELS[classData.index] ?? []).includes(1))
  const isSpellcaster = !!(classData && (CANTRIPS_KNOWN[classData.index] || SPELLS_KNOWN_L1[classData.index]))

  // Compute step indices dynamically
  const STEP_NAME       = 0
  const STEP_RACE       = 1
  const STEP_SUBRACE    = 2                                        // may be skipped
  const STEP_RACE_OPTIONS = hasSubrace ? 3 : 2                      // may be skipped
  const STEP_CLASS      = STEP_RACE_OPTIONS + (hasRacialOptions ? 1 : 0)
  const STEP_SUBCLASS   = STEP_CLASS + 1                          // may be skipped
  const STEP_CLASS_SETUP    = hasSubclassAtCreation ? STEP_SUBCLASS + 1 : STEP_CLASS + 1
  const STEP_SPELLS         = STEP_CLASS_SETUP + 1                // may be skipped
  const STEP_ABILITY_SCORES = isSpellcaster ? STEP_SPELLS + 1 : STEP_CLASS_SETUP + 1
  const STEP_BACKGROUND     = STEP_ABILITY_SCORES + 1
  const STEP_BG_SETUP       = STEP_ABILITY_SCORES + 2
  const STEP_ALIGNMENT      = STEP_ABILITY_SCORES + 3
  const TOTAL_STEPS         = STEP_ABILITY_SCORES + 4

  const finish = async () => {
    setCreating(true)
    setError(null)
    try {
      const character = buildCharacter({
        user, name,
        raceData, subraceData, classData, subclassChoice, backgroundData, alignment,
        baseAbilityScores: abilityScores,
        startingCantrips,
        startingSpells,
        equipmentCatalog,
        choices: {
          raceBonusOptions,
          classSkills,
          classEquipment: classEquipment.filter(e => !e.index.startsWith('__')),
          classFeatureChoices,
          backgroundLanguages,
          backgroundEquipment: backgroundEquipment.filter(e => !e.index.startsWith('__')),
          backgroundFeature: backgroundData?.feature ?? null,
          racialOptionChoices,
          racialFeat,
        },
      })
      const fileName = characterFileName(name)
      await onComplete({ ...character, _fileName: fileName })
    } catch (err) {
      setError(err.message)
      setCreating(false)
    }
  }

  const goTo = (s) => { setError(null); setStep(s) }

  // When race changes, reset downstream
  const selectRace = (r) => {
    setRaceData(r)
    setSubraceData(null)
    setRaceBonusOptions([])
    setRacialOptionChoices({})
    setRacialFeat(null)
  }

  // When class changes, reset downstream
  const selectClass = (c) => {
    setClassData(c)
    setSubclassChoice(null)
    setClassSkills([])
    setClassEquipment([])
    setClassFeatureChoices([])
    setStartingCantrips([])
    setStartingSpells([])
  }

  const selectSubrace = (s) => {
    setSubraceData(s)
    setRaceBonusOptions([])
    setRacialOptionChoices({})
    setRacialFeat(null)
  }

  // When background changes, reset downstream
  const selectBackground = (b) => {
    setBackgroundData(b)
    setBackgroundLanguages([])
    setBackgroundEquipment([])
  }

  return (
    <div style={S.shell}>
      <div style={S.panel}>
        <ProgressBar step={step} totalSteps={TOTAL_STEPS} />

        {step === STEP_NAME && (
          <StepName value={name} onChange={setName} onNext={() => goTo(STEP_RACE)} onCancel={onCancel} />
        )}

        {step === STEP_RACE && (
          <StepRace
            races={races}
            selected={raceData}
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
            onFeatChange={setRacialFeat}
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
            selectedSkills={classSkills}
            onSkillsChange={setClassSkills}
            selectedEquipment={classEquipment}
            onEquipmentChange={setClassEquipment}
            selectedFeatureChoices={classFeatureChoices}
            onFeatureChoicesChange={setClassFeatureChoices}
            onNext={() => goTo(isSpellcaster ? STEP_SPELLS : STEP_ABILITY_SCORES)}
            onBack={() => goTo(hasSubclassAtCreation ? STEP_SUBCLASS : STEP_CLASS)}
          />
        )}

        {step === STEP_SPELLS && classData && isSpellcaster && (
          <StepSpells
            classData={classData}
            selectedCantrips={startingCantrips}
            onCantrips={setStartingCantrips}
            selectedSpells={startingSpells}
            onSpells={setStartingSpells}
            onNext={() => goTo(STEP_ABILITY_SCORES)}
            onBack={() => goTo(STEP_CLASS_SETUP)}
          />
        )}

        {step === STEP_ABILITY_SCORES && (
          <StepAbilityScores
            raceData={raceData}
            subraceData={subraceData}
            raceBonusOptions={raceBonusOptions}
            onChange={setAbilityScores}
            onNext={() => goTo(STEP_BACKGROUND)}
            onBack={() => goTo(isSpellcaster ? STEP_SPELLS : STEP_CLASS_SETUP)}
          />
        )}

        {step === STEP_BACKGROUND && (
          <StepBackground
            backgrounds={backgrounds}
            selected={backgroundData}
            onSelect={selectBackground}
            onNext={() => goTo(STEP_BG_SETUP)}
            onBack={() => goTo(STEP_CLASS_SETUP)}
          />
        )}

        {step === STEP_BG_SETUP && backgroundData && (
          <StepBackgroundSetup
            backgroundData={backgroundData}
            selectedLanguages={backgroundLanguages}
            onLanguagesChange={setBackgroundLanguages}
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

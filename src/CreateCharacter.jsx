import { useState, useEffect } from 'react'
import { Octokit } from '@octokit/rest'
import { v4 as uuidv4 } from 'uuid'
import { getClasses, getRaces, getBackgrounds } from './srdContent'
import { SUBCLASSES, SUBCLASS_LEVELS, getSlotsForClass, CANTRIPS_KNOWN, SPELLS_KNOWN_L1 } from './LevelUpModal'
import { getSpells } from './srdContent'

// ─── SRD helpers ─────────────────────────────────────────────────────────────

const BASE = 'https://raw.githubusercontent.com/Teggimon/ttrpg-srd-content/master/5e_PHB_2014'

async function loadSRD(file) {
  const res = await fetch(`${BASE}/${file}`)
  if (!res.ok) throw new Error(`Failed to load ${file}`)
  return res.json()
}

const getSubraces = () => loadSRD('5e-SRD-Subraces.json')

// Spellcasting ability by class index
const SPELLCASTING_ABILITY = {
  bard: 'cha', cleric: 'wis', druid: 'wis', paladin: 'cha',
  ranger: 'wis', sorcerer: 'cha', warlock: 'cha', wizard: 'int',
}

// ─── Character builder ────────────────────────────────────────────────────────

function buildCharacter({ user, name, raceData, subraceData, classData, subclassChoice, backgroundData, alignment, choices, baseAbilityScores, startingCantrips, startingSpells }) {
  const {
    raceBonusOptions = [],   // [{ability_score:{index}, bonus}]
    classSkills = [],        // ['skill-perception', ...]
    classEquipment = [],     // [{index, name, quantity}]
    backgroundLanguages = [],
    backgroundEquipment = [],
    backgroundFeature = null,
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
  for (const bonus of (raceData?.ability_bonuses ?? [])) {
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
    const key = skillIndex.replace('skill-', '')
    skills[key] = { proficient: true }
  }
  // From background (fixed)
  for (const prof of (backgroundData?.starting_proficiencies ?? [])) {
    if (prof.index?.startsWith('skill-')) {
      skills[prof.index.replace('skill-', '')] = { proficient: true }
    }
  }

  // 7. Armor / weapon proficiencies from class
  const proficiencies = (classData?.proficiencies ?? [])
    .filter(p => !p.index.startsWith('saving-throw-'))
    .map(p => p.name)

  // 8. Inventory: class starting_equipment + chosen class equipment + background equipment
  const inventory = []
  for (const item of (classData?.starting_equipment ?? [])) {
    inventory.push({ index: item.equipment.index, name: item.equipment.name, quantity: item.quantity, equipped: false })
  }
  for (const item of classEquipment) {
    inventory.push({ index: item.index, name: item.name, quantity: item.quantity ?? 1, equipped: false })
  }
  for (const item of (backgroundData?.starting_equipment ?? [])) {
    inventory.push({ index: item.equipment.index, name: item.equipment.name, quantity: item.quantity, equipped: false })
  }
  for (const item of backgroundEquipment) {
    inventory.push({ index: item.index, name: item.name, quantity: item.quantity ?? 1, equipped: false })
  }

  // 9. Racial traits
  const racialTraits = [
    ...(raceData?.traits ?? []).map(t => ({ index: t.index, name: t.name })),
    ...(subraceData?.racial_traits ?? []).map(t => ({ index: t.index, name: t.name })),
  ]

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
      subrace: subraceData?.name ?? null,
      subraceIndex: subraceData?.index ?? null,
      class: [{ name: classData?.name ?? '', index: classData?.index ?? null, level: 1, subclass: subclassChoice ?? null }],
      background: backgroundData?.name ?? '',
      backgroundIndex: backgroundData?.index ?? null,
      backgroundFeature: backgroundFeature ?? null,
      alignment,
      xp: 0,
      portrait: null,
      size,
      languages,
    },
    stats: {
      abilityScores,
      savingThrows,
      skills,
      proficiencies,
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
    racialTraits,
    spells: {
      spellcastingAbility: SPELLCASTING_ABILITY[classData?.index] ?? null,
      slots: getSlotsForClass(classData?.index ?? null, 1),
      known: [...(startingCantrips ?? []), ...(startingSpells ?? [])],
      prepared: (startingSpells ?? []).map(s => s.index),
      concentration: null,
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
      milestoneMode: false,
    },
  }
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const S = {
  wrap: { padding: '1.5rem 1.5rem 5rem', maxWidth: '520px', margin: '0 auto', color: '#e8e0f0', fontFamily: 'system-ui, sans-serif' },
  h1: { fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.25rem', color: '#c9b8ff' },
  sub: { fontSize: '0.85rem', color: '#888', marginBottom: '1.5rem' },
  label: { display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '0.3rem', marginTop: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { width: '100%', padding: '0.55rem 0.75rem', background: '#12122a', border: '1px solid #333', color: '#e8e0f0', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' },
  card: (selected) => ({
    padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer', marginBottom: '0.5rem',
    background: selected ? '#1e1560' : '#1a1a35',
    border: selected ? '1px solid #7c5fff' : '1px solid #2a2a4a',
    transition: 'all 0.15s',
  }),
  cardName: { fontWeight: 600, fontSize: '0.95rem' },
  cardSub: { fontSize: '0.78rem', color: '#888', marginTop: '0.2rem' },
  row: { display: 'flex', gap: '0.75rem', marginTop: '1.5rem' },
  btn: (primary) => ({
    flex: primary ? 2 : 1, padding: '0.65rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
    background: primary ? '#6c3fff' : '#1a1a35',
    color: primary ? '#fff' : '#aaa',
    border: primary ? 'none' : '1px solid #333',
  }),
  progress: { display: 'flex', gap: '0.35rem', marginBottom: '1.5rem' },
  dot: (active, done) => ({
    height: '4px', flex: 1, borderRadius: '2px',
    background: done ? '#6c3fff' : active ? '#9d7aff' : '#2a2a4a',
    transition: 'background 0.2s',
  }),
  checkRow: { display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.75rem', borderRadius: '6px', cursor: 'pointer', marginBottom: '0.35rem', background: '#1a1a35', border: '1px solid #2a2a4a' },
  tag: { display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '4px', background: '#1e1560', border: '1px solid #3a2a80', fontSize: '0.75rem', color: '#c9b8ff', marginRight: '0.35rem', marginTop: '0.35rem' },
  featureBox: { background: '#0f0f25', border: '1px solid #2a2a4a', borderRadius: '8px', padding: '1rem', marginTop: '0.75rem' },
  featureName: { fontWeight: 700, color: '#c9b8ff', marginBottom: '0.5rem' },
  featureDesc: { fontSize: '0.82rem', color: '#999', lineHeight: 1.5 },
  error: { color: '#ff6b6b', fontSize: '0.85rem', marginTop: '0.75rem' },
  scrollList: { marginTop: '0.5rem' },
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
  for (const b of (raceData?.ability_bonuses ?? []))
    racialBonus[b.ability_score.index] = (racialBonus[b.ability_score.index] ?? 0) + b.bonus
  for (const b of (subraceData?.ability_bonuses ?? []))
    racialBonus[b.ability_score.index] = (racialBonus[b.ability_score.index] ?? 0) + b.bonus
  for (const b of (raceBonusOptions ?? []))
    racialBonus[b.ability_score.index] = (racialBonus[b.ability_score.index] ?? 0) + b.bonus

  const base = method === 'standard'
    ? Object.fromEntries(ABILITIES.map(a => [a, assign[a] ?? null]))
    : method === 'pointbuy' ? pb : manual

  const canNext = method === 'standard'
    ? ABILITIES.every(a => assign[a] != null)
    : method === 'pointbuy'
    ? true
    : ABILITIES.every(a => (manual[a] ?? 0) >= 3 && (manual[a] ?? 0) <= 20)

  const used       = Object.values(assign).filter(Boolean)
  const available  = STANDARD_ARRAY.filter(v => !used.includes(v))
  const pbSpent    = ABILITIES.reduce((s, a) => s + (PB_COST[pb[a]] ?? 0), 0)
  const pbLeft     = 27 - pbSpent

  const handleNext = () => {
    const scores = method === 'standard'
      ? Object.fromEntries(ABILITIES.map(a => [a, assign[a] ?? 10]))
      : method === 'pointbuy' ? { ...pb } : { ...manual }
    onChange(scores)
    onNext()
  }

  const tabBtn = (id, label) => ({
    flex: 1, padding: '0.5rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
    fontWeight: 600, fontSize: '0.82rem', fontFamily: 'system-ui',
    background: method === id ? '#6c3fff' : '#1a1a35',
    color:      method === id ? '#fff'    : '#888',
    border:     method === id ? 'none'    : '1px solid #2a2a4a',
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
          <div style={{ fontSize:'0.8rem', color:'#888', marginBottom:'0.75rem' }}>
            Assign each value to one ability. Values: {STANDARD_ARRAY.join(', ')}.
          </div>
          {ABILITIES.map(a => {
            const bonus = racialBonus[a] ?? 0
            const val   = assign[a]
            const final = val != null ? val + bonus : null
            return (
              <div key={a} style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.5rem' }}>
                <span style={{ width:36, fontSize:'0.8rem', color:'#aaa', fontWeight:700 }}>{ABILITY_LABEL[a]}</span>
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
                <span style={{ width:52, textAlign:'right', fontFamily:'monospace', fontSize:'0.95rem', color: final ? '#c9b8ff' : '#444' }}>
                  {final != null ? `= ${final}` : '—'}
                  {bonus !== 0 && val != null && <span style={{ fontSize:'0.7rem', color:'#7c5fff' }}> (+{bonus})</span>}
                </span>
              </div>
            )
          })}
        </>
      )}

      {/* ── Point Buy ── */}
      {method === 'pointbuy' && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.82rem', color:'#888', marginBottom:'0.75rem' }}>
            <span>27-point budget. Scores 8–15 before racial bonuses.</span>
            <span style={{ color: pbLeft === 0 ? '#6fde8f' : pbLeft < 0 ? '#ff6b6b' : '#c9b8ff', fontWeight:700 }}>
              {pbLeft} pts left
            </span>
          </div>
          {ABILITIES.map(a => {
            const bonus = racialBonus[a] ?? 0
            const final = pb[a] + bonus
            return (
              <div key={a} style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.45rem' }}>
                <span style={{ width:36, fontSize:'0.8rem', color:'#aaa', fontWeight:700 }}>{ABILITY_LABEL[a]}</span>
                <button onClick={() => pbAdj(a,-1)} disabled={!pbCanDec(a)}
                  style={{ width:28, height:28, borderRadius:4, border:'1px solid #333', background:'#12122a', color:'#aaa', cursor:'pointer', fontSize:'1rem', fontFamily:'system-ui' }}>−</button>
                <span style={{ width:24, textAlign:'center', fontFamily:'monospace', fontWeight:700, color:'#e8e0f0' }}>{pb[a]}</span>
                <button onClick={() => pbAdj(a,+1)} disabled={!pbCanInc(a)}
                  style={{ width:28, height:28, borderRadius:4, border:'1px solid #333', background:'#12122a', color:'#aaa', cursor:'pointer', fontSize:'1rem', fontFamily:'system-ui' }}>+</button>
                <span style={{ fontSize:'0.75rem', color:'#555', width:32 }}>({PB_COST[pb[a]]}pt)</span>
                <span style={{ marginLeft:'auto', fontFamily:'monospace', fontSize:'0.95rem', color:'#c9b8ff' }}>
                  {final}{bonus !== 0 && <span style={{ fontSize:'0.7rem', color:'#7c5fff' }}> (+{bonus})</span>}
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
            <span style={{ fontSize:'0.8rem', color:'#888' }}>Enter scores or roll 4d6 drop lowest.</span>
            <button
              style={{ padding:'0.35rem 0.75rem', borderRadius:6, border:'1px solid #7c5fff', background:'transparent', color:'#c9b8ff', cursor:'pointer', fontSize:'0.8rem', fontFamily:'system-ui', fontWeight:600 }}
              onClick={() => setManual(Object.fromEntries(ABILITIES.map(a => [a, roll4d6dl()])))}
            >Roll All</button>
          </div>
          {ABILITIES.map(a => {
            const bonus = racialBonus[a] ?? 0
            const val   = manual[a] ?? 10
            return (
              <div key={a} style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.45rem' }}>
                <span style={{ width:36, fontSize:'0.8rem', color:'#aaa', fontWeight:700 }}>{ABILITY_LABEL[a]}</span>
                <span style={{ width:80, fontSize:'0.75rem', color:'#555' }}>{ABILITY_NAME[a]}</span>
                <input
                  type="number" min="3" max="20"
                  style={{ ...S.input, width:70, padding:'0.4rem 0.5rem', textAlign:'center', fontFamily:'monospace' }}
                  value={val}
                  onChange={e => setManual(p => ({ ...p, [a]: Math.max(1, Math.min(20, Number(e.target.value))) }))}
                />
                <button
                  style={{ padding:'0.3rem 0.6rem', borderRadius:4, border:'1px solid #333', background:'#12122a', color:'#888', cursor:'pointer', fontSize:'0.75rem', fontFamily:'system-ui' }}
                  onClick={() => setManual(p => ({ ...p, [a]: roll4d6dl() }))}
                >Roll</button>
                <span style={{ marginLeft:'auto', fontFamily:'monospace', fontSize:'0.95rem', color:'#c9b8ff' }}>
                  {val + bonus}{bonus !== 0 && <span style={{ fontSize:'0.7rem', color:'#7c5fff' }}> (+{bonus})</span>}
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
      <div style={S.h1}>⚔️ New Character</div>
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
  const filtered = races.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={S.wrap}>
      <div style={S.h1}>Choose a Race</div>
      <div style={S.sub}>Your race shapes your innate abilities and traits.</div>
      <input style={S.input} placeholder="Search races…" value={search} onChange={e => setSearch(e.target.value)} />
      <div style={S.scrollList}>
        {filtered.map(r => (
          <div key={r.index} style={S.card(selected?.index === r.index)} onClick={() => onSelect(r)}>
            <div style={S.cardName}>{r.name}</div>
            <div style={S.cardSub}>
              Speed {r.speed}ft · {r.size}
              {r.ability_bonuses?.map(b => ` · +${b.bonus} ${b.ability_score.name}`).join('')}
              {r.subraces?.length > 0 && ` · ${r.subraces.length} subrace${r.subraces.length > 1 ? 's' : ''}`}
            </div>
            {selected?.index === r.index && r.traits?.length > 0 && (
              <div style={{ marginTop: '0.4rem' }}>
                {r.traits.map(t => <span key={t.index} style={S.tag}>{t.name}</span>)}
              </div>
            )}
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

function StepSubrace({ race, subraces, selected, onSelect, bonusOptions, onBonusOptions, onNext, onBack }) {
  // Filter subraces for this race
  const available = subraces.filter(s => s.race?.index === race.index)

  // Half-Elf style: ability_bonus_options on the race itself
  const hasBonusOptions = !!race.ability_bonus_options
  const bonusCount = race.ability_bonus_options?.choose ?? 0
  const bonusPool = race.ability_bonus_options?.from?.options ?? []

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

  return (
    <div style={S.wrap}>
      <div style={S.h1}>Subrace & Racial Options</div>
      <div style={S.sub}>{race.name} has additional choices.</div>

      {available.length > 0 && (
        <>
          <label style={S.label}>Choose a Subrace</label>
          {available.map(s => (
            <div key={s.index} style={S.card(selected?.index === s.index)} onClick={() => onSelect(s)}>
              <div style={S.cardName}>{s.name}</div>
              <div style={S.cardSub}>
                {s.ability_bonuses?.map(b => `+${b.bonus} ${b.ability_score.name}`).join(' · ')}
              </div>
              {selected?.index === s.index && s.racial_traits?.length > 0 && (
                <div style={{ marginTop: '0.4rem' }}>
                  {s.racial_traits.map(t => <span key={t.index} style={S.tag}>{t.name}</span>)}
                </div>
              )}
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
              <div key={i} style={{ ...S.checkRow, border: checked ? '1px solid #7c5fff' : '1px solid #2a2a4a' }} onClick={() => toggleBonus(opt)}>
                <span style={{ color: checked ? '#c9b8ff' : '#666', fontSize: '1.1rem' }}>{checked ? '◉' : '○'}</span>
                <span>+{opt.bonus} {opt.ability_score.name}</span>
              </div>
            )
          })}
        </>
      )}

      <div style={S.row}>
        <button style={S.btn(false)} onClick={onBack}>← Back</button>
        <button style={S.btn(true)} onClick={onNext} disabled={!canProceed || !bonusReady}>Next: Class →</button>
      </div>
    </div>
  )
}

// ─── Step: Starting Spells ────────────────────────────────────────────────────

function SpellPicker({ label, spells, selected, max, onToggle }) {
  const [search, setSearch] = useState('')
  const filtered = spells.filter(s => s.name.toLowerCase().includes(search.toLowerCase())).slice(0, 80)
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
        <label style={S.label}>{label}</label>
        <span style={{ fontSize:'0.75rem', color: selected.length === max ? '#6fde8f' : '#888' }}>
          {selected.length} / {max}
        </span>
      </div>
      <input style={{ ...S.input, marginBottom:'0.4rem' }} placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
      <div style={{ maxHeight: 200, overflowY:'auto', border:'1px solid #2a2a4a', borderRadius:6 }}>
        {filtered.map(sp => {
          const sel = selected.some(s => s.index === sp.index)
          const disabled = !sel && selected.length >= max
          return (
            <div key={sp.index}
              style={{ display:'flex', alignItems:'center', gap:'0.6rem', padding:'0.45rem 0.75rem',
                background: sel ? '#1e1560' : 'transparent',
                borderBottom:'1px solid #1a1a35', cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.4 : 1 }}
              onClick={() => !disabled && onToggle(sp)}
            >
              <span style={{ color: sel ? '#c9b8ff' : '#555', fontSize:'1rem', lineHeight:1 }}>{sel ? '◉' : '○'}</span>
              <span style={{ fontSize:'0.87rem', fontWeight: sel ? 600 : 400, color: sel ? '#e8e0f0' : '#aaa' }}>{sp.name}</span>
              {sp.level === 0 && <span style={{ fontSize:'0.7rem', color:'#7c5fff', marginLeft:'auto' }}>cantrip</span>}
              {sp.level > 0  && <span style={{ fontSize:'0.7rem', color:'#555', marginLeft:'auto' }}>Lv {sp.level}</span>}
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
      onCantrips([...selectedCantrips, { id: sp.index, index: sp.index, name: sp.name, level: 0 }])
  }
  const toggleSpell = (sp) => {
    if (selectedSpells.some(s => s.index === sp.index))
      onSpells(selectedSpells.filter(s => s.index !== sp.index))
    else if (selectedSpells.length < spellMax)
      onSpells([...selectedSpells, { id: sp.index, index: sp.index, name: sp.name, level: sp.level }])
  }

  const cantripDone = cantripMax === 0 || selectedCantrips.length === cantripMax
  const spellDone   = spellMax   === 0 || selectedSpells.length   === spellMax

  return (
    <div style={S.wrap}>
      <div style={S.h1}>Starting Spells — {classData?.name}</div>
      <div style={S.sub}>Choose your starting cantrips and spells.</div>

      {allSpells.length === 0 && <div style={{ color:'#888', fontSize:'0.85rem' }}>Loading spells…</div>}

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
  const filtered = classes.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={S.wrap}>
      <div style={S.h1}>Choose a Class</div>
      <div style={S.sub}>Your class defines your combat role and abilities.</div>
      <input style={S.input} placeholder="Search classes…" value={search} onChange={e => setSearch(e.target.value)} />
      <div style={S.scrollList}>
        {filtered.map(c => (
          <div key={c.index} style={S.card(selected?.index === c.index)} onClick={() => onSelect(c)}>
            <div style={S.cardName}>{c.name}</div>
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

// Fetch all items in an equipment category from the SRD
async function fetchCategoryItems(categoryIndex) {
  const BASE = 'https://raw.githubusercontent.com/Teggimon/ttrpg-srd-content/master/5e_PHB_2014'
  try {
    const res = await fetch(`${BASE}/5e-SRD-Equipment.json`)
    if (!res.ok) return []
    const all = await res.json()
    return all.filter(item => item.equipment_category?.index === categoryIndex)
      .map(item => ({ index: item.index, name: item.name, quantity: 1 }))
  } catch { return [] }
}

function StepClassSetup({ classData, selectedSkills, onSkillsChange, selectedEquipment, onEquipmentChange, onNext, onBack }) {
  const [categoryItems, setCategoryItems] = useState({}) // { choiceId: [items] }
  const [expandedChoice, setExpandedChoice] = useState(null) // choiceId being expanded

  const profChoices = classData.proficiency_choices?.filter(pc => pc.type === 'proficiencies') ?? []
  const equipOptions = classData.starting_equipment_options ?? []

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
  const expandCategory = async (choice, groupIndex) => {
    setExpandedChoice(choice.id)
    if (categoryItems[choice.id]) return // already loaded
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
          style={{ ...S.checkRow, opacity: disabled ? 0.4 : 1, border: checked ? '1px solid #7c5fff' : '1px solid #2a2a4a' }}
          onClick={() => !disabled && toggleSkill(gi, skillIndex)}
        >
          <span style={{ color: checked ? '#c9b8ff' : '#666', fontSize: '1.1rem' }}>{checked ? '◉' : '○'}</span>
          <span>{o.item.name.replace('Skill: ', '')}</span>
        </div>
      )
    })}
  </div>
))}

      {/* Equipment choices */}
      {equipGroups.map((group) => (
        <div key={group.groupIndex}>
          <label style={S.label}>Choose Starting Equipment</label>
          <div style={S.cardSub}>{group.desc}</div>
          {group.choices.map(choice => {
            const checked = selectedEquipment.some(e => e.groupIndex === group.groupIndex && e.choiceId === choice.id)
            const isExpanded = expandedChoice === choice.id
            const catItems = categoryItems[choice.id] ?? []

            if (choice.isCategory) {
              const choose = choice.choose ?? 1
              const selectedForChoice = selectedEquipment.filter(e => e.groupIndex === group.groupIndex && e.choiceId === choice.id)
              const choiceComplete = selectedForChoice.length >= choose
              return (
                <div key={choice.id}>
                  <div
                    style={{ ...S.card(choiceComplete), opacity: 1, cursor: 'pointer' }}
                    onClick={() => expandCategory(choice, group.groupIndex)}
                  >
                    <div style={S.cardName}>{choice.label}</div>
                    <div style={S.cardSub}>
                      {isExpanded
                        ? `${selectedForChoice.length}/${choose} selected — choose below ↓`
                        : `Tap to expand · choose ${choose}`}
                    </div>
                  </div>
                  {isExpanded && (
                    <div style={{ paddingLeft: '1rem', marginBottom: '0.5rem' }}>
                      {catItems.length === 0 && <div style={S.cardSub}>Loading…</div>}
                      {catItems.map(item => {
                        const itemChecked = selectedForChoice.some(e => e.index === item.index)
                        const disabled = !itemChecked && selectedForChoice.length >= choose
                        return (
                          <div
                            key={item.index}
                            style={{ ...S.checkRow, opacity: disabled ? 0.4 : 1, border: itemChecked ? '1px solid #7c5fff' : '1px solid #2a2a4a', marginBottom: '0.35rem' }}
                            onClick={() => {
                              if (disabled) return
                              const withoutThis = selectedEquipment.filter(e => !(e.groupIndex === group.groupIndex && e.choiceId === choice.id && e.index === item.index))
                              if (itemChecked) {
                                onEquipmentChange(withoutThis)
                              } else {
                                onEquipmentChange([...withoutThis, { ...item, groupIndex: group.groupIndex, choiceId: choice.id }])
                              }
                            }}
                          >
                            <span style={{ color: itemChecked ? '#c9b8ff' : '#666', fontSize: '1.1rem' }}>{itemChecked ? '◉' : '○'}</span>
                            <span>{item.name}</span>
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
                style={{ ...S.card(checked) }}
                onClick={() => {
                  const without = selectedEquipment.filter(e => e.groupIndex !== group.groupIndex)
                  onEquipmentChange([...without, ...choice.items.map(item => ({ ...item, groupIndex: group.groupIndex, choiceId: choice.id }))])
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
        <button style={S.btn(true)} onClick={onNext} disabled={!allSkillsSelected || !allEquipSelected}>
          Next: Background →
        </button>
      </div>
      {(!allSkillsSelected || !allEquipSelected) && (
        <div style={{ fontSize: '0.78rem', color: '#888', marginTop: '0.5rem' }}>
          {!allSkillsSelected && <div>⚠ Skills not complete ({allSkillGroups.map(g => `${selectedSkills.filter(s => g.options.some(o => o.item.index === s)).length}/${g.choose}`).join(', ')})</div>}
          {!allEquipSelected && <div>⚠ Equipment not complete — groups: {equipGroups.length}, selected groupIndexes: [{selectedEquipment.map(e => e.groupIndex).join(', ')}]</div>}
        </div>
      )}
    </div>
  )
}

// ─── Step 6: Background ───────────────────────────────────────────────────────

function StepBackground({ backgrounds, selected, onSelect, onNext, onBack }) {
  const [search, setSearch] = useState('')
  const filtered = backgrounds.filter(b => b.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={S.wrap}>
      <div style={S.h1}>Choose a Background</div>
      <div style={S.sub}>Your background reflects your life before adventuring.</div>
      <input style={S.input} placeholder="Search backgrounds…" value={search} onChange={e => setSearch(e.target.value)} />
      <div style={S.scrollList}>
        {filtered.map(b => (
          <div key={b.index} style={S.card(selected?.index === b.index)} onClick={() => onSelect(b)}>
            <div style={S.cardName}>{b.name}</div>
            <div style={S.cardSub}>
              Skills: {b.starting_proficiencies?.filter(p => p.index.startsWith('skill-')).map(p => p.name.replace('Skill: ', '')).join(', ')}
            </div>
            {selected?.index === b.index && b.feature && (
              <div style={S.featureBox}>
                <div style={S.featureName}>Feature: {b.feature.name}</div>
                <div style={S.featureDesc}>{b.feature.desc?.[0]}</div>
              </div>
            )}
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
    let choices = []
    if (opt.from?.option_set_type === 'options_array') {
      choices = (opt.from.options ?? []).map((o, oi) => {
        if (o.option_type === 'counted_reference') {
          const idx = o.of?.index ?? `__ref__${gi}_${oi}`
          const name = o.of?.name ?? 'Item'
          return { id: `${gi}_${oi}`, label: o.count > 1 ? `${name} ×${o.count}` : name, items: [{ index: idx, name, quantity: o.count ?? 1 }], isChoice: false }
        }
        if (o.option_type === 'multiple') {
          const parts = (o.items ?? []).filter(i => i.option_type === 'counted_reference').map(i => ({ index: i.of?.index ?? `__multi__${gi}_${oi}`, name: i.of?.name ?? 'Item', quantity: i.count ?? 1 }))
          const label = parts.map(p => p.quantity > 1 ? `${p.name} ×${p.quantity}` : p.name).join(' + ')
          return { id: `${gi}_${oi}`, label, items: parts, isChoice: false }
        }
        if (o.option_type === 'choice') {
          const desc = o.choice?.desc ?? 'Any item'
          return { id: `${gi}_${oi}`, label: desc, items: [], isChoice: true, choiceDesc: desc }
        }
        return null
      }).filter(Boolean)
    } else {
      const desc = `Any ${opt.from?.equipment_category?.name ?? 'item'}`
      choices = [{ id: `${gi}_0`, label: desc, items: [{ index: `__category__${gi}`, name: desc, quantity: 1 }], isChoice: true, choiceDesc: desc }]
    }
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
                style={{ ...S.checkRow, opacity: disabled ? 0.4 : 1, border: checked ? '1px solid #7c5fff' : '1px solid #2a2a4a' }}
                onClick={() => !disabled && toggleLang(name)}
              >
                <span style={{ color: checked ? '#c9b8ff' : '#666', fontSize: '1.1rem' }}>{checked ? '◉' : '○'}</span>
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
          ? <><em style={{ color: '#c9b8ff' }}>{raceData.name} tendency:</em> {raceData.alignment}</>
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

const STEP_LABELS = ['Name', 'Race', 'Subrace', 'Class', 'Class Setup', 'Background', 'BG Setup', 'Alignment']

function ProgressBar({ step, totalSteps }) {
  return (
    <div style={{ padding: '1rem 1.5rem 0', maxWidth: '520px', margin: '0 auto' }}>
      <div style={S.progress}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} style={S.dot(i === step, i < step)} />
        ))}
      </div>
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

function CreateCharacter({ token, user, onComplete, onCancel }) {
  const [step, setStep] = useState(0)
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)

  // SRD data
  const [races, setRaces] = useState([])
  const [allSubraces, setAllSubraces] = useState([])
  const [classes, setClasses] = useState([])
  const [backgrounds, setBackgrounds] = useState([])

  // Wizard state
  const [name, setName] = useState('')
  const [raceData, setRaceData] = useState(null)
  const [subraceData, setSubraceData] = useState(null)
  const [raceBonusOptions, setRaceBonusOptions] = useState([])
  const [classData, setClassData] = useState(null)
  const [subclassChoice, setSubclassChoice] = useState(null)
  const [classSkills, setClassSkills] = useState([])
  const [classEquipment, setClassEquipment] = useState([])
  const [abilityScores, setAbilityScores] = useState({ str:10, dex:10, con:10, int:10, wis:10, cha:10 })
  const [startingCantrips, setStartingCantrips] = useState([])
  const [startingSpells,   setStartingSpells]   = useState([])
  const [backgroundData, setBackgroundData] = useState(null)
  const [backgroundLanguages, setBackgroundLanguages] = useState([])
  const [backgroundEquipment, setBackgroundEquipment] = useState([])
  const [alignment, setAlignment] = useState('')

  const octokit = new Octokit({ auth: token })
  const repoName = localStorage.getItem('character_repo')

  useEffect(() => {
    Promise.all([getRaces(), getSubraces(), getClasses(), getBackgrounds()])
      .then(([r, s, c, b]) => { setRaces(r); setAllSubraces(s); setClasses(c); setBackgrounds(b) })
      .catch(err => setError(err.message))
  }, [])

  const hasSubrace = raceData?.subraces?.length > 0 || !!raceData?.ability_bonus_options
  const hasSubclassAtCreation = !!(classData && (SUBCLASS_LEVELS[classData.index] ?? []).includes(1))
  const isSpellcaster = !!(classData && (CANTRIPS_KNOWN[classData.index] || SPELLS_KNOWN_L1[classData.index]))

  // Compute step indices dynamically
  const STEP_NAME       = 0
  const STEP_RACE       = 1
  const STEP_SUBRACE    = 2                                        // may be skipped
  const STEP_CLASS      = hasSubrace ? 3 : 2
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
        choices: {
          raceBonusOptions,
          classSkills,
          classEquipment: classEquipment.filter(e => !e.index.startsWith('__')),
          backgroundLanguages,
          backgroundEquipment: backgroundEquipment.filter(e => !e.index.startsWith('__')),
          backgroundFeature: backgroundData?.feature ?? null,
        },
      })
      const fileName = name.toLowerCase().replace(/\s+/g, '-')
      await octokit.repos.createOrUpdateFileContents({
        owner: user.login,
        repo: repoName,
        path: `characters/${fileName}.json`,
        message: `Add character: ${name}`,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(character, null, 2)))),
      })
      onComplete(character)
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
  }

  // When class changes, reset downstream
  const selectClass = (c) => {
    setClassData(c)
    setSubclassChoice(null)
    setClassSkills([])
    setClassEquipment([])
    setStartingCantrips([])
    setStartingSpells([])
  }

  // When background changes, reset downstream
  const selectBackground = (b) => {
    setBackgroundData(b)
    setBackgroundLanguages([])
    setBackgroundEquipment([])
  }

  return (
    <>
      <ProgressBar step={step} totalSteps={TOTAL_STEPS} />

      {step === STEP_NAME && (
        <StepName value={name} onChange={setName} onNext={() => goTo(STEP_RACE)} onCancel={onCancel} />
      )}

      {step === STEP_RACE && (
        <StepRace
          races={races}
          selected={raceData}
          onSelect={selectRace}
          onNext={() => goTo(hasSubrace ? STEP_SUBRACE : STEP_CLASS)}
          onBack={() => goTo(STEP_NAME)}
        />
      )}

      {step === STEP_SUBRACE && (
        <StepSubrace
          race={raceData}
          subraces={allSubraces}
          selected={subraceData}
          onSelect={setSubraceData}
          bonusOptions={raceBonusOptions}
          onBonusOptions={setRaceBonusOptions}
          onNext={() => goTo(STEP_CLASS)}
          onBack={() => goTo(STEP_RACE)}
        />
      )}

      {step === STEP_CLASS && (
        <StepClass
          classes={classes}
          selected={classData}
          onSelect={selectClass}
          onNext={() => goTo(hasSubclassAtCreation ? STEP_SUBCLASS : STEP_CLASS_SETUP)}
          onBack={() => goTo(hasSubrace ? STEP_SUBRACE : STEP_RACE)}
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
        <div style={{ ...S.wrap, paddingTop: 0 }}>
          <div style={S.error}>⚠ {error}</div>
        </div>
      )}
    </>
  )
}

export default CreateCharacter

import { useState, useEffect } from 'react'
import { Octokit } from '@octokit/rest'
import { v4 as uuidv4 } from 'uuid'
import { getClasses, getRaces, getBackgrounds } from './srdContent'

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

function buildCharacter({ user, name, raceData, subraceData, classData, backgroundData, alignment, choices }) {
  const {
    raceBonusOptions = [],   // [{ability_score:{index}, bonus}]
    classSkills = [],        // ['skill-perception', ...]
    classEquipment = [],     // [{index, name, quantity}]
    backgroundLanguages = [],
    backgroundEquipment = [],
    backgroundFeature = null,
  } = choices

  // 1. Base ability scores
  const abilityScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }

  // 2. Race ability bonuses (fixed)
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
    if (item.index?.startsWith('__choice__')) continue  // category placeholder — skip
    inventory.push({ index: item.index, name: item.name, quantity: item.quantity ?? 1, equipped: false })
  }
  for (const item of (backgroundData?.starting_equipment ?? [])) {
    inventory.push({ index: item.equipment.index, name: item.equipment.name, quantity: item.quantity, equipped: false })
  }
  for (const item of backgroundEquipment) {
    if (item.index?.startsWith('__choice__')) continue  // category placeholder — skip
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
      class: [{ name: classData?.name ?? '', index: classData?.index ?? null, level: 1 }],
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
      slots: {},
      known: [],
      prepared: [],
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

function StepClassSetup({ classData, selectedSkills, onSkillsChange, selectedEquipment, onEquipmentChange, onNext, onBack }) {
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

  // Build equipment option groups. Each selectable "choice" is one card.
  // option_type === 'multiple' → bundle (array of items) shown as one card
  // option_type === 'choice'   → category pick (any simple weapon, etc.)
  // option_type === 'counted_reference' → single item
  const parseEquipOption = (o, gi, oi) => {
    if (o.option_type === 'counted_reference') {
      const name = o.of?.name ?? 'Unknown item'
      const idx = o.of?.index ?? `__ref__${gi}_${oi}`
      // Holy symbol / undefined items become a generic placeholder
      const resolvedIdx = idx === 'holy-symbol' || !o.of?.index ? 'holy-symbol' : idx
      const resolvedName = resolvedIdx === 'holy-symbol' ? 'Holy Symbol' : name
      return { id: `${gi}_${oi}`, label: o.count > 1 ? `${resolvedName} ×${o.count}` : resolvedName, items: [{ index: resolvedIdx, name: resolvedName, quantity: o.count ?? 1 }], isChoice: false }
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
  }

  const equipGroups = equipOptions.map((opt, gi) => {
    const choices = (opt.from?.options ?? []).map((o, oi) => parseEquipOption(o, gi, oi)).filter(Boolean)
    return { desc: opt.desc, choices, groupIndex: gi }
  }).filter(g => g.choices.length > 0)  // skip groups with no selectable options

  const allSkillsSelected = allSkillGroups.every(g => {
    const count = selectedSkills.filter(s => g.options.some(o => o.item.index === s)).length
    return count >= g.choose
  })
  // Next is enabled when every equip group has a selection (matched by groupIndex)
  const allEquipSelected = equipGroups.every(g => selectedEquipment.some(e => e.groupIndex === g.groupIndex))

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
            return (
              <div
                key={choice.id}
                style={{ ...S.card(checked) }}
                onClick={() => {
                  const without = selectedEquipment.filter(e => e.groupIndex !== group.groupIndex)
                  if (choice.isChoice) {
                    // Category pick — store a placeholder, user can edit later
                    onEquipmentChange([...without, { index: `__choice__${choice.id}`, name: choice.choiceDesc, quantity: 1, groupIndex: group.groupIndex, choiceId: choice.id }])
                  } else {
                    // Store all bundle items under this choice
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
  const [classSkills, setClassSkills] = useState([])
  const [classEquipment, setClassEquipment] = useState([])
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

  // Compute step indices dynamically
  const STEP_NAME = 0
  const STEP_RACE = 1
  const STEP_SUBRACE = 2          // may be skipped
  const STEP_CLASS = hasSubrace ? 3 : 2
  const STEP_CLASS_SETUP = hasSubrace ? 4 : 3
  const STEP_BACKGROUND = hasSubrace ? 5 : 4
  const STEP_BG_SETUP = hasSubrace ? 6 : 5
  const STEP_ALIGNMENT = hasSubrace ? 7 : 6
  const TOTAL_STEPS = hasSubrace ? 8 : 7

  const finish = async () => {
    setCreating(true)
    setError(null)
    try {
      const character = buildCharacter({
        user, name,
        raceData, subraceData, classData, backgroundData, alignment,
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
    setClassSkills([])
    setClassEquipment([])
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
          onNext={() => goTo(STEP_CLASS_SETUP)}
          onBack={() => goTo(hasSubrace ? STEP_SUBRACE : STEP_RACE)}
        />
      )}

      {step === STEP_CLASS_SETUP && classData && (
        <StepClassSetup
          classData={classData}
          selectedSkills={classSkills}
          onSkillsChange={setClassSkills}
          selectedEquipment={classEquipment}
          onEquipmentChange={setClassEquipment}
          onNext={() => goTo(STEP_BACKGROUND)}
          onBack={() => goTo(STEP_CLASS)}
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

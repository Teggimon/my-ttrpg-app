import { useState, useEffect, useRef } from 'react'
import { getSpells } from '../srdContent'
import { ALL_SOURCES, filterBySearchAndSource, sourceCode, sourceOptions } from '../sourceFilters'
import '../TabShared.css'
import './SpellsTab.css'

const ORDINALS    = ['','I','II','III','IV','V','VI','VII','VIII','IX']
const PROFICIENCY = [0,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6]
const SCHOOLS = ['Abjuration','Conjuration','Divination','Enchantment','Evocation','Illusion','Necromancy','Transmutation']
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
const PREPARED_CASTER_RULES = {
  cleric: { ability: 'wis', levelFactor: 1, startsAt: 1 },
  druid: { ability: 'wis', levelFactor: 1, startsAt: 1 },
  wizard: { ability: 'int', levelFactor: 1, startsAt: 1 },
  paladin: { ability: 'cha', levelFactor: 0.5, startsAt: 2 },
  artificer: { ability: 'int', levelFactor: 0.5, startsAt: 1, round: 'up' },
}

// Max slots per level for full-casters (used as reference for slot editor)
const MAX_SLOTS = [0, 4, 3, 3, 3, 3, 2, 2, 1, 1]

function abilityMod(score) { return Math.floor((score - 10) / 2) }
function fmtB(n)            { return n >= 0 ? `+${n}` : `${n}` }
function uid()              { return Math.random().toString(36).slice(2) }
function characterLevel(char) {
  return (char.identity?.class ?? []).reduce((sum, cls) => sum + (cls.level ?? 0), 0) || 1
}
function hasFeat(char, featName) {
  return (char.feats ?? []).some(feat => feat.name === featName)
}
function featChoice(char, featName) {
  return (char.customContent?.featChoices ?? []).find(choice => choice.featName === featName)
}
function classLabel(index) {
  return String(index ?? '')
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
function spellNames(spells = []) {
  return spells.map(spell => spell.name).filter(Boolean).join(', ')
}
function featureKey(name) {
  return String(name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
}
function isPreparedSpell(spell, prepared) {
  return spell?.level === 0 || spell?.alwaysPrepared || prepared.includes(spell?.id)
}
function isConcentrationSpell(srdSpell) {
  return !!srdSpell?.concentration || String(srdSpell?.duration ?? '').toLowerCase().includes('concentration')
}
function classIndex(cls) {
  return cls?.index ?? cls?.name?.toLowerCase?.().replace(/\s+/g, '-')
}
function preparedCapacity(char) {
  const scores = char.stats?.abilityScores ?? {}
  const caps = (char.identity?.class ?? []).map(cls => {
    const rule = PREPARED_CASTER_RULES[classIndex(cls)]
    const level = cls.level ?? 0
    if (!rule || level < rule.startsAt) return 0
    const scaledLevel = rule.round === 'up'
      ? Math.ceil(level * rule.levelFactor)
      : Math.floor(level * rule.levelFactor)
    return Math.max(1, scaledLevel + abilityMod(scores[rule.ability] ?? 10))
  })
  return caps.some(cap => cap > 0) ? caps.reduce((sum, cap) => sum + cap, 0) : null
}
function defaultSpellClass(char, srdSpell) {
  const characterClasses = new Set((char.identity?.class ?? []).map(classIndex))
  const matches = (srdSpell.classes ?? [])
    .map(cls => cls.index)
    .filter(index => characterClasses.has(index) && SPELLCASTING_ABILITY[index])
  return matches.length === 1 ? matches[0] : null
}
function spellCastingAbility(spell, char) {
  return spell.castingAbility
    ?? SPELLCASTING_ABILITY[spell.classIndex]
    ?? char.spells?.spellcastingAbility
    ?? null
}

// ── Spell Picker ────────────────────────────────────────────────────────────
function SpellPicker({ srdSpells, knownIds, onAdd, onClose }) {
  const [search,      setSearch]      = useState('')
  const [filterLevel, setFilterLevel] = useState('all')
  const [sourceFilter, setSourceFilter] = useState(ALL_SOURCES)
  const [sourceOpen, setSourceOpen] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const levels = ['all', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
  const sources = sourceOptions(srdSpells)

  const results = filterBySearchAndSource(srdSpells, search, sourceFilter).filter(s => {
    if (knownIds.has(s.index)) return false
    if (filterLevel !== 'all' && String(s.level) !== filterLevel) return false
    return true
  }).slice(0, 50)

  return (
    <div className="spell-picker">
      <div className="spell-picker-head">
        <div className="spell-picker-search-wrap">
          <input
            ref={inputRef}
            className="spell-picker-search"
            placeholder="Search spells…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="spell-picker-clear" type="button" onClick={() => setSearch('')} aria-label="Clear search">×</button>
          )}
        </div>
        {sources.length > 1 && (
          <div className="spell-picker-source-wrap">
            <button
              type="button"
              className={`spell-picker-source-filter${sourceFilter !== ALL_SOURCES ? ' spell-picker-source-filter--active' : ''}`}
              onClick={() => setSourceOpen(open => !open)}
              aria-label="Filter sources"
            >
              {sourceFilter === ALL_SOURCES ? 'Filter' : sourceFilter}
            </button>
            {sourceOpen && (
              <div className="spell-picker-source-menu">
                {[ALL_SOURCES, ...sources].map(source => (
                  <button
                    key={source}
                    type="button"
                    className={`spell-picker-source-option${sourceFilter === source ? ' spell-picker-source-option--active' : ''}`}
                    onClick={() => { setSourceFilter(source); setSourceOpen(false) }}
                  >
                    {source === ALL_SOURCES ? 'All sources' : source}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button type="button" className="spell-picker-close" onClick={onClose}>✕</button>
      </div>
      <div className="spell-picker-levels">
        {levels.map(l => (
          <button
            type="button"
            key={l}
            className={`filter-chip${filterLevel === l ? ' filter-chip--on' : ''}`}
            onClick={() => setFilterLevel(l)}
          >
            {l === 'all' ? 'All' : l === '0' ? 'Cantrip' : `Lv ${l}`}
          </button>
        ))}
      </div>
      <div className="spell-picker-list">
        {results.length === 0 && <p className="empty-hint">No spells match.</p>}
        {results.map(s => (
          <button type="button" key={s.index} className="spell-picker-row" onClick={() => onAdd(s)}>
            <span className="spell-picker-name">{s.name}</span>
            <span className="spell-picker-meta">
              <span className="spell-picker-source">{sourceCode(s)}</span>
              {s.level === 0 ? 'Cantrip' : `Lv ${s.level}`} · {s.school?.name}
            </span>
          </button>
        ))}
        {results.length === 50 && <p className="empty-hint spell-picker-limit">Showing first 50 — refine search.</p>}
      </div>
    </div>
  )
}

// ── Slot Editor ─────────────────────────────────────────────────────────────
function SlotEditor({ slots, pactSlots, onSave, onClose }) {
  const [draft, setDraft] = useState(() => {
    const d = {}
    for (let i = 1; i <= 9; i++) d[i] = slots[i]?.total ?? 0
    return d
  })

  const save = () => {
    const next = {}
    for (let i = 1; i <= 9; i++) {
      if (draft[i] > 0) next[i] = { total: draft[i], used: Math.min(slots[i]?.used ?? 0, draft[i]) }
    }
    onSave(next, pactSlots)
  }

  return (
    <div className="slot-editor">
      <div className="slot-editor-head">
        <span className="slot-editor-title">Configure Spell Slots</span>
        <button type="button" className="spell-picker-close" onClick={onClose}>✕</button>
      </div>
      <div className="slot-editor-grid">
        {[1,2,3,4,5,6,7,8,9].map(lvl => (
          <div key={lvl} className="slot-editor-row">
            <span className="slot-editor-lbl">{ORDINALS[lvl]}</span>
            <div className="slot-editor-btns">
              <button type="button" className="slot-adj-btn" onClick={() => setDraft(d => ({ ...d, [lvl]: Math.max(0, d[lvl] - 1) }))}>−</button>
              <span className="slot-editor-val">{draft[lvl]}</span>
              <button type="button" className="slot-adj-btn" onClick={() => setDraft(d => ({ ...d, [lvl]: Math.min(MAX_SLOTS[lvl] ?? 4, d[lvl] + 1) }))}>+</button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="spell-prep-btn spell-prep-btn--on slot-editor-save" onClick={save}>
        Save Slots
      </button>
    </div>
  )
}

// ── Main tab ────────────────────────────────────────────────────────────────
export default function SpellsTab({ char, locked, isOwner, updateChar }) {
  const [expandedId,     setExpandedId]     = useState(null)
  const [showUnprepared, setShowUnprepared] = useState(false)
  const [filterSchool,   setFilterSchool]   = useState('All')
  const [srdSpellMap,    setSrdSpellMap]    = useState({})
  const [allSrdSpells,   setAllSrdSpells]   = useState([])
  const [showPicker,     setShowPicker]     = useState(false)
  const [showSlotEditor, setShowSlotEditor] = useState(false)
  const [castSlots,      setCastSlots]      = useState({})

  const known    = char.spells?.known    ?? []
  const prepared = char.spells?.prepared ?? []
  const slots    = char.spells?.slots    ?? {}
  const pactSlots = char.spells?.pactSlots ?? {}
  const castAbility = char.spells?.spellcastingAbility
  const level    = characterLevel(char)
  const pb       = PROFICIENCY[level] ?? 2
  const scores   = char.stats?.abilityScores ?? {}

  const castMod  = castAbility ? abilityMod(scores[castAbility] ?? 10) : null
  const spellDC  = castMod != null ? 8 + pb + castMod : null
  const spellAtk = castMod != null ? pb + castMod : null

  const slotEntries = Object.entries(slots)
    .filter(([, v]) => v.total > 0)
    .sort(([a], [b]) => Number(a) - Number(b))
  const pactSlotEntries = Object.entries(pactSlots)
    .filter(([, v]) => v.total > 0)
    .sort(([a], [b]) => Number(a) - Number(b))
  const storedAbilities = char.combat?.classAbilities ?? char.classAbilities ?? []
  const storedAbilityMap = Object.fromEntries(storedAbilities.flatMap(ability => [
    [featureKey(ability.name), ability],
    ability.key ? [ability.key, ability] : null,
  ].filter(Boolean)))
  const preparedLeveled = known.filter(s => s.level > 0 && prepared.includes(s.id) && !s.alwaysPrepared)
  const preparedMax     = preparedCapacity(char)
  const preparedFull    = preparedMax != null && preparedLeveled.length >= preparedMax
  const preparedOverCap = preparedMax != null && preparedLeveled.length > preparedMax
  const elementalAdeptChoice = featChoice(char, 'Elemental Adept')
  const magicInitiateChoice = featChoice(char, 'Magic Initiate')
  const ritualCasterChoice = featChoice(char, 'Ritual Caster')
  const spellSniperChoice = featChoice(char, 'Spell Sniper')
  const elementalAdeptDamage = elementalAdeptChoice?.damageType
  const magicInitiateSpellIndexes = new Set((magicInitiateChoice?.spells ?? []).map(spell => spell.index))
  const magicInitiateCantripIndexes = new Set((magicInitiateChoice?.cantrips ?? []).map(spell => spell.index))
  const ritualCasterSpellIndexes = new Set((ritualCasterChoice?.spells ?? []).map(spell => spell.index))
  const spellSniperCantripIndexes = new Set((spellSniperChoice?.cantrips ?? []).map(spell => spell.index))
  const magicInitiateUsed = storedAbilityMap['feat-magic-initiate']?.used ?? 0
  const spellFeatNotes = [
    hasFeat(char, 'Elemental Adept') && {
      name: 'Elemental Adept',
      detail: `${elementalAdeptDamage ?? 'Chosen damage type'} spells ignore resistance, and damage dice showing 1 count as 2.`,
    },
    hasFeat(char, 'Magic Initiate') && {
      name: 'Magic Initiate',
      detail: [
        magicInitiateChoice?.spellClass ? `${classLabel(magicInitiateChoice.spellClass)} spell list` : null,
        magicInitiateChoice?.cantrips?.length ? `Cantrips: ${spellNames(magicInitiateChoice.cantrips)}` : null,
        magicInitiateChoice?.spells?.length ? `1/LR: ${spellNames(magicInitiateChoice.spells)}` : null,
      ].filter(Boolean).join(' · ') || 'Two cantrips and one 1st-level spell from a chosen class; the 1st-level spell can be cast once per long rest without a slot.',
    },
    hasFeat(char, 'Ritual Caster') && {
      name: 'Ritual Caster',
      detail: [
        ritualCasterChoice?.spellClass ? `${classLabel(ritualCasterChoice.spellClass)} ritual book` : null,
        ritualCasterChoice?.spells?.length ? `Rituals: ${spellNames(ritualCasterChoice.spells)}` : null,
      ].filter(Boolean).join(' · ') || 'You have a ritual book and can cast its ritual spells without expending spell slots.',
    },
    hasFeat(char, 'Spell Sniper') && {
      name: 'Spell Sniper',
      detail: [
        'Double the range of spells that require attack rolls, and ignore half cover and three-quarters cover with spell attacks.',
        spellSniperChoice?.cantrips?.length ? `Cantrip: ${spellNames(spellSniperChoice.cantrips)}.` : null,
      ].filter(Boolean).join(' '),
    },
    hasFeat(char, 'War Caster') && {
      name: 'War Caster',
      detail: 'Advantage on concentration saves, somatic components can be performed with weapons or shield in hand, and you can cast a spell for opportunity attacks.',
    },
  ].filter(Boolean)

  useEffect(() => {
    getSpells().then(all => {
      const map = {}
      for (const s of all) map[s.index] = s
      setSrdSpellMap(map)
      setAllSrdSpells(all)
    }).catch(() => {})
  }, [])

  function toggleSlot(lvl, index, pool = 'slots') {
    const source = pool === 'pactSlots' ? pactSlots : slots
    const current = source[lvl] ?? { total: index + 1, used: 0 }
    const used    = current.used > index ? index : index + 1
    updateChar({ spells: { ...char.spells, [pool]: { ...source, [lvl]: { ...current, used } } } })
  }

  function availableSlotOptions(spellLevel) {
    if (spellLevel === 0) return []
    const normalOptions = Object.entries(slots)
      .filter(([lvl, slot]) => Number(lvl) >= spellLevel && slot.total > 0 && slot.used < slot.total)
      .map(([lvl]) => ({
        pool: 'slots',
        level: Number(lvl),
        value: `slots:${lvl}`,
        label: `Lv ${lvl}`,
      }))
    const pactOptions = Object.entries(pactSlots)
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

  function togglePrepared(spell) {
    const spellId = spell?.id
    if (spell?.alwaysPrepared) return
    if (!prepared.includes(spellId) && preparedFull) return
    const next = prepared.includes(spellId)
      ? prepared.filter(id => id !== spellId)
      : [...prepared, spellId]
    updateChar({ spells: { ...char.spells, prepared: next } })
  }

  function addSpell(srdSpell) {
    const spellClass = defaultSpellClass(char, srdSpell)
    const newSpell = {
      id:    uid(),
      index: srdSpell.index,
      name:  srdSpell.name,
      source: srdSpell.source,
      level: srdSpell.level,
      ...(spellClass && { classIndex: spellClass, castingAbility: SPELLCASTING_ABILITY[spellClass] }),
    }
    updateChar({ spells: { ...char.spells, known: [...known, newSpell] } })
  }

  function removeSpell(spellId) {
    updateChar({
      spells: {
        ...char.spells,
        known:    known.filter(s => s.id !== spellId),
        prepared: prepared.filter(id => id !== spellId),
        concentration: char.spells?.concentration === spellId ? null : char.spells?.concentration,
      }
    })
  }

  function clearConcentration() {
    updateChar({ spells: { ...char.spells, concentration: null } })
  }

  function toggleConcentration(spellId) {
    updateChar({
      spells: {
        ...char.spells,
        concentration: char.spells?.concentration === spellId ? null : spellId,
      }
    })
  }

  function nextConcentration(spell, requiresConcentration) {
    if (!requiresConcentration) return char.spells?.concentration ?? null
    if (char.settings?.concentrationMode === 'none') return char.spells?.concentration ?? spell.id
    return spell.id
  }

  function castSpell(spell, slotValue, requiresConcentration = false) {
    if (!isOwner || locked) return
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
    const source = slotPool === 'pactSlots' ? pactSlots : slots
    const slot = source[slotLevel]
    if (!slot || slot.used >= slot.total) return
    updateChar({
      spells: {
        ...char.spells,
        [slotPool]: { ...source, [slotLevel]: { ...slot, used: slot.used + 1 } },
        concentration,
      },
    })
  }

  function castMagicInitiateSpell(spell, requiresConcentration = false) {
    if (!isOwner || locked || magicInitiateUsed >= 1) return
    const concentration = nextConcentration(spell, requiresConcentration)
    const nextAbility = {
      name: 'Magic Initiate',
      key: 'feat-magic-initiate',
      recharge: 'LR',
      max: 1,
      used: magicInitiateUsed + 1,
    }
    updateChar({
      spells: {
        ...char.spells,
        concentration,
      },
      combat: {
        ...char.combat,
        classAbilities: [
          ...storedAbilities.filter(ability => featureKey(ability.name) !== 'feat-magic-initiate' && ability.key !== 'feat-magic-initiate'),
          nextAbility,
        ],
      },
    })
  }

  function saveSlots(newSlots, newPactSlots = pactSlots) {
    updateChar({ spells: { ...char.spells, slots: newSlots, pactSlots: newPactSlots } })
    setShowSlotEditor(false)
  }

  // Collect unique schools from known spells (via SRD data)
  const knownIds = new Set(known.map(s => s.index))
  const knownSchools = [...new Set(
    known.map(s => srdSpellMap[s.index]?.school?.name).filter(Boolean)
  )]

  // Filter and group spells
  const visible = known.filter(spell => {
    if (!showUnprepared && spell.level > 0 && !isPreparedSpell(spell, prepared)) return false
    if (filterSchool !== 'All') {
      if (srdSpellMap[spell.index]?.school?.name !== filterSchool) return false
    }
    return true
  })

  const byLevel = {}
  visible.forEach(spell => {
    const l = spell.level ?? 0
    ;(byLevel[l] ??= []).push(spell)
  })

  return (
    <div className="spells-root">

      {/* ── Spellcasting summary strip ── */}
      {castAbility && (
        <div className="spell-summary">
          <div className="spell-summary-cell">
            <span className="spell-summary-val">
              <span className={preparedOverCap ? 'spell-summary-val--warning' : undefined}>
                {preparedMax != null ? `${preparedLeveled.length}/${preparedMax}` : preparedLeveled.length}
              </span>
            </span>
            <span className="spell-summary-lbl">Prepared</span>
          </div>
          <div className="spell-summary-cell">
            <span className="spell-summary-val">{spellDC ?? '—'}</span>
            <span className="spell-summary-lbl">Spell Save DC</span>
          </div>
          <div className="spell-summary-cell">
            <span className="spell-summary-val">{spellAtk != null ? fmtB(spellAtk) : '—'}</span>
            <span className="spell-summary-lbl">Spell Attack</span>
          </div>
          <div className="spell-summary-cell">
            <span className="spell-summary-val">{castAbility.toUpperCase()}</span>
            <span className="spell-summary-lbl">Casting Stat</span>
          </div>
        </div>
      )}

      {spellFeatNotes.length > 0 && (
        <div className="spell-feat-notes">
          {spellFeatNotes.map(note => (
            <div key={note.name} className="spell-feat-note">
              <span className="spell-feat-note-name">{note.name}</span>
              <span className="spell-feat-note-detail">{note.detail}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Filter bar ── */}
      {knownSchools.length > 1 && (
        <div className="spell-filter-bar">
          <div className="filter-row">
            <span className="filter-lbl">School</span>
            <div className="filter-chips">
              {['All', ...SCHOOLS.filter(s => knownSchools.includes(s))].map(s => (
                <button
                  type="button"
                  key={s}
                  className={`filter-chip${filterSchool === s ? ' filter-chip--on' : ''}`}
                  onClick={() => setFilterSchool(s)}
                >{s}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="spells-scroll">

        {/* ── Slot tracker ── */}
        {(slotEntries.length > 0 || pactSlotEntries.length > 0 || (isOwner && !locked)) && (
          <div className="spell-slot-block">
            {slotEntries.map(([lvl, { total, used }]) => (
              <div key={lvl} className="slot-row-sp">
                <span className="slot-lbl-sp">{ORDINALS[Number(lvl)]}</span>
                <div className="slot-pips-sp">
                  {Array.from({ length: total }, (_, i) => (
                    <button
                      type="button"
                      key={i}
                      className={`slot-pip-sp${i < used ? ' slot-pip-sp--used' : ''}`}
                      onClick={() => isOwner && !locked && toggleSlot(lvl, i)}
                    />
                  ))}
                </div>
              </div>
            ))}
            {pactSlotEntries.map(([lvl, { total, used }]) => (
              <div key={`pact-${lvl}`} className="slot-row-sp slot-row-sp--pact">
                <span className="slot-lbl-sp slot-lbl-sp--pact">Pact {ORDINALS[Number(lvl)]}</span>
                <div className="slot-pips-sp">
                  {Array.from({ length: total }, (_, i) => (
                    <button
                      type="button"
                      key={i}
                      className={`slot-pip-sp slot-pip-sp--pact${i < used ? ' slot-pip-sp--used' : ''}`}
                      onClick={() => isOwner && !locked && toggleSlot(lvl, i, 'pactSlots')}
                    />
                  ))}
                </div>
              </div>
            ))}
            {isOwner && !locked && (
              <button
                type="button"
                className="slot-configure-btn"
                onClick={() => setShowSlotEditor(v => !v)}
              >
                {showSlotEditor ? 'Cancel' : 'Configure slots'}
              </button>
            )}
          </div>
        )}

        {/* ── Slot editor ── */}
        {showSlotEditor && isOwner && !locked && (
          <SlotEditor slots={slots} pactSlots={pactSlots} onSave={saveSlots} onClose={() => setShowSlotEditor(false)} />
        )}

        {/* Spell list header */}
        <div className="spell-list-head">
          <span className="sec-head spell-list-title">Spells</span>
          <div className="spell-list-actions">
            {known.length > 0 && (
              <button type="button" className="add-link" onClick={() => setShowUnprepared(v => !v)}>
                {showUnprepared ? 'Prepared only' : 'Show all'}
              </button>
            )}
            {isOwner && !locked && (
              <button type="button" className="add-link" onClick={() => setShowPicker(v => !v)}>
                {showPicker ? 'Cancel' : '+ Add spell'}
              </button>
            )}
          </div>
        </div>

        {/* ── Spell picker ── */}
        {showPicker && isOwner && !locked && (
          <SpellPicker
            srdSpells={allSrdSpells}
            knownIds={knownIds}
            onAdd={spell => { addSpell(spell); setShowPicker(false) }}
            onClose={() => setShowPicker(false)}
          />
        )}

        {known.length === 0 && !showPicker && (
          <p className="empty-hint">
            No spells added yet.{isOwner && !locked ? ' Tap "+ Add spell" above.' : ''}
          </p>
        )}

        {/* ── Spell levels ── */}
        {Object.entries(byLevel).sort(([a],[b]) => Number(a)-Number(b)).map(([lvl, spells]) => {
          const lvlNum  = Number(lvl)
          const slotDat = slots[lvl]
          const pactSlotDat = pactSlots[lvl]
          return (
            <div key={lvl} className="spell-level-group">
              <div className="level-group-head">
                <span className="level-group-label">
                  {lvlNum === 0 ? 'Cantrips' : `Level ${lvlNum}`}
                </span>
                {slotDat && (
                  <div className="level-slot-pips">
                    {Array.from({ length: slotDat.total }, (_, i) => (
                      <span key={i} className={`lsp${i < slotDat.used ? ' lsp--used' : ''}`} />
                    ))}
                  </div>
                )}
                {pactSlotDat && (
                  <div className="level-slot-pips level-slot-pips--pact" title="Pact Magic slots">
                    {Array.from({ length: pactSlotDat.total }, (_, i) => (
                      <span key={i} className={`lsp lsp--pact${i < pactSlotDat.used ? ' lsp--used' : ''}`} />
                    ))}
                  </div>
                )}
              </div>

              {spells.map(spell => {
                const isPrep    = isPreparedSpell(spell, prepared)
                const canTogglePrepare = !spell.alwaysPrepared && (isPrep || preparedMax == null || !preparedFull)
                const isConc    = char.spells?.concentration === spell.id
                const expanded  = expandedId === spell.id
                const srd       = srdSpellMap[spell.index] ?? {}
                const availableSlots = spell.level > 0 ? availableSlotOptions(spell.level) : []
                const selectedSlot = availableSlots.some(option => option.value === castSlots[spell.id])
                  ? castSlots[spell.id]
                  : availableSlots[0]?.value
                const school    = srd.school?.name
                const castTime  = srd.casting_time
                const range     = srd.range
                const duration  = srd.duration
                const canConcentrate = isConcentrationSpell(srd)
                const components = srd.components?.join(', ')
                const spellAbility = spellCastingAbility(spell, char)
                const spellMod = spellAbility ? abilityMod(scores[spellAbility] ?? 10) : null
                const rowSpellDC = spellMod != null ? 8 + pb + spellMod : null
                const rowSpellAtk = spellMod != null ? pb + spellMod : null
                const isAtk = !!srd.attack_type
                const saveName = srd.dc?.dc_type?.name ?? srd.saving_throw
                const desc      = Array.isArray(srd.desc) ? srd.desc.join('\n\n') : srd.desc
                const hasSpellSniperBadge = hasFeat(char, 'Spell Sniper') && isAtk
                const hasElementalAdeptBadge = elementalAdeptDamage && desc?.toLowerCase().includes(elementalAdeptDamage.toLowerCase())
                const hasMagicInitiateSpellBadge = magicInitiateSpellIndexes.has(spell.index)
                const hasMagicInitiateCantripBadge = magicInitiateCantripIndexes.has(spell.index)
                const hasRitualCasterBadge = ritualCasterSpellIndexes.has(spell.index)
                const hasSpellSniperPickBadge = spellSniperCantripIndexes.has(spell.index)
                const canUseMagicInitiateCast = hasMagicInitiateSpellBadge && magicInitiateUsed < 1

                return (
                  <div key={spell.id} className={`spell-row${!isPrep ? ' spell-row--unprepared' : ''}${expanded ? ' spell-row--expanded' : ''}`}>

                    <div className="spell-row-head" onClick={() => setExpandedId(expanded ? null : spell.id)}>
                      <button
                        type="button"
                        className={`conc-dot-wrap${canConcentrate ? ' conc-dot-wrap--active' : ''}`}
                        onClick={e => {
                          e.stopPropagation()
                          if (isOwner && !locked && canConcentrate) toggleConcentration(spell.id)
                        }}
                        disabled={!isOwner || locked || !canConcentrate}
                        title={canConcentrate ? (isConc ? 'End concentration' : 'Start concentration') : 'No concentration'}
                      >
                        <span className={`conc-dot${isConc ? ' conc-dot--on' : ''}`} />
                      </button>
                      <span className="spell-name">{spell.name}</span>
                      {lvlNum > 0 && (
                        <span
                          className={`spell-star${isPrep ? ' spell-star--prep' : ''}${!canTogglePrepare ? ' spell-star--disabled' : ''}`}
                          onClick={e => { e.stopPropagation(); isOwner && !locked && canTogglePrepare && togglePrepared(spell) }}
                          title={spell.alwaysPrepared ? 'Always prepared by subclass feature' : isPrep ? 'Prepared — click to unprepare' : !canTogglePrepare ? 'Preparation limit reached' : 'Not prepared — click to prepare'}
                        >
                          {spell.alwaysPrepared ? 'Always' : isPrep ? 'Prepared' : 'Add'}
                        </span>
                      )}
                      {spell.origin && <span className="spell-origin-badge">{spell.origin}</span>}
                      {school && <span className="spell-school-badge">{school}</span>}
                      {isAtk && rowSpellAtk != null && (
                        <span className="spell-mechanic-badge">{fmtB(rowSpellAtk)} hit</span>
                      )}
                      {saveName && rowSpellDC != null && (
                        <span className="spell-mechanic-badge">DC {rowSpellDC} {saveName.slice(0, 3).toUpperCase()}</span>
                      )}
                      {hasMagicInitiateSpellBadge && <span className="spell-mechanic-badge" title="Magic Initiate: cast once per long rest without a spell slot">1/LR</span>}
                      {hasMagicInitiateCantripBadge && <span className="spell-mechanic-badge" title="Magic Initiate cantrip">Initiate</span>}
                      {hasRitualCasterBadge && <span className="spell-mechanic-badge" title="Ritual Caster spellbook spell">Ritual Book</span>}
                      {hasSpellSniperPickBadge && <span className="spell-mechanic-badge" title="Cantrip learned from Spell Sniper">Sniper Pick</span>}
                      {hasSpellSniperBadge && <span className="spell-mechanic-badge" title="Spell Sniper: double range and ignore half/three-quarters cover">Sniper</span>}
                      {hasElementalAdeptBadge && <span className="spell-mechanic-badge" title={`Elemental Adept: ${elementalAdeptDamage} spells ignore resistance and treat 1s as 2s`}>Adept</span>}
                      <button type="button" className="spell-xbtn">{expanded ? '▲' : '▾'}</button>
                    </div>

                    {expanded && (
                      <div className="spell-detail">
                        {(castTime || range || duration || components) && (
                          <div className="spell-detail-grid">
                            {castTime   && <div className="spd"><span className="spd-l">Casting Time</span><span className="spd-v">{castTime}</span></div>}
                            {range      && <div className="spd"><span className="spd-l">Range</span><span className="spd-v">{range}</span></div>}
                            {duration   && <div className="spd"><span className="spd-l">Duration</span><span className="spd-v">{duration}</span></div>}
                            {components && <div className="spd"><span className="spd-l">Components</span><span className="spd-v">{components}</span></div>}
                            {school     && <div className="spd"><span className="spd-l">School</span><span className="spd-v">{school}</span></div>}
                            {spellAbility && <div className="spd"><span className="spd-l">Casting Stat</span><span className="spd-v">{spellAbility.toUpperCase()}</span></div>}
                            {isAtk && rowSpellAtk != null && <div className="spd"><span className="spd-l">Spell Attack</span><span className="spd-v">{fmtB(rowSpellAtk)}</span></div>}
                            {saveName && rowSpellDC != null && <div className="spd"><span className="spd-l">Save DC</span><span className="spd-v">{rowSpellDC} {saveName}</span></div>}
                          </div>
                        )}
                        {desc && <p className="spell-desc">{desc.slice(0, 400)}{desc.length > 400 ? '…' : ''}</p>}
                        <div className="spell-detail-actions">
                          {isOwner && !locked && (
                            <div className="spell-cast-actions">
                              {spell.level > 0 && (
                                <select
                                  className="spell-cast-slot-select"
                                  value={selectedSlot ?? ''}
                                  onChange={e => setCastSlots(prev => ({ ...prev, [spell.id]: e.target.value }))}
                                  disabled={availableSlots.length === 0}
                                  title="Choose spell slot level"
                                >
                                  {availableSlots.length === 0 ? (
                                    <option value="">No slots</option>
                                  ) : availableSlots.map(option => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              )}
                              <button
                                type="button"
                                className="spell-prep-btn spell-prep-btn--on"
                                onClick={() => castSpell(spell, selectedSlot, canConcentrate)}
                                disabled={spell.level > 0 && !selectedSlot}
                                title={spell.level === 0 ? (canConcentrate ? 'Cantrip — no slot used, starts concentration' : 'Cantrip — no slot used') : canConcentrate ? 'Cast — uses one spell slot and starts concentration' : 'Cast — uses one spell slot'}
                              >
                                Cast
                              </button>
                            </div>
                          )}
                          {lvlNum > 0 && isOwner && !locked && (
                            <button
                              type="button"
                              className={`spell-prep-btn${isPrep ? ' spell-prep-btn--on' : ''}`}
                              onClick={() => togglePrepared(spell)}
                              disabled={!canTogglePrepare}
                              title={spell.alwaysPrepared ? 'Always prepared by subclass feature' : !canTogglePrepare ? 'Preparation limit reached' : undefined}
                            >
                              {spell.alwaysPrepared ? 'Always prepared' : isPrep ? 'Prepared' : 'Add to prepared'}
                            </button>
                          )}
                          {canConcentrate && !isConc && isOwner && !locked && (
                            <button
                              type="button"
                              className="spell-prep-btn"
                              onClick={() => toggleConcentration(spell.id)}
                              title="Start concentration"
                            >
                              Concentrate
                            </button>
                          )}
                          {hasMagicInitiateSpellBadge && isOwner && !locked && (
                            <button
                              type="button"
                              className="spell-prep-btn"
                              onClick={() => castMagicInitiateSpell(spell, canConcentrate)}
                              disabled={!canUseMagicInitiateCast}
                              title={canUseMagicInitiateCast ? 'Magic Initiate free cast without spending a spell slot' : 'Magic Initiate free cast used until long rest'}
                            >
                              {canUseMagicInitiateCast ? 'Free cast' : 'Free cast used'}
                            </button>
                          )}
                          {isConc && isOwner && !locked && (
                            <button
                              type="button"
                              className="spell-prep-btn spell-prep-btn--danger"
                              onClick={clearConcentration}
                              title="End concentration"
                            >
                              End concentration
                            </button>
                          )}
                          {isOwner && !locked && (
                            <button
                              type="button"
                              className="spell-xbtn spell-remove-btn"
                              onClick={() => removeSpell(spell.id)}
                              title="Remove spell"
                            >
                              ✕ Remove
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

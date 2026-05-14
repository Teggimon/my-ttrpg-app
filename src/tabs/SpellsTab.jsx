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
        <button className="spell-picker-close" onClick={onClose}>✕</button>
      </div>
      <div className="spell-picker-levels">
        {levels.map(l => (
          <button
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
          <button key={s.index} className="spell-picker-row" onClick={() => onAdd(s)}>
            <span className="spell-picker-name">{s.name}</span>
            <span className="spell-picker-meta">
              <span className="spell-picker-source">{sourceCode(s)}</span>
              {s.level === 0 ? 'Cantrip' : `Lv ${s.level}`} · {s.school?.name}
            </span>
          </button>
        ))}
        {results.length === 50 && <p className="empty-hint" style={{ padding: '6px 0' }}>Showing first 50 — refine search.</p>}
      </div>
    </div>
  )
}

// ── Slot Editor ─────────────────────────────────────────────────────────────
function SlotEditor({ slots, onSave, onClose }) {
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
    onSave(next)
  }

  return (
    <div className="slot-editor">
      <div className="slot-editor-head">
        <span className="slot-editor-title">Configure Spell Slots</span>
        <button className="spell-picker-close" onClick={onClose}>✕</button>
      </div>
      <div className="slot-editor-grid">
        {[1,2,3,4,5,6,7,8,9].map(lvl => (
          <div key={lvl} className="slot-editor-row">
            <span className="slot-editor-lbl">{ORDINALS[lvl]}</span>
            <div className="slot-editor-btns">
              <button className="slot-adj-btn" onClick={() => setDraft(d => ({ ...d, [lvl]: Math.max(0, d[lvl] - 1) }))}>−</button>
              <span className="slot-editor-val">{draft[lvl]}</span>
              <button className="slot-adj-btn" onClick={() => setDraft(d => ({ ...d, [lvl]: Math.min(MAX_SLOTS[lvl] ?? 4, d[lvl] + 1) }))}>+</button>
            </div>
          </div>
        ))}
      </div>
      <button className="spell-prep-btn spell-prep-btn--on" style={{ width: '100%', alignSelf: 'stretch' }} onClick={save}>
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

  const preparedLeveled = known.filter(s => s.level > 0 && prepared.includes(s.id))
  const preparedMax     = preparedCapacity(char)
  const preparedFull    = preparedMax != null && preparedLeveled.length >= preparedMax
  const preparedOverCap = preparedMax != null && preparedLeveled.length > preparedMax

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

  function togglePrepared(spellId) {
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

  function saveSlots(newSlots) {
    updateChar({ spells: { ...char.spells, slots: newSlots } })
    setShowSlotEditor(false)
  }

  // Collect unique schools from known spells (via SRD data)
  const knownIds = new Set(known.map(s => s.index))
  const knownSchools = [...new Set(
    known.map(s => srdSpellMap[s.index]?.school?.name).filter(Boolean)
  )]

  // Filter and group spells
  const visible = known.filter(spell => {
    if (!showUnprepared && spell.level > 0 && !prepared.includes(spell.id)) return false
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

      {/* ── Filter bar ── */}
      {knownSchools.length > 1 && (
        <div className="spell-filter-bar">
          <div className="filter-row">
            <span className="filter-lbl">School</span>
            <div className="filter-chips">
              {['All', ...SCHOOLS.filter(s => knownSchools.includes(s))].map(s => (
                <button
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
          <SlotEditor slots={slots} onSave={saveSlots} onClose={() => setShowSlotEditor(false)} />
        )}

        {/* Spell list header */}
        <div className="spell-list-head">
          <span className="sec-head" style={{ margin: 0 }}>Spells</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {known.length > 0 && (
              <button className="add-link" onClick={() => setShowUnprepared(v => !v)}>
                {showUnprepared ? 'Prepared only' : 'Show all'}
              </button>
            )}
            {isOwner && !locked && (
              <button className="add-link" onClick={() => setShowPicker(v => !v)}>
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
                const isPrep    = lvlNum === 0 || prepared.includes(spell.id)
                const canPrepare = isPrep || preparedMax == null || !preparedFull
                const isConc    = char.spells?.concentration === spell.id
                const expanded  = expandedId === spell.id
                const srd       = srdSpellMap[spell.index] ?? {}
                const school    = srd.school?.name
                const castTime  = srd.casting_time
                const range     = srd.range
                const duration  = srd.duration
                const components = srd.components?.join(', ')
                const spellAbility = spellCastingAbility(spell, char)
                const spellMod = spellAbility ? abilityMod(scores[spellAbility] ?? 10) : null
                const rowSpellDC = spellMod != null ? 8 + pb + spellMod : null
                const rowSpellAtk = spellMod != null ? pb + spellMod : null
                const isAtk = !!srd.attack_type
                const saveName = srd.dc?.dc_type?.name ?? srd.saving_throw
                const desc      = Array.isArray(srd.desc) ? srd.desc.join('\n\n') : srd.desc

                return (
                  <div key={spell.id} className={`spell-row${!isPrep ? ' spell-row--unprepared' : ''}${expanded ? ' spell-row--expanded' : ''}`}>

                    <div className="spell-row-head" onClick={() => setExpandedId(expanded ? null : spell.id)}>
                      <span className="conc-dot-wrap" title={isConc ? 'Concentration active' : 'Concentration'}>
                        <span className={`conc-dot${isConc ? ' conc-dot--on' : ''}`} />
                      </span>
                      <span className="spell-name">{spell.name}</span>
                      {lvlNum > 0 && (
                        <span
                          className={`spell-star${isPrep ? ' spell-star--prep' : ''}${!canPrepare ? ' spell-star--disabled' : ''}`}
                          onClick={e => { e.stopPropagation(); isOwner && !locked && canPrepare && togglePrepared(spell.id) }}
                          title={isPrep ? 'Prepared — click to unprepare' : !canPrepare ? 'Preparation limit reached' : 'Not prepared — click to prepare'}
                        >
                          {isPrep ? 'Prepared' : 'Add'}
                        </span>
                      )}
                      {school && <span className="spell-school-badge">{school}</span>}
                      {isAtk && rowSpellAtk != null && (
                        <span className="spell-mechanic-badge">{fmtB(rowSpellAtk)} hit</span>
                      )}
                      {saveName && rowSpellDC != null && (
                        <span className="spell-mechanic-badge">DC {rowSpellDC} {saveName.slice(0, 3).toUpperCase()}</span>
                      )}
                      <button className="spell-xbtn">{expanded ? '▲' : '▾'}</button>
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
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {lvlNum > 0 && isOwner && !locked && (
                            <button
                              className={`spell-prep-btn${isPrep ? ' spell-prep-btn--on' : ''}`}
                              onClick={() => togglePrepared(spell.id)}
                              disabled={!canPrepare}
                              title={!canPrepare ? 'Preparation limit reached' : undefined}
                            >
                              {isPrep ? 'Prepared' : 'Add to prepared'}
                            </button>
                          )}
                          {isConc && isOwner && !locked && (
                            <button
                              className="spell-prep-btn spell-prep-btn--danger"
                              onClick={clearConcentration}
                              title="End concentration"
                            >
                              End concentration
                            </button>
                          )}
                          {isOwner && !locked && (
                            <button
                              className="spell-xbtn"
                              style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--danger)' }}
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

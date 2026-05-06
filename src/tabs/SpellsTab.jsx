import { useState, useEffect, useRef } from 'react'
import { getSpells } from '../srdContent'
import '../TabShared.css'
import './SpellsTab.css'

const ORDINALS    = ['','I','II','III','IV','V','VI','VII','VIII','IX']
const PROFICIENCY = [0,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6]
const SCHOOLS = ['Abjuration','Conjuration','Divination','Enchantment','Evocation','Illusion','Necromancy','Transmutation']

// Max slots per level for full-casters (used as reference for slot editor)
const MAX_SLOTS = [0, 4, 3, 3, 3, 3, 2, 2, 1, 1]

function abilityMod(score) { return Math.floor((score - 10) / 2) }
function fmtB(n)            { return n >= 0 ? `+${n}` : `${n}` }
function uid()              { return Math.random().toString(36).slice(2) }

// ── Spell Picker ────────────────────────────────────────────────────────────
function SpellPicker({ srdSpells, knownIds, onAdd, onClose }) {
  const [search,      setSearch]      = useState('')
  const [filterLevel, setFilterLevel] = useState('all')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const levels = ['all', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

  const results = srdSpells.filter(s => {
    if (knownIds.has(s.index)) return false
    if (filterLevel !== 'all' && String(s.level) !== filterLevel) return false
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }).slice(0, 50)

  return (
    <div className="spell-picker">
      <div className="spell-picker-head">
        <input
          ref={inputRef}
          className="spell-picker-search"
          placeholder="Search spells…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
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
  const castAbility = char.spells?.spellcastingAbility
  const level    = char.identity.class?.[0]?.level ?? 1
  const pb       = PROFICIENCY[level] ?? 2
  const scores   = char.stats?.abilityScores ?? {}

  const castMod  = castAbility ? abilityMod(scores[castAbility] ?? 10) : null
  const spellDC  = castMod != null ? 8 + pb + castMod : null
  const spellAtk = castMod != null ? pb + castMod : null

  const slotEntries = Object.entries(slots)
    .filter(([, v]) => v.total > 0)
    .sort(([a], [b]) => Number(a) - Number(b))

  const preparedLeveled = known.filter(s => s.level > 0 && prepared.includes(s.id))
  const preparedMax     = castMod != null ? Math.max(1, level + castMod) : null

  useEffect(() => {
    getSpells().then(all => {
      const map = {}
      for (const s of all) map[s.index] = s
      setSrdSpellMap(map)
      setAllSrdSpells(all)
    }).catch(() => {})
  }, [])

  function toggleSlot(lvl, index) {
    const current = slots[lvl] ?? { total: index + 1, used: 0 }
    const used    = current.used > index ? index : index + 1
    updateChar({ spells: { ...char.spells, slots: { ...slots, [lvl]: { ...current, used } } } })
  }

  function togglePrepared(spellId) {
    const next = prepared.includes(spellId)
      ? prepared.filter(id => id !== spellId)
      : [...prepared, spellId]
    updateChar({ spells: { ...char.spells, prepared: next } })
  }

  function addSpell(srdSpell) {
    const newSpell = {
      id:    uid(),
      index: srdSpell.index,
      name:  srdSpell.name,
      level: srdSpell.level,
    }
    updateChar({ spells: { ...char.spells, known: [...known, newSpell] } })
  }

  function removeSpell(spellId) {
    updateChar({
      spells: {
        ...char.spells,
        known:    known.filter(s => s.id !== spellId),
        prepared: prepared.filter(id => id !== spellId),
      }
    })
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
              {preparedMax != null ? `${preparedLeveled.length}/${preparedMax}` : preparedLeveled.length}
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
        {(slotEntries.length > 0 || (isOwner && !locked)) && (
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
            {isOwner && !locked && (
              <button
                className="slot-configure-btn"
                onClick={() => setShowSlotEditor(v => !v)}
              >
                {showSlotEditor ? 'Cancel' : '⚙ Configure slots'}
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
              </div>

              {spells.map(spell => {
                const isPrep    = lvlNum === 0 || prepared.includes(spell.id)
                const isConc    = char.spells?.concentration === spell.id
                const expanded  = expandedId === spell.id
                const srd       = srdSpellMap[spell.index] ?? {}
                const school    = srd.school?.name
                const castTime  = srd.casting_time
                const range     = srd.range
                const duration  = srd.duration
                const components = srd.components?.join(', ')
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
                          className={`spell-star${isPrep ? ' spell-star--prep' : ''}`}
                          onClick={e => { e.stopPropagation(); isOwner && !locked && togglePrepared(spell.id) }}
                          title={isPrep ? 'Prepared — click to unprepare' : 'Not prepared — click to prepare'}
                        >
                          {isPrep ? '★' : '☆'}
                        </span>
                      )}
                      {school && <span className="spell-school-badge">{school}</span>}
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
                          </div>
                        )}
                        {desc && <p className="spell-desc">{desc.slice(0, 400)}{desc.length > 400 ? '…' : ''}</p>}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {lvlNum > 0 && isOwner && !locked && (
                            <button
                              className={`spell-prep-btn${isPrep ? ' spell-prep-btn--on' : ''}`}
                              onClick={() => togglePrepared(spell.id)}
                            >
                              {isPrep ? '★ Prepared' : '☆ Add to prepared'}
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

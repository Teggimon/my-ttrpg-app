import { useState, useEffect } from 'react'
import { getSpells } from '../srdContent'
import '../TabShared.css'
import './SpellsTab.css'

const ORDINALS    = ['','I','II','III','IV','V','VI','VII','VIII','IX']
const PROFICIENCY = [0,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6]

const SCHOOLS = ['Abjuration','Conjuration','Divination','Enchantment','Evocation','Illusion','Necromancy','Transmutation']

function abilityMod(score) { return Math.floor((score - 10) / 2) }
function fmtB(n)            { return n >= 0 ? `+${n}` : `${n}` }

export default function SpellsTab({ char, locked, isOwner, updateChar }) {
  const [expandedId,    setExpandedId]    = useState(null)
  const [showUnprepared, setShowUnprepared] = useState(false)
  const [filterSchool,  setFilterSchool]  = useState('All')
  const [srdSpellMap,   setSrdSpellMap]   = useState({})

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
  const preparedMax     = castMod != null ? (level + castMod) : null

  useEffect(() => {
    getSpells().then(all => {
      const map = {}
      for (const s of all) map[s.index] = s
      setSrdSpellMap(map)
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

  // Collect unique schools from known spells (via SRD data)
  const knownSchools = [...new Set(
    known.map(s => srdSpellMap[s.index]?.school?.name).filter(Boolean)
  )]

  // Filter and group spells
  const visible = known.filter(spell => {
    if (!showUnprepared && spell.level > 0 && !prepared.includes(spell.id)) return false
    if (filterSchool !== 'All') {
      const school = srdSpellMap[spell.index]?.school?.name
      if (school !== filterSchool) return false
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
        {slotEntries.length > 0 && (
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
          </div>
        )}

        {/* Prepared toggle */}
        <div className="spell-list-head">
          <span className="sec-head" style={{ margin: 0 }}>Spells</span>
          <button className="add-link" onClick={() => setShowUnprepared(v => !v)}>
            {showUnprepared ? 'Prepared only' : 'Show all'}
          </button>
        </div>

        {known.length === 0 && <p className="empty-hint">No spells added yet.</p>}

        {/* ── Spell levels ── */}
        {Object.entries(byLevel).sort(([a],[b]) => Number(a)-Number(b)).map(([level, spells]) => {
          const lvlNum  = Number(level)
          const slotDat = slots[level]
          return (
            <div key={level} className="spell-level-group">

              {/* Level header with slot pips */}
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

                    {/* Collapsed row */}
                    <div className="spell-row-head" onClick={() => setExpandedId(expanded ? null : spell.id)}>
                      <span className={`conc-dot-wrap${isConc ? ' conc-dot-wrap--on' : ''}`} title={isConc ? 'Concentration active' : 'Concentration'}>
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

                    {/* Expanded detail */}
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
                        {lvlNum > 0 && isOwner && !locked && (
                          <button
                            className={`spell-prep-btn${isPrep ? ' spell-prep-btn--on' : ''}`}
                            onClick={() => togglePrepared(spell.id)}
                          >
                            {isPrep ? '★ Prepared' : '☆ Add to prepared'}
                          </button>
                        )}
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

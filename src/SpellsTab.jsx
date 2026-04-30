import { useState } from 'react'
import '../TabShared.css'
import './SpellsTab.css'

const ORDINALS = ['','I','II','III','IV','V','VI','VII','VIII','IX']

export default function SpellsTab({ char, locked, isOwner, updateChar }) {
  const [showUnprepared, setShowUnprepared] = useState(false)

  const known    = char.spells?.known ?? []
  const prepared = char.spells?.prepared ?? []
  const slots    = char.spells?.slots ?? {}
  const slotEntries = Object.entries(slots).filter(([,v]) => v.total > 0).sort(([a],[b]) => Number(a)-Number(b))

  const byLevel = {}
  known.forEach(spell => {
    const l = spell.level ?? 0
    if (!byLevel[l]) byLevel[l] = []
    byLevel[l].push(spell)
  })

  function togglePrepared(spellId) {
    const next = prepared.includes(spellId)
      ? prepared.filter(id => id !== spellId)
      : [...prepared, spellId]
    updateChar({ spells: { ...char.spells, prepared: next } })
  }

  function toggleSlot(level, index) {
    const current = slots[level] ?? { total: index + 1, used: 0 }
    const used    = current.used > index ? index : index + 1
    updateChar({ spells: { ...char.spells, slots: { ...slots, [level]: { ...current, used } } } })
  }

  return (
    <div>
      {/* ── Slot tracker ── */}
      {slotEntries.length > 0 && (
        <>
          <div className="sec-head">Spell slots</div>
          <div className="card slot-grid-spells">
            {slotEntries.map(([lvl, { total, used }]) => (
              <div key={lvl} className="slot-row-spells">
                <span className="slot-lbl-spells">{ORDINALS[Number(lvl)]}</span>
                <div className="spell-pips">
                  {Array.from({ length: total }, (_, i) => (
                    <button
                      key={i}
                      className={`spell-pip ${i < used ? 'spell-pip--used' : ''}`}
                      onClick={() => isOwner && !locked && toggleSlot(lvl, i)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Spell list ── */}
      <div className="sec-head" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span>Spells</span>
        <button className="add-link" onClick={() => setShowUnprepared(v => !v)}>
          {showUnprepared ? 'Prepared only' : 'Show all'}
        </button>
      </div>

      {known.length === 0 && <p className="empty-hint">No spells added yet.</p>}

      {Object.entries(byLevel).sort(([a],[b]) => Number(a)-Number(b)).map(([level, spells]) => {
        const visible = showUnprepared ? spells : spells.filter(s => s.level === 0 || prepared.includes(s.id))
        if (visible.length === 0) return null
        return (
          <div key={level}>
            <div className="spell-level-head">{Number(level) === 0 ? 'Cantrips' : `Level ${level}`}</div>
            {visible.map(spell => {
              const isPrep   = spell.level === 0 || prepared.includes(spell.id)
              const isConc   = char.spells?.concentration === spell.id
              return (
                <div key={spell.id} className={`spell-row card ${!isPrep ? 'spell-row--unprepared' : ''}`}>
                  <div className="spell-name">
                    {spell.name}
                    {isConc && <span className="conc-dot" title="Concentration" />}
                  </div>
                  {spell.level > 0 && isOwner && !locked && (
                    <button className="add-link" onClick={() => togglePrepared(spell.id)}>
                      {isPrep ? '✓' : '+ Prep'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

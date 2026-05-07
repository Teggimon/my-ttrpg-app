import { useState, useEffect, useRef } from 'react'
import { getClasses, getRaces, getBackgrounds } from '../srdContent'
import { xpToLevel } from '../LevelUpModal'
import '../TabShared.css'
import './BackgroundTab.css'

const ALIGNMENTS = [
  ['Lawful Good','LG'], ['Neutral Good','NG'], ['Chaotic Good','CG'],
  ['Lawful Neutral','LN'], ['True Neutral','TN'], ['Chaotic Neutral','CN'],
  ['Lawful Evil','LE'], ['Neutral Evil','NE'], ['Chaotic Evil','CE'],
]

function AutoTextarea({ value, onChange, placeholder, minRows = 3 }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = ref.current.scrollHeight + 'px'
    }
  }, [value])
  return (
    <textarea
      ref={ref}
      className="bg-textarea"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={minRows}
    />
  )
}

function PersonalityField({ label, value, isOwner, locked, onChange }) {
  const [editing, setEditing] = useState(false)
  return (
    <div className="personality-field">
      <div className="personality-field-header">
        <span className="personality-label">{label}</span>
        {isOwner && !locked && (
          <button className="bg-edit-btn" onClick={() => setEditing(v => !v)}>
            {editing ? 'Done' : '✎ Edit'}
          </button>
        )}
      </div>
      {editing
        ? <AutoTextarea value={value ?? ''} onChange={onChange} placeholder={`Add ${label.toLowerCase()}…`} minRows={2} />
        : <div className="personality-text">{value || <span className="bg-empty">None recorded.</span>}</div>
      }
    </div>
  )
}

function FreeformCard({ label, value, isOwner, locked, onChange, tall }) {
  const [editing, setEditing] = useState(false)
  return (
    <div className="freeform-card">
      <div className="freeform-header">
        <span className="freeform-label">{label}</span>
        {isOwner && !locked && (
          <button className="bg-edit-btn" onClick={() => setEditing(v => !v)}>
            {editing ? 'Done' : '✎ Edit'}
          </button>
        )}
      </div>
      {editing
        ? <AutoTextarea value={value ?? ''} onChange={onChange} placeholder={`Describe ${label.toLowerCase()}…`} minRows={tall ? 5 : 3} />
        : <div className={`freeform-text${tall ? ' freeform-text--tall' : ''}`}>
            {value || <span className="bg-empty">Nothing recorded yet.</span>}
          </div>
      }
    </div>
  )
}

function AllyCard({ ally, isOwner, locked, onUpdate, onRemove }) {
  const isNew = !ally.name
  const [expanded, setExpanded] = useState(isNew)
  const [editing, setEditing] = useState(isNew)
  const [draft, setDraft] = useState(ally)

  const save = () => { onUpdate(draft); setEditing(false) }

  return (
    <div className={`ally-card${expanded ? ' ally-card--expanded' : ''}`}>
      <div className="ally-head" onClick={() => setExpanded(v => !v)}>
        <span className="ally-name">{ally.name || 'Unnamed'}</span>
        <span className="ally-type">{ally.type || 'Ally'}</span>
        <button className="xbtn" onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}>▾</button>
      </div>
      {expanded && (
        <div className="ally-detail">
          {editing ? (
            <div className="ally-edit">
              <label className="bg-field-label">Name
                <input className="bg-input" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
              </label>
              <label className="bg-field-label">Type
                <input className="bg-input" value={draft.type} onChange={e => setDraft(d => ({ ...d, type: e.target.value }))} placeholder="NPC · Ally, Organisation…" />
              </label>
              <label className="bg-field-label">Description
                <AutoTextarea value={draft.description ?? ''} onChange={v => setDraft(d => ({ ...d, description: v }))} placeholder="Describe this ally…" minRows={2} />
              </label>
              <div className="ally-edit-actions">
                <button className="dact" onClick={save}>Save</button>
                <button className="dact" onClick={() => { setDraft(ally); setEditing(false) }}>Cancel</button>
                <button className="dact dact--danger" onClick={onRemove}>✕ Remove</button>
              </div>
            </div>
          ) : (
            <>
              <p className="ally-desc">{ally.description || <span className="bg-empty">No description.</span>}</p>
              {isOwner && !locked && (
                <button className="bg-edit-btn" style={{ marginTop: 8 }} onClick={() => setEditing(true)}>✎ Edit</button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ClassCard({ cls, isPrimary, isOwner, locked, srdClass, onEdit, onRemove, onSetPrimary, onLevelChange, canLevelUp }) {
  const [expanded, setExpanded] = useState(isPrimary)
  const [expandedLevels, setExpandedLevels] = useState({})

  const toggleLevel = (lvl) => setExpandedLevels(prev => ({ ...prev, [lvl]: !prev[lvl] }))

  const features = srdClass?.features_by_level ?? {}

  return (
    <div className={`class-card${expanded ? ' class-card--expanded' : ''}`}>
      <div className="class-card-head" onClick={() => setExpanded(v => !v)}>
        <div className={`class-level-badge${isPrimary ? '' : ' class-level-badge--secondary'}`}>{cls.level}</div>
        <div className="class-info">
          <div className="class-name">{cls.name}</div>
          {cls.subclass && <div className="class-subclass">{cls.subclass}</div>}
        </div>
        {isPrimary && <span className="primary-pill">Primary</span>}
        <button className="xbtn" onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}>▾</button>
      </div>

      {expanded && (
        <div className="class-detail">
          <div className="class-detail-grid">
            {srdClass?.hit_die && <div className="ds"><span className="ds-lbl">Hit Die</span><span className="ds-val">d{srdClass.hit_die}</span></div>}
            {srdClass?.spellcasting?.spellcasting_ability && (
              <div className="ds"><span className="ds-lbl">Spellcasting</span><span className="ds-val">{srdClass.spellcasting.spellcasting_ability.abbreviation}</span></div>
            )}
            {srdClass?.saving_throws?.length > 0 && (
              <div className="ds"><span className="ds-lbl">Save Profs</span><span className="ds-val">{srdClass.saving_throws.map(s => s.abbreviation).join(', ')}</span></div>
            )}
            <div className="ds"><span className="ds-lbl">Levels</span><span className="ds-val">{cls.level}</span></div>
          </div>

          {Object.keys(features).length > 0 && (
            <div className="abilities-section">
              <div className="abilities-header">Abilities by level</div>
              {Object.entries(features)
                .filter(([lvl]) => Number(lvl) <= cls.level)
                .sort(([a],[b]) => Number(a) - Number(b))
                .map(([lvl, feats]) => (
                  <div key={lvl} className={`level-row${expandedLevels[lvl] ? ' level-row--expanded' : ''}`}>
                    <div className="level-row-head" onClick={() => toggleLevel(lvl)}>
                      <span className="level-num">Level {lvl}</span>
                      <span className="level-gains">{feats.map(f => f.name).join(', ')}</span>
                      <span className="level-chevron">▾</span>
                    </div>
                    {expandedLevels[lvl] && (
                      <div className="level-row-detail">
                        {feats.map(f => (
                          <div key={f.index} className="ability-entry">
                            <div className="ability-name">{f.name}</div>
                            {f.desc?.[0] && <div className="ability-desc">{f.desc.slice(0,2).join(' ').slice(0, 300)}{(f.desc.join(' ')).length > 300 ? '…' : ''}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              }
            </div>
          )}

          {isOwner && !locked && (
            <div className="detail-actions">
              <div className="level-stepper">
                <button className="level-step-btn" onClick={() => onLevelChange(Math.max(0, cls.level - 1))} disabled={cls.level <= 0}>−</button>
                <span className="level-step-val">Lv {cls.level}</span>
                <button className="level-step-btn" onClick={() => onLevelChange(cls.level + 1)} disabled={!canLevelUp || cls.level >= 20}>+</button>
              </div>
              {!isPrimary && <button className="dact" onClick={onSetPrimary}>Set as primary</button>}
              <button className="dact" onClick={onEdit}>✎ Edit</button>
              <button className="dact dact--danger" onClick={onRemove}>✕ Remove</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function BackgroundTab({ char, locked, isOwner, updateChar }) {
  const [srdClasses,     setSrdClasses]     = useState({})
  const [srdRace,        setSrdRace]        = useState(null)
  const [srdBackground,  setSrdBackground]  = useState(null)
  const [alignEditing,   setAlignEditing]   = useState(false)
  const [pendingAlign,   setPendingAlign]   = useState(null)
  const [raceExpanded,   setRaceExpanded]   = useState(true)

  const classes     = char.identity.class ?? []
  const primaryIdx  = char.identity.primaryClassIndex ?? 0
  const alignment   = char.identity.alignment ?? ''
  const subrace     = char.identity.subrace ?? ''
  const personality = char.identity.personality ?? {}
  const allies      = char.allies ?? []
  const totalLevel  = xpToLevel(char.identity?.xp ?? 0)
  const assignedLvl = classes.reduce((s, c) => s + (c.level ?? 0), 0)

  useEffect(() => {
    getClasses().then(all => {
      const map = {}
      for (const c of all) {
        if (c.features_by_level) map[c.index] = c
        else map[c.index] = c
      }
      setSrdClasses(map)
    }).catch(() => {})

    if (char.identity.race) {
      getRaces().then(all => {
        const r = all.find(r => r.name?.toLowerCase() === char.identity.race?.toLowerCase()
          || r.index === char.identity.race?.toLowerCase().replace(/\s+/g,'-'))
        setSrdRace(r ?? null)
      }).catch(() => {})
    }

    if (char.identity.background) {
      getBackgrounds().then(all => {
        const b = all.find(b => b.name?.toLowerCase() === char.identity.background?.toLowerCase()
          || b.index === char.identity.background?.toLowerCase().replace(/\s+/g,'-'))
        setSrdBackground(b ?? null)
      }).catch(() => {})
    }
  }, [char.identity.race, char.identity.background])

  function patchIdentity(patch) {
    updateChar({ identity: { ...char.identity, ...patch } })
  }

  function patchPersonality(field, value) {
    patchIdentity({ personality: { ...personality, [field]: value } })
  }

  function patchAlly(id, data) {
    updateChar({ allies: allies.map(a => a.id === id ? { ...a, ...data } : a) })
  }

  function removeAlly(id) {
    updateChar({ allies: allies.filter(a => a.id !== id) })
  }

  function addAlly() {
    updateChar({ allies: [...allies, { id: Date.now().toString(), name: '', type: 'Ally', description: '' }] })
  }

  function removeClass(idx) {
    const next = classes.filter((_, i) => i !== idx)
    patchIdentity({ class: next, primaryClassIndex: 0 })
  }

  function setPrimary(idx) { patchIdentity({ primaryClassIndex: idx }) }

  function confirmAlignment() {
    if (pendingAlign) patchIdentity({ alignment: pendingAlign })
    setAlignEditing(false)
    setPendingAlign(null)
  }

  const classSummary = classes.map(c => `${c.name} ${c.level}`).join(' / ')

  return (
    <div className="bg-root">

      {/* ── Summary strip ── */}
      <div className="bg-summary-strip">
        <div className="strip-cell">
          <span className="strip-val">{totalLevel}</span>
          <span className="strip-lbl">Total Level</span>
          {classSummary && <span className="strip-sub">{classSummary}</span>}
        </div>
        <div className="strip-cell">
          <span className="strip-val strip-val--md">{alignment || '—'}</span>
          <span className="strip-lbl">Alignment</span>
        </div>
        <div className="strip-cell">
          <span className="strip-val strip-val--md">{char.identity.background || '—'}</span>
          <span className="strip-lbl">Background</span>
        </div>
        <div className="strip-cell">
          <span className="strip-val strip-val--md">{char.identity.race || '—'}</span>
          <span className="strip-lbl">Race</span>
          {subrace && <span className="strip-sub">{subrace}</span>}
        </div>
      </div>

      <div className="bg-scroll">

        {/* ── Race ── */}
        <section>
          <div className="sec-head">Race</div>
          <div className={`race-card${raceExpanded ? ' race-card--expanded' : ''}`}>
            <div className="race-card-head" onClick={() => setRaceExpanded(v => !v)}>
              <div style={{ flex: 1 }}>
                <div className="race-name">{char.identity.race || 'Unknown Race'}</div>
                {subrace && <div className="race-subrace">{subrace}</div>}
              </div>
              {isOwner && !locked && (
                <button className="bg-edit-btn" onClick={e => { e.stopPropagation() }}>✎ Edit</button>
              )}
              <button className="xbtn" onClick={e => { e.stopPropagation(); setRaceExpanded(v => !v) }}>▾</button>
            </div>
            {raceExpanded && (
              <div className="race-detail">
                {srdRace && (
                  <div className="race-bonus-grid">
                    {srdRace.size      && <div className="ds"><span className="ds-lbl">Size</span><span className="ds-val">{srdRace.size}</span></div>}
                    {srdRace.speed     && <div className="ds"><span className="ds-lbl">Speed</span><span className="ds-val">{srdRace.speed} ft</span></div>}
                    {srdRace.languages?.length > 0 && (
                      <div className="ds"><span className="ds-lbl">Languages</span><span className="ds-val">{srdRace.languages.map(l => l.name).join(', ')}</span></div>
                    )}
                    {srdRace.ability_bonuses?.length > 0 && (
                      <div className="ds"><span className="ds-lbl">ASI</span><span className="ds-val">
                        {srdRace.ability_bonuses.map(b => `+${b.bonus} ${b.ability_score.abbreviation}`).join(', ')}
                      </span></div>
                    )}
                  </div>
                )}
                {srdRace?.traits?.length > 0 && (
                  <div className="trait-list">
                    {srdRace.traits.map(t => (
                      <div key={t.index} className="trait-row">
                        <div className="trait-name">{t.name}</div>
                        {t.desc?.[0] && <div className="trait-desc">{t.desc[0].slice(0, 200)}{t.desc[0].length > 200 ? '…' : ''}</div>}
                      </div>
                    ))}
                  </div>
                )}
                {!srdRace && <p className="bg-empty" style={{ padding: '10px 0' }}>No SRD data found for this race.</p>}
              </div>
            )}
          </div>
        </section>

        {/* ── Class & Multiclass ── */}
        <section>
          <div className="sec-head">Class {classes.length > 1 ? '& Multiclass' : ''}</div>
          <div className="class-grid">
            {classes.map((cls, idx) => (
              <ClassCard
                key={cls.name + idx}
                cls={cls}
                isPrimary={idx === primaryIdx}
                isOwner={isOwner}
                locked={locked}
                srdClass={srdClasses[cls.name?.toLowerCase().replace(/\s+/g,'-')] ?? null}
                onEdit={() => {}}
                onRemove={() => removeClass(idx)}
                onSetPrimary={() => setPrimary(idx)}
                onLevelChange={lv => patchIdentity({ class: classes.map((c, i) => i === idx ? { ...c, level: lv } : c) })}
                canLevelUp={assignedLvl < totalLevel}
              />
            ))}
          </div>
        </section>

        {/* ── Background ── */}
        <section>
          <div className="sec-head">Background</div>
          <div className="bg-card">
            <div className="bg-card-row">
              <div className="bg-name">{char.identity.background || 'No background selected'}</div>
              {isOwner && !locked && <button className="bg-edit-btn">✎ Edit</button>}
            </div>
            {srdBackground?.feature && (
              <>
                <div className="bg-feature-label">Background Feature</div>
                <div className="bg-feature-text">
                  <strong style={{ color: 'var(--text-primary)' }}>{srdBackground.feature.name}.</strong>{' '}
                  {srdBackground.feature.desc?.[0]}
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── Personality ── */}
        <section>
          <div className="sec-head">Personality</div>
          <div className="personality-grid">
            {[
              ['Traits',  'traits'],
              ['Ideals',  'ideals'],
              ['Bonds',   'bonds'],
              ['Flaws',   'flaws'],
            ].map(([label, key]) => (
              <PersonalityField
                key={key}
                label={label}
                value={personality[key]}
                isOwner={isOwner}
                locked={locked}
                onChange={v => patchPersonality(key, v)}
              />
            ))}
          </div>
        </section>

        {/* ── Alignment ── */}
        <section>
          <div className="sec-head">Alignment</div>
          <div className="alignment-section">
            <div className="alignment-header">
              <div className="alignment-current">
                {alignEditing
                  ? (pendingAlign ? `Choose: ${pendingAlign}` : 'Choose new alignment below')
                  : (alignment || '—')
                }
                {!alignEditing && alignment && <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 400, marginLeft: 6 }}>— tap Edit to change</span>}
              </div>
              {isOwner && !locked && !alignEditing && (
                <button className="bg-edit-btn" onClick={() => setAlignEditing(true)}>✎ Edit</button>
              )}
            </div>
            {alignEditing && (
              <>
                <div className="alignment-grid">
                  {ALIGNMENTS.map(([name, abbr]) => (
                    <div
                      key={name}
                      className={`align-cell${pendingAlign === name ? ' align-cell--selected' : ''}`}
                      onClick={() => setPendingAlign(name)}
                    >
                      <div className="align-cell-name">{name}</div>
                      <div className="align-cell-short">{abbr}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  {pendingAlign && (
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={confirmAlignment}>
                      Confirm — {pendingAlign}
                    </button>
                  )}
                  <button className="dact" onClick={() => { setAlignEditing(false); setPendingAlign(null) }}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── Appearance ── */}
        <section>
          <div className="sec-head">Appearance</div>
          <FreeformCard
            label="Physical Description"
            value={char.identity.appearance}
            isOwner={isOwner}
            locked={locked}
            onChange={v => patchIdentity({ appearance: v })}
          />
        </section>

        {/* ── Backstory ── */}
        <section>
          <div className="sec-head">Backstory</div>
          <FreeformCard
            label="Character History"
            value={char.identity.backstory}
            isOwner={isOwner}
            locked={locked}
            onChange={v => patchIdentity({ backstory: v })}
            tall
          />
        </section>

        {/* ── Allies & Organisations ── */}
        <section>
          <div className="sec-head">Allies & Organisations</div>
          {allies.map(ally => (
            <AllyCard
              key={ally.id}
              ally={ally}
              isOwner={isOwner}
              locked={locked}
              onUpdate={data => patchAlly(ally.id, data)}
              onRemove={() => removeAlly(ally.id)}
            />
          ))}
          {isOwner && !locked && (
            <button className="add-ally-btn" onClick={addAlly}>+ Add ally or organisation</button>
          )}
          {allies.length === 0 && !isOwner && <p className="empty-hint">No allies recorded.</p>}
        </section>

      </div>
    </div>
  )
}

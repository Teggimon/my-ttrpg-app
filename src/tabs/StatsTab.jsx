import { useState } from 'react'
import '../TabShared.css'
import './StatsTab.css'

const ABILITIES = ['str','dex','con','int','wis','cha']
const ABILITY_LABELS = { str:'STR', dex:'DEX', con:'CON', int:'INT', wis:'WIS', cha:'CHA' }
const ABILITY_FULL   = { str:'Strength', dex:'Dexterity', con:'Constitution', int:'Intelligence', wis:'Wisdom', cha:'Charisma' }

const SKILLS = [
  { key:'acrobatics',     ability:'dex', label:'Acrobatics' },
  { key:'animalHandling', ability:'wis', label:'Animal Handling' },
  { key:'arcana',         ability:'int', label:'Arcana' },
  { key:'athletics',      ability:'str', label:'Athletics' },
  { key:'deception',      ability:'cha', label:'Deception' },
  { key:'history',        ability:'int', label:'History' },
  { key:'insight',        ability:'wis', label:'Insight' },
  { key:'intimidation',   ability:'cha', label:'Intimidation' },
  { key:'investigation',  ability:'int', label:'Investigation' },
  { key:'medicine',       ability:'wis', label:'Medicine' },
  { key:'nature',         ability:'int', label:'Nature' },
  { key:'perception',     ability:'wis', label:'Perception' },
  { key:'performance',    ability:'cha', label:'Performance' },
  { key:'persuasion',     ability:'cha', label:'Persuasion' },
  { key:'religion',       ability:'int', label:'Religion' },
  { key:'sleightOfHand',  ability:'dex', label:'Sleight of Hand' },
  { key:'stealth',        ability:'dex', label:'Stealth' },
  { key:'survival',       ability:'wis', label:'Survival' },
]

const SAVE_PAIRS  = [['str','dex'], ['con','int'], ['wis','cha']]
const PROFICIENCY = [0,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6]
const DEFAULT_PROF_CATS = ['Armour', 'Weapons', 'Tools', 'Languages']

// Matches InventoryTab's MAGIC_AC_BONUS
const MAGIC_AC_BONUS = {
  'ring-of-protection':    1,
  'cloak-of-protection':   1,
  'ioun-stone-protection': 1,
}

function mod(score) { return Math.floor((score - 10) / 2) }
function fmtB(n)    { return n >= 0 ? `+${n}` : `${n}` }

// ── Effect dot with hover tooltip ─────────────────────────────────────────────
function EffectDot({ infos }) {
  const [show, setShow] = useState(false)
  if (!infos?.length) return null
  return (
    <span
      className="effect-dot-wrap"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="effect-pip" />
      {show && (
        <div className="effect-tooltip">
          {infos.map((info, i) => (
            <div key={i} className="effect-tooltip-line">
              <span className="effect-tooltip-gem">♦</span>
              <span>{info.bonus}</span>
              <span className="effect-tooltip-sep">·</span>
              <span className="effect-tooltip-item">{info.itemName}</span>
              {info.state && <span className="effect-tooltip-state">({info.state})</span>}
            </div>
          ))}
        </div>
      )}
    </span>
  )
}

export default function StatsTab({ char, locked, isOwner, updateChar }) {
  const [editing,   setEditing]   = useState(false)
  const [newProf,   setNewProf]   = useState({})
  const [newCat,    setNewCat]    = useState('')
  const [addingCat, setAddingCat] = useState(false)

  const scores = char.stats?.abilityScores ?? {}
  const skills = char.stats?.skills ?? {}
  const saves  = char.stats?.savingThrows ?? {}
  const level  = char.identity.class?.[0]?.level ?? 1
  const pb     = PROFICIENCY[level] ?? 2
  const dexMod = mod(scores.dex ?? 10)

  const initiative  = dexMod + (char.combat?.initiativeBonus ?? 0)
  const ac          = char.combat?.ac ?? 10
  const speed       = char.combat?.speed ?? char.identity?.speed ?? 30
  const percLvl     = skillLevel('perception')
  const passivePerc = 10 + mod(scores.wis ?? 10) + (percLvl === 1 ? pb : percLvl === 2 ? pb * 2 : 0)

  const proficiencies = char.stats?.proficiencies ?? {}
  const profList = typeof proficiencies === 'object' && !Array.isArray(proficiencies)
    ? proficiencies
    : { Armour: [], Weapons: [], Tools: [], Languages: Array.isArray(char.identity?.languages) ? char.identity.languages : [] }
  const allCats = [...new Set([...DEFAULT_PROF_CATS, ...Object.keys(profList).filter(k => !DEFAULT_PROF_CATS.includes(k))])]

  // ── Item effect helpers ───────────────────────────────────────────────────
  const activeItems = (char.inventory ?? []).filter(i => i.equipped || i.attuned)

  function itemEffectsFor(statName) {
    // statName matches effect.stat (e.g. 'AC', 'STR', 'Saving Throws', 'Speed')
    const results = []
    for (const item of activeItems) {
      // Explicit effects
      for (const ef of item.effects ?? []) {
        if (ef.stat === statName) {
          const val = ef.mode === 'add'
            ? (ef.value >= 0 ? `+${ef.value}` : String(ef.value))
            : `=${ef.value}`
          const state = [item.equipped && 'equipped', item.attuned && 'attuned'].filter(Boolean).join(' · ')
          results.push({ bonus: `${val} ${statName}`, itemName: item.name, state })
        }
      }
      // Implicit: MAGIC_AC_BONUS items
      if (statName === 'AC') {
        const bonus = MAGIC_AC_BONUS[item.index]
        if (bonus != null) {
          const state = [item.equipped && 'equipped', item.attuned && 'attuned'].filter(Boolean).join(' · ')
          results.push({ bonus: `+${bonus} AC`, itemName: item.name, state })
        }
        if (item.ac_bonus != null) {
          const state = [item.equipped && 'equipped', item.attuned && 'attuned'].filter(Boolean).join(' · ')
          results.push({ bonus: `+${item.ac_bonus} AC`, itemName: item.name, state })
        }
      }
    }
    return results
  }

  // ── Stat helpers ──────────────────────────────────────────────────────────
  function setScore(ability, val) {
    const v = Math.max(1, Math.min(30, Number(val) || 10))
    updateChar({ stats: { ...char.stats, abilityScores: { ...scores, [ability]: v } } })
  }

  function toggleSave(ab) {
    if (!isOwner || locked) return
    const current = saves[ab]?.proficient ?? saves[ab] ?? false
    updateChar({ stats: { ...char.stats, savingThrows: { ...saves, [ab]: !current } } })
  }

  function skillLevel(key) {
    const v = skills[key]
    if (typeof v === 'number') return v
    return v?.proficient ? 1 : 0
  }

  function cycleSkill(key) {
    if (!isOwner || locked) return
    updateChar({ stats: { ...char.stats, skills: { ...skills, [key]: (skillLevel(key) + 1) % 3 } } })
  }

  function skillBonus(sk) {
    const lvl  = skillLevel(sk.key)
    const base = mod(scores[sk.ability] ?? 10)
    return lvl === 0 ? base : lvl === 1 ? base + pb : base + pb * 2
  }

  function saveBonus(ab) {
    return mod(scores[ab] ?? 10) + (isProfSave(ab) ? pb : 0)
  }

  function isProfSave(ab) { return !!(saves[ab]?.proficient ?? saves[ab]) }

  function addProf(cat, val) {
    const t = val.trim(); if (!t) return
    const existing = profList[cat] ?? []
    if (existing.includes(t)) return
    updateChar({ stats: { ...char.stats, proficiencies: { ...profList, [cat]: [...existing, t] } } })
    setNewProf(p => ({ ...p, [cat]: '' }))
  }

  function removeProf(cat, item) {
    updateChar({ stats: { ...char.stats, proficiencies: { ...profList, [cat]: (profList[cat] ?? []).filter(p => p !== item) } } })
  }

  function addCategory(name) {
    const t = name.trim(); if (!t || profList[t]) return
    updateChar({ stats: { ...char.stats, proficiencies: { ...profList, [t]: [] } } })
    setNewCat(''); setAddingCat(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const acEffects    = itemEffectsFor('AC')
  const speedEffects = itemEffectsFor('Speed')

  return (
    <div className="stats-root">

      {/* ── Summary strip ── */}
      <div className="stats-summary">
        {[
          { val: fmtB(pb),          lbl: 'Prof Bonus',   effects: [] },
          { val: fmtB(initiative),  lbl: 'Initiative',   effects: itemEffectsFor('Initiative') },
          { val: passivePerc,       lbl: 'Passive Perc', effects: [] },
          { val: ac,                lbl: 'AC',            effects: acEffects },
          { val: `${speed}ft`,      lbl: 'Speed',         effects: speedEffects },
        ].map(({ val, lbl, effects }) => (
          <div key={lbl} className="summary-cell">
            <div className="summary-val-wrap">
              <span className="summary-val">{val}</span>
              {effects.length > 0 && <EffectDot infos={effects} />}
            </div>
            <span className="summary-lbl">{lbl}</span>
          </div>
        ))}
      </div>

      <div className="stats-scroll">

        {/* ── Ability Scores ── */}
        <div className="sec-head" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span>Ability Scores</span>
          {isOwner && <button className="add-link" onClick={() => setEditing(e => !e)}>{editing ? 'Done' : 'Edit'}</button>}
        </div>

        <div className="ability-grid">
          {ABILITIES.map(ab => {
            const profSave  = isProfSave(ab)
            const abEffects = itemEffectsFor(ABILITY_LABELS[ab]) // 'STR','DEX' etc.
            return (
              <div key={ab} className="ability-card card">
                {abEffects.length > 0 && (
                  <span className="ability-effect-dot-wrap">
                    <EffectDot infos={abEffects} />
                  </span>
                )}
                <span className="ability-mod">{fmtB(mod(scores[ab] ?? 10))}</span>
                {editing ? (
                  <input className="ability-input" type="number" min="1" max="30"
                    value={scores[ab] ?? 10} onChange={e => setScore(ab, e.target.value)} />
                ) : (
                  <span className="ability-score">{scores[ab] ?? 10}</span>
                )}
                <span className="ability-label">{ABILITY_LABELS[ab]}</span>
                <button
                  className={`ability-save-dot${profSave ? ' ability-save-dot--on' : ''}`}
                  onClick={() => toggleSave(ab)}
                  disabled={!isOwner || locked}
                  title={`${ABILITY_FULL[ab]} saving throw ${profSave ? '(proficient)' : '(click to add)'}`}
                />
              </div>
            )
          })}
        </div>
        <p className="stat-legend">· bottom-right dot = saving throw proficiency</p>

        {/* ── Saving Throws ── */}
        <div className="sec-head">Saving Throws</div>
        <div className="card save-grid">
          {SAVE_PAIRS.map(pair => (
            <div key={pair.join()} className="save-pair">
              {pair.map(ab => {
                const prof      = isProfSave(ab)
                const bonus     = saveBonus(ab)
                const saveEffects = itemEffectsFor('Saving Throws')
                return (
                  <div
                    key={ab}
                    className={`save-row${isOwner && !locked ? ' save-row--clickable' : ''}`}
                    onClick={() => toggleSave(ab)}
                  >
                    <span className={`save-dot${prof ? ' save-dot--prof' : ''}`} />
                    <span className="save-name">
                      {ABILITY_FULL[ab]}
                      <span className="save-abbr"> ({ABILITY_LABELS[ab].toLowerCase()})</span>
                    </span>
                    <span className={`save-bonus${prof ? ' save-bonus--prof' : ''}`}>{fmtB(bonus)}</span>
                    {saveEffects.length > 0 && <EffectDot infos={saveEffects} />}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* ── Skills ── */}
        <div className="sec-head">Skills</div>
        <div className="card skill-grid">
          {Array.from({ length: Math.ceil(SKILLS.length / 2) }, (_, pi) => {
            const pair = [SKILLS[pi * 2], SKILLS[pi * 2 + 1]].filter(Boolean)
            return (
              <div key={pi} className="skill-pair">
                {pair.map(sk => {
                  const lvl   = skillLevel(sk.key)
                  const bonus = skillBonus(sk)
                  return (
                    <div
                      key={sk.key}
                      className={`skill-row${isOwner && !locked ? ' skill-row--clickable' : ''}`}
                      onClick={() => cycleSkill(sk.key)}
                      title={['Click for proficiency','Click for expertise','Click to remove'][lvl]}
                    >
                      {/* Prof / expertise indicator */}
                      <span className={`skill-dot skill-dot--${lvl}`}>
                        {lvl === 2 && <span className="skill-dot-star">★</span>}
                      </span>
                      <span className="skill-name">
                        {sk.label}
                        <span className="skill-abbr"> ({ABILITY_LABELS[sk.ability].toLowerCase()})</span>
                      </span>
                      <span className={`skill-bonus skill-bonus--${lvl}`}>{fmtB(bonus)}</span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* ── Other Proficiencies ── */}
        <div className="sec-head">Other Proficiencies</div>
        <div className="card prof-card">
          {allCats.map((cat, ci) => (
            <div key={cat} className={`prof-row${ci < allCats.length - 1 ? ' prof-row--border' : ''}`}>
              <div className="prof-row-head">
                <span className="prof-cat-label">{cat}</span>
                {isOwner && !locked && (
                  <form onSubmit={e => { e.preventDefault(); addProf(cat, newProf[cat] ?? '') }}>
                    <input
                      className="prof-add-input"
                      placeholder="+ Add"
                      value={newProf[cat] ?? ''}
                      onChange={e => setNewProf(p => ({ ...p, [cat]: e.target.value }))}
                    />
                  </form>
                )}
              </div>
              <div className="prof-pills">
                {(profList[cat] ?? []).map(item => (
                  <span key={item} className={`prof-pill${item.includes('½') ? ' prof-pill--half' : ''}`}>
                    {item}
                    {isOwner && !locked && (
                      <button className="prof-pill-remove" onClick={() => removeProf(cat, item)}>×</button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {isOwner && !locked && (
            <div className="prof-add-cat-row">
              {addingCat ? (
                <form onSubmit={e => { e.preventDefault(); addCategory(newCat) }} style={{ display:'flex', gap:6, width:'100%' }}>
                  <input className="prof-add-input" placeholder="Category name…" value={newCat}
                    onChange={e => setNewCat(e.target.value)} autoFocus style={{ flex:1, width:'auto' }} />
                  <button type="submit" style={{ background:'var(--accent)', border:'none', borderRadius:'var(--radius-md)', color:'#fff', fontSize:11, fontWeight:700, padding:'4px 10px', cursor:'pointer', fontFamily:'var(--font-body)' }}>Add</button>
                  <button type="button" onClick={() => setAddingCat(false)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:13, fontFamily:'var(--font-body)' }}>Cancel</button>
                </form>
              ) : (
                <button className="prof-add-cat-btn" onClick={() => setAddingCat(true)}>+ Add category</button>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

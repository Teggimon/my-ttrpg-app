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

const PROFICIENCY = [0,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6]
const PROF_ICONS  = ['◇','◆','★']

// Default proficiency categories — built from char data
const DEFAULT_PROF_CATS = ['Armour', 'Weapons', 'Tools', 'Languages']

function mod(score)  { return Math.floor((score - 10) / 2) }
function fmtB(n)     { return n >= 0 ? `+${n}` : `${n}` }

export default function StatsTab({ char, locked, isOwner, updateChar }) {
  const [editing, setEditing]   = useState(false)
  const [newProf, setNewProf]   = useState({}) // {catName: inputValue}

  const scores  = char.stats?.abilityScores ?? {}
  const skills  = char.stats?.skills ?? {}
  const saves   = char.stats?.savingThrows ?? {}
  const level   = char.identity.class?.[0]?.level ?? 1
  const pb      = PROFICIENCY[level] ?? 2
  const dexMod  = mod(scores.dex ?? 10)
  const wisMod  = mod(scores.wis ?? 10)

  // Summary row values
  const initiative     = dexMod + (char.combat?.initiativeBonus ?? 0)
  const ac             = char.combat?.ac ?? 10
  const speed          = char.combat?.speed ?? char.identity?.speed ?? 30
  const passivePerc    = 10 + mod(scores.wis ?? 10) + (skills.perception === 1 ? pb : skills.perception === 2 ? pb * 2 : 0)

  // Other proficiencies stored as { Armour:[], Weapons:[], Tools:[], Languages:[], ...custom }
  const proficiencies = char.stats?.proficiencies ?? {}
  // Build initial from class/background proficiency strings if not yet an object
  const profList = typeof proficiencies === 'object' && !Array.isArray(proficiencies)
    ? proficiencies
    : { Armour: [], Weapons: [], Tools: [], Languages: Array.isArray(char.identity?.languages) ? char.identity.languages : [] }

  function setScore(ability, val) {
    const v = Math.max(1, Math.min(30, Number(val) || 10))
    updateChar({ stats: { ...char.stats, abilityScores: { ...scores, [ability]: v } } })
  }

  function cycleSkill(key) {
    const current = typeof skills[key] === 'number' ? skills[key] : (skills[key]?.proficient ? 1 : 0)
    const next    = (current + 1) % 3
    updateChar({ stats: { ...char.stats, skills: { ...skills, [key]: next } } })
  }

  function skillLevel(key) {
    const v = skills[key]
    if (typeof v === 'number') return v
    return v?.proficient ? 1 : 0
  }

  function skillBonus(skill) {
    const lvl   = skillLevel(skill.key)
    const base  = mod(scores[skill.ability] ?? 10)
    return fmtB(lvl === 0 ? base : lvl === 1 ? base + pb : base + pb * 2)
  }

  function addProf(cat, val) {
    const trimmed = val.trim()
    if (!trimmed) return
    const existing = profList[cat] ?? []
    if (existing.includes(trimmed)) return
    updateChar({ stats: { ...char.stats, proficiencies: { ...profList, [cat]: [...existing, trimmed] } } })
    setNewProf(p => ({ ...p, [cat]: '' }))
  }

  function removeProf(cat, item) {
    updateChar({ stats: { ...char.stats, proficiencies: { ...profList, [cat]: (profList[cat] ?? []).filter(p => p !== item) } } })
  }

  const allCats = [...new Set([...DEFAULT_PROF_CATS, ...Object.keys(profList).filter(k => !DEFAULT_PROF_CATS.includes(k))])]

  return (
    <div className="stats-root">

      {/* ── Summary strip ── */}
      <div className="stats-summary">
        <div className="summary-cell">
          <span className="summary-val">{fmtB(pb)}</span>
          <span className="summary-lbl">Prof Bonus</span>
        </div>
        <div className="summary-cell">
          <span className="summary-val">{fmtB(initiative)}</span>
          <span className="summary-lbl">Initiative</span>
        </div>
        <div className="summary-cell">
          <span className="summary-val">{ac}</span>
          <span className="summary-lbl">AC</span>
        </div>
        <div className="summary-cell">
          <span className="summary-val">{speed}ft</span>
          <span className="summary-lbl">Speed</span>
        </div>
        <div className="summary-cell">
          <span className="summary-val">{passivePerc}</span>
          <span className="summary-lbl">Passive Perc</span>
        </div>
      </div>

      <div className="stats-scroll">

        {/* ── Ability scores ── */}
        <div className="sec-head" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span>Ability Scores</span>
          {isOwner && <button className="add-link" onClick={() => setEditing(e => !e)}>{editing ? 'Done' : 'Edit'}</button>}
        </div>
        <div className="ability-grid">
          {ABILITIES.map(ab => {
            const profSave = saves[ab]?.proficient ?? saves[ab] ?? false
            return (
              <div key={ab} className="ability-card card">
                <span className="ability-mod">{fmtB(mod(scores[ab] ?? 10))}</span>
                {editing ? (
                  <input className="ability-input" type="number" min="1" max="30"
                    value={scores[ab] ?? 10} onChange={e => setScore(ab, e.target.value)} />
                ) : (
                  <span className="ability-score">{scores[ab] ?? 10}</span>
                )}
                <span className="ability-label">{ABILITY_LABELS[ab]}</span>
                {profSave && <span className="save-prof-dot" title={`${ABILITY_FULL[ab]} save proficient`}>💪</span>}
              </div>
            )
          })}
        </div>

        {/* ── Saving throws ── */}
        <div className="sec-head">Saving Throws</div>
        <div className="card save-list">
          {ABILITIES.map(ab => {
            const profSave = saves[ab]?.proficient ?? saves[ab] ?? false
            const bonus    = mod(scores[ab] ?? 10) + (profSave ? pb : 0)
            return (
              <div key={ab} className="save-row">
                <span className={`save-dot${profSave ? ' save-dot--prof' : ''}`} />
                <span className="save-name">{ABILITY_FULL[ab]}</span>
                <span className="save-ability">{ABILITY_LABELS[ab]}</span>
                <span className="save-bonus">{fmtB(bonus)}</span>
              </div>
            )
          })}
        </div>

        {/* ── Skills ── */}
        <div className="sec-head">Skills</div>
        <div className="card skill-list">
          {SKILLS.map(sk => {
            const lvl      = skillLevel(sk.key)
            const canEdit  = isOwner && !locked
            return (
              <div
                key={sk.key}
                className={`skill-row${canEdit ? ' skill-row--editable' : ''}`}
                onClick={() => canEdit && cycleSkill(sk.key)}
              >
                <span className="skill-prof">{PROF_ICONS[lvl]}</span>
                <span className="skill-name">{sk.label}</span>
                <span className="skill-ability">{ABILITY_LABELS[sk.ability]}</span>
                <span className="skill-bonus">{skillBonus(sk)}</span>
              </div>
            )
          })}
        </div>

        {/* ── Other proficiencies ── */}
        <div className="sec-head">Other Proficiencies</div>
        <div className="prof-cats">
          {allCats.map(cat => (
            <div key={cat} className="prof-cat">
              <div className="prof-cat-head">
                <span className="prof-cat-label">{cat}</span>
              </div>
              <div className="prof-pills">
                {(profList[cat] ?? []).map(item => (
                  <span key={item} className="prof-pill">
                    {item}
                    {isOwner && !locked && (
                      <button className="prof-pill-remove" onClick={() => removeProf(cat, item)}>×</button>
                    )}
                  </span>
                ))}
                {isOwner && !locked && (
                  <form onSubmit={e => { e.preventDefault(); addProf(cat, newProf[cat] ?? '') }} style={{ display:'inline-flex' }}>
                    <input
                      className="prof-add-input"
                      placeholder="+ Add"
                      value={newProf[cat] ?? ''}
                      onChange={e => setNewProf(p => ({ ...p, [cat]: e.target.value }))}
                    />
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}

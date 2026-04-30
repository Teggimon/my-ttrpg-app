import { useState } from 'react'
import '../TabShared.css'
import './StatsTab.css'

const ABILITIES = ['str','dex','con','int','wis','cha']
const ABILITY_LABELS = { str:'STR', dex:'DEX', con:'CON', int:'INT', wis:'WIS', cha:'CHA' }

const SKILLS = [
  { key:'athletics',      ability:'str', label:'Athletics' },
  { key:'acrobatics',     ability:'dex', label:'Acrobatics' },
  { key:'sleightOfHand',  ability:'dex', label:'Sleight of Hand' },
  { key:'stealth',        ability:'dex', label:'Stealth' },
  { key:'arcana',         ability:'int', label:'Arcana' },
  { key:'history',        ability:'int', label:'History' },
  { key:'investigation',  ability:'int', label:'Investigation' },
  { key:'nature',         ability:'int', label:'Nature' },
  { key:'religion',       ability:'int', label:'Religion' },
  { key:'animalHandling', ability:'wis', label:'Animal Handling' },
  { key:'insight',        ability:'wis', label:'Insight' },
  { key:'medicine',       ability:'wis', label:'Medicine' },
  { key:'perception',     ability:'wis', label:'Perception' },
  { key:'survival',       ability:'wis', label:'Survival' },
  { key:'deception',      ability:'cha', label:'Deception' },
  { key:'intimidation',   ability:'cha', label:'Intimidation' },
  { key:'performance',    ability:'cha', label:'Performance' },
  { key:'persuasion',     ability:'cha', label:'Persuasion' },
]

const PROFICIENCY = [0,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6]

function mod(score) { return Math.floor((score - 10) / 2) }
function fmtBonus(n) { return n >= 0 ? `+${n}` : `${n}` }

export default function StatsTab({ char, locked, isOwner, updateChar }) {
  const [editing, setEditing] = useState(false)

  const scores = char.stats?.abilityScores ?? {}
  const skills = char.stats?.skills ?? {}
  const level  = char.identity.class?.[0]?.level ?? 1
  const pb     = PROFICIENCY[level] ?? 2

  function setScore(ability, val) {
    const v = Math.max(1, Math.min(30, Number(val) || 10))
    updateChar({ stats: { ...char.stats, abilityScores: { ...scores, [ability]: v } } })
  }

  function cycleSkill(key) {
    const current = skills[key] ?? 0
    const next    = (current + 1) % 3
    updateChar({ stats: { ...char.stats, skills: { ...skills, [key]: next } } })
  }

  function skillBonus(skill) {
    const base   = mod(scores[skill.ability] ?? 10)
    const prof   = skills[skill.key] ?? 0
    const bonus  = prof === 0 ? base : prof === 1 ? base + pb : base + pb * 2
    return fmtBonus(bonus)
  }

  const PROF_ICONS = ['◇','◆','◈']

  return (
    <div>
      {/* ── Ability scores ── */}
      <div className="sec-head" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span>Ability scores</span>
        {isOwner && (
          <button className="add-link" onClick={() => setEditing(e => !e)}>
            {editing ? 'Done' : 'Edit'}
          </button>
        )}
      </div>
      <div className="ability-grid">
        {ABILITIES.map(ab => (
          <div key={ab} className="ability-card card">
            <span className="ability-mod">{fmtBonus(mod(scores[ab] ?? 10))}</span>
            {editing ? (
              <input
                className="ability-input"
                type="number"
                min="1" max="30"
                value={scores[ab] ?? 10}
                onChange={e => setScore(ab, e.target.value)}
              />
            ) : (
              <span className="ability-score">{scores[ab] ?? 10}</span>
            )}
            <span className="ability-label">{ABILITY_LABELS[ab]}</span>
          </div>
        ))}
      </div>

      {/* ── Saving throws ── */}
      <div className="sec-head">Saving throws</div>
      <div className="card save-list">
        {ABILITIES.map(ab => {
          const proficient = char.stats?.savingThrows?.[ab]
          const bonus = mod(scores[ab] ?? 10) + (proficient ? pb : 0)
          return (
            <div key={ab} className="save-row">
              <span className={`save-dot ${proficient ? 'save-dot--prof' : ''}`} />
              <span className="save-name">{ABILITY_LABELS[ab]}</span>
              <span className="save-bonus">{fmtBonus(bonus)}</span>
            </div>
          )
        })}
      </div>

      {/* ── Skills ── */}
      <div className="sec-head">Skills</div>
      <div className="card skill-list">
        {SKILLS.map(sk => (
          <div
            key={sk.key}
            className={`skill-row ${isOwner && !locked ? 'skill-row--editable' : ''}`}
            onClick={() => isOwner && !locked && cycleSkill(sk.key)}
          >
            <span className="skill-prof">{PROF_ICONS[skills[sk.key] ?? 0]}</span>
            <span className="skill-name">{sk.label}</span>
            <span className="skill-ability">{ABILITY_LABELS[sk.ability]}</span>
            <span className="skill-bonus">{skillBonus(sk)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { Octokit } from '@octokit/rest'

function CharacterSheet({ character, token, user, onBack, onUpdate }) {
  const [activeTab, setActiveTab] = useState('combat')
  const [char, setChar] = useState(character)
  const [locked, setLocked] = useState(false)
  const [syncStatus, setSyncStatus] = useState('saved')
  const [showXPPopup, setShowXPPopup] = useState(false)
  const debounceTimer = useRef(null)

  const octokit = new Octokit({ auth: token })
  const repoName = localStorage.getItem('character_repo')
  const isOwner = char.meta.owner === `github:${user.login}`

  const saveToGitHub = async (character) => {
    setSyncStatus('saving')
    try {
      const fileName = character.identity.name.toLowerCase().replace(/\s+/g, '-')
      const { data: existing } = await octokit.repos.getContent({
        owner: user.login,
        repo: repoName,
        path: `characters/${fileName}.json`,
      })
      await octokit.repos.createOrUpdateFileContents({
        owner: user.login,
        repo: repoName,
        path: `characters/${fileName}.json`,
        message: `Update character: ${character.identity.name}`,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(character, null, 2)))),
        sha: existing.sha,
      })
      setSyncStatus('saved')
    } catch (err) {
      setSyncStatus('error')
    }
  }

  const updateChar = (updates) => {
    const updated = { ...char, ...updates }
    setChar(updated)
    setSyncStatus('saving')
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      saveToGitHub(updated)
    }, 1500)
  }

  const tabs = [
    { id: 'combat', label: '⚔️' },
    { id: 'stats', label: '🎲' },
    { id: 'spells', label: '✨' },
    { id: 'inventory', label: '🎒' },
    { id: 'notes', label: '📝' },
  ]

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '1rem', borderBottom: '1px solid #333', background: '#1a1a2e' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.2rem' }}>←</button>
          {isOwner && (
            <button onClick={() => setLocked(!locked)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>
              {locked ? '🔒' : '🔓'}
            </button>
          )}
         {!isOwner && <span>🔒</span>}
          <strong style={{ fontSize: '1.2rem' }}>{char.identity.name}</strong>
          <span style={{ color: '#aaa', fontSize: '0.9rem' }}>
            {char.identity.race} · {char.identity.class[0].name} {char.identity.class[0].level}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: syncStatus === 'saved' ? '#4caf50' : syncStatus === 'error' ? '#f44336' : '#aaa' }}>
            {syncStatus === 'saved' ? '✓ Saved' : syncStatus === 'saving' ? '⟳ Saving...' : '⚠️ Error'}
          </span>
        </div>

        {/* XP Row */}
<button
  onClick={() => setShowXPPopup(true)}
  style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '0.85rem', cursor: 'pointer', padding: 0, marginBottom: '0.5rem', textAlign: 'left' }}
>
  XP {char.identity.xp} ✏️
</button>

        {/* HP Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>HP</span>
            <strong>{char.combat.hpCurrent} / {char.combat.hpMax}</strong>
            {isOwner && !locked && (
              <>
                <button onClick={() => updateChar({ combat: { ...char.combat, hpCurrent: Math.max(0, char.combat.hpCurrent - 1) } })}>−</button>
                <button onClick={() => updateChar({ combat: { ...char.combat, hpCurrent: Math.min(char.combat.hpMax, char.combat.hpCurrent + 1) } })}>+</button>
              </>
            )}
          </div>
          <div>AC <strong>{char.combat.ac}</strong></div>
        </div>

        {/* Conditions */}
        {char.combat.conditions.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {char.combat.conditions.map(c => (
              <span key={c} style={{ background: '#8b0000', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>{c}</span>
            ))}
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #333', background: '#12122a' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: activeTab === tab.id ? '#1a1a2e' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #fff' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '1.2rem',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ padding: '1rem' }}>
        {activeTab === 'combat' && <CombatTab char={char} locked={locked} isOwner={isOwner} updateChar={updateChar} />}
        {activeTab === 'stats' && <StatsTab char={char} locked={locked} isOwner={isOwner} updateChar={updateChar} />}
        {activeTab === 'spells' && <SpellsTab char={char} />}
        {activeTab === 'inventory' && <InventoryTab char={char} />}
        {activeTab === 'notes' && <NotesTab char={char} locked={locked} isOwner={isOwner} updateChar={updateChar} />}
      </div>
    </div>
  )
}

function CombatTab({ char, locked, isOwner, updateChar }) {
  const [showConditionPicker, setShowConditionPicker] = useState(false)

  const allConditions = [
    'Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened',
    'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified',
    'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious'
  ]

  const addCondition = (condition) => {
    if (!char.combat.conditions.includes(condition)) {
      updateChar({ combat: { ...char.combat, conditions: [...char.combat.conditions, condition] } })
    }
    setShowConditionPicker(false)
  }

  const removeCondition = (condition) => {
    updateChar({ combat: { ...char.combat, conditions: char.combat.conditions.filter(c => c !== condition) } })
  }

  const toggleDeathSave = (type, index) => {
    const current = char.combat.deathSaves[type]
    const updated = current > index ? index : index + 1
    updateChar({ combat: { ...char.combat, deathSaves: { ...char.combat.deathSaves, [type]: updated } } })
  }

  const changeLevel = (delta) => {
    const currentLevel = char.identity.class[0].level
    const newLevel = Math.max(1, Math.min(20, currentLevel + delta))
    updateChar({
      identity: {
        ...char.identity,
        class: [{ ...char.identity.class[0], level: newLevel }]
      }
    })
  }

  return (
    <div>
      <h3>Combat</h3>

      {/* Level */}
      <div style={{ marginBottom: '1rem' }}>
        <label>Level</label><br />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
          {isOwner && !locked && (
            <button onClick={() => changeLevel(-1)} style={{ padding: '0.25rem 0.75rem' }}>−</button>
          )}
          <strong style={{ fontSize: '1.2rem' }}>{char.identity.class[0].level}</strong>
          {isOwner && !locked && (
            <button onClick={() => changeLevel(1)} style={{ padding: '0.25rem 0.75rem' }}>+</button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>Max HP</label><br />
        <input
          type="number"
          value={char.combat.hpMax}
          disabled={locked || !isOwner}
          onChange={e => updateChar({ combat: { ...char.combat, hpMax: parseInt(e.target.value) } })}
          style={{ padding: '0.5rem', width: '100px' }}
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>Armour Class</label><br />
        <input
          type="number"
          value={char.combat.ac}
          disabled={locked || !isOwner}
          onChange={e => updateChar({ combat: { ...char.combat, ac: parseInt(e.target.value) } })}
          style={{ padding: '0.5rem', width: '100px' }}
        />
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label>Speed</label><br />
        <input
          type="number"
          value={char.combat.speed}
          disabled={locked || !isOwner}
          onChange={e => updateChar({ combat: { ...char.combat, speed: parseInt(e.target.value) } })}
          style={{ padding: '0.5rem', width: '100px' }}
        />
      </div>

      {/* Death Saves — only show at 0 HP */}
      {char.combat.hpCurrent === 0 && (
        <div style={{ marginBottom: '1.5rem', background: '#2a0a0a', border: '1px solid #8b0000', borderRadius: '8px', padding: '1rem' }}>
          <strong style={{ color: '#ff4444' }}>⚠️ Death Saves</strong>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {['successes', 'failures'].map(type => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ width: '80px', textTransform: 'capitalize', fontSize: '0.9rem' }}>{type}</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[0, 1, 2].map(i => (
                    <button
                      key={i}
                      onClick={() => { if (isOwner && !locked) toggleDeathSave(type, i) }}
                      style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        background: i < char.combat.deathSaves[type]
                          ? (type === 'successes' ? '#2d6a2d' : '#8b0000')
                          : '#333',
                        border: '2px solid',
                        borderColor: i < char.combat.deathSaves[type]
                          ? (type === 'successes' ? '#4caf50' : '#ff4444')
                          : '#555',
                        cursor: isOwner && !locked ? 'pointer' : 'default'
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conditions */}
      <div style={{ marginBottom: '1rem' }}>
        <label>Conditions</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
          {char.combat.conditions.map(c => (
            <span key={c} style={{ background: '#8b0000', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {c}
              {isOwner && !locked && (
                <button onClick={() => removeCondition(c)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, fontSize: '0.8rem' }}>✕</button>
              )}
            </span>
          ))}
          {isOwner && !locked && (
            <button onClick={() => setShowConditionPicker(!showConditionPicker)} style={{ background: '#333', border: 'none', color: '#fff', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
              + Add
            </button>
          )}
        </div>

        {showConditionPicker && (
          <div style={{ marginTop: '0.5rem', background: '#12122a', border: '1px solid #444', borderRadius: '8px', padding: '0.75rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {allConditions.filter(c => !char.combat.conditions.includes(c)).map(c => (
                <button
                  key={c}
                  onClick={() => addCondition(c)}
                  style={{ background: '#333', border: 'none', color: '#fff', padding: '0.25rem 0.75rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatsTab({ char, locked, isOwner, updateChar }) {
  const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha']
  const modStr = score => {
    const mod = Math.floor((score - 10) / 2)
    return mod >= 0 ? `+${mod}` : `${mod}`
  }

  const skillList = [
    { name: 'Acrobatics', ability: 'dex' },
    { name: 'Animal Handling', ability: 'wis' },
    { name: 'Arcana', ability: 'int' },
    { name: 'Athletics', ability: 'str' },
    { name: 'Deception', ability: 'cha' },
    { name: 'History', ability: 'int' },
    { name: 'Insight', ability: 'wis' },
    { name: 'Intimidation', ability: 'cha' },
    { name: 'Investigation', ability: 'int' },
    { name: 'Medicine', ability: 'wis' },
    { name: 'Nature', ability: 'int' },
    { name: 'Perception', ability: 'wis' },
    { name: 'Performance', ability: 'cha' },
    { name: 'Persuasion', ability: 'cha' },
    { name: 'Religion', ability: 'int' },
    { name: 'Sleight of Hand', ability: 'dex' },
    { name: 'Stealth', ability: 'dex' },
    { name: 'Survival', ability: 'wis' },
  ]

  const proficiencyBonus = () => {
    const level = char.identity.class[0].level
    return Math.ceil(level / 4) + 1
  }

  const getSkillKey = (name) => name.toLowerCase().replace(/\s+/g, '')

  const cycleProf = (skillName) => {
    const key = getSkillKey(skillName)
    const current = char.stats.skills[key] || 'none'
    const next = current === 'none' ? 'proficient' : current === 'proficient' ? 'expert' : 'none'
    updateChar({
      stats: {
        ...char.stats,
        skills: { ...char.stats.skills, [key]: next }
      }
    })
  }

  const getSkillBonus = (skill) => {
    const key = getSkillKey(skill.name)
    const prof = char.stats.skills[key] || 'none'
    const abilityMod = Math.floor((char.stats.abilityScores[skill.ability] - 10) / 2)
    const pb = proficiencyBonus()
    if (prof === 'expert') return abilityMod + pb * 2
    if (prof === 'proficient') return abilityMod + pb
    return abilityMod
  }

  const profIcon = (skillName) => {
    const key = getSkillKey(skillName)
    const prof = char.stats.skills[key] || 'none'
    if (prof === 'expert') return '◈'
    if (prof === 'proficient') return '◆'
    return '◇'
  }

  return (
    <div>
      <h3>Ability Scores</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {abilities.map(ab => (
          <div key={ab} style={{ border: '1px solid #444', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{modStr(char.stats.abilityScores[ab])}</div>
            <input
              type="number"
              value={char.stats.abilityScores[ab]}
              disabled={locked || !isOwner}
              onChange={e => updateChar({
                stats: {
                  ...char.stats,
                  abilityScores: { ...char.stats.abilityScores, [ab]: parseInt(e.target.value) }
                }
              })}
              style={{ width: '60px', textAlign: 'center', padding: '0.25rem', background: 'transparent', border: '1px solid #444', color: '#fff' }}
            />
            <div style={{ fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase', marginTop: '0.25rem' }}>{ab}</div>
          </div>
        ))}
      </div>

      <h3>Skills</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {skillList.map(skill => {
          const bonus = getSkillBonus(skill)
          const bonusStr = bonus >= 0 ? `+${bonus}` : `${bonus}`
          return (
            <div key={skill.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                onClick={() => { if (isOwner && !locked) cycleProf(skill.name) }}
                style={{ background: 'none', border: 'none', cursor: isOwner && !locked ? 'pointer' : 'default', fontSize: '1rem', color: '#fff', padding: 0, width: '1.5rem', textAlign: 'center' }}
              >
                {profIcon(skill.name)}
              </button>
              <span style={{ flex: 1 }}>{skill.name}</span>
              <span style={{ color: '#aaa', fontSize: '0.85rem', textTransform: 'uppercase' }}>{skill.ability}</span>
              <span style={{ width: '2.5rem', textAlign: 'right', fontWeight: 'bold' }}>{bonusStr}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SpellsTab() {
  return (
    <div>
      <h3>Spells</h3>
      <p style={{ color: '#aaa' }}>Spell management coming soon.</p>
    </div>
  )
}

function InventoryTab() {
  return (
    <div>
      <h3>Inventory</h3>
      <p style={{ color: '#aaa' }}>Inventory management coming soon.</p>
    </div>
  )
}

function NotesTab({ char, locked, isOwner, updateChar }) {
  const fields = [
    { key: 'personalityTraits', label: 'Personality Traits' },
    { key: 'ideals', label: 'Ideals' },
    { key: 'bonds', label: 'Bonds' },
    { key: 'flaws', label: 'Flaws' },
    { key: 'appearance', label: 'Appearance' },
    { key: 'backstory', label: 'Backstory' },
    { key: 'alliesAndOrganisations', label: 'Allies & Organisations' },
    { key: 'general', label: 'General Notes' },
  ]

  return (
    <div>
      {fields.map(field => (
        <div key={field.key} style={{ marginBottom: '1rem' }}>
          <label>{field.label}</label><br />
          <textarea
            value={char.notes[field.key]}
            disabled={locked || !isOwner}
            onChange={e => updateChar({ notes: { ...char.notes, [field.key]: e.target.value } })}
            style={{ width: '100%', minHeight: '80px', padding: '0.5rem', background: '#12122a', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}
          />
        </div>
      ))}
    </div>
  )
}
function XPPopup({ char, onClose, onUpdate }) {
  const [amount, setAmount] = useState('')
  const [milestoneMode, setMilestoneMode] = useState(char.settings?.milestoneMode || false)

  const xpThresholds = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000]

  const currentLevel = char.identity.class[0].level
  const currentXP = char.identity.xp
  const nextThreshold = xpThresholds[currentLevel] || null
  const xpToNext = nextThreshold ? nextThreshold - currentXP : null

  const applyXP = () => {
    const delta = parseInt(amount)
    if (isNaN(delta)) return

    const newXP = Math.max(0, currentXP + delta)
    let newLevel = currentLevel

    if (!milestoneMode) {
      for (let i = xpThresholds.length - 1; i >= 0; i--) {
        if (newXP >= xpThresholds[i]) {
          newLevel = Math.min(20, i + 1)
          break
        }
      }
    }

    onUpdate({
      identity: {
        ...char.identity,
        xp: newXP,
        class: [{ ...char.identity.class[0], level: newLevel }]
      },
      settings: { ...char.settings, milestoneMode }
    })

    setAmount('')
  }

  const currentThreshold = xpThresholds[currentLevel - 1]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#1a1a2e', padding: '1.5rem', borderRadius: '8px', width: '300px' }}>
        <h3 style={{ margin: '0 0 1rem' }}>Experience Points</h3>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#aaa', marginBottom: '0.25rem' }}>
            <span>Current XP</span>
            <strong style={{ color: '#fff' }}>{currentXP.toLocaleString()}</strong>
          </div>
          {!milestoneMode && nextThreshold && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#aaa', marginBottom: '0.5rem' }}>
                <span>To level {currentLevel + 1}</span>
                <strong style={{ color: '#fff' }}>{xpToNext.toLocaleString()} XP</strong>
              </div>
              <div style={{ background: '#333', borderRadius: '4px', height: '6px', marginBottom: '1rem' }}>
                <div style={{
                  background: '#4caf50',
                  height: '100%',
                  borderRadius: '4px',
                  width: `${Math.min(100, ((currentXP - currentThreshold) / (nextThreshold - currentThreshold)) * 100)}%`
                }} />
              </div>
            </>
          )}
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.9rem' }}>Levelling Method</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button
              onClick={() => setMilestoneMode(false)}
              style={{ flex: 1, padding: '0.5rem', background: !milestoneMode ? '#4caf50' : '#333', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}
            >
              XP
            </button>
            <button
              onClick={() => setMilestoneMode(true)}
              style={{ flex: 1, padding: '0.5rem', background: milestoneMode ? '#4caf50' : '#333', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}
            >
              Milestone
            </button>
          </div>
        </div>

        {!milestoneMode && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.9rem' }}>Add XP (use negative to subtract)</label><br />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="e.g. 250 or -100"
                style={{ flex: 1, padding: '0.5rem', background: '#12122a', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}
              />
              <button onClick={applyXP} style={{ padding: '0.5rem 1rem', background: '#4caf50', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>
                Apply
              </button>
            </div>
          </div>
        )}

        <button onClick={onClose} style={{ width: '100%', padding: '0.5rem', background: '#333', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>
          Close
        </button>
      </div>
    </div>
  )
}

export default CharacterSheet
import { useState, useRef, useEffect, useMemo } from 'react'
import { Octokit } from '@octokit/rest'
import { getSpells, getEquipment, getMagicItems } from './srdContent'

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

        <button
          onClick={() => setShowXPPopup(true)}
          style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '0.85rem', cursor: 'pointer', padding: 0, marginBottom: '0.5rem', textAlign: 'left' }}
        >
          XP {char.identity.xp} ✏️
        </button>

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

        {char.combat.conditions.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {char.combat.conditions.map(c => (
              <span key={c} style={{ background: '#8b0000', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>{c}</span>
            ))}
          </div>
        )}
      </div>

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

      <div style={{ padding: '1rem' }}>
        {activeTab === 'combat' && <CombatTab char={char} locked={locked} isOwner={isOwner} updateChar={updateChar} />}
        {activeTab === 'stats' && <StatsTab char={char} locked={locked} isOwner={isOwner} updateChar={updateChar} />}
        {activeTab === 'spells' && <SpellsTab char={char} locked={locked} isOwner={isOwner} updateChar={updateChar} />}
        {activeTab === 'inventory' && <InventoryTab char={char} locked={locked} isOwner={isOwner} updateChar={updateChar} />}
        {activeTab === 'notes' && <NotesTab char={char} locked={locked} isOwner={isOwner} updateChar={updateChar} />}
      </div>

      {showXPPopup && (
        <XPPopup
          char={char}
          onClose={() => setShowXPPopup(false)}
          onUpdate={(updates) => { updateChar(updates); setShowXPPopup(false) }}
        />
      )}
    </div>
  )
}

function CombatTab({ char, locked, isOwner, updateChar }) {
  const [showConditionPicker, setShowConditionPicker] = useState(false)

  const allConditions = [
    'Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened',
    'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified',
    'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious',
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
    const newLevel = Math.max(1, Math.min(20, char.identity.class[0].level + delta))
    updateChar({ identity: { ...char.identity, class: [{ ...char.identity.class[0], level: newLevel }] } })
  }

  return (
    <div>
      <h3>Combat</h3>

      <div style={{ marginBottom: '1rem' }}>
        <label>Level</label><br />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
          {isOwner && !locked && <button onClick={() => changeLevel(-1)} style={{ padding: '0.25rem 0.75rem' }}>−</button>}
          <strong style={{ fontSize: '1.2rem' }}>{char.identity.class[0].level}</strong>
          {isOwner && !locked && <button onClick={() => changeLevel(1)} style={{ padding: '0.25rem 0.75rem' }}>+</button>}
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>Max HP</label><br />
        <input type="number" value={char.combat.hpMax} disabled={locked || !isOwner}
          onChange={e => updateChar({ combat: { ...char.combat, hpMax: parseInt(e.target.value) } })}
          style={{ padding: '0.5rem', width: '100px' }} />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>Armour Class</label><br />
        <input type="number" value={char.combat.ac} disabled={locked || !isOwner}
          onChange={e => updateChar({ combat: { ...char.combat, ac: parseInt(e.target.value) } })}
          style={{ padding: '0.5rem', width: '100px' }} />
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label>Speed</label><br />
        <input type="number" value={char.combat.speed} disabled={locked || !isOwner}
          onChange={e => updateChar({ combat: { ...char.combat, speed: parseInt(e.target.value) } })}
          style={{ padding: '0.5rem', width: '100px' }} />
      </div>

      {char.combat.hpCurrent === 0 && (
        <div style={{ marginBottom: '1.5rem', background: '#2a0a0a', border: '1px solid #8b0000', borderRadius: '8px', padding: '1rem' }}>
          <strong style={{ color: '#ff4444' }}>⚠️ Death Saves</strong>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {['successes', 'failures'].map(type => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ width: '80px', textTransform: 'capitalize', fontSize: '0.9rem' }}>{type}</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[0, 1, 2].map(i => (
                    <button key={i}
                      onClick={() => { if (isOwner && !locked) toggleDeathSave(type, i) }}
                      style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        background: i < char.combat.deathSaves[type] ? (type === 'successes' ? '#2d6a2d' : '#8b0000') : '#333',
                        border: '2px solid',
                        borderColor: i < char.combat.deathSaves[type] ? (type === 'successes' ? '#4caf50' : '#ff4444') : '#555',
                        cursor: isOwner && !locked ? 'pointer' : 'default',
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
            <button onClick={() => setShowConditionPicker(!showConditionPicker)}
              style={{ background: '#333', border: 'none', color: '#fff', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
              + Add
            </button>
          )}
        </div>
        {showConditionPicker && (
          <div style={{ marginTop: '0.5rem', background: '#12122a', border: '1px solid #444', borderRadius: '8px', padding: '0.75rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {allConditions.filter(c => !char.combat.conditions.includes(c)).map(c => (
                <button key={c} onClick={() => addCondition(c)}
                  style={{ background: '#333', border: 'none', color: '#fff', padding: '0.25rem 0.75rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
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
  const modStr = score => { const m = Math.floor((score - 10) / 2); return m >= 0 ? `+${m}` : `${m}` }

  const skillList = [
    { name: 'Acrobatics', ability: 'dex' }, { name: 'Animal Handling', ability: 'wis' },
    { name: 'Arcana', ability: 'int' }, { name: 'Athletics', ability: 'str' },
    { name: 'Deception', ability: 'cha' }, { name: 'History', ability: 'int' },
    { name: 'Insight', ability: 'wis' }, { name: 'Intimidation', ability: 'cha' },
    { name: 'Investigation', ability: 'int' }, { name: 'Medicine', ability: 'wis' },
    { name: 'Nature', ability: 'int' }, { name: 'Perception', ability: 'wis' },
    { name: 'Performance', ability: 'cha' }, { name: 'Persuasion', ability: 'cha' },
    { name: 'Religion', ability: 'int' }, { name: 'Sleight of Hand', ability: 'dex' },
    { name: 'Stealth', ability: 'dex' }, { name: 'Survival', ability: 'wis' },
  ]

  const pb = Math.ceil(char.identity.class[0].level / 4) + 1
  const key = name => name.toLowerCase().replace(/\s+/g, '')

  const cycleProf = (skillName) => {
    const k = key(skillName)
    const cur = char.stats.skills[k] || 'none'
    const next = cur === 'none' ? 'proficient' : cur === 'proficient' ? 'expert' : 'none'
    updateChar({ stats: { ...char.stats, skills: { ...char.stats.skills, [k]: next } } })
  }

  const skillBonus = (skill) => {
    const prof = char.stats.skills[key(skill.name)] || 'none'
    const base = Math.floor((char.stats.abilityScores[skill.ability] - 10) / 2)
    return base + (prof === 'expert' ? pb * 2 : prof === 'proficient' ? pb : 0)
  }

  const profIcon = (skillName) => {
    const p = char.stats.skills[key(skillName)] || 'none'
    return p === 'expert' ? '◈' : p === 'proficient' ? '◆' : '◇'
  }

  return (
    <div>
      <h3>Ability Scores</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {abilities.map(ab => (
          <div key={ab} style={{ border: '1px solid #444', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{modStr(char.stats.abilityScores[ab])}</div>
            <input type="number" value={char.stats.abilityScores[ab]} disabled={locked || !isOwner}
              onChange={e => updateChar({ stats: { ...char.stats, abilityScores: { ...char.stats.abilityScores, [ab]: parseInt(e.target.value) } } })}
              style={{ width: '60px', textAlign: 'center', padding: '0.25rem', background: 'transparent', border: '1px solid #444', color: '#fff' }} />
            <div style={{ fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase', marginTop: '0.25rem' }}>{ab}</div>
          </div>
        ))}
      </div>

      <h3>Skills</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {skillList.map(skill => {
          const bonus = skillBonus(skill)
          return (
            <div key={skill.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button onClick={() => { if (isOwner && !locked) cycleProf(skill.name) }}
                style={{ background: 'none', border: 'none', cursor: isOwner && !locked ? 'pointer' : 'default', fontSize: '1rem', color: '#fff', padding: 0, width: '1.5rem', textAlign: 'center' }}>
                {profIcon(skill.name)}
              </button>
              <span style={{ flex: 1 }}>{skill.name}</span>
              <span style={{ color: '#aaa', fontSize: '0.85rem', textTransform: 'uppercase' }}>{skill.ability}</span>
              <span style={{ width: '2.5rem', textAlign: 'right', fontWeight: 'bold' }}>{bonus >= 0 ? `+${bonus}` : bonus}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SpellsTab({ char, locked, isOwner, updateChar }) {
  const [showAll, setShowAll] = useState(false)
  const [expandedSpell, setExpandedSpell] = useState(null)
  const [showAddSpell, setShowAddSpell] = useState(false)
  const [showEditSlots, setShowEditSlots] = useState(false)
  const [srdSpells, setSrdSpells] = useState(null)
  const [spellSearch, setSpellSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const slots = char.spells?.slots || {}
  const known = char.spells?.known || []
  const prepared = char.spells?.prepared || []
  const concentration = char.spells?.concentration || null
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']

  useEffect(() => {
    setLoading(true)
    getSpells()
      .then(data => { setSrdSpells(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const spellMap = useMemo(() => {
    if (!srdSpells) return {}
    return Object.fromEntries(srdSpells.map(s => [s.index, s]))
  }, [srdSpells])

  const spellsByLevel = useMemo(() => {
    const groups = {}
    for (const index of known) {
      const spell = spellMap[index]
      const level = spell?.level ?? -1
      if (!groups[level]) groups[level] = []
      groups[level].push({ index, spell })
    }
    return groups
  }, [known, spellMap])

  const filteredSrdSpells = !srdSpells || !spellSearch ? [] :
    srdSpells
      .filter(s => s.name.toLowerCase().includes(spellSearch.toLowerCase()) && !known.includes(s.index))
      .slice(0, 20)

  const togglePrepared = (index) => {
    const newPrepared = prepared.includes(index)
      ? prepared.filter(s => s !== index)
      : [...prepared, index]
    updateChar({ spells: { ...char.spells, prepared: newPrepared } })
  }

  const removeSpell = (index) => {
    updateChar({
      spells: {
        ...char.spells,
        known: known.filter(s => s !== index),
        prepared: prepared.filter(s => s !== index),
        concentration: concentration === index ? null : concentration,
      }
    })
  }

  const addSpell = (spellIndex) => {
    if (!known.includes(spellIndex)) {
      updateChar({ spells: { ...char.spells, known: [...known, spellIndex] } })
    }
    setSpellSearch('')
  }

  const toggleSlotUsed = (level, pipIndex) => {
    const current = slots[level] || { max: 0, used: 0 }
    const newUsed = pipIndex < current.used ? pipIndex : pipIndex + 1
    updateChar({
      spells: {
        ...char.spells,
        slots: { ...slots, [level]: { ...current, used: Math.max(0, Math.min(newUsed, current.max)) } },
      }
    })
  }

  const activeSlotLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(l => (slots[l]?.max || 0) > 0)

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>Spell Slots</h3>
          {isOwner && !locked && (
            <button onClick={() => setShowEditSlots(!showEditSlots)}
              style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '0.85rem' }}>
              ⚙️ Edit
            </button>
          )}
        </div>

        {showEditSlots && isOwner && !locked && (
          <div style={{ background: '#12122a', border: '1px solid #444', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => (
                <div key={level} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.8rem', color: '#aaa', width: '36px' }}>{ROMAN[level - 1]}</span>
                  <input type="number" min={0} max={9} value={slots[level]?.max || 0}
                    onChange={e => {
                      const max = Math.max(0, Math.min(9, parseInt(e.target.value) || 0))
                      updateChar({ spells: { ...char.spells, slots: { ...slots, [level]: { max, used: Math.min(slots[level]?.used || 0, max) } } } })
                    }}
                    style={{ width: '44px', padding: '0.25rem', background: '#1a1a2e', border: '1px solid #444', color: '#fff', borderRadius: '4px', textAlign: 'center' }} />
                </div>
              ))}
            </div>
            <button onClick={() => setShowEditSlots(false)}
              style={{ marginTop: '0.5rem', background: '#333', border: 'none', color: '#fff', padding: '0.25rem 0.75rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
              Done
            </button>
          </div>
        )}

        {activeSlotLevels.length === 0 ? (
          <p style={{ color: '#666', fontSize: '0.9rem', margin: 0 }}>
            No spell slots configured.{isOwner && !locked ? ' Tap ⚙️ Edit to set up slots.' : ''}
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {activeSlotLevels.map(level => {
              const slot = slots[level] || { max: 0, used: 0 }
              return (
                <div key={level} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ fontSize: '0.8rem', color: '#aaa', minWidth: '20px' }}>{ROMAN[level - 1]}</span>
                  {Array.from({ length: slot.max }).map((_, i) => (
                    <button key={i}
                      onClick={() => { if (isOwner && !locked) toggleSlotUsed(level, i) }}
                      title={i < slot.used ? 'Expended' : 'Available'}
                      style={{
                        width: '13px', height: '13px', borderRadius: '50%',
                        background: i < slot.used ? '#333' : '#7c6af7',
                        border: `1px solid ${i < slot.used ? '#555' : '#7c6af7'}`,
                        cursor: isOwner && !locked ? 'pointer' : 'default',
                        padding: 0,
                      }}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>Spells</h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button onClick={() => setShowAll(!showAll)} title={showAll ? 'Show prepared only' : 'Show all known'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', opacity: showAll ? 1 : 0.4 }}>
              👁️
            </button>
            {isOwner && !locked && (
              <button onClick={() => setShowAddSpell(!showAddSpell)}
                style={{ background: '#333', border: 'none', color: '#fff', padding: '0.25rem 0.75rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                + Add
              </button>
            )}
          </div>
        </div>

        {showAddSpell && isOwner && !locked && (
          <div style={{ marginBottom: '1rem' }}>
            <input autoFocus value={spellSearch} onChange={e => setSpellSearch(e.target.value)}
              placeholder={loading ? 'Loading spells...' : 'Search spells...'}
              disabled={loading}
              style={{ width: '100%', padding: '0.5rem', background: '#12122a', border: '1px solid #444', color: '#fff', borderRadius: '4px', marginBottom: '0.25rem', boxSizing: 'border-box' }} />
            {filteredSrdSpells.length > 0 && (
              <div style={{ background: '#12122a', border: '1px solid #444', borderRadius: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                {filteredSrdSpells.map(spell => (
                  <div key={spell.index} onClick={() => addSpell(spell.index)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', borderBottom: '1px solid #2a2a4a', cursor: 'pointer' }}>
                    <span>{spell.name}</span>
                    <span style={{ fontSize: '0.8rem', color: '#aaa' }}>
                      {spell.level === 0 ? 'Cantrip' : `Lvl ${spell.level}`}
                      {spell.concentration ? ' · C' : ''}{spell.ritual ? ' · R' : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {loading && known.length > 0 && <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Loading spell data...</p>}

        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => {
          const spellsAtLevel = spellsByLevel[level] || []
          const visible = showAll
            ? spellsAtLevel
            : spellsAtLevel.filter(s => level === 0 || prepared.includes(s.index))
          if (visible.length === 0) return null

          return (
            <div key={level} style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#7c6af7', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>
                {level === 0 ? 'Cantrips' : `Level ${level}`}
              </div>
              {visible.map(({ index, spell }) => {
                const isPrepared = level === 0 || prepared.includes(index)
                const isConc = concentration === index
                const isExpanded = expandedSpell === index

                return (
                  <div key={index} style={{
                    marginBottom: '0.25rem',
                    background: isExpanded ? '#12122a' : 'transparent',
                    borderRadius: '6px',
                    border: isExpanded ? '1px solid #333' : '1px solid transparent',
                    padding: isExpanded ? '0.5rem' : '0.15rem 0.5rem',
                  }}>
                    <div onClick={() => setExpandedSpell(isExpanded ? null : index)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      {level > 0 && isOwner && !locked && (
                        <button onClick={e => { e.stopPropagation(); togglePrepared(index) }}
                          title={isPrepared ? 'Unprepare' : 'Prepare'}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: isPrepared ? '#7c6af7' : '#444', padding: 0, flexShrink: 0 }}>
                          {isPrepared ? '◆' : '◇'}
                        </button>
                      )}
                      <span style={{ flex: 1, color: !isPrepared && !showAll ? '#555' : '#fff' }}>
                        {spell ? spell.name : index}
                      </span>
                      {isConc && <span style={{ color: '#7c6af7', fontSize: '0.85rem' }}>🔵</span>}
                      {spell?.ritual && <span style={{ fontSize: '0.7rem', color: '#aaa' }}>R</span>}
                      {spell?.concentration && !isConc && <span style={{ fontSize: '0.7rem', color: '#aaa' }}>C</span>}
                    </div>

                    {isExpanded && spell && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#ccc', borderTop: '1px solid #2a2a4a', paddingTop: '0.5rem' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.4rem', fontSize: '0.8rem' }}>
                          <span><span style={{ color: '#aaa' }}>Cast:</span> {spell.casting_time}</span>
                          <span><span style={{ color: '#aaa' }}>Range:</span> {spell.range}</span>
                          <span><span style={{ color: '#aaa' }}>Duration:</span> {spell.duration}</span>
                        </div>
                        <div style={{ marginBottom: '0.4rem', fontSize: '0.8rem' }}>
                          <span style={{ color: '#aaa' }}>Components:</span> {spell.components?.join(', ')}
                          {spell.material && <span style={{ color: '#666' }}> ({spell.material})</span>}
                        </div>
                        {spell.desc?.map((d, i) => <p key={i} style={{ margin: '0 0 0.25rem', fontSize: '0.83rem' }}>{d}</p>)}
                        {isOwner && !locked && (
                          <button onClick={e => { e.stopPropagation(); removeSpell(index) }}
                            style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '0.8rem', marginTop: '0.25rem', padding: 0 }}>
                            Remove
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

        {known.length === 0 && !loading && (
          <p style={{ color: '#666', fontSize: '0.9rem' }}>
            No spells known.{isOwner && !locked ? ' Tap + Add to search and add spells.' : ''}
          </p>
        )}
      </div>
    </div>
  )
}

function InventoryTab({ char, locked, isOwner, updateChar }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [srdItems, setSrdItems] = useState(null)
  const [loading, setLoading] = useState(false)
  const [expandedItem, setExpandedItem] = useState(null)

  const inventory = char.inventory || []
  const encumbranceTracking = char.settings?.encumbranceTracking || false
  const carryCapacity = (char.stats?.abilityScores?.str || 10) * 15
  const totalWeight = inventory.reduce((sum, item) => sum + (item.weight || 0) * (item.quantity || 1), 0)

  const loadItems = async () => {
    if (srdItems) return
    setLoading(true)
    try {
      const [equip, magic] = await Promise.all([getEquipment(), getMagicItems()])
      setSrdItems([...equip, ...magic])
    } catch {
      setSrdItems([])
    }
    setLoading(false)
  }

  const filteredItems = !srdItems || !searchQuery ? [] :
    srdItems
      .filter(i => {
        const existing = new Set(inventory.map(x => x.itemId))
        return i.name.toLowerCase().includes(searchQuery.toLowerCase()) && !existing.has(i.index)
      })
      .slice(0, 20)

  const addSrdItem = (srdItem) => {
    const isWeapon = srdItem.equipment_category?.index === 'weapon'
    const isMagic = srdItem.rarity?.name !== undefined
    updateChar({
      inventory: [...inventory, {
        itemId: srdItem.index,
        name: srdItem.name,
        quantity: 1,
        equipped: false,
        attuned: false,
        custom: false,
        weight: srdItem.weight || 0,
        enhancement: 0,
        damage: isWeapon && srdItem.damage ? {
          dice: srdItem.damage.damage_dice,
          type: srdItem.damage.damage_type?.name || '',
          versatile: srdItem.two_handed_damage?.damage_dice || null,
        } : null,
        throwRange: srdItem.throw_range ? `${srdItem.throw_range.normal}/${srdItem.throw_range.long}ft` : null,
        effects: [],
        properties: (srdItem.properties || []).map(p => p.index || p),
        description: Array.isArray(srdItem.desc) ? srdItem.desc.join(' ') : (srdItem.desc || ''),
        type: isMagic ? 'magic' : (srdItem.equipment_category?.index || 'gear'),
        requiresAttunement: srdItem.requires_attunement === 'requires attunement',
      }]
    })
    setSearchQuery('')
  }

  const updateItem = (itemId, updates) =>
    updateChar({ inventory: inventory.map(item => item.itemId === itemId ? { ...item, ...updates } : item) })

  const removeItem = (itemId) =>
    updateChar({ inventory: inventory.filter(item => item.itemId !== itemId) })

  return (
    <div>
      {encumbranceTracking && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem', color: '#aaa' }}>
            <span>Carrying</span>
            <span style={{ color: totalWeight > carryCapacity ? '#f44336' : '#fff' }}>{totalWeight} / {carryCapacity} lbs</span>
          </div>
          <div style={{ background: '#333', borderRadius: '4px', height: '6px' }}>
            <div style={{ background: totalWeight > carryCapacity ? '#f44336' : '#7c6af7', height: '100%', borderRadius: '4px', width: `${Math.min(100, (totalWeight / carryCapacity) * 100)}%`, transition: 'width 0.2s' }} />
          </div>
        </div>
      )}

      {inventory.length === 0 ? (
        <p style={{ color: '#666', fontSize: '0.9rem' }}>No items.{isOwner && !locked ? ' Search below to add from the SRD.' : ''}</p>
      ) : (
        <div style={{ marginBottom: '1rem' }}>
          {inventory.map(item => {
            const isExpanded = expandedItem === item.itemId
            return (
              <div key={item.itemId} style={{ borderBottom: '1px solid #2a2a4a' }}>
                <div onClick={() => setExpandedItem(isExpanded ? null : item.itemId)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0', cursor: 'pointer' }}>
                  {item.damage && (
                    <button
                      onClick={e => { e.stopPropagation(); if (isOwner && !locked) updateItem(item.itemId, { equipped: !item.equipped }) }}
                      title={item.equipped ? 'Equipped' : 'Unequipped'}
                      style={{ background: 'none', border: 'none', cursor: isOwner && !locked ? 'pointer' : 'default', fontSize: '0.9rem', padding: 0, opacity: item.equipped ? 1 : 0.3, flexShrink: 0 }}>
                      ⚔️
                    </button>
                  )}
                  <span style={{ flex: 1 }}>{item.name}{item.enhancement > 0 ? ` +${item.enhancement}` : ''}</span>
                  {isOwner && !locked ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => updateItem(item.itemId, { quantity: Math.max(0, item.quantity - 1) })}
                        style={{ background: '#2a2a4a', border: 'none', color: '#fff', width: '22px', height: '22px', borderRadius: '3px', cursor: 'pointer', padding: 0 }}>−</button>
                      <span style={{ minWidth: '22px', textAlign: 'center', fontSize: '0.9rem' }}>×{item.quantity}</span>
                      <button onClick={() => updateItem(item.itemId, { quantity: item.quantity + 1 })}
                        style={{ background: '#2a2a4a', border: 'none', color: '#fff', width: '22px', height: '22px', borderRadius: '3px', cursor: 'pointer', padding: 0 }}>+</button>
                    </div>
                  ) : (
                    <span style={{ color: '#aaa', fontSize: '0.85rem' }}>×{item.quantity}</span>
                  )}
                  {item.weight > 0 && <span style={{ color: '#555', fontSize: '0.78rem' }}>{item.weight}lb</span>}
                </div>

                {isExpanded && (
                  <div style={{ padding: '0 0 0.75rem 0.25rem', fontSize: '0.85rem', color: '#ccc' }}>
                    {item.damage && (
                      <div style={{ marginBottom: '0.25rem' }}>
                        <span style={{ color: '#aaa' }}>Damage:</span> {item.damage.dice} {item.damage.type}
                        {item.damage.versatile && <span style={{ color: '#aaa' }}> · Versatile {item.damage.versatile}</span>}
                        {item.throwRange && <span style={{ color: '#aaa' }}> · Thrown {item.throwRange}</span>}
                      </div>
                    )}
                    {item.properties?.length > 0 && (
                      <div style={{ marginBottom: '0.25rem' }}>
                        <span style={{ color: '#aaa' }}>Properties:</span> {item.properties.join(', ')}
                      </div>
                    )}
                    {item.description && (
                      <p style={{ margin: '0 0 0.25rem', color: '#888', fontSize: '0.82rem' }}>
                        {item.description.length > 200 ? item.description.slice(0, 200) + '…' : item.description}
                      </p>
                    )}
                    {item.requiresAttunement && <div style={{ color: '#f4a261', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Requires attunement</div>}
                    {isOwner && !locked && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                        {item.damage && (
                          <button onClick={() => updateItem(item.itemId, { equipped: !item.equipped })}
                            style={{ background: item.equipped ? '#3a2a6e' : '#2a2a4a', border: 'none', color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>
                            {item.equipped ? '⚔️ Unequip' : '⚔️ Equip'}
                          </button>
                        )}
                        <button onClick={() => removeItem(item.itemId)}
                          style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}>
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {isOwner && !locked && (
        <div>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onFocus={loadItems}
            placeholder={loading ? '⏳ Loading items...' : '🔍 Search items to add...'}
            disabled={loading && !srdItems}
            style={{ width: '100%', padding: '0.5rem', background: '#12122a', border: '1px solid #444', color: '#fff', borderRadius: '4px', boxSizing: 'border-box' }} />
          {filteredItems.length > 0 && (
            <div style={{ background: '#12122a', border: '1px solid #444', borderRadius: '4px', marginTop: '0.25rem', maxHeight: '200px', overflowY: 'auto' }}>
              {filteredItems.map(item => (
                <div key={item.index} onClick={() => addSrdItem(item)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', borderBottom: '1px solid #2a2a4a', cursor: 'pointer' }}>
                  <div>
                    <span>{item.name}</span>
                    <span style={{ fontSize: '0.78rem', color: '#aaa', marginLeft: '0.5rem' }}>{item.rarity?.name || item.equipment_category?.name || ''}</span>
                  </div>
                  {item.damage && <span style={{ fontSize: '0.78rem', color: '#888' }}>{item.damage.damage_dice} {item.damage.damage_type?.name}</span>}
                </div>
              ))}
            </div>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.83rem', color: '#555', cursor: 'pointer', marginTop: '0.75rem' }}>
            <input type="checkbox" checked={encumbranceTracking}
              onChange={e => updateChar({ settings: { ...char.settings, encumbranceTracking: e.target.checked } })} />
            Track carrying weight
          </label>
        </div>
      )}
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
          <textarea value={char.notes[field.key]} disabled={locked || !isOwner}
            onChange={e => updateChar({ notes: { ...char.notes, [field.key]: e.target.value } })}
            style={{ width: '100%', minHeight: '80px', padding: '0.5rem', background: '#12122a', border: '1px solid #444', color: '#fff', borderRadius: '4px' }} />
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
  const currentThreshold = xpThresholds[currentLevel - 1]

  const applyXP = () => {
    const delta = parseInt(amount)
    if (isNaN(delta)) return
    const newXP = Math.max(0, currentXP + delta)
    let newLevel = currentLevel
    if (!milestoneMode) {
      for (let i = xpThresholds.length - 1; i >= 0; i--) {
        if (newXP >= xpThresholds[i]) { newLevel = Math.min(20, i + 1); break }
      }
    }
    onUpdate({ identity: { ...char.identity, xp: newXP, class: [{ ...char.identity.class[0], level: newLevel }] }, settings: { ...char.settings, milestoneMode } })
    setAmount('')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#1a1a2e', padding: '1.5rem', borderRadius: '8px', width: '300px' }}>
        <h3 style={{ margin: '0 0 1rem' }}>Experience Points</h3>
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#aaa', marginBottom: '0.25rem' }}>
            <span>Current XP</span><strong style={{ color: '#fff' }}>{currentXP.toLocaleString()}</strong>
          </div>
          {!milestoneMode && nextThreshold && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#aaa', marginBottom: '0.5rem' }}>
                <span>To level {currentLevel + 1}</span><strong style={{ color: '#fff' }}>{xpToNext.toLocaleString()} XP</strong>
              </div>
              <div style={{ background: '#333', borderRadius: '4px', height: '6px', marginBottom: '1rem' }}>
                <div style={{ background: '#4caf50', height: '100%', borderRadius: '4px', width: `${Math.min(100, ((currentXP - currentThreshold) / (nextThreshold - currentThreshold)) * 100)}%` }} />
              </div>
            </>
          )}
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.9rem' }}>Levelling Method</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button onClick={() => setMilestoneMode(false)}
              style={{ flex: 1, padding: '0.5rem', background: !milestoneMode ? '#4caf50' : '#333', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>XP</button>
            <button onClick={() => setMilestoneMode(true)}
              style={{ flex: 1, padding: '0.5rem', background: milestoneMode ? '#4caf50' : '#333', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Milestone</button>
          </div>
        </div>
        {!milestoneMode && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.9rem' }}>Add XP (use negative to subtract)</label><br />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 250 or -100"
                style={{ flex: 1, padding: '0.5rem', background: '#12122a', border: '1px solid #444', color: '#fff', borderRadius: '4px' }} />
              <button onClick={applyXP} style={{ padding: '0.5rem 1rem', background: '#4caf50', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Apply</button>
            </div>
          </div>
        )}
        <button onClick={onClose} style={{ width: '100%', padding: '0.5rem', background: '#333', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Close</button>
      </div>
    </div>
  )
}

export default CharacterSheet
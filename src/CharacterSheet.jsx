import { useState } from 'react'

function CharacterSheet({ character, token, user, onBack, onUpdate }) {
  const [activeTab, setActiveTab] = useState('combat')
  const [char, setChar] = useState(character)
  const [locked, setLocked] = useState(false)

  const isOwner = char.meta.owner === `github:${user.login}`

  const updateChar = (updates) => {
    const updated = { ...char, ...updates }
    setChar(updated)
    onUpdate(updated)
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
        </div>

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
        {activeTab === 'spells' && <SpellsTab char={char} locked={locked} isOwner={isOwner} updateChar={updateChar} />}
        {activeTab === 'inventory' && <InventoryTab char={char} locked={locked} isOwner={isOwner} updateChar={updateChar} />}
        {activeTab === 'notes' && <NotesTab char={char} locked={locked} isOwner={isOwner} updateChar={updateChar} />}
      </div>
    </div>
  )
}

function CombatTab({ char, locked, isOwner, updateChar }) {
  return (
    <div>
      <h3>Combat</h3>
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
      <div style={{ marginBottom: '1rem' }}>
        <label>Speed</label><br />
        <input
          type="number"
          value={char.combat.speed}
          disabled={locked || !isOwner}
          onChange={e => updateChar({ combat: { ...char.combat, speed: parseInt(e.target.value) } })}
          style={{ padding: '0.5rem', width: '100px' }}
        />
      </div>
    </div>
  )
}

function StatsTab({ char, locked, isOwner, updateChar }) {
  const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha']
  const modifier = score => Math.floor((score - 10) / 2)
  const modStr = score => {
    const mod = modifier(score)
    return mod >= 0 ? `+${mod}` : `${mod}`
  }

  return (
    <div>
      <h3>Ability Scores</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
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
    </div>
  )
}

function SpellsTab({ char }) {
  return (
    <div>
      <h3>Spells</h3>
      <p style={{ color: '#aaa' }}>Spell management coming soon.</p>
    </div>
  )
}

function InventoryTab({ char }) {
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

export default CharacterSheet
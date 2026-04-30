import './CharSwitcher.css'

export default function CharSwitcher({ characters, activeCharId, onSwitch, onNew }) {
  return (
    <div className="char-switcher">
      {characters.map(c => {
        const level = c.identity.class?.[0]?.level ?? 1
        const active = c.meta.characterId === activeCharId
        return (
          <button
            key={c.meta.characterId}
            className={`cs-tab ${active ? 'cs-tab--active' : ''}`}
            onClick={() => onSwitch(c.meta.characterId)}
          >
            {c.identity.name} <span className="cs-level">{level}</span>
          </button>
        )
      })}
      <button className="cs-tab cs-tab--add" onClick={onNew}>
        + New
      </button>
    </div>
  )
}

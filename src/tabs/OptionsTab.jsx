import '../TabShared.css'
import './OptionsTab.css'

const DEFAULT_RULES = {
  encumbranceMode: 'disabled',
  attunementLimit: 3,
  spellComponents: 'all',
  concentrationMode: 'raw',
  cantripScaling: 'character',
  hitDiceRecovery: 'all',
  longRestHpRecovery: 'full',
  longRestDuration: '8h',
  shortRestDuration: '1h',
  shortRestsPerLongRest: 2,
  levellingSystem: 'xp',
  multiclassing: 'enabled',
}

function currentRules(char) {
  const settings = char.settings ?? {}
  const levellingSystem = settings.levellingSystem ?? (settings.milestoneMode ? 'milestone' : 'xp')
  const encumbranceMode = settings.encumbranceMode ?? (settings.encumbranceTracking ? 'variant' : 'disabled')
  return {
    ...DEFAULT_RULES,
    ...settings,
    levellingSystem,
    encumbranceMode,
    attunementLimit: settings.attunementLimit ?? DEFAULT_RULES.attunementLimit,
    shortRestsPerLongRest: settings.shortRestsPerLongRest ?? DEFAULT_RULES.shortRestsPerLongRest,
  }
}

function RuleGroup({ title, children }) {
  return (
    <section className="opt-group">
      <div className="opt-group-title">{title}</div>
      <div className="opt-stack">{children}</div>
    </section>
  )
}

function ChoiceRule({ label, value, options, onChange, disabled, note }) {
  return (
    <div className="opt-rule">
      <div className="opt-rule-head">
        <div className="opt-rule-label">{label}</div>
        {note && <div className="opt-rule-note">{note}</div>}
      </div>
      <div className="opt-choice-row">
        {options.map(option => (
          <button
            key={option.value}
            className={`opt-choice${value === option.value ? ' opt-choice--active' : ''}`}
            onClick={() => onChange(option.value)}
            disabled={disabled}
          >
            <span>{option.label}</span>
            {option.sub && <small>{option.sub}</small>}
          </button>
        ))}
      </div>
    </div>
  )
}

function NumberRule({ label, value, min = 0, onChange, disabled, note }) {
  return (
    <div className="opt-rule opt-rule--number">
      <div className="opt-rule-head">
        <div className="opt-rule-label">{label}</div>
        {note && <div className="opt-rule-note">{note}</div>}
      </div>
      <input
        className="opt-number"
        type="number"
        min={min}
        value={value}
        disabled={disabled}
        onChange={e => onChange(Math.max(min, Math.floor(Number(e.target.value) || min)))}
      />
    </div>
  )
}

export default function OptionsTab({ char, locked, isOwner, updateChar }) {
  const rules = currentRules(char)
  const disabled = locked || !isOwner

  function patchSettings(patch) {
    const next = { ...char.settings, ...patch }
    updateChar({ settings: next })
  }

  function setEncumbranceMode(value) {
    patchSettings({ encumbranceMode: value, encumbranceTracking: value !== 'disabled' })
  }

  function setLevellingSystem(value) {
    patchSettings({ levellingSystem: value, milestoneMode: value === 'milestone' })
  }

  return (
    <div className="opt-root">
      <RuleGroup title="Encumbrance & Equipment">
        <ChoiceRule
          label="Encumbrance"
          value={rules.encumbranceMode}
          disabled={disabled}
          onChange={setEncumbranceMode}
          note="Hooked up in Gear. Basic and variant are currently tracked with STR x 15 until variant thresholds are added."
          options={[
            { value: 'disabled', label: 'Disabled', sub: 'Table default' },
            { value: 'basic', label: 'Basic', sub: 'Track weight' },
            { value: 'variant', label: 'Variant', sub: 'STR x 15' },
          ]}
        />
        <NumberRule
          label="Attunement limit"
          value={rules.attunementLimit}
          min={0}
          disabled={disabled}
          onChange={value => patchSettings({ attunementLimit: value })}
          note="Hooked up in Gear attunement."
        />
      </RuleGroup>

      <RuleGroup title="Spellcasting">
        <ChoiceRule
          label="Spell components"
          value={rules.spellComponents}
          disabled={disabled}
          onChange={value => patchSettings({ spellComponents: value })}
          note="Stored for now. Needs spell component display/enforcement pass."
          options={[
            { value: 'all', label: 'All required', sub: 'RAW' },
            { value: 'ignore-material', label: 'Ignore material' },
            { value: 'ignore-non-costly', label: 'Ignore non-costly' },
          ]}
        />
        <ChoiceRule
          label="Concentration"
          value={rules.concentrationMode}
          disabled={disabled}
          onChange={value => patchSettings({ concentrationMode: value })}
          note="Stored for now. Needs concentration casting behavior pass."
          options={[
            { value: 'raw', label: 'RAW' },
            { value: 'none', label: 'No limit', sub: 'High magic' },
          ]}
        />
        <ChoiceRule
          label="Cantrip scaling"
          value={rules.cantripScaling}
          disabled={disabled}
          onChange={value => patchSettings({ cantripScaling: value })}
          note="Stored for now. Needs spell damage scaling pass."
          options={[
            { value: 'character', label: 'Character level', sub: 'RAW' },
            { value: 'class', label: 'Class level' },
          ]}
        />
      </RuleGroup>

      <RuleGroup title="Resting">
        <ChoiceRule
          label="Hit Dice recovery on long rest"
          value={rules.hitDiceRecovery}
          disabled={disabled}
          onChange={value => patchSettings({ hitDiceRecovery: value })}
          note="Hooked up in Long Rest."
          options={[
            { value: 'half', label: 'Half total', sub: 'RAW' },
            { value: 'all', label: 'All HD' },
            { value: 'none', label: 'None' },
          ]}
        />
        <ChoiceRule
          label="HP recovery on long rest"
          value={rules.longRestHpRecovery}
          disabled={disabled}
          onChange={value => patchSettings({ longRestHpRecovery: value })}
          note="Hooked up in Long Rest."
          options={[
            { value: 'full', label: 'Full', sub: 'RAW' },
            { value: 'hit-dice', label: 'Only via HD spend' },
          ]}
        />
        <ChoiceRule
          label="Long rest duration"
          value={rules.longRestDuration}
          disabled={disabled}
          onChange={value => patchSettings({ longRestDuration: value })}
          note="Stored for now. Needs scheduling/session time behavior."
          options={[
            { value: '8h', label: '8 hours', sub: 'RAW' },
            { value: '24h', label: '24 hours', sub: 'Gritty' },
          ]}
        />
        <ChoiceRule
          label="Short rest duration"
          value={rules.shortRestDuration}
          disabled={disabled}
          onChange={value => patchSettings({ shortRestDuration: value })}
          note="Stored for now. Needs session timer behavior."
          options={[
            { value: '1h', label: '1 hour', sub: 'RAW' },
            { value: '5m', label: '5 minutes', sub: 'Heroic' },
          ]}
        />
        <NumberRule
          label="Short rests per long rest"
          value={rules.shortRestsPerLongRest}
          min={0}
          disabled={disabled}
          onChange={value => patchSettings({ shortRestsPerLongRest: value })}
          note="Stored for now. Needs rest counter enforcement."
        />
      </RuleGroup>

      <RuleGroup title="Progression">
        <ChoiceRule
          label="Levelling system"
          value={rules.levellingSystem}
          disabled={disabled}
          onChange={setLevellingSystem}
          note="Hooked up to automatic XP level-up prompts."
          options={[
            { value: 'xp', label: 'XP', sub: 'RAW' },
            { value: 'milestone', label: 'Milestone' },
          ]}
        />
        <ChoiceRule
          label="Multiclassing"
          value={rules.multiclassing}
          disabled={disabled}
          onChange={value => patchSettings({ multiclassing: value })}
          note="Stored for now. Needs level-up class-choice enforcement."
          options={[
            { value: 'enabled', label: 'Enabled', sub: 'RAW' },
            { value: 'disabled', label: 'Disabled' },
          ]}
        />
      </RuleGroup>
    </div>
  )
}

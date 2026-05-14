import '../TabShared.css'
import './OptionsTab.css'
import { RULE_GROUPS, normalizeRuleSettings, patchForRuleSetting } from '../ruleSettings'

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

export default function OptionsTab({ char, locked, isOwner, updateChar, campaign, campaignOptions }) {
  const rules = normalizeRuleSettings(char.settings)
  const disabled = locked || !isOwner
  const importableRules = campaignOptions?.settings ? normalizeRuleSettings(campaignOptions.settings) : null

  function patchSettings(patch) {
    const next = { ...char.settings, ...patch }
    updateChar({ settings: next })
  }

  function importCampaignRules() {
    if (!importableRules || disabled) return
    updateChar({
      settings: {
        ...char.settings,
        ...importableRules,
        importedCampaignRules: {
          campaignSlug: campaign?.slug,
          campaignName: campaign?.name,
          importedAt: new Date().toISOString(),
        },
      },
    })
  }

  return (
    <div className="opt-root">
      {importableRules && (
        <section className="opt-import">
          <div>
            <div className="opt-import-title">Campaign Rules</div>
            <div className="opt-import-sub">
              Import options from {campaign?.name ?? 'this campaign'} into this character.
            </div>
          </div>
          <button
            className="opt-import-btn"
            type="button"
            disabled={disabled}
            onClick={importCampaignRules}
          >
            Import Rules
          </button>
        </section>
      )}

      {RULE_GROUPS.map(group => (
        <RuleGroup key={group.title} title={group.title}>
          {group.rules.map(rule => rule.type === 'number' ? (
            <NumberRule
              key={rule.key}
              label={rule.label}
              value={rules[rule.key]}
              min={rule.min}
              disabled={disabled}
              onChange={value => patchSettings(patchForRuleSetting(rule.key, value))}
              note={rule.note}
            />
          ) : (
            <ChoiceRule
              key={rule.key}
              label={rule.label}
              value={rules[rule.key]}
              disabled={disabled}
              onChange={value => patchSettings(patchForRuleSetting(rule.key, value))}
              note={rule.note}
              options={rule.options}
            />
          ))}
        </RuleGroup>
      ))}
    </div>
  )
}

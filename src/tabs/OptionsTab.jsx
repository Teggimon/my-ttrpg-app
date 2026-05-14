import { useState } from 'react'
import '../TabShared.css'
import './OptionsTab.css'
import { RULE_GROUPS, normalizeRuleSettings, patchForRuleSetting } from '../ruleSettings'
import { CAMPAIGNS_PATH, DATA_REPO } from '../githubStorage'

function decodeContent(b64) {
  return JSON.parse(atob(String(b64 ?? '').replace(/\s/g, '')))
}

async function githubContent(owner, path, token) {
  const response = await fetch(`https://api.github.com/repos/${owner}/${DATA_REPO}/contents/${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) {
    const message = response.status === 404
      ? 'Could not find that DM or their app data repo.'
      : `GitHub request failed (${response.status}).`
    throw new Error(message)
  }
  return response.json()
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

function DMSettingsImport({ disabled, token, onImport }) {
  const [dmUser, setDmUser] = useState('')
  const [campaigns, setCampaigns] = useState([])
  const [selectedSlug, setSelectedSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const selectedCampaign = campaigns.find(c => c.slug === selectedSlug)

  async function loadCampaigns() {
    const owner = dmUser.trim()
    if (!owner) return
    setLoading(true)
    setError('')
    setCampaigns([])
    setSelectedSlug('')
    try {
      const contents = await githubContent(owner, CAMPAIGNS_PATH, token)
      if (!Array.isArray(contents)) throw new Error('Campaigns folder is not readable.')
      const files = contents.filter(item => item.type === 'file' && item.name.endsWith('.json'))
      const loaded = await Promise.all(files.map(async file => {
        const data = await githubContent(owner, file.path, token)
        const campaign = decodeContent(data.content)
        return {
          ...campaign,
          slug: campaign.slug ?? file.name.replace(/\.json$/, ''),
        }
      }))
      setCampaigns(loaded.sort((a, b) => String(a.name).localeCompare(String(b.name))))
      if (loaded.length === 0) setError('No campaigns found for that DM.')
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  async function importSelected() {
    if (!selectedCampaign) return
    setImporting(true)
    setError('')
    try {
      const owner = dmUser.trim()
      const data = await githubContent(owner, `${CAMPAIGNS_PATH}/${selectedCampaign.slug}/options.json`, token)
      const options = decodeContent(data.content)
      if (!options?.settings) throw new Error('That campaign does not have DM options saved yet.')
      onImport(normalizeRuleSettings(options.settings), {
        dmUser: owner,
        campaignSlug: selectedCampaign.slug,
        campaignName: selectedCampaign.name,
      })
    } catch (err) {
      setError(err.status === 404 ? 'That campaign does not have DM options saved yet.' : err.message)
    }
    setImporting(false)
  }

  return (
    <section className="opt-import opt-import--lookup">
      <div className="opt-import-head">
        <div>
          <div className="opt-import-title">Import DM Campaign Rules</div>
          <div className="opt-import-sub">Search by DM GitHub username, choose a campaign, then import its saved options.</div>
        </div>
      </div>

      <div className="opt-lookup-row">
        <input
          className="opt-lookup-input"
          value={dmUser}
          onChange={e => setDmUser(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && loadCampaigns()}
          placeholder="DM GitHub username"
          disabled={disabled || loading}
        />
        <button
          className="opt-import-btn"
          type="button"
          disabled={disabled || loading || !dmUser.trim()}
          onClick={loadCampaigns}
        >
          {loading ? 'Searching...' : 'Find Campaigns'}
        </button>
      </div>

      {campaigns.length > 0 && (
        <div className="opt-campaign-list">
          {campaigns.map(c => (
            <button
              key={c.slug}
              className={`opt-campaign-choice${selectedSlug === c.slug ? ' opt-campaign-choice--active' : ''}`}
              type="button"
              onClick={() => setSelectedSlug(c.slug)}
              disabled={disabled}
            >
              <span>{c.name}</span>
              <small>{c.slug}</small>
            </button>
          ))}
        </div>
      )}

      {campaigns.length > 0 && (
        <button
          className="opt-import-btn opt-import-btn--wide"
          type="button"
          disabled={disabled || importing || !selectedCampaign}
          onClick={importSelected}
        >
          {importing ? 'Importing...' : 'Import Selected Campaign Rules'}
        </button>
      )}

      {error && <div className="opt-import-error">{error}</div>}
    </section>
  )
}

export default function OptionsTab({ char, locked, isOwner, updateChar, campaign, campaignOptions, token }) {
  const rules = normalizeRuleSettings(char.settings)
  const disabled = locked || !isOwner
  const importableRules = campaignOptions?.settings ? normalizeRuleSettings(campaignOptions.settings) : null

  function patchSettings(patch) {
    const next = { ...char.settings, ...patch }
    updateChar({ settings: next })
  }

  function importCampaignRules() {
    if (!importableRules || disabled) return
    applyImportedRules(importableRules, {
      campaignSlug: campaign?.slug,
      campaignName: campaign?.name,
    })
  }

  function applyImportedRules(importedRules, source) {
    if (!importedRules || disabled) return
    updateChar({
      settings: {
        ...char.settings,
        ...importedRules,
        importedCampaignRules: {
          ...source,
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

      <DMSettingsImport
        disabled={disabled}
        token={token}
        onImport={applyImportedRules}
      />

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

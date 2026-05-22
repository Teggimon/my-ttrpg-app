import { useState, useEffect } from 'react'
import { Octokit } from '@octokit/rest'
import AccountMenu from './AccountMenu'
import { APP_META_PATH, CAMPAIGNS_PATH, DATA_REPO, repoDescription } from './githubStorage'
import { RULES_EDITION_OPTIONS, normalizeAvailableRulesEdition, normalizeRuleSettings, normalizeRulesEdition, rulesSystemForEdition } from './ruleSettings'
import './DMHome.css'

// ── Helpers ───────────────────────────────────────────────────
function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function slugify(name) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 40)
}

function encodeContent(obj) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj, null, 2))))
}

function decodeContent(b64) {
  return JSON.parse(atob(b64.replace(/\s/g, '')))
}

function rulesEditionLabel(value) {
  return RULES_EDITION_OPTIONS.find(option => option.value === normalizeRulesEdition(value))?.label ?? 'D&D 5e (2014)'
}

// ── Campaign Card ─────────────────────────────────────────────
function CampaignCard({ campaign, onClick, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const close = () => setMenuOpen(false)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [menuOpen])

  const isLive      = campaign.status === 'active' && campaign.sessions?.some(s => s.live)
  const sessionCount = campaign.sessions?.length ?? 0
  const playerCount  = campaign.players?.length ?? 0
  const nextSession  = sessionCount + 1
  const rulesEdition = campaign.settings?.rulesEdition ?? campaign.rulesEdition

  const allLevels = (campaign.players ?? []).flatMap(p =>
    (p.characters ?? []).filter(c => c.active).map(c => c.level ?? 1)
  )
  const avgLevel = allLevels.length
    ? Math.round(allLevels.reduce((a, b) => a + b, 0) / allLevels.length)
    : null

  return (
    <div
      className={`campaign-card${isLive ? ' campaign-card--live' : ''}`}
      onClick={onClick}
    >
      {/* Cover */}
      <div className="campaign-cover">
        <img src={campaign.image || '/uploads/placeholders/default-portrait.jpg'} alt="" className="campaign-cover-img" />

        {isLive && (
          <div className="live-badge">
            <span className="live-pulse" />
            Live
          </div>
        )}

        <button
          className="campaign-menu-btn"
          onClick={e => { e.stopPropagation(); setMenuOpen(o => !o) }}
          aria-label="Campaign options"
        >⋯</button>

        {menuOpen && (
          <div className="campaign-menu" onClick={e => e.stopPropagation()}>
            <button className="campaign-menu-item" onClick={() => { setMenuOpen(false); onClick() }}>
              {isLive ? 'Open Session' : 'Open Campaign'}
            </button>
            <div className="campaign-menu-divider" />
            <button
              className="campaign-menu-item campaign-menu-item--danger"
              onClick={() => { setMenuOpen(false); onDelete(campaign) }}
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="campaign-body">
        <div className="campaign-name">{campaign.name}</div>
        <div className="campaign-meta">
          {isLive
            ? `Session ${sessionCount} · In progress`
            : sessionCount === 0
              ? `Planning · ${rulesEditionLabel(rulesEdition)}`
              : `${sessionCount} session${sessionCount !== 1 ? 's' : ''} complete · ${rulesEditionLabel(rulesEdition)}`
          }
        </div>

        <div className="campaign-stats">
          {playerCount > 0 && (
            <span className="cstat"><span className="cstat-val">{playerCount} player{playerCount !== 1 ? 's' : ''}</span></span>
          )}
          {avgLevel && (
            <span className="cstat"><span className="cstat-val">Lv {avgLevel}</span></span>
          )}
          <span className="cstat"><span className="cstat-val">Session {nextSession}</span></span>
        </div>

        {isLive
          ? <button className="campaign-enter-btn" onClick={onClick}>Enter Session</button>
          : <button className="campaign-start-btn" onClick={e => { e.stopPropagation(); onClick() }}>
              {sessionCount === 0 ? 'Start First Session' : `Start Session ${nextSession}`}
            </button>
        }
      </div>
    </div>
  )
}

// ── New Campaign Card ─────────────────────────────────────────
function NewCampaignCard({ onClick }) {
  return (
    <div className="campaign-card campaign-card--new" onClick={onClick}>
      <div className="campaign-new-inner">
        <span className="campaign-new-plus">+</span>
        <span className="campaign-new-label">New Campaign</span>
        <span className="campaign-new-hint">Create a new adventure</span>
      </div>
    </div>
  )
}

// ── Create Campaign Modal ─────────────────────────────────────
function CreateCampaignModal({ onClose, onCreate }) {
  const [name, setName]       = useState('')
  const [rulesEdition, setRulesEdition] = useState('2014')
  const [image]               = useState('/uploads/placeholders/default-portrait.jpg')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const submit = async () => {
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      await onCreate({ name: name.trim(), image, rulesEdition: normalizeAvailableRulesEdition(rulesEdition) })
      onClose()
    } catch {
      setError('Failed to create campaign. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="dm-modal-overlay" onClick={onClose}>
      <div className="dm-modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="dm-modal-handle" />
        <div className="dm-modal-title">New Campaign</div>

        <div className="dm-field-label dm-field-label--first">Rules edition</div>
        <div className="rules-edition-grid" role="radiogroup" aria-label="Rules edition">
          {RULES_EDITION_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              className={`rules-edition-choice${rulesEdition === option.value ? ' rules-edition-choice--active' : ''}${option.available === false ? ' rules-edition-choice--disabled' : ''}`}
              onClick={() => option.available !== false && setRulesEdition(option.value)}
              role="radio"
              aria-checked={rulesEdition === option.value}
              disabled={option.available === false}
              autoFocus={option.value === '2014'}
            >
              <span className="rules-edition-title">{option.label}</span>
              <span className="rules-edition-sub">
                {option.sub}{option.available === false ? ` · ${option.unavailableLabel ?? 'Unavailable'}` : ''}
              </span>
            </button>
          ))}
        </div>

        <img src={image} alt="" className="campaign-image-preview" />

        <label className="dm-field-label">Campaign name</label>
        <input
          className="dm-input"
          placeholder="e.g. The Fellowship"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
        />

        {error && <p className="dm-error">{error}</p>}

        <div className="dm-modal-actions">
          <button className="dm-btn dm-btn--ghost" onClick={onClose}>Cancel</button>
          <button
            className="dm-btn dm-btn--accent"
            onClick={submit}
            disabled={!name.trim() || loading}
          >
            {loading ? 'Creating…' : 'Create Campaign'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete Confirm Modal ──────────────────────────────────────
function DeleteModal({ campaign, onConfirm, onCancel, loading }) {
  return (
    <div className="dm-modal-overlay" onClick={onCancel}>
      <div className="dm-modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="dm-modal-handle" />
        <div className="dm-modal-title">Delete {campaign.name}?</div>
        <p className="dm-modal-body">
          This permanently removes the campaign and all its data from your GitHub repo. This cannot be undone.
        </p>
        <div className="dm-modal-actions">
          <button className="dm-btn dm-btn--ghost" onClick={onCancel}>Cancel</button>
          <button className="dm-btn dm-btn--danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── No Repo Empty State ───────────────────────────────────────
function NoRepoState({ onSetup, loading }) {
  return (
    <div className="no-repo-state">
      <img src="/uploads/placeholders/default-portrait.jpg" alt="" className="no-repo-img" />
      <div className="no-repo-title">No app data repository found</div>
      <div className="no-repo-body">
        Your campaigns live in your app data repository,{' '}
        <code>{DATA_REPO}</code>. It doesn't exist yet — create it to get started.
      </div>
      <button className="dm-btn dm-btn--accent no-repo-btn" onClick={onSetup} disabled={loading}>
        {loading ? 'Creating…' : `Create ${DATA_REPO}`}
      </button>
    </div>
  )
}

// ── Main DMHome ───────────────────────────────────────────────
export default function DMHome({ token, user, onBack, onOpenCampaign, onLogout }) {
  const [campaigns, setCampaigns]         = useState([])
  const [loading, setLoading]             = useState(true)
  const [repoExists, setRepoExists]       = useState(null)   // null = checking
  const [creatingRepo, setCreatingRepo]   = useState(false)
  const [showCreate, setShowCreate]       = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const octokit = new Octokit({ auth: token })

  // ── Check repo + load campaigns ──
  useEffect(() => { init() }, [])

  const init = async () => {
    setLoading(true)
    try {
      await octokit.repos.get({ owner: user.login, repo: DATA_REPO })
      setRepoExists(true)
      await loadCampaigns()
    } catch (err) {
      if (err.status === 404) {
        setRepoExists(false)
      }
    }
    setLoading(false)
  }

  const loadCampaigns = async () => {
    try {
      const { data: files } = await octokit.repos.getContent({
        owner: user.login,
        repo:  DATA_REPO,
        path:  CAMPAIGNS_PATH,
      })
      const loaded = await Promise.all(
        files
          .filter(f => f.name.endsWith('.json'))
          .map(async f => {
            const { data: fd } = await octokit.repos.getContent({
              owner: user.login,
              repo:  DATA_REPO,
              path:  f.path,
            })
            return {
              ...decodeContent(fd.content),
              _fileName: f.name,
              _sha: fd.sha,
              // Ensure slug is always present — derive from filename if missing
              slug: decodeContent(fd.content).slug ?? f.name.replace('.json', ''),
            }
          })
      )
      setCampaigns(loaded)
    } catch {
      // campaigns folder doesn't exist yet — that's fine, just empty
      setCampaigns([])
    }
  }

  // ── Create the app data repo if DM mode was opened before setup finished ──
  const setupRepo = async () => {
    setCreatingRepo(true)
    try {
      await octokit.repos.createForAuthenticatedUser({
        name:        DATA_REPO,
        description: repoDescription(),
        auto_init:   true,
        private:     false,
      })
      await octokit.repos.createOrUpdateFileContents({
        owner: user.login,
        repo: DATA_REPO,
        path: APP_META_PATH,
        message: 'Enable GM tools',
        content: encodeContent({ isGM: true, updatedAt: new Date().toISOString() }),
      })
      setRepoExists(true)
      setCampaigns([])
    } catch (err) {
      alert('Failed to create repository: ' + err.message)
    }
    setCreatingRepo(false)
  }

  // ── Create a campaign ──
  const createCampaign = async ({ name, image, rulesEdition }) => {
    const normalizedRulesEdition = normalizeAvailableRulesEdition(rulesEdition)
    const slug = slugify(name) + '-' + Math.random().toString(36).slice(2, 6)
    const campaign = {
      campaignId: generateId(),
      slug,
      name,
      image,
      system: rulesSystemForEdition(normalizedRulesEdition),
      rulesEdition: normalizedRulesEdition,
      settings: normalizeRuleSettings({ rulesEdition: normalizedRulesEdition }),
      createdAt: new Date().toISOString(),
      status: 'planning',
      players: [],
      sessions: [],
    }
    const path = `${CAMPAIGNS_PATH}/${slug}.json`

    await octokit.repos.createOrUpdateFileContents({
      owner:   user.login,
      repo:    DATA_REPO,
      path,
      message: `Create campaign: ${name}`,
      content: encodeContent(campaign),
    })

    await loadCampaigns()
  }

  const collectFilesUnder = async (path) => {
    try {
      const { data } = await octokit.repos.getContent({
        owner: user.login,
        repo: DATA_REPO,
        path,
      })
      if (!Array.isArray(data)) return data.sha ? [data.path] : []
      const nested = await Promise.all(data.map(item =>
        item.type === 'dir' ? collectFilesUnder(item.path) : [item.path]
      ))
      return nested.flat()
    } catch (err) {
      if (err.status === 404) return []
      throw err
    }
  }

  const campaignMatches = (candidate, campaign) => {
    if (!candidate) return false
    if (campaign.campaignId && candidate.campaignId === campaign.campaignId) return true
    if (campaign.slug && candidate.slug === campaign.slug) return true
    return candidate.name === campaign.name && candidate.createdAt === campaign.createdAt
  }

  const pathsForCampaignDelete = async (campaign) => {
    const paths = new Set()
    const slugCandidates = [
      campaign.slug,
      campaign.campaignId,
      campaign.name ? slugify(campaign.name) : null,
    ].filter(Boolean)

    if (campaign._fileName) {
      paths.add(`${CAMPAIGNS_PATH}/${campaign._fileName}`)
    }
    for (const slug of slugCandidates) {
      paths.add(`${CAMPAIGNS_PATH}/${slug.endsWith('.json') ? slug : `${slug}.json`}`)
    }

    try {
      const { data: rootItems } = await octokit.repos.getContent({
        owner: user.login,
        repo: DATA_REPO,
        path: CAMPAIGNS_PATH,
      })
      if (Array.isArray(rootItems)) {
        for (const item of rootItems) {
          if (item.type === 'file' && item.name.endsWith('.json')) {
            try {
              const { data } = await octokit.repos.getContent({
                owner: user.login,
                repo: DATA_REPO,
                path: item.path,
              })
              if (!Array.isArray(data) && campaignMatches(decodeContent(data.content), campaign)) {
                paths.add(item.path)
              }
            } catch (err) {
              if (err.status !== 404) throw err
            }
          }
          if (item.type === 'dir' && slugCandidates.includes(item.name)) {
            for (const path of await collectFilesUnder(item.path)) paths.add(path)
          }
        }
      }
    } catch (err) {
      if (err.status !== 404) throw err
    }

    for (const slug of slugCandidates) {
      for (const path of await collectFilesUnder(`${CAMPAIGNS_PATH}/${slug}`)) paths.add(path)
    }

    return [...paths].sort((a, b) => b.length - a.length)
  }

  // ── Delete a campaign ──
  const deleteCampaign = async () => {
    if (!confirmDelete) return
    setDeleteLoading(true)
    try {
      const paths = await pathsForCampaignDelete(confirmDelete)
      if (paths.length === 0) throw new Error('Could not find campaign files to delete.')

      for (const path of paths) {
        try {
          const { data } = await octokit.repos.getContent({
            owner: user.login,
            repo: DATA_REPO,
            path,
          })
          if (Array.isArray(data) || !data.sha) continue
          await octokit.repos.deleteFile({
            owner:   user.login,
            repo:    DATA_REPO,
            path,
            message: `Delete campaign: ${confirmDelete.name}`,
            sha:     data.sha,
          })
        } catch (err) {
          if (err.status !== 404) throw err
        }
      }
      setConfirmDelete(null)
      await loadCampaigns()
    } catch (err) {
      alert(`Failed to delete campaign: ${err.message}`)
    } finally {
      setDeleteLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="dm-home-body">
      <div className="dm-home-panel">

        {/* Header */}
        <header className="dm-home-header">
          <div className="dm-home-brand">
            <div className="dm-home-logo"><img src="/uploads/placeholders/default-portrait.jpg" alt="" className="dm-home-logo-img" /></div>
            <div>
              <div className="dm-home-wordmark">TTRPG Sheet</div>
              <div className="dm-home-tagline">Dungeon Master</div>
            </div>
          </div>

          <div className="dm-mode-toggle" aria-label="View mode">
            <button className="dm-mode-btn" onClick={onBack}>
              Player
            </button>
            <button className="dm-mode-btn dm-mode-btn--active" aria-current="page">
              DM
            </button>
          </div>

          <div className="dm-home-user">
            <span className="dm-home-username">{user.login}</span>
            <AccountMenu user={user} mode="dm" onLogout={onLogout} />
          </div>
        </header>

        {/* Body */}
        <div className="dm-home-scroll">

          {/* Loading */}
          {loading && (
            <div className="dm-loading">
              <div className="dm-spinner" />
              Loading campaigns…
            </div>
          )}

          {/* No repo */}
          {!loading && repoExists === false && (
            <NoRepoState onSetup={setupRepo} loading={creatingRepo} />
          )}

          {/* Campaign grid */}
          {!loading && repoExists === true && (
            <section className="dm-section">
              <div className="dm-section-header">
                <h2 className="dm-section-title">
                  Campaigns
                  <span className="dm-section-count">{campaigns.length}</span>
                </h2>
              </div>

              <div className="campaign-grid">
                {campaigns.map(c => (
                  <CampaignCard
                    key={c.campaignId}
                    campaign={c}
                    onClick={() => onOpenCampaign(c)}
                    onDelete={setConfirmDelete}
                  />
                ))}
                <NewCampaignCard onClick={() => setShowCreate(true)} />
              </div>
            </section>
          )}

        </div>
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateCampaignModal
          onClose={() => setShowCreate(false)}
          onCreate={createCampaign}
        />
      )}

      {confirmDelete && (
        <DeleteModal
          campaign={confirmDelete}
          onConfirm={deleteCampaign}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  )
}

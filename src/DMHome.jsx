import { useState, useEffect } from 'react'
import { Octokit } from '@octokit/rest'
import './DMHome.css'

// ── Constants ─────────────────────────────────────────────────
const CAMPAIGNS_REPO = 'ttrpg-campaigns'
const CAMPAIGNS_PATH = 'campaigns'

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

const CAMPAIGN_EMOJIS = ['🗺️','🏰','🐉','⚔️','🌑','🏔️','🌊','🔥','💀','🌿','🕯️','🗡️']

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
        <span className="campaign-emoji">{campaign.emoji || '🗺️'}</span>

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
              {isLive ? '▶ Open Session' : '🎯 Open Campaign'}
            </button>
            <div className="campaign-menu-divider" />
            <button
              className="campaign-menu-item campaign-menu-item--danger"
              onClick={() => { setMenuOpen(false); onDelete(campaign) }}
            >
              🗑️ Delete
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
              ? 'Planning · Not started'
              : `${sessionCount} session${sessionCount !== 1 ? 's' : ''} complete`
          }
        </div>

        <div className="campaign-stats">
          {playerCount > 0 && (
            <span className="cstat">👥 <span className="cstat-val">{playerCount} player{playerCount !== 1 ? 's' : ''}</span></span>
          )}
          {avgLevel && (
            <span className="cstat">⚔️ <span className="cstat-val">Lv {avgLevel}</span></span>
          )}
          <span className="cstat">📋 <span className="cstat-val">Session {nextSession}</span></span>
        </div>

        {isLive
          ? <button className="campaign-enter-btn" onClick={onClick}>▶ Enter Session</button>
          : <button className="campaign-start-btn" onClick={e => { e.stopPropagation(); onClick() }}>
              {sessionCount === 0 ? '🎯 Start First Session' : `🎯 Start Session ${nextSession}`}
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
  const [emoji, setEmoji]     = useState('🗺️')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const submit = async () => {
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      await onCreate({ name: name.trim(), emoji })
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

        <div className="emoji-grid">
          {CAMPAIGN_EMOJIS.map(e => (
            <button
              key={e}
              className={`emoji-btn${emoji === e ? ' emoji-btn--active' : ''}`}
              onClick={() => setEmoji(e)}
            >{e}</button>
          ))}
        </div>

        <label className="dm-field-label">Campaign name</label>
        <input
          className="dm-input"
          placeholder="e.g. The Fellowship"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          autoFocus
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
      <div className="no-repo-emoji">📖</div>
      <div className="no-repo-title">No campaign repository found</div>
      <div className="no-repo-body">
        Your campaigns live in a GitHub repository called{' '}
        <code>ttrpg-campaigns</code>. It doesn't exist yet — create it to get started.
      </div>
      <button className="dm-btn dm-btn--accent no-repo-btn" onClick={onSetup} disabled={loading}>
        {loading ? 'Creating…' : '⚔️ Create ttrpg-campaigns'}
      </button>
    </div>
  )
}

// ── Main DMHome ───────────────────────────────────────────────
export default function DMHome({ token, user, onBack, onOpenCampaign }) {
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
      await octokit.repos.get({ owner: user.login, repo: CAMPAIGNS_REPO })
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
        repo:  CAMPAIGNS_REPO,
        path:  CAMPAIGNS_PATH,
      })
      const loaded = await Promise.all(
        files
          .filter(f => f.name.endsWith('.json'))
          .map(async f => {
            const { data: fd } = await octokit.repos.getContent({
              owner: user.login,
              repo:  CAMPAIGNS_REPO,
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

  // ── Create the ttrpg-campaigns repo ──
  const setupRepo = async () => {
    setCreatingRepo(true)
    try {
      await octokit.repos.createForAuthenticatedUser({
        name:        CAMPAIGNS_REPO,
        description: 'TTRPG campaign data',
        auto_init:   true,
        private:     false,
      })
      setRepoExists(true)
      setCampaigns([])
    } catch (err) {
      alert('Failed to create repository: ' + err.message)
    }
    setCreatingRepo(false)
  }

  // ── Create a campaign ──
  const createCampaign = async ({ name, emoji }) => {
    const slug = slugify(name) + '-' + Math.random().toString(36).slice(2, 6)
    const campaign = {
      campaignId: generateId(),
      slug,
      name,
      emoji,
      createdAt: new Date().toISOString(),
      status: 'planning',
      players: [],
      sessions: [],
    }
    const path = `${CAMPAIGNS_PATH}/${slug}.json`

    await octokit.repos.createOrUpdateFileContents({
      owner:   user.login,
      repo:    CAMPAIGNS_REPO,
      path,
      message: `Create campaign: ${name}`,
      content: encodeContent(campaign),
    })

    await loadCampaigns()
  }

  // ── Delete a campaign ──
  const deleteCampaign = async () => {
    if (!confirmDelete) return
    setDeleteLoading(true)
    try {
      await octokit.repos.deleteFile({
        owner:   user.login,
        repo:    CAMPAIGNS_REPO,
        path:    `${CAMPAIGNS_PATH}/${confirmDelete._fileName}`,
        message: `Delete campaign: ${confirmDelete.name}`,
        sha:     confirmDelete._sha,
      })
      setCampaigns(prev => prev.filter(c => c.campaignId !== confirmDelete.campaignId))
      setConfirmDelete(null)
    } catch {
      alert('Failed to delete campaign.')
    }
    setDeleteLoading(false)
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="dm-home-body">
      <div className="dm-home-panel">

        {/* Header */}
        <header className="dm-home-header">
          <button className="dm-back-btn" onClick={onBack}>← Player</button>
          <div className="dm-home-brand">
            <div className="dm-home-logo">📖</div>
            <div>
              <div className="dm-home-wordmark">TTRPG Sheet</div>
              <div className="dm-home-tagline">Dungeon Master</div>
            </div>
          </div>
          <div className="dm-home-user">
            <span className="dm-home-username">{user.login}</span>
            {user.avatar_url
              ? <img src={user.avatar_url} alt={user.login} className="dm-home-avatar" />
              : <div className="dm-home-avatar dm-home-avatar--initial">{user.login[0].toUpperCase()}</div>
            }
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

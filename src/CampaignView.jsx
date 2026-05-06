import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Octokit } from '@octokit/rest'
import { getMonsters } from './srdContent'
import './CampaignView.css'

const CAMPAIGNS_REPO  = 'ttrpg-campaigns'
const CHARACTERS_REPO = 'ttrpg-characters'

// ── GitHub helpers ────────────────────────────────────────────
function encode(obj) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj, null, 2))))
}
function decode(b64) {
  return JSON.parse(atob(b64.replace(/\s/g, '')))
}
function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
function campaignPath(slug) {
  return `campaigns/${slug}`
}

// ── Elapsed time formatting ───────────────────────────────────
function formatElapsed(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${String(s).padStart(2, '0')}s`
}

function formatInGameTime(rounds) {
  const totalSeconds = rounds * 6
  if (totalSeconds < 60) return `${totalSeconds}s`
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

// ── HP helpers ────────────────────────────────────────────────
function hpPct(cur, max) { return max ? Math.min(100, Math.round((cur / max) * 100)) : 0 }
function hpColor(pct) {
  if (pct <= 0)  return 'var(--text-muted)'
  if (pct < 25)  return 'var(--hp-low)'
  if (pct < 50)  return 'var(--hp-mid)'
  return 'var(--hp-high)'
}

// ════════════════════════════════════════════════════════════════
//  Sub-components
// ════════════════════════════════════════════════════════════════

// ── Session Row ───────────────────────────────────────────────
function SessionRow({ session, index, onOpen }) {
  const [expanded, setExpanded] = useState(false)
  const isLive = session.status === 'live'

  return (
    <div className={`session-row${isLive ? ' session-row--live' : ''}`}>
      <div className="session-row-head" onClick={() => setExpanded(e => !e)}>
        <div className="session-num">{index + 1}</div>
        <div className="session-info">
          <div className="session-name">{session.name || `Session ${index + 1}`}</div>
          <div className="session-meta">
            {session.date && <span>{new Date(session.date).toLocaleDateString()}</span>}
            {session.duration && <span>· {formatElapsed(session.duration)}</span>}
            {session.players?.length > 0 && <span>· {session.players.length} players</span>}
            {session.encounters?.length > 0 && <span>· {session.encounters.length} encounter{session.encounters.length !== 1 ? 's' : ''}</span>}
          </div>
        </div>
        <div className="session-status">
          {isLive
            ? <span className="status-live"><span className="live-dot" />Live</span>
            : session.status === 'done'
              ? <span className="status-done">✓ Done</span>
              : <span className="status-planned">Planned</span>
          }
        </div>
        <div className={`session-chevron${expanded ? ' session-chevron--open' : ''}`}>▾</div>
      </div>

      {expanded && (
        <div className="session-row-detail">
          {session.players?.length > 0 && (
            <div className="session-players">
              {session.players.map(p => (
                <span key={p.github} className={`player-chip${p.absent ? ' player-chip--absent' : ''}`}>
                  {p.characterName} · @{p.github}
                </span>
              ))}
            </div>
          )}

          {session.encounters?.length > 0 && (
            <div className="session-encounters">
              {session.encounters.map((enc, i) => (
                <div key={enc.encounterId ?? i} className="session-enc-row">
                  <span className="session-enc-name">{enc.name}</span>
                  <span className="session-enc-meta">{enc.rounds} rounds · {formatInGameTime(enc.rounds ?? 0)}</span>
                  <span className={`session-enc-outcome session-enc-outcome--${enc.outcome ?? 'unknown'}`}>
                    {enc.outcome === 'victory' ? '⚔ Victory' : enc.outcome === 'fled' ? '↩ Fled' : enc.outcome === 'defeat' ? '💀 Defeat' : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <button className="session-open-btn" onClick={() => onOpen(session)}>
            {isLive ? '▶ Resume Session →' : '📋 Open Session →'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Character Row (in party tab) ──────────────────────────────
function CharRow({ char, onToggleActive }) {
  const pct   = hpPct(char.hpCurrent ?? char.hpMax, char.hpMax)
  const color = hpColor(pct)
  return (
    <div className={`char-row${char.active ? '' : ' char-row--inactive'}`}>
      <div className="char-row-info">
        <div className="char-row-name">{char.name}</div>
        <div className="char-row-class">{char.class} · Lv {char.level}</div>
        <div className="char-row-hp-track">
          <div className="char-row-hp-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>
      <div className="char-row-right">
        <span className="char-row-hp-text">{char.hpCurrent}/{char.hpMax}</span>
        <button
          className={`active-badge${char.active ? ' active-badge--active' : ''}`}
          onClick={() => onToggleActive(char.characterId)}
        >
          {char.active ? 'Active' : 'Inactive'}
        </button>
      </div>
    </div>
  )
}

// ── Player Block (in party tab) ───────────────────────────────
function PlayerBlock({ player, onToggleCharActive, onManage }) {
  return (
    <div className="player-block">
      <div className="player-block-header">
        <div className="player-avatar">{player.github[0].toUpperCase()}</div>
        <div className="player-header-info">
          <div className="player-github">{player.github}</div>
          <div className="player-handle">@{player.github}</div>
        </div>
        <button className="manage-chars-btn" onClick={() => onManage(player)}>
          Manage Characters
        </button>
      </div>

      <div className="player-chars">
        {(player.characters ?? []).length === 0
          ? <div className="player-no-chars">No characters added yet</div>
          : player.characters.map(char => (
              <CharRow
                key={char.characterId}
                char={char}
                onToggleActive={(id) => onToggleCharActive(player.github, id)}
              />
            ))
        }
      </div>
    </div>
  )
}

// ── Manage Characters Modal ───────────────────────────────────
function ManageCharsModal({ token, player, campaign, onSave, onClose }) {
  const [username, setUsername]   = useState(player?.github ?? '')
  const [fetching, setFetching]   = useState(false)
  const [fetchedChars, setFetchedChars] = useState([])
  const [error, setError]         = useState(null)

  const octokit = new Octokit({ auth: token })

  const fetchChars = async () => {
    if (!username.trim()) return
    setFetching(true)
    setError(null)
    try {
      const { data: files } = await octokit.repos.getContent({
        owner: username.trim(),
        repo:  CHARACTERS_REPO,
        path:  'characters',
      })
      const chars = await Promise.all(
        files
          .filter(f => f.name.endsWith('.json'))
          .map(async f => {
            const { data: fd } = await octokit.repos.getContent({
              owner: username.trim(),
              repo:  CHARACTERS_REPO,
              path:  f.path,
            })
            const char = decode(fd.content)
            const existingChar = (player?.characters ?? []).find(
              c => c.characterId === char.meta?.characterId
            )
            return {
              characterId:  char.meta?.characterId ?? genId(),
              name:         char.identity?.name ?? 'Unknown',
              class:        (char.identity?.class ?? []).map(c => `${c.name} ${c.level}`).join(' / '),
              level:        (char.identity?.class ?? []).reduce((s, c) => s + (c.level ?? 0), 0),
              hpCurrent:    char.combat?.hpCurrent ?? char.combat?.hpMax ?? 10,
              hpMax:        char.combat?.hpMax ?? 10,
              active:       existingChar ? existingChar.active : false,
              inCampaign:   !!existingChar,
            }
          })
      )
      setFetchedChars(chars)
    } catch {
      setError(`Couldn't find characters for @${username}. Make sure they use TTRPG Sheet.`)
    }
    setFetching(false)
  }

  const toggle = (id) => {
    setFetchedChars(prev => prev.map(c =>
      c.characterId === id ? { ...c, active: !c.active, inCampaign: true } : c
    ))
  }

  const save = () => {
    const selected = fetchedChars.filter(c => c.inCampaign || c.active)
    onSave(username.trim(), selected)
  }

  return createPortal(
    <div className="cv-modal-overlay" onClick={onClose}>
      <div className="cv-modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="cv-modal-handle" />
        <div className="cv-modal-title">
          {player ? `Manage Characters — @${player.github}` : 'Add Player'}
        </div>

        {!player && (
          <div className="fetch-row">
            <input
              className="cv-input"
              placeholder="GitHub username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchChars()}
            />
            <button className="cv-btn cv-btn--accent" onClick={fetchChars} disabled={fetching || !username.trim()}>
              {fetching ? '…' : 'Fetch →'}
            </button>
          </div>
        )}

        {player && fetchedChars.length === 0 && !fetching && (
          <button className="cv-btn cv-btn--ghost" onClick={fetchChars} disabled={fetching}>
            {fetching ? 'Loading…' : 'Refresh Characters'}
          </button>
        )}

        {error && <p className="cv-error">{error}</p>}

        {fetchedChars.length > 0 && (
          <div className="fetched-chars">
            {fetchedChars.map(char => (
              <div key={char.characterId} className="fetched-char-row">
                <div className="fetched-char-info">
                  <div className="fetched-char-name">{char.name}</div>
                  <div className="fetched-char-sub">{char.class}</div>
                </div>
                <div className="fetched-char-right">
                  <button
                    className={`active-badge${char.active ? ' active-badge--active' : ''}`}
                    onClick={() => toggle(char.characterId)}
                  >
                    {char.inCampaign ? (char.active ? 'Active' : 'Inactive') : '+ Add'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="cv-modal-actions">
          <button className="cv-btn cv-btn--ghost" onClick={onClose}>Cancel</button>
          {fetchedChars.length > 0 && (
            <button className="cv-btn cv-btn--accent" onClick={save}>Save</button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── NPC Row ───────────────────────────────────────────────────
function NPCRow({ npc, onDelete }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`npc-row${npc.category === 'boss' ? ' npc-row--boss' : ''}`}>
      <div className="npc-row-head" onClick={() => setExpanded(e => !e)}>
        <div className="npc-portrait">{npc.category === 'boss' ? '👑' : npc.category === 'ally' ? '🤝' : '👺'}</div>
        <div className="npc-info">
          <div className="npc-name">{npc.name}</div>
          <div className="npc-meta">
            {npc.type && <span>{npc.type}</span>}
            {npc.cr   && <span> · CR {npc.cr}</span>}
          </div>
        </div>
        <div className="npc-stats">
          {npc.hp  && <span className="npc-stat">❤️ {npc.hp}</span>}
          {npc.ac  && <span className="npc-stat">🛡 {npc.ac}</span>}
          {npc.initiative != null && <span className="npc-stat">⚡ {npc.initiative >= 0 ? '+' : ''}{npc.initiative}</span>}
        </div>
        <button
          className="npc-delete-btn"
          onClick={e => { e.stopPropagation(); onDelete(npc.npcId) }}
        >✕</button>
        <div className={`session-chevron${expanded ? ' session-chevron--open' : ''}`}>▾</div>
      </div>

      {expanded && npc.actions?.length > 0 && (
        <div className="npc-detail">
          <div className="npc-detail-label">Actions</div>
          {npc.actions.map((a, i) => (
            <div key={i} className="npc-action-row">
              <span className="npc-action-name">{a.name}</span>
              <span className="npc-action-desc">{a.desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── CR formatter ──────────────────────────────────────────────
function formatCR(cr) {
  if (cr === 0.125) return '⅛'
  if (cr === 0.25)  return '¼'
  if (cr === 0.5)   return '½'
  return String(cr)
}
function dexMod(dex) { return Math.floor(((dex ?? 10) - 10) / 2) }
function abilityMod(val) {
  const n = parseInt(val) || 10
  const m = Math.floor((n - 10) / 2)
  return m >= 0 ? `+${m}` : `${m}`
}

const CREATURE_TYPES = ['Humanoid','Beast','Undead','Fiend','Dragon','Aberration','Construct','Elemental','Fey','Giant','Monstrosity','Ooze','Plant','Celestial','Other']

// ── Add NPC Modal (Search + Create) ───────────────────────────
function AddNPCModal({ campaignNpcs, onAdd, onClose }) {
  const [view, setView]               = useState('search')
  const [query, setQuery]             = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [srdMonsters, setSrdMonsters] = useState([])
  const [loadingSrd, setLoadingSrd]   = useState(false)

  // Create form — shared fields
  const [createMode, setCreateMode]   = useState('quick')
  const [name, setName]               = useState('')
  const [type, setType]               = useState('Humanoid')
  const [cr, setCr]                   = useState('')
  const [hp, setHp]                   = useState('')
  const [ac, setAc]                   = useState('')
  const [speed, setSpeed]             = useState('30ft')
  const [hitDie, setHitDie]           = useState('')
  const [category, setCategory]       = useState('standard')

  // Quick-only
  const [initiative, setInit]         = useState('')
  const [quickNotes, setQuickNotes]   = useState('')

  // Full-only
  const [size, setSize]               = useState('Medium')
  const [alignment, setAlignment]     = useState('')
  const [profBonus, setProfBonus]     = useState('')
  const [str, setStr]                 = useState('10')
  const [dex, setDex]                 = useState('10')
  const [con, setCon]                 = useState('10')
  const [int_, setInt]                = useState('10')
  const [wis, setWis]                 = useState('10')
  const [cha, setCha]                 = useState('10')
  const [resistances, setResistances] = useState([])
  const [immunities, setImmunities]   = useState([])
  const [condImm, setCondImm]         = useState([])
  const [actions, setActions]         = useState([])
  const [traits, setTraits]           = useState([])
  const [senses, setSenses]           = useState('')

  // Inline tag-add state
  const [tagAdding, setTagAdding]     = useState(null) // 'res'|'imm'|'cond'
  const [tagDraft, setTagDraft]       = useState('')

  useEffect(() => {
    setLoadingSrd(true)
    getMonsters()
      .then(d => { setSrdMonsters(d); setLoadingSrd(false) })
      .catch(() => setLoadingSrd(false))
  }, [])

  const filteredSrd = srdMonsters.filter(m =>
    query.trim() && m.name.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 20)

  const filteredCampaign = campaignNpcs.filter(n =>
    query.trim() && n.name.toLowerCase().includes(query.toLowerCase())
  )

  const showSrd      = sourceFilter === 'all' || sourceFilter === 'srd'
  const showCampaign = sourceFilter === 'all' || sourceFilter === 'campaign'

  const addFromSrd = (monster, cat) => {
    onAdd({
      npcId:      genId(),
      name:       monster.name,
      type:       monster.type,
      cr:         formatCR(monster.challenge_rating),
      hp:         monster.hit_points ?? null,
      ac:         monster.armor_class?.[0]?.value ?? null,
      initiative: dexMod(monster.dexterity),
      category:   cat,
      actions:    (monster.actions ?? []).map(a => ({ name: a.name, desc: a.desc })),
      source:     'srd',
    })
    onClose()
  }

  const addFromCampaign = (npc, cat) => {
    onAdd({ ...npc, npcId: genId(), category: cat })
    onClose()
  }

  const submitQuick = () => {
    if (!name.trim()) return
    onAdd({
      npcId:      genId(),
      name:       name.trim(),
      type,
      cr:         cr.trim(),
      hp:         hp ? parseInt(hp) : null,
      ac:         ac ? parseInt(ac) : null,
      initiative: initiative !== '' ? parseInt(initiative) : null,
      speed:      speed.trim(),
      hitDie:     hitDie.trim(),
      notes:      quickNotes.trim(),
      category,
      actions:    [],
      source:     'custom',
    })
    onClose()
  }

  const submitFull = () => {
    if (!name.trim()) return
    onAdd({
      npcId:      genId(),
      name:       name.trim(),
      size, type, alignment: alignment.trim(),
      cr:         cr.trim(),
      hp:         hp ? parseInt(hp) : null,
      ac:         ac ? parseInt(ac) : null,
      hitDie:     hitDie.trim(),
      speed:      speed.trim(),
      profBonus:  profBonus.trim(),
      initiative: dexMod(parseInt(dex) || 10),
      abilityScores: {
        str: parseInt(str)||10, dex: parseInt(dex)||10, con: parseInt(con)||10,
        int: parseInt(int_)||10, wis: parseInt(wis)||10, cha: parseInt(cha)||10,
      },
      resistances, immunities, conditionImmunities: condImm,
      actions, traits, senses: senses.trim(),
      category, source: 'custom',
    })
    onClose()
  }

  // Actions helpers
  const addAction    = () => setActions(a => [...a, { name: '', toHit: '', damage: '', damageType: '', desc: '' }])
  const removeAction = i  => setActions(a => a.filter((_, idx) => idx !== i))
  const updateAction = (i, field, val) => setActions(a => a.map((x, idx) => idx === i ? { ...x, [field]: val } : x))

  // Traits helpers
  const addTrait    = () => setTraits(t => [...t, { name: '', desc: '' }])
  const removeTrait = i  => setTraits(t => t.filter((_, idx) => idx !== i))
  const updateTrait = (i, field, val) => setTraits(t => t.map((x, idx) => idx === i ? { ...x, [field]: val } : x))

  // Inline tag add
  const commitTag = (setter) => {
    if (tagDraft.trim()) setter(a => [...a, tagDraft.trim()])
    setTagAdding(null)
    setTagDraft('')
  }

  return createPortal(
    <div className="cv-modal-overlay" onClick={onClose}>
      <div className="cv-modal-sheet npc-modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="cv-modal-handle" />

        {/* ══ SEARCH VIEW ══ */}
        {view === 'search' && (
          <>
            <div className="npc-modal-title">Add NPC / Enemy</div>
            <div className="npc-modal-sub">Search the SRD and your campaign library, or create a custom NPC.</div>

            <input
              className="cv-input"
              placeholder="Search monsters, NPCs… e.g. Goblin, Veteran…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
              style={{ marginBottom: 8 }}
            />

            <div className="npc-source-chips">
              {[['all','All sources'],['srd','SRD only'],['campaign','My campaign']].map(([val, label]) => (
                <button
                  key={val}
                  className={`npc-source-chip${sourceFilter === val ? ' npc-source-chip--active' : ''}`}
                  onClick={() => setSourceFilter(val)}
                >{label}</button>
              ))}
            </div>

            {query.trim() && (
              <div className="npc-search-results">
                {loadingSrd && showSrd && <div className="npc-search-hint">Loading SRD…</div>}

                {showSrd && filteredSrd.map(m => (
                  <div key={m.index} className="npc-search-row">
                    <div className="npc-sr-icon">👺</div>
                    <div className="npc-sr-info">
                      <div className="npc-sr-name">{m.name}</div>
                      <div className="npc-sr-meta">
                        {m.type} · CR {formatCR(m.challenge_rating)} · {m.hit_points} HP · AC {m.armor_class?.[0]?.value} · Init {dexMod(m.dexterity) >= 0 ? '+' : ''}{dexMod(m.dexterity)}
                      </div>
                    </div>
                    <span className="npc-sr-badge npc-sr-badge--srd">SRD</span>
                    <div className="npc-sr-btns">
                      {m.challenge_rating >= 4 && (
                        <button className="npc-add-btn npc-add-btn--boss" onClick={() => addFromSrd(m, 'boss')}>Boss</button>
                      )}
                      <button className="npc-add-btn npc-add-btn--enemy" onClick={() => addFromSrd(m, 'standard')}>Enemy</button>
                      <button className="npc-add-btn npc-add-btn--ally"  onClick={() => addFromSrd(m, 'ally')}>Ally</button>
                    </div>
                  </div>
                ))}

                {showCampaign && filteredCampaign.map(n => (
                  <div key={n.npcId} className="npc-search-row">
                    <div className="npc-sr-icon">{n.category === 'boss' ? '👑' : n.category === 'ally' ? '🤝' : '👺'}</div>
                    <div className="npc-sr-info">
                      <div className="npc-sr-name">{n.name}</div>
                      <div className="npc-sr-meta">
                        Custom{n.type ? ` · ${n.type}` : ''}{n.cr ? ` · CR ${n.cr}` : ''}{n.hp ? ` · ${n.hp} HP` : ''}
                      </div>
                    </div>
                    <span className="npc-sr-badge npc-sr-badge--campaign">Campaign</span>
                    <div className="npc-sr-btns">
                      <button className="npc-add-btn npc-add-btn--boss"  onClick={() => addFromCampaign(n, 'boss')}>Boss</button>
                      <button className="npc-add-btn npc-add-btn--enemy" onClick={() => addFromCampaign(n, 'standard')}>Enemy</button>
                      <button className="npc-add-btn npc-add-btn--ally"  onClick={() => addFromCampaign(n, 'ally')}>Ally</button>
                    </div>
                  </div>
                ))}

                {!loadingSrd && filteredSrd.length === 0 && filteredCampaign.length === 0 && (
                  <div className="npc-search-hint">No results for "{query}"</div>
                )}
              </div>
            )}

            <button className="npc-create-link" onClick={() => setView('create')}>
              + Can't find what you need? Create a custom NPC →
            </button>
          </>
        )}

        {/* ══ CREATE VIEW ══ */}
        {view === 'create' && (
          <>
            <button className="npc-back-btn" onClick={() => setView('search')}>← Back to Search</button>
            <div className="npc-modal-title">Create NPC</div>
            <div className="npc-modal-sub">
              {createMode === 'quick' ? 'Quick mode for standard enemies.' : 'Full stat block for bosses and named NPCs.'}
            </div>

            <div className="npc-mode-toggle">
              <button className={`npc-mode-btn${createMode === 'quick' ? ' npc-mode-btn--active' : ''}`} onClick={() => setCreateMode('quick')}>⚡ Quick</button>
              <button className={`npc-mode-btn${createMode === 'full'  ? ' npc-mode-btn--active' : ''}`} onClick={() => setCreateMode('full')}>📋 Full Stat Block</button>
            </div>

            {/* ── Quick mode ── */}
            {createMode === 'quick' && (
              <>
                <label className="cv-label">Name *</label>
                <input className="cv-input" placeholder="e.g. Goblin Shaman" value={name} onChange={e => setName(e.target.value)} autoFocus />

                <div className="npc-grid-3" style={{ marginTop: 10 }}>
                  <div><label className="cv-label">Max HP</label><input className="cv-input" type="number" placeholder="18" value={hp} onChange={e => setHp(e.target.value)} /></div>
                  <div><label className="cv-label">AC</label><input className="cv-input" type="number" placeholder="13" value={ac} onChange={e => setAc(e.target.value)} /></div>
                  <div><label className="cv-label">Initiative</label><input className="cv-input" type="number" placeholder="+2" value={initiative} onChange={e => setInit(e.target.value)} /></div>
                  <div><label className="cv-label">CR</label><input className="cv-input" placeholder="½" value={cr} onChange={e => setCr(e.target.value)} /></div>
                  <div><label className="cv-label">Speed</label><input className="cv-input" placeholder="30ft" value={speed} onChange={e => setSpeed(e.target.value)} /></div>
                  <div>
                    <label className="cv-label">Type</label>
                    <select className="cv-input" value={type} onChange={e => setType(e.target.value)}>
                      {CREATURE_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <label className="cv-label" style={{ marginTop: 8 }}>Actions / Notes</label>
                <textarea className="cv-input" rows={3} placeholder="e.g. Scimitar +4, 1d6+2 slashing." value={quickNotes} onChange={e => setQuickNotes(e.target.value)} style={{ resize: 'vertical', lineHeight: '1.5' }} />

                <div className="cv-input-row" style={{ marginTop: 8 }}>
                  <div>
                    <label className="cv-label">Add to campaign as</label>
                    <select className="cv-input" value={category} onChange={e => setCategory(e.target.value)}>
                      <option value="standard">Standard Enemy</option>
                      <option value="boss">Boss / Named NPC</option>
                      <option value="ally">Ally NPC</option>
                    </select>
                  </div>
                  <div>
                    <label className="cv-label">Hit Die</label>
                    <input className="cv-input" placeholder="e.g. 2d8+2" value={hitDie} onChange={e => setHitDie(e.target.value)} />
                  </div>
                </div>
              </>
            )}

            {/* ── Full stat block mode ── */}
            {createMode === 'full' && (
              <>
                {/* Identity */}
                <div className="npc-form-section">
                  <div className="npc-sec-lbl">Identity</div>
                  <label className="cv-label">Name *</label>
                  <input className="cv-input" placeholder="e.g. Gorthak, Orc Warchief" value={name} onChange={e => setName(e.target.value)} autoFocus />
                  <div className="npc-grid-3" style={{ marginTop: 8 }}>
                    <div>
                      <label className="cv-label">Size</label>
                      <select className="cv-input" value={size} onChange={e => setSize(e.target.value)}>
                        {['Tiny','Small','Medium','Large','Huge','Gargantuan'].map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="cv-label">Type</label>
                      <select className="cv-input" value={type} onChange={e => setType(e.target.value)}>
                        {CREATURE_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="cv-label">Alignment</label>
                      <input className="cv-input" placeholder="Chaotic Evil" value={alignment} onChange={e => setAlignment(e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Core stats */}
                <div className="npc-form-section">
                  <div className="npc-sec-lbl">Core Stats</div>
                  <div className="npc-grid-3">
                    <div><label className="cv-label">AC</label><input className="cv-input" type="number" placeholder="15" value={ac} onChange={e => setAc(e.target.value)} /></div>
                    <div><label className="cv-label">Max HP</label><input className="cv-input" type="number" placeholder="93" value={hp} onChange={e => setHp(e.target.value)} /></div>
                    <div><label className="cv-label">Hit Die</label><input className="cv-input" placeholder="11d8+44" value={hitDie} onChange={e => setHitDie(e.target.value)} /></div>
                    <div><label className="cv-label">Speed</label><input className="cv-input" placeholder="30ft" value={speed} onChange={e => setSpeed(e.target.value)} /></div>
                    <div><label className="cv-label">CR</label><input className="cv-input" placeholder="4" value={cr} onChange={e => setCr(e.target.value)} /></div>
                    <div><label className="cv-label">Prof Bonus</label><input className="cv-input" placeholder="+2" value={profBonus} onChange={e => setProfBonus(e.target.value)} /></div>
                  </div>
                </div>

                {/* Ability scores */}
                <div className="npc-form-section">
                  <div className="npc-sec-lbl">Ability Scores</div>
                  <div className="npc-ability-grid">
                    {[['STR',str,setStr],['DEX',dex,setDex],['CON',con,setCon],['INT',int_,setInt],['WIS',wis,setWis],['CHA',cha,setCha]].map(([label, val, setter]) => (
                      <div key={label} className="npc-ability-tile">
                        <div className="npc-ability-lbl">{label}</div>
                        <input className="cv-input npc-ability-input" type="number" min="1" max="30" value={val} onChange={e => setter(e.target.value)} />
                        <div className="npc-ability-mod">{abilityMod(val)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Resistances & Immunities */}
                <div className="npc-form-section">
                  <div className="npc-sec-lbl">Resistances &amp; Immunities</div>
                  {[
                    ['Damage Resistances', resistances, setResistances, 'res'],
                    ['Damage Immunities',  immunities,  setImmunities,  'imm'],
                    ['Condition Immunities', condImm,   setCondImm,     'cond'],
                  ].map(([label, arr, setter, key]) => (
                    <div key={key} className="npc-tag-section">
                      <label className="cv-label">{label}</label>
                      <div className="npc-tag-row">
                        {arr.map((tag, i) => (
                          <span key={i} className="npc-tag">
                            {tag}
                            <button onClick={() => setter(a => a.filter((_, idx) => idx !== i))}>✕</button>
                          </span>
                        ))}
                        {tagAdding === key ? (
                          <input
                            className="npc-tag-input"
                            autoFocus
                            value={tagDraft}
                            placeholder="e.g. Fire"
                            onChange={e => setTagDraft(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') commitTag(setter); if (e.key === 'Escape') { setTagAdding(null); setTagDraft('') } }}
                            onBlur={() => commitTag(setter)}
                          />
                        ) : (
                          <button className="npc-add-tag" onClick={() => { setTagAdding(key); setTagDraft('') }}>+ Add</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="npc-form-section">
                  <div className="npc-sec-lbl">Actions</div>
                  {actions.map((a, i) => (
                    <div key={i} className="npc-action-entry">
                      <div className="npc-action-entry-head">
                        <input className="cv-input" placeholder="Action name" value={a.name} onChange={e => updateAction(i, 'name', e.target.value)} style={{ fontWeight: 700 }} />
                        <button className="npc-del-btn" onClick={() => removeAction(i)}>✕</button>
                      </div>
                      <div className="npc-grid-3" style={{ marginTop: 6 }}>
                        <div><label className="cv-label">To Hit</label><input className="cv-input" placeholder="+5" value={a.toHit} onChange={e => updateAction(i, 'toHit', e.target.value)} /></div>
                        <div><label className="cv-label">Damage</label><input className="cv-input" placeholder="1d8+3" value={a.damage} onChange={e => updateAction(i, 'damage', e.target.value)} /></div>
                        <div><label className="cv-label">Type</label><input className="cv-input" placeholder="Slashing" value={a.damageType} onChange={e => updateAction(i, 'damageType', e.target.value)} /></div>
                      </div>
                      <input className="cv-input" placeholder="Description / additional effect…" value={a.desc} onChange={e => updateAction(i, 'desc', e.target.value)} style={{ marginTop: 6 }} />
                    </div>
                  ))}
                  <button className="npc-add-row" onClick={addAction}>+ Add Action</button>
                </div>

                {/* Traits */}
                <div className="npc-form-section">
                  <div className="npc-sec-lbl">Traits</div>
                  {traits.map((t, i) => (
                    <div key={i} className="npc-action-entry">
                      <div className="npc-action-entry-head">
                        <input className="cv-input" placeholder="Trait name" value={t.name} onChange={e => updateTrait(i, 'name', e.target.value)} style={{ fontWeight: 700 }} />
                        <button className="npc-del-btn" onClick={() => removeTrait(i)}>✕</button>
                      </div>
                      <input className="cv-input" placeholder="Description" value={t.desc} onChange={e => updateTrait(i, 'desc', e.target.value)} style={{ marginTop: 6 }} />
                    </div>
                  ))}
                  <button className="npc-add-row" onClick={addTrait}>+ Add Trait</button>
                </div>

                {/* Campaign */}
                <div className="npc-form-section">
                  <div className="npc-sec-lbl">Campaign</div>
                  <div className="cv-input-row">
                    <div>
                      <label className="cv-label">Add to campaign as</label>
                      <select className="cv-input" value={category} onChange={e => setCategory(e.target.value)}>
                        <option value="standard">Standard Enemy</option>
                        <option value="boss">Boss / Named NPC</option>
                        <option value="ally">Ally NPC</option>
                      </select>
                    </div>
                    <div>
                      <label className="cv-label">Senses</label>
                      <input className="cv-input" placeholder="e.g. Darkvision 60ft" value={senses} onChange={e => setSenses(e.target.value)} />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="cv-modal-actions">
              <button className="cv-btn cv-btn--ghost" onClick={onClose}>Cancel</button>
              <button
                className="cv-btn cv-btn--dm"
                onClick={createMode === 'quick' ? submitQuick : submitFull}
                disabled={!name.trim()}
              >Save NPC</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── Note Section ──────────────────────────────────────────────
function NoteSection({ section, onChange, onDelete, locked }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={`note-section${collapsed ? ' note-section--collapsed' : ''}`}>
      <div className="note-section-head">
        <div className="note-section-label">{section.title}</div>
        {!locked && (
          <button className="note-delete-btn" onClick={() => onDelete(section.id)}>✕</button>
        )}
        <button className="note-chevron-btn" onClick={() => setCollapsed(c => !c)}>
          {collapsed ? '▸' : '▾'}
        </button>
      </div>
      {!collapsed && (
        <textarea
          className="note-textarea"
          value={section.content}
          onChange={e => onChange(section.id, e.target.value)}
          placeholder={`${section.title}…`}
          rows={4}
        />
      )}
    </div>
  )
}

// ── Start Session Modal ───────────────────────────────────────
function StartSessionModal({ sessionNumber, onStart, onClose }) {
  const [name, setName] = useState(`Session ${sessionNumber}`)

  return createPortal(
    <div className="cv-modal-overlay" onClick={onClose}>
      <div className="cv-modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="cv-modal-handle" />
        <div className="cv-modal-title">Start Session {sessionNumber}</div>
        <label className="cv-label">Session name</label>
        <input
          className="cv-input"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onStart(name)}
          autoFocus
        />
        <div className="cv-modal-actions">
          <button className="cv-btn cv-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="cv-btn cv-btn--dm" onClick={() => onStart(name)}>Start →</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ════════════════════════════════════════════════════════════════
//  Main CampaignView
// ════════════════════════════════════════════════════════════════
export default function CampaignView({ token, user, campaign, onBack, onOpenSession }) {
  const [tab, setTab]             = useState('sessions')
  const [sessions, setSessions]   = useState([])
  const [party, setParty]         = useState([])
  const [npcs, setNpcs]           = useState([])
  const [notes, setNotes]         = useState(null)
  const [meta, setMeta]           = useState(campaign)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)

  // Modals
  const [showStartSession, setShowStartSession] = useState(false)
  const [showManagePlayer, setShowManagePlayer] = useState(null)  // player obj or 'new'
  const [showAddNPC, setShowAddNPC]             = useState(false)

  const octokit  = new Octokit({ auth: token })
  const slug     = campaign.slug
  const basePath = campaignPath(slug)

  // ── Load all campaign files ──
  useEffect(() => { loadAll() }, [])

  const loadFile = async (filename) => {
    try {
      const { data } = await octokit.repos.getContent({
        owner: user.login, repo: CAMPAIGNS_REPO,
        path: `${basePath}/${filename}`,
      })
      return { data: decode(data.content), sha: data.sha }
    } catch {
      return { data: null, sha: null }
    }
  }

  const loadAll = async () => {
    setLoading(true)
    const [s, p, n, no] = await Promise.all([
      loadFile('sessions.json'),
      loadFile('party.json'),
      loadFile('npcs.json'),
      loadFile('notes.json'),
    ])
    setSessions(s.data?.sessions ?? [])
    setParty(p.data?.players ?? [])
    setNpcs(n.data?.npcs ?? [])
    setNotes(no.data ?? {
      sections: [
        { id: 'world',  title: 'World & Lore',       content: '', locked: true },
        { id: 'plot',   title: 'Plot Threads',        content: '', locked: true },
        { id: 'dm',     title: 'DM Notes (Private)',  content: '', locked: true, private: true },
      ]
    })
    setLoading(false)
  }

  const saveFile = async (filename, data) => {
    setSaving(true)
    try {
      let sha
      try {
        const { data: existing } = await octokit.repos.getContent({
          owner: user.login, repo: CAMPAIGNS_REPO,
          path: `${basePath}/${filename}`,
        })
        sha = existing.sha
      } catch { /* new file */ }

      await octokit.repos.createOrUpdateFileContents({
        owner:   user.login,
        repo:    CAMPAIGNS_REPO,
        path:    `${basePath}/${filename}`,
        message: `Update ${filename}`,
        content: encode(data),
        ...(sha ? { sha } : {}),
      })
    } catch (e) {
      console.error('Save failed:', e)
    }
    setSaving(false)
  }

  // ── Sessions tab actions ──
  const startSession = async (name) => {
    const newSession = {
      sessionId:   genId(),
      name,
      number:      sessions.length + 1,
      date:        new Date().toISOString(),
      status:      'live',
      duration:    0,
      players:     [],
      encounters:  [],
    }
    const updated = [newSession, ...sessions]
    setSessions(updated)
    await saveFile('sessions.json', { sessions: updated })
    setShowStartSession(false)
    onOpenSession(newSession, campaign)
  }

  // ── Party tab actions ──
  const handleManageSave = async (github, characters) => {
    const updated = [...party]
    const idx = updated.findIndex(p => p.github === github)
    if (idx >= 0) {
      updated[idx] = { ...updated[idx], characters }
    } else {
      updated.push({ github, characters })
    }
    setParty(updated)
    await saveFile('party.json', { players: updated })
    setShowManagePlayer(null)
  }

  const toggleCharActive = async (github, characterId) => {
    const updated = party.map(p => {
      if (p.github !== github) return p
      return {
        ...p,
        characters: p.characters.map(c =>
          c.characterId === characterId ? { ...c, active: !c.active } : c
        )
      }
    })
    setParty(updated)
    await saveFile('party.json', { players: updated })
  }

  // ── NPC tab actions ──
  const addNPC = async (npc) => {
    const updated = [...npcs, npc]
    setNpcs(updated)
    await saveFile('npcs.json', { npcs: updated })
  }

  const deleteNPC = async (npcId) => {
    const updated = npcs.filter(n => n.npcId !== npcId)
    setNpcs(updated)
    await saveFile('npcs.json', { npcs: updated })
  }

  // ── Notes tab actions ──
  const updateNote = useCallback(async (id, content) => {
    setNotes(prev => {
      const updated = {
        ...prev,
        sections: prev.sections.map(s => s.id === id ? { ...s, content } : s)
      }
      saveFile('notes.json', updated)
      return updated
    })
  }, [])

  const addNoteSection = () => {
    const newSection = { id: genId(), title: 'New Section', content: '', locked: false }
    const updated = { ...notes, sections: [...notes.sections, newSection] }
    setNotes(updated)
    saveFile('notes.json', updated)
  }

  const deleteNoteSection = (id) => {
    const updated = { ...notes, sections: notes.sections.filter(s => s.id !== id) }
    setNotes(updated)
    saveFile('notes.json', updated)
  }

  // ── Stats for sidebar ──
  const activePlayerCount = party.reduce((sum, p) =>
    sum + (p.characters?.filter(c => c.active).length ?? 0), 0
  )
  const allLevels = party.flatMap(p =>
    (p.characters ?? []).filter(c => c.active).map(c => c.level ?? 1)
  )
  const avgLevel = allLevels.length
    ? Math.round(allLevels.reduce((a, b) => a + b, 0) / allLevels.length)
    : null
  const totalEncounters = sessions.reduce((sum, s) => sum + (s.encounters?.length ?? 0), 0)
  const liveSession = sessions.find(s => s.status === 'live')

  // ── Grouped NPCs ──
  const bosses   = npcs.filter(n => n.category === 'boss')
  const enemies  = npcs.filter(n => n.category === 'standard')
  const allies   = npcs.filter(n => n.category === 'ally')

  return (
    <div className="app-page app-page--full">
    <div className="app-container app-container--wide app-container--dm app-container--full-height cv-layout">
      {/* ── Left sidebar ── */}
      <aside className="cv-sidebar">
        <div className="cv-sidebar-top">
          <button className="cv-back-btn" onClick={onBack}>← Campaigns</button>
          <div className="cv-campaign-name">
            <span className="cv-campaign-emoji">{campaign.emoji}</span>
            <span>{campaign.name}</span>
          </div>
        </div>

        {/* Live session card */}
        {liveSession && (
          <div className="sidebar-live-card">
            <div className="sidebar-live-header">
              <span className="live-pulse-dot" />
              <span className="sidebar-live-label">Live Session</span>
            </div>
            <div className="sidebar-live-session">{liveSession.name}</div>
            <button className="sidebar-resume-btn" onClick={() => onOpenSession(liveSession, campaign)}>
              ▶ Resume
            </button>
          </div>
        )}

        {/* Campaign stats */}
        <div className="sidebar-stats">
          <div className="sidebar-stat">
            <span className="sidebar-stat-val">{sessions.length}</span>
            <span className="sidebar-stat-label">Sessions</span>
          </div>
          <div className="sidebar-stat">
            <span className="sidebar-stat-val">{party.length}</span>
            <span className="sidebar-stat-label">Players</span>
          </div>
          <div className="sidebar-stat">
            <span className="sidebar-stat-val">{avgLevel ?? '—'}</span>
            <span className="sidebar-stat-label">Avg Level</span>
          </div>
          <div className="sidebar-stat">
            <span className="sidebar-stat-val">{totalEncounters}</span>
            <span className="sidebar-stat-label">Encounters</span>
          </div>
          <div className="sidebar-stat">
            <span className="sidebar-stat-val">{activePlayerCount}</span>
            <span className="sidebar-stat-label">Active PCs</span>
          </div>
        </div>
      </aside>

      {/* ── Main panel ── */}
      <div className="cv-main">
        {/* Tab bar */}
        <div className="cv-tab-bar">
          {[
            { id: 'sessions', label: '📋 Sessions' },
            { id: 'party',    label: '👥 Party' },
            { id: 'npcs',     label: '👺 NPCs' },
            { id: 'notes',    label: '📝 Notes' },
          ].map(t => (
            <button
              key={t.id}
              className={`cv-tab${tab === t.id ? ' cv-tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >{t.label}</button>
          ))}
          {saving && <span className="cv-saving">Saving…</span>}
        </div>

        <div className="cv-tab-content">
          {loading ? (
            <div className="cv-loading"><div className="cv-spinner" />Loading…</div>
          ) : (

            <>
              {/* ── SESSIONS TAB ── */}
              {tab === 'sessions' && (
                <div className="cv-section">
                  {sessions.length === 0 && (
                    <div className="cv-empty">
                      <div className="cv-empty-icon">📋</div>
                      <div className="cv-empty-title">No sessions yet</div>
                      <div className="cv-empty-sub">Start your first session to begin tracking</div>
                    </div>
                  )}

                  {[...sessions]
                    .sort((a, b) => b.number - a.number)
                    .map((session, i) => (
                      <SessionRow
                        key={session.sessionId}
                        session={session}
                        index={sessions.length - 1 - i}
                        onOpen={(s) => onOpenSession(s, campaign)}
                      />
                    ))
                  }

                  <button className="start-session-btn" onClick={() => setShowStartSession(true)}>
                    + Start Session {sessions.length + 1}
                  </button>
                </div>
              )}

              {/* ── PARTY TAB ── */}
              {tab === 'party' && (
                <div className="cv-section">
                  {party.length === 0 && (
                    <div className="cv-empty">
                      <div className="cv-empty-icon">👥</div>
                      <div className="cv-empty-title">No players yet</div>
                      <div className="cv-empty-sub">Add players to start tracking their characters</div>
                    </div>
                  )}

                  {party.map(player => (
                    <PlayerBlock
                      key={player.github}
                      player={player}
                      onToggleCharActive={toggleCharActive}
                      onManage={p => setShowManagePlayer(p)}
                    />
                  ))}

                  <button className="add-player-btn" onClick={() => setShowManagePlayer('new')}>
                    + Add Player
                  </button>
                </div>
              )}

              {/* ── NPCS TAB ── */}
              {tab === 'npcs' && (
                <div className="cv-section">
                  {/* Bosses */}
                  {bosses.length > 0 && (
                    <>
                      <div className="npc-category-head npc-category-head--boss">👑 Bosses & Named NPCs</div>
                      {bosses.map(npc => <NPCRow key={npc.npcId} npc={npc} onDelete={deleteNPC} />)}
                    </>
                  )}

                  {/* Standard enemies */}
                  {enemies.length > 0 && (
                    <>
                      <div className="npc-category-head">👺 Standard Enemies</div>
                      {enemies.map(npc => <NPCRow key={npc.npcId} npc={npc} onDelete={deleteNPC} />)}
                    </>
                  )}

                  {/* Allies */}
                  {allies.length > 0 && (
                    <>
                      <div className="npc-category-head npc-category-head--ally">🤝 Ally NPCs</div>
                      {allies.map(npc => <NPCRow key={npc.npcId} npc={npc} onDelete={deleteNPC} />)}
                    </>
                  )}

                  {npcs.length === 0 && (
                    <div className="cv-empty">
                      <div className="cv-empty-icon">👺</div>
                      <div className="cv-empty-title">No NPCs yet</div>
                      <div className="cv-empty-sub">Add monsters and NPCs for your campaign</div>
                    </div>
                  )}

                  <button className="add-player-btn" onClick={() => setShowAddNPC(true)}>+ Add NPC / Monster</button>
                </div>
              )}

              {/* ── NOTES TAB ── */}
              {tab === 'notes' && notes && (
                <div className="cv-section">
                  {notes.sections.map(section => (
                    <NoteSection
                      key={section.id}
                      section={section}
                      onChange={updateNote}
                      onDelete={deleteNoteSection}
                      locked={section.locked}
                    />
                  ))}
                  <button className="add-player-btn" onClick={addNoteSection}>+ Add Section</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {showStartSession && (
        <StartSessionModal
          sessionNumber={sessions.length + 1}
          onStart={startSession}
          onClose={() => setShowStartSession(false)}
        />
      )}

      {showManagePlayer && (
        <ManageCharsModal
          token={token}
          player={showManagePlayer === 'new' ? null : showManagePlayer}
          campaign={campaign}
          onSave={handleManageSave}
          onClose={() => setShowManagePlayer(null)}
        />
      )}

      {showAddNPC && (
        <AddNPCModal
          campaignNpcs={npcs}
          onAdd={addNPC}
          onClose={() => setShowAddNPC(false)}
        />
      )}
    </div>
    </div>
  )
}

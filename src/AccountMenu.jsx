import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './AccountMenu.css'

const THEME_STORAGE_KEY = 'ttrpg_theme'

const SAMPLE_THEMES = [
  {
    id: 'dungeon',
    name: 'Dungeon',
    description: 'Deep violet stone and cool arcane light.',
    vars: {
      '--bg-page': '#080712',
      '--bg-base': '#0e0d1a',
      '--bg-surface': '#13122a',
      '--bg-elevated': '#1c1b35',
      '--bg-inset': '#0a0915',
      '--border': '#26244a',
      '--border-strong': '#36336a',
      '--border-hi': '#4a4880',
      '--text-primary': '#eeedf8',
      '--text-secondary': '#8885aa',
      '--text-muted': '#45426a',
      '--text-inverse': '#0e0d1a',
      '--accent': '#7c6ff5',
      '--accent-hover': '#9b90ff',
      '--accent-secondary': '#5550cc',
      '--dm': '#e05252',
      '--dm-hover': '#f07070',
    },
  },
  {
    id: 'moonlit',
    name: 'Moonlit',
    description: 'Ink blue surfaces with silver text and bright sapphire action.',
    vars: {
      '--bg-page': '#070b13',
      '--bg-base': '#0c1220',
      '--bg-surface': '#121a2b',
      '--bg-elevated': '#1b2638',
      '--bg-inset': '#080d18',
      '--border': '#24324a',
      '--border-strong': '#38506f',
      '--border-hi': '#54708f',
      '--text-primary': '#eef6ff',
      '--text-secondary': '#9bb0c8',
      '--text-muted': '#52667c',
      '--text-inverse': '#06101c',
      '--accent': '#5da9ff',
      '--accent-hover': '#8fc4ff',
      '--accent-secondary': '#3476c7',
      '--dm': '#e85b6a',
      '--dm-hover': '#ff7e8d',
    },
  },
  {
    id: 'grove',
    name: 'Grove',
    description: 'Dark moss, bark borders, and clear emerald highlights.',
    vars: {
      '--bg-page': '#07100c',
      '--bg-base': '#0d1912',
      '--bg-surface': '#132219',
      '--bg-elevated': '#1b2f23',
      '--bg-inset': '#08130d',
      '--border': '#25402f',
      '--border-strong': '#3d6049',
      '--border-hi': '#5c7d63',
      '--text-primary': '#edf8ef',
      '--text-secondary': '#a4bca9',
      '--text-muted': '#5d725f',
      '--text-inverse': '#07100c',
      '--accent': '#55c98a',
      '--accent-hover': '#80e2aa',
      '--accent-secondary': '#319060',
      '--dm': '#d85d58',
      '--dm-hover': '#ef8178',
    },
  },
  {
    id: 'ember',
    name: 'Ember',
    description: 'Charcoal, warm steel, and forge-orange player accents.',
    vars: {
      '--bg-page': '#100b08',
      '--bg-base': '#19110d',
      '--bg-surface': '#231914',
      '--bg-elevated': '#32231b',
      '--bg-inset': '#0c0806',
      '--border': '#463228',
      '--border-strong': '#6b4938',
      '--border-hi': '#91654c',
      '--text-primary': '#fff2e8',
      '--text-secondary': '#c4a999',
      '--text-muted': '#765f52',
      '--text-inverse': '#120b07',
      '--accent': '#f28b50',
      '--accent-hover': '#ffad7a',
      '--accent-secondary': '#bf6537',
      '--dm': '#d84f5b',
      '--dm-hover': '#ef7580',
    },
  },
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Blackened teal with violet player magic and coral DM mode.',
    vars: {
      '--bg-page': '#06100f',
      '--bg-base': '#0a1717',
      '--bg-surface': '#102525',
      '--bg-elevated': '#173534',
      '--bg-inset': '#061211',
      '--border': '#214644',
      '--border-strong': '#376a67',
      '--border-hi': '#52918c',
      '--text-primary': '#eafffb',
      '--text-secondary': '#9bc7c0',
      '--text-muted': '#557b77',
      '--text-inverse': '#06100f',
      '--accent': '#b384ff',
      '--accent-hover': '#cdb0ff',
      '--accent-secondary': '#7e5fc2',
      '--dm': '#f16f64',
      '--dm-hover': '#ff9489',
    },
  },
]

function hexToRgb(value) {
  const hex = value.replace('#', '')
  const normalized = hex.length === 3
    ? hex.split('').map(char => char + char).join('')
    : hex
  const parsed = parseInt(normalized, 16)
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  }
}

function rgba(value, alpha) {
  const { r, g, b } = hexToRgb(value)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function applyTheme(theme) {
  const root = document.documentElement
  root.setAttribute('data-theme', theme.id)
  Object.entries(theme.vars).forEach(([key, value]) => root.style.setProperty(key, value))
  root.style.setProperty('--accent-subtle', rgba(theme.vars['--accent'], 0.15))
  root.style.setProperty('--accent-bg', rgba(theme.vars['--accent'], 0.15))
  root.style.setProperty('--accent-border', theme.vars['--accent-secondary'])
  root.style.setProperty('--accent-light', theme.vars['--accent-hover'])
  root.style.setProperty('--accent-glow', `0 8px 28px ${rgba(theme.vars['--accent'], 0.2)}`)
  root.style.setProperty('--dm-subtle', rgba(theme.vars['--dm'], 0.12))
  root.style.setProperty('--dm-border', rgba(theme.vars['--dm'], 0.38))
  root.style.setProperty('--dm-glow', `0 8px 28px ${rgba(theme.vars['--dm'], 0.15)}`)
  root.style.setProperty('--bg-deep', theme.vars['--bg-page'])
  root.style.setProperty('--bg-raised', theme.vars['--bg-surface'])
  root.style.setProperty('--bg-input', theme.vars['--bg-inset'])
  root.style.setProperty('--border-mid', theme.vars['--border-strong'])
  root.style.setProperty('--text-faint', theme.vars['--text-muted'])
  root.style.setProperty('--tab-active-bg', theme.vars['--bg-elevated'])
  root.style.setProperty('--tab-active-text', theme.vars['--text-primary'])
  root.style.setProperty('--tab-inactive-text', theme.vars['--text-muted'])
  root.style.setProperty('--spell-slot-filled', theme.vars['--accent'])
  root.style.setProperty('--spell-slot-empty', theme.vars['--border'])
  root.style.setProperty('--hp-bg', theme.vars['--bg-surface'])
  root.style.setProperty('--hp-border', theme.vars['--border-strong'])
  root.style.setProperty('--hp-text', theme.vars['--text-primary'])
  root.style.setProperty('--hp-muted', theme.vars['--text-secondary'])
  root.style.setProperty('--hp-btn-bg', theme.vars['--bg-elevated'])
  root.style.setProperty('--hp-btn-bdr', theme.vars['--border-strong'])
  root.style.setProperty('--hp-btn-txt', theme.vars['--text-primary'])
}

function currentThemeId() {
  return localStorage.getItem(THEME_STORAGE_KEY) || 'dungeon'
}

export default function AccountMenu({ user, mode = 'player', onLogout }) {
  const [open, setOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [themeId, setThemeId] = useState(currentThemeId)
  const menuRef = useRef(null)
  const isDM = mode === 'dm'

  useEffect(() => {
    const theme = SAMPLE_THEMES.find(item => item.id === themeId) ?? SAMPLE_THEMES[0]
    applyTheme(theme)
  }, [themeId])

  useEffect(() => {
    if (!open) return undefined
    const closeOnPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnPointerDown)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const openSettings = () => {
    setOpen(false)
    setShowSettings(true)
  }

  const selectTheme = (id) => {
    const theme = SAMPLE_THEMES.find(item => item.id === id)
    if (!theme) return
    localStorage.setItem(THEME_STORAGE_KEY, id)
    setThemeId(id)
  }

  const selectedTheme = SAMPLE_THEMES.find(item => item.id === themeId) ?? SAMPLE_THEMES[0]

  return (
    <>
      <div className={`account-menu${isDM ? ' account-menu--dm' : ''}`} ref={menuRef}>
        <button
          className="account-trigger"
          type="button"
          onClick={() => setOpen(value => !value)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Open account menu"
        >
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" className="account-avatar" />
          ) : (
            <span className="account-avatar account-avatar--initial">{user.login[0].toUpperCase()}</span>
          )}
        </button>

        {open && (
          <div className="account-popover" role="menu">
            <button className="account-menu-item" type="button" role="menuitem" onClick={openSettings}>
              Settings
            </button>
            <button className="account-menu-item account-menu-item--danger" type="button" role="menuitem" onClick={onLogout}>
              Log out
            </button>
          </div>
        )}
      </div>

      {showSettings && createPortal(
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-modal" onClick={event => event.stopPropagation()}>
            <div className="settings-body">
              <div>
                <div className="settings-kicker">{isDM ? 'DM' : 'Player'} Settings</div>
                <h2 className="settings-title">Settings</h2>
              </div>

              <div className="settings-section">
                <div className="settings-section-title">Account</div>
                <div className="settings-row">
                  <div>
                    <div className="settings-row-label">GitHub</div>
                    <div className="settings-row-value">@{user.login}</div>
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-section-title">Appearance</div>
                <div className="settings-row settings-row--stacked">
                  <div>
                    <div className="settings-row-label">Theme</div>
                    <div className="settings-row-value">{selectedTheme.name}</div>
                  </div>

                  <div className="theme-options" role="list" aria-label="Theme options">
                    {SAMPLE_THEMES.map(theme => (
                      <button
                        key={theme.id}
                        className={`theme-option${theme.id === themeId ? ' theme-option--active' : ''}`}
                        type="button"
                        onClick={() => selectTheme(theme.id)}
                        aria-pressed={theme.id === themeId}
                      >
                        <span className="theme-option-strip" aria-hidden="true">
                          <span style={{ background: theme.vars['--bg-base'] }} />
                          <span style={{ background: theme.vars['--bg-surface'] }} />
                          <span style={{ background: theme.vars['--text-primary'] }} />
                          <span style={{ background: theme.vars['--accent'] }} />
                          <span style={{ background: theme.vars['--dm'] }} />
                        </span>
                        <span className="theme-option-meta">
                          <span className="theme-option-name">{theme.name}</span>
                          <span className="theme-option-description">{theme.description}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="settings-footer">
              <button className="settings-close-btn" type="button" onClick={() => setShowSettings(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

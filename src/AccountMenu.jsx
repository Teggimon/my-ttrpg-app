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
  {
    id: 'stonewake',
    name: 'Stonewake',
    description: 'Green-gray stone, pale parchment text, and quiet teal accents.',
    vars: {
      '--bg-page': '#303633',
      '--bg-base': '#303633',
      '--bg-surface': '#556B6D',
      '--bg-elevated': '#698385',
      '--bg-inset': '#303633',
      '--border': '#556B6D',
      '--border-strong': '#698385',
      '--border-hi': '#799496',
      '--text-primary': '#FFFFF2',
      '--text-secondary': '#FFFFF2',
      '--text-muted': '#799496',
      '--text-inverse': '#303633',
      '--accent': '#799496',
      '--accent-hover': '#FFFFF2',
      '--accent-secondary': '#698385',
      '--dm': '#698385',
      '--dm-hover': '#FFFFF2',
    },
  },
  {
    id: 'lime-rift',
    name: 'Lime Rift',
    description: 'Near-black green, mineral teal panels, electric lime, and bright yellow DM mode.',
    vars: {
      '--bg-page': '#000F08',
      '--bg-base': '#000F08',
      '--bg-surface': '#1C3738',
      '--bg-elevated': '#2B494A',
      '--bg-inset': '#000A05',
      '--border': '#1C3738',
      '--border-strong': '#446567',
      '--border-hi': '#668789',
      '--text-primary': '#ECF0F1',
      '--text-secondary': '#B9C5C6',
      '--text-muted': '#6D8587',
      '--text-inverse': '#000F08',
      '--accent': '#CEFF1A',
      '--accent-hover': '#E3FF73',
      '--accent-secondary': '#9FC60F',
      '--dm': '#FFF700',
      '--dm-hover': '#FFF95C',
    },
  },
  {
    id: 'paper-pop',
    name: 'Paper Pop',
    description: 'Charcoal page, paper base, punch-pink surfaces, pale inset, orange action, and plum DM mode.',
    vars: {
      '--bg-page': '#231F20',
      '--bg-base': '#F9F8F8',
      '--bg-surface': '#FF5376',
      '--bg-elevated': '#F8C0C8',
      '--bg-inset': '#F8C0C8',
      '--border': '#D74766',
      '--border-strong': '#B33C58',
      '--border-hi': '#F8C0C8',
      '--text-primary': '#231F20',
      '--text-secondary': '#4C3F43',
      '--text-muted': '#754F5B',
      '--text-inverse': '#F9F8F8',
      '--accent': '#FFA630',
      '--accent-hover': '#FFBE66',
      '--accent-secondary': '#C77816',
      '--dm': '#6B2D5C',
      '--dm-hover': '#8B4A7C',
    },
  },
  {
    id: 'charcoal-candy',
    name: 'Charcoal Candy',
    description: 'Charcoal page and base, graphite surfaces, blush lift, coral action, and mint DM mode.',
    vars: {
      '--bg-page': '#231F20',
      '--bg-base': '#1E1E24',
      '--bg-surface': '#444140',
      '--bg-elevated': '#F8C0C8',
      '--bg-inset': '#1E1E24',
      '--border': '#5A5554',
      '--border-strong': '#7A7070',
      '--border-hi': '#F8C0C8',
      '--text-primary': '#F9F8F8',
      '--text-secondary': '#D9D1D2',
      '--text-muted': '#9B9294',
      '--text-inverse': '#1E1E24',
      '--accent': '#FF6666',
      '--accent-hover': '#FF8A8A',
      '--accent-secondary': '#C54848',
      '--dm': '#4ECDC4',
      '--dm-hover': '#7DE0D9',
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

function relativeLuminance(value) {
  const { r, g, b } = hexToRgb(value)
  const channels = [r, g, b].map(channel => {
    const scaled = channel / 255
    return scaled <= 0.03928
      ? scaled / 12.92
      : ((scaled + 0.055) / 1.055) ** 2.4
  })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

function contrastRatio(first, second) {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second))
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second))
  return (lighter + 0.05) / (darker + 0.05)
}

function contrastText(background, firstText, secondText) {
  return contrastRatio(background, firstText) >= contrastRatio(background, secondText)
    ? firstText
    : secondText
}

function isLight(value) {
  return relativeLuminance(value) > 0.45
}

function applyTheme(theme) {
  const root = document.documentElement
  const hasLightSurface = isLight(theme.vars['--bg-surface'])
  const hasLightElevated = isLight(theme.vars['--bg-elevated'])
  const surfaceTextPrimary = hasLightSurface ? theme.vars['--text-inverse'] : theme.vars['--text-primary']
  const surfaceTextSecondary = hasLightSurface ? theme.vars['--bg-base'] : theme.vars['--text-secondary']
  const surfaceTextMuted = hasLightSurface ? theme.vars['--bg-page'] : theme.vars['--text-muted']
  const elevatedTextPrimary = hasLightElevated ? theme.vars['--text-inverse'] : theme.vars['--text-primary']
  const elevatedTextSecondary = hasLightElevated ? theme.vars['--bg-base'] : theme.vars['--text-secondary']
  const elevatedTextMuted = hasLightElevated ? theme.vars['--bg-page'] : theme.vars['--text-muted']
  root.setAttribute('data-theme', theme.id)
  Object.entries(theme.vars).forEach(([key, value]) => root.style.setProperty(key, value))
  root.style.setProperty('--surface-text-primary', surfaceTextPrimary)
  root.style.setProperty('--surface-text-secondary', surfaceTextSecondary)
  root.style.setProperty('--surface-text-muted', surfaceTextMuted)
  root.style.setProperty('--elevated-text-primary', elevatedTextPrimary)
  root.style.setProperty('--elevated-text-secondary', elevatedTextSecondary)
  root.style.setProperty('--elevated-text-muted', elevatedTextMuted)
  root.style.setProperty('--accent-text', contrastText(theme.vars['--accent'], theme.vars['--text-inverse'], theme.vars['--text-primary']))
  root.style.setProperty('--accent-subtle', rgba(theme.vars['--accent'], 0.15))
  root.style.setProperty('--accent-bg', rgba(theme.vars['--accent'], 0.15))
  root.style.setProperty('--accent-border', theme.vars['--accent-secondary'])
  root.style.setProperty('--accent-light', theme.vars['--accent-hover'])
  root.style.setProperty('--accent-glow', `0 8px 28px ${rgba(theme.vars['--accent'], 0.2)}`)
  root.style.setProperty('--dm-text', contrastText(theme.vars['--dm'], theme.vars['--text-inverse'], theme.vars['--text-primary']))
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
  root.style.setProperty('--tab-inactive-text', hasLightSurface ? surfaceTextMuted : theme.vars['--text-muted'])
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

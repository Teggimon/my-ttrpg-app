# CLAUDE.md — TTRPG Sheet Project

> **Read this file at the start of every session. Re-read the relevant section before touching any feature area.**
> Before writing any code, read the files you are about to modify. Do not code from memory.

---

## 1. What This App Is

A **Progressive Web App** for D&D 5e character sheets with real-time party sync. Characters are stored as JSON files in each player's GitHub repo. The DM polls those files live. There is no backend database — GitHub IS the database.

**Core loop:** Player edits character → debounced auto-save commits to GitHub → GM polls repo every 15–30s → party dashboard updates live.

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Framework | React + Vite |
| PWA | Vite PWA Plugin |
| Styling | Tailwind CSS (mobile first) + CSS custom properties for theming |
| Auth | GitHub OAuth (token stored in `localStorage` as `gh_token`) |
| Data | GitHub REST API via Octokit |
| Real-time | Polling every 15–30 seconds |
| Offline | IndexedDB via `idb` library — edit queue flushed on reconnect |
| Search | Fuse.js — local fuzzy search over cached JSON |
| Hosting | Vercel / Netlify (HTTPS required for PWA) |

**API auth callback:** `/api/auth.js` and `/api/auth/callback.js` — serverless functions handle the GitHub OAuth code exchange.

---

## 3. Key Files — Read Before Modifying

```
src/
  App.jsx                  — root: auth state, screen routing, saveCharacter(), GitHub token
  CharacterLayout.jsx      — character sheet shell: switcher, left panel, tab routing
  CharacterLayout.css      — layout only (portrait vs landscape modes)
  index.css                — global tokens, app-page/app-container shell classes

src/broken/
  CharacterSheet.jsx       — old monolith, kept for reference only. DO NOT use as source of truth.

api/
  auth.js                  — GitHub OAuth token exchange (Vercel serverless)
  auth/callback.js         — OAuth redirect handler

TTRPG Design System.md     — visual spec. Read before any UI work.
TTRPG App Design Brief.md  — feature and data spec. Read before any logic work.
```

**Rule:** If you're editing a component, `read` it first. Do not assume its current state from earlier in the session.

---

## 4. Data Layer — Non-Negotiable Rules

### GitHub as Database
- Characters live at: `github.com/{user}/ttrpg-characters/characters/{filename}.json`
- Campaigns live at: `github.com/{user}/ttrpg-campaigns/`
- `saveCharacter()` in `App.jsx` fetches the existing SHA before writing — never skip the SHA fetch or you'll get a 409 conflict
- Files are base64-encoded before commit: `btoa(unescape(encodeURIComponent(JSON.stringify(char, null, 2))))`

### Character JSON Shape
Top-level keys — never restructure without updating ALL consumers:
```
meta · identity · stats · combat · inventory · spells · customContent · notes · settings
```

- `meta.owner` — `"github:username"` format
- `meta.characterId` — UUID, set on creation, never changes
- `identity.class` — always an **array** (multiclass support): `[{ name, level }]`
- `combat.conditions` — array of lowercase strings e.g. `["poisoned", "stunned"]`
- `spells.slots` — keyed by level string: `{ "1": { max, used }, "2": { max, used } }`
- `inventory` items always use the universal item schema (see Brief §7)
- `settings.encumbranceTracking` — boolean, defaults `false`

### Item Effects System
Items can modify stats. Effect modes:
- `add` — adds value (supports negative for cursed items)
- `set` — overrides stat entirely

Equipped + attuned (if required) items must propagate their effects to all stat displays across every tab. A magic item gold dot indicator must appear wherever the affected stat is shown. **This cross-tab propagation is a core invariant — do not break it when editing individual tabs.**

---

## 5. Theming — Never Hardcode Colours

All colours **must** use CSS custom properties. No hex values in component CSS or inline styles except in theme definitions.

Theme is stored in `localStorage` key `ttrpg_theme`. Applied as `data-theme` attribute on `<html>` before React mounts (in `index.html <head>`) to prevent flash.

```js
const saved = localStorage.getItem('ttrpg_theme') || 'dungeon';
document.documentElement.setAttribute('data-theme', saved);
```

### Required CSS Variables (all themes must define all of these)
```
--bg-base  --bg-surface  --bg-elevated  --bg-inset
--border  --border-strong
--text-primary  --text-secondary  --text-muted  --text-inverse
--accent  --accent-hover  --accent-subtle
--hp-high  --hp-mid  --hp-low  --hp-temp
--condition-bg  --condition-text
--success  --warning  --danger
--tab-active-bg  --tab-active-text  --tab-inactive-text
--shadow-sm  --shadow-md  --shadow-lg
```

Fixed semantic colours (not per-theme, global):
```css
--gold: #c9a227          /* magic item / attunement accent */
--gold-subtle: rgba(201,162,39,0.10)
--gold-border: rgba(201,162,39,0.38)
```

**DM mode** replaces `--accent` with crimson `#e05252` throughout — header, buttons, live indicators, borders. This is what tells the user they're in DM mode at a glance.

### Fonts
```
--font-name: 'Cinzel', serif             — headings, character name in cards (use --font-name, NOT --font-display)
--font-body: 'Nunito', sans-serif        — all body text, labels, UI
--font-mono: 'JetBrains Mono', monospace — stats, numbers, dice
```
Character name in sheet header uses `Outfit` (separate load), applied directly on `.char-name`.

> ⚠️ **Common mistake:** The design system doc references `--font-display` in places — this does not work. Always use `--font-name` for the Cinzel display typeface.

---

## 6. Layout Architecture

### App Shell
`.app-page` → `.app-container` → content. Max width `1100px`, centred.

### Character Sheet Layout (CharacterLayout.jsx)
- **Landscape:** `.landscape-body` — `LeftPanel` (fixed `clamp(200px,30%,300px)`) + `.content-panel` (flex remainder)
- **Portrait:** `.portrait-body` — `LeftPanel` (header strip) + `.content-panel` + `BottomNav`

Orientation detection drives which layout renders — do not add media queries that fight this logic.

### Character Switcher
Horizontal scrollable pill row above the sheet body. Active character = `--accent` filled pill. `+ New` always last with dashed border.

### Left Panel (always visible)
Contains in order: lock toggle, character name, race/class/level, HP (+/- controls), AC, condition pills, sync indicator, tab navigation.

### Five Character Tabs
| Icon | Tab | Key Content |
|---|---|---|
| ⚔️ | Combat | AC, initiative, attacks, death saves, conditions |
| 🎲 | Stats | Ability scores, saving throws, skills, proficiencies |
| ✨ | Spells | Spell slots (pips), spell lists, concentration tracker |
| 🎒 | Inventory | Item cards, encumbrance, attunement slots |
| 📝 | Notes | Personality, backstory, custom sections |

---

## 7. HP Bar Logic
```
> 50%  → --hp-high (green)
25–50% → --hp-mid (amber)
< 25%  → --hp-low (red)
```
Temp HP renders as a separate segment in `--hp-temp`, extending right beyond the current HP fill. Bar fill uses `transition: width 300ms ease-out`.

---

## 8. Auto-Save Pattern
- Debounced — fire save 800ms after last edit
- Sync indicator states: `✓ Saved` (--success) · `⟳ Saving...` (--text-secondary) · `⚠️ Offline` (--warning)
- Offline edits queued in IndexedDB, flushed automatically on reconnect
- `saveCharacter()` in `App.jsx` is the single save path — do not write GitHub commits anywhere else

---

## 9. Auth & Onboarding Flow
1. GitHub OAuth → token stored as `gh_token` in localStorage
2. Check if `ttrpg-characters` repo exists → `onboarded: true/false`
3. Check if `ttrpg-campaigns` repo exists → `isGM: true/false`
4. Onboarding creates the character repo and optionally the campaigns repo
5. GM status is detected, not self-declared — repo existence = GM

---

## 10. Screens & Navigation
Managed via `screen` state in `App.jsx`. Screens:
- `home` — character cards + Shared With Me (player) or campaign grid (GM)
- `character` — CharacterLayout with tab routing
- `gm-dashboard` — party summary cards + initiative tracker
- `gm-campaign` — campaign home (sessions, party, NPCs, notes)
- `session` — opens in new browser tab, full session view
- `encounter` — full screen combat view, no left panel

---

## 11. GM / DM Mode
- Toggled via Player/DM pill switch in home screen header
- Persisted in `localStorage`
- Non-destructive — player characters untouched
- DM accent colour: `--dm: #e05252` (crimson) — replaces purple `--accent` everywhere
- DM Notes (Private) must be stored in a **separate access-controlled file** — never exposed to player accounts reading the campaign repo. This is a hard privacy requirement.

---

## 12. Modal Pattern
**All modals are centred overlays.** No bottom-sheet pattern. No exceptions.

```css
/* Modal appear animation */
translateY(100%) → translateY(0), 250ms ease-out
```

Every destructive action (delete, remove, reset) requires a confirmation modal before executing.

Cancel button in footer covers close for now. ✕ top-right close button is a future pass — do not implement yet.

---

## 13. Animation Rules
Keep motion subtle — this is a utility app used mid-game.
- Theme switch: `200ms ease` on background/colour
- Tab switch: opacity crossfade `150ms`
- HP bar: `width 300ms ease-out`
- Spell slot tap: scale pulse `scale(0.9)→scale(1)` 100ms
- Modal appear: `translateY` slide up `250ms ease-out`
- Card hover: border + shadow `150ms`
- **No** entrance animations on list items
- **No** page transition animations
- **No** auto-playing anything

---

## 14. PWA Requirements
- Service worker handles offline caching + edit queue
- Manifest: `display: standalone`, `theme_color: #1a1a2e`
- Responsive: 320px phone → 1440px+ desktop. Mobile first.
- All interactive elements: minimum **44×44px** touch target
- HTTPS required — do not test PWA features over HTTP

---

## 15. Known Pitfalls — Read Before Each Session

- `src/broken/CharacterSheet.jsx` is a legacy monolith. **Do not refactor from it.** Use it only to look up old field names if needed.
- `identity.class` is always an array. Never treat it as a string.
- Item effects must propagate across all tabs — editing one tab's stat display must not break another's.
- SHA must be fetched before every GitHub write — skipping this causes 409 conflicts.
- Spell slots are keyed as strings (`"1"`, `"2"`) not integers.
- DM Notes (Private) access control is a hard requirement — never skip it for "later".
- `data-theme` must be applied in `<head>` before React mounts or you get a theme flash on load.
- All colour values in component CSS must be CSS variables — no hardcoded hex.

---

## 16. Before You Write Any Code

1. Read this file ✓
2. Read the files you're about to modify
3. For UI changes → re-read `TTRPG Design System.md` section for that component
4. For feature/logic changes → re-read the relevant section of `TTRPG App Design Brief.md`
5. After writing → read back every file you modified and check for: broken imports, hardcoded colours, missing effect propagation, logic that contradicts the brief

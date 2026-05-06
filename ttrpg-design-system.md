# TTRPG Sheet — Design System
**Version 2.2 · May 2026**

This document defines the visual language of the app. Every colour, font, spacing value, and component style lives here. The programmer should reference this document rather than making visual decisions independently. When something isn't covered, ask before inventing.

---

## 1. Theming Architecture

The app supports multiple user-selectable themes. Themes are implemented as CSS custom property sets — every colour in the UI references a variable, never a hardcoded value. Switching themes is a single class swap on `<html>` or a top-level wrapper `<div>`.

### How Themes Work

```css
/* Theme applied at root */
[data-theme="dungeon"] {
  --bg-base:       #1a1a2e;
  --bg-surface:    #16213e;
  --bg-elevated:   #0f3460;
  /* ...etc */
}
```

The active theme name is stored in `localStorage` under the key `ttrpg_theme`. On load, apply it before first render to prevent a flash of default styles.

```js
// Apply theme before React mounts (in index.html <head>)
const saved = localStorage.getItem('ttrpg_theme') || 'dungeon';
document.documentElement.setAttribute('data-theme', saved);
```

---

## 2. CSS Variable Reference

Every theme must define all variables in this table. No variable may be omitted — use the Dungeon theme as a fallback reference if a palette entry is uncertain.

### Colour Tokens

| Token | Role |
|---|---|
| `--bg-base` | Page / app background |
| `--bg-surface` | Cards, panels, sheet background |
| `--bg-elevated` | Modals, popovers, dropdowns |
| `--bg-inset` | Input fields, recessed areas |
| `--border` | Default border colour |
| `--border-strong` | Dividers, section separators |
| `--text-primary` | Body text, labels |
| `--text-secondary` | Subtext, metadata, hints |
| `--text-muted` | Disabled text, placeholder |
| `--text-inverse` | Text on accent backgrounds |
| `--accent` | Primary action colour (buttons, links, active states) |
| `--accent-hover` | Accent on hover / focus |
| `--accent-subtle` | Accent at low opacity — backgrounds, highlights |
| `--accent-secondary` | Secondary accent (used sparingly) |
| `--hp-high` | HP bar — healthy (>50%) |
| `--hp-mid` | HP bar — wounded (25–50%) |
| `--hp-low` | HP bar — critical (<25%) |
| `--hp-temp` | Temporary HP bar segment |
| `--spell-slot-filled` | Spell slot pip — available |
| `--spell-slot-empty` | Spell slot pip — expended |
| `--condition-bg` | Condition pill background |
| `--condition-text` | Condition pill text |
| `--concentration-indicator` | 🔵 concentration marker |
| `--success` | Positive state (saved, confirmed) |
| `--warning` | Caution state (low HP warning, offline) |
| `--danger` | Destructive / error state |
| `--tab-active-bg` | Active tab background |
| `--tab-active-text` | Active tab text / icon |
| `--tab-inactive-text` | Inactive tab text / icon |
| `--shadow-sm` | Subtle shadow — cards |
| `--shadow-md` | Medium shadow — modals |

### Typography Tokens

| Token | Role |
|---|---|
| `--font-display` | Section titles, large headings (Cinzel) |
| `--font-body` | All body text, labels, inputs, buttons (Nunito) |
| `--font-mono` | Stat values, dice notation, numbers (JetBrains Mono) |

> **Character name** uses `'Outfit'` at weight 800, NOT `--font-display`. Outfit is a plain bold sans-serif — more legible at large size in a UI context than Cinzel. It is loaded separately and applied directly on the `.char-name` element.

### Additional Global Tokens

These are used across all tabs and must be defined globally (not per-theme — they are fixed semantic colours):

```css
--gold:         #c9a227;   /* magic item accent — attunement, charges, buff dots */
--gold-subtle:  rgba(201, 162, 39, 0.10);
--gold-border:  rgba(201, 162, 39, 0.38);
```

### Spacing & Shape Tokens

| Token | Value | Role |
|---|---|---|
| `--radius-sm` | `4px` | Inputs, pills, small chips |
| `--radius-md` | `8px` | Cards, panels |
| `--radius-lg` | `12px` | Modals, bottom sheets |
| `--radius-full` | `9999px` | Circular elements, fully-rounded pills |
| `--spacing-xs` | `4px` | Tight internal padding |
| `--spacing-sm` | `8px` | Item gaps, compact sections |
| `--spacing-md` | `16px` | Standard section padding |
| `--spacing-lg` | `24px` | Between major sections |
| `--spacing-xl` | `32px` | Page-level padding |

---

## 3. Theme Definitions

Eight launch themes. More may be added later — the architecture is designed to be extended with no code changes beyond adding a new CSS block.

---

### 3.1 Dungeon *(default)*

The baseline theme. This is the style currently implemented in the app — deep purple-black backgrounds, indigo surfaces, and a medium purple accent. All other themes should feel like they belong to the same design language.

> **Colour reference:** These values are derived directly from the built UI. Do not alter them without designer sign-off — this is the canonical starting point.

```css
[data-theme="dungeon"] {
  --bg-base:              #0e0d1a;   /* deepest background — page fill */
  --bg-surface:           #13122a;   /* cards, panels, sidebar */
  --bg-elevated:          #1c1b35;   /* modals, dropdowns, active tab bg */
  --bg-inset:             #0a0915;   /* input fields, recessed wells */
  --border:               #26244a;   /* default borders */
  --border-strong:        #36336a;   /* dividers, section separators */

  --text-primary:         #eeedf8;   /* main text — near white with cool tint */
  --text-secondary:       #8885aa;   /* subtitles, metadata, hints */
  --text-muted:           #45426a;   /* placeholders, disabled */
  --text-inverse:         #0e0d1a;   /* text on accent-coloured backgrounds */

  --accent:               #7c6ff5;   /* primary purple — buttons, active states, links */
  --accent-hover:         #9b90ff;   /* accent on hover / focus */
  --accent-subtle:        rgba(124, 111, 245, 0.15); /* accent wash — highlights, focus rings */
  --accent-secondary:     #5550cc;   /* deeper purple — pressed states, secondary actions */

  --hp-high:              #4ade80;   /* healthy green */
  --hp-mid:               #f59e0b;   /* wounded amber */
  --hp-low:               #f87171;   /* critical red */
  --hp-temp:              #67e8f9;   /* temp HP — cyan */

  --spell-slot-filled:    #7c6ff5;   /* filled pip — matches accent */
  --spell-slot-empty:     #26244a;   /* empty pip — matches border */

  --condition-bg:         rgba(239, 100, 60, 0.22); /* warm orange wash — visible but not alarming */
  --condition-text:       #f4845f;                  /* warm orange text for condition pills */
  --concentration-indicator: #67e8f9;               /* cyan dot for concentration */

  --success:              #4ade80;   /* green — Saved indicator, confirm states */
  --warning:              #f59e0b;   /* amber — Offline, low HP warning */
  --danger:               #f87171;   /* red — delete, death saves failures */

  --tab-active-bg:        #1c1b35;   /* active tab in sidebar — matches bg-elevated */
  --tab-active-text:      #eeedf8;   /* active tab label — full brightness */
  --tab-inactive-text:    #45426a;   /* inactive tab label — muted */

  --shadow-sm:            0 2px 8px rgba(0, 0, 0, 0.5);
  --shadow-md:            0 8px 32px rgba(0, 0, 0, 0.7);

  --font-display:         'Cinzel', Georgia, serif;
  --font-body:            'Nunito', system-ui, sans-serif;
  --font-mono:            'JetBrains Mono', 'Fira Code', monospace;
}
```

**Vibe:** Deep purple night. Indigo stone lit by a conjured light spell. Quiet focus before the encounter starts.

---

### 3.2 Arcane

Midnight purple with gold leaf accents. For the wizard at the table.

```css
[data-theme="arcane"] {
  --bg-base:              #0d0a1a;
  --bg-surface:           #140f28;
  --bg-elevated:          #1e1540;
  --bg-inset:             #0a0812;
  --border:               #2e224a;
  --border-strong:        #4a3570;

  --text-primary:         #f0ecff;
  --text-secondary:       #9080c0;
  --text-muted:           #4a3a68;
  --text-inverse:         #0d0a1a;

  --accent:               #c9a227;
  --accent-hover:         #e8bc38;
  --accent-subtle:        rgba(201, 162, 39, 0.15);
  --accent-secondary:     #7b2d8b;

  --hp-high:              #68d391;
  --hp-mid:               #f6ad55;
  --hp-low:               #fc8181;
  --hp-temp:              #76e4f7;

  --spell-slot-filled:    #c9a227;
  --spell-slot-empty:     #2e224a;

  --condition-bg:         rgba(123, 45, 139, 0.3);
  --condition-text:       #d49fc8;
  --concentration-indicator: #c9a227;

  --success:              #68d391;
  --warning:              #f6ad55;
  --danger:               #fc8181;

  --tab-active-bg:        #1e1540;
  --tab-active-text:      #c9a227;
  --tab-inactive-text:    #4a3a68;

  --shadow-sm:            0 2px 8px rgba(0,0,0,0.5);
  --shadow-md:            0 8px 32px rgba(13,5,30,0.8);

  --font-display:         'Cinzel Decorative', Georgia, serif;
  --font-body:            'Crimson Pro', Georgia, serif;
  --font-mono:            'JetBrains Mono', monospace;
}
```

**Vibe:** Spellbook illuminated by candlelight. Ancient gold ink on vellum. Smells like incense.

---

### 3.3 Forest

Earthy greens and warm amber. For rangers, druids, and the player who describes every tree.

```css
[data-theme="forest"] {
  --bg-base:              #0e1a0e;
  --bg-surface:           #132213;
  --bg-elevated:          #1a2e1a;
  --bg-inset:             #0a1209;
  --border:               #2a3d2a;
  --border-strong:        #3d5c3d;

  --text-primary:         #d4e8c8;
  --text-secondary:       #7a9a6a;
  --text-muted:           #3a4e38;
  --text-inverse:         #0e1a0e;

  --accent:               #8fbc3d;
  --accent-hover:         #a8d44a;
  --accent-subtle:        rgba(143, 188, 61, 0.15);
  --accent-secondary:     #c8860a;

  --hp-high:              #8fbc3d;
  --hp-mid:               #c8860a;
  --hp-low:               #c0392b;
  --hp-temp:              #48b5c4;

  --spell-slot-filled:    #8fbc3d;
  --spell-slot-empty:     #2a3d2a;

  --condition-bg:         rgba(200, 134, 10, 0.2);
  --condition-text:       #e0a030;
  --concentration-indicator: #48b5c4;

  --success:              #8fbc3d;
  --warning:              #c8860a;
  --danger:               #c0392b;

  --tab-active-bg:        #1a2e1a;
  --tab-active-text:      #8fbc3d;
  --tab-inactive-text:    #3a4e38;

  --shadow-sm:            0 2px 8px rgba(0,0,0,0.4);
  --shadow-md:            0 8px 32px rgba(0,0,0,0.6);

  --font-display:         'Cinzel', Georgia, serif;
  --font-body:            'Nunito', system-ui, sans-serif;
  --font-mono:            'JetBrains Mono', monospace;
}
```

**Vibe:** Firelight through pine boughs. Bark and moss. Green that goes deep.

---

### 3.4 Ember

Warm amber, ember red, and near-black. For barbarians, paladins, and dramatic moments.

```css
[data-theme="ember"] {
  --bg-base:              #1a0e08;
  --bg-surface:           #261408;
  --bg-elevated:          #361a08;
  --bg-inset:             #140a04;
  --border:               #3d2010;
  --border-strong:        #5a3018;

  --text-primary:         #f5ddc8;
  --text-secondary:       #a07050;
  --text-muted:           #4a2e18;
  --text-inverse:         #1a0e08;

  --accent:               #e85d04;
  --accent-hover:         #ff7f27;
  --accent-subtle:        rgba(232, 93, 4, 0.15);
  --accent-secondary:     #dc2f02;

  --hp-high:              #a8c256;
  --hp-mid:               #e85d04;
  --hp-low:               #dc2f02;
  --hp-temp:              #f4a261;

  --spell-slot-filled:    #e85d04;
  --spell-slot-empty:     #3d2010;

  --condition-bg:         rgba(220, 47, 2, 0.2);
  --condition-text:       #ff7f27;
  --concentration-indicator: #f4a261;

  --success:              #a8c256;
  --warning:              #e85d04;
  --danger:               #dc2f02;

  --tab-active-bg:        #361a08;
  --tab-active-text:      #e85d04;
  --tab-inactive-text:    #4a2e18;

  --shadow-sm:            0 2px 8px rgba(0,0,0,0.5);
  --shadow-md:            0 8px 32px rgba(20,5,0,0.8);

  --font-display:         'Cinzel', Georgia, serif;
  --font-body:            'Nunito', system-ui, sans-serif;
  --font-mono:            'JetBrains Mono', monospace;
}
```

**Vibe:** Forge fire. Hearth smoke. You're about to do something you'll regret and you know it.

---

### 3.5 Frost

Ice blue, white silver, and deep midnight. Clean and cold.

```css
[data-theme="frost"] {
  --bg-base:              #080e1a;
  --bg-surface:           #0e1826;
  --bg-elevated:          #152234;
  --bg-inset:             #060c14;
  --border:               #1e3050;
  --border-strong:        #2e4a70;

  --text-primary:         #d4eeff;
  --text-secondary:       #6a9abf;
  --text-muted:           #2a4060;
  --text-inverse:         #080e1a;

  --accent:               #63c5ea;
  --accent-hover:         #88d8f5;
  --accent-subtle:        rgba(99, 197, 234, 0.15);
  --accent-secondary:     #a8d8f0;

  --hp-high:              #63c5ea;
  --hp-mid:               #a8d8f0;
  --hp-low:               #e85d85;
  --hp-temp:              #ffffff;

  --spell-slot-filled:    #63c5ea;
  --spell-slot-empty:     #1e3050;

  --condition-bg:         rgba(99, 197, 234, 0.15);
  --condition-text:       #88d8f5;
  --concentration-indicator: #a8d8f0;

  --success:              #63c5ea;
  --warning:              #f6d860;
  --danger:               #e85d85;

  --tab-active-bg:        #152234;
  --tab-active-text:      #63c5ea;
  --tab-inactive-text:    #2a4060;

  --shadow-sm:            0 2px 8px rgba(0,0,0,0.4);
  --shadow-md:            0 8px 32px rgba(0,0,0,0.7);

  --font-display:         'Cinzel', Georgia, serif;
  --font-body:            'Nunito', system-ui, sans-serif;
  --font-mono:            'JetBrains Mono', monospace;
}
```

**Vibe:** Frozen tundra. Breath mist. The quiet before something terrible happens.

---

### 3.6 Parchment *(light theme)*

The only light theme in the launch set. Warm cream paper, dark ink, iron accents.

```css
[data-theme="parchment"] {
  --bg-base:              #f2e8d5;
  --bg-surface:           #faf4e8;
  --bg-elevated:          #ffffff;
  --bg-inset:             #e8dcc4;
  --border:               #c8b898;
  --border-strong:        #9a8468;

  --text-primary:         #2a1f0e;
  --text-secondary:       #6a5438;
  --text-muted:           #a89070;
  --text-inverse:         #faf4e8;

  --accent:               #8b2500;
  --accent-hover:         #a83000;
  --accent-subtle:        rgba(139, 37, 0, 0.1);
  --accent-secondary:     #2a4a1a;

  --hp-high:              #2a6a1a;
  --hp-mid:               #b05a00;
  --hp-low:               #8b2500;
  --hp-temp:              #1a4a8a;

  --spell-slot-filled:    #8b2500;
  --spell-slot-empty:     #c8b898;

  --condition-bg:         rgba(139, 37, 0, 0.12);
  --condition-text:       #8b2500;
  --concentration-indicator: #1a4a8a;

  --success:              #2a6a1a;
  --warning:              #b05a00;
  --danger:               #8b2500;

  --tab-active-bg:        #e8dcc4;
  --tab-active-text:      #8b2500;
  --tab-inactive-text:    #a89070;

  --shadow-sm:            0 2px 8px rgba(42,31,14,0.15);
  --shadow-md:            0 8px 32px rgba(42,31,14,0.25);

  --font-display:         'Cinzel', Georgia, serif;
  --font-body:            'Crimson Pro', Georgia, serif;
  --font-mono:            'JetBrains Mono', monospace;
}
```

**Vibe:** Hand-ruled paper. Library smell. Your grandfather's rulebook.

---

### 3.7 Abyss

Near-pure black with neon violet highlights. High contrast. Uncompromising.

```css
[data-theme="abyss"] {
  --bg-base:              #050508;
  --bg-surface:           #0a0a10;
  --bg-elevated:          #10101a;
  --bg-inset:             #030305;
  --border:               #1a1a28;
  --border-strong:        #2a2a42;

  --text-primary:         #f0f0ff;
  --text-secondary:       #7070a0;
  --text-muted:           #303048;
  --text-inverse:         #050508;

  --accent:               #9d4edd;
  --accent-hover:         #b86ee8;
  --accent-subtle:        rgba(157, 78, 221, 0.15);
  --accent-secondary:     #5390d9;

  --hp-high:              #57cc99;
  --hp-mid:               #f4a261;
  --hp-low:               #e63946;
  --hp-temp:              #5390d9;

  --spell-slot-filled:    #9d4edd;
  --spell-slot-empty:     #1a1a28;

  --condition-bg:         rgba(157, 78, 221, 0.2);
  --condition-text:       #b86ee8;
  --concentration-indicator: #5390d9;

  --success:              #57cc99;
  --warning:              #f4a261;
  --danger:               #e63946;

  --tab-active-bg:        #10101a;
  --tab-active-text:      #9d4edd;
  --tab-inactive-text:    #303048;

  --shadow-sm:            0 2px 8px rgba(0,0,0,0.7);
  --shadow-md:            0 8px 32px rgba(0,0,0,0.9);

  --font-display:         'Cinzel', Georgia, serif;
  --font-body:            'Nunito', system-ui, sans-serif;
  --font-mono:            'JetBrains Mono', monospace;
}
```

**Vibe:** The space between planes. Static on the astral wind. Void with teeth.

---

### 3.8 Iron

Desaturated steel greys with a single gold accent. Soldier's aesthetic. All business.

```css
[data-theme="iron"] {
  --bg-base:              #141414;
  --bg-surface:           #1e1e1e;
  --bg-elevated:          #2a2a2a;
  --bg-inset:             #0f0f0f;
  --border:               #2e2e2e;
  --border-strong:        #404040;

  --text-primary:         #e8e8e8;
  --text-secondary:       #888888;
  --text-muted:           #444444;
  --text-inverse:         #141414;

  --accent:               #c8a84b;
  --accent-hover:         #dfc060;
  --accent-subtle:        rgba(200, 168, 75, 0.15);
  --accent-secondary:     #606060;

  --hp-high:              #5aad72;
  --hp-mid:               #d4883a;
  --hp-low:               #c03030;
  --hp-temp:              #5888c0;

  --spell-slot-filled:    #c8a84b;
  --spell-slot-empty:     #2e2e2e;

  --condition-bg:         rgba(192, 48, 48, 0.18);
  --condition-text:       #d86060;
  --concentration-indicator: #5888c0;

  --success:              #5aad72;
  --warning:              #d4883a;
  --danger:               #c03030;

  --tab-active-bg:        #2a2a2a;
  --tab-active-text:      #c8a84b;
  --tab-inactive-text:    #444444;

  --shadow-sm:            0 2px 8px rgba(0,0,0,0.5);
  --shadow-md:            0 8px 32px rgba(0,0,0,0.7);

  --font-display:         'Cinzel', Georgia, serif;
  --font-body:            'Nunito', system-ui, sans-serif;
  --font-mono:            'JetBrains Mono', monospace;
}
```

**Vibe:** Plate armour. Guard barracks. Reliable.

---

## 4. Typography

### Font Stack

All fonts loaded from Google Fonts. Include these in the HTML `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cinzel+Decorative:wght@400;700&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&family=Nunito:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### Type Scale

| Name | Size | Weight | Font | Use |
|---|---|---|---|---|
| `display-xl` | 28px | 700 | `--font-display` | Character name in header |
| `display-lg` | 22px | 600 | `--font-display` | Screen titles |
| `display-md` | 18px | 600 | `--font-display` | Section headings |
| `label-lg` | 15px | 600 | `--font-body` | Tab labels, button text, form labels |
| `label-md` | 13px | 600 | `--font-body` | Sub-labels, metadata headers |
| `body-lg` | 15px | 400 | `--font-body` | Primary body copy |
| `body-md` | 13px | 400 | `--font-body` | Supporting body copy |
| `body-sm` | 11px | 400 | `--font-body` | Fine print, hints |
| `stat-xl` | 32px | 500 | `--font-mono` | Ability score modifiers (+4) |
| `stat-lg` | 22px | 500 | `--font-mono` | HP values, AC |
| `stat-md` | 15px | 400 | `--font-mono` | Raw scores, dice notation |
| `stat-sm` | 12px | 400 | `--font-mono` | Bonus breakdowns |

### Usage Rules

- **Never use a display font below 16px.** It becomes illegible. Use `--font-body` for anything smaller.
- **Numbers that represent game mechanics always use `--font-mono`.** This includes HP, AC, modifiers, dice, level, proficiency bonus.
- **Text that describes a character (name, race, class) uses `--font-display`.** Text that describes the UI (button labels, form labels) uses `--font-body`.
- **The Parchment and Arcane themes use `Crimson Pro` for body text** instead of Nunito — this is defined per-theme via `--font-body` and applied automatically.

---

## 5. Spacing System

All spacing is on an 8px base grid. Use multiples.

| Token | Value | Common use |
|---|---|---|
| `--spacing-xs` | `4px` | Gap between icon and label; badge padding |
| `--spacing-sm` | `8px` | Internal card padding; gap between items in a list |
| `--spacing-md` | `16px` | Standard section padding; gap between form fields |
| `--spacing-lg` | `24px` | Between major sections within a tab |
| `--spacing-xl` | `32px` | Page-level horizontal gutters; top of screen padding |

In Tailwind, these map to: `p-1` (4px), `p-2` (8px), `p-4` (16px), `p-6` (24px), `p-8` (32px).

**Do not use odd spacing values** like 10px, 14px, or 18px. Stick to the grid.

---

## 6. Border Radius

| Token | Value | Common use |
|---|---|---|
| `--radius-sm` | `4px` | Condition pills, small badges, checkboxes |
| `--radius-md` | `8px` | Cards, input fields, panels |
| `--radius-lg` | `12px` | Modals, bottom sheets, character cards |
| `--radius-full` | `9999px` | Circular avatar, toggle buttons, spell slot pips |

---

## 7. Core Components

### Character Sheet Header

The header is always visible. It never scrolls away. It contains everything the player needs during combat without switching tabs.

```
[ character switcher tabs ]
──────────────────────────────────────────────
🔓  [display-xl] Aragorn              [Share] [⋮]
    [label-md text-secondary] Human · Ranger · 10

    [stat-lg] 72 / 90                 [stat-lg] AC 16
    [hp-bar]
    [condition pills]

    [text-secondary body-sm] ✓ Saved
──────────────────────────────────────────────
    ⚔️  🎲  ✨  🎒  📝
```

**HP bar** — full-width bar below the HP numbers. Colour transitions via CSS linear-gradient using `--hp-high`, `--hp-mid`, `--hp-low`. Transition happens at 50% (mid) and 25% (low). The bar itself fills proportionally. Temp HP renders as a separate overlaid segment in `--hp-temp`, extending to the right of the current HP fill.

```css
/* HP bar fill colour: use inline style to set custom property */
.hp-bar-fill {
  background-color: var(--hp-fill, var(--hp-high));
}
/* Set --hp-fill dynamically based on percentage:
   > 50% → --hp-high
   25–50% → --hp-mid
   < 25% → --hp-low
*/
```

**Character switcher** — horizontal scrollable row of tabs above the header block. Each tab: character name (truncated at 10 chars) + level badge. Active tab uses `--tab-active-bg` and `--tab-active-text`. Inactive uses `--tab-inactive-text`. `[ + ]` tab always at the end.

**Sync indicator** — right-aligned below the character info. Tiny. Never call attention to it.
- `✓ Saved` — `--success`
- `⟳ Saving...` — `--text-secondary`
- `⚠️ Offline` — `--warning`

---

### Magic Item Stat Indicators

When an equipped (and attuned, if required) magic item modifies a stat — AC, ability scores, saving throws, skill bonuses, speed, initiative, passive perception — a small gold dot indicator appears on that stat wherever it is displayed across the app.

The dot is purely informational. Tapping it reveals a small tooltip or inline label explaining the source.

**Where the dot appears:**

| Location | Example |
|---|---|
| Summary row stat tile | AC tile shows ◆ when Ring of Protection is equipped |
| Left panel stat tiles (AC / Init / Speed) | AC tile shows ◆ |
| Ability score card | STR card shows ◆ if a Belt of Giant Strength is equipped |
| Saving throw row | STR save row shows ◆ if a Cloak of Protection is equipped |
| Skill row | Stealth shows ◆ if Boots of Elvenkind are equipped |

**Dot appearance:**
```css
.magic-buff-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--gold);              /* #c9a227 */
  box-shadow: 0 0 4px rgba(201,162,39,0.7);
  flex-shrink: 0;
}
```

Positioned as a small superscript-style dot adjacent to the value it modifies — never overlapping text. On ability score cards it sits in the top-right corner (opposite corner to the saving throw dot). On row-based stats (saves, skills, summary tiles) it sits immediately to the right of the bonus value.

**Tooltip positioning:**
- Default: tooltip opens **upward** (above the dot) — works for ability cards, skill rows, saving throw rows
- Exception: dots in the **summary row** at the top of the right panel open **downward** — opening upward would clip behind the character switcher tabs above. Use `top: 130%` instead of `bottom: 130%` for any dot in the summary row.
- Z-index: `50` — always renders above cards and panel content
A small popover appears anchored to the dot showing the source item and the bonus amount:

```
◆  +1 AC  ·  Ring of Protection  (equipped · attuned)
◆  +1 all saves  ·  Ring of Protection
```

- Popover background: `--bg-elevated`
- Border: `1px solid --gold-border`
- Font: `--font-body`, `body-sm`
- Dismisses on tap outside or after 3 seconds

**Rules:**
- Dot only appears when the item is both equipped AND attuned (if attunement is required). Unequipped or unattuned items contribute nothing and show no dot.
- Non-attuned magic items that are simply equipped (e.g. Wand of Magic Missile, +1 Longsword) still show the dot on any stat they passively affect.
- If multiple items affect the same stat, a single dot still appears — the tooltip lists all contributing items.
- The dot never appears in the Gear tab itself — it is a Stats tab and summary row concern only.
- In edit mode the dot is hidden — the raw base value is shown without magic bonuses so the player can edit cleanly.

---

### Stats Tab — Summary Row



Six cards in a 3×2 grid. Each card is square with equal width.

```
┌──────────┐
│  [stat-xl] +4   │  ← modifier, prominent
│  [stat-sm] 18   │  ← raw score, below
│  [label-md] STR │  ← label, bottom
│  💪            │  ← saving throw icon (if proficient)
└──────────┘
```

- Background: `--bg-surface`
- Border: `1px solid --border`
- Active/editing: border changes to `--accent`
- Saving throw icon only present if proficient — 💪 in `--accent`
- In locked mode: tapping does nothing. In edit mode: tapping opens an inline number stepper.

---

### Skill Row

```
[marker]  [body-md] Acrobatics    [stat-md] +7    [label-md text-secondary] DEX
```

Proficiency marker — a 20×20px circle, three clearly distinct states:

| State | Appearance | Meaning |
|---|---|---|
| Not proficient | Hollow circle, `--text-muted` border | No bonus |
| Proficient | `--accent-subtle` fill, `--accent` border, small `◆` inside | +Prof bonus |
| Expertise | Solid `--accent` fill, white `★` inside | +Prof bonus × 2 |

The three states must be immediately distinguishable at a glance — hollow vs outlined-with-symbol vs solid-filled. Never rely on colour alone or subtle glyph differences.

In edit mode, tapping a skill row cycles through the three states in order: none → proficient → expertise → none.

---

### HP Controls

Two large tap targets flanking the HP display in the header. Never show in locked mode for non-owners.

```
[ − ]   72 / 90   [ + ]
```

- Buttons: minimum 44×44px tap target
- `[ + ]` — `--accent` background
- `[ − ]` — `--bg-elevated` background, `--text-primary` text
- Long-pressing `[ − ]` should not trigger without intent — use a single tap confirmation snackbar: *"HP set to 65 · Undo"* (3 second timeout)

---

### Spell Slot Pips

Rendered as a horizontal flow. Each pip is a circle — 12px diameter.

```
I  ●●○○   II  ●●○   III  ●○○   IV  ○
```

- Filled: `background: --spell-slot-filled`, `border-radius: --radius-full`
- Empty: `background: --spell-slot-empty`, `border: 1px solid --border-strong`, `border-radius: --radius-full`
- Level label (I, II...): `--font-mono`, `--text-secondary`, `label-md` size, right-padded 4px
- Rows V–IX: collapsed into a second line, shown only if the character has those slots

In Combat tab: tapping a filled pip expends it. Tapping an empty one restores it. Both actions auto-save.

---

### Condition Pills

```
[ Poisoned ]  [ Stunned ]  [ + ]
```

- Background: `--condition-bg`
- Text: `--condition-text`
- Font: `--font-body`, `body-sm`, weight 600
- Radius: `--radius-sm`
- Padding: `2px 8px`
- `[ + ]` pill: dashed border `--border-strong`, `--text-secondary` — opens condition picker

---

### Attack Card (Combat Tab)

Combat items — weapons and magic items with attack actions — use a **two-line card layout** to prevent crowding when badges and controls are all present. The name gets its own line; all detail and controls sit on the line below.

```
┌────────────────────────────────────────────────────────┐
│  Longsword +1                                          │  ← Line 1: name only
│  +8 to hit   1d8+5 slashing   [Roll]  [Use]            │  ← Line 2: stats + buttons
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│  Shortbow                                              │
│  +7 to hit   1d6+4 piercing   ↑ 38 arrows   [Roll] [Use] │  ← ammo count inline
└────────────────────────────────────────────────────────┘
```

**Line 1 — Name row:**
- Weapon/item name: `--font-body`, `body-md`, weight 600, `--text-primary`
- Magic item indicator: gold ◆ gem prefix for items with charges (no attunement required for this — any charged item gets it)
- No other content on this line — name has full width to breathe

**Line 2 — Detail row:**
- To-hit badge: `--font-mono`, `body-sm`, `--bg-elevated` background, `--border-strong` border — e.g. `+8 to hit`
- Damage badge: same style — e.g. `1d8+5 slashing`
- Ammunition count (ranged weapons only): small inline badge showing current count from Gear — e.g. `↑ 38 arrows`. Colour follows stock level:
  - `> 10` — `--text-secondary` (normal)
  - `4–10` — `--warning` (getting low)
  - `1–3` — `--danger` (critical)
  - `0` — `--danger`, badge reads `No arrows` — Roll and Use buttons are disabled
- Charge badge (magic items with charges): gold `4 / 7` badge, same inline position as ammo count. Tapping − deducts a charge; tapping + restores one.
- `[ Roll ]` button: ghost style — `--bg-elevated` background, `--border` border, `--text-secondary` text. Opens dice roll result snackbar.
- `[ Use ]` / `[ Cast ]` button: `--accent` background, white text. Fires the weapon or opens the cast modal for magic items. **This is the primary action button.**

**Card container:**
- Background: `--bg-surface`
- Border: `1px solid --border`
- Border-radius: `--radius-md`
- Padding: `10px 14px` on both lines
- Line 1 and Line 2 separated by nothing — no divider, just natural line spacing (`gap: 4px` between the two flex rows)
- On hover: `border-color: --border-strong`
- Margin between cards: `6px`

**Ammunition auto-deduction:**
When the player taps `[ Use ]` on a ranged weapon (bow, crossbow, thrown weapon tagged as `uses-ammo`):
1. The app checks `character.gear` for a matching ammo item (e.g. `Arrows` for a shortbow, `Bolts` for a crossbow)
2. Quantity is decremented by 1 automatically — no confirmation required
3. The ammo count badge on the weapon card updates immediately
4. If quantity reaches 0, the badge turns `--danger` and reads `No arrows`. Roll and Use are disabled until ammo is restocked in the Gear tab.
5. Ammo type matching is defined on the weapon item: `ammoType: "arrow" | "bolt" | "dart" | null`. Null means no ammo tracking (e.g. melee, self-replenishing thrown).

**Thrown weapons** (daggers, handaxes): decrement from a separate `thrown` count tracked on the item itself, not from a shared ammo pool. The player manually recovers them after combat.

---

### Magic Items Section (Combat Tab)

Sits between Attacks and Spell Slots. Same two-line card layout as weapons. The charge badge replaces the ammo count on line 2. The action button reads `[ Use ]` and opens the cast/use modal where the player can choose how many charges to expend.

If a magic item has no attack roll (e.g. a healing item or utility wand), the to-hit badge is omitted from line 2. Only the effect badge and charge badge appear.

---

### Gear Tab — Currency Weight Toggle

The Currency category label in the Gear tab has a small toggle switch to the right of the label. This controls whether currency weight is counted toward the character's carry total.

```
CURRENCY                              [○ Count weight]
──────────────────────────────────────────────────────
  Gold Pieces      0.02 lb ea    [ − ]  240  [ + ]
  Silver Pieces    0.02 lb ea    [ − ]   85  [ + ]
```

- Toggle: standard small toggle switch — 28×16px, `--bg-inset` track when off, `--accent` track when on. Knob is white.
- Label beside toggle: `body-sm`, `--text-muted` — `Count weight` when off, `Counting weight` when on.
- Default state: **off** — most tables don't track coin weight and new characters shouldn't be penalised by it automatically.
- When off: currency weight is excluded from the carry bar calculation. The carry bar only reflects equipped and bag items.
- When on: coin weight is included. The carry bar updates immediately.
- This setting persists per-character in the character's JSON data as `currencyWeightEnabled: boolean`.
- The toggle state is only visible and editable by the character's owner — viewers (party members) see the carry bar result but not the toggle.

---

### Gear Tab — Ammunition Auto-Deduction (Gear Side)

Ammo items in the Gear tab Bag section have their quantity automatically decremented when the matching weapon is fired from the Combat tab. The player does not need to manually adjust ammo in the Gear tab during play.

Players can still manually adjust ammo quantity in the Gear tab (e.g. after looting arrows, buying bolts). The quantity control `[ − qty + ]` remains fully interactive.

When quantity reaches 0, the ammo row in Gear shows the count in `--danger` colour. The row is not hidden — the player should see they are out and can add more.

---


### Spell Row

Spell rows appear in both the **Combat tab** (prepared spells only) and the **Spells tab** (full class spell list). The collapsed layout is identical in both contexts — only the right-side controls differ.

#### Collapsed layout

```
○/●  [body-md] Hunter's Mark   ★   [badge] 1d6 bonus   [badge] Divination · Conc   [▾]
```

**Left side:**
- Concentration dot (always present, same position on every row)
  - Active concentration: filled cyan dot with glow — `--concentration-indicator`
  - Not a concentration spell / not active: hollow circle — `border: 1.5px solid --text-muted`, transparent fill
- Spell name: `--font-body`, `body-md`, weight 600, `--text-primary`. `white-space: nowrap`, truncates with ellipsis.
- Prepared star (always present, same position on every row):
  - `★` filled — `--accent` colour — spell is prepared
  - `☆` hollow — `--text-muted` colour — spell is available to this character's class but not currently prepared
  - The star is never absent. Every spell in the list belongs to one of the character's classes, so every spell is either prepared or available-but-not-prepared.

**Right side (Spells tab):**
- Stat badges (die, bonus, effect) — same style as attack badges — `--bg-elevated` background, `--border-strong` border, `--font-mono`
- School / meta badge — same badge style, `--text-secondary` text (muted to distinguish from the stat badge)
- Expand button `[▾]` — 28×28px, `--bg-elevated` background. Rotates 180° and turns `--accent` when row is expanded.

**Right side (Combat tab — prepared spells only):**
- Same stat badges
- `Cast` button — `--accent` background. Tapping opens the higher-level cast modal.
- No expand button in Combat tab — tapping anywhere on the row opens the detail inline (the row is always tappable for detail, Cast button tap is intercepted separately).

#### Prepared vs unprepared appearance

| State | Star | Row opacity | Stat badges |
|---|---|---|---|
| Prepared | ★ `--accent` | 100% | Shown |
| Available, not prepared | ☆ `--text-muted` | 60% | Hidden (school badge only) |

Unprepared spells show the school badge but not stat badges — there's nothing to roll, so the dice info is irrelevant until prepared. The Prepare toggle inside the expanded detail panel adds the spell to prepared.

#### Expanded detail panel

Tapping the expand button `[▾]` (Spells tab) or anywhere on the row (Combat tab) reveals the detail panel inline below the collapsed row. The row border strengthens to `--border-strong` when expanded.

```
┌─ expanded panel (bg: --bg-inset) ──────────────────────────┐
│  CASTING TIME   RANGE      DURATION    COMPONENTS   SCHOOL  │
│  1 Action       90 ft      Conc, 1hr   V            Divination │
│  CLASS                                                       │
│  Ranger                                                      │
│  ─────────────────────────────────────────────────────────  │
│  Description text in --text-secondary, body-sm, line-height 1.6 │
│                                                              │
│  [ ★ Prepared ]  ← toggle button                            │
└─────────────────────────────────────────────────────────────┘
```

- Detail stat grid: `display: grid`, `grid-template-columns: repeat(auto-fill, minmax(120px, 1fr))`. Labels: `label-sm`, uppercase, `--text-muted`. Values: `--font-mono`, `stat-sm`, `--text-primary`.
- Description: `body-sm`, `--text-secondary`, `line-height: 1.6`. Separated from the stat grid by a `1px solid --border` line.
- Prepare toggle button: secondary button style. When prepared: `--accent-subtle` background, `--accent` border, `--accent-hover` text, `★ Prepared` label. When not prepared: ghost style, `☆ Add to prepared` label.

---

### Spell Filters (Spells Tab)

Two independent filter rows sit in a sticky bar at the top of the Spells tab right panel.

```
CLASS   [ All ]  [ Ranger ]  [ Druid ]
SCHOOL  [ All ]  [ Evocation ●]  [ Divination ]  [ Conjuration ]  [ Abjuration ]  ...
```

- Filter label: `label-md`, uppercase, `--text-muted`, fixed width so chips align across rows.
- Chips: `border-radius: --radius-full`, `body-sm`, weight 600. Default: `--border` border, `--text-secondary` text, transparent background. Active: `--accent-subtle` background, `--accent` border, `--accent-hover` text.
- Each row is independent — class and school filters combine (AND logic). Selecting "Ranger" + "Evocation" shows only Ranger evocation spells.
- Selecting "All" within a row resets that row's filter. If no chip is active, "All" reactivates automatically.
- School chips wrap onto a second line on narrow viewports — the label stays left-aligned.

---

### Spell Level Groups (Spells Tab)

Spells are grouped by level. Each group has a header showing the level name and current slot pips.

```
LEVEL 1   ●  ●  ○  ○
```

- Header: `label-md`, uppercase, `--text-muted`. Slot pips (6px circles) immediately follow the label — filled `--spell-slot-filled`, empty with `--border-strong` border. Cantrips group has no pips (no slots).
- Groups are always present even if no spells match the current filter — they collapse to just the header with a "No spells" note in `--text-muted`.



---

### Gear Tab — Carry Weight Bar

Full-width bar pinned to the top of the Gear tab right panel, above all content.

```
CARRIED  [━━━━━━━━━━━━━━━━━━░░░░░░░░]  47.5 / 115 lb
```

Bar colour follows carry percentage: green (`--hp-high`) under 50%, amber (`--hp-mid`) 50–80%, red (`--hp-low`) above 80%.

---

### Gear Tab — Attunement Sub-section

Sits at the very top of the Equipped section, before any category groups. Always present when any attuned items exist.

```
⬡ ATTUNED                              ●  ○  ○   1 / 3
─────────────────────────────────────────────────────
[attuned item rows]
```

- Label: gold `--gold` colour, uppercase, `label-sm`
- Pip tracker: three 10px circles, filled `--gold`, empty with `--gold` border. Count `1 / 3` in `--font-mono` beside pips.
- Attuned item rows: gold left-edge tint (`linear-gradient` from `rgba(201,162,39,0.05)` to `--bg-surface`), `--gold-border` border colour.
- Gold ◆ gem icon precedes the item name on attuned rows.
- Detail panel includes **Unatune** button (gold colour, distinct from Unequip).
- Maximum 3 attuned items. When all 3 slots are filled, the Attune action on other items is disabled.

---

### Gear Tab — Charge Badge

Displayed inline on weapon/magic item rows that have a charge resource. Not limited to attuned items — any item with charges shows this badge.

```css
.charge-badge {
  background: var(--gold-subtle);
  border: 1px solid var(--gold-border);
  color: var(--gold);
  font-family: var(--font-mono);
  font-size: 12px;
  border-radius: var(--radius-sm);
  padding: 3px 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
```

Inline −/+ buttons inside the badge adjust the charge count directly. The count is capped at the item's max charges and floored at 0. Charge state is synced to the Combat tab charge badge for the same item.

---

### Gear Tab — Currency Weight Toggle

Sits inline beside the Currency category label as a small toggle switch.

- **Default: off** — currency weight not counted toward carry total
- When off: weight badges on currency rows are dimmed (opacity 0.35), detail panels note "(not counted)"
- When on: weight is included in carry bar calculation immediately
- Persists per-character as `currencyWeightEnabled: boolean` in the character JSON
- Toggle: 28×16px, `--bg-inset` track (off) / `--accent` track (on), white knob

---

### Gear Tab — Ammunition Auto-Deduction

When a ranged weapon's Use button is tapped in the Combat tab, the app automatically decrements the matching ammo item in the Gear tab Bag.

- Ammo type is defined on the weapon: `ammoType: "arrow" | "bolt" | "dart" | null`
- `null` = no ammo tracking (melee weapons, self-replenishing items)
- Thrown weapons (daggers, handaxes) decrement a per-item thrown count, not a shared pool
- At 0, the ammo badge on the Combat tab weapon card turns `--danger` and reads "No arrows". Roll and Use buttons are disabled.
- Players can manually adjust ammo quantity in the Gear tab at any time.

---

### Stats Tab — Summary Row

Five stats in a horizontal strip pinned to the top of the Stats tab right panel. Always visible without scrolling.

| Stat | Source |
|---|---|
| Prof Bonus | Derived from character level |
| Initiative | DEX modifier (+ any bonuses) |
| Passive Perception | 10 + Perception bonus |
| AC | Armour + DEX + magic bonuses |
| Speed | Base speed from race/class |

Each cell: value in `--font-mono` 20px, label in 9px uppercase `--text-muted`. Separated by `1px solid --border` vertical dividers.

Gold magic buff dots on summary row cells open their tooltip **downward** (not upward) to avoid clipping behind the character switcher above.

---

### Stats Tab — Proficiency Marker (3 states)

A 20×20px circle used on every skill row and saving throw row. Three clearly distinct states — never rely on colour alone:

| State | Appearance | CSS |
|---|---|---|
| Not proficient | Hollow circle, grey border | `border: 1.5px solid --text-muted; background: transparent` |
| Proficient | Outlined accent circle, `◆` inside | `border: 1.5px solid --accent; background: --accent-subtle; color: --accent` |
| Expertise | Solid accent fill, `★` inside | `background: --accent; color: white` |

In edit mode, tapping a skill row cycles: none → proficient → expertise → none.

---

### Stats Tab — Other Proficiencies

Pill tags grouped by category (Armour, Weapons, Tools, Languages, and custom categories).

Each category has:
- A small `+ Add` button to the right of its label — adds a new pill to that category
- A dashed `+ Add` pill inline at the end of the pill row — same action, second affordance
- A full-width dashed `+ Add category` button below all categories — creates a new named category

Half-proficiency items use an amber pill variant with a ½ suffix.

---

### Stats Tab — Magic Item Buff Indicators

See **Magic Item Stat Indicators** section above (Section 7 component specs).

---

### Character Card (Home Screen)

```
┌─────────────────┐
│  [portrait/placeholder]  │
│  [display-md] Aragorn    │
│  [label-md text-secondary] Human Rgr 10 │
│  [stat-sm] HP 72/90  AC 16 │
└─────────────────┘
```

- Aspect ratio: 3:4 portrait. Portrait image fills top 55% of card. Placeholder: gradient from `--bg-elevated` to `--bg-surface` with centred `⚔️` icon.
- Name: `--font-display`, `display-md`
- Subtitle: `--font-body`, `label-md`, `--text-secondary`
- Stats: `--font-mono`, `stat-sm`, `--text-secondary`
- Border: `1px solid --border`
- Radius: `--radius-lg`
- Shadow: `--shadow-sm`
- On hover (desktop): border colour transitions to `--accent`, shadow to `--shadow-md`

---

### Buttons

Three variants. All minimum 44px touch height.

**Primary** — for the main action in a context
```css
background: var(--accent);
color: var(--text-inverse);
border-radius: var(--radius-md);
font: var(--font-body), label-lg, weight 600;
padding: 10px 20px;
```

**Secondary** — for secondary actions
```css
background: var(--bg-elevated);
color: var(--text-primary);
border: 1px solid var(--border-strong);
border-radius: var(--radius-md);
```

**Ghost** — for tertiary / destructive actions
```css
background: transparent;
color: var(--text-secondary);
border: 1px solid var(--border);
border-radius: var(--radius-md);
```

Danger variant: any button type can add `color: var(--danger)` and `border-color: var(--danger)` for destructive actions (delete, etc).

---

### Form Inputs

```css
background: var(--bg-inset);
border: 1px solid var(--border);
border-radius: var(--radius-md);
color: var(--text-primary);
font: var(--font-body);
padding: 10px 12px;
```

On focus:
```css
border-color: var(--accent);
outline: none;
box-shadow: 0 0 0 3px var(--accent-subtle);
```

Labels: `label-md`, `--text-secondary`, `--font-body`, displayed above the input with 4px gap.

---

### Section Headings (within tabs)

```
ATTACKS
─────────────────────────────
```

- Text: `label-md`, `--text-secondary`, `--font-body`, uppercase, letter-spacing: 0.08em
- Divider: `1px solid --border`
- Margin below: `--spacing-sm`
- Margin above: `--spacing-lg`

---

## 7. App Layout & Tab Architecture

### Overall Shell

The app uses a persistent two-column layout on tablet/desktop:

```
┌─────────────────────────────────────────────────────────┐
│  [Character Switcher — horizontal scrollable tabs]       │
├─────────────────┬───────────────────────────────────────┤
│                 │                                        │
│   Left Panel    │         Right Panel (tab content)      │
│   (persistent)  │                                        │
│                 │                                        │
└─────────────────┴───────────────────────────────────────┘
```

**Max width:** `1100px`, centred. Left panel: `clamp(200px, 30%, 300px)` — scales proportionally on wider iPads/tablets. Right panel: takes remaining flex space.

---

### Character Switcher

Horizontal scrollable row of pills above the left+right panel split. Each pill = one character. Active character uses `--accent` filled pill. `+ New` pill always at the end with a dashed border.

---

### Left Panel (persistent across all tabs)

Always visible. Contains in order:
1. Character name (`'Outfit'` weight 800) + race/class/level + lock icon + share/menu icons
2. HP block — large HP value, −/+ buttons, HP bar
3. AC / Init / Speed stat tiles (3-column grid)
4. Condition pills + `+ Add`
5. XP bar with level labels
6. Sync indicator (● Saved / ⟳ Saving... / ⚠ Offline)
7. **Sidebar tab grid — 2 columns** so more tabs can be added in future without layout changes

**Sidebar tab grid:** `display: grid; grid-template-columns: 1fr 1fr`. Each tab: icon + label. Active tab: `--tab-active-bg` background, `--tab-active-text` text, `--border` border. Current tabs: Combat, Stats, Spells, Gear, Background, Notes. Notes is always last.

---

### Right Panel — Tab Contents

#### Combat Tab

Sections in order:
1. **Attacks** — two-line cards (see Attack Card spec)
2. **Magic Items** — two-line cards with gold tint and charge badge (see Magic Items spec)
3. **Spell Slots** — compact inline pip groups, width fits content only, multiple per row
4. **Prepared Spells** — spell cards with Cast button and cast modal
5. **Death Saves** — hidden unless `hpCurrent === 0`

#### Stats Tab

- **Summary row** — sticky top bar: Prof Bonus, Initiative, Passive Perception, AC, Speed
- **Ability Scores** — 6-card grid
- **Saving Throws** — list with pip + full name + bonus
- **Skills** — full alphabetical list with 3-state proficiency marker
- **Other Proficiencies** — categorised pill tags (Armour, Weapons, Tools, Languages + custom)

#### Spells Tab

- **Spellcasting summary strip** — sticky top bar with four cells: Prepared (e.g. `5 / 7`), Spell Save DC (e.g. `15`, sub-label `8 + WIS + Prof`), Spell Attack Bonus (e.g. `+7`, sub-label `WIS + Prof`), Casting Stat (e.g. `WIS`, sub-label `Mod +3`). For multiclass characters with two different spellcasting stats, each class gets its own cell. Prepared count colours: normal when below limit, `--warning` when 1 slot remaining, `--danger` when at max.
- **Filter bar** — sticky: Class filter row + School filter row (independent, AND logic)
- **Spell list** — grouped by level, each group with slot pip status in header

#### Gear Tab

- **Carry weight bar** — sticky top
- **Equipped** section:
  - Attuned sub-section (always first, shows 1/3 slot tracker)
  - Then categories: Weapons, Armour, etc.
- **Bag** section:
  - Categories: Ammunition, Adventuring Gear, Currency
  - Currency has weight toggle (off by default)

#### Background Tab

Sections in order:

1. **Summary strip** — Class(es) + total level, alignment, background name. Read-only overview, always visible.
2. **Class & Multiclass** — one expandable card per class. Primary class shown with accent level badge and "Primary" pill. Multiclass entries shown with muted level badge. Each card expands to show subclass, hit die, spellcasting stat, save proficiencies, and levels in class. Edit / Remove buttons in detail panel. "Set as primary" action on multiclass entries. `+ Add multiclass` button below.
3. **Background** — background name + background feature description. Edit button top-right.
4. **Personality** — 2×2 grid of four fields: Traits, Ideals, Bonds, Flaws. Each has its own Edit button. Display-only until edited.
5. **Alignment** — current alignment displayed as text. Edit button opens (unlocks) the 3×3 alignment grid. Grid is locked/dimmed by default — cannot be accidentally changed. After selecting a cell, a "Confirm — [Alignment]" button appears. Confirming locks the grid again and updates the summary strip.
6. **Appearance** — freeform text. Edit button.
7. **Backstory** — freeform text, taller min-height. Edit button.
8. **Allies & Organisations** — list of expandable cards (NPC allies, factions, patrons). Each shows name + type tag. Expanded detail is freeform text. `+ Add ally or organisation` button at the bottom.

#### Notes Tab

Always the last tab. A user-managed sectioned notepad — each section is a named freeform textarea. Auto-saves on every keystroke (debounced, same as the rest of the app).

**Default sections — permanent, cannot be renamed or deleted:**
- Backstory
- Session Notes
- NPCs
- Party Notes

Default sections show a small 🔒 icon to the left of their label, signalling permanence. No delete or rename controls are shown on them.

**Custom sections — user-created, renameable, deletable:**
- Created via the `+ Add section` button at the bottom of the list
- Section name is an inline editable input, displayed uppercase — tapping it lets the user type a name immediately
- A ✕ delete button sits to the right of the name input
- Tapping ✕ opens a confirmation dialog before deleting ("This will permanently delete this section and all its notes. This cannot be undone.")
- The `+ Add section` button always stays at the bottom of the list

**Each section (default or custom):**
- Collapsible — a ▾ chevron in the top-right of the header collapses the textarea. Chevron rotates −90° when collapsed.
- Freeform textarea — no formatting, plain text. Grows naturally with content (auto-resizing or generous fixed minimum height).
- Character count shown bottom-right of the section, visible only while the textarea is focused.
- Border strengthens (`--border-strong`) while section is focused.

**Section order:**
- Default sections always appear first, in fixed order: Backstory, Session Notes, NPCs, Party Notes.
- Custom sections appear below the defaults, in the order they were created.
- Custom section reordering (drag to rearrange) is a future nice-to-have, not required at launch.

**Delete confirm dialog:**
- Centred modal with backdrop blur
- Title: `Delete "[section name]"?`
- Body: "This will permanently delete this section and all its notes. This cannot be undone."
- Two buttons: Cancel (ghost) and Delete (danger red)
- Closes on Cancel, backdrop tap, or after Delete is confirmed

---

### Cast / Use Modal

Slides up from bottom (bottom sheet pattern). Used for:
- Casting a spell at a chosen slot level
- Using a magic item and choosing how many charges to expend

Slot level options show pip availability inline. Unavailable levels are greyed out and non-interactive. Cantrips skip the level picker entirely.

---

Located in Settings screen. Displayed as a scrollable row of themed swatches, each showing the palette name and a three-colour preview swatch.

```
THEME
──────────────────────────────────────
[ Dungeon ✓ ] [ Arcane ] [ Forest ] [ Ember ] [ Frost ] [ Parchment ] [ Abyss ] [ Iron ]
```

Each swatch:
- 80×56px rounded card
- Background: the theme's `--bg-base`
- Three small colour dots inside: `--accent`, `--text-primary`, `--hp-high`
- Theme name below in the app's current `--font-body`
- Active theme: outer ring in current `--accent`, tick icon

On tap: apply immediately (no confirm step needed). Preference saved to `localStorage`.

---

## 9. Adding New Themes

To add a theme in future, a developer only needs to:

1. Add a new `[data-theme="name"]` CSS block with all tokens defined.
2. Add the theme name and display label to the theme config array used by the settings screen.
3. Optionally supply a `--font-body` override if a different typeface suits the palette.

No other code changes required.

---

## 10. Accessibility Baseline

- All colour combinations must meet **WCAG AA** contrast (4.5:1 for body text, 3:1 for large text and UI components).
- All interactive elements minimum **44×44px** touch target.
- Focus states are always visible — use the `box-shadow` approach above rather than relying on `outline: none`.
- The Parchment theme (light) must be tested independently — it has different contrast characteristics from the dark themes.
- Never convey information by colour alone — status icons (✓ ⟳ ⚠️) must accompany colour-coded states.

---

## 11. Animation

Keep motion subtle and purposeful. This is a utility app used at a game table — no one wants flashy transitions when they're in combat.

| Interaction | Animation |
|---|---|
| Theme switch | `transition: background-color 200ms ease, color 200ms ease` on root |
| Tab switch | Crossfade — `opacity: 0 → 1`, 150ms |
| HP bar change | `transition: width 300ms ease-out` |
| Spell slot tap | Scale pulse — `scale(0.9) → scale(1)`, 100ms |
| Modal appear | Fade + scale — `opacity: 0, scale(0.97) → opacity: 1, scale(1)`, 200ms ease-out |
| Card hover (desktop) | `box-shadow` and `border-color` transition, 150ms |
| Sync indicator change | Fade — 200ms |

No entrance animations on list items. No page transition animations. No auto-playing anything.

---

## 13. DM Mode

### DM Campaign Home Screen

Accessed by tapping a campaign card from the DM home. Full-width layout with a persistent left sidebar and a tabbed right panel.

#### Header

```
← Campaigns    The Fellowship         [ ▶ Start Session 15 ]  [ ⚙ ]
               Campaign · Session 14 in progress
```

- Back button (`← Campaigns`) returns to DM home
- Campaign name centred, subtitle shows current session state
- `Start Session` button — primary action, crimson (`--dm`), always visible
- If a session is currently live, button reads `▶ Resume Session` instead

#### Left Sidebar — Campaign Stats

Always visible regardless of active tab. Contains in order:

1. **Live session card** (if session active) — crimson tint, pulsing dot, shows real elapsed time + round/in-game time, `▶ Resume` button
2. Divider
3. **Sessions** — total count + date range
4. **Party Size** — player count
5. **Party Level** — average across active characters
6. **Encounters** — total across all sessions
7. **Total Play Time** — real-world hours

#### Right Panel Tabs

Four tabs: Sessions, Party, NPCs & Monsters, Campaign Notes.

---

### DM Campaign — Sessions Tab

Sessions listed most recent first, numbered. Each session row is expandable.

**Collapsed row shows:**
- Session number (large, `--font-mono`)
- Session name (editable by DM)
- Meta row: date, real elapsed time, players present count, encounter count
- Status badge: `● LIVE` in crimson, or `✓ Done` in green

**Expanded row shows:**
- Players present — chips showing character emoji + name + GitHub username. Absent players shown struck-through at reduced opacity.
- Encounters list — each encounter shows name, round count, in-game time, and outcome (Victory / Fled / Defeat)
- Live encounter shows `● Live` in crimson with current round/time

`+ Start Session N` dashed row at the bottom always increments to the next session number.

---

### DM Campaign — Party Tab

Organised by player, not by character. Each player has their own block.

**Player block structure:**
```
┌─ Header: [avatar] username  @github  ● online    [Manage Characters] ─┐
│  [character row] Aragorn · Human Ranger Lv10 · HP bar · Active         │
│  [character row] Alt Character · class · HP bar · Inactive (dashed)    │
└────────────────────────────────────────────────────────────────────────┘
```

**Character row states:**
| State | Border | Opacity | Badge |
|---|---|---|---|
| Active | Solid `--border-strong` | 100% | Green `Active` pill |
| Inactive | Dashed `--border` | 55% | Grey `Inactive` pill |

Tapping the Active/Inactive badge toggles the state directly on the row.

**Add Player / Manage Characters modal** (slides up from bottom):

Two modes, same modal:

*Add new player:*
1. DM types GitHub username
2. Taps `Fetch →`
3. App uses Octokit to read that user's character repo (standard file structure from onboarding)
4. All their characters appear as selectable rows
5. Characters not yet in the campaign show `+ Add` badge
6. DM taps to select, sets Active/Inactive, taps Save

*Manage existing player (tap "Manage Characters"):*
- Pre-filled with their username, characters pre-loaded
- Shows all characters from their account — including ones not in this campaign
- Active/Inactive toggles on existing campaign characters
- `+ Add` on characters not yet in campaign

**Key rule:** A player can have multiple characters in the same campaign. Multiple can be Active simultaneously (e.g. the player brought a backup character who is also participating). The DM controls which are active.

---

### DM Campaign — NPCs & Monsters Tab

Three categories, each with its own `+ Add` button:

1. **Bosses & Named NPCs** — crimson tint, full stat block support. Shows HP, AC, initiative modifier.
2. **Standard Enemies** — regular enemies used in encounters. Lightweight: name, type, CR, HP, AC, initiative.
3. **Ally NPCs** — friendly NPCs travelling with or assisting the party.

Quick-add creates a minimal entry (name, HP, AC, initiative modifier only). Full stat block can be filled in via an expanded detail panel — same expand/collapse pattern as gear and spell rows.

---

### DM Campaign — Campaign Notes Tab

Same section system as the player Notes tab. Default locked sections:
- **World & Lore** — setting, history, geography
- **Plot Threads** — active hooks, mysteries, planned beats
- **DM Notes (Private)** — never visible to players, even if they access the campaign repo

Custom sections can be added below. Same `+ Add section` button, inline editable name, collapsible, deleteable with confirmation.

**Privacy rule:** DM Notes (Private) must be stored in a separate file or encrypted field in the GitHub repo that the app never exposes to player accounts. The programmer must implement access control so players reading the campaign repo cannot see this section.

---


In D&D 5e, **1 round = 6 seconds** of in-game time. The battle timer tracks completed rounds only — individual turns do not affect the timer. The DM advances rounds manually.

**How it works:**
- The DM taps "Next Round" to advance the encounter
- Each tap: round counter +1, in-game time +6 seconds
### Secondary Screens & Pop-ups

#### Modal Pattern — All Modals Are Centred Overlays

**Every modal and pop-up in the app uses the centred overlay pattern without exception.** This includes player-side actions (Cast/Use, Short Rest, Long Rest, Level Up, Add Item, Add Spell) and DM-side actions (Add NPC, Create NPC, Build Encounter, Manage Players, Start Session) and all destructive confirmation dialogs.

There is no bottom-sheet pattern in this app. If you find yourself reaching for a slide-up sheet, use the centred overlay instead.

**Centred overlay specs:**
- Background: `--bg-elevated`, `border-radius: var(--radius-lg)` (12px)
- Max width: `520px`, width: `90vw`
- Max height: `85vh`, internally scrollable if content overflows
- Backdrop: `rgba(0,0,0,0.6)` with `backdrop-filter: blur(4px)`
- Shadow: `--shadow-md`
- Centred via `position: fixed; inset: 0; display: flex; align-items: center; justify-content: center`
- z-index: `1000`
- Animation: fade + scale — `opacity: 0, scale(0.97) → opacity: 1, scale(1)`, 200ms ease-out

**Reusable modal shell** — every modal must use this structure so the look is consistent:

```jsx
<div className="modal-backdrop" onClick={onClose}>
  <div className="modal-box" onClick={e => e.stopPropagation()}>
    <div className="modal-body">
      {/* content */}
    </div>
    <div className="modal-footer">
      <button className="btn-secondary" onClick={onClose}>Cancel</button>
      {/* primary action button */}
    </div>
  </div>
</div>
```

```css
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modal-box {
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  width: 90vw;
  max-width: 520px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  animation: modalIn 200ms ease-out;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--border);
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  flex-shrink: 0;
}

@keyframes modalIn {
  from { opacity: 0; transform: scale(0.97); }
  to   { opacity: 1; transform: scale(1); }
}
```

A `Cancel` button sits in the footer of each modal. A dedicated ✕ close button in the top-right corner of each modal is **to be added in a later pass** — the Cancel button covers the basic case for now.

---

#### Level Up Flow

Triggered when a character's XP crosses a level threshold. Presented as a step-by-step flow — one decision at a time, with a step indicator showing progress. The number of steps depends on what the new level unlocks:

**Simple level** (no choices — e.g. Ranger 6):
- Shows new features auto-applied (Extra Attack, HP increase, proficiency bonus change)
- Single screen, one `Confirm Level Up` button
- HP increase auto-rolled and displayed, applied on confirm

**Feat / ASI level** (e.g. Fighter 4):
- Step 1: Choose between Ability Score Improvement or Feat
- If ASI: 6-tile grid to allocate 2 points across ability scores (max 20 per stat)
- If Feat: searchable feat list with descriptions
- Gold colour treatment — permanent character-defining choice

**Skill proficiency pick:**
- Checkbox grid of available skills
- Already-proficient skills greyed out and non-interactive
- Selection counter shown (`1 / 2 selected`)

**Archetype / Subclass choice** (e.g. Ranger 3):
- Radio option cards with name and description
- Permanent choice warning shown
- Confirm button disabled until a selection is made

---

#### Short Rest

Bottom sheet. Player chooses how many Hit Dice to spend.

- Shows current HP, available Hit Dice count and die type
- Stepper to choose how many HD to spend
- Estimated recovery shown (average result)
- Lists which SR abilities will restore on completion
- Applying auto-rolls the HD, adds result to HP (capped at max), marks HD as spent, resets SR abilities

---

#### Long Rest

Bottom sheet. Summary of everything that will be restored before confirming.

- HP → full
- Spell slots → all restored
- Hit Dice → half max restored (rounded down)
- All SR and LR abilities → reset
- Death saves → cleared
- Concentration spells → flagged as ending (⚠ warning row)
- Single `Take Long Rest` confirm button — all effects applied at once

---

#### Add Item (Gear Tab)

Two-tab modal: **Search Database** and **Create Custom**.

Search tab: searches the SRD item database. Results show name, type, weight, value. Tapping a result adds it directly to the appropriate gear category.

Create Custom tab: form with name, category dropdown, weight, value, quantity, attunement toggle (yes/no), description textarea.

---

#### Create Custom Item

Name, category (Armour / Weapon / Adventuring Gear / Ammunition / Currency / Magic Item), weight, value, quantity, attunement required toggle, description. All optional except name and category.

---

#### Multiclass Display

The character name area in the left panel shows the **primary class only** in the subtitle. If the character has multiclass levels, a small badge appears inline:

- Single class: `Human · Wizard · Lv 8` — no badge
- 2 classes: `Human · Ranger · Lv 10` + `+1` badge
- 3 classes: `Elf · Rogue · Lv 12` + `+2` badge

The badge number = number of multiclass entries (not counting primary). Tapping the badge navigates to the Background tab → Class & Multiclass section.

---

#### Class / Race Ability Use Counters

Displayed in the Combat tab Class & Race Abilities section. Each ability shows a use counter badge:
- Available: green `1 / 1 SR` or `1 / 1 LR`
- Spent: grey `0 / 1 SR`

**No reset button is shown.** Resets are handled automatically:
- SR abilities reset on Short or Long Rest
- LR abilities reset on Long Rest only
- Per-turn abilities (e.g. Dread Ambusher) reset when the encounter ends or a new session starts

Manual override (for edge cases) is deferred to a future update, likely integrated with the DM initiative tracker.

---

#### DM — Build / Plan Encounter

Accessible from the Session view Encounter tab. DM names the encounter and builds the enemy list before the session.

Each enemy type gets its own card showing all individual instances (A, B, C…), each with:
- An editable Max HP input — auto-rolled from the stat block hit die on creation
- A 🎲 re-roll button per instance
- A ✕ delete button to remove that specific instance
- `+ Add instance` to add another of the same type
- `Re-roll all` to regenerate all HP values for that type

`+ Add enemy from NPC library or SRD` button at the bottom opens the Add NPC search modal.

Difficulty estimate shown at the bottom (Easy / Medium / Hard / Deadly + total XP).

When the encounter starts in the combat view, each individual enemy's HP is pre-loaded from these values.

---

#### DM — Add NPC / Enemy

Single search bar searches **both the SRD and the campaign's custom NPC library simultaneously**. Results are labelled by source (purple SRD badge, crimson Campaign badge).

Source filter chips: All sources / SRD only / My campaign.

Each result shows contextual add buttons based on CR:
- Standard enemies: `Enemy` · `Ally`
- Boss-tier (CR 5+): `Boss` · `Enemy` · `Ally`

A `+ Can't find what you need? Create a custom NPC →` link at the bottom opens the Create NPC screen.

---

#### DM — Create NPC

Two modes toggled at the top of the screen:

**⚡ Quick mode** (mooks):
- Name, HP, AC, Initiative, CR, Speed, Type
- Hit die field (used for auto-rolling HP in encounter builder)
- Free-text Actions/Notes field — unstructured, DM types whatever they need
- Category: Standard Enemy / Boss / Ally NPC

**📋 Full Stat Block mode** (bosses):
- Identity: name, size, type, alignment
- Core stats: AC, HP, hit die, speed, CR, proficiency bonus
- All 6 ability scores — modifier auto-calculated and displayed below each input
- Resistances, damage immunities, condition immunities — tag pill system with `+ Add`
- Actions — structured entries with name, to-hit, damage die, damage type, effect note. `+ Add Action` button.
- Traits — name + description per trait. `+ Add Trait` button.
- Senses (darkvision, tremorsense, etc.)
- Campaign category: Standard Enemy / Boss / Ally NPC

All NPCs saved to the campaign repo. SRD data is read-only — custom NPCs created from scratch or cloned from SRD entries.

---

> **Note — Exit / Abort buttons:** All secondary screens and modals currently use a `Cancel` button in the footer. A dedicated ✕ close button in the top-right corner of each modal is **to be added in a later pass**. The Cancel button covers the basic case for now.

---


DM mode is toggled from the home screen header using a Player/DM pill switch. Switching modes is non-destructive — player characters are untouched. The mode persists in `localStorage`.

**Visual language:** DM mode uses crimson (`#e05252`) as its accent colour throughout, replacing the player-mode purple. The app border, header gradient, active buttons, and live indicators all use DM crimson. This makes it immediately obvious which mode the user is in.

---

### DM Home Screen

Landing page in DM mode. Campaigns displayed as a grid of cards showing name, session status, player count, avg party level, next session date. Live sessions get a pulsing `● Live` badge and an `▶ Enter Session` button inside the card body. Planning campaigns show a dashed `Start First Session` button. Recent sessions listed below the grid.

---

### Campaign Home Screen

Opens when DM taps a campaign card. Persistent left sidebar + four tabbed right panel.

**Left sidebar:** Live session card (elapsed time, round/in-game time, Resume button) + campaign stats (session count, party size, avg level, total encounters, total play time).

**Sessions tab** — numbered rows, most recent first. Expandable to show players present (absent struck through) and encounter list with outcomes.

**Party tab** — player-block layout, one block per player. Each block shows GitHub username, online status, Manage Characters button, and character rows (name, class, HP, Active/Inactive badge). Multiple characters per player supported, multiple can be Active simultaneously.

*Manage Characters modal:* DM enters GitHub username → Octokit fetches their repo using the standard onboarding file structure → shows all characters → DM sets Active/Inactive per character.

**NPCs & Monsters tab** — three categories: Bosses (crimson tint), Standard Enemies, Ally NPCs. Each row shows name, type, CR, HP, AC, initiative modifier. **SRD integration:** full SRD monster library ships with the app. DM searches and pulls any creature directly — no manual entry. SRD fields map to: name, HP, AC, initiative, `actions[]`, `special_abilities[]`, `legendary_actions[]`.

**Campaign Notes tab** — same collapsible section system as player Notes. Default locked sections: World & Lore, Plot Threads, DM Notes (Private). **Privacy rule:** DM Notes (Private) stored in a separate access-controlled file — never readable by player accounts.

---

### Session View

Opens in a **new browser tab**. Campaign home remains open in the previous tab.

**Left panel:**
- Real-world session clock (counts up, pauseable, reset requires confirmation)
- Round counter + in-game time from active encounter
- Three tabs: Party, Encounter, Notes

**Party tab — character reference card grid:**

`repeat(auto-fill, minmax(280px, 1fr))`. Each card shows:
- HP with colour-coded bar (read-only, synced from player sheet)
- Four stat tiles: Initiative, AC, Passive Perception, Spell Save DC
- Secondary: Resistances, Immunities, Proficiencies, Alignment
- Condition pills (read from player sheet)
- ✓/✕ attendance toggle (top-right) — marks present/absent for session record

**Encounter tab:** Active encounter with `⚔️ Enter Encounter View →` button. Past encounters from this session. `+ New Encounter` at bottom.

**Notes tab:** Session-specific notes — What Happened, DM Notes (Private), Loot Given Out. `+ Add section` for custom sections.

---

### Encounter / Combat View

Full screen — no left panel. All space devoted to combat.

**Top bar:** Encounter name, round counter, in-game time (6s × rounds), enemies remaining count, End Encounter button.

**Active Turn bar:** Current combatant name + type pip (purple = player, crimson = enemy) + initiative. Next 2 combatants shown. `Next Turn →` advances the initiative order. When the order wraps back to position 0, round increments by 1 and in-game time adds 6 seconds.

**Two-column layout — 1/4 players · 3/4 enemies:**

*Players column (25%):* Compact read-only rows — initiative badge, name, HP synced from player sheet, small HP bar. Tap to expand and see conditions. No HP editing.

*Enemies column (75%):* Full DM control. Each enemy row has inline HP stepper (−/+ buttons). Grouped enemies (Goblins ×3) each get a labelled stepper (A, B, C). Tap to expand:
- Stat row: Attack bonus, AC, Save DC
- Conditions with `+ Add` pill
- **Actions section:** each action on its own row — name + damage badges + brief effect note. Populated from SRD data automatically.
- **Traits section:** passive traits listed separately from actions
- Defeated enemies move to a struck-through "Defeated" section at the bottom

**Initiative setup overlay (at encounter start):**
- All combatants listed with auto-rolled initiative (d20 + DEX mod), editable
- Individual 🎲 re-roll button per combatant
- Players can override with their own roll
- `Start Encounter →` sorts by initiative and begins

---

### Battle Timer

**1 round = 6 seconds** of in-game time. Turns do not affect the timer — only completed rounds.

- `Next Turn →` advances the combatant pointer
- When the pointer wraps back to position 0: round +1, in-game time +6s
- Real-world session clock runs independently from encounter start
- Reset requires confirmation — resets round counter and in-game time only, session clock continues

---

*End of Design System v2.1*



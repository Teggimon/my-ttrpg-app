# TTRPG Character Sheet App — Design Brief & UI Flows

**Version 4.0 — Complete Screen Design**
**Document Date: April 2026**

---

## 1. Overview

A Progressive Web App (PWA) for creating, managing, and sharing TTRPG characters (primarily D&D 5e) with real-time synchronisation via GitHub as the backend. Game Masters and players can view live character updates across any device — phone, tablet, or desktop — with a native app feel, no App Store required. No proprietary backend — users own their data entirely.

---

## 2. Core Philosophy

- **GitHub is the database.** Every character, custom item, and custom spell is a file in a repository.
- **One codebase, every device.** A PWA runs natively on iPhone, Android, tablet, and desktop from a single web build.
- **Ownership is structural, not just visual.** The edit lock is enforced at the GitHub permission level — not just hidden UI buttons.
- **Players own their characters absolutely.** No one can edit a character they don't own, full stop.
- **Copying grants full ownership.** A copied character belongs entirely to the person who copied it.
- **GitHub is invisible to the user.** Players never think about commits, repos, or APIs. The app abstracts this entirely.

---

## 3. User Roles

| Role | Create | Edit Own | View Others | Edit Others | Copy | GM Dashboard |
|---|---|---|---|---|---|---|
| Player | ✅ | ✅ | ✅ (if shared) | ❌ | ✅ | ❌ |
| Game Master | ✅ | ✅ | ✅ (live view) | ❌ | ✅ | ✅ |

GM mode is a toggle any user can activate — not a fixed role. A person can be a GM in one campaign and a player in another. Ownership transfers permanently on copy.

---

## 4. Ownership & Edit Lock System

### The Core Rule

**One character, one owner. Always.**

### Two Layers of Enforcement

1. **Structural (GitHub):** The character file lives in the owner's GitHub repository. Only the owner has write access. GitHub rejects any push from a non-owner — even if attempted directly via the API.

2. **UI (App):** The app checks the `owner` field against the logged-in GitHub user. If they don't match, all edit controls are absent — not hidden, not greyed out, simply not there.

### Owner Identity in Every Character File

```json
{
  "meta": {
    "owner": "github:username",
    "characterId": "uuid-1234",
    "copiedFrom": null,
    "version": 1
  }
}
```

### Lock / Unlock Toggle

The sheet is **unlocked by default** for the owner during play. A lock icon in the header toggles between locked and unlocked — protecting against accidental taps when handing a phone to someone or browsing without editing.

- Non-owners always see a permanently locked sheet with no toggle
- The lock icon doubles as a clear ownership indicator at all times

### Auto-Save Behaviour

There is no manual save button anywhere in the app. Changes save automatically via **debounce** — the app waits 1–2 seconds after the last change, then pushes to GitHub silently. A sync indicator in the header confirms the state:

```
✓ Saved       — all changes pushed
⟳ Saving...   — debounce / pushing
⚠️ Offline    — changes queued locally
```

### Copy Flow

1. Viewer taps "Copy to My Characters"
2. Character JSON is forked into their own GitHub repo
3. `owner` field rewritten to their GitHub handle
4. `copiedFrom` logs original character ID for provenance
5. From that moment — entirely theirs, fully independent

---

## 5. GitHub Integration Architecture

### Repository Types

**Personal Character Repo (every user)**
Each user has their own GitHub repo created during onboarding. All their characters live here. Only they have write access.

```
/characters
  /aragorn-ranger.json
  /frodo-rogue.json
/custom-items
  /ring-of-power.json
/custom-spells
  /shadow-bolt.json
```

**Party Repo (optional, GM creates)**
A shared GitHub repo for party-wide custom content. All party members can contribute. Characters are never stored here — only shared custom content.

```
/custom-spells
  /shadow-bolt.json
/custom-items
  /one-ring.json
/party-notes
  /session-notes.json
```

**Standard Content Repo (central, read-only)**
A curated public GitHub repo maintained by the app. Contains all SRD spells, items, conditions, classes, races, and backgrounds. Fetched and cached locally. Never hardcoded in the app.

**Custom Repositories (user-added)**
Users can connect additional GitHub repos — community homebrew packs, other campaign repos — from the Content Library. These appear as a searchable source alongside SRD and personal content.

### Sharing Model

Characters are shared by URL. If a player's repo is public, anyone with the link can read the file. The GM polls this URL every 15–30 seconds for live updates. No repo access needed to view — just the URL.

```
Player repo (public character file)
github.com/aragorn/ttrpg-characters/aragorn.json
    │
    └── GM polls every 30s → live updates in party dashboard
```

---

## 6. Character Data Model

```json
{
  "meta": {
    "owner": "github:username",
    "characterId": "uuid",
    "copiedFrom": null,
    "system": "dnd5e",
    "version": 1,
    "lastUpdated": "2026-04-26T10:00:00Z"
  },
  "identity": {
    "name": "Aragorn",
    "race": "Human",
    "class": [{ "name": "Ranger", "level": 10 }],
    "background": "Outlander",
    "alignment": "Chaotic Good",
    "xp": 64000,
    "portrait": null
  },
  "stats": {
    "abilityScores": { "str": 18, "dex": 16, "con": 14, "int": 12, "wis": 15, "cha": 13 },
    "savingThrows": { "str": true, "dex": true },
    "skills": {
      "athletics": "proficient",
      "acrobatics": "expert",
      "stealth": "proficient"
    }
  },
  "combat": {
    "hpMax": 90,
    "hpCurrent": 72,
    "hpTemp": 0,
    "ac": 16,
    "initiative": 3,
    "speed": 30,
    "deathSaves": { "successes": 0, "failures": 0 },
    "conditions": ["poisoned"]
  },
  "inventory": [
    {
      "itemId": "longsword-plus-1",
      "name": "Longsword +1",
      "quantity": 1,
      "equipped": true,
      "attuned": false,
      "custom": false,
      "weight": 3,
      "enhancement": 1,
      "damage": { "dice": "1d8", "type": "slashing", "versatile": "1d10" },
      "effects": [
        {
          "stat": "attackRoll",
          "mode": "add",
          "value": 1,
          "notes": "Magic bonus applies to attack and damage"
        }
      ],
      "properties": ["versatile"]
    }
  ],
  "spells": {
    "spellcastingAbility": "wis",
    "slots": {
      "1": { "max": 4, "used": 2 },
      "2": { "max": 3, "used": 1 }
    },
    "known": ["hunters-mark", "cure-wounds", "misty-step"],
    "prepared": ["hunters-mark", "cure-wounds"],
    "concentration": "hunters-mark"
  },
  "customContent": {
    "spells": ["shadow-bolt"],
    "items": ["ring-of-power"]
  },
  "notes": {
    "personalityTraits": "",
    "ideals": "",
    "bonds": "",
    "flaws": "",
    "appearance": "",
    "backstory": "",
    "alliesAndOrganisations": "",
    "general": ""
  },
  "settings": {
    "encumbranceTracking": false
  }
}
```

---

## 7. Item & Weapon Data Model

Every item uses the same universal schema. Fields that don't apply (e.g. damage on a non-weapon) are left null.

```json
{
  "itemId": "uuid",
  "name": "Longsword +1",
  "type": "weapon",
  "weight": 3,
  "description": "A finely balanced blade with a magical edge.",
  "enhancement": 1,
  "damage": {
    "dice": "1d8",
    "type": "slashing",
    "versatile": "1d10"
  },
  "requiresAttunement": false,
  "equipped": true,
  "attuned": false,
  "effects": [
    {
      "stat": "attackRoll",
      "mode": "add",
      "value": 1,
      "notes": "Magic bonus applies to attack and damage rolls"
    }
  ],
  "properties": ["versatile"]
}
```

**Effect modes:**
- `add` — adds value to existing stat (negative values supported for cursed items)
- `set` — overrides stat to exact value regardless of base score

**Supported effect stats:**
STR, DEX, CON, INT, WIS, CHA, AC, Attack Roll, Damage, Speed, HP Max, Saving Throws, Spell Save DC, Spell Attack Modifier

**Magic enhancement bonus** — applies automatically to both attack rolls and damage rolls for weapons. Tracked as a separate field from other effects for clarity.

**Weapon properties** — finesse, thrown, heavy, reach, light, two-handed, versatile etc.

Equipped weapons automatically surface in the Combat tab as attack cards with fully calculated bonuses.

---

## 8. Screen Designs

---

### Screen 1 — Character Sheet

The primary screen. Everything else in the app exists to support this.

#### Header (always visible)

```
[ Aragorn 10 ]  [ Frodo 7 ]  [ Gandalf 20 ]  [ + ]
────────────────────────────────────────────────────
🔓  Aragorn                              [Share] [⋮]
    Human · Ranger · 10

    HP  72 / 90  [ - ]  [ + ]
    AC  16
    Conditions: [ Poisoned ] [ Stunned ]

    ✓ Saved
────────────────────────────────────────────────────
    ⚔️       🎲       ✨       🎒       📝
```

**Character switcher** — horizontal scrollable tab bar showing name + level. [ + ] creates a new character.

**Lock toggle** — unlocked by default for owner. Tap to lock. Always locked for non-owners with no toggle shown.

**HP** — always visible with +/- controls for quick editing during play.

**AC** — always visible, display only in header. Edited in Combat tab.

**Conditions** — active conditions shown as pills. Managed in Combat tab.

**Sync indicator** — ✓ Saved / ⟳ Saving... / ⚠️ Offline. Always visible, unobtrusive.

**Tab bar** — five icon tabs to save space on mobile.

---

#### Combat Tab

```
⚠️ DEATH SAVES                    (HP = 0 only)
─────────────────────────────
Successes  ○ ○ ○
Failures   ○ ○ ○

Conditions
─────────────────────────────
[ Poisoned ] [ Stunned ]  [ + ]

Armour Class
─────────────────────────────
16  ✏️
(manual for now — V2: auto-calculated from equipped items)

Initiative
─────────────────────────────
+3
(derived from DEX modifier — display only)

ATTACKS
─────────────────────────────
Longsword +1
  Attack    +8        (STR +4, Prof +3, Magic +1)
  Damage    1d8+5     Slashing
  Versatile 1d10+5
            [ Roll Attack ]

Dagger
  Attack    +5
  Damage    1d4+3     Piercing
  Thrown    20/60ft
            [ Roll Attack ]

SPELLS
─────────────────────────────
I ●●○○  II ●●○  III ●○○  IV ○
V ○  VI ○  VII ○  VIII ○  IX ○

Hunter's Mark        I    🔵
  Range 90ft · Duration 1hr conc
            [ Cast ]

Cure Wounds          I
  Range Touch · Healing 1d8+4
            [ Cast ]

Fireball             III
  Range 150ft · Damage 8d6 Fire
            [ Cast ]
```

**Death Saves** — appears only at HP = 0. Tap circles to fill. Disappears when HP restored above 0.

**Attacks** — auto-populated from equipped weapons. Equipping a weapon in Inventory pins it here automatically. Calculated bonuses shown with modifier breakdown.

**Spell slots** — rows I–IV and V–IX. Only rows with available slots shown. Filled pip = available, empty = expended.

**Prepared spells** — auto-populated from Spells tab. Tapping [ Cast ] opens upcast picker when multiple slot levels are available:

```
Cast Cure Wounds
─────────────────────────────
I  ●●○○  → 1d8+4 healing
II ●●○   → 2d8+4 healing
III ●○○  → 3d8+4 healing

[ Cancel ]
```

Cantrips and spells with only one available slot level cast immediately — no picker. Casting expends the slot, updates the tracker, and flags concentration automatically.

**🔵** marks the active concentration spell. Only one at a time. Casting a new concentration spell replaces the existing one.

---

#### Stats Tab

```
┌──────┐ ┌──────┐ ┌──────┐
│  +4  │ │  +3  │ │  +2  │
│  18  │ │  16  │ │  14  │
│ STR  │ │ DEX  │ │ CON  │
│  💪  │ │      │ │      │
└──────┘ └──────┘ └──────┘

┌──────┐ ┌──────┐ ┌──────┐
│  +1  │ │  +2  │ │  +1  │
│  12  │ │  15  │ │  13  │
│ INT  │ │ WIS  │ │ CHA  │
│      │ │  💪  │ │      │
└──────┘ └──────┘ └──────┘

💪 = saving throw proficiency

Skills                          [ Edit ]
─────────────────────────────
◇ Athletics        +4   STR
◈ Acrobatics       +7   DEX
◆ Stealth          +5   DEX
◇ Perception       +4   WIS
◆ Survival         +4   WIS
```

**Ability scores** — modifier displayed large, raw score below. Two rows of three.

**Skill proficiency states:**
- ◇ Not proficient
- ◆ Proficient — proficiency bonus added
- ◈ Expert — double proficiency bonus

**Edit mode** — tap [ Edit ] to unlock. Tap a skill to cycle ◇ → ◆ → ◈ → ◇. Tap [ Done ] to lock. Auto-saves via debounce. Ability scores also locked by default — only editable in Edit mode to prevent accidental changes mid-session.

---

#### Spells Tab

```
Spell Slots
─────────────────────────────
I ●●●● II ●●○ III ●○○ IV ○
V ○ VI ○ VII ○ VIII ○ IX ○

Spells                          👁️
─────────────────────────────
Cantrips
  Fire Bolt
  Mage Hand
  Prestidigitation

Level 1
  Cure Wounds        ✓ prepared
  Hunter's Mark  🔵  ✓ prepared
  Thunderwave        · unprepared  (visible when 👁️ open)

Level 2
  Misty Step         ✓ prepared
  Mirror Image       · unprepared  (visible when 👁️ open)
```

**Spell slots** — same tracker as Combat tab, same data. Updates in both places simultaneously.

**Visibility toggle:**
- 👁️ closed — prepared spells only
- 👁️ open — full spellbook, unprepared spells greyed out

Tapping an unprepared spell while 👁️ open and sheet is unlocked toggles it as prepared — for long rest spell preparation.

Tapping any spell expands inline to show full details without leaving the tab.

---

#### Inventory Tab

```
Carrying  47 / 270 lbs              ⚙️
████░░░░░░░░░░░░░░░░

Longsword +1        ×1   ⚔️ equipped
Shield              ×1   ⚔️ equipped
Healing Potion      ×3
Rope (50ft)         ×1
Torch               ×5

[ 🔍 Search items...    ]  [ + ]
```

**Carrying capacity** — optional, toggled per character via ⚙️. Capacity = STR score × 15 lbs.

**⚔️** = equipped. Equipping a weapon automatically pins it to Combat tab. Unequipping removes it.

**Search** — unified search across SRD, personal content, party content, and connected custom repos. Results labelled by source.

**[ + ] Create Item form:**

```
New Item
─────────────────────────────
Name        [ ________________ ]
Type        [ Weapon ▾ ]
Weight      [ ___ ] lbs
Description [ ________________ ]

Enhancement (magic bonus)
[ +0 ▾ ]  → applies to Attack + Damage automatically

Damage (weapons only)
Dice        [ 1d8 ▾ ]
Type        [ Slashing ▾ ]
Versatile   [ toggle ] → [ 1d10 ▾ ]

Properties
[ Finesse ] [ Thrown ] [ Heavy ]
[ Reach ] [ Light ] [ Two-Handed ]

Effects
[ + Add Effect ]

  Stat      [ STR ▾ ]
  Mode      [ Add | Set ]
  Value     [ +2  ]
  Notes     [ ________________ ]

Requires Attunement  [ toggle ]
Equipped             [ toggle ]

[ Save to My Repo ]
```

All items use the same form. Damage fields are greyed out for non-weapons. Multiple effects can be added. Stat and Value are optional if Notes alone describes the effect — useful for conditional or narrative effects like "advantage on Perception checks" or "resistance to fire damage."

---

#### Notes Tab

```
Personality Traits
[ ________________________________ ]

Ideals
[ ________________________________ ]

Bonds
[ ________________________________ ]

Flaws
[ ________________________________ ]

Appearance
[ ________________________________ ]

Backstory
[ ________________________________ ]
[ ________________________________ ]
[ ________________________________ ]

Allies & Organisations
[ ________________________________ ]

General Notes
[ ________________________________ ]
[ ________________________________ ]
```

All fields freeform text. Each expands as the player types. All auto-save via debounce. All locked when sheet is locked.

---

### Screen 2 — Home Screen

```
┌────────────────────────────────────┐
│ ⚔️ TTRPG Sheet          👤  ⚙️     │
│                      GM Mode  [🔘] │
└────────────────────────────────────┘

My Characters
─────────────────────────────
┌───────────────┐ ┌───────────────┐
│ ░░ portrait ░ │ │               │
│ Aragorn       │ │       +       │
│ Human Rgr 10  │ │  New Character│
│ HP 72/90 AC16 │ │               │
└───────────────┘ └───────────────┘

Shared With Me
─────────────────────────────
┌───────────────┐ ┌───────────────┐
│ ░░ portrait ░ │ │ ░░ portrait ░ │
│ Legolas       │ │ Gimli         │
│ Elf Rgr 8     │ │ Dwarf Ftr 8   │
│ 👁️ @fellowship│ │ 👁️ @fellowship│
└───────────────┘ └───────────────┘

PARTY DASHBOARD  (GM mode only)
─────────────────────────────
┌──────────────────────────────────┐
│ Legolas  HP ████░░  65/80  AC 15 │
│ Gimli    HP ██░░░░  40/95  AC 18 ⚠️│
│ Frodo    HP █████░  52/70  AC 13 │
└──────────────────────────────────┘
[ Open Full Dashboard → ]
```

**Character cards** — portrait fills top of card (placeholder when no image). Name, race/class/level, HP and AC shown. Grid: 2 columns mobile, 3 tablet, 4 desktop.

**[ + New Character ]** — last card in My Characters grid.

**Shared With Me** — same card design. 👁️ and owner handle marks these as not yours.

**Card interactions:**
- Mobile: long press → context menu
- Desktop: hover → action icons appear on card, or right click

**Own character context menu:**
```
✏️ Edit Character
🔗 Share
📋 Copy Character
🗑️ Delete
```

**Shared character context menu:**
```
👁️ View Character
🗑️ Remove from Shared With Me
   "Only removes from your view. Original unaffected."
```

**GM Mode toggle** — unlocks Party Dashboard and GM features. Saved preference per device.

**Party Dashboard preview** — compact live view in GM mode. [ Open Full Dashboard ] navigates to dedicated GM screen.

---

### Screen 3 — GM Party Dashboard (V1)

#### Party Summary Cards

```
PARTY DASHBOARD                [ + Add Character ]
─────────────────────────────
┌──────────────────────────────────┐
│ Legolas  Elf · Ranger 8          │
│ HP ████████░░░░  65/80           │
│ AC 15   Init +5   Passive Perc 18│
│ Spell Save DC —   Spell Atk —    │
│ Conditions: —                    │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ Gimli  Dwarf · Fighter 8    ⚠️   │
│ HP ██░░░░░░░░░░  40/95           │
│ AC 18   Init +1   Passive Perc 11│
│ Spell Save DC —   Spell Atk —    │
│ Conditions: Poisoned             │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ Gandalf  Human · Wizard 20       │
│ HP ████████████  170/170         │
│ AC 12   Init +2   Passive Perc 14│
│ Spell Save DC 19  Spell Atk +11  │
│ Conditions: —                    │
└──────────────────────────────────┘
```

**Stats shown per card:**
- HP with visual progress bar
- AC
- Initiative modifier
- Passive Perception
- Spell Save DC (casters only — hidden for non-casters)
- Spell Attack Modifier (casters only)
- Active conditions

**⚠️** — appears when HP is low or conditions are active.

All data pulls live from each player's character file. Updates automatically via polling.

Tapping a card opens the full read-only character sheet for that character.

[ + Add Character ] — paste a character share link to add to party view.

---

#### V1 Initiative Tracker

```
INITIATIVE TRACKER
─────────────────────────────
[ Start Encounter ]
```

**Encounter setup:**

```
New Encounter
─────────────────────────────
Party — auto populated from party view
✓ Legolas      Init +5
✓ Gimli        Init +1
✓ Frodo        Init +4
✓ Gandalf      Init +2

Enemies
─────────────────────────────
Enemy 1   Init [ +2 ]  🗑️
Enemy 2   Init [ +1 ]  🗑️

[ + Add Enemy ]

[ Roll Initiative ]
```

Enemy names default to Enemy 1, Enemy 2 etc — editable. Initiative modifier is the only required field.

**Tie breaking:**

When a tie is detected after rolling, a tie breaker modal appears:

```
Tie Breaker
─────────────────────────────
Legolas and Frodo both rolled 14.
Reroll to break the tie.

Legolas  [ Roll ] →  6
Frodo    [ Roll ] →  11

Frodo goes first!

[ Confirm Order ]
```

Only tied combatants reroll. Their position in the overall order is preserved. Rerolls again if still tied. Scales to any number of tied combatants.

**Active encounter:**

```
Round 1
─────────────────────────────
▶ Legolas       19   — ACTIVE
  Enemy 2       15
  Frodo         14
  Gandalf       12
  Gimli         8
  Enemy 1       4
  Enemy 3       2

[ Next Turn ]  [ End Encounter ]
```

▶ marks active turn. [ Next Turn ] advances order. End of list loops to Round 2 with round counter incrementing. Downed players handled naturally at the table in V1 — no special app logic.

---

### Screen 4 — Content Library

```
CONTENT LIBRARY
─────────────────────────────
[ SRD ] [ My Content ] [ Party ] [ Custom ]

🔍 Search all content...          [ + ]

─────────────────────────────
Fireball              SRD · Spell · Level 3
Cure Wounds           SRD · Spell · Level 1
Longsword             SRD · Item · Weapon
Shadow Bolt           My Content · Spell
One Ring              Party · Item
Flame of Destiny      Custom Repo · Item
```

**Tabs:**
- **SRD** — official open-licence content, read only
- **My Content** — personal custom spells and items
- **Party** — shared content from connected party repo
- **Custom** — content from additionally connected repositories

**Search** — searches across all active tabs simultaneously. Results clearly labelled by source.

**[ + ]** — opens creation form. Item or spell. Saved to personal or party repo.

**Custom Repository Management (in Custom tab):**

```
Custom Repositories
─────────────────────────────
Community Homebrew Pack
github.com/community/homebrew
[ View ] [ Disconnect ]

[ + Add Repository ]
[ GitHub repo URL              ]
[ Connect ]
```

---

### Screen 5 — Onboarding

```
Landing Screen
─────────────────────────────
         ⚔️ TTRPG Sheet

   Create, share and track your
   characters across every session

   [ Sign in with GitHub ]

   Your characters live in your
   own GitHub repository.
   You own your data, always.
```

iOS first visit — additional prompt shown before sign in:
```
"For the best experience, add TTRPG Sheet
to your home screen via Share → Add to Home Screen"
[ Show me how ]  [ Continue in browser ]
```

```
Step 1 — Create Character Repo
─────────────────────────────
Welcome, Aragorn! 👋

First let's create your character repository.
This is where all your characters are stored —
in your own GitHub account. Always yours.

Repo name
[ ttrpg-characters ]

[ Create My Repository ]
```

```
Step 2 — GM Question
─────────────────────────────
One quick question...

Do you ever run games as a Game Master?

[ Yes, I'm a GM ]
[ No, just a player ]

You can change this any time in settings.
```

**Player path:**
```
All set! 🎲

Want to create your first character?

[ Create Character ]
[ Go to Home ]
```

**GM path:**
```
Step 3 — Party Repo Setup
─────────────────────────────
Set up a Party Repository

A shared space for your party's
custom content and homebrew.

Repo name
[ my-party-repo ]

[ Create Party Repo ]
[ Skip for now ]
```

```
GM All Set! ⚔️
─────────────────────────────
Share this link with your players
to connect them to your party repo:

github.com/aragorn/my-party-repo
[ Copy Link ]

[ Create Character ]
[ Go to Home ]
```

---

### Screen 6 — Settings

```
SETTINGS
─────────────────────────────
Account
  [avatar] Aragorn
  github.com/aragorn
  [ View My Repo ]
  [ Sign Out ]

App Install
  iOS:     Tap Share → Add to Home Screen
  Android: [ Install App ]
  Desktop: [ Install as Desktop App ]

Repositories
  My Character Repo
  github.com/aragorn/ttrpg-characters
  [ View on GitHub ]

  Party Repository
  github.com/fellowship/party-repo
  [ View ]  [ Disconnect ]
  [ + Link Another Party Repo ]

GM Mode
  [ toggle ]
  Enable GM features and party dashboard

Sync
  Frequency  [ 15s ▾ ]
  Last synced: 2 minutes ago
  [ Force Sync Now ]
  Offline queue: 0 edits pending

Danger Zone
  [ Delete All My Characters ]
  "Your GitHub repo is unaffected.
   Characters only removed from the app."
```

---

## 9. Platform — Progressive Web App (PWA)

| Device | Experience |
|---|---|
| iPhone / iPad | Install from Safari via Share → Add to Home Screen |
| Android | Native install prompt from Chrome |
| Desktop / laptop | Browser tab or installed desktop app |

**Responsive design** — mobile first. Desktop layout adaptations via CSS breakpoints as a secondary pass. No layout decisions locked at this stage for desktop.

### PWA Technical Requirements

| Requirement | Detail |
|---|---|
| HTTPS | Required for PWA install and service worker |
| Web App Manifest | Icon, name, theme colour, display: standalone |
| Service Worker | Offline caching, edit queue |
| Responsive layout | 320px phone to 1440px+ desktop |

### Manifest Configuration

```json
{
  "name": "TTRPG Sheet",
  "short_name": "Sheet",
  "display": "standalone",
  "start_url": "/",
  "theme_color": "#1a1a2e",
  "background_color": "#1a1a2e",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-maskable.png", "sizes": "512x512", "purpose": "maskable" }
  ]
}
```

### iOS Limitations

| Feature | Android | iOS |
|---|---|---|
| Auto install prompt | ✅ | ❌ manual via Share menu |
| Background sync | ✅ | ⚠️ Limited |
| Push notifications | ✅ | ⚠️ iOS 16.4+ only |
| Offline caching | ✅ | ✅ |

Impact is minimal — sync is pull-based so background sync limitations don't affect the live view experience.

### Offline Behaviour

| Scenario | Behaviour |
|---|---|
| Editing offline | Saved to local IndexedDB queue |
| Reconnects | Queued commits pushed automatically |
| Viewing others offline | Last cached version + "Last updated: X" banner |
| Content library offline | Fully available from cache |

---

## 10. Tech Stack

| Layer | Choice |
|---|---|
| Framework | React + Vite |
| PWA tooling | Vite PWA Plugin |
| Styling | Tailwind CSS (mobile first) |
| Auth | GitHub OAuth |
| Data layer | GitHub REST API via Octokit |
| Real-time sync | Polling every 15–30 seconds |
| Offline storage | IndexedDB via idb library |
| Standard content | Public GitHub repo, cached via service worker |
| Search | Fuse.js — local fuzzy search over cached JSON |
| Hosting | Vercel or Netlify (HTTPS required for PWA) |

---

## 11. V1 Scope

1. GitHub OAuth login
2. Onboarding — character repo creation, GM question, party repo setup
3. Create and edit a D&D 5e character across all five tabs
4. Owner-only editing with lock/unlock toggle
5. Auto-save via debounce with sync indicator
6. Share a character by link — live read-only view
7. Copy a character — full ownership transfer
8. Home screen with character cards and Shared With Me
9. GM mode toggle
10. Party Dashboard — live summary cards + V1 initiative tracker with tie breaking
11. Content Library — SRD browse, personal custom content, unified search
12. Custom repository connection
13. PWA manifest + service worker — installable on all devices
14. Basic offline support — cached character viewing without connection

---

## 12. V2 Features (Deferred)

**Character Sheet**
- AC auto-calculated from equipped armour and item effects
- Class features in Combat tab (Second Wind, Action Surge, Rage, Ki Points, Lay on Hands, Cunning Action etc.)
- Uses tracker per class feature — X per short/long rest, shown as pips
- Rest management — short rest and long rest to recover features and spell slots
- Character portrait image upload
- Dice roller — pull forward to V1 only if trivial to implement
- Other TTRPG systems beyond D&D 5e

**GM Dashboard**
- Downed player handling in initiative tracker — visual indicator, auto-skip option
- Death saves integrated into initiative tracker
- Enemy stat block builder and saved enemy repository
- Draw from saved stat blocks in encounter builder
- HP tracking per enemy in initiative tracker

**Party Repository Content**
- Custom items, spells, and monster/NPC stat blocks saved to party repo
- Accessible and creatable by all party members, not just GM
- GM manages and organises content
- Feeds into V2 enemy repository and encounter builder

**Platform**
- Push notifications for character updates — Android and iOS 16.4+
- Full offline edit queue with automatic sync on reconnect
- GM notes scratchpad per character — stored in GM's own repo, linked by character ID

---

## 13. Open Questions

- **Other TTRPG systems** — Pathfinder, Call of Cthulhu etc. — when and which?
- **Repo visibility** — character repos public or private by default? Private requires broader GitHub token permissions.
- **Simultaneous edits** — owner editing on two devices at once — how are conflicts surfaced?
- **Custom content licensing** — any moderation needed for publicly connected homebrew repos?
- **Deletion** — what happens to party dashboard when a player deletes their character or revokes access?
- **Hosting** — Vercel or Netlify, or existing infrastructure preference?
- **App name** — TTRPG Sheet is a working title. Final name TBD.

---

## 14. Key UX Principles

**Ownership is always visible.** Lock icon in header at all times. No ambiguity about who can edit.

**Edit controls are absent, not disabled.** Non-owners see a display, not a locked form.

**Lock protects, not restricts.** The sheet is unlocked by default for owners. Locking is a conscious protective choice, not a gate to pass through to edit.

**Auto-save is invisible.** No save button anywhere in the app. Changes commit silently. Sync indicator confirms state without interrupting play.

**GitHub is invisible.** Players never think about commits or repos. Power users can open their repo from Settings.

**Copies are clearly labelled.** Provenance shown on first open, then treated identically to any owned character.

**Combat is the priority.** HP, AC, conditions, attacks, and spells are all one tap away during play. The app is designed for the table, not the desk.

**One search, all sources.** Content from SRD, personal repos, party repos, and custom repos is unified behind a single search bar. Source labels keep it clear without creating friction.

---

*End of Design Brief v4.0*

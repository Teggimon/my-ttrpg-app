# Integration notes

## 1. App.jsx — three changes

### a) Add imports at the top
```js
import GMDashboard from './GMDashboard'
```

### b) Add GM dashboard screen (before the final return, alongside your other screen checks)
```jsx
if (screen === 'gm-dashboard') return (
  <GMDashboard
    onBack={() => setScreen('home')}
    onViewCharacter={(char) => {
      setSelectedCharacter(char)
      setScreen('character')
    }}
  />
)
```

### c) Update the Home render — add isGM and onOpenGMDashboard props
```jsx
<Home
  token={token}
  user={user}
  isGM={localStorage.getItem('is_gm') === 'true'}
  onCreateCharacter={() => setScreen('create')}
  onSelectCharacter={(char) => {
    setSelectedCharacter(char)
    setScreen('character')
  }}
  onOpenGMDashboard={() => setScreen('gm-dashboard')}
/>
```

---

## 2. index.html — two changes

### a) Theme script (prevents flash on load) — add inside <head> before any CSS
```html
<script>
  (function() {
    var t = localStorage.getItem('ttrpg_theme') || 'dungeon';
    document.documentElement.setAttribute('data-theme', t);
  })();
</script>
```

### b) Google Fonts — add inside <head>
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cinzel+Decorative:wght@400;700&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&family=Nunito:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Outfit:wght@800&display=swap" rel="stylesheet">
```

---

## 3. index.css (or global CSS) — CSS variables block

Add this somewhere global (top of index.css or App.css) so the design
system variables are available everywhere. The theme script in step 2a
sets the data-theme attribute that activates the right block.

```css
/* ── Global tokens (theme-independent) ── */
:root {
  --gold:        #c9a227;
  --gold-subtle: rgba(201, 162, 39, 0.10);
  --gold-border: rgba(201, 162, 39, 0.38);

  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-full: 9999px;

  --spacing-xs:  4px;
  --spacing-sm:  8px;
  --spacing-md:  16px;
  --spacing-lg:  24px;
  --spacing-xl:  32px;
}

/* ── Dungeon theme (default) ── */
[data-theme="dungeon"] {
  --bg-base:           #0e0d1a;
  --bg-surface:        #13122a;
  --bg-elevated:       #1c1b35;
  --bg-inset:          #0a0915;
  --border:            #26244a;
  --border-strong:     #36336a;

  --text-primary:      #eeedf8;
  --text-secondary:    #8885aa;
  --text-muted:        #45426a;
  --text-inverse:      #0e0d1a;

  --accent:            #7c6ff5;
  --accent-hover:      #9b90ff;
  --accent-subtle:     rgba(124, 111, 245, 0.15);
  --accent-secondary:  #5550cc;

  --hp-high:           #4ade80;
  --hp-mid:            #f59e0b;
  --hp-low:            #f87171;
  --hp-temp:           #67e8f9;

  --spell-slot-filled: #7c6ff5;
  --spell-slot-empty:  #26244a;

  --condition-bg:      rgba(239, 100, 60, 0.22);
  --condition-text:    #f4845f;
  --concentration-indicator: #67e8f9;

  --success:           #4ade80;
  --warning:           #f59e0b;
  --danger:            #f87171;

  --tab-active-bg:     #1c1b35;
  --tab-active-text:   #eeedf8;
  --tab-inactive-text: #45426a;

  --shadow-sm:         0 2px 8px rgba(0,0,0,0.5);
  --shadow-md:         0 8px 32px rgba(0,0,0,0.7);

  --font-display:      'Cinzel', Georgia, serif;
  --font-body:         'Nunito', system-ui, sans-serif;
  --font-mono:         'JetBrains Mono', 'Fira Code', monospace;
}
```

---

## 4. File placement

Drop the four files into src/:
- src/Home.jsx        (replaces existing)
- src/Home.css        (replaces or creates)
- src/GMDashboard.jsx (new)
- src/GMDashboard.css (new)
- src/gmUtils.js      (new)

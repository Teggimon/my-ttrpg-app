import { useState, useEffect } from 'react'
import CharSwitcher from './CharSwitcher'
import LeftPanel from './LeftPanel'
import BottomNav from './BottomNav'
import CombatTab from './tabs/CombatTab'
import StatsTab from './tabs/StatsTab'
import SpellsTab from './tabs/SpellsTab'
import InventoryTab from './tabs/InventoryTab'
import NotesTab from './tabs/NotesTab'
import './CharacterLayout.css'

const TABS = [
  { id: 'combat',    label: 'Combat',  icon: '⚔' },
  { id: 'stats',     label: 'Stats',   icon: '🎲' },
  { id: 'spells',    label: 'Spells',  icon: '✨' },
  { id: 'inventory', label: 'Gear',    icon: '🎒' },
  { id: 'notes',     label: 'Notes',   icon: '📝' },
]

function useIsLandscape() {
  const query = '(orientation: landscape) and (min-width: 480px)'
  const [landscape, setLandscape] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const handler = (e) => setLandscape(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return landscape
}

export default function CharacterLayout({
  characters,
  activeCharId,
  onSwitchChar,
  onNewChar,
  onBack,
  user,
  onUpdateChar,
  syncStatus,
}) {
  const [activeTab, setActiveTab] = useState('combat')
  const isLandscape = useIsLandscape()

  const char = characters.find(c => c.meta.characterId === activeCharId)
  if (!char) return null

  const isOwner = char.meta.owner === `github:${user.login}`
  const [locked, setLocked] = useState(false)

  function updateChar(updates) {
    onUpdateChar({ ...char, ...updates })
  }

  const tabProps = { char, locked, isOwner, updateChar }

  const tabContent = (
    <div className="tab-content">
      {activeTab === 'combat'    && <CombatTab    {...tabProps} />}
      {activeTab === 'stats'     && <StatsTab     {...tabProps} />}
      {activeTab === 'spells'    && <SpellsTab    {...tabProps} />}
      {activeTab === 'inventory' && <InventoryTab {...tabProps} />}
      {activeTab === 'notes'     && <NotesTab     {...tabProps} />}
    </div>
  )

  return (
    <div className="char-layout">
      <CharSwitcher
        characters={characters}
        activeCharId={activeCharId}
        onSwitch={onSwitchChar}
        onNew={onNewChar}
      />

      {isLandscape ? (
        /* ── Landscape: sidebar + content ── */
        <div className="landscape-body">
          <LeftPanel
            char={char}
            isOwner={isOwner}
            locked={locked}
            onToggleLock={() => setLocked(l => !l)}
            syncStatus={syncStatus}
            updateChar={updateChar}
            tabs={TABS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onBack={onBack}
          />
          <main className="content-panel">
            {tabContent}
          </main>
        </div>
      ) : (
        /* ── Portrait: header + content + bottom nav ── */
        <div className="portrait-body">
          <LeftPanel
            char={char}
            isOwner={isOwner}
            locked={locked}
            onToggleLock={() => setLocked(l => !l)}
            syncStatus={syncStatus}
            updateChar={updateChar}
            portrait
            onBack={onBack}
          />
          <main className="content-panel">
            {tabContent}
          </main>
          <BottomNav
            tabs={TABS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>
      )}
    </div>
  )
}

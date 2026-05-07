import { useState, useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { getEquipment, getMagicItems } from '../srdContent'
import '../TabShared.css'
import './InventoryTab.css'

function abilityMod(score) { return Math.floor((score - 10) / 2) }

const MAGIC_AC_BONUS = {
  'ring-of-protection':    1,
  'cloak-of-protection':   1,
  'ioun-stone-protection': 1,
}
const BRACERS_INDEX = 'bracers-of-defense'

export function isItemEquippable(item, srdMap) {
  if (item.damage)                        return true
  if (item.ac_bonus != null)              return true
  if (MAGIC_AC_BONUS[item.index] != null) return true
  if (item.index === BRACERS_INDEX)       return true
  const srd = srdMap[item.index] ?? {}
  if (srd.damage)       return true
  if (srd.armor_class)  return true
  if (item.armor_class) return true
  return false
}

export function computeAC(inventory, abilityScores, srdMap) {
  const dexMod   = abilityMod(abilityScores?.dex ?? 10)
  const equipped = inventory.filter(i => i.equipped)
  let armorBase = null, armorCat = null, shieldAC = 0, flatACBonus = 0, hasBracers = false

  for (const item of equipped) {
    const srd = srdMap[item.index] ?? {}
    const ac  = item.armor_class ?? srd.armor_class
    const cat = item.armor_category ?? srd.armor_category
    if (ac && cat) {
      if (cat === 'Shield') shieldAC += ac.base ?? 2
      else if (['Light','Medium','Heavy'].includes(cat)) { armorBase = ac.base; armorCat = cat }
      continue
    }
    if (item.index === BRACERS_INDEX) { hasBracers = true; continue }
    const kb = MAGIC_AC_BONUS[item.index]
    if (kb != null) { flatACBonus += kb; continue }
    if (item.ac_bonus != null) flatACBonus += item.ac_bonus
  }
  if (hasBracers && armorBase === null) flatACBonus += 2

  let baseAC
  if (armorBase !== null) {
    baseAC = armorCat === 'Light'  ? armorBase + dexMod
           : armorCat === 'Medium' ? armorBase + Math.min(dexMod, 2)
           : armorBase
  } else {
    baseAC = 10 + dexMod
  }
  return baseAC + shieldAC + flatACBonus
}

function itemCategory(item, srdMap) {
  const srd = srdMap[item.index] ?? {}
  if (item.damage || srd.damage) return 'weapon'
  const cat = item.armor_category ?? srd.armor_category
  if (cat === 'Shield') return 'shield'
  if (['Light','Medium','Heavy'].includes(cat)) return 'armor'
  if (MAGIC_AC_BONUS[item.index] != null || item.ac_bonus != null || item.index === BRACERS_INDEX) return 'magic'
  // Magic items from the SRD magic items list (have rarity field)
  if (srd.rarity) return 'magic'
  return 'gear'
}

const SECTIONS = [
  { key: 'weapon', label: 'Weapons' },
  { key: 'armor',  label: 'Armour' },
  { key: 'shield', label: 'Shields' },
  { key: 'magic',  label: 'Magic Items' },
  { key: 'gear',   label: 'Gear' },
]

function equipLabel(item, srdMap) {
  if (MAGIC_AC_BONUS[item.index] != null || item.ac_bonus != null || item.index === BRACERS_INDEX) {
    return item.equipped ? 'Attuned' : 'Attune'
  }
  return item.equipped ? 'Equipped' : 'Equip'
}

function acHint(item, srdMap, abilityScores) {
  const srd    = srdMap[item.index] ?? {}
  const ac     = item.armor_class ?? srd.armor_class
  const cat    = item.armor_category ?? srd.armor_category
  const dexMod = abilityMod(abilityScores?.dex ?? 10)
  if (ac && cat && cat !== 'Shield') {
    const shown = cat === 'Heavy' ? ac.base
      : cat === 'Medium' ? ac.base + Math.min(dexMod, 2)
      : ac.base + dexMod
    return `AC ${shown}`
  }
  if (ac && cat === 'Shield')       return `+${ac.base ?? 2} AC`
  const bonus = MAGIC_AC_BONUS[item.index]
  if (bonus)                        return `+${bonus} AC`
  if (item.ac_bonus)                return `+${item.ac_bonus} AC`
  if (item.index === BRACERS_INDEX) return '+2 AC (unarmored)'
  return null
}

// ── Item picker ───────────────────────────────────────────────────────────────

const PICKER_TABS = [
  { key: 'equipment', label: 'Equipment' },
  { key: 'magic',     label: 'Magic Items' },
  { key: 'custom',    label: 'Custom' },
]

function ItemPicker({ srdMap, onAdd, onClose }) {
  const [tab,      setTab]      = useState('equipment')
  const [search,   setSearch]   = useState('')
  const [allEquip, setAllEquip] = useState([])
  const [allMagic, setAllMagic] = useState([])
  const [customName, setCustomName] = useState('')
  const [customQty,  setCustomQty]  = useState(1)

  useEffect(() => {
    getEquipment().then(setAllEquip).catch(() => {})
    getMagicItems().then(setAllMagic).catch(() => {})
  }, [])

  const pool = tab === 'equipment' ? allEquip : allMagic
  const filtered = pool
    .filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 60)

  function addSrd(srdItem) {
    const isMagic = tab === 'magic'
    onAdd({
      itemId:   uuidv4(),
      index:    srdItem.index,
      name:     srdItem.name,
      quantity: 1,
      equipped: false,
      // carry SRD fields needed for AC/damage resolution
      ...(srdItem.armor_class    && { armor_class: srdItem.armor_class }),
      ...(srdItem.armor_category && { armor_category: srdItem.armor_category }),
      ...(srdItem.damage         && { damage: { dice: srdItem.damage.damage_dice, type: srdItem.damage.damage_type?.name } }),
      ...(isMagic && srdItem.rarity && { rarity: srdItem.rarity.name }),
    })
  }

  function addCustom() {
    if (!customName.trim()) return
    onAdd({ itemId: uuidv4(), index: `custom-${uuidv4()}`, name: customName.trim(), quantity: customQty, equipped: false })
    setCustomName('')
    setCustomQty(1)
  }

  return (
    <div className="item-picker card">
      {/* tabs */}
      <div className="ip-tabs">
        {PICKER_TABS.map(t => (
          <button
            key={t.key}
            className={`ip-tab${tab === t.key ? ' ip-tab--active' : ''}`}
            onClick={() => { setTab(t.key); setSearch('') }}
          >{t.label}</button>
        ))}
        <button className="ip-close" onClick={onClose}>✕</button>
      </div>

      {tab !== 'custom' && (
        <>
          <input
            className="ip-search"
            placeholder={`Search ${tab === 'equipment' ? 'equipment' : 'magic items'}…`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          <div className="ip-list">
            {filtered.length === 0 && <div className="ip-empty">No results</div>}
            {filtered.map(item => (
              <button key={item.index} className="ip-row" onClick={() => addSrd(item)}>
                <span className="ip-row-name">{item.name}</span>
                {item.armor_class && <span className="ip-row-tag">AC {item.armor_class.base}</span>}
                {item.damage      && <span className="ip-row-tag">{item.damage.damage_dice}</span>}
                {item.rarity      && <span className="ip-row-tag ip-row-tag--magic">{item.rarity.name}</span>}
              </button>
            ))}
          </div>
        </>
      )}

      {tab === 'custom' && (
        <div className="ip-custom">
          <input
            className="ip-search"
            placeholder="Item name…"
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            autoFocus
          />
          <div className="ip-custom-row">
            <label className="ip-qty-label">Qty</label>
            <input
              type="number" min="1"
              className="ip-qty"
              value={customQty}
              onChange={e => setCustomQty(Math.max(1, Number(e.target.value)))}
            />
            <button className="ip-add-btn" onClick={addCustom} disabled={!customName.trim()}>
              + Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main tab ─────────────────────────────────────────────────────────────────

export default function InventoryTab({ char, locked, isOwner, updateChar }) {
  const [srdMap,     setSrdMap]     = useState({})
  const [showPicker, setShowPicker] = useState(false)

  useEffect(() => {
    getEquipment()
      .then(all => setSrdMap(Object.fromEntries(all.map(e => [e.index, e]))))
      .catch(() => {})
  }, [])

  // Backfill itemId for old characters
  const rawInventory = char.inventory ?? []
  const tempIds = useRef({})
  const inventory = rawInventory.map((i, idx) => {
    if (i.itemId) return i
    if (!tempIds.current[idx]) tempIds.current[idx] = uuidv4()
    return { ...i, itemId: tempIds.current[idx] }
  })
  useEffect(() => {
    if (rawInventory.every(i => i.itemId)) return
    updateChar({ inventory })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const tracking    = char.settings?.encumbranceTracking
  const strScore    = char.stats?.abilityScores?.str ?? 10
  const capacity    = strScore * 15
  const totalWeight = inventory.reduce((s, i) => s + (i.weight ?? 0) * (i.quantity ?? 1), 0)
  const pct = tracking ? Math.min(100, Math.round((totalWeight / capacity) * 100)) : 0

  function toggleEquip(itemId) {
    const newInv = inventory.map(i => i.itemId === itemId ? { ...i, equipped: !i.equipped } : i)
    updateChar({ inventory: newInv, combat: { ...char.combat, ac: computeAC(newInv, char.stats?.abilityScores, srdMap) } })
  }

  function removeItem(itemId) {
    const newInv = inventory.filter(i => i.itemId !== itemId)
    updateChar({ inventory: newInv, combat: { ...char.combat, ac: computeAC(newInv, char.stats?.abilityScores, srdMap) } })
  }

  function addItem(item) {
    const newInv = [...inventory, item]
    updateChar({ inventory: newInv })
  }

  const grouped = {}
  for (const item of inventory) {
    const cat = itemCategory(item, srdMap)
    ;(grouped[cat] ??= []).push(item)
  }

  return (
    <div>
      {tracking && (
        <div className="carry-bar-wrap">
          <div className="carry-meta">
            <span>Carrying {totalWeight} / {capacity} lbs</span>
            <span>{pct}%</span>
          </div>
          <div className="carry-track">
            <div className="carry-fill" style={{ width: `${pct}%`, background: pct > 90 ? '#f09090' : pct > 66 ? '#efa027' : 'var(--accent)' }} />
          </div>
        </div>
      )}

      {/* Add item button */}
      {isOwner && !locked && (
        <div className="inv-add-row">
          <button
            className={`inv-add-btn${showPicker ? ' inv-add-btn--open' : ''}`}
            onClick={() => setShowPicker(v => !v)}
          >
            {showPicker ? '✕ Close' : '+ Add Item'}
          </button>
        </div>
      )}

      {showPicker && (
        <ItemPicker
          srdMap={srdMap}
          onAdd={item => { addItem(item); setShowPicker(false) }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {inventory.length === 0 && !showPicker && (
        <p className="empty-hint">No items yet — use + Add Item to get started.</p>
      )}

      {SECTIONS.filter(s => grouped[s.key]?.length).map(section => (
        <div key={section.key}>
          <div className="sec-head">{section.label}</div>
          {grouped[section.key].map(item => {
            const hint       = item.equipped ? acHint(item, srdMap, char.stats?.abilityScores) : null
            const equippable = isItemEquippable(item, srdMap)
            return (
              <div key={item.itemId} className="inv-row card">
                <div className="inv-info">
                  <span className="inv-name">{item.name}</span>
                  {item.quantity > 1 && <span className="inv-qty">×{item.quantity}</span>}
                  {hint && <span className="inv-ac-hint">· {hint}</span>}
                </div>
                <div className="inv-actions">
                  {equippable && isOwner && !locked && (
                    <span
                      className={`equip-badge ${item.equipped ? 'equip-badge--on' : ''}`}
                      onClick={() => toggleEquip(item.itemId)}
                    >
                      {equipLabel(item, srdMap)}
                    </span>
                  )}
                  {isOwner && !locked && (
                    <button className="inv-remove" onClick={() => removeItem(item.itemId)}>×</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { getEquipment } from '../srdContent'
import '../TabShared.css'
import './InventoryTab.css'

function abilityMod(score) { return Math.floor((score - 10) / 2) }

// Flat AC bonus granted by specific magic items when equipped/attuned.
// Items not listed here but with a stored `ac_bonus` field are also handled below.
const MAGIC_AC_BONUS = {
  'ring-of-protection':        1,
  'cloak-of-protection':       1,
  'ioun-stone-protection':     1,
  'periapt-of-proof-against-poison': 0, // no AC — listed so it shows equip button
  // +X armor and shields come through armor_class.base from SRD directly
}

// Bracers of Defense give +2 only when not wearing armor and no shield
const BRACERS_INDEX = 'bracers-of-defense'

// Determine whether an item should show an equip button
export function isItemEquippable(item, srdMap) {
  if (item.damage)                       return true  // stored weapon
  if (item.ac_bonus != null)             return true  // stored magic bonus
  if (MAGIC_AC_BONUS[item.index] != null) return true
  if (item.index === BRACERS_INDEX)      return true
  const srd = srdMap[item.index] ?? {}
  if (srd.damage)                        return true  // SRD weapon
  if (srd.armor_class)                   return true  // SRD armor / shield
  if (item.armor_class)                  return true  // stored armor stats
  return false
}

// Compute AC from equipped inventory using D&D 5e rules
export function computeAC(inventory, abilityScores, srdMap) {
  const dexMod = abilityMod(abilityScores?.dex ?? 10)
  const equipped = inventory.filter(i => i.equipped)

  let armorBase    = null
  let armorCat     = null   // 'Light' | 'Medium' | 'Heavy'
  let shieldAC     = 0
  let flatACBonus  = 0
  let hasBracers   = false

  for (const item of equipped) {
    const srd = srdMap[item.index] ?? {}
    const ac  = item.armor_class ?? srd.armor_class
    const cat = item.armor_category ?? srd.armor_category

    // Standard armor / shield (from SRD or stored on item)
    if (ac && cat) {
      if (cat === 'Shield') {
        shieldAC += ac.base ?? 2
      } else if (cat === 'Light' || cat === 'Medium' || cat === 'Heavy') {
        armorBase = ac.base
        armorCat  = cat
      }
      continue
    }

    // Bracers of Defense — handled after loop so we know if armor is worn
    if (item.index === BRACERS_INDEX) { hasBracers = true; continue }

    // Known magic item flat bonus
    const knownBonus = MAGIC_AC_BONUS[item.index]
    if (knownBonus != null) { flatACBonus += knownBonus; continue }

    // Manually stored ac_bonus (lets DMs add custom magic items)
    if (item.ac_bonus != null) flatACBonus += item.ac_bonus
  }

  // Bracers of Defense: +2 only when not wearing armor (any category)
  if (hasBracers && armorBase === null) flatACBonus += 2

  let baseAC
  if (armorBase !== null) {
    if      (armorCat === 'Light')  baseAC = armorBase + dexMod
    else if (armorCat === 'Medium') baseAC = armorBase + Math.min(dexMod, 2)
    else                             baseAC = armorBase              // Heavy: no DEX
  } else {
    baseAC = 10 + dexMod                                             // Unarmored
  }

  return baseAC + shieldAC + flatACBonus
}

export default function InventoryTab({ char, locked, isOwner, updateChar }) {
  const [srdMap, setSrdMap] = useState({})

  useEffect(() => {
    getEquipment()
      .then(all => setSrdMap(Object.fromEntries(all.map(e => [e.index, e]))))
      .catch(() => {})
  }, [])

  // Migrate: backfill itemId for old characters that lack it.
  // tempIds ref gives stable IDs for the current render before the write completes.
  const rawInventory = char.inventory ?? []
  const tempIds = useRef({})
  const inventory = rawInventory.map((i, idx) => {
    if (i.itemId) return i
    if (!tempIds.current[idx]) tempIds.current[idx] = uuidv4()
    return { ...i, itemId: tempIds.current[idx] }
  })
  useEffect(() => {
    if (rawInventory.every(i => i.itemId)) return
    updateChar({ inventory: inventory })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const tracking    = char.settings?.encumbranceTracking
  const strScore    = char.stats?.abilityScores?.str ?? 10
  const capacity    = strScore * 15
  const totalWeight = inventory.reduce((s, i) => s + (i.weight ?? 0) * (i.quantity ?? 1), 0)
  const pct = tracking ? Math.min(100, Math.round((totalWeight / capacity) * 100)) : 0

  function toggleEquip(itemId) {
    const newInventory = inventory.map(i =>
      i.itemId === itemId ? { ...i, equipped: !i.equipped } : i
    )
    updateChar({
      inventory: newInventory,
      combat: { ...char.combat, ac: computeAC(newInventory, char.stats?.abilityScores, srdMap) },
    })
  }

  function removeItem(itemId) {
    const newInventory = inventory.filter(i => i.itemId !== itemId)
    updateChar({
      inventory: newInventory,
      combat: { ...char.combat, ac: computeAC(newInventory, char.stats?.abilityScores, srdMap) },
    })
  }

  function itemLabel(item) {
    const srd = srdMap[item.index] ?? {}
    const cat = item.armor_category ?? srd.armor_category
    if (item.damage || srd.damage) return item.equipped ? '⚔ Equipped' : '⚔ Equip'
    if (cat === 'Shield')          return item.equipped ? '🛡 Equipped' : '🛡 Equip'
    if (cat)                       return item.equipped ? '🥋 Equipped' : '🥋 Equip'
    return item.equipped ? '✦ Attuned' : '✦ Attune'
  }

  function acHint(item) {
    const srd = srdMap[item.index] ?? {}
    const ac  = item.armor_class ?? srd.armor_class
    const cat = item.armor_category ?? srd.armor_category
    if (ac && cat && cat !== 'Shield') {
      const dexMod = abilityMod(char.stats?.abilityScores?.dex ?? 10)
      const shown  = cat === 'Heavy' ? ac.base
        : cat === 'Medium' ? ac.base + Math.min(dexMod, 2)
        : ac.base + dexMod
      return `AC ${shown}`
    }
    const knownBonus = MAGIC_AC_BONUS[item.index]
    if (knownBonus) return `+${knownBonus} AC`
    if (item.ac_bonus) return `+${item.ac_bonus} AC`
    if (item.index === BRACERS_INDEX) return '+2 AC (unarmored)'
    return null
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

      {inventory.length === 0 && <p className="empty-hint">No items. Add from the Content Library.</p>}

      {inventory.map(item => {
        const hint = item.equipped ? acHint(item) : null
        return (
          <div key={item.itemId} className="inv-row card">
            <div className="inv-info">
              <span className="inv-name">{item.name}</span>
              {item.quantity > 1 && <span className="inv-qty">×{item.quantity}</span>}
              {hint && <span className="inv-ac-hint"> · {hint}</span>}
            </div>
            <div className="inv-actions">
              {isItemEquippable(item, srdMap) && isOwner && !locked && (
                <span
                  className={`equip-badge ${item.equipped ? 'equip-badge--on' : ''}`}
                  onClick={() => toggleEquip(item.itemId)}
                >
                  {itemLabel(item)}
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
  )
}

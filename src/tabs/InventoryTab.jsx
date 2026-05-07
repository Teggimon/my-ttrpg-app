import { useState, useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { getEquipment } from '../srdContent'
import '../TabShared.css'
import './InventoryTab.css'

function abilityMod(score) { return Math.floor((score - 10) / 2) }

const MAGIC_AC_BONUS = {
  'ring-of-protection':  1,
  'cloak-of-protection': 1,
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
  const dexMod  = abilityMod(abilityScores?.dex ?? 10)
  const equipped = inventory.filter(i => i.equipped)

  let armorBase   = null
  let armorCat    = null
  let shieldAC    = 0
  let flatACBonus = 0
  let hasBracers  = false

  for (const item of equipped) {
    const srd = srdMap[item.index] ?? {}
    const ac  = item.armor_class ?? srd.armor_class
    const cat = item.armor_category ?? srd.armor_category

    if (ac && cat) {
      if (cat === 'Shield') { shieldAC += ac.base ?? 2 }
      else if (['Light', 'Medium', 'Heavy'].includes(cat)) { armorBase = ac.base; armorCat = cat }
      continue
    }
    if (item.index === BRACERS_INDEX) { hasBracers = true; continue }
    const knownBonus = MAGIC_AC_BONUS[item.index]
    if (knownBonus != null) { flatACBonus += knownBonus; continue }
    if (item.ac_bonus != null) flatACBonus += item.ac_bonus
  }

  if (hasBracers && armorBase === null) flatACBonus += 2

  let baseAC
  if (armorBase !== null) {
    if      (armorCat === 'Light')  baseAC = armorBase + dexMod
    else if (armorCat === 'Medium') baseAC = armorBase + Math.min(dexMod, 2)
    else                             baseAC = armorBase
  } else {
    baseAC = 10 + dexMod
  }

  return baseAC + shieldAC + flatACBonus
}

function itemCategory(item, srdMap) {
  const srd = srdMap[item.index] ?? {}
  if (item.damage || srd.damage)        return 'weapon'
  const cat = item.armor_category ?? srd.armor_category
  if (cat === 'Shield')                 return 'shield'
  if (cat === 'Light' || cat === 'Medium' || cat === 'Heavy') return 'armor'
  if (MAGIC_AC_BONUS[item.index] != null || item.ac_bonus != null || item.index === BRACERS_INDEX) return 'magic'
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
  const srd = srdMap[item.index] ?? {}
  const cat = item.armor_category ?? srd.armor_category
  if (item.damage || srd.damage) return item.equipped ? 'Equipped' : 'Equip'
  if (cat === 'Shield')          return item.equipped ? 'Equipped' : 'Equip'
  if (cat)                       return item.equipped ? 'Equipped' : 'Equip'
  return item.equipped ? 'Attuned' : 'Attune'
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
  if (ac && cat === 'Shield')        return `+${ac.base ?? 2} AC`
  const bonus = MAGIC_AC_BONUS[item.index]
  if (bonus)                         return `+${bonus} AC`
  if (item.ac_bonus)                 return `+${item.ac_bonus} AC`
  if (item.index === BRACERS_INDEX)  return '+2 AC (unarmored)'
  return null
}

export default function InventoryTab({ char, locked, isOwner, updateChar }) {
  const [srdMap, setSrdMap] = useState({})

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

      {inventory.length === 0 && <p className="empty-hint">No items. Add from the Content Library.</p>}

      {SECTIONS.filter(s => grouped[s.key]?.length).map(section => (
        <div key={section.key}>
          <div className="sec-head">{section.label}</div>
          {grouped[section.key].map(item => {
            const hint      = item.equipped ? acHint(item, srdMap, char.stats?.abilityScores) : null
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

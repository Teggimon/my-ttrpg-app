import { useState, useEffect } from 'react'
import { getEquipment } from '../srdContent'
import '../TabShared.css'
import './InventoryTab.css'

const CATEGORY_ORDER = ['Weapons', 'Armor', 'Tools', 'Gear']

function getItemCategory(item, srdMap) {
  if (item.type === 'weapon') return 'Weapons'
  if (item.type === 'armor') return 'Armor'
  if (item.type === 'tool')  return 'Tools'
  const srd = srdMap[item.index]
  if (!srd) return 'Gear'
  if (srd.equipment_category?.index === 'weapon') return 'Weapons'
  if (srd.equipment_category?.index === 'armor')  return 'Armor'
  if (srd.equipment_category?.index === 'tools')  return 'Tools'
  return 'Gear'
}

function isEquippable(item, srdMap) {
  const cat = getItemCategory(item, srdMap)
  return cat === 'Weapons' || cat === 'Armor' || item.damage != null
}

function itemKey(item) {
  return item.itemId ?? item.index ?? item.name
}

export default function InventoryTab({ char, locked, isOwner, updateChar }) {
  const [expandedId, setExpandedId] = useState(null)
  const [srdMap,     setSrdMap]     = useState({})

  const inventory  = char.inventory ?? []
  const tracking   = char.settings?.encumbranceTracking
  const strScore   = char.stats?.abilityScores?.str ?? 10
  const capacity   = strScore * 15
  const totalWeight = inventory.reduce((s, i) => s + (i.weight ?? 0) * (i.quantity ?? 1), 0)
  const pct = tracking ? Math.min(100, Math.round((totalWeight / capacity) * 100)) : 0

  useEffect(() => {
    getEquipment()
      .then(all => setSrdMap(Object.fromEntries(all.map(e => [e.index, e]))))
      .catch(() => {})
  }, [])

  const toggleExpand = id => setExpandedId(prev => prev === id ? null : id)

  const toggleEquip = id => updateChar({
    inventory: inventory.map(i => itemKey(i) === id ? { ...i, equipped: !i.equipped } : i),
  })

  const toggleAttune = id => updateChar({
    inventory: inventory.map(i => itemKey(i) === id ? { ...i, attuned: !i.attuned } : i),
  })

  const changeQty = (id, delta) => updateChar({
    inventory: inventory
      .map(i => itemKey(i) === id ? { ...i, quantity: Math.max(0, (i.quantity ?? 1) + delta) } : i)
      .filter(i => (i.quantity ?? 1) > 0),
  })

  const removeItem = id => updateChar({
    inventory: inventory.filter(i => itemKey(i) !== id),
  })

  const renderItem = (item) => {
    const id       = itemKey(item)
    const expanded = expandedId === id
    const srd      = srdMap[item.index]
    const canEquip = isEquippable(item, srdMap)

    const desc = item.description ?? null

    const damage = item.damage?.dice
      ? `${item.damage.dice} ${item.damage.type ?? ''}`
      : srd?.damage
        ? `${srd.damage.damage_dice} ${srd.damage.damage_type?.name ?? ''}`
        : null

    const versatile = srd?.two_handed_damage
      ? `${srd.two_handed_damage.damage_dice} ${srd.two_handed_damage.damage_type?.name ?? ''} (two-handed)`
      : null

    const acVal = item.armorClass
      ?? (srd?.armor_class ? `${srd.armor_class.base}${srd.armor_class.dex_bonus ? ' + DEX' : ''}` : null)

    const weight = item.weight ?? srd?.weight ?? null

    const props = srd?.properties?.map(p => p.name) ?? item.properties ?? []

    const cost = srd?.cost ? `${srd.cost.quantity} ${srd.cost.unit}` : null

    const range = srd?.range?.normal
      ? srd.range.long ? `${srd.range.normal}/${srd.range.long} ft` : `${srd.range.normal} ft`
      : null

    return (
      <div key={id} className={`inv-item${expanded ? ' inv-item--open' : ''}`}>

        {/* ── Collapsed row ── */}
        <div className="inv-item-head" onClick={() => toggleExpand(id)}>
          <div className="inv-item-meta">
            <span className="inv-name">{item.name}</span>
            <div className="inv-badge-row">
              {item.equipped && <span className="inv-badge inv-badge--equipped">Equipped</span>}
              {item.requiresAttunement && item.attuned && <span className="inv-badge inv-badge--attuned">Attuned</span>}
              {item.requiresAttunement && !item.attuned && <span className="inv-badge inv-badge--attune">Attune</span>}
              {damage && <span className="inv-badge inv-badge--dmg">{damage}</span>}
              {acVal  && <span className="inv-badge inv-badge--ac">AC {acVal}</span>}
            </div>
          </div>
          <div className="inv-item-right">
            {(item.quantity ?? 1) > 1 && <span className="inv-qty">×{item.quantity}</span>}
            <span className="inv-chevron">{expanded ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* ── Expanded detail ── */}
        {expanded && (
          <div className="inv-item-detail">

            {desc && <p className="inv-desc">{desc}</p>}

            {/* Stat pills */}
            {(damage || versatile || acVal || weight || range || cost || props.length > 0) && (
              <div className="inv-stats">
                {damage    && <div className="inv-stat"><span className="inv-sl">Damage</span><span className="inv-sv">{damage}</span></div>}
                {versatile && <div className="inv-stat"><span className="inv-sl">Versatile</span><span className="inv-sv">{versatile}</span></div>}
                {acVal     && <div className="inv-stat"><span className="inv-sl">AC</span><span className="inv-sv">{acVal}</span></div>}
                {range     && <div className="inv-stat"><span className="inv-sl">Range</span><span className="inv-sv">{range}</span></div>}
                {weight    && <div className="inv-stat"><span className="inv-sl">Weight</span><span className="inv-sv">{weight} lb</span></div>}
                {cost      && <div className="inv-stat"><span className="inv-sl">Cost</span><span className="inv-sv">{cost}</span></div>}
                {item.enhancement > 0 && <div className="inv-stat"><span className="inv-sl">Magic</span><span className="inv-sv">+{item.enhancement}</span></div>}
                {props.length > 0 && <div className="inv-stat inv-stat--wide"><span className="inv-sl">Properties</span><span className="inv-sv">{props.join(', ')}</span></div>}
              </div>
            )}

            {!desc && !damage && !acVal && !weight && (
              <p className="inv-no-data">No additional information available.</p>
            )}

            {/* Actions */}
            {isOwner && !locked && (
              <div className="inv-item-actions">
                {canEquip && (
                  <button
                    className={`inv-act-btn${item.equipped ? ' inv-act-btn--on' : ''}`}
                    onClick={() => toggleEquip(id)}
                  >
                    {item.equipped ? 'Unequip' : 'Equip'}
                  </button>
                )}
                {item.requiresAttunement && (
                  <button
                    className={`inv-act-btn${item.attuned ? ' inv-act-btn--on' : ''}`}
                    onClick={() => toggleAttune(id)}
                  >
                    {item.attuned ? 'Remove Attunement' : 'Attune'}
                  </button>
                )}
                <div className="inv-qty-ctrl">
                  <button className="inv-qty-btn" onClick={() => changeQty(id, -1)}>−</button>
                  <span className="inv-qty-val">{item.quantity ?? 1}</span>
                  <button className="inv-qty-btn" onClick={() => changeQty(id, 1)}>+</button>
                </div>
                <button className="inv-del-btn" onClick={() => removeItem(id)}>Remove</button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // Split into sections
  const equipped = inventory.filter(i => i.equipped)
  const byCategory = Object.fromEntries(CATEGORY_ORDER.map(c => [c, []]))
  for (const item of inventory) {
    const cat = getItemCategory(item, srdMap)
    ;(byCategory[cat] ??= []).push(item)
  }

  return (
    <div>
      {/* Weight bar */}
      {tracking && (
        <div className="carry-bar-wrap">
          <div className="carry-meta">
            <span>Carrying {totalWeight} / {capacity} lbs</span>
            <span>{pct}%</span>
          </div>
          <div className="carry-track">
            <div
              className="carry-fill"
              style={{
                width: `${pct}%`,
                background: pct > 90 ? '#f09090' : pct > 66 ? '#efa027' : 'var(--accent)',
              }}
            />
          </div>
        </div>
      )}

      {inventory.length === 0 && (
        <p className="empty-hint">No items yet.</p>
      )}

      {/* Equipped section */}
      {equipped.length > 0 && (
        <section className="inv-section">
          <div className="sec-head">Equipped</div>
          {equipped.map(renderItem)}
        </section>
      )}

      {/* Category sections */}
      {CATEGORY_ORDER.map(cat => {
        const items = byCategory[cat] ?? []
        if (!items.length) return null
        return (
          <section key={cat} className="inv-section">
            <div className="sec-head">{cat}</div>
            {items.map(renderItem)}
          </section>
        )
      })}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { getEquipment } from '../srdContent'
import '../TabShared.css'
import './InventoryTab.css'

const CATEGORY_ORDER = ['Weapons', 'Armor', 'Ammunition', 'Adventuring Gear', 'Tools', 'Currency', 'Other']

function getItemCategory(item, srdMap) {
  if (item.type === 'weapon') return 'Weapons'
  if (item.type === 'armor')  return 'Armor'
  const srd = srdMap[item.index]
  if (!srd) return 'Other'
  const cat = srd.equipment_category?.index
  if (cat === 'weapon') return 'Weapons'
  if (cat === 'armor')  return 'Armor'
  if (cat === 'tools')  return 'Tools'
  const gear = srd.gear_category?.index
  if (gear === 'ammunition') return 'Ammunition'
  if (gear === 'currency')   return 'Currency'
  return 'Adventuring Gear'
}

function isEquippable(item, srdMap) {
  const cat = getItemCategory(item, srdMap)
  return cat === 'Weapons' || cat === 'Armor' || item.damage != null
}

function itemKey(item) {
  return item.itemId ?? item.index ?? item.name
}

// ── Edit form (inline) ────────────────────────────────────────
function EditForm({ item, srdItem, onSave, onCancel }) {
  const [name,               setName]               = useState(item.name)
  const [description,        setDescription]        = useState(item.description ?? '')
  const [weight,             setWeight]             = useState(item.weight ?? srdItem?.weight ?? '')
  const [damageDice,         setDamageDice]         = useState(item.damage?.dice ?? srdItem?.damage?.damage_dice ?? '')
  const [damageType,         setDamageType]         = useState(item.damage?.type ?? srdItem?.damage?.damage_type?.name ?? '')
  const [enhancement,        setEnhancement]        = useState(item.enhancement ?? 0)
  const [requiresAttunement, setRequiresAttunement] = useState(item.requiresAttunement ?? false)

  const save = () => {
    const updated = {
      ...item,
      itemId: item.itemId ?? uuidv4(),
      name,
      description: description || undefined,
      weight: weight !== '' ? Number(weight) : undefined,
      damage: damageDice ? { dice: damageDice, type: damageType } : item.damage,
      enhancement: enhancement > 0 ? enhancement : undefined,
      requiresAttunement,
      isCustomized: true,
    }
    onSave(updated)
  }

  return (
    <div className="edit-form">
      <div className="edit-grid">
        <label className="edit-field">
          <span className="edit-lbl">Name</span>
          <input className="edit-inp" value={name} onChange={e => setName(e.target.value)} />
        </label>
        <label className="edit-field">
          <span className="edit-lbl">Weight (lb)</span>
          <input className="edit-inp" type="number" min="0" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} />
        </label>
        {(damageDice || item.damage) && (
          <>
            <label className="edit-field">
              <span className="edit-lbl">Damage Dice</span>
              <input className="edit-inp" value={damageDice} onChange={e => setDamageDice(e.target.value)} placeholder="e.g. 1d8" />
            </label>
            <label className="edit-field">
              <span className="edit-lbl">Damage Type</span>
              <input className="edit-inp" value={damageType} onChange={e => setDamageType(e.target.value)} placeholder="e.g. Slashing" />
            </label>
          </>
        )}
        <label className="edit-field">
          <span className="edit-lbl">Magic Bonus (+)</span>
          <input className="edit-inp" type="number" min="0" max="5" value={enhancement} onChange={e => setEnhancement(Number(e.target.value))} />
        </label>
        <label className="edit-field edit-field--check">
          <input type="checkbox" checked={requiresAttunement} onChange={e => setRequiresAttunement(e.target.checked)} />
          <span className="edit-lbl">Requires Attunement</span>
        </label>
      </div>
      <label className="edit-field edit-field--full">
        <span className="edit-lbl">Description</span>
        <textarea className="edit-inp edit-inp--ta" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Notes about this item…" />
      </label>
      <div className="edit-actions">
        <button className="dact dact--accent" onClick={save}>Save to character</button>
        <button className="dact" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

// ── Single gear row ───────────────────────────────────────────
function GearRow({ item, srdMap, isOwner, locked, inventory, updateChar }) {
  const [expanded, setExpanded] = useState(false)
  const [editing,  setEditing]  = useState(false)

  const id      = itemKey(item)
  const srd     = srdMap[item.index]
  const canEquip = isEquippable(item, srdMap)
  const isCurrency = getItemCategory(item, srdMap) === 'Currency'

  const damage = item.damage?.dice
    ? `${item.damage.dice}${item.damage.type ? ' ' + item.damage.type : ''}`
    : srd?.damage
      ? `${srd.damage.damage_dice} ${srd.damage.damage_type?.name ?? ''}`
      : null

  const acVal = item.armorClass
    ?? (srd?.armor_class ? `${srd.armor_class.base}${srd.armor_class.dex_bonus ? '+DEX' : ''}` : null)

  const weight = item.weight ?? srd?.weight ?? null

  const versatile = srd?.two_handed_damage
    ? `${srd.two_handed_damage.damage_dice} ${srd.two_handed_damage.damage_type?.name ?? ''}`
    : null

  const range = srd?.range?.normal
    ? srd.range.long ? `${srd.range.normal}/${srd.range.long} ft` : `${srd.range.normal} ft`
    : null

  const cost = srd?.cost ? `${srd.cost.quantity} ${srd.cost.unit}` : null
  const stealthDisadv = srd?.stealth_disadvantage
  const strReq = srd?.str_minimum ?? null

  const enhancement = item.enhancement ?? 0
  const desc = item.description ?? null
  const props = srd?.properties?.map(p => p.name).join(', ') ?? null

  const update = patch => updateChar({ inventory: inventory.map(i => itemKey(i) === id ? { ...i, ...patch } : i) })
  const toggleEquip  = () => update({ equipped: !item.equipped })
  const toggleAttune = () => update({ attuned: !item.attuned })
  const removeItem   = () => updateChar({ inventory: inventory.filter(i => itemKey(i) !== id) })
  const changeQty    = delta => {
    const q = Math.max(0, (item.quantity ?? 1) + delta)
    if (q === 0) removeItem()
    else update({ quantity: q })
  }
  const saveEdit = updated => {
    updateChar({ inventory: inventory.map(i => itemKey(i) === id ? updated : i) })
    setEditing(false)
  }

  const showQtyInHead = (item.quantity ?? 1) > 1

  return (
    <div className={`gear-row${expanded ? ' gear-row--expanded' : ''}${item.attuned ? ' gear-row--attuned' : ''}`}>

      {/* ── Header ── */}
      <div className="gear-head" onClick={() => { setExpanded(e => !e); setEditing(false) }}>

        {/* Equip circle */}
        {isCurrency ? (
          <div className="equip-circle equip-circle--hidden" />
        ) : canEquip ? (
          <div
            className={`equip-circle${item.equipped ? ' equip-circle--on' : ''}`}
            onClick={e => { e.stopPropagation(); isOwner && !locked && toggleEquip() }}
          />
        ) : (
          <div className="equip-circle equip-circle--hidden" />
        )}

        {item.attuned && <span className="attune-gem">◆</span>}

        <span className="gear-name">{item.name}{enhancement > 0 ? ` +${enhancement}` : ''}</span>

        <div className="gear-badges">
          {damage && <span className="gbadge gbadge--stat">{enhancement > 0 ? `${damage.split(' ')[0]}+${enhancement} ${damage.split(' ').slice(1).join(' ')}`.trim() : damage}</span>}
          {acVal  && <span className="gbadge gbadge--stat">AC {acVal}{enhancement > 0 ? `+${enhancement}` : ''}</span>}
          {weight && !isCurrency && <span className="gbadge">{weight} lb</span>}

          {/* Qty stepper in head row */}
          {showQtyInHead && isOwner && !locked && (
            <div className="qty-ctrl" onClick={e => e.stopPropagation()}>
              <button className="qbtn" onClick={() => changeQty(-1)}>−</button>
              <span className="qval">{item.quantity}</span>
              <button className="qbtn" onClick={() => changeQty(1)}>+</button>
            </div>
          )}
          {showQtyInHead && (!isOwner || locked) && (
            <span className="gbadge">×{item.quantity}</span>
          )}

          <button
            className="xbtn"
            onClick={e => { e.stopPropagation(); setExpanded(v => !v); setEditing(false) }}
          >▾</button>
        </div>
      </div>

      {/* ── Detail panel ── */}
      {expanded && (
        <div className="gear-detail">
          {!editing ? (
            <>
              {/* Stat grid */}
              {(damage || versatile || acVal || range || weight || cost || props || stealthDisadv || strReq) && (
                <div className="detail-grid">
                  {damage    && <div className="ds"><span className="ds-lbl">Damage</span><span className="ds-val">{damage}</span></div>}
                  {versatile && <div className="ds"><span className="ds-lbl">Versatile</span><span className="ds-val">{versatile}</span></div>}
                  {acVal     && <div className="ds"><span className="ds-lbl">AC</span><span className="ds-val">{acVal}</span></div>}
                  {range     && <div className="ds"><span className="ds-lbl">Range</span><span className="ds-val">{range}</span></div>}
                  {weight    && <div className="ds"><span className="ds-lbl">Weight</span><span className="ds-val">{weight} lb</span></div>}
                  {cost      && <div className="ds"><span className="ds-lbl">Cost</span><span className="ds-val">{cost}</span></div>}
                  {enhancement > 0 && <div className="ds"><span className="ds-lbl">Magic Bonus</span><span className="ds-val">+{enhancement}</span></div>}
                  {item.requiresAttunement && <div className="ds"><span className="ds-lbl">Attunement</span><span className="ds-val" style={{ color: 'var(--gold)' }}>Required ◆</span></div>}
                  {stealthDisadv && <div className="ds"><span className="ds-lbl">Stealth</span><span className="ds-val">Disadvantage</span></div>}
                  {strReq    && <div className="ds"><span className="ds-lbl">Str req.</span><span className="ds-val">{strReq}</span></div>}
                  {props     && <div className="ds ds--wide"><span className="ds-lbl">Properties</span><span className="ds-val">{props}</span></div>}
                </div>
              )}

              {desc && <p className="gear-desc">{desc}</p>}

              {/* Action buttons */}
              {isOwner && !locked && (
                <div className="detail-actions">
                  {canEquip && (
                    <button className="dact dact--accent" onClick={toggleEquip}>
                      ⇄ {item.equipped ? 'Unequip' : 'Equip'}
                    </button>
                  )}
                  {item.requiresAttunement && (
                    <button className={`dact dact--gold`} onClick={toggleAttune}>
                      ◆ {item.attuned ? 'Unatune' : 'Attune'}
                    </button>
                  )}
                  <button className="dact" onClick={() => setEditing(true)}>✎ Edit</button>
                  <button className="dact dact--danger" onClick={removeItem}>✕ Remove</button>
                </div>
              )}
            </>
          ) : (
            <EditForm
              item={item}
              srdItem={srd}
              onSave={saveEdit}
              onCancel={() => setEditing(false)}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────
export default function InventoryTab({ char, locked, isOwner, updateChar }) {
  const [srdMap, setSrdMap] = useState({})

  const inventory   = char.inventory ?? []
  const tracking    = char.settings?.encumbranceTracking
  const strScore    = char.stats?.abilityScores?.str ?? 10
  const capacity    = strScore * 15
  const totalWeight = inventory.reduce((s, i) => s + (i.weight ?? 0) * (i.quantity ?? 1), 0)
  const pct = tracking ? Math.min(100, Math.round((totalWeight / capacity) * 100)) : 0

  useEffect(() => {
    getEquipment()
      .then(all => setSrdMap(Object.fromEntries(all.map(e => [e.index, e]))))
      .catch(() => {})
  }, [])

  const rowProps = { srdMap, isOwner, locked, inventory, updateChar }

  const equipped   = inventory.filter(i => i.equipped)
  const unequipped = inventory.filter(i => !i.equipped)

  const attuned    = equipped.filter(i => i.attuned)
  const attuneSlots = 3
  const attunedCount = attuned.length

  // Within Equipped, sub-group by category (excluding attuned — shown separately)
  const equippedBycat = {}
  for (const cat of CATEGORY_ORDER) equippedBycat[cat] = []
  for (const item of equipped.filter(i => !i.attuned)) {
    const cat = getItemCategory(item, srdMap)
    ;(equippedBycat[cat] ??= []).push(item)
  }

  // Bag: group unequipped by category
  const bagByCat = {}
  for (const cat of CATEGORY_ORDER) bagByCat[cat] = []
  for (const item of unequipped) {
    const cat = getItemCategory(item, srdMap)
    ;(bagByCat[cat] ??= []).push(item)
  }

  return (
    <div className="gear-root">

      {/* Carry bar */}
      {tracking && (
        <div className="carry-bar">
          <span className="carry-label">Carried</span>
          <div className="carry-track">
            <div className="carry-fill" style={{
              width: `${pct}%`,
              background: pct > 90 ? 'var(--danger)' : pct > 66 ? 'var(--warning)' : 'var(--hp-high)',
            }} />
          </div>
          <span className="carry-value"><span>{totalWeight}</span> / {capacity} lb</span>
        </div>
      )}

      <div className="gear-scroll">

        {inventory.length === 0 && <p className="empty-hint">No items yet.</p>}

        {/* ══ EQUIPPED ══ */}
        {(equipped.length > 0 || isOwner) && (
          <div className="gear-section">
            <div className="section-hrow">
              <span className="section-title">Equipped</span>
              {isOwner && !locked && <button className="add-btn">+ Add item</button>}
            </div>

            {/* Attuned sub-section */}
            {attuned.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div className="attune-header">
                  <span className="attune-label">⬡ Attuned</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div className="attune-slots">
                      {Array.from({ length: attuneSlots }).map((_, i) => (
                        <div key={i} className={`attune-pip${i < attunedCount ? ' attune-pip--used' : ''}`} />
                      ))}
                    </div>
                    <span className="attune-count">{attunedCount} / {attuneSlots}</span>
                  </div>
                </div>
                {attuned.map(item => <GearRow key={itemKey(item)} item={item} {...rowProps} />)}
              </div>
            )}

            {/* Non-attuned equipped by sub-category */}
            {CATEGORY_ORDER.map(cat => {
              const items = equippedBycat[cat] ?? []
              if (!items.length) return null
              return (
                <div key={cat}>
                  <div className="cat-row"><span className="cat-label">{cat}</span></div>
                  {items.map(item => <GearRow key={itemKey(item)} item={item} {...rowProps} />)}
                </div>
              )
            })}

            {equipped.length === 0 && (
              <p className="empty-hint" style={{ marginTop: 0 }}>Nothing equipped yet.</p>
            )}
          </div>
        )}

        {/* ══ BAG ══ */}
        {(unequipped.length > 0 || isOwner) && (
          <div className="gear-section">
            <div className="section-hrow">
              <span className="section-title">Bag</span>
              {isOwner && !locked && <button className="add-btn">+ Add item</button>}
            </div>

            {CATEGORY_ORDER.map(cat => {
              const items = bagByCat[cat] ?? []
              if (!items.length) return null
              return (
                <div key={cat}>
                  <div className="cat-row"><span className="cat-label">{cat}</span></div>
                  {items.map(item => <GearRow key={itemKey(item)} item={item} {...rowProps} />)}
                </div>
              )
            })}

            {unequipped.length === 0 && (
              <p className="empty-hint" style={{ marginTop: 0 }}>Bag is empty.</p>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

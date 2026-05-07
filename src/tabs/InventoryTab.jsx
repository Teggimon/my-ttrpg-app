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
  if (MAGIC_AC_BONUS[item.index] != null || item.ac_bonus != null || item.index === BRACERS_INDEX || srd.rarity) return 'magic'
  return 'gear'
}

const SECTIONS = [
  { key: 'weapon', label: 'Weapons' },
  { key: 'armor',  label: 'Armour' },
  { key: 'shield', label: 'Shields' },
  { key: 'magic',  label: 'Magic Items' },
  { key: 'gear',   label: 'Gear' },
]

function equipLabel(item) {
  if (MAGIC_AC_BONUS[item.index] != null || item.ac_bonus != null || item.index === BRACERS_INDEX)
    return item.equipped ? 'Attuned' : 'Attune'
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

// ── Expanded item detail panel ────────────────────────────────────────────────

function ItemDetail({ item, srdMap, locked, isOwner, onQty, onRemove, onEdit }) {
  const srd  = srdMap[item.index] ?? {}
  const desc = item.description ?? srd.desc?.join(' ') ?? null

  const dmgDice = item.damage?.dice ?? srd.damage?.damage_dice ?? null
  const dmgType = item.damage?.type ?? srd.damage?.damage_type?.name ?? null
  const props   = item.properties ?? srd.properties?.map(p => p.name) ?? []
  const weight  = item.weight ?? srd.weight ?? null
  const cost    = srd.cost ? `${srd.cost.quantity} ${srd.cost.unit}` : null
  const ac      = item.armor_class ?? srd.armor_class ?? null
  const cat     = item.armor_category ?? srd.armor_category ?? null
  const rarity  = item.rarity ?? srd.rarity?.name ?? null
  const attune  = item.requiresAttunement ?? srd.requires_attunement ?? false
  const enhancement = item.enhancement ?? 0

  return (
    <div className="inv-detail">
      {desc && <p className="inv-detail-desc">{desc}</p>}

      <div className="inv-detail-stats">
        {dmgDice && (
          <span className="inv-detail-tag">
            {dmgDice}{enhancement > 0 ? `+${enhancement}` : ''} {dmgType}
          </span>
        )}
        {ac && cat !== 'Shield' && <span className="inv-detail-tag">AC {ac.base}{cat === 'Light' ? ' + DEX' : cat === 'Medium' ? ' + DEX (max 2)' : ''}</span>}
        {ac && cat === 'Shield' && <span className="inv-detail-tag">+{ac.base ?? 2} AC</span>}
        {enhancement > 0 && !dmgDice && <span className="inv-detail-tag">+{enhancement} magic</span>}
        {rarity && <span className="inv-detail-tag inv-detail-tag--magic">{rarity}</span>}
        {attune && <span className="inv-detail-tag inv-detail-tag--attune">Requires Attunement</span>}
        {weight != null && <span className="inv-detail-tag inv-detail-tag--dim">{weight} lb{weight !== 1 ? 's' : ''}</span>}
        {cost && <span className="inv-detail-tag inv-detail-tag--dim">{cost}</span>}
        {props.map(p => (
          <span key={typeof p === 'string' ? p : p.name} className="inv-detail-tag inv-detail-tag--dim">
            {typeof p === 'string' ? p : p.name}
          </span>
        ))}
      </div>

      {isOwner && !locked && (
        <div className="inv-detail-actions">
          <div className="inv-qty-stepper">
            <button className="inv-qty-btn" onClick={() => onQty(Math.max(0, item.quantity - 1))} disabled={item.quantity <= 1}>−</button>
            <span className="inv-qty-val">{item.quantity}</span>
            <button className="inv-qty-btn" onClick={() => onQty(item.quantity + 1)}>+</button>
          </div>
          <div style={{ display:'flex', gap: 6 }}>
            {item.index?.startsWith('custom-') && (
              <button className="inv-action-btn" onClick={onEdit}>Edit</button>
            )}
            <button className="inv-action-btn inv-action-btn--danger" onClick={onRemove}>Remove</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Item picker ───────────────────────────────────────────────────────────────

const DAMAGE_DICE   = ['1d4','1d6','1d8','1d10','1d12','2d6','2d8']
const DAMAGE_TYPES  = ['Slashing','Piercing','Bludgeoning','Fire','Cold','Lightning','Poison','Acid','Necrotic','Radiant','Psychic','Thunder','Force']
const ITEM_TYPES    = ['Weapon','Armour','Shield','Gear','Magic Item']

function CustomItemForm({ initial, onSave, onCancel }) {
  const [name,    setName]    = useState(initial?.name ?? '')
  const [type,    setType]    = useState(initial?.type ?? 'Gear')
  const [weight,  setWeight]  = useState(initial?.weight ?? '')
  const [desc,    setDesc]    = useState(initial?.description ?? '')
  const [enh,     setEnh]     = useState(initial?.enhancement ?? 0)
  const [qty,     setQty]     = useState(initial?.quantity ?? 1)
  const [dmgDice, setDmgDice] = useState(initial?.damage?.dice ?? '1d8')
  const [dmgType, setDmgType] = useState(initial?.damage?.type ?? 'Slashing')
  const [versOn,  setVersOn]  = useState(!!(initial?.damage?.versatile))
  const [versDice,setVersDice]= useState(initial?.damage?.versatile ?? '1d10')
  const [attune,  setAttune]  = useState(initial?.requiresAttunement ?? false)
  const [equipped,setEquipped]= useState(initial?.equipped ?? false)

  const isWeapon = type === 'Weapon'

  function save() {
    const item = {
      itemId: initial?.itemId ?? uuidv4(),
      index:  initial?.index  ?? `custom-${uuidv4()}`,
      name: name.trim(),
      type,
      quantity: qty,
      weight:   weight !== '' ? Number(weight) : undefined,
      description: desc.trim() || undefined,
      enhancement: enh || undefined,
      equipped,
      requiresAttunement: attune || undefined,
      ...(isWeapon && {
        damage: { dice: dmgDice, type: dmgType, ...(versOn && { versatile: versDice }) }
      }),
    }
    onSave(item)
  }

  const sel = { width:'100%', boxSizing:'border-box', padding:'7px 10px', background:'var(--bg-inset)', border:'0.5px solid var(--border-strong)', borderRadius:'var(--radius-md)', color:'var(--text-primary)', fontFamily:'var(--font-body)', fontSize:13, outline:'none', marginTop:4 }
  const inp = { ...sel }
  const lbl = { display:'block', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:10 }
  const row = { display:'flex', gap:8, alignItems:'center', marginTop:4 }
  const tog = (on) => ({ display:'inline-flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13, color: on ? 'var(--accent-light)' : 'var(--text-muted)', userSelect:'none' })

  return (
    <div className="item-picker card" style={{ padding:'12px 14px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <span style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>
          {initial ? 'Edit Item' : 'New Item'}
        </span>
        <button className="ip-close" onClick={onCancel}>✕</button>
      </div>

      <label style={lbl}>Name</label>
      <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Item name…" autoFocus />

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div>
          <label style={lbl}>Type</label>
          <select style={sel} value={type} onChange={e => setType(e.target.value)}>
            {ITEM_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Qty</label>
          <input style={{ ...inp, textAlign:'center' }} type="number" min="1" value={qty} onChange={e => setQty(Math.max(1, Number(e.target.value)))} />
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div>
          <label style={lbl}>Weight (lbs)</label>
          <input style={inp} type="number" min="0" step="0.5" value={weight} onChange={e => setWeight(e.target.value)} placeholder="—" />
        </div>
        <div>
          <label style={lbl}>Magic Bonus</label>
          <select style={sel} value={enh} onChange={e => setEnh(Number(e.target.value))}>
            {[0,1,2,3].map(n => <option key={n} value={n}>+{n}</option>)}
          </select>
        </div>
      </div>

      <label style={lbl}>Description</label>
      <textarea style={{ ...inp, minHeight:56, resize:'vertical' }} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional description…" />

      {isWeapon && (
        <>
          <label style={lbl}>Damage</label>
          <div style={row}>
            <select style={{ ...sel, marginTop:0, flex:1 }} value={dmgDice} onChange={e => setDmgDice(e.target.value)}>
              {DAMAGE_DICE.map(d => <option key={d}>{d}</option>)}
            </select>
            <select style={{ ...sel, marginTop:0, flex:2 }} value={dmgType} onChange={e => setDmgType(e.target.value)}>
              {DAMAGE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ marginTop:8 }}>
            <label style={tog(versOn)} onClick={() => setVersOn(v => !v)}>
              <span style={{ width:16, height:16, borderRadius:4, border:'1.5px solid var(--border-strong)', background: versOn ? 'var(--accent)' : 'transparent', display:'inline-block', flexShrink:0 }} />
              Versatile
            </label>
            {versOn && (
              <select style={{ ...sel, marginTop:6 }} value={versDice} onChange={e => setVersDice(e.target.value)}>
                {DAMAGE_DICE.map(d => <option key={d}>{d}</option>)}
              </select>
            )}
          </div>
        </>
      )}

      <div style={{ display:'flex', gap:16, marginTop:12 }}>
        <label style={tog(attune)} onClick={() => setAttune(v => !v)}>
          <span style={{ width:16, height:16, borderRadius:4, border:'1.5px solid var(--border-strong)', background: attune ? 'var(--accent)' : 'transparent', display:'inline-block', flexShrink:0 }} />
          Requires Attunement
        </label>
        <label style={tog(equipped)} onClick={() => setEquipped(v => !v)}>
          <span style={{ width:16, height:16, borderRadius:4, border:'1.5px solid var(--border-strong)', background: equipped ? 'var(--accent)' : 'transparent', display:'inline-block', flexShrink:0 }} />
          Equipped
        </label>
      </div>

      <div style={{ display:'flex', gap:8, marginTop:14 }}>
        <button onClick={onCancel} style={{ flex:1, padding:'8px', background:'var(--bg-inset)', border:'0.5px solid var(--border-strong)', borderRadius:'var(--radius-md)', color:'var(--text-secondary)', fontFamily:'var(--font-body)', fontSize:13, cursor:'pointer' }}>
          Cancel
        </button>
        <button onClick={save} disabled={!name.trim()} style={{ flex:2, padding:'8px', background:'var(--accent)', border:'none', borderRadius:'var(--radius-md)', color:'#fff', fontFamily:'var(--font-body)', fontSize:13, fontWeight:700, cursor:'pointer', opacity: name.trim() ? 1 : 0.4 }}>
          {initial ? 'Save Changes' : '+ Add Item'}
        </button>
      </div>
    </div>
  )
}

const PICKER_TABS = [
  { key: 'equipment', label: 'Equipment' },
  { key: 'magic',     label: 'Magic Items' },
  { key: 'custom',    label: 'Custom' },
]

function SrdPicker({ onAdd, onClose }) {
  const [tab,      setTab]      = useState('equipment')
  const [search,   setSearch]   = useState('')
  const [allEquip, setAllEquip] = useState([])
  const [allMagic, setAllMagic] = useState([])

  useEffect(() => {
    getEquipment().then(setAllEquip).catch(() => {})
    getMagicItems().then(setAllMagic).catch(() => {})
  }, [])

  const pool     = tab === 'equipment' ? allEquip : allMagic
  const filtered = pool.filter(i => i.name.toLowerCase().includes(search.toLowerCase())).slice(0, 60)

  function addSrd(srdItem) {
    onAdd({
      itemId:   uuidv4(),
      index:    srdItem.index,
      name:     srdItem.name,
      quantity: 1,
      equipped: false,
      ...(srdItem.armor_class    && { armor_class:    srdItem.armor_class }),
      ...(srdItem.armor_category && { armor_category: srdItem.armor_category }),
      ...(srdItem.weight         && { weight:          srdItem.weight }),
      ...(srdItem.damage         && { damage: { dice: srdItem.damage.damage_dice, type: srdItem.damage.damage_type?.name } }),
      ...(srdItem.rarity         && { rarity: srdItem.rarity.name }),
    })
  }

  return (
    <div className="item-picker card">
      <div className="ip-tabs">
        {PICKER_TABS.filter(t => t.key !== 'custom').map(t => (
          <button key={t.key} className={`ip-tab${tab === t.key ? ' ip-tab--active' : ''}`}
            onClick={() => { setTab(t.key); setSearch('') }}>{t.label}</button>
        ))}
        <button className="ip-close" onClick={onClose}>✕</button>
      </div>
      <input className="ip-search" placeholder="Search…" value={search}
        onChange={e => setSearch(e.target.value)} autoFocus />
      <div className="ip-list">
        {filtered.length === 0 && <div className="ip-empty">No results</div>}
        {filtered.map(item => (
          <button key={item.index} className="ip-row" onClick={() => addSrd(item)}>
            <span className="ip-row-name">{item.name}</span>
            {item.armor_class && <span className="ip-row-tag">AC {item.armor_class.base}</span>}
            {item.damage      && <span className="ip-row-tag">{item.damage.damage_dice}</span>}
            {item.weight      && <span className="ip-row-tag ip-row-tag--dim">{item.weight}lb</span>}
            {item.rarity      && <span className="ip-row-tag ip-row-tag--magic">{item.rarity.name}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main tab ─────────────────────────────────────────────────────────────────

export default function InventoryTab({ char, locked, isOwner, updateChar }) {
  const [srdMap,     setSrdMap]     = useState({})
  const [pickerMode, setPickerMode] = useState(null)   // null | 'srd' | 'custom'
  const [editItem,   setEditItem]   = useState(null)   // item being edited
  const [expandedId, setExpandedId] = useState(null)   // itemId expanded for details

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

  function save(newInv) {
    updateChar({ inventory: newInv, combat: { ...char.combat, ac: computeAC(newInv, char.stats?.abilityScores, srdMap) } })
  }

  function toggleEquip(itemId) {
    save(inventory.map(i => i.itemId === itemId ? { ...i, equipped: !i.equipped } : i))
  }

  function removeItem(itemId) {
    setExpandedId(null)
    save(inventory.filter(i => i.itemId !== itemId))
  }

  function updateQty(itemId, qty) {
    if (qty <= 0) { removeItem(itemId); return }
    save(inventory.map(i => i.itemId === itemId ? { ...i, quantity: qty } : i))
  }

  function addItem(item) {
    save([...inventory, item])
    setPickerMode(null)
    setEditItem(null)
  }

  function saveEdit(updated) {
    save(inventory.map(i => i.itemId === updated.itemId ? updated : i))
    setEditItem(null)
  }

  const grouped = {}
  for (const item of inventory) {
    const cat = itemCategory(item, srdMap)
    ;(grouped[cat] ??= []).push(item)
  }

  const showingPicker = pickerMode === 'srd'
  const showingCustom = pickerMode === 'custom' || editItem

  return (
    <div>
      {tracking && (
        <div className="carry-bar-wrap">
          <div className="carry-meta">
            <span>Carrying {totalWeight.toFixed(1)} / {capacity} lbs</span>
            <span>{pct}%</span>
          </div>
          <div className="carry-track">
            <div className="carry-fill" style={{ width:`${pct}%`, background: pct>90?'#f09090':pct>66?'#efa027':'var(--accent)' }} />
          </div>
        </div>
      )}

      {/* Add buttons */}
      {isOwner && !locked && !showingPicker && !showingCustom && (
        <div className="inv-add-row">
          <button className="inv-add-btn" onClick={() => setPickerMode('srd')}>+ Add from SRD</button>
          <button className="inv-add-btn" onClick={() => setPickerMode('custom')}>+ Custom Item</button>
        </div>
      )}

      {showingPicker && (
        <SrdPicker onAdd={addItem} onClose={() => setPickerMode(null)} />
      )}

      {showingCustom && (
        <CustomItemForm
          initial={editItem}
          onSave={editItem ? saveEdit : addItem}
          onCancel={() => { setPickerMode(null); setEditItem(null) }}
        />
      )}

      {inventory.length === 0 && !showingPicker && !showingCustom && (
        <p className="empty-hint">No items yet — use the buttons above to add gear.</p>
      )}

      {SECTIONS.filter(s => grouped[s.key]?.length).map(section => (
        <div key={section.key}>
          <div className="sec-head">{section.label}</div>
          {grouped[section.key].map(item => {
            const hint       = item.equipped ? acHint(item, srdMap, char.stats?.abilityScores) : null
            const equippable = isItemEquippable(item, srdMap)
            const expanded   = expandedId === item.itemId

            return (
              <div key={item.itemId} className={`inv-row card${expanded ? ' inv-row--expanded' : ''}`}>
                {/* ── Summary row ── */}
                <div className="inv-row-summary" onClick={() => setExpandedId(expanded ? null : item.itemId)}>
                  <div className="inv-info">
                    <span className="inv-name">{item.name}</span>
                    <span className="inv-qty-badge">×{item.quantity}</span>
                    {hint && <span className="inv-ac-hint">· {hint}</span>}
                  </div>
                  <div className="inv-actions" onClick={e => e.stopPropagation()}>
                    {equippable && isOwner && !locked && (
                      <span
                        className={`equip-badge ${item.equipped ? 'equip-badge--on' : ''}`}
                        onClick={() => toggleEquip(item.itemId)}
                      >
                        {equipLabel(item)}
                      </span>
                    )}
                    <span className={`inv-chevron${expanded ? ' inv-chevron--open' : ''}`}>›</span>
                  </div>
                </div>

                {/* ── Expanded detail ── */}
                {expanded && (
                  <ItemDetail
                    item={item}
                    srdMap={srdMap}
                    locked={locked}
                    isOwner={isOwner}
                    onQty={qty => updateQty(item.itemId, qty)}
                    onRemove={() => removeItem(item.itemId)}
                    onEdit={() => { setEditItem(item); setExpandedId(null) }}
                  />
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

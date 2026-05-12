import { useState, useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { getEquipment, getMagicItems } from '../srdContent'
import { ALL_SOURCES, sourceCode, sourceOptions } from '../sourceFilters'
import { inventoryItemFromCatalogItem, normalizeInventoryItem } from '../itemRules'
import '../TabShared.css'
import './InventoryTab.css'

function abilityMod(score) { return Math.floor((score - 10) / 2) }

const MAGIC_AC_BONUS = {
  'ring-of-protection':    1,
  'cloak-of-protection':   1,
  'ioun-stone-protection': 1,
}
const BRACERS_INDEX = 'bracers-of-defense'

const CURRENCY_NAMES = new Set([
  'Gold Pieces','Silver Pieces','Copper Pieces','Electrum Pieces','Platinum Pieces',
])

const COINS = [
  { key: 'pp', label: 'PP', name: 'Platinum Pieces', index: 'platinum-pieces' },
  { key: 'gp', label: 'GP', name: 'Gold Pieces', index: 'gold-pieces' },
  { key: 'ep', label: 'EP', name: 'Electrum Pieces', index: 'electrum-pieces' },
  { key: 'sp', label: 'SP', name: 'Silver Pieces', index: 'silver-pieces' },
  { key: 'cp', label: 'CP', name: 'Copper Pieces', index: 'copper-pieces' },
]

function currencyKey(item) {
  const text = `${item.index ?? ''} ${item.name ?? ''}`.toLowerCase()
  if (/platinum|^pp\b/.test(text)) return 'pp'
  if (/gold|^gp\b/.test(text)) return 'gp'
  if (/electrum|^ep\b/.test(text)) return 'ep'
  if (/silver|^sp\b/.test(text)) return 'sp'
  if (/copper|^cp\b/.test(text)) return 'cp'
  return null
}

export function isItemEquippable(item, srdMap) {
  if (item.equipped)                      return true  // already marked by user
  if (item.damage)                        return true
  if (item.ac_bonus != null)              return true
  if (MAGIC_AC_BONUS[item.index] != null) return true
  if (item.index === BRACERS_INDEX)       return true
  if (item.requiresAttunement)            return true
  if (item.chargesMax)                    return true  // wands, staves, etc.
  if (item.rarity)                        return true  // any magic item is holdable
  if (item.type === 'Magic Item')         return true
  const srd = srdMap[item.index] ?? {}
  if (srd.damage)              return true
  if (srd.armor_class)         return true
  if (item.armor_class)        return true
  if (srd.requires_attunement) return true
  if (srd.rarity)              return true
  return false
}

function needsAttunement(item, srdMap) {
  if (item.requiresAttunement) return true
  return !!(srdMap[item.index]?.requires_attunement)
}

export function computeAC(inventory, abilityScores, srdMap) {
  const dexMod   = abilityMod(abilityScores?.dex ?? 10)
  const active   = inventory.filter(i => i.equipped || i.attuned)
  let armorBase = null, armorCat = null, shieldAC = 0, flatACBonus = 0, hasBracers = false

  for (const item of active) {
    const srd    = srdMap[item.index] ?? {}
    const ac     = item.armor_class ?? srd.armor_class
    const cat    = item.armor_category ?? srd.armor_category
    const attReq = needsAttunement(item, srdMap)
    if (attReq && !item.attuned) continue
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
  if (
    MAGIC_AC_BONUS[item.index] != null || item.ac_bonus != null ||
    item.index === BRACERS_INDEX || item.rarity || srd.rarity ||
    item.type === 'Magic Item' || item.requiresAttunement || srd.requires_attunement
  ) return 'magic'
  if (CURRENCY_NAMES.has(item.name) || item.isCurrency) return 'currency'
  const eqCat = srd.equipment_category?.index
  if (eqCat === 'ammunition') return 'ammo'
  return 'gear'
}

function isMagicItem(item, srdMap) {
  const srd = srdMap[item.index] ?? {}
  return !!(
    item.rarity || srd.rarity ||
    item.type === 'Magic Item' ||
    item.requiresAttunement || srd.requires_attunement ||
    (item.enhancement ?? 0) > 0 ||
    item.ac_bonus != null ||
    MAGIC_AC_BONUS[item.index] != null ||
    item.index === BRACERS_INDEX ||
    item.chargesMax ||
    (item.effects ?? []).length > 0
  )
}

// ── Row stat chips ────────────────────────────────────────────────────────────

function rowChips(item, srdMap, abilityScores) {
  const chips  = []
  const srd    = srdMap[item.index] ?? {}
  const dexMod = abilityMod(abilityScores?.dex ?? 10)

  // Damage dice
  const dmgDice = item.damage?.dice ?? srd.damage?.damage_dice
  if (dmgDice) {
    const enh = item.enhancement ?? 0
    chips.push({ label: enh > 0 ? `${dmgDice}+${enh}` : dmgDice, cls: '' })
  }

  // Armor / Shield AC
  const ac  = item.armor_class ?? srd.armor_class
  const cat = item.armor_category ?? srd.armor_category
  if (ac && cat) {
    if (cat === 'Shield') {
      chips.push({ label: `+${ac.base ?? 2} AC`, cls: '' })
    } else {
      const shown = cat === 'Heavy'  ? ac.base
                  : cat === 'Medium' ? ac.base + Math.min(dexMod, 2)
                  : ac.base + dexMod
      chips.push({ label: `AC ${shown}`, cls: '' })
    }
  }

  // Magic AC bonus
  const magicAC = MAGIC_AC_BONUS[item.index]
  if (magicAC)                chips.push({ label: `+${magicAC} AC`, cls: 'magic' })
  if (item.ac_bonus)          chips.push({ label: `+${item.ac_bonus} AC`, cls: 'magic' })
  if (item.index === BRACERS_INDEX) chips.push({ label: '+2 AC', cls: 'magic' })

  // Custom effects
  for (const ef of item.effects ?? []) {
    const val = ef.mode === 'add'
      ? (ef.value >= 0 ? `+${ef.value}` : String(ef.value))
      : `=${ef.value}`
    chips.push({ label: `${val} ${ef.stat}`, cls: 'magic' })
  }

  // Weight
  if (item.weight != null) chips.push({ label: `${item.weight} lb`, cls: 'dim' })

  return chips
}

// ── Item row ──────────────────────────────────────────────────────────────────

function ItemRow({ item, srdMap, abilityScores, locked, isOwner, expanded, onToggleExpand, onEquip, onAttune, onQty, onCharges, onRemove, onEdit, showQty, attunedCount, attunementLimit }) {
  const chips     = rowChips(item, srdMap, abilityScores)
  const reqAttune = needsAttunement(item, srdMap)
  const canEquip  = isItemEquippable(item, srdMap)
  const isMagic   = isMagicItem(item, srdMap)

  return (
    <div className={`inv-row card${isMagic ? ' inv-row--magic' : ''}${expanded ? ' inv-row--expanded' : ''}`}>
      <div className="inv-row-main">
        {/* Blue equip circle */}
        <button
          className={`inv-circle${item.equipped || item.attuned ? ' inv-circle--on' : ''}${!canEquip && !reqAttune ? ' inv-circle--inert' : ''}`}
          onClick={e => { e.stopPropagation(); if (isOwner && !locked) onEquip() }}
          disabled={!isOwner || locked || (!canEquip && !reqAttune)}
          aria-label={item.equipped ? 'Unequip' : 'Equip'}
        >
          {(item.equipped || item.attuned) && <span className="inv-circle-check" />}
        </button>

        {/* Gold attune dot — only for items that require attunement */}
        {reqAttune ? (
          <button
            className={`inv-attune-dot${item.attuned ? ' inv-attune-dot--on' : ''}`}
            onClick={e => { e.stopPropagation(); if (isOwner && !locked) onAttune() }}
            disabled={!isOwner || locked || (!item.attuned && attunedCount >= attunementLimit)}
            title={item.attuned ? 'Unattune' : attunedCount >= attunementLimit ? `Max ${attunementLimit} items attuned` : 'Attune'}
            aria-label={item.attuned ? 'Unattune' : 'Attune'}
          />
        ) : (
          <span className="inv-dot-spacer" />
        )}

        {/* Name */}
        <div className="inv-row-name">
          {item.name}
        </div>

        {/* Stat chips */}
        {chips.length > 0 && (
          <div className="inv-row-chips">
            {chips.map((c, i) => (
              <span key={i} className={`inv-chip${c.cls ? ` inv-chip--${c.cls}` : ''}`}>{c.label}</span>
            ))}
          </div>
        )}

        {/* Charges stepper — shown for any item with charges (wands, staves, etc.) */}
        {item.chargesMax && isOwner && !locked && (
          <div className="inv-qty-inline inv-qty-inline--charges" onClick={e => e.stopPropagation()}>
            <button className="inv-qty-inline-btn"
              onClick={() => onCharges(Math.max(0, (item.chargesCurrent ?? item.chargesMax) - 1))}
              disabled={(item.chargesCurrent ?? item.chargesMax) <= 0}>−</button>
            <span className="inv-qty-inline-val inv-qty-inline-val--charges">
              {item.chargesCurrent ?? item.chargesMax} / {item.chargesMax}
            </span>
            <button className="inv-qty-inline-btn"
              onClick={() => onCharges(Math.min(item.chargesMax, (item.chargesCurrent ?? item.chargesMax) + 1))}
              disabled={(item.chargesCurrent ?? item.chargesMax) >= item.chargesMax}>+</button>
          </div>
        )}

        {/* Qty stepper — bag items without charges */}
        {showQty && !item.chargesMax && isOwner && !locked && (
          <div className="inv-qty-inline" onClick={e => e.stopPropagation()}>
            <button className="inv-qty-inline-btn" onClick={() => onQty((item.quantity ?? 1) - 1)}>−</button>
            <span className="inv-qty-inline-val">{item.quantity ?? 1}</span>
            <button className="inv-qty-inline-btn" onClick={() => onQty((item.quantity ?? 1) + 1)}>+</button>
          </div>
        )}

        {/* Chevron */}
        <button
          className={`inv-chevron-btn${expanded ? ' inv-chevron-btn--open' : ''}`}
          onClick={onToggleExpand}
          aria-label="Toggle details"
        >›</button>
      </div>

      {expanded && (
        <ItemDetail
          item={item}
          srdMap={srdMap}
          locked={locked}
          isOwner={isOwner}
          onQty={onQty}
          onRemove={onRemove}
          onEdit={onEdit}
        />
      )}
    </div>
  )
}

// ── Expanded detail panel ─────────────────────────────────────────────────────

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
  const rarity  = item.rarity ?? (typeof srd.rarity === 'string' ? srd.rarity : srd.rarity?.name) ?? null
  const attune  = item.requiresAttunement ?? srd.requires_attunement ?? false
  const enh     = item.enhancement ?? 0

  return (
    <div className="inv-detail">
      {desc && <p className="inv-detail-desc">{desc}</p>}

      <div className="inv-detail-stats">
        {dmgDice && (
          <span className="inv-detail-tag">{dmgDice}{enh > 0 ? `+${enh}` : ''} {dmgType}</span>
        )}
        {ac && cat !== 'Shield' && (
          <span className="inv-detail-tag">
            AC {ac.base}{cat === 'Light' ? ' + DEX' : cat === 'Medium' ? ' + DEX (max 2)' : ''}
          </span>
        )}
        {ac && cat === 'Shield' && <span className="inv-detail-tag">+{ac.base ?? 2} AC (Shield)</span>}
        {enh > 0 && !dmgDice && <span className="inv-detail-tag">+{enh} magic</span>}
        {rarity  && <span className="inv-detail-tag inv-detail-tag--magic">{rarity}</span>}
        {attune  && <span className="inv-detail-tag inv-detail-tag--attune">Requires Attunement</span>}
        {weight != null && <span className="inv-detail-tag inv-detail-tag--dim">{weight} lb</span>}
        {cost    && <span className="inv-detail-tag inv-detail-tag--dim">{cost}</span>}
        {props.map(p => (
          <span key={typeof p === 'string' ? p : p.name} className="inv-detail-tag inv-detail-tag--dim">
            {typeof p === 'string' ? p : p.name}
          </span>
        ))}
      </div>

      {(item.effects ?? []).length > 0 && (
        <div className="inv-detail-stats" style={{ marginTop: 0 }}>
          {item.effects.map((ef, i) => (
            <span key={i} className="inv-detail-tag inv-detail-tag--attune">
              {ef.stat} {ef.mode === 'add' ? (ef.value >= 0 ? `+${ef.value}` : ef.value) : `= ${ef.value}`}
              {ef.notes ? ` (${ef.notes})` : ''}
            </span>
          ))}
        </div>
      )}

      {isOwner && !locked && (
        <div className="inv-detail-actions">
          <div className="inv-qty-stepper">
            <button className="inv-qty-btn" onClick={() => onQty(Math.max(0, (item.quantity ?? 1) - 1))} disabled={(item.quantity ?? 1) <= 1}>−</button>
            <span className="inv-qty-val">{item.quantity ?? 1}</span>
            <button className="inv-qty-btn" onClick={() => onQty((item.quantity ?? 1) + 1)}>+</button>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button className="inv-action-btn" onClick={onEdit}>Edit</button>
            <button className="inv-action-btn inv-action-btn--danger" onClick={onRemove}>Remove</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Custom item form ──────────────────────────────────────────────────────────

const DAMAGE_DICE  = ['1d4','1d6','1d8','1d10','1d12','2d6','2d8']
const DAMAGE_TYPES = ['Slashing','Piercing','Bludgeoning','Fire','Cold','Lightning','Poison','Acid','Necrotic','Radiant','Psychic','Thunder','Force']
const ITEM_TYPES   = ['Weapon','Armour','Shield','Gear','Magic Item']
const EFFECT_STATS = ['STR','DEX','CON','INT','WIS','CHA','AC','Attack Roll','Damage','Speed','HP Max','Saving Throws','Spell Save DC','Spell Attack']
const BLANK_EFFECT = { stat: 'AC', mode: 'add', value: 1, notes: '' }

function EffectRow({ effect, onChange, onRemove }) {
  const s = { background:'var(--bg-inset)', border:'0.5px solid var(--border-strong)', borderRadius:'var(--radius-md)', color:'var(--text-primary)', fontFamily:'var(--font-body)', fontSize:12, outline:'none', padding:'5px 7px' }
  return (
    <div className="effect-row">
      <select style={{ ...s, flex:2 }} value={effect.stat} onChange={e => onChange({ ...effect, stat: e.target.value })}>
        {EFFECT_STATS.map(st => <option key={st}>{st}</option>)}
      </select>
      <div className="effect-mode-toggle">
        {['add','set'].map(m => (
          <button key={m} type="button"
            className={`effect-mode-btn${effect.mode === m ? ' effect-mode-btn--on' : ''}`}
            onClick={() => onChange({ ...effect, mode: m })}
          >{m === 'add' ? '+ Add' : '= Set'}</button>
        ))}
      </div>
      <input style={{ ...s, width:44, textAlign:'center' }} type="number"
        value={effect.value} onChange={e => onChange({ ...effect, value: Number(e.target.value) })} />
      <input style={{ ...s, flex:3 }} placeholder="Notes (optional)"
        value={effect.notes} onChange={e => onChange({ ...effect, notes: e.target.value })} />
      <button type="button" onClick={onRemove}
        style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:14, padding:'0 2px', fontFamily:'var(--font-body)' }}>×</button>
    </div>
  )
}

function CustomItemForm({ initial, onSave, onCancel, embedded = false }) {
  const [name,     setName]     = useState(initial?.name ?? '')
  const [type,     setType]     = useState(initial?.type ?? 'Gear')
  const [weight,   setWeight]   = useState(initial?.weight ?? '')
  const [desc,     setDesc]     = useState(initial?.description ?? '')
  const [enh,      setEnh]      = useState(initial?.enhancement ?? 0)
  const [qty,      setQty]      = useState(initial?.quantity ?? 1)
  const [dmgDice,  setDmgDice]  = useState(initial?.damage?.dice ?? '1d8')
  const [dmgType,  setDmgType]  = useState(initial?.damage?.type ?? 'Slashing')
  const [versOn,   setVersOn]   = useState(!!(initial?.damage?.versatile))
  const [versDice, setVersDice] = useState(initial?.damage?.versatile ?? '1d10')
  const [chargesMax,   setChargesMax]   = useState(initial?.chargesMax ?? '')
  const [useDice,      setUseDice]      = useState(initial?.useDice ?? '')
  const [useDiceType,  setUseDiceType]  = useState(initial?.useDiceType ?? 'Force')
  const [attune,   setAttune]   = useState(initial?.requiresAttunement ?? false)
  const [equipped, setEquipped] = useState(initial?.equipped ?? false)
  const [effects,  setEffects]  = useState(initial?.effects ?? [])

  const isWeapon = type === 'Weapon'
  const updateEffect = (i, ef) => setEffects(prev => prev.map((e, j) => j === i ? ef : e))
  const removeEffect = (i)     => setEffects(prev => prev.filter((_, j) => j !== i))

  function save() {
    onSave({
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
      ...(chargesMax !== '' && Number(chargesMax) > 0 && {
        chargesMax: Number(chargesMax),
        chargesCurrent: initial?.chargesCurrent ?? Number(chargesMax),
        ...(useDice.trim() && { useDice: useDice.trim(), useDiceType }),
      }),
      effects: effects.length ? effects : undefined,
      ...(isWeapon && {
        damage: { dice: dmgDice, type: dmgType, ...(versOn && { versatile: versDice }) }
      }),
    })
  }

  const sel = { width:'100%', boxSizing:'border-box', padding:'7px 10px', background:'var(--bg-inset)', border:'0.5px solid var(--border-strong)', borderRadius:'var(--radius-md)', color:'var(--text-primary)', fontFamily:'var(--font-body)', fontSize:13, outline:'none', marginTop:4 }
  const inp = { ...sel }
  const lbl = { display:'block', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:10 }
  const row = { display:'flex', gap:8, alignItems:'center', marginTop:4 }
  const tog = (on) => ({ display:'inline-flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13, color: on ? 'var(--accent-light)' : 'var(--text-muted)', userSelect:'none' })

  return (
    <div className={embedded ? 'custom-item-form custom-item-form--embedded' : 'item-picker card'} style={{ padding:'12px 14px' }}>
      {!embedded && <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <span style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>
          {initial ? 'Edit Item' : 'New Item'}
        </span>
        <button className="ip-close" onClick={onCancel}>✕</button>
      </div>}

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

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
        <div>
          <label style={lbl}>Weight (lbs)</label>
          <input style={inp} type="number" min="0" step="0.5" value={weight} onChange={e => setWeight(e.target.value)} placeholder="—" />
        </div>
        <div>
          <label style={lbl}>Max Charges</label>
          <input style={{ ...inp, textAlign:'center' }} type="number" min="0" value={chargesMax} onChange={e => setChargesMax(e.target.value)} placeholder="—" />
        </div>
        <div>
          <label style={lbl}>Magic Bonus</label>
          <select style={sel} value={enh} onChange={e => setEnh(Number(e.target.value))}>
            {[0,1,2,3].map(n => <option key={n} value={n}>+{n}</option>)}
          </select>
        </div>
      </div>

      {chargesMax !== '' && Number(chargesMax) > 0 && (
        <>
          <label style={lbl}>Use Dice &amp; Damage Type</label>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:4 }}>
            <input style={inp} value={useDice} onChange={e => setUseDice(e.target.value)}
              placeholder="e.g. 1d4+1 or 3d4+3" />
            <select style={sel} value={useDiceType} onChange={e => setUseDiceType(e.target.value)}>
              {DAMAGE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </>
      )}

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

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', ...lbl, marginBottom:4 }}>
        <span>Effects</span>
        <button type="button" onClick={() => setEffects(prev => [...prev, { ...BLANK_EFFECT }])}
          style={{ background:'none', border:'0.5px solid var(--border-strong)', borderRadius:'var(--radius-md)', color:'var(--accent-light)', fontSize:11, fontWeight:700, padding:'2px 8px', cursor:'pointer', fontFamily:'var(--font-body)' }}>
          + Add Effect
        </button>
      </div>
      {effects.length === 0 && (
        <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>No effects — grant bonuses to AC, ability scores, speed, etc.</div>
      )}
      {effects.map((ef, i) => (
        <EffectRow key={i} effect={ef} onChange={upd => updateEffect(i, upd)} onRemove={() => removeEffect(i)} />
      ))}

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
        <button onClick={save} disabled={!name.trim()} style={{ flex:2, padding:'8px', background:'var(--accent)', border:'none', borderRadius:'var(--radius-md)', color:'var(--text-primary)', fontFamily:'var(--font-body)', fontSize:13, fontWeight:700, cursor:'pointer', opacity: name.trim() ? 1 : 0.4 }}>
          {initial ? 'Save Changes' : '+ Add Item'}
        </button>
      </div>
    </div>
  )
}

// ── Universal inventory modal ────────────────────────────────────────────────

function catalogItemToInventoryItem(srdItem) {
  return {
    itemId:   uuidv4(),
    ...inventoryItemFromCatalogItem(srdItem),
  }
}

function cloneInventoryItem(item) {
  return {
    ...item,
    itemId: uuidv4(),
    quantity: item.quantity ?? 1,
    equipped: false,
    attuned: false,
    chargesCurrent: item.chargesMax ? (item.chargesCurrent ?? item.chargesMax) : item.chargesCurrent,
  }
}

function isCustomInventoryItem(item, srdMap) {
  return !!(
    item.custom ||
    String(item.index ?? '').startsWith('custom-') ||
    (item.index && item.name && !srdMap[item.index])
  )
}

function sourceMatches(item, sourceFilter) {
  if (sourceFilter === ALL_SOURCES) return true
  if (sourceFilter === 'Custom') return item.source === 'Custom'
  return sourceCode(item) === sourceFilter
}

function AddInventoryModal({ inventory, srdMap, onAdd, onClose }) {
  const [tab,      setTab]      = useState('search')
  const [search,   setSearch]   = useState('')
  const [sourceFilter, setSourceFilter] = useState(ALL_SOURCES)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [allEquip, setAllEquip] = useState([])
  const [allMagic, setAllMagic] = useState([])
  const [addEquipped, setAddEquipped] = useState(false)

  useEffect(() => {
    getEquipment().then(setAllEquip).catch(() => {})
    getMagicItems().then(setAllMagic).catch(() => {})
  }, [])

  const customItems = inventory
    .filter(item => isCustomInventoryItem(item, srdMap))
    .filter((item, index, list) => list.findIndex(other => other.index === item.index && other.name === item.name) === index)
    .map(item => ({ ...item, source: item.source ?? 'Custom' }))
  const pool = [...customItems, ...allEquip, ...allMagic]
  const sources  = sourceOptions(pool)
  const sourceList = customItems.length ? ['Custom', ...sources.filter(source => source !== 'Custom')] : sources
  const filtered = pool
    .filter(item => {
      const text = `${item.name ?? ''} ${item.description ?? ''} ${item.type ?? ''} ${item.desc?.join(' ') ?? ''}`.toLowerCase()
      return !search || text.includes(search.toLowerCase())
    })
    .filter(item => sourceMatches(item, sourceFilter))
    .slice(0, 160)

  function addItem(item) {
    onAdd(addEquipped ? { ...item, equipped: true } : item)
  }

  return (
    <div className="inv-modal-overlay" onClick={onClose}>
      <div className="inv-modal" onClick={e => e.stopPropagation()}>
        <div className="inv-modal-head">
          <div>
            <div className="inv-modal-title">Add to Inventory</div>
            <div className="inv-modal-sub">Search repository gear, magic items, and saved custom items.</div>
          </div>
          <button className="ip-close" onClick={onClose}>✕</button>
        </div>

        <div className="ip-tabs">
          {[{ key:'search', label:'Search' }, { key:'new', label:'New Item' }].map(t => (
            <button key={t.key} className={`ip-tab${tab === t.key ? ' ip-tab--active' : ''}`}
              onClick={() => { setTab(t.key); setSearch(''); setSourceFilter(ALL_SOURCES); setSourceOpen(false) }}>{t.label}</button>
          ))}
        </div>

        <label className="inv-modal-equip-toggle">
          <input type="checkbox" checked={addEquipped} onChange={e => setAddEquipped(e.target.checked)} />
          <span>Add as equipped</span>
        </label>

        {tab === 'search' && (
          <>
            <div className="ip-search-row">
              <div className="ip-search-wrap">
                <input className="ip-search" placeholder="Search inventory database…" value={search}
                  onChange={e => setSearch(e.target.value)} autoFocus />
                {search && (
                  <button className="ip-search-clear" type="button" onClick={() => setSearch('')} aria-label="Clear search">×</button>
                )}
              </div>
              {sourceList.length > 1 && (
                <div className="ip-source-menu-wrap">
                  <button
                    className={`ip-source-filter${sourceFilter !== ALL_SOURCES ? ' ip-source-filter--active' : ''}`}
                    type="button"
                    onClick={() => setSourceOpen(open => !open)}
                    aria-label="Filter sources"
                  >
                    {sourceFilter === ALL_SOURCES ? 'Filter' : sourceFilter}
                  </button>
                  {sourceOpen && (
                    <div className="ip-source-menu">
                      {[ALL_SOURCES, ...sourceList].map(source => (
                        <button
                          key={source}
                          type="button"
                          className={`ip-source-option${sourceFilter === source ? ' ip-source-option--active' : ''}`}
                          onClick={() => { setSourceFilter(source); setSourceOpen(false) }}
                        >
                          {source === ALL_SOURCES ? 'All sources' : source}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="ip-list ip-list--modal">
              {filtered.length === 0 && <div className="ip-empty">No results</div>}
              {filtered.map(item => {
                const isCustom = isCustomInventoryItem(item, srdMap)
                const invItem = isCustom ? cloneInventoryItem(item) : catalogItemToInventoryItem(item)
                return (
                  <button key={`${item.index}-${item.name}-${item.source ?? ''}`} className="ip-row" onClick={() => addItem(invItem)}>
                    <span className="ip-row-name">{item.name}</span>
                    <span className="ip-row-tag ip-row-tag--source">{isCustom ? 'Custom' : sourceCode(item)}</span>
                    {item.armor_class && <span className="ip-row-tag">AC {item.armor_class.base}</span>}
                    {item.damage && <span className="ip-row-tag">{item.damage.damage_dice ?? item.damage.dice}</span>}
                    {item.weight && <span className="ip-row-tag ip-row-tag--dim">{item.weight} lb</span>}
                    {item.rarity && <span className="ip-row-tag ip-row-tag--magic">{typeof item.rarity === 'string' ? item.rarity : item.rarity.name}</span>}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {tab === 'new' && (
          <CustomItemForm
            embedded
            onSave={item => addItem({ ...item, custom: true })}
            onCancel={onClose}
          />
        )}
      </div>
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function InventoryTab({ char, locked, isOwner, updateChar }) {
  const [srdMap,     setSrdMap]     = useState({})
  const [showAddModal, setShowAddModal] = useState(false)
  const [editItem,   setEditItem]   = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    Promise.all([getEquipment().catch(() => []), getMagicItems().catch(() => [])])
      .then(([equip, magic]) =>
        setSrdMap(Object.fromEntries([...equip, ...magic].map(e => [e.index, e])))
      )
  }, [])

  // Backfill itemId for legacy characters
  const rawInventory = char.inventory ?? []
  const tempIds = useRef({})
  const inventory = rawInventory.map((item, idx) => {
    const itemWithId = item.itemId ? item : { ...item, itemId: tempIds.current[idx] ?? (tempIds.current[idx] = uuidv4()) }
    return normalizeInventoryItem(itemWithId, srdMap)
  })
  useEffect(() => {
    if (JSON.stringify(rawInventory) === JSON.stringify(inventory)) return
    updateChar({ inventory })
  }, [Object.keys(srdMap).length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Weight tracking
  const tracking    = char.settings?.encumbranceTracking
  const attunementLimit = Math.max(0, Number(char.settings?.attunementLimit ?? 3))
  const strScore    = char.stats?.abilityScores?.str ?? 10
  const capacity    = strScore * 15
  const totalWeight = inventory.reduce((s, i) => s + (i.weight ?? srdMap[i.index]?.weight ?? 0) * (i.quantity ?? 1), 0)
  const pct         = Math.min(100, Math.round((totalWeight / capacity) * 100))

  function save(newInv) {
    updateChar({ inventory: newInv, combat: { ...char.combat, ac: computeAC(newInv, char.stats?.abilityScores, srdMap) } })
  }

  function setEncumbranceTracking(enabled) {
    updateChar({ settings: { ...char.settings, encumbranceTracking: enabled } })
  }

  function toggleEquip(itemId) {
    const item       = inventory.find(i => i.itemId === itemId)
    const nowEquipped = !item?.equipped
    // Unequipping an attuned item also breaks attunement
    save(inventory.map(i => i.itemId === itemId
      ? { ...i, equipped: nowEquipped, attuned: nowEquipped ? i.attuned : false }
      : i
    ))
  }

  function toggleAttune(itemId) {
    const item     = inventory.find(i => i.itemId === itemId)
    const attuning = !item?.attuned
    const count    = inventory.filter(i => i.attuned && i.itemId !== itemId).length
    if (attuning && count >= attunementLimit) return
    // Attuning auto-equips; unattuning leaves equipped state alone
    save(inventory.map(i => i.itemId === itemId
      ? { ...i, attuned: attuning, equipped: attuning ? true : i.equipped }
      : i
    ))
  }

  function removeItem(itemId) {
    setExpandedId(null)
    save(inventory.filter(i => i.itemId !== itemId))
  }

  function updateQty(itemId, qty) {
    if (qty <= 0) { removeItem(itemId); return }
    save(inventory.map(i => i.itemId === itemId ? { ...i, quantity: qty } : i))
  }

  function updateCharges(itemId, charges) {
    save(inventory.map(i => i.itemId === itemId ? { ...i, chargesCurrent: charges } : i))
  }

  function currencyTotals() {
    return COINS.reduce((totals, coin) => {
      totals[coin.key] = inventory
        .filter(item => currencyKey(item) === coin.key)
        .reduce((sum, item) => sum + (item.quantity ?? 0), 0)
      return totals
    }, {})
  }

  function updateCurrency(coinKey, quantity) {
    const coin = COINS.find(c => c.key === coinKey)
    if (!coin) return
    const nextQuantity = Math.max(0, Number.isFinite(quantity) ? quantity : 0)
    let found = false
    const nextInventory = inventory
      .map(item => {
        if (currencyKey(item) !== coinKey) return item
        if (found) return null
        found = true
        return {
          ...item,
          itemId: item.itemId ?? uuidv4(),
          index: coin.index,
          name: coin.name,
          quantity: nextQuantity,
          isCurrency: true,
          equipped: false,
          attuned: false,
        }
      })
      .filter(Boolean)
      .filter(item => !item.isCurrency || (item.quantity ?? 0) > 0)

    if (!found && nextQuantity > 0) {
      nextInventory.push({
        itemId: uuidv4(),
        index: coin.index,
        name: coin.name,
        quantity: nextQuantity,
        isCurrency: true,
        equipped: false,
      })
    }
    save(nextInventory)
  }

  function addItem(item) {
    save([...inventory, item])
    setShowAddModal(false)
    setEditItem(null)
  }

  function saveEdit(updated) {
    save(inventory.map(i => i.itemId === updated.itemId ? updated : i))
    setEditItem(null)
  }

  // ── Categorise inventory ──
  const attunedItems  = inventory.filter(i => i.attuned)
  const equippedItems = inventory.filter(i => i.equipped && !i.attuned)   // equipped but not yet attuned
  const bagItems      = inventory.filter(i => !i.equipped && !i.attuned)
  const attunedCount  = attunedItems.length

  const eq = {
    weapon: equippedItems.filter(i => itemCategory(i, srdMap) === 'weapon'),
    armor:  equippedItems.filter(i => itemCategory(i, srdMap) === 'armor'),
    shield: equippedItems.filter(i => itemCategory(i, srdMap) === 'shield'),
    magic:  equippedItems.filter(i => itemCategory(i, srdMap) === 'magic'),
    gear:   equippedItems.filter(i => !['weapon','armor','shield','magic'].includes(itemCategory(i, srdMap))),
  }

  const isCur  = i => CURRENCY_NAMES.has(i.name) || i.isCurrency
  const isAmmo = i => srdMap[i.index]?.equipment_category?.index === 'ammunition' || i.isAmmo
  const currencyItems = bagItems.filter(isCur)
  const ammoItems     = bagItems.filter(i => !isCur(i) && isAmmo(i))
  const gearItems     = bagItems.filter(i => !isCur(i) && !isAmmo(i))

  const abilityScores = char.stats?.abilityScores
  const showingCustom = !!editItem
  const coins = currencyTotals()

  function renderRow(item, showQty = false) {
    return (
      <ItemRow
        key={item.itemId}
        item={item}
        srdMap={srdMap}
        abilityScores={abilityScores}
        locked={locked}
        isOwner={isOwner}
        expanded={expandedId === item.itemId}
        onToggleExpand={() => setExpandedId(expandedId === item.itemId ? null : item.itemId)}
        onEquip={() => toggleEquip(item.itemId)}
        onAttune={() => toggleAttune(item.itemId)}
        onQty={qty => updateQty(item.itemId, qty)}
        onCharges={c => updateCharges(item.itemId, c)}
        onRemove={() => removeItem(item.itemId)}
        onEdit={() => { setEditItem(item); setExpandedId(null) }}
        showQty={showQty}
        attunedCount={attunedCount}
        attunementLimit={attunementLimit}
      />
    )
  }

  const hasEquipped = attunedItems.length > 0 || equippedItems.length > 0

  return (
    <div>
      {/* Carry bar */}
      <div className={`carry-bar-wrap${tracking ? '' : ' carry-bar-wrap--off'}`}>
          <div className="carry-meta">
            <span>Carrying {totalWeight.toFixed(1)} / {capacity} lbs</span>
            <span>{tracking ? `${pct}%` : 'Tracking off'}</span>
          </div>
          <div className="carry-track">
            <div className="carry-fill" style={{ width:`${pct}%`, background: pct>90?'var(--danger)':pct>66?'var(--warning)':'var(--accent)' }} />
          </div>
          {isOwner && !locked && (
            <button className="carry-toggle" onClick={() => setEncumbranceTracking(!tracking)}>
              {tracking ? 'Disable encumbrance' : 'Enable encumbrance'}
            </button>
          )}
        </div>

      <div className="inv-top-actions">
        <div className="currency-tracker" aria-label="Currency tracker">
          {COINS.map(coin => (
            <label key={coin.key} className="coin-field">
              <span>{coin.label}</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={coins[coin.key] ?? 0}
                disabled={!isOwner || locked}
                onChange={e => updateCurrency(coin.key, Math.floor(Number(e.target.value) || 0))}
              />
            </label>
          ))}
        </div>
        {isOwner && !locked && (
          <button className="inv-primary-add" onClick={() => setShowAddModal(true)}>+ Add to Inventory</button>
        )}
      </div>

      {showAddModal && (
        <AddInventoryModal
          inventory={inventory}
          srdMap={srdMap}
          onAdd={addItem}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Edit form */}
      {showingCustom && (
        <CustomItemForm
          initial={editItem}
          onSave={saveEdit}
          onCancel={() => { setEditItem(null) }}
        />
      )}

      {!showingCustom && (
        <>
          {/* ═══════════════ EQUIPPED ═══════════════ */}
          <div className="inv-section">
            <div className="inv-section-head">
              <span className="inv-section-label">Equipped</span>
            </div>

            {/* Attuned */}
            {attunedItems.length > 0 && (
              <div className="inv-sub">
                <div className="inv-sub-head">
                  <span>Attuned</span>
                  <div className="inv-attune-pips">
                    {Array.from({ length: Math.min(attunementLimit, 6) }, (_, i) => <span key={i} className={`inv-pip${i < attunedCount ? ' inv-pip--on' : ''}`} />)}
                    <span className="inv-pip-count">{attunedCount} / {attunementLimit}</span>
                  </div>
                </div>
                {attunedItems.map(item => renderRow(item))}
              </div>
            )}

            {/* Weapons */}
            {eq.weapon.length > 0 && (
              <div className="inv-sub">
                <div className="inv-sub-head"><span>Weapons</span></div>
                {eq.weapon.map(item => renderRow(item))}
              </div>
            )}

            {/* Armour */}
            {eq.armor.length > 0 && (
              <div className="inv-sub">
                <div className="inv-sub-head"><span>Armour</span></div>
                {eq.armor.map(item => renderRow(item))}
              </div>
            )}

            {/* Shields */}
            {eq.shield.length > 0 && (
              <div className="inv-sub">
                <div className="inv-sub-head"><span>Shields</span></div>
                {eq.shield.map(item => renderRow(item))}
              </div>
            )}

            {/* Equipped magic (not attuned) */}
            {eq.magic.length > 0 && (
              <div className="inv-sub">
                <div className="inv-sub-head"><span>Magic Items</span></div>
                {eq.magic.map(item => renderRow(item))}
              </div>
            )}

            {/* Other equipped */}
            {eq.gear.length > 0 && (
              <div className="inv-sub">
                <div className="inv-sub-head"><span>Other</span></div>
                {eq.gear.map(item => renderRow(item))}
              </div>
            )}

            {!hasEquipped && (
              <p className="empty-hint">Nothing equipped — tap the circle on any item below to equip it.</p>
            )}
          </div>

          {/* ═══════════════ BAG ═══════════════ */}
          <div className="inv-section">
            <div className="inv-section-head">
              <span className="inv-section-label">Bag</span>
            </div>

            {ammoItems.length > 0 && (
              <div className="inv-sub">
                <div className="inv-sub-head"><span>Ammunition</span></div>
                {ammoItems.map(item => renderRow(item, true))}
              </div>
            )}

            {gearItems.length > 0 && (
              <div className="inv-sub">
                <div className="inv-sub-head"><span>Adventuring Gear</span></div>
                {gearItems.map(item => renderRow(item, true))}
              </div>
            )}

            {currencyItems.length > 0 && (
              <div className="inv-sub">
                <div className="inv-sub-head"><span>Currency</span></div>
                {currencyItems.map(item => renderRow(item, true))}
              </div>
            )}

            {bagItems.length === 0 && (
              <p className="empty-hint">Bag is empty.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

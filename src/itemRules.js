export const AMMO_DEFS = {
  arrow: {
    index: 'arrow',
    name: 'Arrow',
    weight: 0.05,
  },
  bolt: {
    index: 'crossbow-bolt',
    name: 'Crossbow Bolt',
    weight: 0.075,
  },
  'firearm-bullet': {
    index: 'firearm-bullet',
    name: 'Firearm Bullet',
    weight: 0.2,
  },
  'sling-bullet': {
    index: 'sling-bullet',
    name: 'Sling Bullet',
    weight: 0.075,
  },
  needle: {
    index: 'blowgun-needle',
    name: 'Blowgun Needle',
    weight: 0.02,
  },
}

function bundleCount(value) {
  const match = String(value ?? '').match(/\((\d+)\)/)
  return match ? Number(match[1]) : null
}

function measuredQuantityFromName(value) {
  const name = String(value ?? '')
  const match = name.match(/\((\d+)\s*(feet|foot|ft)\)/i)
  if (!match) return null
  const amount = Number(match[1])
  if (!Number.isFinite(amount) || amount <= 0) return null
  return {
    amount,
    unit: 'ft',
    name: name.replace(/\s*\(\d+\s*(feet|foot|ft)\)\s*/i, '').trim() || name,
  }
}

export function ammoKindFromText(value) {
  const text = String(value ?? '').toLowerCase()
  if (/blowgun/.test(text) || /\bneedle(s)?\b/.test(text) && /\bammo|ammunition\b/.test(text)) return 'needle'
  if (/sling/.test(text) && /\bbullets?\b/.test(text)) return 'sling-bullet'
  if (/firearm|modern|renaissance|pistol|musket/.test(text) && /\bbullets?\b/.test(text)) return 'firearm-bullet'
  if (/\barrows?\b|\bbow\b|shortbow|longbow/.test(text)) return 'arrow'
  if (/\bbolts?\b|crossbow/.test(text)) return 'bolt'
  return null
}

export function ammoKindForItem(item) {
  if (item?.ammoKind) return item.ammoKind
  const text = `${item?.name ?? ''} ${item?.index ?? ''}`.toLowerCase()
  if (/case|quiver|pouch/.test(text)) return null
  if (/blowgun/.test(text) || /\bneedle(s)?\b/.test(text) && item?.equipment_category_index === 'ammunition') return 'needle'
  if (/sling/.test(text) && /\bbullets?\b/.test(text)) return 'sling-bullet'
  if (/firearm|modern|renaissance/.test(text) && /\bbullets?\b/.test(text)) return 'firearm-bullet'
  if (/\barrows?\b/.test(text)) return 'arrow'
  if (/\bbolts?\b/.test(text)) return 'bolt'
  return null
}

export function ammoKindForWeapon(weapon, srd = {}) {
  const text = `${weapon?.name ?? ''} ${weapon?.index ?? ''} ${srd?.name ?? ''}`
  if (/crossbow/i.test(text)) return 'bolt'
  if (/shortbow|longbow|\bbow\b/i.test(text)) return 'arrow'
  if (/blowgun/i.test(text)) return 'needle'
  if (/sling/i.test(text)) return 'sling-bullet'
  if (/firearm|pistol|musket/i.test(text)) return 'firearm-bullet'
  return null
}

export function canonicalizeAmmoItem(item) {
  const kind = ammoKindForItem(item)
  if (!kind || !AMMO_DEFS[kind]) return item
  const def = AMMO_DEFS[kind]
  const count = bundleCount(item.name)
  const quantityMultiplier = count && count > 1 ? count : item.quantityMultiplier
  const canonical = {
    ...item,
    index: def.index,
    name: def.name,
    weight: def.weight,
    isAmmo: true,
    ammoKind: kind,
    equipment_category: { index: 'ammunition', name: 'Ammunition' },
    equipment_category_index: 'ammunition',
    ...(quantityMultiplier ? { quantityMultiplier } : {}),
  }
  delete canonical.pack_contents
  return canonical
}

export function canonicalizeMeasuredItem(item) {
  if (item?.quantityUnit) return item
  const measured = measuredQuantityFromName(item?.name)
  if (!measured) return item
  return {
    ...item,
    name: measured.name,
    quantityMultiplier: measured.amount,
    quantityUnit: measured.unit,
    quantityStep: measured.amount,
    originalBundleName: item.name,
    ...(item.weight != null && { weight: item.weight / measured.amount }),
  }
}

export function inventoryItemFromCatalogItem(catalogItem, quantity = 1) {
  const item = canonicalizeMeasuredItem(canonicalizeAmmoItem(catalogItem))
  const multiplier = item.quantityMultiplier ?? 1
  return {
    index: item.index,
    name: item.name,
    source: item.source,
    quantity: (quantity ?? 1) * multiplier,
    ...(item.quantityUnit && { quantityUnit: item.quantityUnit }),
    ...(item.quantityStep && { quantityStep: item.quantityStep }),
    ...(item.originalBundleName && { originalBundleName: item.originalBundleName }),
    equipped: false,
    ...(item.isAmmo && { isAmmo: true, ammoKind: item.ammoKind }),
    ...(item.equipment_category && { equipment_category: item.equipment_category }),
    ...(item.equipment_category_index && { equipment_category_index: item.equipment_category_index }),
    ...(item.weapon_category && { weapon_category: item.weapon_category }),
    ...(item.weapon_range && { weapon_range: item.weapon_range }),
    ...(item.properties?.length && { properties: item.properties.map(prop => typeof prop === 'string' ? prop : prop.name) }),
    ...(item.armor_class && { armor_class: item.armor_class }),
    ...(item.armor_category && { armor_category: item.armor_category }),
    ...(item.weight != null && { weight: item.weight }),
    ...(item.damage && { damage: { dice: item.damage.damage_dice ?? item.damage.dice, type: item.damage.damage_type?.name ?? item.damage.type, ...(item.damage.versatile && { versatile: item.damage.versatile }) } }),
    ...(item.rarity && { rarity: typeof item.rarity === 'string' ? item.rarity : item.rarity.name }),
    ...(item.requires_attunement && { requiresAttunement: true }),
    ...(item.desc?.length && { description: item.desc.join(' ') }),
  }
}

export function normalizeInventoryItem(item, srdMap = {}) {
  const canonical = canonicalizeMeasuredItem(canonicalizeAmmoItem(item))
  const multiplier = canonical.quantityMultiplier ?? 1
  const srd = srdMap[canonical.index] ?? {}
  const normalized = {
    ...canonical,
    quantity: (item.quantity ?? 1) * multiplier,
    ...(srd.equipment_category && { equipment_category: srd.equipment_category }),
    ...(srd.equipment_category_index && { equipment_category_index: srd.equipment_category_index }),
    ...((canonical.weapon_category == null && srd.weapon_category) && { weapon_category: srd.weapon_category }),
    ...((canonical.weapon_range == null && srd.weapon_range) && { weapon_range: srd.weapon_range }),
    ...((!canonical.properties?.length && srd.properties?.length) && { properties: srd.properties.map(prop => typeof prop === 'string' ? prop : prop.name) }),
    ...((canonical.weight == null && srd.weight != null) && { weight: srd.weight }),
    ...((!canonical.damage && srd.damage) && { damage: { dice: srd.damage.damage_dice, type: srd.damage.damage_type?.name, ...(srd.damage.versatile && { versatile: srd.damage.versatile }) } }),
  }
  delete normalized.quantityMultiplier
  return normalized
}

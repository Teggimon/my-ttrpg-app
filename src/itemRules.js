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

export function ammoKindFromText(value) {
  const text = String(value ?? '').toLowerCase()
  if (/needle|blowgun/.test(text)) return 'needle'
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
  if (/needle/.test(text)) return 'needle'
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

export function inventoryItemFromCatalogItem(catalogItem, quantity = 1) {
  const item = canonicalizeAmmoItem(catalogItem)
  const multiplier = item.quantityMultiplier ?? 1
  return {
    index: item.index,
    name: item.name,
    source: item.source,
    quantity: (quantity ?? 1) * multiplier,
    equipped: false,
    ...(item.isAmmo && { isAmmo: true, ammoKind: item.ammoKind }),
    ...(item.equipment_category && { equipment_category: item.equipment_category }),
    ...(item.equipment_category_index && { equipment_category_index: item.equipment_category_index }),
    ...(item.armor_class && { armor_class: item.armor_class }),
    ...(item.armor_category && { armor_category: item.armor_category }),
    ...(item.weight != null && { weight: item.weight }),
    ...(item.damage && { damage: { dice: item.damage.damage_dice ?? item.damage.dice, type: item.damage.damage_type?.name ?? item.damage.type } }),
    ...(item.rarity && { rarity: typeof item.rarity === 'string' ? item.rarity : item.rarity.name }),
    ...(item.requires_attunement && { requiresAttunement: true }),
    ...(item.desc?.length && { description: item.desc.join(' ') }),
  }
}

export function normalizeInventoryItem(item, srdMap = {}) {
  const canonical = canonicalizeAmmoItem(item)
  const multiplier = canonical.quantityMultiplier ?? 1
  const srd = srdMap[canonical.index] ?? {}
  const normalized = {
    ...canonical,
    quantity: (item.quantity ?? 1) * multiplier,
    ...(srd.equipment_category && { equipment_category: srd.equipment_category }),
    ...(srd.equipment_category_index && { equipment_category_index: srd.equipment_category_index }),
    ...((canonical.weight == null && srd.weight != null) && { weight: srd.weight }),
    ...((!canonical.damage && srd.damage) && { damage: { dice: srd.damage.damage_dice, type: srd.damage.damage_type?.name } }),
  }
  delete normalized.quantityMultiplier
  return normalized
}

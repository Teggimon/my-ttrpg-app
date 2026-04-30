import '../TabShared.css'
import './InventoryTab.css'

export default function InventoryTab({ char, locked, isOwner, updateChar }) {
  const inventory = char.inventory ?? []
  const tracking  = char.settings?.encumbranceTracking
  const strScore  = char.stats?.abilityScores?.str ?? 10
  const capacity  = strScore * 15
  const totalWeight = inventory.reduce((s, i) => s + (i.weight ?? 0) * (i.quantity ?? 1), 0)
  const pct = tracking ? Math.min(100, Math.round((totalWeight / capacity) * 100)) : 0

  function toggleEquip(itemId) {
    updateChar({
      inventory: inventory.map(i =>
        i.itemId === itemId ? { ...i, equipped: !i.equipped } : i
      )
    })
  }

  function removeItem(itemId) {
    updateChar({ inventory: inventory.filter(i => i.itemId !== itemId) })
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

      {inventory.map(item => (
        <div key={item.itemId} className="inv-row card">
          <div className="inv-info">
            <span className="inv-name">{item.name}</span>
            {item.quantity > 1 && <span className="inv-qty">×{item.quantity}</span>}
          </div>
          <div className="inv-actions">
            {item.damage && (
              <span className={`equip-badge ${item.equipped ? 'equip-badge--on' : ''}`}
                onClick={() => isOwner && !locked && toggleEquip(item.itemId)}>
                {item.equipped ? '⚔ Equipped' : 'Equip'}
              </span>
            )}
            {isOwner && !locked && (
              <button className="inv-remove" onClick={() => removeItem(item.itemId)}>×</button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

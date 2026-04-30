import './BottomNav.css'

export default function BottomNav({ tabs, activeTab, onTabChange }) {
  return (
    <nav className="bottom-nav">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`bn-item ${activeTab === tab.id ? 'bn-item--active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <span className="bn-icon">{tab.icon}</span>
          <span className="bn-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
